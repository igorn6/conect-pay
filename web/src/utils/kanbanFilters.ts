import type { PaymentRequest, UserRole } from "@/types/database";
import type {
  KanbanConditionFilter,
  KanbanFacetCounts,
  KanbanFilterState,
} from "@/types/kanbanFilters";

export interface KanbanFilterContext {
  userId: string | null;
  userRole: UserRole | null;
  profilesMap: Record<string, string>;
  requesterSectorById: Record<string, string>;
  categoryNameById: Record<string, string>;
  todayBrt: string; // YYYY-MM-DD in America/Sao_Paulo
  next7DaysBrt: string; // YYYY-MM-DD in America/Sao_Paulo
  thisMonthBrt: string; // YYYY-MM
  lastMonthBrt: string; // YYYY-MM
}

export type KanbanFilterKey = keyof KanbanFilterState;

const brtDateFormatter = new Intl.DateTimeFormat("en-CA", {
  timeZone: "America/Sao_Paulo",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

export function normalizeText(value: string | null | undefined): string {
  if (!value) return "";
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .toLowerCase();
}

export function getTodayBrtDateKey(now = new Date()): string {
  return brtDateFormatter.format(now);
}

export function addDaysToDateKey(dateKey: string, days: number): string {
  const [y, m, d] = dateKey.split("-").map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d + days));
  return dt.toISOString().slice(0, 10);
}

export function getPreviousMonthKey(monthKey: string): string {
  const [y, m] = monthKey.split("-").map(Number);
  const dt = new Date(Date.UTC(y, m - 2, 1));
  return dt.toISOString().slice(0, 7);
}

/**
 * Converte data/ISO para YYYY-MM-DD sem deslocar datas-calendário ("YYYY-MM-DD" ou meia-noite UTC)
 * para o dia anterior no fuso de Brasília.
 */
export function getBrtDateKey(value: string | null | undefined): string | null {
  if (!value) return null;
  const trimmed = value.trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) return trimmed;
  if (/^\d{4}-\d{2}-\d{2}T00:00:00(\.000)?(Z|\+00:00)?$/i.test(trimmed)) {
    return trimmed.slice(0, 10);
  }
  const parsed = new Date(trimmed);
  if (Number.isNaN(parsed.getTime())) return null;
  return brtDateFormatter.format(parsed);
}

export function getCardMonthBrt(createdAt: string | null | undefined): string | null {
  const key = getBrtDateKey(createdAt);
  return key ? key.slice(0, 7) : null;
}

/**
 * Prioriza vencimento real de boletos dentro de `splits[].boleto_due_date` antes de cair em `card.due_date`.
 */
export function getEffectiveDueDateKey(card: PaymentRequest): string | null {
  const boletoDates: string[] = [];
  if (Array.isArray(card.splits)) {
    for (const s of card.splits) {
      if ((s?.payment_type || "").toUpperCase() === "BOLETO" && s.boleto_due_date) {
        const k = getBrtDateKey(s.boleto_due_date);
        if (k) boletoDates.push(k);
      }
    }
  }
  if (boletoDates.length > 0) {
    boletoDates.sort();
    return boletoDates[0];
  }
  return getBrtDateKey(card.due_date);
}

/**
 * "Minhas Solicitações": pertence diretamente ao usuário se `real_requester_id` for dele
 * (ou se `real_requester_id` estiver nulo, `created_by` for dele).
 * Assim, pedidos lançados pelo Financeiro/Master em nome de outro Gestor não poluem "Minhas" do operador.
 */
export function isMyPaymentRequest(card: PaymentRequest, userId: string | null): boolean {
  if (!userId) return false;
  return card.real_requester_id
    ? card.real_requester_id === userId
    : card.created_by === userId;
}

export function getCardRequesterId(card: PaymentRequest): string | null {
  return card.real_requester_id || card.created_by || null;
}

export function getCardCategoryName(
  card: PaymentRequest,
  categoryNameById: Record<string, string>
): string {
  if (card.category_id && categoryNameById[card.category_id]) {
    return categoryNameById[card.category_id].trim();
  }
  return (card.category || "").trim();
}

export function normalizePaymentMethod(raw: string | null | undefined): string {
  const upper = (raw || "").trim().toUpperCase();
  if (!upper) return "";
  if (upper === "PIX") return "PIX";
  if (upper === "BOLETO") return "BOLETO";
  if (upper === "CAJU") return "CAJU";
  if (upper === "FOPAG") return "FOPAG";
  if (upper === "RETIRADA DE SALDO" || upper === "RETIRADA_DE_SALDO") {
    return "RETIRADA_DE_SALDO";
  }
  return upper;
}

