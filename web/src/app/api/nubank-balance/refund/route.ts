export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { applyMovement, authorize } from "@/lib/nubankBalance";

function parseBRL(val: unknown): number {
  if (typeof val === "number") return val;
  if (typeof val !== "string") return NaN;
  const clean = val.trim().replace(/^R\$\s*/i, "").trim();
  if (!clean) return NaN;
  if (clean.includes(",") && clean.includes(".")) {
    return parseFloat(clean.replace(/\./g, "").replace(",", "."));
  }
  if (clean.includes(",")) {
    return parseFloat(clean.replace(/\s/g, "").replace(",", "."));
  }
  return parseFloat(clean.replace(/\s/g, ""));
}

/** POST /api/nubank-balance/refund  { amount, description/reason, userId? } — MASTER ou FINANCEIRO. */
export async function POST(req: Request) {
  try {
    const body = await req.json();
    const rawAmount = body?.amount;
    const rawDescription = body?.description ?? body?.reason;
    const userId = body?.userId;

    const auth = await authorize(["MASTER", "FINANCEIRO"], req, userId);
    if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });

    const value = parseBRL(rawAmount);
    if (!Number.isFinite(value) || value <= 0 || value > 1_000_000_000) {
      return NextResponse.json({ error: "Informe um valor de reembolso válido (maior que zero)." }, { status: 400 });
    }
    const text = typeof rawDescription === "string" ? rawDescription.trim().slice(0, 200) : "";
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
