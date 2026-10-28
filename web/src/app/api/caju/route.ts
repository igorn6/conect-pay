export const dynamic = "force-dynamic";
export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { authorize } from "@/lib/nubankBalance";
import { getCajuHubData, runCajuDepositReconciliation } from "@/lib/caju/cajuService";

/**
 * GET /api/caju?limit=500&reconcile=true
 * Retorna o estado completo do Hub Caju (snapshot patrimonial, 44+ colaboradores,
 * transações do extrato, movimentações de recarga/ajuste e fechamentos diários).
 */
export async function GET(req: Request) {
  try {
    const url = new URL(req.url);
    const userId = url.searchParams.get("userId");
    const limit = Math.min(5000, Math.max(50, Number(url.searchParams.get("limit")) || 5000));
    const shouldReconcile = url.searchParams.get("reconcile") === "true";

    const auth = await authorize(["MASTER", "FINANCEIRO"], req, userId);
    if (!auth.ok) {
      return NextResponse.json({ error: auth.error }, { status: auth.status });
    }

    if (shouldReconcile) {
      await runCajuDepositReconciliation();
    }

    const data = await getCajuHubData(limit);
    return NextResponse.json({ success: true, ...data });
  } catch (err: any) {
    console.error("[GET /api/caju]", err);
    return NextResponse.json({ error: err?.message || "Erro ao carregar Hub Caju." }, { status: 500 });
  }
}
