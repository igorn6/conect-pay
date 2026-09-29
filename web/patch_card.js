const fs = require("fs");
const path = require("path");
const filePath = path.join(__dirname, "src/components/KanbanColumn.tsx");
let content = fs.readFileSync(filePath, "utf-8");

const newCardHeader = `<div className="flex items-start justify-between gap-2">
                <h3
                  className="text-sm font-semibold truncate flex-1"
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
  /<h3[\s\S]*?className="text-sm font-semibold truncate"[\s\S]*?\{card\.title\}[\s\S]*?<\/h3>/,
  newCardHeader
);

fs.writeFileSync(filePath, content, "utf-8");
console.log("Patched Card Header!");
