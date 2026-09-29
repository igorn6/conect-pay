import { Trash2 } from "lucide-react";
import { KANBAN_COLUMNS } from "@/constants/kanban";
import type { PaymentRequest } from "@/types/database";
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
}

/**
 * Board completo do Kanban.
 * Distribui os cards nas colunas de acordo com o status.
 */
export default function KanbanBoard({ cards, onCardClick, onOpenTrash, selectable = false, selectedIds = new Set(), onToggleSelect, onSelectAllInColumn, profilesMap = {} }: KanbanBoardProps) {
  return (
    <div className="flex flex-col flex-1 overflow-hidden">
      {/* Kanban Header / Actions */}
      <div className="flex justify-end px-6 py-2 shrink-0">
        <button
          onClick={onOpenTrash}
          className="flex items-center gap-2 px-3 py-1.5 text-xs font-semibold rounded-lg bg-gray-800/50 hover:bg-gray-700 text-gray-400 hover:text-gray-200 transition-colors border border-gray-800"
        >
          <Trash2 size={14} />
          Lixeira
        </button>
      </div>

      <div className="flex-1 overflow-x-auto px-6 pb-6">
        <div className="flex gap-4 min-w-max h-full">
        {KANBAN_COLUMNS.map((column) => (
                    <KanbanColumn
              key={column.key}
              config={column}
              cards={cards.filter((c) => c.status === column.key)}
              onCardClick={onCardClick}
              selectable={selectable}
              selectedIds={selectedIds}
              onToggleSelect={onToggleSelect}
              profilesMap={profilesMap}
              onSelectAll={(ids, isAdding) => {
                  if (onSelectAllInColumn) {
                    onSelectAllInColumn(ids, isAdding);
                  }
                }}
            />
        ))}
        </div>
      </div>
    </div>
  );
}