export function getCardPaymentTypes(card: PaymentRequest): Set<string> {
  const result = new Set<string>();
  const p1 = normalizePaymentMethod(card.payment_type);
  const p2 = normalizePaymentMethod(card.payment_method);
  if (p1) result.add(p1);
  if (p2) result.add(p2);
  if (Array.isArray(card.splits)) {
    for (const s of card.splits) {
      const sp = normalizePaymentMethod(s?.payment_type);
      if (sp) result.add(sp);
    }
  }
  return result;
}

export function getCardInvoiceUrls(card: PaymentRequest): string[] {
  return (card.invoice_url || "")
    .split(",")
    .map((u) => u.trim())
    .filter(Boolean);
}

export function cardMatchesCondition(
  card: PaymentRequest,
  cond: KanbanConditionFilter
): boolean {
  const hasInvoice = getCardInvoiceUrls(card).length > 0;
  const hasProof = Boolean(card.payment_proof_url && card.payment_proof_url.trim());
  const isRefused = card.status === "RECUSADO";

  switch (cond) {
    case "NO_INVOICE":
      return !hasInvoice && !isRefused;
    case "HAS_INVOICE":
      return hasInvoice;
    case "NO_PROOF":
      return !hasProof && !isRefused;
    case "ATTENTION":
      return (
        Boolean(card.pending_edit) ||
        card.status === "CORRECAO_PENDENTE" ||
        Boolean(card.payment_conversion_log)
      );
    case "RECHARGE":
      return (
        card.request_kind === "RECARGA_NUBANK" ||
        card.request_kind === "RECARGA_CAJU"
      );
  }
}

export function buildCardSearchBlob(
  card: PaymentRequest,
  ctx: KanbanFilterContext
): string {
  const reqId = getCardRequesterId(card);
  const reqName = (reqId && ctx.profilesMap[reqId]) || "";
  const createdName = (card.created_by && ctx.profilesMap[card.created_by]) || "";
  const catName = getCardCategoryName(card, ctx.categoryNameById);
  const splitOwners = Array.isArray(card.splits)
    ? card.splits
        .map((s) => `${s.pix_owner || ""} ${s.pix_key || ""} ${s.caju_phone || ""}`)
        .join(" ")
    : "";

  const shortId = `#${card.id.slice(0, 6)}`;
  const amountStr = Number(card.amount || 0).toFixed(2).replace(".", ",");

  return normalizeText(
    [
      card.title,
      shortId,
      card.id,
      card.notes,
      card.description,
      card.pix_owner,
      card.pix_name,
      card.pix_key,
      card.caju_phone,
      card.cnpj,
      catName,
      reqName,
      createdName,
      splitOwners,
      amountStr,
      String(card.amount ?? ""),
    ]
      .filter(Boolean)
      .join(" ")
  );
}

export function matchesKanbanFilters(
  card: PaymentRequest,
  filters: KanbanFilterState,
  ctx: KanbanFilterContext,
  excludeKey?: KanbanFilterKey
): boolean {
  if (excludeKey !== "scope" && filters.scope === "MINE") {
    if (!isMyPaymentRequest(card, ctx.userId)) return false;
  }

  if (excludeKey !== "search" && filters.search.trim()) {
    const query = normalizeText(filters.search);
    const blob = buildCardSearchBlob(card, ctx);
    if (!blob.includes(query)) return false;
  }

  if (excludeKey !== "periodMode" && filters.periodMode !== "ALL") {
    const isFinishedOrRefused =
      card.status === "FINALIZADO" || card.status === "RECUSADO";

    if (filters.periodMode === "DUE_TODAY_OR_OVERDUE") {
      if (isFinishedOrRefused) return false;
      const dueKey = getEffectiveDueDateKey(card);
      if (!dueKey || dueKey > ctx.todayBrt) return false;
    } else if (filters.periodMode === "DUE_NEXT_7D") {
      if (isFinishedOrRefused) return false;
      const dueKey = getEffectiveDueDateKey(card);
      if (!dueKey || dueKey < ctx.todayBrt || dueKey > ctx.next7DaysBrt) return false;
    } else if (filters.periodMode === "THIS_MONTH") {
      if (getCardMonthBrt(card.created_at) !== ctx.thisMonthBrt) return false;
    } else if (filters.periodMode === "LAST_MONTH") {
      if (getCardMonthBrt(card.created_at) !== ctx.lastMonthBrt) return false;
    } else if (filters.periodMode === "MONTH" && filters.month) {
      if (getCardMonthBrt(card.created_at) !== filters.month) return false;
    }
  }

  if (excludeKey !== "category" && filters.category) {
    const cardCat = normalizeText(getCardCategoryName(card, ctx.categoryNameById));
    if (cardCat !== normalizeText(filters.category)) return false;
  }

  if (excludeKey !== "requesterId" && filters.requesterId) {
    const matchesReq =
      card.real_requester_id === filters.requesterId ||
      (!card.real_requester_id && card.created_by === filters.requesterId);
    if (!matchesReq) return false;
  }

  if (excludeKey !== "sectorId" && filters.sectorId) {
    const reqId = getCardRequesterId(card);
    const cardSector = (reqId && ctx.requesterSectorById[reqId]) || "";
    if (cardSector !== filters.sectorId) return false;
  }

  if (excludeKey !== "paymentTypes" && filters.paymentTypes.length > 0) {
    const cardTypes = getCardPaymentTypes(card);
    const hasMatch = filters.paymentTypes.some((pt) => cardTypes.has(pt));
    if (!hasMatch) return false;
  }

  if (excludeKey !== "cnpj" && filters.cnpj) {
    const cardCnpj = (card.cnpj || "").trim();
    if (filters.cnpj === "NONE") {
      if (cardCnpj !== "") return false;
    } else if (cardCnpj.toLowerCase() !== filters.cnpj.toLowerCase()) {
      return false;
    }
  }

  if (excludeKey !== "conditions" && filters.conditions.length > 0) {
    for (const cond of filters.conditions) {
      if (!cardMatchesCondition(card, cond)) return false;
    }
  }

  return true;
}

