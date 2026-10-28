/** Constantes, tipos e helpers compartilhados (cliente + servidor) do Hub Caju. */

/** Marco zero oficial: saldos iniciais já contemplam tudo até este instante. */
export const CAJU_CUTOFF_ISO = "2026-10-27T12:04:21-03:00";
export const CAJU_CUTOFF_LABEL = "27/10/2026 12:04:21";
export const CAJU_RECHARGE_DEFAULT_AMOUNT = 3000;

export type CajuTxType = "DEPOSITO" | "RESGATE" | "COMPRA" | "RECARGA" | "OUTRO";
export type CajuReconciliationStatus = "CONCILIADO" | "SEM_CONCILIACAO" | "NAO_APLICAVEL";
export type CajuMatchKind = "EXATO" | "PARCIAL";

export const CAJU_TX_TYPE_LABELS: Record<CajuTxType, string> = {
  DEPOSITO: "Depósito",
  RESGATE: "Resgate: Empresa",
  COMPRA: "Compra",
  RECARGA: "Recarga Pix",
  OUTRO: "Outro",
};

export interface CajuOfficialRecharge {
  id: string;
  date: string;
  time: string;
  amount: number;
  wallet: string;
  payment: string;
}

export const CAJU_OFFICIAL_RECHARGES: ReadonlyArray<CajuOfficialRecharge> = [
  { id: "9e978792", date: "2026-10-27", time: "11:05:47", amount: 3000, wallet: "Despesas", payment: "Pix" },
  { id: "234f5d14", date: "2026-10-26", time: "11:50:21", amount: 3000, wallet: "Despesas", payment: "Pix" },
  { id: "c2a164fd", date: "2026-10-22", time: "17:24:44", amount: 3000, wallet: "Despesas", payment: "Pix" },
  { id: "d23f4445", date: "2026-10-21", time: "17:21:39", amount: 3000, wallet: "Despesas", payment: "Pix" },
  { id: "427659fc", date: "2026-10-19", time: "14:11:31", amount: 3000, wallet: "Despesas", payment: "Pix" },
  { id: "c0f2bef7", date: "2026-10-16", time: "11:07:54", amount: 3000, wallet: "Despesas", payment: "Pix" },
  { id: "f2625d69", date: "2026-10-15", time: "11:32:38", amount: 3000, wallet: "Despesas", payment: "Pix" },
  { id: "2a2bf8cd", date: "2026-10-14", time: "18:00:00", amount: 3000, wallet: "Despesas", payment: "Pix" },
  { id: "3b96ab68", date: "2026-10-08", time: "18:00:00", amount: 3000, wallet: "Despesas", payment: "Pix" },
  { id: "03038b9d", date: "2026-10-05", time: "18:00:00", amount: 3000, wallet: "Despesas", payment: "Pix" },
  { id: "0baaa1cf", date: "2026-10-01", time: "18:00:00", amount: 3000, wallet: "Despesas", payment: "Pix" },
  { id: "a6a64b4c", date: "2026-09-29", time: "18:00:00", amount: 3000, wallet: "Despesas", payment: "Pix" },
  { id: "a30bede4", date: "2026-09-28", time: "18:00:00", amount: 3000, wallet: "Despesas", payment: "Pix" },
];

export interface CajuCollaborator {
  id: string;
  name: string;
  cpf: string; // apenas dígitos
  balance: number;
  is_seed: boolean;
  created_at: string;
  updated_at: string;
}

/** Explicação produzida pelo Validador IA para uma transação conciliada. */
export interface CajuMatchDetails {
  kind: CajuMatchKind;
  requestId: string;
  requestTitle: string;
  requestAmount: number;
  requestStatus: string | null;
  requestDate: string | null;
  /** Nome do beneficiário/colaborador identificado no card. */
  requestBeneficiary: string | null;
  confidence: number; // 0..1
  signals: {
    name: boolean;
    date: boolean;
    amount: "EXATO" | "PROXIMO" | "LOTE" | "DIVERGENTE";
    category: boolean;
  };
  /** Quando 1 card agrupa vários depósitos (lote). */
  group?: { count: number; sum: number; members: string[] };
  amountDifference: number; // valor do depósito - valor esperado do card/split
  explanation: string;
}

export interface CajuTransaction {
  id: string;
  tx_hash: string;
  advance_name: string | null;
  collaborator_name: string;
  cpf: string;
  collaborator_id: string | null;
  tx_type: CajuTxType;
  raw_type: string | null;
  merchant: string | null;
  amount: number;
  occurred_at: string;
  applied_to_balance: boolean;
  reconciliation_status: CajuReconciliationStatus;
  match_kind: CajuMatchKind | null;
  matched_request_id: string | null;
  match_details: CajuMatchDetails | null;
  import_batch_id: string | null;
  created_at: string;
}

export type CajuMovementType =
  | "RECARGA"
  | "RECARGA_ESTORNO"
  | "AJUSTE_LIVRE"
  | "AJUSTE_COLABORADOR"
  | "DEPOSITO"
  | "RESGATE"
  | "COMPRA";

export interface CajuMovement {
  id: string;
  type: CajuMovementType;
  free_delta: number;
  cards_delta: number;
  free_balance_after: number | null;
  collaborator_id: string | null;
  transaction_id: string | null;
  payment_request_id: string | null;
  description: string | null;
  created_by: string | null;
  created_at: string;
}

