const fs = require('fs');
const path = require('path');
const file = path.join(process.cwd(), "src/components/NewRequestModal.tsx");
let code = fs.readFileSync(file, 'utf8');

code = code.replace('<label className="block text-[10px] font-bold uppercase mb-1" style={{ color: "var(--text-secondary)" }}>Telefone (Caju)</label>', '<label className="block text-[10px] font-bold uppercase mb-1" style={{ color: "var(--text-secondary)" }}>Titular</label>');

fs.writeFileSync(file, code);
console.log("Replaced Telefone with Titular in NewRequestModal");
