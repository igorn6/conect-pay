const fs = require("fs");
const path = require("path");
const colPath = path.join(__dirname, "src/components/KanbanColumn.tsx");
let colContent = fs.readFileSync(colPath, "utf-8");

const headerNew = `<div 
              onClick={(e) => {
                e.stopPropagation();
                if (onSelectAll) {
                  const allSelected = cards.length > 0 && cards.every(c => selectedIds.has(c.id));
                  if (!allSelected) onSelectAll(cards.map(c => c.id));
                  else onSelectAll([]);
                }
              }}
              title="Selecionar todos nesta coluna"
              className={\`w-5 h-5 flex-shrink-0 rounded-md flex items-center justify-center cursor-pointer transition-all border \${
                cards.every(c => selectedIds.has(c.id)) 
                  ? "bg-emerald-500 border-emerald-500" 
                  : "bg-slate-800/80 border-slate-600 hover:border-emerald-500/50"
              }\`}
            >
              {cards.every(c => selectedIds.has(c.id)) && <Check size={14} className="text-white" strokeWidth={3} />}
            </div>`;

colContent = colContent.replace(/<input[\s\S]*?title="Selecionar todos nesta coluna"[\s\S]*?\/>/, headerNew);

fs.writeFileSync(colPath, colContent, "utf-8");
console.log("Patched header checkbox");
