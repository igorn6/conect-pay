/**
 * Camada de serviço do Hub Caju (servidor).
 * Orquestra leitura do snapshot patrimonial, colaboradores, extrato oficial,
 * fechamentos diários reconstruídos a partir do marco zero, importação CSV
 * idempotente + conciliação automática com o Kanban e gatilho de recarga.
 */
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import {
  CAJU_CUTOFF_ISO,
  CAJU_OFFICIAL_RECHARGES,
  isCajuRechargeCard,
  round2,
  isWeekendDay,
  getHolidayName,
  isCajuBusinessDay,
  getNextBusinessDay,
  getEffectiveFinancialDate,
  type CajuCollaborator,
  type CajuDailyClosing,
  type CajuImportSummary,
  type CajuMovement,
  type CajuSnapshot,
  type CajuTransaction,
} from "@/constants/caju";
import { parseCajuCsv } from "./cajuCsvParser";
import { reconcileCajuDeposits, type DepositInput, type KanbanCardInput } from "./cajuReconciliation";

const SEED_COLLABORATORS: ReadonlyArray< readonly [string, string, number] > = [
  ["Mailson Silva De Souza", "09268494507", 1311.26],
  ["Leandro Vicente Dos Santos", "09895332556", 1012.00],
  ["Jhennyfer Beatriz De Jesus Leite Souza", "08993509506", 741.49],
  ["Welton Gonçalves Santos", "85891846500", 704.15],
  ["Evelin Sophia Barros Porto", "08034244503", 468.63],
  ["Xaudson Conceição Santos", "05565645530", 388.02],
  ["Judson Rocha Arimatea", "05708681730", 299.64],
  ["Danilo Ferreira Vieira", "85939699502", 263.07],
  ["Kayky Santos Silva", "86379794590", 229.01],
  ["Gerson Breno Ribeiro De Queiroz", "08650610501", 204.58],
  ["Laysa", "10990597555", 201.18],
  ["Ariosvaldo Pereira Nunes", "08629826509", 158.22],
  ["Wanderson Ferreira Vieira", "07366380598", 132.42],
  ["Ruan Gabriel Meira Santos", "08027939593", 104.02],
  ["Vitoria De Lima Silva", "09220099535", 66.98],
  ["Lara Ellen Xavier De Santana Brito", "08419381560", 63.81],
  ["Antonio Rai Souza Ribeiro", "08380892593", 60.04],
  ["Jeane Mirante Santana Amorim", "07863307597", 52.79],
  ["Joao Gabriel Marques Pessoa De Souza", "45853409808", 44.40],
  ["Natali Lima De Oliveira Bispo", "07927289551", 30.90],
  ["Carlos Roberto Lima Aguiar", "08645923530", 10.00],
  ["Ruan Carlos Pinheiro Cardoso", "07717476592", 3.96],
  ["Renato Ribeiro Silva", "08027378540", 2.35],
  ["Wallas Novais Leite", "08316936577", 2.06],
  ["Rafael De Jesus Alves", "07697308509", 0.27],
  ["Wellington De Barros Dias Júnior", "06856549580", 0.06],
  ["Agildo Lima Santa", "00018870503", 0.00],
  ["Carlos Vinicius Santos Silva", "11187822590", 0.00],
  ["Celson Alves Ribeiro", "16171881821", 0.00],
  ["Danilo Silva Neves", "07873193500", 0.00],
  ["Gabriel Sandes Brito", "08535010505", 0.00],
  ["Igor Nascimento De Araújo", "44888427801", 0.00],
  ["Jean Chaves Ribeiro", "07876622593", 0.00],
  ["Jeffson Pessoa Bitencout", "86570240552", 0.00],
  ["Jeová Silva Rocha", "06607245536", 0.00],
  ["Jose Marcos Santana Dos Santos", "08478458506", 0.00],
  ["Juscelio Ribeiro Goncalves", "08649190502", 0.00],
  ["Lucas Vieira Silva", "09204027550", 0.00],
  ["Mailson Leite Da Chaga", "08566514513", 0.00],
  ["Nicolli Dias De Novais", "86563901557", 0.00],
  ["Pedro Henrique Ribeiro De Jesus", "12364724546", 0.00],
  ["Rodrigo Soares Ferreira", "00337202583", 0.00],
  ["Ruan Vitor Neves Aguiar", "49703669859", 0.00],
  ["Talisson Riam Gomes Silva", "09128497546", 0.00],
];

