/**
 * Parser do extrato CSV exportado pela Caju (separador ";" — UTF-8 com BOM).
 * Colunas: Nome do Adiantamento;Nome do Colaborador;CPF;Tipo de Transação;
 *          Nome do Estabelecimento;Valor (R$);Data;Status da Transação
 *
 * Função pura (sem I/O) — usada no servidor e testável isoladamente.
 */
import { normalizeCpf, round2, type CajuTxType } from "@/constants/caju";

export interface ParsedCajuRow {
  hash: string;
  advance_name: string;
  collaborator_name: string;
  cpf: string;
  tx_type: CajuTxType;
  raw_type: string;
  merchant: string;
  amount: number; // positivo
  occurred_at: string; // ISO com offset -03:00
  line: number;
}

export interface ParsedCajuCsv {
  rows: ParsedCajuRow[];
  totalRows: number;
  ignoredRows: number; // não "Completa" ou inválidas
  warnings: string[];
}

const COLUMN_KEYS = {
  advance: ["nome do adiantamento", "adiantamento"],
  collaborator: ["nome do colaborador", "colaborador"],
  cpf: ["cpf"],
  type: ["tipo de transacao", "tipo"],
  merchant: ["nome do estabelecimento", "estabelecimento"],
  amount: ["valor (r$)", "valor"],
  date: ["data", "data da transacao"],
  status: ["status da transacao", "status"],
} as const;

type ColumnKey = keyof typeof COLUMN_KEYS;

export function stripAccents(s: string): string {
  return s.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
}

const norm = (s: string) => stripAccents(String(s || "")).toLowerCase().replace(/\s+/g, " ").trim();

/** Split de uma linha CSV respeitando aspas duplas. */
function splitCsvLine(line: string, delimiter: string): string[] {
  const out: string[] = [];
  let cur = "";
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      if (inQuotes && line[i + 1] === '"') {
        cur += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (ch === delimiter && !inQuotes) {
      out.push(cur);
      cur = "";
    } else {
      cur += ch;
    }
  }
  out.push(cur);
  return out.map((v) => v.trim());
}

export function mapTxType(raw: string): CajuTxType {
  const t = norm(raw);
  if (t.startsWith("deposito")) return "DEPOSITO";
  if (t.includes("resgate")) return "RESGATE";
  if (t.startsWith("compra")) return "COMPRA";
  return "OUTRO";
}

/** "R$ 1.234,56" | "-1.234,56" | "1234.56" | "50,00" -> 1234.56 (valor absoluto) */
export function parseBrlAmount(raw: string): number {
  let s = String(raw || "").replace(/R\$/gi, "").replace(/\s/g, "").replace(/[()]/g, "");
  if (!s) return NaN;
  if (s.includes(",") && s.includes(".")) {
    s = s.lastIndexOf(",") > s.lastIndexOf(".") ? s.replace(/\./g, "").replace(",", ".") : s.replace(/,/g, "");
  } else if (s.includes(",")) {
    s = s.replace(",", ".");
  }
  const n = parseFloat(s);
  return Number.isFinite(n) ? round2(Math.abs(n)) : NaN;
}

/**
 * Converte datas da Caju para ISO com fuso de Brasília (-03:00).
 * Aceita: 27/10/2026 12:04:21 | 27-10-2026 12:04 | 2026-10-27 12:04:21 | 2026-10-27T12:04:21 | 27/10/2026
 */
export function parseCajuDate(raw: string): string | null {
  const s = String(raw || "").trim();
  if (!s) return null;
  let y: string, mo: string, d: string;
  let rest = "";
  let m = s.match(/^(\d{1,2})[/\-.](\d{1,2})[/\-.](\d{2,4})(?:[\sT,]+(.*))?$/);
  if (m) {
    d = m[1];
    mo = m[2];
    y = m[3].length === 2 ? `20${m[3]}` : m[3];
    rest = m[4] || "";
  } else {
    m = s.match(/^(\d{4})-(\d{1,2})-(\d{1,2})(?:[\sT]+(.*))?$/);
    if (!m) return null;
    y = m[1];
    mo = m[2];
    d = m[3];
    rest = m[4] || "";
  }
  const t = rest.match(/^(\d{1,2}):(\d{2})(?::(\d{2}))?/);
  const hh = t ? t[1].padStart(2, "0") : "00";
  const mm = t ? t[2] : "00";
  const ss = t && t[3] ? t[3] : "00";
  const iso = `${y}-${mo.padStart(2, "0")}-${d.padStart(2, "0")}T${hh}:${mm}:${ss}-03:00`;
  return Number.isNaN(new Date(iso).getTime()) ? null : iso;
}

