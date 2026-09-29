const fs = require('fs');
const path = require('path');
const file = path.join(process.cwd(), "src/components/NewRequestModal.tsx");
let code = fs.readFileSync(file, 'utf8');

// Replace hardcoded dark mode colors in NewRequestModal splits loop
// 1. Container: bg-[#14151a] border-gray-800 -> var(--bg-primary), var(--surface-border)
code = code.replace(/className="p-4 bg-\[#14151a\] rounded-lg border border-gray-800 space-y-3 relative"/g, 'className="p-4 rounded-lg border space-y-3 relative" style={{ backgroundColor: "var(--bg-primary)", borderColor: "var(--surface-border)" }}');

// 2. Selects and Inputs: bg-gray-900 border-gray-700 text-white -> use inputStyle
code = code.replace(/className="w-full px-3 py-2 bg-gray-900 border border-gray-700 rounded text-xs text-white"/g, 'className="w-full px-3 py-2 rounded text-xs outline-none" style={inputStyle}');

// 3. Labels: text-gray-500 -> var(--text-secondary)
code = code.replace(/className="block text-\[10px\] font-bold text-gray-500 uppercase mb-1"/g, 'className="block text-[10px] font-bold uppercase mb-1" style={{ color: "var(--text-secondary)" }}');

fs.writeFileSync(file, code);
console.log("Replaced fixed colors in NewRequestModal.");
