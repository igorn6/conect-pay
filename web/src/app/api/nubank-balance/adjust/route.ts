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

/** POST /api/nubank-balance/adjust  { newBalance/targetBalance, description/reason?, userId? } — EXCLUSIVO MASTER. */
export async function POST(req: Request) {
  try {
    const body = await req.json();
    const rawBalance = body?.newBalance ?? body?.targetBalance;
    const rawDescription = body?.description ?? body?.reason;
    const userId = body?.userId;

    const auth = await authorize(["MASTER"], req, userId);
    if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });

    const value = parseBRL(rawBalance);
    if (!Number.isFinite(value) || value < 0 || value > 1_000_000_000) {
      return NextResponse.json({ error: "Informe um saldo válido (maior ou igual a zero)." }, { status: 400 });
    }
    const note = typeof rawDescription === "string" ? rawDescription.trim().slice(0, 200) : "";

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
