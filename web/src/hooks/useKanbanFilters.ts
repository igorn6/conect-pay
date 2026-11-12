import { useState, useEffect, useMemo, useCallback, useDeferredValue, useRef } from "react";
import type { Category, PaymentRequest, UserRole, UserSector } from "@/types/database";
import {
  CNPJ_FILTER_OPTIONS,
  CONDITION_FILTER_OPTIONS,
  DEFAULT_KANBAN_FILTERS,
  PAYMENT_FILTER_OPTIONS,
  type KanbanActiveChip,
  type KanbanConditionFilter,
  type KanbanFilterState,
  type KanbanPeriodMode,
  type KanbanScopeFilter,
} from "@/types/kanbanFilters";
import {
  addDaysToDateKey,
  computeKanbanFacetCounts,
  getPreviousMonthKey,
  getTodayBrtDateKey,
  matchesKanbanFilters,
  type KanbanFilterContext,
} from "@/utils/kanbanFilters";

interface UseKanbanFiltersParams {
  allCards: PaymentRequest[];
  userId: string | null;
  userRole: UserRole | null;
  categories: Category[];
  profilesMap: Record<string, string>;
  requesterSectorById: Record<string, string>;
  sectors: UserSector[];
}

function getDefaultScopeForRole(role: UserRole | null): KanbanScopeFilter {
  return role === "GESTOR" ? "MINE" : "ALL";
}

function formatMonthLabel(monthKey: string): string {
  const [y, m] = monthKey.split("-").map(Number);
  if (!y || !m) return monthKey;
  const months = [
    "Jan",
    "Fev",
    "Mar",
    "Abr",
    "Mai",
    "Jun",
    "Jul",
    "Ago",
    "Set",
    "Out",
    "Nov",
    "Dez",
  ];
  return `${months[m - 1] || m}/${y}`;
}

