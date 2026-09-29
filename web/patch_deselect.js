const fs = require("fs");
const path = require("path");

const colPath = path.join(__dirname, "src/components/KanbanColumn.tsx");
let colContent = fs.readFileSync(colPath, "utf-8");

colContent = colContent.replace(
  'onSelectAll?: (ids: string[]) => void;',
  'onSelectAll?: (ids: string[], isAdding: boolean) => void;'
);

const oldHeaderLogic = `const allSelected = cards.length > 0 && cards.every(c => selectedIds.has(c.id));
                  if (!allSelected) onSelectAll(cards.map(c => c.id));
                  else onSelectAll([]);`;

const newHeaderLogic = `const allSelected = cards.length > 0 && cards.every(c => selectedIds.has(c.id));
                  if (!allSelected) onSelectAll(cards.map(c => c.id), true);
                  else onSelectAll(cards.map(c => c.id), false);`;

colContent = colContent.replace(oldHeaderLogic, newHeaderLogic);

fs.writeFileSync(colPath, colContent, "utf-8");

const boardPath = path.join(__dirname, "src/components/KanbanBoard.tsx");
let boardContent = fs.readFileSync(boardPath, "utf-8");

boardContent = boardContent.replace(
  'onSelectAll={(ids) => {\n                  if (onSelectAllInColumn) {\n                    onSelectAllInColumn(ids, ids.length > 0);\n                  }\n                }}',
  'onSelectAll={(ids, isAdding) => {\n                  if (onSelectAllInColumn) {\n                    onSelectAllInColumn(ids, isAdding);\n                  }\n                }}'
);

fs.writeFileSync(boardPath, boardContent, "utf-8");
console.log("Patched deselection logic");
