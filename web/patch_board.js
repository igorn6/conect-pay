const fs = require("fs");
const path = require("path");
const boardPath = path.join(__dirname, "src/components/KanbanBoard.tsx");
let content = fs.readFileSync(boardPath, "utf-8");

// Use regex to replace the onSelectAll prop inside KanbanBoard
content = content.replace(/onSelectAll=\{\(ids\) => \{\s*if \(onSelectAllInColumn\) \{\s*onSelectAllInColumn\(ids, ids\.length > 0\);\s*\}\s*\}\}/g, 'onSelectAll={(ids, isAdding) => {\n                  if (onSelectAllInColumn) {\n                    onSelectAllInColumn(ids, isAdding);\n                  }\n                }}');

fs.writeFileSync(boardPath, content, "utf-8");
console.log("Patched KanbanBoard onSelectAll prop");
