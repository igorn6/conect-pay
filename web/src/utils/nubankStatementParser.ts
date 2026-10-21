/**
 * Utilitário de Parsing para Extratos Bancários Nubank (CSV, PDF text, OFX)
 */

export interface ParsedStatementItem {
  id: string;
  date: string; // YYYY-MM-DD
  rawDate?: string;
  amount: number; // com sinal (+ entrada / - saída)
  type: "ENTRADA" | "SAIDA";
  description: string;
  beneficiaryOrSender?: string;
  identifier?: string;
}

export interface DailyStatementSummary {
  date: string; // YYYY-MM-DD
  dayClosingBalance?: number | null;
  entriesSum: number;
  exitsSum: number;
  itemCount: number;
}

export interface ParsedStatementResult {
  success: boolean;
  format: "CSV" | "PDF" | "OFX" | "TEXT" | "UNKNOWN";
  error?: string;
  periodStart?: string | null;
  periodEnd?: string | null;
  initialBalance?: number | null;
  finalBalance?: number | null;
  totalEntries: number;
  totalExits: number;
  items: ParsedStatementItem[];
  dailySummaries: Record<string, DailyStatementSummary>;
}

const MONTH_MAP: Record<string, string> = {
  jan: "01",
  fev: "02",
  mar: "03",
  abr: "04",
  mai: "05",
  jun: "06",
  jul: "07",
  ago: "08",
  set: "09",
  out: "10",
  nov: "11",
  dez: "12",
};

export function parseAmount(val: string | number): number {
  if (typeof val === "number") return val;
  if (!val) return 0;
  const clean = String(val).replace(/[R$\s+]/gi, "").trim();
  if (!clean) return 0;

  // Ambos ponto e vírgula presentes (ex: 1.500,00 ou 1,500.00)
  if (clean.includes(",") && clean.includes(".")) {
    if (clean.lastIndexOf(",") > clean.lastIndexOf(".")) {
      // Formato Brasileiro: 1.515,45
      return parseFloat(clean.replace(/\./g, "").replace(",", "."));
    } else {
      // Formato Internacional: 1,515.45
      return parseFloat(clean.replace(/,/g, ""));
    }
  }

  // Apenas vírgula (ex: -290,00)
  if (clean.includes(",")) {
    return parseFloat(clean.replace(",", "."));
  }

  // Apenas ponto ou sem separador (ex: -290.00 ou 1500)
  return parseFloat(clean);
}

export function parseMonth(name: string): string {
  const n = (name || "").toLowerCase().slice(0, 3);
  return MONTH_MAP[n] || "01";
}

/** Extrai nome limpo de quem pagou ou recebeu da descrição Pix do Nubank */
export function extractPersonName(desc: string): string {
  if (!desc) return "";
  // Padrão Nubank: "Transferência enviada pelo Pix - NOME - CPF..." ou "Transferência recebida pelo Pix - NOME - ..."
  const pixMatch = desc.match(/Transferência\s+(?:enviada|recebida)\s+pelo\s+Pix\s*[-–]\s*([^-–\n]+)/i);
  if (pixMatch && pixMatch[1]) {
    return pixMatch[1].trim();
  }
  // Padrão alternativo: "Pagamento: NOME"
  const payMatch = desc.match(/Pagamento:\s*([^-–\n]+)/i);
  if (payMatch && payMatch[1]) {
    return payMatch[1].trim();
  }
  return desc.slice(0, 60);
}

