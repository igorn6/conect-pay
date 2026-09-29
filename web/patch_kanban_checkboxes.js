const fs = require("fs");
const path = require("path");
const colPath = path.join(__dirname, "src/components/KanbanColumn.tsx");
let colContent = fs.readFileSync(colPath, "utf-8");

// Add Check to lucide-react imports if not there
if (!colContent.includes("Check,")) {
  colContent = colContent.replace('import { Inbox, User } from "lucide-react";', 'import { Inbox, User, Check } from "lucide-react";');
}

// Replace header checkbox
const headerOld = `<input \n                type="checkbox" \n                className="w-4 h-4 rounded border-gray-600 bg-gray-900 checked:bg-brand-primary cursor-pointer accent-brand-primary"\n                checked={cards.every(c => selectedIds.has(c.id))}\n                onChange={(e) => {\n                  if (onSelectAll) {\n                    if (e.target.checked) onSelectAll(cards.map(c => c.id));\n                    else onSelectAll([]);\n                  }\n                }}\n              />`;

const headerNew = `<div 
                onClick={(e) => {
                  e.stopPropagation();
                  if (onSelectAll) {
                    const allSelected = cards.length > 0 && cards.every(c => selectedIds.has(c.id));
                    if (!allSelected) onSelectAll(cards.map(c => c.id));
                    else onSelectAll([]);
                  }
                }}
                className={\`w-5 h-5 flex-shrink-0 rounded-md flex items-center justify-center cursor-pointer transition-all border \${
                  cards.every(c => selectedIds.has(c.id)) 
                    ? "bg-emerald-500 border-emerald-500" 
                    : "bg-slate-800/80 border-slate-600 hover:border-emerald-500/50"
                }\`}
              >
                {cards.every(c => selectedIds.has(c.id)) && <Check size={14} className="text-white" strokeWidth={3} />}
              </div>`;

// Find header old with regex because spacing might differ
colContent = colContent.replace(/<input\s+type="checkbox"\s+className="w-4 h-4[^>]+onChange=\{\(e\) => \{[^>]+\]\);\s*\}\s*\}\}\s*\/>/m, headerNew);

// Replace card checkbox
const cardOld = `<input \n                        type="checkbox" \n                        className="w-4 h-4 rounded border-gray-600 bg-gray-900 checked:bg-brand-primary cursor-pointer accent-brand-primary"\n                        checked={selectedIds.has(card.id)}\n                        onChange={() => onToggleSelect && onToggleSelect(card.id)}\n                      />`;

const cardNew = `<div 
                        onClick={(e) => {
                          e.stopPropagation();
                          if (onToggleSelect) onToggleSelect(card.id);
                        }}
                        className={\`w-5 h-5 flex-shrink-0 rounded-md flex items-center justify-center cursor-pointer transition-all border \${
                          selectedIds.has(card.id) 
                            ? "bg-emerald-500 border-emerald-500" 
                            : "bg-slate-800/80 border-slate-600 hover:border-emerald-500/50"
                        }\`}
                      >
                        {selectedIds.has(card.id) && <Check size={14} className="text-white" strokeWidth={3} />}
                      </div>`;

colContent = colContent.replace(/<input\s+type="checkbox"\s+className="w-4 h-4[^>]+onChange=\{\(\) => onToggleSelect && onToggleSelect\(card\.id\)\}\s*\/>/m, cardNew);


fs.writeFileSync(colPath, colContent, "utf-8");
console.log("Patched Kanban checkboxes");
