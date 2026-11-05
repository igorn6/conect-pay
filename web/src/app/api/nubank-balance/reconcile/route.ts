export const dynamic = "force-dynamic";
export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { authorize } from "@/lib/nubankBalance";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { parseNubankStatement } from "@/utils/nubankStatementParser";
import {
  reconcileStatement,
  saveDailyReconciliations,
} from "@/lib/nubankReconciliation";

/**
 * GET /api/nubank-balance/reconcile
 * Retorna histórico de fechamentos diários e itens auditados.
 */
export async function GET(req: Request) {
  try {
    const url = new URL(req.url);
    const queryUserId = url.searchParams.get("userId");
    const auth = await authorize(["MASTER", "FINANCEIRO"], req, queryUserId);
    if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });

    const { data: reconciliations, error } = await supabaseAdmin
      .from("nubank_daily_reconciliation")
      .select("*, nubank_statement_items(*)")
      .order("reconciliation_date", { ascending: false })
      .limit(60);

    if (error) throw error;

    return NextResponse.json({ success: true, reconciliations: reconciliations || [] });
  } catch (err: any) {
    console.error("[GET /api/nubank-balance/reconcile]", err);
    return NextResponse.json({ error: err.message || "Erro ao consultar conciliações." }, { status: 500 });
  }
}

/**
 * POST /api/nubank-balance/reconcile
 * Valida o extrato importado (PDF, CSV ou Texto) e cruza com os lançamentos do sistema.
 */
export async function POST(req: Request) {
  try {
    const contentType = req.headers.get("content-type") || "";
    let rawText = "";
    let fileName = "Extrato Importado";
    let manualBalance: number | null = null;
    let saveImmediately = false;
    let providedUserId: string | null = null;

    if (contentType.includes("multipart/form-data")) {
      const formData = await req.formData();
      const file = formData.get("file") as File | null;
      providedUserId = (formData.get("userId") as string) || null;
      const rawBalance = formData.get("statementBalance") as string | null;
      if (rawBalance) {
        manualBalance = parseFloat(rawBalance.replace(/[R$\s]/g, "").replace(/\./g, "").replace(",", "."));
      }
      saveImmediately = formData.get("save") === "true";

      if (!file) {
        return NextResponse.json({ error: "Nenhum arquivo enviado para validação." }, { status: 400 });
      }

      fileName = file.name || "extrato.csv";
      const isPdf = fileName.toLowerCase().endsWith(".pdf");

      if (isPdf) {
        const arrayBuf = await file.arrayBuffer();

        // 1. Tentar unpdf (moderno PDF.js sem dependências nativas e com suporte a XRef streams)
        try {
          const { extractText } = await import("unpdf");
          const res = await extractText(new Uint8Array(arrayBuf));
          if (res?.text) {
            rawText = Array.isArray(res.text) ? res.text.join("\n\n") : res.text;
          }
        } catch (unpdfErr) {
          console.warn("[reconcile PDF] unpdf extraction falhou, tentando fallbacks:", unpdfErr);
        }

        // 2. Se unpdf não extraiu texto, tentar pdf-parse com versões alternativas
        if (!rawText.trim()) {
          try {
            const pdfParse = require("pdf-parse/lib/pdf-parse.js");
            const buffer = Buffer.from(arrayBuf);
            const pdfData = await pdfParse(buffer, { version: "v2.0.550" });
            rawText = pdfData?.text || "";
          } catch (pdfParseErr) {
            try {
              const pdfParse = require("pdf-parse/lib/pdf-parse.js");
              const buffer = Buffer.from(arrayBuf);
              const pdfData = await pdfParse(buffer);
              rawText = pdfData?.text || "";
            } catch (legacyErr) {
              console.warn("[reconcile PDF] pdf-parse fallback falhou:", legacyErr);
            }
          }
        }

        // 3. Fallback com IA (Gemini 2.5 Flash) se as bibliotecas locais falharem por corrupção de XRef
        if (!rawText.trim() && (process.env.GEMINI_API_KEY || process.env.GOOGLE_GENERATIVE_AI_API_KEY)) {
          try {
            const { createGoogleGenerativeAI } = await import("@ai-sdk/google");
            const { generateText } = await import("ai");
            const apiKey = process.env.GEMINI_API_KEY || process.env.GOOGLE_GENERATIVE_AI_API_KEY;
            const google = createGoogleGenerativeAI({ apiKey });
            const result = await generateText({
              model: google("gemini-2.5-flash"),
              messages: [
                {
                  role: "user",
                  content: [
                    {
                      type: "text",
                      text: "Extraia e transcreva integralmente todo o texto deste extrato bancário do Nubank, linha por linha exatamente como está escrito (incluindo todas as seções, datas, descrições, valores e saldos). Não resuma e não adicione explicações.",
                    },
                    {
                      type: "file",
                      data: Buffer.from(arrayBuf),
                      mediaType: "application/pdf",
                    },
                  ],
                },
              ],
            });
            rawText = result.text || "";
          } catch (aiErr) {
            console.error("[reconcile PDF] Gemini fallback falhou:", aiErr);
          }
        }

        if (!rawText.trim()) {
          return NextResponse.json(
            { error: "Não foi possível extrair o texto deste arquivo PDF. Se preferir, exporte o extrato em formato CSV no app do Nubank ou cole o texto na aba 'Colar Texto do Extrato'." },
            { status: 422 }
          );
        }
      } else {
        rawText = await file.text();
      }
    } else {
      const body = await req.json();
      rawText = body?.rawText || "";
      fileName = body?.fileName || "Extrato Colado";
      manualBalance = body?.statementBalance !== undefined ? Number(body.statementBalance) : null;
      saveImmediately = Boolean(body?.saveImmediately);
      providedUserId = body?.userId || null;
    }

    const auth = await authorize(["MASTER", "FINANCEIRO"], req, providedUserId);
    if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });

    if (!rawText.trim()) {
      return NextResponse.json({ error: "O conteúdo do extrato está vazio." }, { status: 400 });
    }

    // 1. Parsing do extrato
    const parsed = parseNubankStatement(rawText);
    if (!parsed.success || parsed.items.length === 0) {
      return NextResponse.json(
        {
          error: parsed.error || "Não foi possível identificar lançamentos válidos no extrato fornecido.",
        },
        { status: 422 }
      );
    }

    // 2. Conciliação e cruzamento de saldos
    const report = await reconcileStatement(parsed, manualBalance);

    // 3. Persistência automática no banco de dados para registrar todas as entradas e saídas do extrato oficial
    if (report.dailyResults.length > 0) {
      await saveDailyReconciliations({
        dailyResults: report.dailyResults,
        userId: auth.userId,
        sourceFileName: fileName,
      });
    }

    return NextResponse.json({
      success: true,
      report,
      parsedSummary: {
        format: parsed.format,
        itemsCount: parsed.items.length,
        fileName,
      },
    });
  } catch (err: any) {
    console.error("[POST /api/nubank-balance/reconcile]", err);
    return NextResponse.json(
      { error: err?.message || "Erro inesperado ao processar conciliação bancária." },
      { status: 500 }
    );
  }
}
