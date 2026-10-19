export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { applyMovement, authorize } from "@/lib/nubankBalance";

/** POST /api/nubank-balance/refund  { amount, description } — MASTER ou FINANCEIRO. */
export async function POST(req: Request) {
  try {
    const auth = await authorize(["MASTER", "FINANCEIRO"], req);
    if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });

    const { amount, description } = await req.json();
    const value = Number(amount);

    if (!Number.isFinite(value) || value <= 0 || value > 1_000_000_000) {
      return NextResponse.json({ error: "Informe um valor de reembolso válido (maior que zero)." }, { status: 400 });
    }
    const text = typeof description === "string" ? description.trim().slice(0, 200) : "";
    if (!text) {
      return NextResponse.json({ error: "A descrição/origem do reembolso é obrigatória." }, { status: 400 });
    }

    const result = await applyMovement({
      type: "REEMBOLSO",
      delta: value,
      description: `${text} (por ${auth.name})`,
      userId: auth.userId,
    });

    return NextResponse.json({ success: true, balance: result.balance, delta: result.delta });
  } catch (err: any) {
    console.error("[API /nubank-balance/refund]", err);
    return NextResponse.json({ error: err?.message || "Erro ao registrar reembolso." }, { status: 500 });
  }
}
