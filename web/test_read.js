const fs = require("fs");
const path = require("path");

const filePath = path.join(__dirname, "src/components/NewRequestModal.tsx");
console.log("Exists?", fs.existsSync(filePath));
let content = fs.readFileSync(filePath, "utf-8");
console.log("Length:", content.length);
console.log("Has EX?", content.includes("Ex.: Material"));