export function useKanbanFilters({
  allCards,
  userId,
  userRole,
  categories,
  profilesMap,
  requesterSectorById,
  sectors,
}: UseKanbanFiltersParams) {
  const [filters, setFilters] = useState<KanbanFilterState>(DEFAULT_KANBAN_FILTERS);
  const initializedForUserRef = useRef<string | null>(null);

  // Inicialização por usuário/perfil + URL + sessionStorage
  useEffect(() => {
    if (!userId || !userRole) return;
    if (initializedForUserRef.current === `${userId}:${userRole}`) return;
    initializedForUserRef.current = `${userId}:${userRole}`;

    const roleDefaultScope = getDefaultScopeForRole(userRole);
    let next: KanbanFilterState = {
      ...DEFAULT_KANBAN_FILTERS,
      scope: roleDefaultScope,
    };

    if (typeof window !== "undefined") {
      try {
        const raw = window.sessionStorage.getItem(`conectpay:kanban:filters:${userId}`);
        if (raw) {
          const parsed = JSON.parse(raw);
          next = {
            ...next,
            ...parsed,
            paymentTypes: Array.isArray(parsed.paymentTypes) ? parsed.paymentTypes : [],
            conditions: Array.isArray(parsed.conditions) ? parsed.conditions : [],
          };
        }
      } catch {
        // ignorar erro de parse no storage
      }

      // Sobrescreve com query params explícitos (ex: link de notificação ou dashboard)
      const params = new URLSearchParams(window.location.search);
      const urlScope = params.get("scope");
      const urlMonth = params.get("month");
      if (urlScope === "MINE" || urlScope === "ALL") {
        next.scope = urlScope;
      }
      if (urlMonth && /^\d{4}-\d{2}$/.test(urlMonth)) {
        next.periodMode = "MONTH";
        next.month = urlMonth;
      }
    }

    setFilters(next);
  }, [userId, userRole]);

  // Persistência em sessionStorage escopada por usuário
  useEffect(() => {
    if (!userId || !userRole || typeof window === "undefined") return;
    try {
      window.sessionStorage.setItem(
        `conectpay:kanban:filters:${userId}`,
        JSON.stringify(filters)
      );
    } catch {
      // ignorar se quota excedida
    }
  }, [filters, userId, userRole]);

  const deferredSearch = useDeferredValue(filters.search);

  const effectiveFilters = useMemo<KanbanFilterState>(
    () => ({ ...filters, search: deferredSearch }),
    [filters, deferredSearch]
  );

  const categoryNameById = useMemo(() => {
    const map: Record<string, string> = {};
    for (const c of categories) {
      map[c.id] = c.name;
    }
    return map;
  }, [categories]);

  const sectorNameById = useMemo(() => {
    const map: Record<string, string> = {};
    for (const s of sectors) {
      map[s.id] = s.name;
    }
    return map;
  }, [sectors]);

  const filterContext = useMemo<KanbanFilterContext>(() => {
    const todayBrt = getTodayBrtDateKey();
    const thisMonthBrt = todayBrt.slice(0, 7);
    return {
      userId,
      userRole,
      profilesMap,
      requesterSectorById,
      categoryNameById,
      todayBrt,
      next7DaysBrt: addDaysToDateKey(todayBrt, 7),
      thisMonthBrt,
      lastMonthBrt: getPreviousMonthKey(thisMonthBrt),
    };
  }, [userId, userRole, profilesMap, requesterSectorById, categoryNameById]);

  const filteredCards = useMemo(() => {
    return allCards.filter((card) =>
      matchesKanbanFilters(card, effectiveFilters, filterContext)
    );
  }, [allCards, effectiveFilters, filterContext]);

  const facetCounts = useMemo(
    () =>
      computeKanbanFacetCounts(
        allCards,
        effectiveFilters,
        filteredCards,
        filterContext
      ),
    [allCards, effectiveFilters, filteredCards, filterContext]
  );

  // Setters com resolução automática de conflitos (scope vs requesterId)
  const setScope = useCallback(
    (scope: KanbanScopeFilter) => {
      setFilters((prev) => ({
        ...prev,
        scope,
        requesterId:
          scope === "MINE" && prev.requesterId && prev.requesterId !== userId
            ? ""
            : prev.requesterId,
      }));
    },
    [userId]
  );

  const setSearch = useCallback((search: string) => {
    setFilters((prev) => ({ ...prev, search }));
  }, []);

  const setPeriod = useCallback((periodMode: KanbanPeriodMode, month = "") => {
    setFilters((prev) => ({
      ...prev,
      periodMode,
      month: periodMode === "MONTH" ? month : "",
    }));
  }, []);

  const setCategory = useCallback((category: string) => {
    setFilters((prev) => ({ ...prev, category }));
  }, []);

  const setRequesterId = useCallback(
    (requesterId: string) => {
      setFilters((prev) => ({
        ...prev,
        requesterId,
        scope:
          requesterId && requesterId !== userId
            ? "ALL"
            : prev.scope,
      }));
    },
    [userId]
  );

  const setSectorId = useCallback((sectorId: string) => {
    setFilters((prev) => ({ ...prev, sectorId }));
  }, []);

  const togglePaymentType = useCallback((paymentType: string) => {
    setFilters((prev) => {
      const exists = prev.paymentTypes.includes(paymentType);
      return {
        ...prev,
        paymentTypes: exists
          ? prev.paymentTypes.filter((p) => p !== paymentType)
          : [...prev.paymentTypes, paymentType],
      };
    });
  }, []);

  const setCnpj = useCallback((cnpj: string) => {
    setFilters((prev) => ({ ...prev, cnpj }));
  }, []);

  const toggleCondition = useCallback((cond: KanbanConditionFilter) => {
    setFilters((prev) => {
      const exists = prev.conditions.includes(cond);
      if (exists) {
        return {
          ...prev,
          conditions: prev.conditions.filter((c) => c !== cond),
        };
      }
      // Garante mútua exclusividade entre Sem Notinha e Com Notinha
      let next = prev.conditions;
      if (cond === "NO_INVOICE") {
        next = next.filter((c) => c !== "HAS_INVOICE");
      } else if (cond === "HAS_INVOICE") {
        next = next.filter((c) => c !== "NO_INVOICE");
      }
      return { ...prev, conditions: [...next, cond] };
    });
  }, []);

  const clearAllFilters = useCallback(() => {
    setFilters({
      ...DEFAULT_KANBAN_FILTERS,
      scope: getDefaultScopeForRole(userRole),
    });
  }, [userRole]);

  // Conta quantos filtros secundários estão dentro de "Mais Filtros"
  const advancedFiltersCount = useMemo(() => {
    let count = 0;
    if (filters.requesterId) count += 1;
    if (filters.sectorId) count += 1;
    if (filters.paymentTypes.length > 0) count += 1;
    if (filters.cnpj) count += 1;
    if (filters.conditions.length > 0) count += filters.conditions.length;
    return count;
  }, [filters]);

  const defaultScope = getDefaultScopeForRole(userRole);

  const activeChips = useMemo<KanbanActiveChip[]>(() => {
    const chips: KanbanActiveChip[] = [];

    if (filters.search.trim()) {
      chips.push({
        id: "search",
        label: `Busca: "${filters.search.trim()}"`,
        onRemove: () => setSearch(""),
      });
    }

    if (filters.periodMode !== "ALL") {
      const periodLabels: Record<KanbanPeriodMode, string> = {
        ALL: "Todo período",
        DUE_TODAY_OR_OVERDUE: "Vence Hoje / Vencidos",
        DUE_NEXT_7D: "Vence em 7 dias",
        THIS_MONTH: "Mês atual",
        LAST_MONTH: "Mês passado",
        MONTH: filters.month ? formatMonthLabel(filters.month) : "Mês",
      };
      chips.push({
        id: "period",
        label: `Período: ${periodLabels[filters.periodMode]}`,
        onRemove: () => setPeriod("ALL", ""),
      });
    }

    if (filters.category) {
      chips.push({
        id: "category",
        label: `Categoria: ${filters.category}`,
        onRemove: () => setCategory(""),
      });
    }

    if (filters.requesterId) {
      const name = profilesMap[filters.requesterId] || "Solicitante";
      chips.push({
        id: "requester",
        label: `Solicitante: ${name}`,
        onRemove: () => setRequesterId(""),
      });
    }

    if (filters.sectorId) {
      const secName = sectorNameById[filters.sectorId] || filters.sectorId;
      chips.push({
        id: "sector",
        label: `Setor: ${secName}`,
        onRemove: () => setSectorId(""),
      });
    }

    if (filters.paymentTypes.length > 0) {
      const labels = filters.paymentTypes
        .map(
          (t) => PAYMENT_FILTER_OPTIONS.find((o) => o.value === t)?.label || t
        )
        .join(", ");
      chips.push({
        id: "paymentTypes",
        label: `Pagamento: ${labels}`,
        onRemove: () => setFilters((prev) => ({ ...prev, paymentTypes: [] })),
      });
    }

    if (filters.cnpj) {
      const cnpjLabel =
        CNPJ_FILTER_OPTIONS.find((o) => o.value === filters.cnpj)?.label ||
        filters.cnpj;
      chips.push({
        id: "cnpj",
        label: `Conta: ${cnpjLabel}`,
        onRemove: () => setCnpj(""),
      });
    }

    for (const cond of filters.conditions) {
      const label =
        CONDITION_FILTER_OPTIONS.find((o) => o.value === cond)?.label || cond;
      chips.push({
        id: `cond-${cond}`,
        label,
        onRemove: () => toggleCondition(cond),
      });
    }

    return chips;
  }, [
    filters,
    profilesMap,
    sectorNameById,
    setSearch,
    setPeriod,
    setCategory,
    setRequesterId,
    setSectorId,
    setCnpj,
    toggleCondition,
  ]);

  const activeFiltersCount = activeChips.length;
  const hasNonDefaultFilter =
    activeFiltersCount > 0 || filters.scope !== defaultScope;

  return {
    filters,
    filteredCards,
    facetCounts,
    activeChips,
    activeFiltersCount,
    advancedFiltersCount,
    hasNonDefaultFilter,
    defaultScope,
    setScope,
    setSearch,
    setPeriod,
    setCategory,
    setRequesterId,
    setSectorId,
    togglePaymentType,
    setCnpj,
    toggleCondition,
    clearAllFilters,
  };
}

