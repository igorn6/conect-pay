const fs = require('fs');
const path = require('path');
const file = path.join(process.cwd(), "src/components/CardDetailModal.tsx");
let code = fs.readFileSync(file, 'utf8');

const invoiceMatch = code.match(/invoiceUrl \? \([\s\S]*?\)\s*:\s*\([\s\S]*?\)/);
if (invoiceMatch) console.log("--- INVOICE UI ---\n" + invoiceMatch[0]);

const paymentMatch = code.match(/paymentProofUrl \? \([\s\S]*?\)\s*:\s*\([\s\S]*?\)/);
if (paymentMatch) console.log("--- PAYMENT UI ---\n" + paymentMatch[0]);
