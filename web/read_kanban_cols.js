const fs = require('fs');
const path = require('path');
const file = path.join(process.cwd(), "src/app/(main)/kanban/page.tsx");
let code = fs.readFileSync(file, 'utf8');

const match = code.match(/const COLUMNS[\s\S]*?\];/);
if (match) console.log(match[0]);
