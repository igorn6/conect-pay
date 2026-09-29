const fs = require('fs');
const path = require('path');

const dbPath = path.join(process.cwd(), "src/types/database.ts");
let dbCode = fs.readFileSync(dbPath, "utf-8");

if (!dbCode.includes('export interface SplitPayment')) {
  dbCode = dbCode.replace(
    'export interface PaymentRequest {',
    `export interface SplitPayment {\n  id: string;\n  payment_type: "Pix" | "Caju" | string;\n  amount: number;\n  pix_owner?: string | null;\n  pix_key?: string | null;\n  caju_phone?: string | null;\n}\n\nexport interface PaymentRequest {`
  );
}

if (!dbCode.includes('splits?: SplitPayment[]')) {
  dbCode = dbCode.replace(
    '  notes?: string | null;',
    '  notes?: string | null;\n  splits?: SplitPayment[] | null;'
  );
}

fs.writeFileSync(dbPath, dbCode);
console.log("Database types updated.");
