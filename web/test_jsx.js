const fs = require("fs");
const path = require("path");
const filePath = path.join(__dirname, "src/components/NewRequestModal.tsx");
let content = fs.readFileSync(filePath, "utf-8");
console.log("Has JSX?", content.includes("Observações *"));
