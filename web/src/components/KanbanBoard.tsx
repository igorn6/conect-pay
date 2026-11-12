import { useState, useMemo } from "react";
import { Trash2, EyeOff, Eye, SearchX, RotateCcw } from "lucide-react";
import { KANBAN_COLUMNS } from "@/constants/kanban";
import type { PaymentRequest, Category } from "@/types/database";
import KanbanColumn from "./KanbanColumn";

interface KanbanBoardProps {
  cards: PaymentRequest[];
  onCardClick: (card: PaymentRequest) => void;
  onOpenTrash: () => void;
  profilesMap?: Record<string, string>;
  selectable?: boolean;
  selectedIds?: Set<string>;
  onToggleSelect?: (id: string) => void;
  onSelectAllInColumn?: (ids: string[], isAdding: boolean) => void;
  categories?: Category[];
  onUpdateCategory?: (cardId: string, newCategory: string) => void;
  userRole?: string;
  onEditCard?: (card: PaymentRequest) => void;
  hideEmpty?: boolean;
  hasActiveFilters?: boolean;
  totalCardsCount?: number;
  isMineScope?: boolean;
  allScopeLabel?: string;
  onClearFilters?: () => void;
  onShowAllScope?: () => void;
}

/**
 * Board completo do Kanban.
 * Distribui os cards nas colunas de acordo com o status.
 */
export default function KanbanBoard({
  cards,
  onCardClick,
  onOpenTrash,
  selectable = false,
  selectedIds = new Set(),
  onToggleSelect,
  onSelectAllInColumn,
  profilesMap = {},
  categories,
  onUpdateCategory,
  userRole,
  onEditCard,
  hideEmpty: controlledHideEmpty,
  hasActiveFilters = false,
  totalCardsCount,
  isMineScope = false,
  allScopeLabel = "Todas",
  onClearFilters,
  onShowAllScope,
}: KanbanBoardProps) {
  // Agrupa os cards por status uma única vez (evita filtrar 8x a cada render)
  const cardsByStatus = useMemo(() => {
    const map: Record<string, PaymentRequest[]> = {};
    for (const c of cards) (map[c.status] ||= []).push(c);
    return map;
  }, [cards]);
  const [internalHideEmpty, setInternalHideEmpty] = useState(false);
  const isControlled = typeof controlledHideEmpty === "boolean";
  const hideEmpty = isControlled ? controlledHideEmpty : internalHideEmpty;
  const emptyCount = KANBAN_COLUMNS.filter((c) => !(cardsByStatus[c.key]?.length)).length;
  const showEmptyFilteredState = (totalCardsCount ?? cards.length) > 0 && cards.length === 0;

  return (
    <div className="flex flex-col flex-1 min-h-0 overflow-hidden">
      {/* Sub-barra legada apenas quando o pai não controla hideEmpty */}
      {!isControlled && (
        <div className="flex items-center justify-end gap-2.5 px-6 py-2 shrink-0">
          {emptyCount > 0 && (
            <button
              onClick={() => setInternalHideEmpty((v) => !v)}
              title={hideEmpty ? "Mostrar colunas sem solicitações" : "Ocultar colunas sem solicitações"}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-xl bg-slate-900/60 hover:bg-slate-800/80 text-slate-300 hover:text-white transition-all border border-white/10 hover:border-white/20 shadow-xs backdrop-blur-md cursor-pointer"
            >
              {hideEmpty ? <Eye size={13} className="text-emerald-400" /> : <EyeOff size={13} className="text-slate-400" />}
              <span>{hideEmpty ? `Colunas vazias (${emptyCount})` : `Ocultar vazias (${emptyCount})`}</span>
            </button>
          )}
          <button
            onClick={onOpenTrash}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-xl bg-slate-900/60 hover:bg-rose-950/40 text-slate-300 hover:text-rose-300 transition-all border border-white/10 hover:border-rose-500/30 shadow-xs backdrop-blur-md cursor-pointer"
          >
            <Trash2 size={13} className="text-rose-400" />
            <span>Lixeira</span>
          </button>
        </div>
      )}

      {showEmptyFilteredState ? (
        <div className="flex-1 min-h-0 flex items-center justify-center p-6">
          <div className="max-w-md w-full rounded-2xl bg-[var(--bg-card)] border border-[var(--surface-border)] p-6 text-center shadow-[0_16px_40px_rgba(0,0,0,0.4)]">
            <div className="w-11 h-11 rounded-xl bg-[#6c5ce7]/15 border border-[#6c5ce7]/35 text-[#a29bfe] flex items-center justify-center mx-auto mb-3">
              <SearchX size={20} />
            </div>
            <h3 className="text-sm font-semibold text-[var(--text-primary)] mb-1">
              Nenhuma solicitação corresponde aos filtros
            </h3>
            <p className="text-xs text-[var(--text-muted)] leading-relaxed mb-4">
              {isMineScope
                ? `Nenhuma das suas solicitações bate com os critérios atuais. Existem ${totalCardsCount} no total.`
                : `Os filtros atuais ocultaram todas as ${totalCardsCount} solicitações disponíveis.`}
            </p>
            <div className="flex items-center justify-center gap-2 flex-wrap">
              {hasActiveFilters && onClearFilters && (
                <button
                  type="button"
                  onClick={onClearFilters}
                  className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-xs font-medium bg-[var(--bg-primary)] hover:bg-[var(--surface-hover)] border border-[var(--surface-border)] text-[var(--text-primary)] transition-colors cursor-pointer"
                >
                  <RotateCcw size={13} />
                  <span>Limpar filtros</span>
                </button>
              )}
              {isMineScope && onShowAllScope && (
                <button
                  type="button"
                  onClick={onShowAllScope}
                  className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-xs font-semibold bg-[#6c5ce7] hover:bg-[#5b4bc4] text-white transition-colors cursor-pointer"
                >
                  <span>Ver {allScopeLabel} ({totalCardsCount})</span>
                </button>
              )}
            </div>
          </div>
        </div>
      ) : (
        <div className={`flex-1 min-h-0 overflow-x-auto px-6 pb-6 ${isControlled ? "pt-4" : ""}`}>
          <div className="flex gap-4 min-w-max h-full">
            {KANBAN_COLUMNS.map((column) => {
              const colCards = cardsByStatus[column.key] || [];
              if (hideEmpty && colCards.length === 0) return null;
              return (
                <KanbanColumn
                  key={column.key}
                  config={column}
                  cards={colCards}
                  compact={colCards.length === 0}
                  hasActiveFilters={hasActiveFilters || isMineScope}
                  onCardClick={onCardClick}
                  selectable={selectable}
                  selectedIds={selectedIds}
                  onToggleSelect={onToggleSelect}
                  profilesMap={profilesMap}
                  categories={categories}
                  onUpdateCategory={onUpdateCategory}
                  userRole={userRole}
                  onEditCard={onEditCard}
                  onSelectAll={(ids, isAdding) => {
                    if (onSelectAllInColumn) {
                      onSelectAllInColumn(ids, isAdding);
                    }
                  }}
                />
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