export function computeKanbanFacetCounts(
  allCards: PaymentRequest[],
  filters: KanbanFilterState,
  filteredCards: PaymentRequest[],
  ctx: KanbanFilterContext
): KanbanFacetCounts {
  const scopeCounts = { ALL: 0, MINE: 0 };
  const categoryCounts: Record<string, number> = {};
  const requesterCounts: Record<string, number> = {};
  const sectorCounts: Record<string, number> = {};
  const paymentTypeCounts: Record<string, number> = {};
  const cnpjCounts: Record<string, number> = {};
  const monthCounts: Record<string, number> = {};
  const conditionCounts: Record<KanbanConditionFilter, number> = {
    NO_INVOICE: 0,
    HAS_INVOICE: 0,
    NO_PROOF: 0,
    ATTENTION: 0,
    RECHARGE: 0,
  };

  for (const card of allCards) {
    if (matchesKanbanFilters(card, filters, ctx, "scope")) {
      scopeCounts.ALL += 1;
      if (isMyPaymentRequest(card, ctx.userId)) scopeCounts.MINE += 1;
    }

    if (matchesKanbanFilters(card, filters, ctx, "category")) {
      const catName = getCardCategoryName(card, ctx.categoryNameById);
      if (catName) {
        const key = normalizeText(catName);
        categoryCounts[key] = (categoryCounts[key] || 0) + 1;
      }
    }

    if (matchesKanbanFilters(card, filters, ctx, "requesterId")) {
      const reqId = getCardRequesterId(card);
      if (reqId) requesterCounts[reqId] = (requesterCounts[reqId] || 0) + 1;
    }

    if (matchesKanbanFilters(card, filters, ctx, "sectorId")) {
      const reqId = getCardRequesterId(card);
      const sec = reqId ? ctx.requesterSectorById[reqId] : undefined;
      if (sec) sectorCounts[sec] = (sectorCounts[sec] || 0) + 1;
    }

    if (matchesKanbanFilters(card, filters, ctx, "paymentTypes")) {
      const types = getCardPaymentTypes(card);
      for (const t of types) {
        paymentTypeCounts[t] = (paymentTypeCounts[t] || 0) + 1;
      }
    }

    if (matchesKanbanFilters(card, filters, ctx, "cnpj")) {
      const key = (card.cnpj || "").trim() || "NONE";
      cnpjCounts[key] = (cnpjCounts[key] || 0) + 1;
    }

    if (matchesKanbanFilters(card, filters, ctx, "periodMode")) {
      const m = getCardMonthBrt(card.created_at);
      if (m) monthCounts[m] = (monthCounts[m] || 0) + 1;
    }

    if (matchesKanbanFilters(card, filters, ctx, "conditions")) {
      (Object.keys(conditionCounts) as KanbanConditionFilter[]).forEach((c) => {
        if (cardMatchesCondition(card, c)) conditionCounts[c] += 1;
      });
    }
  }

  let hiddenUrgentCount = 0;
  if (ctx.userRole === "MASTER" || ctx.userRole === "FINANCEIRO") {
    const visibleIds = new Set(filteredCards.map((c) => c.id));
    for (const card of allCards) {
      if (visibleIds.has(card.id)) continue;
      if (card.status === "FINALIZADO" || card.status === "RECUSADO") continue;
      const dueKey = getEffectiveDueDateKey(card);
      const isOverdueOrToday = Boolean(dueKey && dueKey <= ctx.todayBrt);
      const isPendingAttention =
        Boolean(card.pending_edit) || card.status === "CORRECAO_PENDENTE";
      if (isOverdueOrToday || isPendingAttention) {
        hiddenUrgentCount += 1;
      }
    }
  }

  return {
    scopeCounts,
    categoryCounts,
    requesterCounts,
    sectorCounts,
    paymentTypeCounts,
    cnpjCounts,
    monthCounts,
    conditionCounts,
    hiddenUrgentCount,
  };
}

