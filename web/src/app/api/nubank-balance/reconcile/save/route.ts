export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { authorize } from "@/lib/nubankBalance";
import { saveDailyReconciliations } from "@/lib/nubankReconciliation";

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const dailyResults = body?.dailyResults || [];
    const sourceFileName = body?.sourceFileName || "Extrato Nubank";
    const userId = body?.userId || null;

    const auth = await authorize(["MASTER", "FINANCEIRO"], req, userId);
    if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });

    if (!Array.isArray(dailyResults) || dailyResults.length === 0) {
      return NextResponse.json({ error: "Nenhum dia para salvar conciliação." }, { status: 400 });
    }

    const { savedCount } = await saveDailyReconciliations({
      dailyResults,
      userId: auth.userId,
      sourceFileName,
    });

    return NextResponse.json({ success: true, savedCount });
  } catch (err: any) {
    console.error("[POST /api/nubank-balance/reconcile/save]", err);
    return NextResponse.json({ error: err.message || "Erro ao salvar fechamento diário." }, { status: 500 });
  }
}
