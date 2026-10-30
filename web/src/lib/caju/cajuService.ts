/**
 * Camada de serviço do Hub Caju (servidor).
 * Orquestra leitura do snapshot patrimonial, colaboradores, extrato oficial,
 * fechamentos diários reconstruídos a partir do marco zero, importação CSV
 * idempotente + conciliação automática com o Kanban e gatilho de recarga.
 *
 * NOVA LÓGICA (a partir de 28/10/2026):
 *  - Âncora: R$ 11.348,75 em 27/10/2026
 *  - COMPRA (caju_transactions) → deduz do saldo total
 *  - RECARGA (caju_movements type=RECARGA) → adiciona ao saldo total
 *  - Fim de semana → próxima segunda-feira (getNextBusinessDay)
 *  - Sem divisão posse/colaborador — saldo único
 */
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import {
  CAJU_CUTOFF_ISO,
  isCajuRechargeCard,
  round2,
  isWeekendDay,
  getHolidayName,
  getNextBusinessDay,
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

/** Garante que a carteira Caju exista no banco com a âncora oficial. */
export async function ensureCajuInitialized(): Promise<void> {
  if (cajuInitializedCache) return;

  await supabaseAdmin
    .from("caju_wallet")
    .upsert({ id: "caju", free_balance: 11348.75, cutoff_at: CAJU_CUTOFF_ISO }, { onConflict: "id", ignoreDuplicates: true });

  cajuInitializedCache = true;
}

/** Data YYYY-MM-DD no fuso de Brasília (-03:00). */
function brDate(iso: string): string {
  const ms = new Date(iso).getTime() - 3 * 3600_000;
  return new Date(ms).toISOString().slice(0, 10);
}

/**
 * Reconstrói a tabela de Fechamentos Diários a partir do saldo âncora
 * (R$ 11.348,75 em 27/10/2026) usando a nova lógica simplificada:
 *  - COMPRA (caju_transactions) → deduz do saldo total
 *  - RECARGA (caju_movements type=RECARGA) → adiciona ao saldo total
 *  - Fim de semana → próxima segunda-feira (getNextBusinessDay)
 *  - Sem divisão posse/colaborador — saldo único (totalEnd)
 */
export function buildDailyClosings(args: {
  currentFree: number;
  currentCards: number;
  cutoffIso: string;
  transactions: CajuTransaction[];
  movements: CajuMovement[];
}): CajuDailyClosing[] {
  const { cutoffIso, transactions, movements } = args;
  const cutoffDate = brDate(cutoffIso);

  // Âncora contábil: R$ 11.348,75 em 27/10/2026
  const ANCHOR_DATE = "2026-10-27";
  const ANCHOR_TOTAL = 11348.75;

  // Mapa de dias: data → { purchases, recharges, txCount, netTotal }
  const byDay = new Map<string, {
    purchases: number;
    recharges: number;
    txCount: number;
    netTotal: number; // positivo = entrada, negativo = saída
  }>();

  const slot = (d: string) => {
    let s = byDay.get(d);
    if (!s) {
      s = { purchases: 0, recharges: 0, txCount: 0, netTotal: 0 };
      byDay.set(d, s);
    }
    return s;
  };

  let minDayStr = "2026-09-01";
  let maxDayStr = cutoffDate;

  // 1. Processar COMPRAs (caju_transactions tx_type=COMPRA) → deduzem do total
  for (const tx of transactions) {
    if (tx.tx_type !== "COMPRA") continue;
    const rawDate = brDate(tx.occurred_at);
    const effDate = getNextBusinessDay(rawDate);
    if (effDate < minDayStr) minDayStr = effDate;
    if (effDate > maxDayStr) maxDayStr = effDate;
    const s = slot(effDate);
    const amt = round2(tx.amount);
    s.purchases = round2(s.purchases + amt);
    s.netTotal = round2(s.netTotal - amt); // compra sai do saldo
    s.txCount++;
  }

  // 2. Processar RECARGAs (caju_movements type=RECARGA) → adicionam ao total
  for (const mov of movements) {
    if (mov.type !== "RECARGA") continue;
    const rawDate = brDate(mov.created_at);
    const effDate = getNextBusinessDay(rawDate);
    if (effDate < minDayStr) minDayStr = effDate;
    if (effDate > maxDayStr) maxDayStr = effDate;
    const s = slot(effDate);
    const amt = round2(Math.abs(mov.free_delta));
    s.recharges = round2(s.recharges + amt);
    s.netTotal = round2(s.netTotal + amt); // recarga entra no saldo
    s.txCount++;
  }

  // 3. Processar RECARGAs do Kanban (caju_movements type=RECARGA também)
  //    — já processadas acima via movements

  // Preencher todos os dias corridos sem buracos
  let cursor = new Date(`${minDayStr}T12:00:00Z`);
  const endCursor = new Date(`${maxDayStr}T12:00:00Z`);
  while (cursor <= endCursor) {
    slot(cursor.toISOString().slice(0, 10));
    cursor = new Date(cursor.getTime() + 86_400_000);
  }

  // Calcular saldos por dia usando caminhada progressiva/regressiva a partir da âncora
  const totalMap = new Map<string, { totalStart: number; totalEnd: number }>();

  // Âncora (27/10/2026)
  const s27 = slot(ANCHOR_DATE);
  const anchorStart = round2(ANCHOR_TOTAL - s27.netTotal);
  totalMap.set(ANCHOR_DATE, { totalStart: anchorStart, totalEnd: ANCHOR_TOTAL });

  const allDayKeys = Array.from(byDay.keys()).sort();

  // Dias futuros → caminhada progressiva a partir do fim do dia âncora
  let runTotal = ANCHOR_TOTAL;
  for (const d of allDayKeys.filter((d) => d > ANCHOR_DATE)) {
    const s = byDay.get(d)!;
    const startT = runTotal;
    const endT = round2(startT + s.netTotal);
    totalMap.set(d, { totalStart: startT, totalEnd: endT });
    runTotal = endT;
  }

  // Dias passados → caminhada regressiva a partir do início do dia âncora
  let runPastTotal = anchorStart;
  for (const d of allDayKeys.filter((d) => d < ANCHOR_DATE).reverse()) {
    const s = byDay.get(d)!;
    const endT = runPastTotal;
    const startT = round2(endT - s.netTotal);
    totalMap.set(d, { totalStart: startT, totalEnd: endT });
    runPastTotal = startT;
  }

  // Montar closings em ordem decrescente
  const daysDesc = allDayKeys.slice().sort((a, b) => b.localeCompare(a));
  const closings: CajuDailyClosing[] = [];

  for (const d of daysDesc) {
    const s = byDay.get(d)!;
    const res = totalMap.get(d) || { totalStart: 0, totalEnd: 0 };
    const isWk = isWeekendDay(d);
    const holiday = getHolidayName(d);
    const isBiz = !isWk && !holiday;

    closings.push({
      date: d,
      deposits: 0,
      rescues: 0,
      purchases: s.purchases,
      recharges: s.recharges,
      txCount: s.txCount,
      depositsCount: 0,
      reconciledDeposits: 0,
      // Para compatibilidade de UI: totalEnd = saldo do dia
      // freeBalance = totalBalance (sem split posse/colaborador)
      freeBalanceStart: res.totalStart,
      cardsBalanceStart: 0,
      totalBalanceStart: res.totalStart,
      freeBalanceEnd: res.totalEnd,
      cardsBalanceEnd: 0,
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
    supabaseAdmin.from("caju_movements").select("*").order("created_at", { ascending: false }).limit(500),
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

  // Junta COMPRAS (caju_transactions) e RECARGAS (caju_movements type=RECARGA) no mesmo extrato
  const rechargeTransactions: CajuTransaction[] = movements
    .filter((m) => m.type === "RECARGA")
    .map((m, idx) => ({
      id: m.id || `recharge-mov-${idx}`,
      tx_hash: `recharge-${m.id || idx}`,
      advance_name: "Carteira Despesas",
      collaborator_name: "Empresa • Conect Pay",
      cpf: "00000000000",
      collaborator_id: null,
      tx_type: "RECARGA",
      raw_type: "Recarga Pix",
      merchant: m.description || "Depósito de Créditos Caju",
      amount: round2(Math.abs(m.free_delta)),
      occurred_at: m.created_at,
      applied_to_balance: true,
      reconciliation_status: "CONCILIADO",
      match_kind: "EXATO",
      matched_request_id: m.payment_request_id || null,
      match_details: null,
      import_batch_id: null,
      created_at: m.created_at,
    }));

  const allTransactions = [...baseTransactions, ...rechargeTransactions].sort((a, b) =>
    b.occurred_at.localeCompare(a.occurred_at)
  );

  // Saldo total = wallet.free_balance (âncora já ajustada)
  const WALLET_ANCHOR = 11348.75;
  const freeBalance = round2(Number(wallet?.free_balance ?? WALLET_ANCHOR));
  // cardsBalance = 0 no novo modelo (sem split posse/colaborador)
  const cardsBalance = 0;
  const totalBalance = freeBalance;

  // Compras no mês corrente
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
