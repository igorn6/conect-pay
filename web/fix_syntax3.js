const fs = require('fs');
const path = require('path');

const sidePath = path.join(process.cwd(), "src/components/Sidebar.tsx");
let sideCode = fs.readFileSync(sidePath, "utf-8");
sideCode = sideCode.replace('className=x`flex', 'className={`flex');
fs.writeFileSync(sidePath, sideCode);

console.log("Syntax errors fixed 3!");
