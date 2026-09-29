const fs = require('fs');
const path = require('path');
const file = path.join(process.cwd(), "src/components/CardDetailModal.tsx");
let code = fs.readFileSync(file, 'utf8');

code = code.replace('<span className="text-[10px] uppercase font-bold text-gray-500 block mb-0.5">Telefone (Caju)</span>', '<span className="text-[10px] uppercase font-bold text-gray-500 block mb-0.5">Titular</span>');

fs.writeFileSync(file, code);
console.log("Replaced Telefone with Titular in CardDetailModal");
