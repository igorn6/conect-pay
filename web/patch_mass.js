const fs = require("fs");
const path = require("path");
const barPath = path.join(__dirname, "src/components/MassActionBar.tsx");
let content = fs.readFileSync(barPath, "utf-8");

content = content.replace(
  'bg-gray-900 border border-brand-primary/50 shadow-2xl rounded-2xl shadow-brand-primary/20',
  'bg-slate-900 border border-slate-700 shadow-2xl rounded-2xl shadow-black/50'
);

content = content.replace(
  'rounded-full bg-brand-primary text-gray-950 font-bold',
  'rounded-full bg-emerald-500 text-white font-bold'
);

fs.writeFileSync(barPath, content, "utf-8");
console.log("Patched MassActionBar");
