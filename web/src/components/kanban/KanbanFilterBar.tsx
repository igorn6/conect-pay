"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  AlertTriangle,
  Building2,
  Eye,
  EyeOff,
  Plus,
  RotateCcw,
  Search,
  SlidersHorizontal,
  Tag,
  Trash2,
  TrendingUp,
  Layers,
  User,
  X,
} from "lucide-react";
import type { Category, UserRole, UserSector } from "@/types/database";
import {
  CNPJ_FILTER_OPTIONS,
  CONDITION_FILTER_OPTIONS,
  PAYMENT_FILTER_OPTIONS,
  type KanbanActiveChip,
  type KanbanConditionFilter,
  type KanbanFacetCounts,
  type KanbanFilterState,
  type KanbanPeriodMode,
  type KanbanScopeFilter,
} from "@/types/kanbanFilters";
import { normalizeText } from "@/utils/kanbanFilters";
import { FilterSegmentedControl } from "@/components/ui/FilterSegmentedControl";
import {
  FilterSelectPopover,
  type FilterSelectOption,
} from "@/components/ui/FilterSelectPopover";
import { FloatingPopover } from "@/components/ui/FloatingPopover";
import { FilterMonthPopover } from "@/components/kanban/FilterMonthPopover";
import MagnetButton from "@/components/ui/MagnetButton";

interface KanbanFilterBarProps {
  userRole: UserRole | null;
  userId: string | null;
  sectorId: string | null;
  filters: KanbanFilterState;
  facetCounts: KanbanFacetCounts;
  activeChips: KanbanActiveChip[];
  activeFiltersCount: number;
  advancedFiltersCount: number;
  hasNonDefaultFilter: boolean;
  totalCardsCount: number;
  visibleCardsCount: number;
  totalPipelineVolume: number;
  categories: Category[];
  profilesMap: Record<string, string>;
  sectors: UserSector[];
  emptyColumnsCount: number;
  hideEmptyColumns: boolean;
  onToggleHideEmptyColumns: () => void;
  onOpenTrash: () => void;
  onOpenNewRequest: () => void;
  onSetScope: (scope: KanbanScopeFilter) => void;
  onSetSearch: (search: string) => void;
  onSetPeriod: (mode: KanbanPeriodMode, month?: string) => void;
  onSetCategory: (category: string) => void;
  onSetRequesterId: (id: string) => void;
  onSetSectorId: (id: string) => void;
  onTogglePaymentType: (type: string) => void;
  onSetCnpj: (cnpj: string) => void;
  onToggleCondition: (cond: KanbanConditionFilter) => void;
  onClearAllFilters: () => void;
}

function getInitials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase();
}

