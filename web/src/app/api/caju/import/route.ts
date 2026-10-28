export const dynamic = "force-dynamic";
export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { authorize } from "@/lib/nubankBalance";
import { getCajuHubData, importCajuCsvStatement } from "@/lib/caju/cajuService";

/**
 * POST /api/caju/import
 * Importa extrato CSV Caju (; / UTF-8 com BOM), aplica anti-duplicidade,
 * auto-cadastra colaboradores novos, respeita o corte temporal 27/10/2026 12:04:21
 * e executa o Validador IA automático cruzando depósitos com o Kanban.
 */
export async function POST(req: Request) {
  try {
    const contentType = req.headers.get("content-type") || "";
    let csvText = "";
    let fileName = "extrato_caju.csv";
    let providedUserId: string | null = null;

    if (contentType.includes("multipart/form-data")) {
      const formData = await req.formData();
      const file = formData.get("file") as File | null;
      providedUserId = (formData.get("userId") as string) || null;
      if (file) {
        fileName = file.name || fileName;
        const buf = Buffer.from(await file.arrayBuffer());
        csvText = buf.toString("utf8");
      } else {
        csvText = String(formData.get("csvText") || "");
      }
    } else {
      const body = await req.json();
      csvText = String(body?.csvText || "");
      fileName = String(body?.fileName || fileName);
      providedUserId = body?.userId || null;
    }

    const auth = await authorize(["MASTER", "FINANCEIRO"], req, providedUserId);
    if (!auth.ok) {
      return NextResponse.json({ error: auth.error }, { status: auth.status });
    }

    if (!csvText.trim()) {
      return NextResponse.json({ error: "Envie um arquivo CSV válido do Caju." }, { status: 400 });
    }

    const summary = await importCajuCsvStatement({
      csvText,
      fileName,
      userId: auth.userId,
    });
    const hub = await getCajuHubData(5000);

    return NextResponse.json({ success: true, summary, ...hub });
  } catch (err: any) {
    console.error("[POST /api/caju/import]", err);
    return NextResponse.json({ error: err?.message || "Erro ao importar extrato Caju." }, { status: 400 });
  }
}
