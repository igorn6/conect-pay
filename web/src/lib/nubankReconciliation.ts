import { supabaseAdmin } from "@/lib/supabaseAdmin";
import {
  type ParsedStatementResult,
  type ParsedStatementItem,
} from "@/utils/nubankStatementParser";
import {
  isWeekendDay,
  getHolidayName,
  isCajuBusinessDay,
  getNextBusinessDay,
} from "@/constants/caju";

export interface ItemReconciliationResult {
  statementItem: ParsedStatementItem;
  status: "CONCILIADO" | "NAO_ENCONTRADO_NO_SISTEMA" | "VALOR_DIVERGENTE";
  matchedMovementId?: string;
  matchedMovementDesc?: string;
  matchedMovementDate?: string;
  matchedPaymentRequestId?: string;
  matchedPaymentRequestTitle?: string;
  notes?: string;
  effectiveDate?: string;
  isShiftedFromWeekend?: boolean;
  rawDate?: string;
}

export interface DayReconciliationResult {
  date: string; // YYYY-MM-DD
  statementClosingBalance: number | null;
  systemClosingBalance: number;
  difference: number;
  status: "CONCILIADO" | "DIVERGENTE";
  entriesTotal: number;
  exitsTotal: number;
  matchedCount: number;
  unmatchedCount: number;
  items: ItemReconciliationResult[];
  isBusinessDay?: boolean;
  isWeekend?: boolean;
  isHoliday?: boolean;
  holidayName?: string;
}

export interface FullReconciliationReport {
  periodStart: string | null;
  periodEnd: string | null;
  systemBalance: number;
  statementBalance: number;
  balanceDivergence: number;
  isBalanceDivergent: boolean;
  totalEntries: number;
  totalExits: number;
  totalItems: number;
  matchedItemsCount: number;
  unmatchedItemsCount: number;
  unmatchedSystemMovements: any[];
  itemsResults: ItemReconciliationResult[];
  dailyResults: DayReconciliationResult[];
}

const round2 = (n: number) => Math.round(n * 100) / 100;

export const KNOWN_CORPORATE_ALIASES: Array<{ keywords: string[]; aliases: string[] }> = [
  {
    keywords: ["caju", "recarga caju", "beneficio", "beneficios"],
    aliases: [
      "empresa brasileira de beneficios",
      "empresa brasileira de ben",
      "caju beneficios",
      "caju tecnologia",
      "caju",
      "pix.bpp.com.br",
    ],
  },
  {
    keywords: ["lima e trindade", "recarga nubank", "recarga saldo", "lima t c g f m e"],
    aliases: [
      "lima e trindade",
      "lima t c g f m e ltda",
      "45.983.838/0001-80",
      "lima trindade",
      "conectsol",
    ],
  },
  {
    keywords: ["google ads", "google", "anuncio"],
    aliases: ["google brasil internet", "google", "ebanx"],
  },
  {
    keywords: ["claro", "recarga celular", "chip"],
    aliases: ["multidisplay comercio", "multidisplay", "claro"],
  },
  {
    keywords: ["crea", "conselho regional de engenharia", "art", "arts", "engenharia e agronomia"],
    aliases: [
      "cons regional de engenharia",
      "conselho regional de engenharia e agronomia",
      "crea",
      "art",
      "arts",
    ],
  },
  {
    keywords: ["mercado pago", "mercado livre"],
    aliases: ["mercado pago", "mercado livre", "mercadopago"],
  },
];

