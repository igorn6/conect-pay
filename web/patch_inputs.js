const fs = require("fs");
const path = require("path");
const loginPath = path.join(__dirname, "src/app/(auth)/login/page.tsx");
let content = fs.readFileSync(loginPath, "utf-8");

const oldInputClass = 'className="w-full pl-11 pr-4 py-3 rounded-xl text-sm outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 transition-all"';
const newInputClass = 'className="w-full pl-11 pr-4 py-3 rounded-2xl bg-slate-800/50 border border-slate-700/50 text-white text-sm outline-none placeholder:text-slate-500 focus:border-emerald-500 focus:bg-slate-800 focus:ring-1 focus:ring-emerald-500 transition-all"';

content = content.split(oldInputClass).join(newInputClass);

fs.writeFileSync(loginPath, content, "utf-8");
console.log("Patched login inputs");
