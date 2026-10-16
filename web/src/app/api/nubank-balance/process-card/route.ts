export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { authorize, processCardMovement } from "@/lib/nubankBalance";

/**
 * POST /api/nubank-balance/process-card  { paymentId }
 * Gatilho chamado após qualquer transição de status feita por Financeiro/Master.
 * É idempotente: a trava balance_processed impede qualquer desconto/soma duplicada.
 */
export async function POST(req: Request) {
  try {
    const auth = await authorize(["MASTER", "FINANCEIRO"]);
    if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });

    const { paymentId } = await req.json();
    if (!paymentId || typeof paymentId !== "string") {
      return NextResponse.json({ error: "paymentId é obrigatório." }, { status: 400 });
    }

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