let cajuInitializedCache = false;

/** Garante que a carteira Caju e os 44 colaboradores iniciais existam no banco. */
export async function ensureCajuInitialized(): Promise<void> {
  if (cajuInitializedCache) return;

  await supabaseAdmin
    .from("caju_wallet")
    .upsert({ id: "caju", free_balance: 5845.8, cutoff_at: CAJU_CUTOFF_ISO }, { onConflict: "id", ignoreDuplicates: true });

  const { count } = await supabaseAdmin
    .from("caju_collaborators")
    .select("id", { count: "exact", head: true });

  if ((count ?? 0) < 44) {
    const payload = SEED_COLLABORATORS.map(([name, cpf, balance]) => ({
      name,
      cpf,
      balance,
      is_seed: true,
    }));
    await supabaseAdmin.from("caju_collaborators").upsert(payload, { onConflict: "cpf", ignoreDuplicates: true });
  }

  cajuInitializedCache = true;
}

/** Data YYYY-MM-DD no fuso de Brasília (-03:00). */
function brDate(iso: string): string {
  const ms = new Date(iso).getTime() - 3 * 3600_000;
  return new Date(ms).toISOString().slice(0, 10);
}

/**
 * Reconstrói a tabela de Fechamentos Diários caminhando a partir do saldo atual
 * (que já reflete exatamente o marco zero + eventos posteriores).
 */
