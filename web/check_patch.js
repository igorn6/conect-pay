const fs = require("fs");
const path = require("path");
const filePath = path.join(__dirname, "src/components/KanbanColumn.tsx");
let content = fs.readFileSync(filePath, "utf-8");
console.log("Checkbox inserted?", content.includes("type=\"checkbox\""));
