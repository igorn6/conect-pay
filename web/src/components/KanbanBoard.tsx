import { useState, useMemo } from "react";
import { Trash2, EyeOff, Eye } from "lucide-react";
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
}: KanbanBoardProps) {
  // Agrupa os cards por status uma única vez (evita filtrar 8x a cada render)
  const cardsByStatus = useMemo(() => {
    const map: Record<string, PaymentRequest[]> = {};
    for (const c of cards) (map[c.status] ||= []).push(c);
    return map;
  }, [cards]);
  const [hideEmpty, setHideEmpty] = useState(false);
  const emptyCount = KANBAN_COLUMNS.filter((c) => !(cardsByStatus[c.key]?.length)).length;

  return (
    <div className="flex flex-col flex-1 min-h-0 overflow-hidden">
      {/* Kanban Header / Actions */}
      <div className="flex items-center justify-end gap-2 px-6 py-2 shrink-0">
        {emptyCount > 0 && (
          <button
            onClick={() => setHideEmpty((v) => !v)}
            title={hideEmpty ? "Mostrar colunas sem solicitações" : "Ocultar colunas sem solicitações"}
            className="flex items-center gap-2 px-3 py-1.5 text-xs font-semibold rounded-lg bg-gray-800/50 hover:bg-gray-700 text-gray-400 hover:text-gray-200 transition-colors border border-gray-800"
          >
            {hideEmpty ? <Eye size={14} /> : <EyeOff size={14} />}
            {hideEmpty ? `Mostrar colunas vazias (${emptyCount})` : `Ocultar colunas vazias (${emptyCount})`}
          </button>
        )}
        <button
          onClick={onOpenTrash}
          className="flex items-center gap-2 px-3 py-1.5 text-xs font-semibold rounded-lg bg-gray-800/50 hover:bg-gray-700 text-gray-400 hover:text-gray-200 transition-colors border border-gray-800"
        >
          <Trash2 size={14} />
          Lixeira
        </button>
      </div>

      <div className="flex-1 min-h-0 overflow-x-auto px-6 pb-6">
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
            onCardClick={onCardClick}
            selectable={selectable}
            selectedIds={selectedIds}
            onToggleSelect={onToggleSelect}
            profilesMap={profilesMap}
            categories={categories}
            onUpdateCategory={onUpdateCategory}
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
    </div>
  );
}