export function buildDailyClosings(args: {
  currentFree: number;
  currentCards: number;
  cutoffIso: string;
  transactions: CajuTransaction[];
  movements: CajuMovement[];
}): CajuDailyClosing[] {
  const { currentFree, currentCards, cutoffIso, transactions, movements } = args;
  const cutoffDate = brDate(cutoffIso);

  const byDay = new Map<
    string,
    {
      deposits: number;
      rescues: number;
      purchases: number;
      recharges: number;
      txCount: number;
      depositsCount: number;
      reconciledDeposits: number;
      netFree: number;
      netCards: number;
    }
  >();

  const slot = (d: string) => {
    let s = byDay.get(d);
    if (!s) {
      s = {
        deposits: 0,
        rescues: 0,
        purchases: 0,
        recharges: 0,
        txCount: 0,
        depositsCount: 0,
        reconciledDeposits: 0,
        netFree: 0,
        netCards: 0,
      };
      byDay.set(d, s);
    }
    return s;
  };

  // Garante todos os dias corridos continuamente desde 2026-09-01 até a data mais recente (>= cutoffDate)
  let minDayStr = "2026-09-01";
  let maxDayStr = cutoffDate;

  // 1. Processa todas as transações (incluindo as Recargas integradas)
  // Regra padrão Conect Pay: fins de semana e feriados não possuem movimentações contábeis.
  // Toda movimentação ocorrida em sábado/domingo/feriado é transferida para o próximo dia útil.
  for (const tx of transactions) {
    const rawDate = brDate(tx.occurred_at);
    const effDate = getNextBusinessDay(rawDate);
    if (effDate < minDayStr) minDayStr = effDate;
    if (effDate > maxDayStr) maxDayStr = effDate;
    const s = slot(effDate);
    const amt = round2(tx.amount);
    s.txCount++;
    if (tx.tx_type === "DEPOSITO") {
      s.deposits = round2(s.deposits + amt);
      s.depositsCount++;
      if (tx.reconciliation_status === "CONCILIADO") s.reconciledDeposits++;
      s.netFree = round2(s.netFree - amt);
      s.netCards = round2(s.netCards + amt);
    } else if (tx.tx_type === "RESGATE") {
      s.rescues = round2(s.rescues + amt);
      s.netFree = round2(s.netFree + amt);
      s.netCards = round2(s.netCards - amt);
    } else if (tx.tx_type === "COMPRA") {
      s.purchases = round2(s.purchases + amt);
      s.netCards = round2(s.netCards - amt);
    } else if (tx.tx_type === "RECARGA") {
      s.recharges = round2(s.recharges + amt);
      s.netFree = round2(s.netFree + amt);
    }
  }

  // Preenche todos os dias do calendário entre minDayStr e maxDayStr sem buracos
  let cursor = new Date(`${minDayStr}T12:00:00Z`);
  const endCursor = new Date(`${maxDayStr}T12:00:00Z`);
  while (cursor <= endCursor) {
    slot(cursor.toISOString().slice(0, 10));
    cursor = new Date(cursor.getTime() + 86_400_000);
  }

  // Âncora contábil oficial (Dia 27/10/2026):
  // Saldo Posse (Livre) = R$ 5.545,80 | Saldo Colaborador = R$ 5.802,95 | Saldo Total = R$ 11.348,75
  const ANCHOR_DATE = "2026-10-27";
  const ANCHOR_FREE = 5545.8;
  const ANCHOR_CARDS = 5802.95;
  const ANCHOR_TOTAL = 11348.75;

  const resultsMap = new Map<
    string,
    {
      freeStart: number;
      cardsStart: number;
      totalStart: number;
      freeEnd: number;
      cardsEnd: number;
      totalEnd: number;
    }
  >();

  // Fechamento da data âncora (27/10/2026)
  const s27 = slot(ANCHOR_DATE);
  const startFree27 = round2(ANCHOR_FREE - s27.netFree);
  const startCards27 = round2(ANCHOR_CARDS - s27.netCards);

  resultsMap.set(ANCHOR_DATE, {
    freeStart: startFree27,
    cardsStart: startCards27,
    totalStart: round2(startFree27 + startCards27),
    freeEnd: ANCHOR_FREE,
    cardsEnd: ANCHOR_CARDS,
    totalEnd: ANCHOR_TOTAL,
  });

  // Dias futuros (ex: 28/10/2026): caminhada progressiva a partir do final de 27/10
  const allDayKeys = Array.from(byDay.keys());
  const futureDays = allDayKeys.filter((d) => d > ANCHOR_DATE).sort();
  let currFree = ANCHOR_FREE;
  let currCards = ANCHOR_CARDS;
  for (const d of futureDays) {
    const s = byDay.get(d)!;
    const startF = currFree;
    const startC = currCards;
    const endF = round2(startF + s.netFree);
    const endC = round2(startC + s.netCards);
    resultsMap.set(d, {
      freeStart: startF,
      cardsStart: startC,
      totalStart: round2(startF + startC),
      freeEnd: endF,
      cardsEnd: endC,
      totalEnd: round2(endF + endC),
    });
    currFree = endF;
    currCards = endC;
  }

  // Dias passados (ex: 26/10, 25/10, ...): caminhada regressiva a partir do início de 27/10
  let runStartFree = startFree27;
  let runStartCards = startCards27;
  const pastDays = allDayKeys.filter((d) => d < ANCHOR_DATE).sort().reverse();
  for (const d of pastDays) {
    const s = byDay.get(d)!;
    const endF = runStartFree;
    const endC = runStartCards;
    const startF = round2(endF - s.netFree);
    const startC = round2(endC - s.netCards);
    resultsMap.set(d, {
      freeStart: startF,
      cardsStart: startC,
      totalStart: round2(startF + startC),
      freeEnd: endF,
      cardsEnd: endC,
      totalEnd: round2(endF + endC),
    });
    runStartFree = startF;
    runStartCards = startC;
  }

  const daysDesc = Array.from(byDay.keys()).sort((a, b) => b.localeCompare(a));
  const closings: CajuDailyClosing[] = [];

  for (const d of daysDesc) {
    const s = byDay.get(d)!;
    const res = resultsMap.get(d) || {
      freeStart: 0,
      cardsStart: 0,
      totalStart: 0,
      freeEnd: 0,
      cardsEnd: 0,
      totalEnd: 0,
    };
    const isWk = isWeekendDay(d);
    const holiday = getHolidayName(d);
    const isBiz = !isWk && !holiday;

    closings.push({
      date: d,
      deposits: s.deposits,
      rescues: s.rescues,
      purchases: s.purchases,
      recharges: s.recharges,
      txCount: s.txCount,
      depositsCount: s.depositsCount,
      reconciledDeposits: s.reconciledDeposits,
      freeBalanceStart: res.freeStart,
      cardsBalanceStart: res.cardsStart,
      totalBalanceStart: res.totalStart,
      freeBalanceEnd: res.freeEnd,
      cardsBalanceEnd: res.cardsEnd,
      totalBalanceEnd: res.totalEnd,
      isHistorical: d <= cutoffDate,
      isBusinessDay: isBiz,
      isWeekend: isWk,
      isHoliday: Boolean(holiday),
      holidayName: holiday || undefined,
    });
  }

  return closings;
}

