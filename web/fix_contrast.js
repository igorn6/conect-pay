const fs = require('fs');
const path = require('path');
const file = path.join(process.cwd(), "src/components/CardDetailModal.tsx");
let code = fs.readFileSync(file, 'utf8');

// Replace hardcoded dark classes in the splits map with CSS variables

// 1. Container of each split: bg-gray-900/50 -> var(--bg-primary)
code = code.replace(/className="p-3 bg-gray-900\/50 rounded-lg border border-gray-700\/50 relative"/g, 'className="p-3 rounded-lg border relative" style={{ backgroundColor: "var(--bg-primary)", borderColor: "var(--surface-border)" }}');

// 2. Chave Pix container: bg-gray-800 border-gray-700 -> var(--surface-hover) var(--surface-border)
code = code.replace(/className="flex items-center justify-between gap-2 bg-gray-800 px-2\.5 py-1\.5 rounded border border-gray-700 group"/g, 'className="flex items-center justify-between gap-2 px-2.5 py-1.5 rounded border group" style={{ backgroundColor: "var(--surface-hover)", borderColor: "var(--surface-border)" }}');

// 3. Text colors: text-gray-200 -> var(--text-primary)
code = code.replace(/className="text-xs font-medium text-gray-200 truncate"/g, 'className="text-xs font-medium truncate" style={{ color: "var(--text-primary)" }}');
code = code.replace(/className="text-xs font-semibold text-gray-200 block truncate"/g, 'className="text-xs font-semibold block truncate" style={{ color: "var(--text-primary)" }}');

// 4. Text colors for labels: text-gray-500 -> var(--text-secondary)
code = code.replace(/className="text-\[10px\] uppercase font-bold text-gray-500 block mb-0\.5"/g, 'className="text-[10px] uppercase font-bold block mb-0.5" style={{ color: "var(--text-secondary)" }}');

// 5. Button copy colors: text-gray-400 hover:text-white hover:bg-gray-700 -> use style
code = code.replace(/className="text-gray-400 hover:text-white p-1 rounded hover:bg-gray-700 transition-colors shrink-0"/g, 'className="p-1 rounded transition-colors shrink-0" style={{ color: "var(--text-secondary)" }} onMouseEnter={(e) => { e.currentTarget.style.color = "var(--text-primary)"; e.currentTarget.style.backgroundColor = "var(--surface-border)" }} onMouseLeave={(e) => { e.currentTarget.style.color = "var(--text-secondary)"; e.currentTarget.style.backgroundColor = "transparent" }}');

fs.writeFileSync(file, code);
console.log("Replaced fixed colors with CSS variables in CardDetailModal.");
