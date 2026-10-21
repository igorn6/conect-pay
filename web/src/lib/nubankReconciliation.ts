import { supabaseAdmin } from "@/lib/supabaseAdmin";
import {
  type ParsedStatementResult,
  type ParsedStatementItem,
} from "@/utils/nubankStatementParser";

export interface ItemReconciliationResult {
  statementItem: ParsedStatementItem;
  status: "CONCILIADO" | "NAO_ENCONTRADO_NO_SISTEMA" | "VALOR_DIVERGENTE";
  matchedMovementId?: string;
  matchedMovementDesc?: string;
  matchedMovementDate?: string;
  matchedPaymentRequestId?: string;
  matchedPaymentRequestTitle?: string;
  notes?: string;
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

  // 2. Determina o período ampliado para busca no banco (+/- 3 dias)
  const sortedDates = parsed.items.map((it) => it.date).sort();
  const minDate = sortedDates[0] || new Date().toISOString().slice(0, 10);
  const maxDate = sortedDates[sortedDates.length - 1] || new Date().toISOString().slice(0, 10);

  const startBuffer = new Date(minDate);
  startBuffer.setDate(startBuffer.getDate() - 3);
  const startIso = startBuffer.toISOString();

  const endBuffer = new Date(maxDate);
  endBuffer.setDate(endBuffer.getDate() + 3);
  endBuffer.setHours(23, 59, 59, 999);
  const endIso = endBuffer.toISOString();

  // 3. Busca movimentações do cofre e solicitações liquidadas
  const [{ data: movements }, { data: cards }] = await Promise.all([
    supabaseAdmin
      .from("nubank_movements")
      .select("id, type, amount, balance_after, description, payment_request_id, created_at")
      .gte("created_at", startIso)
      .lte("created_at", endIso)
      .order("created_at", { ascending: false }),
    supabaseAdmin
      .from("payment_requests")
      .select("id, title, amount, pix_owner, pix_name, created_at, status")
      .gte("created_at", startIso)
      .lte("created_at", endIso),
  ]);

  const poolMovements = (movements || []).map((m: any) => ({
    ...m,
    amount: Number(m.amount),
    balance_after: Number(m.balance_after),
    used: false,
  }));

  const itemsResults: ItemReconciliationResult[] = [];
  let matchedItemsCount = 0;
  let unmatchedItemsCount = 0;

  // 4. Cruzamento item a item do extrato
  for (const item of parsed.items) {
    const itemAmtAbs = Math.abs(item.amount);
    const itemDate = item.date;

    // Procura match em nubank_movements
    // Critério 1: Mesmo valor exato (delta < 0.01) e sinal correspondente
    let matchedMov = poolMovements.find((m: any) => {
      if (m.used) return false;
      const movAmtAbs = Math.abs(m.amount);
      const isSameAmount = Math.abs(movAmtAbs - itemAmtAbs) < 0.01;
      const mDate = (m.created_at || "").slice(0, 10);

      if (!isSameAmount) return false;

      // Se a data for exatamente igual ou no mesmo range
      return Math.abs(new Date(mDate).getTime() - new Date(itemDate).getTime()) <= 3 * 86400000;
    });

    // Se houver mais de um com mesmo valor, tenta desambiguar por nome
    if (!matchedMov && item.beneficiaryOrSender) {
      const benLower = item.beneficiaryOrSender.toLowerCase();
      matchedMov = poolMovements.find((m: any) => {
        if (m.used) return false;
        const movAmtAbs = Math.abs(m.amount);
        if (Math.abs(movAmtAbs - itemAmtAbs) >= 0.01) return false;
        const descLower = (m.description || "").toLowerCase();
        return descLower.includes(benLower) || benLower.includes(descLower);
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
      });
    } else {
      // Procura se tem cartão correspondente em payment_requests
      const matchedCard = (cards || []).find((c: any) => {
        const cAmt = Number(c.amount);
        if (Math.abs(cAmt - itemAmtAbs) >= 0.01) return false;
        const ownerLower = (c.pix_owner || c.pix_name || c.title || "").toLowerCase();
        const benLower = (item.beneficiaryOrSender || item.description).toLowerCase();
        return ownerLower && (benLower.includes(ownerLower) || ownerLower.includes(benLower));
      });

      if (matchedCard) {
        matchedItemsCount++;
        itemsResults.push({
          statementItem: item,
          status: "CONCILIADO",
          matchedPaymentRequestId: matchedCard.id,
          matchedPaymentRequestTitle: matchedCard.title,
          notes: "Vinculado pelo cartão de pagamento correspondente.",
        });
      } else {
        unmatchedItemsCount++;
        itemsResults.push({
          statementItem: item,
          status: "NAO_ENCONTRADO_NO_SISTEMA",
          notes: "Lançamento bancário presente no extrato, mas não localizado no Conect Pay.",
        });
      }
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
  const uniqueDates = Array.from(new Set(parsed.items.map((it) => it.date))).sort();

  const statementBalance = round2(
    manualStatementBalance ??
      parsed.finalBalance ??
      (maxDate && parsed.dailySummaries[maxDate]?.dayClosingBalance
        ? Number(parsed.dailySummaries[maxDate].dayClosingBalance)
        : systemBalance)
  );

  const balanceDivergence = round2(statementBalance - systemBalance);
  const isBalanceDivergent = Math.abs(balanceDivergence) >= 0.01;

  // 6. Fechamentos Diários
  const dailyResults: DayReconciliationResult[] = [];

  for (const d of uniqueDates) {
    const dayItems = itemsResults.filter((r) => r.statementItem.date === d);
    const dayMatched = dayItems.filter((r) => r.status === "CONCILIADO").length;
    const dayUnmatched = dayItems.filter((r) => r.status !== "CONCILIADO").length;

    let entries = 0;
    let exits = 0;
    dayItems.forEach((r) => {
      if (r.statementItem.amount > 0) entries += r.statementItem.amount;
      else exits += Math.abs(r.statementItem.amount);
    });

    // Saldo do extrato no dia: do resumo do PDF ou fallback para statementBalance no último dia
    const dayStmtBalance =
      parsed.dailySummaries[d]?.dayClosingBalance ??
      (d === maxDate ? statementBalance : null);

    // Saldo do sistema no dia: busca o balance_after do último movimento do sistema daquele dia
    const dayMovs = (movements || []).filter(
      (m: any) => (m.created_at || "").slice(0, 10) === d
    );
    const systemDayBalance =
      dayMovs.length > 0
        ? round2(Number(dayMovs[0].balance_after))
        : systemBalance;

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
