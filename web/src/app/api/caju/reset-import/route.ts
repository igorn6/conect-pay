export const dynamic = "force-dynamic";
export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import * as fs from "fs";

const XLSX = require("xlsx");

const ANCHOR_DATE = "2026-10-27";
const ANCHOR_TOTAL = 11348.75;

const CSV_PATH = "C:/Users/Conectsol/Downloads/extrato-geral-de-despesas (7).csv";
const XLSX_PATH = "C:/Users/Conectsol/Downloads/extrato_20261028141304.xlsx";

function getNextBusinessDay(dateStr: string): string {
  const [y, m, d] = dateStr.split("-").map(Number);
  const dt = new Date(y, m - 1, d);
  const dow = dt.getDay();
  if (dow === 0) dt.setDate(dt.getDate() + 1);  // Dom → Seg
  if (dow === 6) dt.setDate(dt.getDate() + 2);  // Sab → Seg
  return dt.toISOString().slice(0, 10);
}

function parseBrDate(dateStr: string): string {
  let day: number, month: number, year: number;
  if (dateStr.includes("-") && dateStr.indexOf("-") === 2) {
    // dd-mm-yyyy HH:MM:SS
    [day, month, year] = dateStr.slice(0, 10).split("-").map(Number);
  } else {
    // dd/mm/yyyy HH:MM
    [day, month, year] = dateStr.slice(0, 10).split("/").map(Number);
  }
  const mm = String(month).padStart(2, "0");
  const dd = String(day).padStart(2, "0");
  return `${year}-${mm}-${dd}`;
}

function parseAmount(val: any): number {
  if (typeof val === "number") return Math.abs(val);
  return parseFloat(
    String(val)
      .replace(/R\$\s?Â?\s?/g, "")
      .replace(/\./g, "")
      .replace(",", ".")
      .trim()
  );
}

// ─── Parse CSV (COMPRAS) ───────────────────────────────────────────────────
function parseCsv() {
  const content = fs.readFileSync(CSV_PATH, { encoding: "latin1" });
  const lines = content.split("\n").filter((l) => l.trim());
  const header = lines[0].split(";");

  const normalize = (s: string) =>
    s.replace(/[^a-zA-Z ]/g, "").toLowerCase().trim();
  const idx: Record<string, number> = {};
  header.forEach((h, i) => {
    const n = normalize(h);
    if (n.includes("nome do colabor")) idx.collaborator = i;
    if (n.includes("cpf")) idx.cpf = i;
    if (n.includes("tipo de transa")) idx.tipo = i;
    if (n.includes("nome do estabele")) idx.merchant = i;
    if (n.includes("valor")) idx.value = i;
    if (n.includes("data")) idx.date = i;
    if (n.includes("status da transa")) idx.status = i;
    if (n.includes("categoria")) idx.category = i;
    if (n.includes("nome do adiantamento")) idx.advance = i;
  });

  const transactions: any[] = [];
  let skipped = 0;

  for (let i = 1; i < lines.length; i++) {
    const cols = lines[i].split(";");
    const status = (cols[idx.status] || "").trim();
    const tipo = (cols[idx.tipo] || "").trim();

    if (tipo !== "Compra") { skipped++; continue; }
    // Inclui Completa e Pendente (ignora apenas Estornada)
    if (status === "Estornada") { skipped++; continue; }

    const rawDate = parseBrDate((cols[idx.date] || "").trim());
    const effectiveDate = getNextBusinessDay(rawDate);
    const amount = parseAmount(cols[idx.value]);

    if (!amount || isNaN(amount)) { skipped++; continue; }

    const collaborator = (cols[idx.collaborator] || "").trim();
    const cpf = (cols[idx.cpf] || "").replace(/[^0-9]/g, "").trim().padEnd(11, "0").slice(0, 11);
    const merchant = (cols[idx.merchant] || "").trim();
    const advance = (cols[idx.advance] || "").trim();

    // tx_hash: hash único por transação
    const hashBase = `${cpf}-${rawDate}-${amount}-${merchant}`.replace(/\s/g, "");
    const tx_hash = Buffer.from(hashBase).toString("base64").slice(0, 40) + i;

    transactions.push({
      tx_hash,
      tx_type: "COMPRA",
      advance_name: advance || "Carteira Despesas",
      collaborator_name: collaborator || "Colaborador",
      cpf: cpf || "00000000000",
      raw_type: "Compra",
      merchant: merchant || "-",
      amount,
      // occurred_at: usar a data efetiva (segunda-feira se fim de semana)
      occurred_at: `${effectiveDate}T12:00:00-03:00`,
      applied_to_balance: false,
      reconciliation_status: "NAO_APLICAVEL",
    });
  }

  return { transactions, skipped };
}