export interface CajuDailyClosing {
  date: string; // YYYY-MM-DD (horário de Brasília)
  deposits: number;
  rescues: number;
  purchases: number;
  recharges: number;
  txCount: number;
  depositsCount: number;
  reconciledDeposits: number;
  /** Saldos no INÍCIO do dia (= fechamento do dia imediatamente anterior). */
  freeBalanceStart: number;
  cardsBalanceStart: number;
  totalBalanceStart: number;
  /** Saldos ao FINAL do dia, reconstruídos a partir do marco zero. */
  freeBalanceEnd: number;
  cardsBalanceEnd: number;
  totalBalanceEnd: number;
  /** true = dia inteiramente anterior/igual ao marco zero (somente histórico). */
  isHistorical: boolean;
  /** Regra contábil de dias úteis: fim de semana e feriados repetem o saldo anterior e não movimentam */
  isBusinessDay: boolean;
  isWeekend: boolean;
  isHoliday: boolean;
  holidayName?: string;
}

export interface CajuSnapshot {
  freeBalance: number;
  cardsBalance: number;
  totalBalance: number;
  monthPurchases: number;
  collaboratorsCount: number;
  collaboratorsWithBalance: number;
  cutoffAt: string;
  updatedAt: string | null;
  lastImportAt: string | null;
}

export interface CajuImportSummary {
  batchId: string;
  fileName: string;
  totalRows: number;
  completedRows: number;
  ignoredRows: number; // pendentes / estornadas / inválidas
  inserted: number;
  duplicates: number;
  applied: number; // posteriores ao marco zero (afetaram saldos)
  newCollaborators: number;
  reconciled: number;
  unreconciled: number;
  parseWarnings: string[];
}

/** Apenas dígitos do CPF. */
export function normalizeCpf(cpf: string | null | undefined): string {
  return String(cpf || "").replace(/\D/g, "");
}

/** 00000000000 -> 000.000.000-00 */
export function formatCpf(cpf: string | null | undefined): string {
  const d = normalizeCpf(cpf).padStart(11, "0").slice(-11);
  return `${d.slice(0, 3)}.${d.slice(3, 6)}.${d.slice(6, 9)}-${d.slice(9)}`;
}

/** Identifica cards de Recarga de Saldo Caju (request_kind ou título legado >= R$ 500). */
export function isCajuRechargeCard(card: {
  request_kind?: string | null;
  title?: string | null;
  amount?: number | string | null;
}): boolean {
  if (card.request_kind === "RECARGA_CAJU") return true;
  if (!/recarga\s+(de\s+)?(saldo\s+)?caju/i.test(card.title || "")) return false;
  if (card.amount !== undefined && card.amount !== null && Number(card.amount) < 500) return false;
  return true;
}

export const round2 = (n: number) => Math.round((Number(n) || 0) * 100) / 100;

// ========================================================
// REGRAS CONTÁBEIS DE DIAS ÚTEIS E FERIADOS NACIONAIS (BRASIL)
// Fim de semana (Sáb/Dom) e Feriados não possuem movimentação contábil.
// Todo movimento ocorrido é transferido para o próximo dia útil.
// ========================================================

export const FERIADOS_NACIONAIS_FIXOS: Record<string, string> = {
  "01-01": "Confraternização Universal",
  "04-21": "Tiradentes",
  "05-01": "Dia do Trabalho",
  "09-07": "Independência do Brasil",
  "10-12": "Nossa Senhora Aparecida",
  "11-02": "Finados",
  "11-15": "Proclamação da República",
  "11-20": "Dia da Consciência Negra",
  "12-25": "Natal",
};

export const FERIADOS_MOVEIS_2026: Record<string, string> = {
  "2026-02-16": "Carnaval (Segunda)",
  "2026-02-17": "Carnaval (Terça)",
  "2026-04-03": "Sexta-feira Santa",
  "2026-06-04": "Corpus Christi",
};

/** Verifica se a data YYYY-MM-DD é feriado nacional brasileiro. */
export function getHolidayName(dateStr: string): string | null {
  if (FERIADOS_MOVEIS_2026[dateStr]) return FERIADOS_MOVEIS_2026[dateStr];
  const mmdd = dateStr.slice(5);
  return FERIADOS_NACIONAIS_FIXOS[mmdd] || null;
}

/** Verifica se a data YYYY-MM-DD cai em Sábado ou Domingo. */
export function isWeekendDay(dateStr: string): boolean {
  try {
    const d = new Date(`${dateStr}T12:00:00Z`);
    const day = d.getUTCDay();
    return day === 0 || day === 6; // 0 = Domingo, 6 = Sábado
  } catch {
    return false;
  }
}

/** Retorna true se a data for um dia útil oficial (não é fim de semana nem feriado nacional). */
export function isCajuBusinessDay(dateStr: string): boolean {
  return !isWeekendDay(dateStr) && !getHolidayName(dateStr);
}

/**
 * Retorna o próximo dia útil financeiro a partir de uma data YYYY-MM-DD.
 * Se já for dia útil, retorna ela mesma.
 * Se for Sábado, Domingo ou Feriado, avança até encontrar o primeiro dia útil.
 */
export function getNextBusinessDay(dateStr: string): string {
  let curr = dateStr;
  while (!isCajuBusinessDay(curr)) {
    const d = new Date(`${curr}T12:00:00Z`);
    d.setUTCDate(d.getUTCDate() + 1);
    curr = d.toISOString().slice(0, 10);
  }
  return curr;
}

/**
 * Converte data/hora ISO no fuso de Brasília para a data contábil efetiva (dia útil).
 * Sábado/Domingo/Feriados -> Próximo dia útil.
 */
export function getEffectiveFinancialDate(isoOrDate: string): string {
  let rawDate = isoOrDate;
  if (isoOrDate.includes("T")) {
    const ms = new Date(isoOrDate).getTime() - 3 * 3600_000;
    rawDate = new Date(ms).toISOString().slice(0, 10);
  }
  return getNextBusinessDay(rawDate);
}
