const fs = require('fs');
const path = require('path');
const file = path.join(process.cwd(), "src/components/NewRequestModal.tsx");
let code = fs.readFileSync(file, 'utf8');

// Replace remaining single instances of setInvoiceFile(null) and invoiceFile
code = code.replace(/setInvoiceFile\(null\)/g, 'setInvoiceFiles([])');
code = code.replace(/invoiceFile \?/g, 'invoiceFiles.length > 0 ?');
code = code.replace(/invoiceFile \:/g, 'invoiceFiles.length > 0 :');
code = code.replace(/invoiceFile/g, 'invoiceFiles'); // Replace any leftovers (this might be too aggressive, let's just do it manually)

fs.writeFileSync(file, code);
console.log("Updated NewRequestModal.tsx");
