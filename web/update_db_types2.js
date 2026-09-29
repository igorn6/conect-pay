const fs = require('fs');
const path = require('path');
const dbPath = path.join(process.cwd(), "src/types/database.ts");
let dbCode = fs.readFileSync(dbPath, "utf-8");

if (!dbCode.includes('pix_name?: string | null;')) {
  dbCode = dbCode.replace(
    '  pix_key: string | null;',
    '  pix_key: string | null;\n  pix_name?: string | null;\n  payment_type?: string | null;\n  caju_phone?: string | null;'
  );
  fs.writeFileSync(dbPath, dbCode);
  console.log("Database types updated with missing optional fields.");
}