export interface CajuHubData {
  snapshot: CajuSnapshot;
  collaborators: CajuCollaborator[];
  transactions: CajuTransaction[];
  movements: CajuMovement[];
  dailyClosings: CajuDailyClosing[];
}

export async function getCajuHubData(txLimit = 5000): Promise<CajuHubData> {
  await ensureCajuInitialized();
  await syncUnprocessedCajuRecharges();

  const [
    { data: wallet, error: wErr },
    { data: collabs, error: cErr },
    { data: txs, error: tErr },
    { data: movs, error: mErr },
    { data: lastBatch },
  ] = await Promise.all([
    supabaseAdmin.from("caju_wallet").select("*").eq("id", "caju").single(),
    supabaseAdmin.from("caju_collaborators").select("*").order("balance", { ascending: false }).order("name", { ascending: true }),
    supabaseAdmin.from("caju_transactions").select("*").order("occurred_at", { ascending: false }).limit(txLimit),
    supabaseAdmin.from("caju_movements").select("*").order("created_at", { ascending: false }).limit(200),
    supabaseAdmin.from("caju_import_batches").select("created_at").order("created_at", { ascending: false }).limit(1).maybeSingle(),
  ]);

  if (wErr) throw wErr;
  if (cErr) throw cErr;
  if (tErr) throw tErr;
  if (mErr) throw mErr;

  const collaborators: CajuCollaborator[] = (collabs || []).map((c: any) => ({
    ...c,
    balance: round2(Number(c.balance)),
  }));
  const baseTransactions: CajuTransaction[] = (txs || []).map((t: any) => ({
    ...t,
    amount: round2(Number(t.amount)),
  }));
  const movements: CajuMovement[] = (movs || []).map((m: any) => ({
    ...m,
    free_delta: round2(Number(m.free_delta)),
    cards_delta: round2(Number(m.cards_delta)),
    free_balance_after: m.free_balance_after !== null ? round2(Number(m.free_balance_after)) : null,
  }));

  // Cria transações para as recargas oficiais (Pix R$ 3.000,00) para compor o Extrato e o Saldo
  const rechargeTransactions: CajuTransaction[] = CAJU_OFFICIAL_RECHARGES.map((r) => ({
    id: `recarga-${r.id}`,
    tx_hash: `recarga-${r.id}`,
    advance_name: "Carteira Despesas",
    collaborator_name: "Empresa • Conect Pay",
    cpf: "00000000000",
    collaborator_id: null,
    tx_type: "RECARGA",
    raw_type: "Recarga Pix",
    merchant: `Recarga Caju • ID ${r.id}`,
    amount: r.amount,
    occurred_at: `${r.date}T${r.time}-03:00`,
    applied_to_balance: true,
    reconciliation_status: "CONCILIADO",
    match_kind: "EXATO",
    matched_request_id: null,
    match_details: null,
    import_batch_id: null,
    created_at: `${r.date}T${r.time}-03:00`,
  }));

  const allTransactions = [...baseTransactions, ...rechargeTransactions].sort((a, b) =>
    b.occurred_at.localeCompare(a.occurred_at)
  );

  const freeBalance = round2(Number(wallet?.free_balance ?? 5545.8));
  const cardsBalance = round2(collaborators.reduce((s, c) => s + c.balance, 0));
  const totalBalance = round2(freeBalance + cardsBalance);

  // Compras no mês corrente (ou mês da transação mais recente, caso não haja compras no mês atual)
  const nowMonth = brDate(new Date().toISOString()).slice(0, 7);
  const latestTxMonth = allTransactions[0] ? brDate(allTransactions[0].occurred_at).slice(0, 7) : nowMonth;
  const targetMonth = allTransactions.some((t) => t.tx_type === "COMPRA" && brDate(t.occurred_at).startsWith(nowMonth))
    ? nowMonth
    : latestTxMonth;
  const monthPurchases = round2(
    allTransactions
      .filter((t) => t.tx_type === "COMPRA" && brDate(t.occurred_at).startsWith(targetMonth))
      .reduce((s, t) => s + t.amount, 0)
  );

  const cutoffAt = wallet?.cutoff_at || CAJU_CUTOFF_ISO;
  const dailyClosings = buildDailyClosings({
    currentFree: freeBalance,
    currentCards: cardsBalance,
    cutoffIso: cutoffAt,
    transactions: allTransactions,
    movements,
  });

  return {
    snapshot: {
      freeBalance,
      cardsBalance,
      totalBalance,
      monthPurchases,
      collaboratorsCount: collaborators.length,
      collaboratorsWithBalance: collaborators.filter((c) => c.balance > 0).length,
      cutoffAt,
      updatedAt: wallet?.updated_at ?? null,
      lastImportAt: lastBatch?.created_at ?? null,
    },
    collaborators,
    transactions: allTransactions,
    movements,
    dailyClosings,
  };
}