function normalize(str: string | null | undefined): string {
  if (!str) return "";
  return str
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function getSignificantTokens(str: string): string[] {
  const stopWords = new Set([
    "de", "da", "do", "das", "dos", "e", "em", "para", "por", "com",
    "ltda", "sa", "me", "epp", "ip", "s", "a", "transferencia", "enviada",
    "recebida", "pelo", "pix", "pagamento", "boleto", "efetuado", "banco",
    "agencia", "conta", "valor", "comprovante"
  ]);
  return normalize(str)
    .split(" ")
    .filter((w) => w.length >= 3 && !stopWords.has(w));
}

function checkEntityMatch(textA: string, textB: string): boolean {
  const normA = normalize(textA);
  const normB = normalize(textB);

  if (!normA || !normB) return false;
  if (normA.includes(normB) || normB.includes(normA)) return true;

  // Verifica grupos de aliases corporativos conhecidos (ex: Caju <-> Empresa Brasileira de Benefícios)
  for (const group of KNOWN_CORPORATE_ALIASES) {
    const aMatches = group.keywords.some((k) => normA.includes(k)) || group.aliases.some((al) => normA.includes(al));
    const bMatches = group.keywords.some((k) => normB.includes(k)) || group.aliases.some((al) => normB.includes(al));
    if (aMatches && bMatches) return true;
  }

  // Verifica sobreposição de tokens significativos (ex: "Marta Carvalho" com "Marta Carvalho de Sousa")
  const tokensA = getSignificantTokens(textA);
  const tokensB = getSignificantTokens(textB);
  if (tokensA.length === 0 || tokensB.length === 0) return false;

  const matches = tokensA.filter((t) => tokensB.includes(t));
  if (matches.length >= 2) return true;
  if (matches.length >= 1 && matches.some((t) => t.length >= 6)) return true;

  return false;
}

/** Realiza a auditoria e cruzamento completo do extrato com o cofre e Kanban */
export async function reconcileStatement(
  parsed: ParsedStatementResult,
  manualStatementBalance?: number | null
): Promise<FullReconciliationReport> {
  // 1. Busca saldo atual do cofre Nubank
  const { data: balData } = await supabaseAdmin
    .from("nubank_balance")
    .select("balance")
    .eq("id", "nubank")
    .single();

  const systemBalance = round2(Number(balData?.balance ?? 609.74));

  // 2. Determina o período ampliado para busca no banco (-25 dias / +10 dias)
  // para garantir que solicitações criadas antes do pagamento ou liquidadas com atraso sejam localizadas
  const sortedDates = parsed.items.map((it) => it.date).sort();
  const minDate = sortedDates[0] || new Date().toISOString().slice(0, 10);
  const maxDate = sortedDates[sortedDates.length - 1] || new Date().toISOString().slice(0, 10);

  const startBuffer = new Date(minDate);
  startBuffer.setDate(startBuffer.getDate() - 45);
  const startIso = startBuffer.toISOString();

  const endBuffer = new Date(maxDate);
  endBuffer.setDate(endBuffer.getDate() + 15);
  endBuffer.setHours(23, 59, 59, 999);
  const endIso = endBuffer.toISOString();

  // 3. Busca movimentações do cofre e solicitações liquidadas/em processamento
  const [{ data: movements }, { data: cards }] = await Promise.all([
    supabaseAdmin
      .from("nubank_movements")
      .select("id, type, amount, balance_after, description, payment_request_id, created_at")
      .gte("created_at", startIso)
      .lte("created_at", endIso)
      .order("created_at", { ascending: false }),
    supabaseAdmin
      .from("payment_requests")
      .select("id, title, amount, pix_owner, pix_name, notes, category, splits, request_kind, cnpj, status, created_at, updated_at, due_date")
      .or("is_deleted.eq.false,is_deleted.is.null")
      .or(`created_at.gte.${startIso},updated_at.gte.${startIso}`),
  ]);

  const poolMovements = (movements || []).map((m: any) => ({
    ...m,
    amount: Number(m.amount),
    balance_after: Number(m.balance_after),
    used: false,
  }));

  const poolCards = (cards || []).map((c: any) => {
    const rawSplits = Array.isArray(c.splits) ? c.splits : [];
    const amountNum = Number(c.amount || 0);
    return {
      ...c,
      amount: amountNum,
      remainingAmount: amountNum,
      used: false,
      availableSplits: rawSplits.map((s: any, idx: number) => ({
        ...s,
        _splitIndex: idx,
        amount: Number(s.amount || 0),
        used: false,
      })),
    };
  });

  const itemsResults: ItemReconciliationResult[] = [];
  let matchedItemsCount = 0;
  let unmatchedItemsCount = 0;

  // 4. Cruzamento item a item do extrato
  for (const item of parsed.items) {
    const itemAmtAbs = Math.abs(item.amount);
    const rawDate = item.date;
    const effectiveDate = getNextBusinessDay(rawDate);
    item.rawDate = rawDate;
    item.effectiveDate = effectiveDate;
    item.isWeekendOrHoliday = rawDate !== effectiveDate;
    if (rawDate !== effectiveDate) {
      item.shiftedToBusinessDay = effectiveDate;
    }

    const itemBeneficiary = item.beneficiaryOrSender || "";
    const itemFullDesc = `${item.description} ${itemBeneficiary}`;

    // FASE 1: Procura match direto em nubank_movements (registro financeiro do cofre)
    let matchedMov = poolMovements.find((m: any) => {
      if (m.used) return false;
      const movAmtAbs = Math.abs(m.amount);
      if (Math.abs(movAmtAbs - itemAmtAbs) >= 0.01) return false;

      // Respeita sinal se aplicável
      if (item.amount > 0 && m.type === "SAIDA") return false;
      if (item.amount < 0 && m.type === "ENTRADA") return false;

      const mDate = (m.created_at || "").slice(0, 10);
      const mEffDate = getNextBusinessDay(mDate);
      const daysDiff = Math.abs(new Date(mEffDate).getTime() - new Date(effectiveDate).getTime()) / 86400000;
      if (daysDiff > 5) return false;

      // Se houver coincidência de entidade ou data útil exata
      if (daysDiff <= 1) return true;
      return checkEntityMatch(itemFullDesc, m.description || "");
    });

    // Se ainda não encontrou e há movimento com valor igual e data próxima
    if (!matchedMov) {
      matchedMov = poolMovements.find((m: any) => {
        if (m.used) return false;
        const movAmtAbs = Math.abs(m.amount);
        if (Math.abs(movAmtAbs - itemAmtAbs) >= 0.01) return false;
        if (item.amount > 0 && m.type === "SAIDA") return false;
        if (item.amount < 0 && m.type === "ENTRADA") return false;

        const mDate = (m.created_at || "").slice(0, 10);
        const mEffDate = getNextBusinessDay(mDate);
        const daysDiff = Math.abs(new Date(mEffDate).getTime() - new Date(effectiveDate).getTime()) / 86400000;
        return daysDiff <= 4;
      });
    }

    if (matchedMov) {
      matchedMov.used = true;
      matchedItemsCount++;
      itemsResults.push({
        statementItem: item,
        status: "CONCILIADO",
        matchedMovementId: matchedMov.id,
        matchedMovementDesc: matchedMov.description,
        matchedMovementDate: matchedMov.created_at,
        effectiveDate,
        rawDate,
        isShiftedFromWeekend: rawDate !== effectiveDate,
      });
      continue;
    }

    // FASE 2: Procura correspondência inteligente em payment_requests (Kanban)
    let matchedCard: any = null;
    let matchedSplit: any = null;
    let matchNotes = "";

    for (const card of poolCards) {
      if (card.used) continue;

      const cardAmt = Number(card.amount);
      const isTotalMatch = Math.abs(cardAmt - itemAmtAbs) < 0.01;

      // Procura primeiro split individual compatível e não utilizado
      const unusedSplits = card.availableSplits.filter((s: any) => !s.used);
      const matchingSplit = unusedSplits.find(
        (s: any) => Math.abs(Number(s.amount) - itemAmtAbs) < 0.01
      );

      // Permite absorção fracionada/residual quando o card for de montante agregado (ex: R$ 758,73 cobrindo múltiplos boletos de R$ 108,39)
      const canAbsorbFraction = !matchingSplit && (card.remainingAmount >= itemAmtAbs - 0.01);

      if (!isTotalMatch && !matchingSplit && !canAbsorbFraction) continue;

      // Constrói texto abrangente do cartão (título, titular, notas, categoria, splits)
      const cardText = [
        card.title,
        card.pix_owner,
        card.pix_name,
        card.notes,
        card.category,
        card.request_kind,
        matchingSplit?.pix_owner,
        matchingSplit?.pix_key,
        matchingSplit?.boleto_notes,
        matchingSplit?.caju_phone,
      ]
        .filter(Boolean)
        .join(" ");

      const entityMatched = checkEntityMatch(itemFullDesc, cardText);

      // Datas relevantes para aferir proximidade temporal
      const allDates = [
        card.created_at,
        card.updated_at,
        card.due_date,
        matchingSplit?.boleto_due_date,
      ]
        .filter(Boolean)
        .map((d: string) => getNextBusinessDay(String(d).slice(0, 10)));

      const daysDiffs = allDates.map((d: string) => {
        const time = new Date(d).getTime();
        return isNaN(time) ? 999 : Math.abs(time - new Date(effectiveDate).getTime()) / 86400000;
      });
      const minDaysDiff = daysDiffs.length > 0 ? Math.min(...daysDiffs) : 999;

      // Critério de aceite:
      // 1. Entidade combinada (titular/CREA/aliases/ART) com data em até 35 dias
      // 2. Ou valor idêntico total com data muito próxima (<= 3 dias)
      if (entityMatched && minDaysDiff <= 35) {
        matchedCard = card;
        matchedSplit = matchingSplit || null;
        const ownerDisplay = matchingSplit?.pix_owner || card.pix_owner || card.pix_name || "Favorecido";
        matchNotes = `Conciliado com card: "${card.title}" (${ownerDisplay}).`;
        break;
      }

      if (isTotalMatch && minDaysDiff <= 3 && !matchedCard) {
        matchedCard = card;
        matchedSplit = null;
        matchNotes = `Vinculado por valor idêntico e data próxima: "${card.title}".`;
      }
    }

    if (matchedCard) {
      matchedCard.remainingAmount = round2(matchedCard.remainingAmount - itemAmtAbs);
      if (matchedSplit) {
        matchedSplit.used = true;
        const remainingUnused = matchedCard.availableSplits.filter((s: any) => !s.used);
        if (remainingUnused.length === 0 || matchedCard.remainingAmount < 0.01) {
          matchedCard.used = true;
        }
      } else {
        if (matchedCard.remainingAmount < 0.01) {
          matchedCard.used = true;
          matchedCard.availableSplits.forEach((s: any) => { s.used = true; });
        }
      }

      matchedItemsCount++;
      itemsResults.push({
        statementItem: item,
        status: "CONCILIADO",
        matchedPaymentRequestId: matchedCard.id,
        matchedPaymentRequestTitle: matchedCard.title,
        notes: matchNotes,
        effectiveDate,
        rawDate,
        isShiftedFromWeekend: rawDate !== effectiveDate,
      });
    } else {
      unmatchedItemsCount++;
      itemsResults.push({
        statementItem: item,
        status: "NAO_ENCONTRADO_NO_SISTEMA",
        notes: "Lançamento bancário presente no extrato, mas não localizado no Conect Pay.",
        effectiveDate,
        rawDate,
        isShiftedFromWeekend: rawDate !== effectiveDate,
      });
    }
  }

  // Movimentações do sistema que não deram match com o extrato
  const unmatchedSystemMovements = poolMovements
    .filter((m: any) => !m.used)
    .map((m: any) => ({
      id: m.id,
      amount: m.amount,
      description: m.description,
      date: m.created_at,
    }));

  // 5. Agrupamento por dia e determinação do Saldo do Extrato
  // Coleta todas as datas do extrato e garante que os próximos dias úteis estejam incluídos
  const allDatesSet = new Set<string>();
  parsed.items.forEach((it) => {
    allDatesSet.add(it.date);
    allDatesSet.add(getNextBusinessDay(it.date));
  });

  const allSortedDates = Array.from(allDatesSet).sort();
  const rangeMin = allSortedDates[0] || minDate || "";
  const rangeMax = allSortedDates[allSortedDates.length - 1] || maxDate || "";

  // Preenche todos os dias corridos entre rangeMin e rangeMax para garantir que sábados e domingos apareçam sem buracos
  const continuousDates: string[] = [];
  if (rangeMin && rangeMax) {
    let cur = new Date(`${rangeMin}T12:00:00Z`);
    const end = new Date(`${rangeMax}T12:00:00Z`);
    while (cur <= end) {
      continuousDates.push(cur.toISOString().slice(0, 10));
      cur = new Date(cur.getTime() + 86400000);
    }
  } else {
    continuousDates.push(...allSortedDates);
  }

  const statementBalance = round2(
    manualStatementBalance ??
      parsed.finalBalance ??
      (rangeMax && parsed.dailySummaries[rangeMax]?.dayClosingBalance
        ? Number(parsed.dailySummaries[rangeMax].dayClosingBalance)
        : systemBalance)
  );

  const balanceDivergence = round2(statementBalance - systemBalance);
  const isBalanceDivergent = Math.abs(balanceDivergence) >= 0.01;

  // 6. Fechamentos Diários com regra contábil de dias úteis (Fim de semana e feriados sem movimentação)
  const dailyResults: DayReconciliationResult[] = [];
  let lastKnownStmtBalance: number | null = null;
  let lastKnownSysBalance = systemBalance;

  for (const d of continuousDates) {
    const isWk = isWeekendDay(d);
    const holiday = getHolidayName(d);
    const isBiz = !isWk && !holiday;

    if (!isBiz) {
      // Fim de Semana ou Feriado: sem movimentação contábil, repete o saldo do dia anterior
      dailyResults.push({
        date: d,
        statementClosingBalance: lastKnownStmtBalance,
        systemClosingBalance: lastKnownSysBalance,
        difference: 0,
        status: "CONCILIADO",
        entriesTotal: 0,
        exitsTotal: 0,
        matchedCount: 0,
        unmatchedCount: 0,
        items: [],
        isBusinessDay: false,
        isWeekend: isWk,
        isHoliday: Boolean(holiday),
        holidayName: holiday || undefined,
      });
      continue;
    }

    // Dia Útil: recebe todos os lançamentos cujo dia de liquidação financeira efetiva seja este dia
    const dayItems = itemsResults.filter(
      (r) => (r.effectiveDate || getNextBusinessDay(r.statementItem.date)) === d
    );
    const dayMatched = dayItems.filter((r) => r.status === "CONCILIADO").length;
    const dayUnmatched = dayItems.filter((r) => r.status !== "CONCILIADO").length;

    let entries = 0;
    let exits = 0;
    dayItems.forEach((r) => {
      if (r.statementItem.amount > 0) entries += r.statementItem.amount;
      else exits += Math.abs(r.statementItem.amount);
    });

    // Saldo do extrato no dia
    const dayStmtBalance: number | null =
      parsed.dailySummaries[d]?.dayClosingBalance !== undefined
        ? parsed.dailySummaries[d].dayClosingBalance
        : d === rangeMax
        ? statementBalance
        : lastKnownStmtBalance;

    if (dayStmtBalance !== null) lastKnownStmtBalance = dayStmtBalance;

    // Saldo do sistema no dia: busca o balance_after do último movimento do sistema daquele dia útil
    const dayMovs = (movements || []).filter(
      (m: any) => getNextBusinessDay((m.created_at || "").slice(0, 10)) === d
    );
    const systemDayBalance =
      dayMovs.length > 0
        ? round2(Number(dayMovs[0].balance_after))
        : lastKnownSysBalance;

    lastKnownSysBalance = systemDayBalance;

    const diff =
      dayStmtBalance !== null
        ? round2(dayStmtBalance - systemDayBalance)
        : 0;

    dailyResults.push({
      date: d,
      statementClosingBalance: dayStmtBalance,
      systemClosingBalance: systemDayBalance,
      difference: diff,
      status: Math.abs(diff) < 0.01 && dayUnmatched === 0 ? "CONCILIADO" : "DIVERGENTE",
      entriesTotal: round2(entries),
      exitsTotal: round2(exits),
      matchedCount: dayMatched,
      unmatchedCount: dayUnmatched,
      items: dayItems,
      isBusinessDay: true,
      isWeekend: false,
      isHoliday: false,
    });
  }

  return {
    periodStart: parsed.periodStart ?? minDate,
    periodEnd: parsed.periodEnd ?? maxDate,
    systemBalance,
    statementBalance,
    balanceDivergence,
    isBalanceDivergent,
    totalEntries: parsed.totalEntries,
    totalExits: parsed.totalExits,
    totalItems: parsed.items.length,
    matchedItemsCount,
    unmatchedItemsCount,
    unmatchedSystemMovements,
    itemsResults,
    dailyResults,
  };
}

/** Salva o fechamento diário oficial na tabela nubank_daily_reconciliation */
export async function saveDailyReconciliations(args: {
  dailyResults: DayReconciliationResult[];
  userId: string | null;
  sourceFileName?: string;
}): Promise<{ savedCount: number }> {
  let count = 0;

  for (const day of args.dailyResults) {
    const payload = {
      reconciliation_date: day.date,
      system_balance: day.systemClosingBalance,
      statement_balance: day.statementClosingBalance ?? day.systemClosingBalance,
      difference: day.difference,
      status: day.status,
      total_entries: day.entriesTotal,
      total_exits: day.exitsTotal,
      matched_count: day.matchedCount,
      unmatched_count: day.unmatchedCount,
      source_file_name: args.sourceFileName || "Extrato Nubank",
      created_by: args.userId,
    };

    const { data: recRow, error: recError } = await supabaseAdmin
      .from("nubank_daily_reconciliation")
      .upsert(payload, { onConflict: "reconciliation_date" })
      .select("id")
      .single();

    if (recError) {
      console.error("[saveDailyReconciliations] Erro ao salvar dia:", day.date, recError);
      continue;
    }

    count++;

    // Salva itens daquele dia
    if (recRow?.id && day.items.length > 0) {
      const itemsPayload = day.items.map((it) => ({
        reconciliation_id: recRow.id,
        item_date: it.statementItem.date,
        amount: it.statementItem.amount,
        description: it.statementItem.description,
        identifier: it.statementItem.identifier || null,
        matched: it.status === "CONCILIADO",
        matched_movement_id: it.matchedMovementId || null,
      }));

      // Limpa itens antigos desta reconciliação antes de reinserir
      await supabaseAdmin.from("nubank_statement_items").delete().eq("reconciliation_id", recRow.id);
      await supabaseAdmin.from("nubank_statement_items").insert(itemsPayload);
    }
  }

  return { savedCount: count };
}