// ─── Parse XLSX (RECARGAS — Depósito de Créditos) ─────────────────────────
function parseXlsx() {
  const buf = fs.readFileSync(XLSX_PATH);
  const wb = XLSX.read(buf, { type: "buffer" });
  const ws = wb.Sheets[wb.SheetNames[0]];
  const data: any[][] = XLSX.utils.sheet_to_json(ws, { header: 1, defval: "" });
  const rows = data.slice(4).filter((r: any[]) =>
    r[0] && typeof r[0] === "string" && r[0].includes("/")
  );

  const recharges: any[] = [];

  for (const row of rows) {
    const [dateStr, , , acao, , , , , , valor] = row;
    if (!acao || acao !== "Depósito de Créditos") continue;

    const rawDate = parseBrDate(String(dateStr).trim());
    const effectiveDate = getNextBusinessDay(rawDate);
    const amount = Math.abs(Number(valor));
    if (!amount || isNaN(amount)) continue;

    recharges.push({
      date: effectiveDate,
      rawDate,
      amount,
      description: `Recarga Caju (Depósito de Créditos) • ${rawDate}`,
    });
  }

  return recharges;
}

export async function POST(req: Request) {
  const logs: string[] = [];

  try {
    // ── STEP 1: Limpar tabelas ──────────────────────────────────────────────
    logs.push("🗑️ STEP 1: Limpando tabelas Caju...");

    const tables = [
      "caju_recharge_credits",
      "caju_daily_closings",
      "caju_movements",
      "caju_transactions",
      "caju_collaborators",
      "caju_import_batches",
    ];

    for (const table of tables) {
      // Use gt to delete all rows (workaround for no-where-clause restriction)
      const { error } = await supabaseAdmin
        .from(table)
        .delete()
        .gte("created_at", "2000-01-01");

      if (error) {
        // id-based delete for tables without created_at
        const { error: e2 } = await supabaseAdmin
          .from(table)
          .delete()
          .neq("id", "00000000-0000-0000-0000-000000000000");
        if (e2) {
          if (e2.message.includes("does not exist") || e2.code === "42P01") {
            logs.push(`  ⚠️ ${table} não existe — pulando`);
          } else {
            logs.push(`  ❌ Erro ${table}: ${e2.message}`);
          }
        } else {
          logs.push(`  ✅ ${table} limpa`);
        }
      } else {
        logs.push(`  ✅ ${table} limpa`);
      }
    }

    // ── STEP 2: Reset wallet ─────────────────────────────────────────────────
    logs.push("💰 STEP 2: Resetando caju_wallet...");
    const { error: wErr } = await supabaseAdmin
      .from("caju_wallet")
      .upsert({
        id: "caju",
        free_balance: ANCHOR_TOTAL,
        card_balance: 0,
        cutoff_at: `${ANCHOR_DATE}T12:00:00-03:00`,
        updated_at: new Date().toISOString(),
      }, { onConflict: "id" });

    if (wErr) {
      logs.push(`  ⚠️ card_balance não existe, tentando sem ele...`);
      await supabaseAdmin.from("caju_wallet").upsert({
        id: "caju",
        free_balance: ANCHOR_TOTAL,
        cutoff_at: `${ANCHOR_DATE}T12:00:00-03:00`,
        updated_at: new Date().toISOString(),
      }, { onConflict: "id" });
    }
    logs.push(`  ✅ Wallet: R$ ${ANCHOR_TOTAL} (âncora ${ANCHOR_DATE})`);

    // ── STEP 3: Parse arquivos ───────────────────────────────────────────────
    logs.push("📂 STEP 3: Parseando arquivos...");
    const { transactions: csvTxs, skipped } = parseCsv();
    const recharges = parseXlsx();
    logs.push(`  CSV: ${csvTxs.length} compras (${skipped} ignoradas)`);
    logs.push(`  XLSX: ${recharges.length} recargas`);

    // ── STEP 4: Criar batch de importação ────────────────────────────────────
    logs.push("📦 STEP 4: Criando batch de importação...");
    const { data: batchData, error: batchErr } = await supabaseAdmin
      .from("caju_import_batches")
      .insert({
        file_name: "reimport_2026_10_28",
        total_rows: csvTxs.length + recharges.length,
        completed_rows: csvTxs.length,
        inserted_rows: 0,
        duplicate_rows: 0,
        ignored_rows: skipped,
        applied_rows: 0,
        new_collaborators: 0,
      })
      .select()
      .single();

    if (batchErr) throw new Error(`Batch: ${batchErr.message}`);
    const batchId = batchData.id;
    logs.push(`  ✅ Batch: ${batchId}`);

    // ── STEP 5: Inserir COMPRAs ──────────────────────────────────────────────
    logs.push("📥 STEP 5: Inserindo COMPRAs...");
    const CHUNK = 150;
    let insertedTx = 0;
    let errorsTx = 0;

    for (let i = 0; i < csvTxs.length; i += CHUNK) {
      const chunk = csvTxs.slice(i, i + CHUNK).map((tx) => ({
        ...tx,
        import_batch_id: batchId,
      }));

      const { error: insErr } = await supabaseAdmin
        .from("caju_transactions")
        .insert(chunk);

      if (insErr) {
        logs.push(`  ❌ Chunk ${i}-${i + chunk.length}: ${insErr.message}`);
        errorsTx += chunk.length;
      } else {
        insertedTx += chunk.length;
      }
    }
    logs.push(`  ✅ COMPRAs inseridas: ${insertedTx} (erros: ${errorsTx})`);

    // ── STEP 6: Registrar RECARGAs via caju_movements ────────────────────────
    logs.push("💳 STEP 6: Registrando RECARGAs nos movimentos...");
    let insertedRecharges = 0;

    for (const r of recharges) {
      const { error: movErr } = await supabaseAdmin.from("caju_movements").insert({
        type: "RECARGA",
        free_delta: r.amount,
        cards_delta: 0,
        description: r.description,
        created_at: `${r.date}T12:00:00-03:00`,
      });

      if (movErr) {
        logs.push(`  ❌ Recarga ${r.date} R$${r.amount}: ${movErr.message}`);
      } else {
        insertedRecharges++;
      }
    }
    logs.push(`  ✅ RECARGAs registradas: ${insertedRecharges}`);

    // ── STEP 7: Atualizar batch ──────────────────────────────────────────────
    await supabaseAdmin
      .from("caju_import_batches")
      .update({
        inserted_rows: insertedTx,
        applied_rows: insertedTx + insertedRecharges,
      })
      .eq("id", batchId);

    // ── STEP 8: Verificar resultado ──────────────────────────────────────────
    logs.push("🔍 STEP 7: Verificando resultado...");
    const { count: totalTx } = await supabaseAdmin
      .from("caju_transactions")
      .select("*", { count: "exact", head: true });
    const { count: totalMov } = await supabaseAdmin
      .from("caju_movements")
      .select("*", { count: "exact", head: true });

    logs.push(`  caju_transactions: ${totalTx} registros`);
    logs.push(`  caju_movements: ${totalMov} registros`);

    logs.push("✨ CONCLUÍDO! Acesse localhost:3000/caju para verificar.");
    return NextResponse.json({ success: true, logs });
  } catch (err: any) {
    logs.push(`❌ ERRO FATAL: ${err.message}`);
    console.error("[reset-import]", err);
    return NextResponse.json(
      { success: false, logs, error: err.message },
      { status: 500 }
    );
  }
}