/** Busca todas as solicitações do Kanban relevantes para conciliação Caju. */
async function fetchCajuKanbanCards(minIso?: string, maxIso?: string): Promise<KanbanCardInput[]> {
  let query = supabaseAdmin
    .from("payment_requests")
    .select("*")
    .or("is_deleted.eq.false,is_deleted.is.null");

  if (minIso) {
    const start = new Date(new Date(minIso).getTime() - 20 * 86_400_000).toISOString();
    query = query.gte("created_at", start);
  }
  if (maxIso) {
    const end = new Date(new Date(maxIso).getTime() + 10 * 86_400_000).toISOString();
    query = query.lte("created_at", end);
  }

  const { data, error } = await query;
  if (error) {
    console.warn("[fetchCajuKanbanCards] Erro ao buscar cards:", error.message);
  }
  return (data || [])
    .filter((c: any) => {
      if (isCajuRechargeCard(c)) return false; // recargas são do Saldo Livre, não depósitos de colaborador
      if (c.status === "RECUSADO") return false;
      const pm = String(c.payment_method || c.payment_type || "").toUpperCase();
      if (pm === "CAJU") return true;
      if (Array.isArray(c.splits) && c.splits.some((s: any) => String(s?.payment_type || "").toUpperCase() === "CAJU")) return true;
      return /ticket|caju|almo[cç]o|janta|caf[eé]|hospedagem|abastecimento/i.test(`${c.title || ""} ${c.notes || ""} ${c.description || ""}`);
    })
    .map((c: any) => ({
      ...c,
      category: c.category || c.title || null,
      notes: [c.notes, c.description].filter(Boolean).join(" "),
    })) as KanbanCardInput[];
}