/** Parser para CSV padrão exportado pelo Nubank */
export function parseNubankCsv(text: string): ParsedStatementResult {
  const lines = text.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
  if (lines.length < 2) {
    return {
      success: false,
      format: "CSV",
      error: "O arquivo CSV está vazio ou contém apenas o cabeçalho.",
      totalEntries: 0,
      totalExits: 0,
      items: [],
      dailySummaries: {},
    };
  }

  const header = lines[0].toLowerCase();
  const delimiter = header.includes(";") ? ";" : ",";
  const items: ParsedStatementItem[] = [];
  const dailySummaries: Record<string, DailyStatementSummary> = {};

  let totalEntries = 0;
  let totalExits = 0;

  for (let i = 1; i < lines.length; i++) {
    const row = lines[i];
    const parts = row.split(delimiter);
    if (parts.length < 2) continue;

    const rawDate = parts[0]?.trim();
    const rawVal = parts[1]?.trim();
    const identificador = parts[2]?.trim() || "";
    const descricao = parts.slice(3).join(delimiter).trim() || parts[2]?.trim() || "Movimentação Nubank";

    // Formata Data DD/MM/YYYY para YYYY-MM-DD
    const dateParts = rawDate.split("/");
    let dateIso = rawDate;
    if (dateParts.length === 3) {
      const d = dateParts[0].padStart(2, "0");
      const m = dateParts[1].padStart(2, "0");
      const y = dateParts[2];
      dateIso = `${y}-${m}-${d}`;
    }

    const amount = parseAmount(rawVal);
    if (isNaN(amount) || amount === 0) continue;

    const isEntry = amount > 0;
    if (isEntry) {
      totalEntries += amount;
    } else {
      totalExits += Math.abs(amount);
    }

    const item: ParsedStatementItem = {
      id: identificador || `csv_${i}_${Date.now()}`,
      date: dateIso,
      rawDate,
      amount,
      type: isEntry ? "ENTRADA" : "SAIDA",
      description: descricao,
      beneficiaryOrSender: extractPersonName(descricao),
      identifier: identificador || undefined,
    };

    items.push(item);

    // Agrupamento diário
    if (!dailySummaries[dateIso]) {
      dailySummaries[dateIso] = {
        date: dateIso,
        entriesSum: 0,
        exitsSum: 0,
        itemCount: 0,
      };
    }
    if (isEntry) {
      dailySummaries[dateIso].entriesSum += amount;
    } else {
      dailySummaries[dateIso].exitsSum += Math.abs(amount);
    }
    dailySummaries[dateIso].itemCount += 1;
  }

  // Ordena itens por data decrescente
  items.sort((a, b) => b.date.localeCompare(a.date));

  const dates = items.map((it) => it.date).sort();
  const periodStart = dates.length > 0 ? dates[0] : null;
  const periodEnd = dates.length > 0 ? dates[dates.length - 1] : null;

  return {
    success: true,
    format: "CSV",
    periodStart,
    periodEnd,
    totalEntries: Math.round(totalEntries * 100) / 100,
    totalExits: Math.round(totalExits * 100) / 100,
    items,
    dailySummaries,
  };
}

/** Parser para texto extraído de PDF oficial do Nubank */
export function parseNubankPdfText(text: string): ParsedStatementResult {
  let periodStart: string | null = null;
  let periodEnd: string | null = null;
  let finalBalance: number | null = null;
  let initialBalance: number | null = null;
  const dailyBalances: Record<string, number> = {};
  const items: ParsedStatementItem[] = [];
  const dailySummaries: Record<string, DailyStatementSummary> = {};

  // Período: ex: 17 DE OUTUBRO DE 2026 a 19 DE OUTUBRO DE 2026
  const periodMatch = text.match(
    /(\d{1,2})\s+DE\s+([A-ZÇ]+)\s+DE\s+(\d{4})\s+a\s+(\d{1,2})\s+DE\s+([A-ZÇ]+)\s+DE\s+(\d{4})/i
  );
  if (periodMatch) {
    const d1 = periodMatch[1].padStart(2, "0");
    const m1 = parseMonth(periodMatch[2]);
    const y1 = periodMatch[3];
    periodStart = `${y1}-${m1}-${d1}`;

    const d2 = periodMatch[4].padStart(2, "0");
    const m2 = parseMonth(periodMatch[5]);
    const y2 = periodMatch[6];
    periodEnd = `${y2}-${m2}-${d2}`;
  }

  // Saldo final do período
  const finalMatch = text.match(/Saldo\s+final\s+do\s+per[íi]odo[\s\S]*?(?:R\$\s*)?([\d\.]+(?:,\d{2})?)/i);
  if (finalMatch) {
    finalBalance = parseAmount(finalMatch[1]);
  }

  // Saldo inicial
  const initMatch = text.match(/Saldo\s+inicial[\s\S]*?(?:R\$\s*)?([\d\.]+(?:,\d{2})?)/i);
  if (initMatch) {
    initialBalance = parseAmount(initMatch[1]);
  }

  // Divide pelas seções de datas em Movimentações
  const movIndex = text.indexOf("Movimentações");
  const movText = movIndex !== -1 ? text.slice(movIndex) : text;

  const dateRegex = /(\d{1,2})\s+([A-Z]{3})\s+(\d{4})/gi;
  let match;
  const datePositions: { dateStr: string; index: number }[] = [];
  while ((match = dateRegex.exec(movText)) !== null) {
    datePositions.push({
      dateStr: `${match[3]}-${parseMonth(match[2])}-${match[1].padStart(2, "0")}`,
      index: match.index,
    });
  }

  for (let i = 0; i < datePositions.length; i++) {
    const cur = datePositions[i];
    const next = datePositions[i + 1];
    const dayChunk = movText.slice(cur.index, next ? next.index : undefined);

    // Saldo do dia
    const dayBalMatch = dayChunk.match(/Saldo\s+do\s+dia[\s\S]*?(?:R\$\s*)?([\d\.]+(?:,\d{2})?)/i);
    if (dayBalMatch) {
      dailyBalances[cur.dateStr] = parseAmount(dayBalMatch[1]);
    }

    const entryIndex = dayChunk.indexOf("Total de entradas");
    const exitIndex = dayChunk.indexOf("Total de saídas");

    if (entryIndex !== -1) {
      const entryChunk =
        exitIndex !== -1 && exitIndex > entryIndex
          ? dayChunk.slice(entryIndex, exitIndex)
          : dayChunk.slice(entryIndex);
      extractPdfTransactions(entryChunk, cur.dateStr, "ENTRADA", items);
    }

    if (exitIndex !== -1) {
      const exitChunk = dayChunk.slice(exitIndex);
      extractPdfTransactions(exitChunk, cur.dateStr, "SAIDA", items);
    }
  }

  let totalEntries = 0;
  let totalExits = 0;

  items.forEach((it) => {
    if (it.type === "ENTRADA") totalEntries += it.amount;
    else totalExits += Math.abs(it.amount);

    if (!dailySummaries[it.date]) {
      dailySummaries[it.date] = {
        date: it.date,
        dayClosingBalance: dailyBalances[it.date] ?? null,
        entriesSum: 0,
        exitsSum: 0,
        itemCount: 0,
      };
    }
    if (it.type === "ENTRADA") {
      dailySummaries[it.date].entriesSum += it.amount;
    } else {
      dailySummaries[it.date].exitsSum += Math.abs(it.amount);
    }
    dailySummaries[it.date].itemCount += 1;
  });

  return {
    success: true,
    format: "PDF",
    periodStart,
    periodEnd,
    initialBalance,
    finalBalance,
    totalEntries: Math.round(totalEntries * 100) / 100,
    totalExits: Math.round(totalExits * 100) / 100,
    items,
    dailySummaries,
  };
}

