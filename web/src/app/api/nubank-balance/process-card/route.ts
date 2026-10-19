export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { authorize, processCardMovement } from "@/lib/nubankBalance";

/**
 * POST /api/nubank-balance/process-card  { paymentId, userId? }
 * Gatilho chamado após qualquer transição de status ou mudança de conta/CNPJ.
 * É idempotente: a trava balance_processed impede qualquer desconto/soma duplicada.
 */
export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { paymentId, userId } = body || {};

    if (!paymentId || typeof paymentId !== "string") {
      return NextResponse.json({ error: "paymentId é obrigatório." }, { status: 400 });
    }

    const auth = await authorize(["MASTER", "FINANCEIRO", "GESTOR"], req, userId);
    if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });

    const result = await processCardMovement(paymentId, auth.userId);
    if ((result as any).notFound) {
      return NextResponse.json({ error: result.reason }, { status: 404 });
    }

    return NextResponse.json({ success: true, ...result });
  } catch (err: any) {
    console.error("[API /nubank-balance/process-card]", err);
    return NextResponse.json({ error: err?.message || "Erro ao processar saldo do cartão." }, { status: 500 });
  }
}