/**
 * Reexecuta o Validador IA sobre todos os depósitos do banco (ou de uma janela)
 * e grava `reconciliation_status`, `match_kind`, `matched_request_id` e `match_details`.
 */
export async function runCajuDepositReconciliation(): Promise<{ reconciled: number; unreconciled: number }> {
  const { data: deposits } = await supabaseAdmin
    .from("caju_transactions")
    .select("id, collaborator_name, amount, occurred_at, advance_name")
    .eq("tx_type", "DEPOSITO")
    .order("occurred_at", { ascending: true });

  if (!deposits || deposits.length === 0) return { reconciled: 0, unreconciled: 0 };

  const dates = deposits.map((d: any) => String(d.occurred_at)).sort();
  const cards = await fetchCajuKanbanCards(dates[0], dates[dates.length - 1]);
  const inputs: DepositInput[] = deposits.map((d: any) => ({
    id: d.id,
    collaborator_name: d.collaborator_name,
    amount: round2(Number(d.amount)),
    occurred_at: d.occurred_at,
    advance_name: d.advance_name,
  }));

  const matches = reconcileCajuDeposits(inputs, cards);
  let reconciled = 0;
  let unreconciled = 0;

  for (const m of matches) {
    if (m.status === "CONCILIADO") reconciled++;
    else unreconciled++;
  }

  const chunkSize = 25;
  for (let i = 0; i < matches.length; i += chunkSize) {
    const chunk = matches.slice(i, i + chunkSize);
    await Promise.all(
      chunk.map((m) =>
        supabaseAdmin
          .from("caju_transactions")
          .update({
            reconciliation_status: m.status,
            match_kind: m.kind,
            matched_request_id: m.requestId,
            match_details: m.details,
          })
          .eq("id", m.depositId)
      )
    );
  }

  return { reconciled, unreconciled };
}

/** Importa um arquivo CSV da Caju de forma idempotente e roda o Validador IA. */
export async function importCajuCsvStatement(args: {
  csvText: string;
  fileName: string;
  userId: string | null;
}): Promise<CajuImportSummary> {
  await ensureCajuInitialized();
  const parsed = parseCajuCsv(args.csvText);

  const { data: batch, error: bErr } = await supabaseAdmin
    .from("caju_import_batches")
    .insert({
      file_name: args.fileName,
      total_rows: parsed.totalRows,
      completed_rows: parsed.rows.length,
      ignored_rows: parsed.ignoredRows,
      created_by: args.userId,
    })
    .select("id")
    .single();
  if (bErr) throw bErr;

  const { data: rpcRes, error: rErr } = await supabaseAdmin.rpc("caju_import_rows", {
    p_rows: parsed.rows,
    p_batch: batch.id,
    p_user: args.userId,
  });
  if (rErr) throw rErr;

  const r = (rpcRes || {}) as any;
  const inserted = Number(r.inserted || 0);
  const duplicates = Number(r.duplicates || 0);
  const applied = Number(r.applied || 0);
  const newCollaborators = Number(r.new_collaborators || 0);

  await supabaseAdmin
    .from("caju_import_batches")
    .update({
      inserted_rows: inserted,
      duplicate_rows: duplicates,
      applied_rows: applied,
      new_collaborators: newCollaborators,
    })
    .eq("id", batch.id);

  const { reconciled, unreconciled } = await runCajuDepositReconciliation();

  return {
    batchId: batch.id,
    fileName: args.fileName,
    totalRows: parsed.totalRows,
    completedRows: parsed.rows.length,
    ignoredRows: parsed.ignoredRows,
    inserted,
    duplicates,
    applied,
    newCollaborators,
    reconciled,
    unreconciled,
    parseWarnings: parsed.warnings,
  };
}

/**
 * Gatilho de Recarga Caju: quando um card RECARGA_CAJU chega em FINALIZADO,
 * soma o valor ao Saldo Livre (idempotente). Se sair de FINALIZADO ou for excluído, estorna.
 */