function extractPdfTransactions(
  chunk: string,
  dateIso: string,
  type: "ENTRADA" | "SAIDA",
  items: ParsedStatementItem[]
) {
  const lines = chunk.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
  let currentDesc = "";

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (
      line.startsWith("Total de entradas") ||
      line.startsWith("Total de saídas") ||
      line.startsWith("Saldo do dia")
    ) {
      continue;
    }

    // Linha de valor exato: "290,00" ou "1.500,00"
    const amtMatch = line.match(/^([\d\.]+(?:,\d{2}))$/);
    if (amtMatch && currentDesc) {
      const rawVal = parseAmount(amtMatch[1]);
      const amount = type === "SAIDA" ? -Math.abs(rawVal) : Math.abs(rawVal);
      items.push({
        id: `pdf_${dateIso}_${items.length + 1}`,
        date: dateIso,
        amount,
        type,
        description: currentDesc,
        beneficiaryOrSender: extractPersonName(currentDesc),
      });
      currentDesc = "";
    } else {
      if (currentDesc) currentDesc += " " + line;
      else currentDesc = line;
    }
  }
}

/** Ponto de entrada universal: detecta e processa CSV, PDF text ou texto colado */
export function parseNubankStatement(rawText: string): ParsedStatementResult {
  const text = (rawText || "").trim();
  if (!text) {
    return {
      success: false,
      format: "UNKNOWN",
      error: "Nenhum conteúdo recebido para processamento.",
      totalEntries: 0,
      totalExits: 0,
      items: [],
      dailySummaries: {},
    };
  }

  // Verifica se é PDF texto oficial
  if (text.includes("VALORES EM R$") || text.includes("Saldo final do período") || text.includes("Nu Pagamentos S.A.")) {
    return parseNubankPdfText(text);
  }

  // Verifica se é CSV
  if (text.includes("Data") && (text.includes("Valor") || text.includes("Identificador"))) {
    return parseNubankCsv(text);
  }

  // Fallback: tenta CSV primeiro, depois PDF
  const csvRes = parseNubankCsv(text);
  if (csvRes.success && csvRes.items.length > 0) return csvRes;

  const pdfRes = parseNubankPdfText(text);
  if (pdfRes.success && pdfRes.items.length > 0) return pdfRes;

  return {
    success: false,
    format: "UNKNOWN",
    error: "Formato de extrato não reconhecido. Certifique-se de importar o CSV oficial do Nubank ou o PDF de extrato.",
    totalEntries: 0,
    totalExits: 0,
    items: [],
    dailySummaries: {},
  };
}
