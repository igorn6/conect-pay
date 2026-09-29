const fs = require('fs');
const path = require('path');
const pagePath = path.join(process.cwd(), "src/app/(main)/configuracoes/page.tsx");
let pageCode = fs.readFileSync(pagePath, "utf-8");
pageCode = pageCode.replace('type TabTypd', 'type TabType');
fs.writeFileSync(pagePath, pageCode);
console.log("Fixed TabTypd to TabType!");
