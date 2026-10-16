export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { authorize, getNubankSnapshot } from "@/lib/nubankBalance";

/** GET /api/nubank-balance?limit=5 — saldo atual + últimas movimentações (MASTER/FINANCEIRO). */
export async function GET(req: Request) {
  try {
    const auth = await authorize(["MASTER", "FINANCEIRO"]);
    if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });

    const limitParam = Number(new URL(req.url).searchParams.get("limit"));
    const limit = Number.isFinite(limitParam) && limitParam > 0 ? Math.min(limitParam, 200) : 50;

    const snapshot = await getNubankSnapshot(limit);
    return NextResponse.json(snapshot, { headers: { "Cache-Control": "no-store" } });
  } catch (err: any) {
    console.error("[API /nubank-balance GET]", err);
    return NextResponse.json({ error: err?.message || "Erro ao consultar o saldo Nubank." }, { status: 500 });
  }
}