export async function syncCajuRechargeCard(card: any, userId: string | null): Promise<{ processed: boolean; action?: string; freeBalance?: number }> {
  if (!card || !isCajuRechargeCard(card)) return { processed: false };
  await ensureCajuInitialized();

  const validUserId = userId && /^[0-9a-f-]{36}$/i.test(userId) ? userId : null;
  const shouldCredit = !card.is_deleted && card.status === "FINALIZADO" && Number(card.amount) > 0;
  const desc = shouldCredit
    ? `Recarga de Saldo Caju • ${card.title || "Kanban"}`
    : `Estorno de Recarga Caju • ${card.title || "Kanban"}`;

  const { data, error } = await supabaseAdmin.rpc("caju_sync_recharge", {
    p_request_id: card.id,
    p_amount: Number(card.amount) || 0,
    p_should_credit: shouldCredit,
    p_description: desc,
    p_user: validUserId,
  });
  if (error) {
    console.warn("[syncCajuRechargeCard] Erro RPC:", error.message);
    return { processed: false };
  }
  const r = (data || {}) as any;
  return {
    processed: Boolean(r.processed),
    action: r.action,
    freeBalance: r.free_balance !== undefined ? round2(Number(r.free_balance)) : undefined,
  };
}

/** Varre cards de Recarga Caju no Kanban para garantir consistência mesmo se uma requisição falhou. */
export async function syncUnprocessedCajuRecharges(): Promise<void> {
  try {
    const [{ data: cards }, { data: existingCredits }] = await Promise.all([
      supabaseAdmin
        .from("payment_requests")
        .select("id, title, amount, status, is_deleted, request_kind, created_by")
        .or("request_kind.eq.RECARGA_CAJU,title.ilike.%Recarga%Caju%"),
      supabaseAdmin
        .from("caju_recharge_credits")
        .select("payment_request_id, credited"),
    ]);

    const creditMap = new Map<string, boolean>();
    for (const row of existingCredits || []) {
      creditMap.set(String((row as any).payment_request_id), Boolean(row.credited));
    }

    for (const c of cards || []) {
      if (!isCajuRechargeCard(c)) continue;
      const shouldCredit = !c.is_deleted && c.status === "FINALIZADO" && Number(c.amount) > 0;
      const alreadyCredited = creditMap.get(String(c.id)) ?? false;
      if (shouldCredit !== alreadyCredited) {
        await syncCajuRechargeCard(c, c.created_by || null);
      }
    }
  } catch (e) {
    console.warn("[syncUnprocessedCajuRecharges]", e);
  }
}

export async function adjustCajuFreeBalance(args: {
  delta?: number;
  absolute?: number;
  description: string;
  userId: string | null;
}): Promise<{ freeBalance: number; delta: number }> {
  await ensureCajuInitialized();
  const validUserId = args.userId && /^[0-9a-f-]{36}$/i.test(args.userId) ? args.userId : null;
  const { data, error } = await supabaseAdmin.rpc("caju_adjust_free", {
    p_delta: args.delta ?? null,
    p_absolute: args.absolute ?? null,
    p_description: args.description,
    p_user: validUserId,
  });
  if (error) throw error;
  const r = (data || {}) as any;
  return { freeBalance: round2(Number(r.free_balance)), delta: round2(Number(r.delta)) };
}

export async function adjustCajuCollaboratorBalance(args: {
  collaboratorId: string;
  newBalance: number;
  description: string;
  userId: string | null;
}): Promise<{ balance: number; delta: number }> {
  await ensureCajuInitialized();
  const validUserId = args.userId && /^[0-9a-f-]{36}$/i.test(args.userId) ? args.userId : null;
  const { data, error } = await supabaseAdmin.rpc("caju_adjust_collaborator", {
    p_collaborator: args.collaboratorId,
    p_absolute: round2(args.newBalance),
    p_description: args.description,
    p_user: validUserId,
  });
  if (error) throw error;
  const r = (data || {}) as any;
  return { balance: round2(Number(r.balance)), delta: round2(Number(r.delta)) };
}
