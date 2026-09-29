const fs = require("fs");
const path = require("path");
const filePath = path.join(__dirname, "src/components/KanbanColumn.tsx");
let content = fs.readFileSync(filePath, "utf-8");

// Add props
content = content.replace(
  'onCardClick: (card: PaymentRequest) => void;',
  'onCardClick: (card: PaymentRequest) => void;\n  selectable?: boolean;\n  selectedIds?: Set<string>;\n  onToggleSelect?: (id: string) => void;\n  onSelectAll?: (ids: string[]) => void;'
);
content = content.replace(
  'export default function KanbanColumn({ config, cards, onCardClick }: KanbanColumnProps) {',
  'export default function KanbanColumn({ config, cards, onCardClick, selectable = false, selectedIds = new Set(), onToggleSelect, onSelectAll }: KanbanColumnProps) {'
);

// Add "Selecionar Todos" in header
const headerReplace = `      <div
        className="flex items-center justify-between px-4 py-3"
        style={{
          borderBottom: "1px solid var(--surface-border)",
        }}
      >
        <div className="flex items-center gap-2.5">
          {selectable && cards.length > 0 && (
            <input 
              type="checkbox" 
              className="w-4 h-4 rounded border-gray-600 bg-gray-900 checked:bg-brand-primary cursor-pointer accent-brand-primary"
              checked={cards.every(c => selectedIds.has(c.id))}
              onChange={(e) => {
                if (onSelectAll) {
                  if (e.target.checked) onSelectAll(cards.map(c => c.id));
                  else onSelectAll([]);
                }
              }}
              title="Selecionar todos nesta coluna"
            />
          )}
          {/* Indicador de cor */}`;

content = content.replace(
  `      <div
        className="flex items-center justify-between px-4 py-3"
        style={{
          borderBottom: "1px solid var(--surface-border)",
        }}
      >
        <div className="flex items-center gap-2.5">
          {/* Indicador de cor */}`,
  headerReplace
);

// Add Checkbox in Card Title
const titleReplace = `                {/* Ttulo */}
                <div className="flex items-start justify-between gap-2">
                  <h3
                    className="text-sm font-semibold line-clamp-2 flex-1"
                    style={{ color: "var(--text-primary)" }}
                  >
                    {card.title}
                  </h3>
                  {selectable && (
                    <div onClick={(e) => e.stopPropagation()}>
                      <input 
                        type="checkbox" 
                        className="w-4 h-4 rounded border-gray-600 bg-gray-900 checked:bg-brand-primary cursor-pointer accent-brand-primary"
                        checked={selectedIds.has(card.id)}
                        onChange={() => onToggleSelect && onToggleSelect(card.id)}
                      />
                    </div>
                  )}
                </div>`;

content = content.replace(
  `                {/* Ttulo */}
                <h3
                  className="text-sm font-semibold truncate"
                  style={{ color: "var(--text-primary)" }}
                >
                  {card.title}
                </h3>`,
  titleReplace
);

fs.writeFileSync(filePath, content, "utf-8");
console.log("Patched KanbanColumn");
