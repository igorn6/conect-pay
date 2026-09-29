const fs = require('fs');
const path = require('path');
const file = path.join(process.cwd(), "src/components/CardDetailModal.tsx");
let code = fs.readFileSync(file, 'utf8');

const match = code.match(/const handlePaymentProofUpload = async.*?};/s);
if (match) {
  console.log(match[0]);
}

const match2 = code.match(/const handleInvoiceUpload = async.*?};/s);
if (match2) {
  console.log("---");
  console.log(match2[0]);
}
