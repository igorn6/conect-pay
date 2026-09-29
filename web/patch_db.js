const fs = require("fs");
const path = require("path");
const dbPath = path.join(__dirname, "src/types/database.ts");
let dbContent = fs.readFileSync(dbPath, "utf-8");

dbContent = dbContent.replace(/name: string;\s*role: UserRole;/, "name: string;\n  email?: string;\n  role: UserRole;");
fs.writeFileSync(dbPath, dbContent, "utf-8");
console.log("Patched types");
