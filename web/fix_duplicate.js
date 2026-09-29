const fs = require('fs');
const path = require('path');
const dbPath = path.join(process.cwd(), "src/types/database.ts");
let dbCode = fs.readFileSync(dbPath, "utf-8");

dbCode = dbCode.replace(
  '  pix_name?: string | null;\n  payment_type?: string | null;\n  caju_phone?: string | null;',
  '  pix_name?: string | null;\n  caju_phone?: string | null;'
);

fs.writeFileSync(dbPath, dbCode);
console.log("Database duplicate fixed.");
