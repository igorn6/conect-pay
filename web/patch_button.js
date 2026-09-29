const fs = require("fs");
const path = require("path");
const loginPath = path.join(__dirname, "src/app/(auth)/login/page.tsx");
let content = fs.readFileSync(loginPath, "utf-8");

content = content.replace(
  'rounded-xl disabled:opacity-50 transition-all hover:-translate-y-0.5"',
  'rounded-2xl disabled:opacity-50 transition-all hover:-translate-y-0.5 shadow-lg shadow-emerald-500/20"'
);

fs.writeFileSync(loginPath, content, "utf-8");
console.log("Patched login button");