/** Hash idempotente: `${Data}_${CPF}_${Tipo}_${Valor}_${Estabelecimento}` (normalizados). */
export function buildCajuTxHash(r: { occurred_at: string; cpf: string; raw_type: string; amount: number; merchant: string }): string {
  return [r.occurred_at.slice(0, 19), r.cpf, norm(r.raw_type), r.amount.toFixed(2), norm(r.merchant)].join("_");
}

export function parseCajuCsv(text: string): ParsedCajuCsv {
  const clean = String(text || "").replace(/^\uFEFF/, "");
  const lines = clean.split(/\r?\n/).filter((l) => l.trim().length > 0);
  const warnings: string[] = [];
  if (lines.length < 2) {
    return { rows: [], totalRows: 0, ignoredRows: 0, warnings: ["Arquivo vazio ou sem linhas de transação."] };
  }

  const delimiter = lines[0].includes(";") ? ";" : ",";
  const header = splitCsvLine(lines[0], delimiter).map(norm);

  const idx = {} as Record<ColumnKey, number>;
  (Object.keys(COLUMN_KEYS) as ColumnKey[]).forEach((key) => {
    const candidates = COLUMN_KEYS[key] as readonly string[];
    let found = header.findIndex((h) => candidates.includes(h));
    if (found < 0) found = header.findIndex((h) => candidates.some((c) => h.startsWith(c)));
    idx[key] = found;
  });

  const missing = (["collaborator", "cpf", "type", "amount", "date", "status"] as ColumnKey[]).filter((k) => idx[k] < 0);
  if (missing.length > 0) {
    throw new Error(
      `Cabeçalho do CSV inválido. Colunas não encontradas: ${missing.join(", ")}. ` +
        `Esperado: Nome do Adiantamento;Nome do Colaborador;CPF;Tipo de Transação;Nome do Estabelecimento;Valor (R$);Data;Status da Transação`
    );
  }

  const rows: ParsedCajuRow[] = [];
  const seen = new Set<string>();
  let ignored = 0;

  for (let i = 1; i < lines.length; i++) {
    const cols = splitCsvLine(lines[i], delimiter);
    const get = (k: ColumnKey) => (idx[k] >= 0 ? cols[idx[k]] || "" : "");

    // Regra: aceita transações "Completa" e "Pendente" (compras recentes no cartão ficam pendentes no Caju até compensação, mas já comprometem o saldo)
    const status = norm(get("status"));
    const isCompleted = status === "completa" || status === "completo";
    const isPending = status === "pendente";
    if (!isCompleted && !isPending) {
      ignored++;
      continue;
    }

    const cpf = normalizeCpf(get("cpf"));
    const occurred_at = parseCajuDate(get("date"));
    const amount = parseBrlAmount(get("amount"));
    const raw_type = get("type").trim();
    const collaborator_name = get("collaborator").trim();

    if (cpf.length < 11 || !occurred_at || !Number.isFinite(amount) || amount <= 0 || !collaborator_name) {
      ignored++;
      if (warnings.length < 15) warnings.push(`Linha ${i + 1} ignorada: dados incompletos ou inválidos.`);
      continue;
    }

    const merchant = get("merchant").trim();
    const row: ParsedCajuRow = {
      hash: "",
      advance_name: get("advance").trim(),
      collaborator_name,
      cpf: cpf.slice(-11),
      tx_type: mapTxType(raw_type),
      raw_type,
      merchant,
      amount,
      occurred_at,
      line: i + 1,
    };
    row.hash = buildCajuTxHash(row);

    // Duplicata dentro do próprio arquivo
    if (seen.has(row.hash)) continue;
    seen.add(row.hash);
    rows.push(row);
  }

  return { rows, totalRows: lines.length - 1, ignoredRows: ignored, warnings };
}
