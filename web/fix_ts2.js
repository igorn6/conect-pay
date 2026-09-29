const fs = require('fs');
const path = require('path');
const pagePath = path.join(process.cwd(), "src/app/(main)/configuracoes/page.tsx");
let pageCode = fs.readFileSync(pagePath, "utf-8");
console.log(pageCode.substring(450, 700));