export function KanbanFilterBar({
  userRole,
  userId,
  sectorId,
  filters,
  facetCounts,
  activeChips,
  activeFiltersCount,
  advancedFiltersCount,
  hasNonDefaultFilter,
  totalCardsCount,
  visibleCardsCount,
  totalPipelineVolume,
  categories,
  profilesMap,
  sectors,
  emptyColumnsCount,
  hideEmptyColumns,
  onToggleHideEmptyColumns,
  onOpenTrash,
  onOpenNewRequest,
  onSetScope,
  onSetSearch,
  onSetPeriod,
  onSetCategory,
  onSetRequesterId,
  onSetSectorId,
  onTogglePaymentType,
  onSetCnpj,
  onToggleCondition,
  onClearAllFilters,
}: KanbanFilterBarProps) {
  const [moreOpen, setMoreOpen] = useState(false);
  const [mobileDrawerOpen, setMobileDrawerOpen] = useState(false);

  const searchInputRef = useRef<HTMLInputElement>(null);
  const moreTriggerRef = useRef<HTMLButtonElement>(null);
  const morePopoverRef = useRef<HTMLDivElement>(null);

  const isMasterOrFinance = userRole === "MASTER" || userRole === "FINANCEIRO";

  // Atalho ⌘K / Ctrl+K ou "/" para focar busca rápida; Esc limpa busca se focada
  useEffect(() => {
    const handleGlobalKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      const isInputFocused =
        target &&
        (target.tagName === "INPUT" ||
          target.tagName === "TEXTAREA" ||
          target.tagName === "SELECT" ||
          target.isContentEditable);

      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        searchInputRef.current?.focus();
        searchInputRef.current?.select();
        return;
      }

      if (e.key === "/" && !isInputFocused) {
        e.preventDefault();
        searchInputRef.current?.focus();
      }
    };

    window.addEventListener("keydown", handleGlobalKeyDown);
    return () => window.removeEventListener("keydown", handleGlobalKeyDown);
  }, []);

  const scopeOptions = useMemo(() => {
    if (isMasterOrFinance) {
      return [
        {
          value: "ALL" as KanbanScopeFilter,
          label: "Todas",
          shortLabel: "Todas",
          count: facetCounts.scopeCounts.ALL,
        },
        {
          value: "MINE" as KanbanScopeFilter,
          label: "Minhas Solicitações",
          shortLabel: "Minhas",
          count: facetCounts.scopeCounts.MINE,
        },
      ];
    }

    // GESTOR: padrão Minhas + alternador para Do Setor (ou desabilitado se sem setor)
    return [
      {
        value: "MINE" as KanbanScopeFilter,
        label: "Minhas Solicitações",
        shortLabel: "Minhas",
        count: facetCounts.scopeCounts.MINE,
      },
      {
        value: "ALL" as KanbanScopeFilter,
        label: "Do Setor",
        shortLabel: "Setor",
        count: facetCounts.scopeCounts.ALL,
        disabled: !sectorId,
        title: !sectorId
          ? "Seu usuário não possui setor vinculado"
          : "Ver solicitações compartilhadas do seu setor",
      },
    ];
  }, [isMasterOrFinance, facetCounts.scopeCounts, sectorId]);

  const categoryOptions = useMemo<FilterSelectOption[]>(() => {
    const seen = new Set<string>();
    const list: FilterSelectOption[] = [];
    for (const c of categories) {
      const norm = normalizeText(c.name);
      if (!norm || seen.has(norm)) continue;
      seen.add(norm);
      list.push({
        value: c.name.trim(),
        label: c.name.trim(),
        dotColor: c.color || "#6c5ce7",
        count: facetCounts.categoryCounts[norm] || 0,
      });
    }
    return list;
  }, [categories, facetCounts.categoryCounts]);

  const requesterOptions = useMemo<FilterSelectOption[]>(() => {
    const entries = Object.entries(profilesMap)
      .filter(([id]) => isMasterOrFinance || (facetCounts.requesterCounts[id] || 0) > 0 || id === filters.requesterId || id === userId)
      .sort((a, b) => a[1].localeCompare(b[1], "pt-BR"));
    return entries.map(([id, name]) => ({
      value: id,
      label: name,
      initials: getInitials(name),
      count: facetCounts.requesterCounts[id] || 0,
    }));
  }, [profilesMap, isMasterOrFinance, facetCounts.requesterCounts, filters.requesterId, userId]);

  const sectorOptions = useMemo<FilterSelectOption[]>(() => {
    return [...sectors]
      .sort((a, b) => a.name.localeCompare(b.name, "pt-BR"))
      .map((s) => ({
        value: s.id,
        label: s.name,
        count: facetCounts.sectorCounts[s.id] || 0,
      }));
  }, [sectors, facetCounts.sectorCounts]);

  const cnpjOptions = useMemo<FilterSelectOption[]>(() => {
    return CNPJ_FILTER_OPTIONS.map((opt) => ({
      value: opt.value,
      label: opt.label,
      count: facetCounts.cnpjCounts[opt.value] || 0,
    }));
  }, [facetCounts.cnpjCounts]);

  const visibleConditions = useMemo(
    () =>
      CONDITION_FILTER_OPTIONS.filter(
        (c) => !c.financeOnly || isMasterOrFinance
      ),
    [isMasterOrFinance]
  );

  const formattedVolume = useMemo(
    () =>
      new Intl.NumberFormat("pt-BR", {
        style: "currency",
        currency: "BRL",
      }).format(totalPipelineVolume),
    [totalPipelineVolume]
  );

  const advancedFiltersContent = (
    <div className="flex flex-col gap-3.5">
      <div className="flex items-center justify-between">
        <span className="text-xs font-semibold text-[var(--text-primary)]">
          Filtros Avançados
        </span>
        {advancedFiltersCount > 0 && (
          <button
            type="button"
            onClick={onClearAllFilters}
            className="text-[11px] text-[var(--text-muted)] hover:text-[var(--text-primary)] flex items-center gap-1 cursor-pointer"
          >
            <RotateCcw size={11} />
            Limpar tudo
          </button>
        )}
      </div>

      {/* Solicitante & Setor */}
      <div className="grid grid-cols-1 gap-2.5">
        {(isMasterOrFinance || requesterOptions.length > 1) && (
          <div className="flex flex-col gap-1">
            <label className="text-[10px] font-semibold uppercase tracking-wider text-[var(--text-muted)]">
              Solicitante
            </label>
            <FilterSelectPopover
              value={filters.requesterId}
              onChange={onSetRequesterId}
              options={requesterOptions}
              placeholder="Todos solicitantes"
              allLabel="Todos solicitantes"
              icon={<User size={13} />}
              searchPlaceholder="Buscar solicitante..."
              maxTriggerWidthClass="max-w-[260px]"
              popoverWidth={300}
            />
          </div>
        )}

        {isMasterOrFinance && sectorOptions.length > 0 && (
          <div className="flex flex-col gap-1">
            <label className="text-[10px] font-semibold uppercase tracking-wider text-[var(--text-muted)]">
              Setor
            </label>
            <FilterSelectPopover
              value={filters.sectorId}
              onChange={onSetSectorId}
              options={sectorOptions}
              placeholder="Todos os setores"
              allLabel="Todos os setores"
              icon={<Layers size={13} />}
              searchPlaceholder="Buscar setor..."
              maxTriggerWidthClass="max-w-[260px]"
              popoverWidth={280}
            />
          </div>
        )}

        {isMasterOrFinance && (
          <div className="flex flex-col gap-1">
            <label className="text-[10px] font-semibold uppercase tracking-wider text-[var(--text-muted)]">
              Conta Pagadora / CNPJ
            </label>
            <FilterSelectPopover
              value={filters.cnpj}
              onChange={onSetCnpj}
              options={cnpjOptions}
              placeholder="Todas as contas"
              allLabel="Todas as contas"
              icon={<Building2 size={13} />}
              searchable={false}
              maxTriggerWidthClass="max-w-[260px]"
              popoverWidth={260}
            />
          </div>
        )}
      </div>

      {/* Meio de Pagamento */}
      <div className="flex flex-col gap-1.5">
        <span className="text-[10px] font-semibold uppercase tracking-wider text-[var(--text-muted)]">
          Meio de Pagamento
        </span>
        <div className="flex flex-wrap gap-1.5">
          {PAYMENT_FILTER_OPTIONS.map((opt) => {
            const active = filters.paymentTypes.includes(opt.value);
            const count = facetCounts.paymentTypeCounts[opt.value] || 0;
            return (
              <button
                key={opt.value}
                type="button"
                onClick={() => onTogglePaymentType(opt.value)}
                className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[11px] font-medium border transition-colors cursor-pointer ${
                  active
                    ? "bg-[#6c5ce7]/20 border-[#6c5ce7] text-[var(--text-primary)]"
                    : "bg-[var(--bg-primary)] hover:bg-[var(--surface-hover)] border-[var(--surface-border)] text-[var(--text-secondary)]"
                }`}
              >
                <span>{opt.label}</span>
                <span className="font-mono tabular-nums text-[10px] opacity-70">
                  {count}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Condições Operacionais */}
      <div className="flex flex-col gap-1.5">
        <span className="text-[10px] font-semibold uppercase tracking-wider text-[var(--text-muted)]">
          Condições Operacionais
        </span>
        <div className="flex flex-wrap gap-1.5">
          {visibleConditions.map((cond) => {
            const active = filters.conditions.includes(cond.value);
            const count = facetCounts.conditionCounts[cond.value] || 0;
            return (
              <button
                key={cond.value}
                type="button"
                onClick={() => onToggleCondition(cond.value)}
                className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[11px] font-medium border transition-colors cursor-pointer ${
                  active
                    ? "bg-[#6c5ce7]/20 border-[#6c5ce7] text-[var(--text-primary)]"
                    : "bg-[var(--bg-primary)] hover:bg-[var(--surface-hover)] border-[var(--surface-border)] text-[var(--text-secondary)]"
                }`}
              >
                <span>{cond.label}</span>
                <span className="font-mono tabular-nums text-[10px] opacity-70">
                  {count}
                </span>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );

  return (
    <div className="shrink-0 z-10 border-b border-[var(--surface-border)] bg-[var(--bg-secondary)]/85 backdrop-blur-xl">
      {/* Linha Principal Desktop / Notebook (>= lg) */}
      <div className="hidden lg:flex flex-wrap items-center justify-between gap-x-2.5 gap-y-2 px-4 xl:px-5 py-2.5 min-h-[54px]">
        {/* Esquerda + Centro: Escopo + Busca + Primários + Mais Filtros */}
        <div className="flex flex-wrap items-center gap-2 min-w-0 flex-1">
          <FilterSegmentedControl
            value={filters.scope}
            onChange={onSetScope}
            options={scopeOptions}
            ariaLabel="Alternar entre Minhas Solicitações e Todas"
          />

          {/* Busca Rápida */}
          <div className="relative flex items-center min-w-[135px] flex-1 max-w-[220px]">
            <Search
              size={13}
              className="absolute left-2.5 text-[var(--text-muted)] pointer-events-none"
            />
            <input
              ref={searchInputRef}
              type="text"
              value={filters.search}
              onChange={(e) => onSetSearch(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Escape" && filters.search) {
                  e.stopPropagation();
                  onSetSearch("");
                }
              }}
              placeholder="Buscar título, Pix, #ID..."
              aria-label="Buscar solicitações no Kanban"
              className="h-[34px] w-full pl-8 pr-8 2xl:pr-11 rounded-lg bg-[var(--bg-primary)] border border-[var(--surface-border)] text-xs text-[var(--text-primary)] placeholder:text-[var(--text-muted)] focus:outline-none focus:border-[#6c5ce7] focus:ring-2 focus:ring-[#6c5ce7]/20 transition-all duration-150"
            />
            {filters.search ? (
              <button
                type="button"
                onClick={() => onSetSearch("")}
                aria-label="Limpar busca"
                className="absolute right-2 p-0.5 rounded text-[var(--text-muted)] hover:text-[var(--text-primary)] cursor-pointer"
              >
                <X size={12} />
              </button>
            ) : (
              <kbd className="hidden 2xl:inline-flex items-center justify-center absolute right-2 px-1.5 py-0.5 rounded bg-[var(--bg-card)] border border-[var(--surface-border)] text-[9px] font-mono text-[var(--text-muted)] pointer-events-none">
                ⌘K
              </kbd>
            )}
          </div>

          <FilterMonthPopover
            periodMode={filters.periodMode}
            month={filters.month}
            onChange={onSetPeriod}
            monthCounts={facetCounts.monthCounts}
          />

          <FilterSelectPopover
            value={filters.category}
            onChange={onSetCategory}
            options={categoryOptions}
            placeholder="Categorias"
            allLabel="Todas categorias"
            icon={<Tag size={13} />}
            searchPlaceholder="Buscar categoria..."
            maxTriggerWidthClass="max-w-[115px] 2xl:max-w-[155px]"
            popoverWidth={280}
          />

          {/* Popover Mais Filtros */}
          <button
            ref={moreTriggerRef}
            type="button"
            aria-haspopup="dialog"
            aria-expanded={moreOpen}
            onClick={() => setMoreOpen((v) => !v)}
            className={`inline-flex items-center gap-1.5 h-[34px] px-2.5 rounded-lg text-xs font-medium border whitespace-nowrap transition-all cursor-pointer shrink-0 ${
              moreOpen
                ? "bg-[var(--bg-card)] border-[#6c5ce7] ring-2 ring-[#6c5ce7]/20 text-[var(--text-primary)]"
                : advancedFiltersCount > 0
                ? "bg-[#6c5ce7]/12 border-[#6c5ce7]/60 text-[var(--text-primary)]"
                : "bg-[var(--bg-primary)] hover:bg-[var(--bg-card)] border-[var(--surface-border)] text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
            }`}
          >
            <SlidersHorizontal
              size={13}
              className={advancedFiltersCount > 0 ? "text-[#a29bfe]" : "text-[var(--text-muted)]"}
            />
            <span>Filtros</span>
            {advancedFiltersCount > 0 && (
              <span className="inline-flex items-center justify-center min-w-[17px] h-[17px] px-1 rounded-full bg-[#6c5ce7] text-white text-[10px] font-mono font-bold tabular-nums">
                {advancedFiltersCount}
              </span>
            )}
          </button>

          <FloatingPopover
            open={moreOpen}
            onClose={() => setMoreOpen(false)}
            triggerRef={moreTriggerRef}
            popoverRef={morePopoverRef}
            width={360}
          >
            <div className="p-3.5">{advancedFiltersContent}</div>
          </FloatingPopover>

          {activeFiltersCount > 0 && (
            <button
              type="button"
              onClick={onClearAllFilters}
              title="Limpar todos os filtros ativos"
              className="inline-flex items-center gap-1 h-[34px] px-2 rounded-lg text-xs text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--surface-hover)] whitespace-nowrap transition-colors cursor-pointer shrink-0"
            >
              <RotateCcw size={12} />
              <span className="hidden 2xl:inline">Limpar</span>
            </button>
          )}
        </div>

        {/* Direita: Telemetria + Utilitários Kanban + CTA Ember */}
        <div className="flex items-center gap-1.5 shrink-0 ml-auto">
          {/* Cápsula de Telemetria */}
          <div
            className="flex items-center gap-2 h-[34px] px-2.5 rounded-lg bg-[var(--bg-primary)]/80 border border-[var(--surface-border)] whitespace-nowrap"
            title={`${visibleCardsCount} de ${totalCardsCount} solicitações · Volume filtrado: ${formattedVolume}`}
          >
            <div className="flex items-center gap-1.5 text-xs text-[var(--text-muted)]">
              <Layers size={13} />
              <span className="font-mono tabular-nums font-semibold text-[var(--text-primary)]">
                {visibleCardsCount}
              </span>
              {visibleCardsCount !== totalCardsCount && (
                <span className="font-mono tabular-nums text-[11px]">
                  /{totalCardsCount}
                </span>
              )}
            </div>
            <div className="w-px h-3.5 bg-[var(--surface-border)]" />
            <div className="flex items-center gap-1.5 text-xs">
              <TrendingUp size={13} className="text-[var(--text-muted)] hidden 2xl:inline" />
              <span className="font-mono tabular-nums font-bold text-[var(--text-primary)]">
                {formattedVolume}
              </span>
            </div>
          </div>

          {emptyColumnsCount > 0 && (
            <button
              type="button"
              onClick={onToggleHideEmptyColumns}
              title={
                hideEmptyColumns
                  ? "Mostrar colunas sem solicitações"
                  : `Ocultar ${emptyColumnsCount} colunas vazias`
              }
              className={`inline-flex items-center gap-1.5 h-[34px] px-2.5 rounded-lg text-xs font-medium border whitespace-nowrap transition-colors cursor-pointer ${
                hideEmptyColumns
                  ? "bg-emerald-500/12 border-emerald-500/40 text-emerald-400"
                  : "bg-[var(--bg-primary)] hover:bg-[var(--bg-card)] border-[var(--surface-border)] text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
              }`}
            >
              {hideEmptyColumns ? <Eye size={13} /> : <EyeOff size={13} />}
              <span className="hidden 2xl:inline">
                {hideEmptyColumns ? `Vazias (${emptyColumnsCount})` : `Ocultar (${emptyColumnsCount})`}
              </span>
            </button>
          )}

          <button
            type="button"
            onClick={onOpenTrash}
            title="Abrir lixeira"
            className="inline-flex items-center gap-1.5 h-[34px] px-2.5 rounded-lg text-xs font-medium bg-[var(--bg-primary)] hover:bg-rose-950/35 border border-[var(--surface-border)] hover:border-rose-500/40 text-[var(--text-secondary)] hover:text-rose-400 whitespace-nowrap transition-colors cursor-pointer"
          >
            <Trash2 size={13} className="text-rose-400" />
            <span className="hidden 2xl:inline">Lixeira</span>
          </button>

          <MagnetButton
            onClick={onOpenNewRequest}
            style={{
              background:
                "var(--gradient-ember-cta, linear-gradient(30deg, rgb(253, 137, 37), rgb(255, 12, 0)))",
            }}
            className="force-white flex items-center justify-center gap-1.5 h-[34px] px-3.5 text-xs font-semibold tracking-wide whitespace-nowrap rounded-lg text-white shadow-[0_4px_14px_rgba(255,73,44,0.28)] hover:shadow-[0_0_20px_rgba(253,137,37,0.4)] transition-all cursor-pointer active:scale-95"
          >
            <Plus size={14} strokeWidth={2.75} />
            <span>Nova Solicitação</span>
          </MagnetButton>
        </div>
      </div>

      {/* Layout Compacto Mobile / Tablet (< lg) */}
      <div className="flex lg:hidden flex-col gap-2 px-3.5 py-2.5">
        <div className="flex items-center justify-between gap-2">
          <FilterSegmentedControl
            value={filters.scope}
            onChange={onSetScope}
            options={scopeOptions}
            ariaLabel="Alternar entre Minhas Solicitações e Todas"
          />

          <MagnetButton
            onClick={onOpenNewRequest}
            style={{
              background:
                "var(--gradient-ember-cta, linear-gradient(30deg, rgb(253, 137, 37), rgb(255, 12, 0)))",
            }}
            className="force-white flex items-center justify-center gap-1 h-[34px] px-3 text-xs font-semibold rounded-lg text-white shadow-[0_4px_14px_rgba(255,73,44,0.28)] cursor-pointer shrink-0"
          >
            <Plus size={14} strokeWidth={2.75} />
            <span>Nova</span>
          </MagnetButton>
        </div>

        <div className="flex items-center gap-2">
          <div className="relative flex-1 flex items-center">
            <Search
              size={13}
              className="absolute left-2.5 text-[var(--text-muted)] pointer-events-none"
            />
            <input
              type="text"
              value={filters.search}
              onChange={(e) => onSetSearch(e.target.value)}
              placeholder="Buscar título, Pix, #ID..."
              className="w-full h-[34px] pl-8 pr-7 rounded-lg bg-[var(--bg-primary)] border border-[var(--surface-border)] text-xs text-[var(--text-primary)] placeholder:text-[var(--text-muted)] focus:outline-none focus:border-[#6c5ce7]"
            />
            {filters.search && (
              <button
                type="button"
                onClick={() => onSetSearch("")}
                className="absolute right-2 text-[var(--text-muted)] hover:text-[var(--text-primary)] cursor-pointer"
              >
                <X size={12} />
              </button>
            )}
          </div>

          <button
            type="button"
            onClick={() => setMobileDrawerOpen(true)}
            className={`inline-flex items-center gap-1.5 h-[34px] px-3 rounded-lg text-xs font-medium border cursor-pointer shrink-0 ${
              activeFiltersCount > 0
                ? "bg-[#6c5ce7]/15 border-[#6c5ce7]/60 text-[var(--text-primary)]"
                : "bg-[var(--bg-primary)] border-[var(--surface-border)] text-[var(--text-secondary)]"
            }`}
          >
            <SlidersHorizontal size={13} />
            <span>Filtros</span>
            {activeFiltersCount > 0 && (
              <span className="inline-flex items-center justify-center min-w-[16px] h-[16px] px-1 rounded-full bg-[#6c5ce7] text-white text-[10px] font-mono font-bold">
                {activeFiltersCount}
              </span>
            )}
          </button>
        </div>
      </div>

      {/* Mobile Bottom Sheet Drawer */}
      {mobileDrawerOpen && (
        <div
          className="fixed inset-0 z-50 lg:hidden flex flex-col justify-end bg-black/75 backdrop-blur-xs"
          onClick={() => setMobileDrawerOpen(false)}
        >
          <div
            className="w-full max-h-[85vh] flex flex-col rounded-t-2xl bg-[var(--bg-card)] border-t border-[var(--surface-border)] shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between px-4 py-3 border-b border-[var(--surface-border)]">
              <span className="text-sm font-semibold text-[var(--text-primary)]">
                Filtros do Kanban
              </span>
              <button
                type="button"
                onClick={() => setMobileDrawerOpen(false)}
                className="p-1.5 rounded-lg text-[var(--text-muted)] hover:text-[var(--text-primary)] cursor-pointer"
              >
                <X size={16} />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto atelier-scrollbar p-4 flex flex-col gap-4">
              <div className="grid grid-cols-1 gap-2.5">
                <div className="flex flex-col gap-1">
                  <label className="text-[10px] font-semibold uppercase tracking-wider text-[var(--text-muted)]">
                    Período & Vencimento
                  </label>
                  <FilterMonthPopover
                    periodMode={filters.periodMode}
                    month={filters.month}
                    onChange={onSetPeriod}
                    monthCounts={facetCounts.monthCounts}
                  />
                </div>
                <div className="flex flex-col gap-1">
                  <label className="text-[10px] font-semibold uppercase tracking-wider text-[var(--text-muted)]">
                    Categoria
                  </label>
                  <FilterSelectPopover
                    value={filters.category}
                    onChange={onSetCategory}
                    options={categoryOptions}
                    placeholder="Todas categorias"
                    allLabel="Todas categorias"
                    icon={<Tag size={13} />}
                    maxTriggerWidthClass="max-w-[260px]"
                  />
                </div>
              </div>

              {advancedFiltersContent}

              <div className="pt-2 border-t border-[var(--surface-border)] flex items-center gap-2">
                {emptyColumnsCount > 0 && (
                  <button
                    type="button"
                    onClick={onToggleHideEmptyColumns}
                    className="flex-1 h-[36px] inline-flex items-center justify-center gap-1.5 rounded-lg text-xs font-medium bg-[var(--bg-primary)] border border-[var(--surface-border)] text-[var(--text-secondary)]"
                  >
                    {hideEmptyColumns ? <Eye size={13} /> : <EyeOff size={13} />}
                    <span>
                      {hideEmptyColumns ? "Mostrar vazias" : `Ocultar vazias (${emptyColumnsCount})`}
                    </span>
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => {
                    setMobileDrawerOpen(false);
                    onOpenTrash();
                  }}
                  className="flex-1 h-[36px] inline-flex items-center justify-center gap-1.5 rounded-lg text-xs font-medium bg-[var(--bg-primary)] border border-[var(--surface-border)] text-rose-400"
                >
                  <Trash2 size={13} />
                  <span>Lixeira</span>
                </button>
              </div>
            </div>

            <div className="p-3.5 border-t border-[var(--surface-border)] flex items-center gap-2.5 bg-[var(--bg-secondary)]">
              <button
                type="button"
                onClick={onClearAllFilters}
                className="px-4 h-[38px] rounded-lg text-xs font-medium border border-[var(--surface-border)] text-[var(--text-secondary)]"
              >
                Limpar
              </button>
              <button
                type="button"
                onClick={() => setMobileDrawerOpen(false)}
                className="flex-1 h-[38px] rounded-lg text-xs font-semibold bg-[#6c5ce7] text-white"
              >
                Ver {visibleCardsCount} solicitações
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Faixa Contextual de Chips Ativos & Telemetria de Urgentes Ocultos */}
      {(activeFiltersCount > 0 || (hasNonDefaultFilter && facetCounts.hiddenUrgentCount > 0)) && (
        <div className="flex flex-wrap items-center justify-between gap-2 px-4 xl:px-6 py-1.5 border-t border-[var(--surface-border)]/70 bg-[var(--bg-primary)]/45 text-[11px]">
          <div className="flex flex-wrap items-center gap-1.5">
            {activeChips.map((chip) => (
              <span
                key={chip.id}
                className="inline-flex items-center gap-1 pl-2 pr-1 py-0.5 rounded-md bg-[var(--bg-card)] border border-[var(--surface-border)] text-[var(--text-secondary)]"
              >
                <span>{chip.label}</span>
                <button
                  type="button"
                  onClick={chip.onRemove}
                  aria-label={`Remover filtro ${chip.label}`}
                  className="p-0.5 rounded hover:bg-white/10 text-[var(--text-muted)] hover:text-[var(--text-primary)] cursor-pointer"
                >
                  <X size={11} />
                </button>
              </span>
            ))}

            {activeFiltersCount > 0 && (
              <button
                type="button"
                onClick={onClearAllFilters}
                className="px-1.5 py-0.5 text-[11px] text-[var(--text-muted)] hover:text-[var(--text-primary)] underline-offset-2 hover:underline cursor-pointer"
              >
                Limpar tudo
              </button>
            )}
          </div>

          <div className="flex items-center gap-3">
            {hasNonDefaultFilter && facetCounts.hiddenUrgentCount > 0 && (
              <button
                type="button"
                onClick={() => {
                  onClearAllFilters();
                  onSetScope("ALL");
                }}
                title="Existem solicitações vencendo hoje/vencidas ou aguardando ajuste fora do filtro atual"
                className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md bg-amber-500/10 border border-amber-500/35 text-amber-400 hover:bg-amber-500/20 transition-colors cursor-pointer"
              >
                <AlertTriangle size={12} />
                <span className="font-medium">
                  {facetCounts.hiddenUrgentCount}{" "}
                  {facetCounts.hiddenUrgentCount === 1
                    ? "urgente oculta pelo filtro"
                    : "urgentes ocultas pelo filtro"}
                </span>
              </button>
            )}
            <span className="text-[var(--text-muted)] font-mono tabular-nums">
              {visibleCardsCount} de {totalCardsCount}
            </span>
          </div>
        </div>
      )}
    </div>
  );
}

