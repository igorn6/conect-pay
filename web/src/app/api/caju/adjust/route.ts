export const dynamic = "force-dynamic";
export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { authorize } from "@/lib/nubankBalance";
import {
  adjustCajuCollaboratorBalance,
  adjustCajuFreeBalance,
  getCajuHubData,
} from "@/lib/caju/cajuService";

/**
 * POST /api/caju/adjust
 * - target = "FREE": ajusta o Saldo Livre (Caixa Despesas) por valor absoluto ou entrada (+delta).
 *   Permitido para MASTER (absoluto ou delta) e FINANCEIRO (entrada manual de recarga +delta).
 * - target = "COLLABORATOR": ajusta o saldo de um colaborador específico (exclusivo MASTER).
 */
export async function POST(req: Request) {
  try {
    const body = await req.json();
    const {
      target = "FREE",
      collaboratorId,
      newBalance,
      delta,
      reason,
      userId: providedUserId,
    } = body || {};

    const auth = await authorize(["MASTER", "FINANCEIRO"], req, providedUserId);
    if (!auth.ok) {
      return NextResponse.json({ error: auth.error }, { status: auth.status });
    }

    const description = String(reason || "").trim();
    if (!description) {
      return NextResponse.json({ error: "Informe o motivo/descrição do ajuste." }, { status: 400 });
    }

    if (target === "COLLABORATOR") {
      if (auth.role !== "MASTER") {
        return NextResponse.json({ error: "Apenas o perfil MASTER pode ajustar saldo de colaborador." }, { status: 403 });
      }
      const num = Number(newBalance);
      if (!collaboratorId || !Number.isFinite(num) || num < 0) {
        return NextResponse.json({ error: "Colaborador e novo saldo (>= 0) são obrigatórios." }, { status: 400 });
      }
      await adjustCajuCollaboratorBalance({
        collaboratorId,
        newBalance: num,
        description,
        userId: auth.userId,
      });
    } else {
      const hasAbs = newBalance !== undefined && newBalance !== null && newBalance !== "";
      const hasDelta = delta !== undefined && delta !== null && delta !== "";
      if (hasAbs && auth.role !== "MASTER") {
        return NextResponse.json({ error: "Apenas o perfil MASTER pode redefinir o Saldo Livre absoluto." }, { status: 403 });
      }
      if (!hasAbs && !hasDelta) {
        return NextResponse.json({ error: "Informe o novo saldo ou o valor de entrada." }, { status: 400 });
      }
      await adjustCajuFreeBalance({
        absolute: hasAbs ? Number(newBalance) : undefined,
        delta: hasDelta ? Number(delta) : undefined,
        description,
        userId: auth.userId,
      });
    }

    const hub = await getCajuHubData(5000);
    return NextResponse.json({ success: true, ...hub });
  } catch (err: any) {
    console.error("[POST /api/caju/adjust]", err);
    return NextResponse.json({ error: err?.message || "Erro ao ajustar saldo Caju." }, { status: 500 });
  }
}
