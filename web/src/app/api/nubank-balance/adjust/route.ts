export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { applyMovement, authorize } from "@/lib/nubankBalance";

/** POST /api/nubank-balance/adjust  { newBalance, description? } — EXCLUSIVO MASTER. */
export async function POST(req: Request) {
  try {
    const auth = await authorize(["MASTER"]);
    if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });

    const { newBalance, description } = await req.json();
    const value = Number(newBalance);

    if (!Number.isFinite(value) || Math.abs(value) > 1_000_000_000) {
      return NextResponse.json({ error: "Informe um saldo válido." }, { status: 400 });
    }
    const note = typeof description === "string" ? description.trim().slice(0, 200) : "";

    const result = await applyMovement({
      type: "AJUSTE",
      absolute: value,
      description: `${note || "Ajuste manual de saldo"} (por ${auth.name})`,
      userId: auth.userId,
    });

    return NextResponse.json({ success: true, balance: result.balance, delta: result.delta });
  } catch (err: any) {
    console.error("[API /nubank-balance/adjust]", err);
    return NextResponse.json({ error: err?.message || "Erro ao ajustar o saldo." }, { status: 500 });
  }
}
