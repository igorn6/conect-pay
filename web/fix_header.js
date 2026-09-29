const fs = require('fs');
const path = require('path');
const file = path.join(process.cwd(), "src/components/settings/SettingsExport.tsx");
let code = fs.readFileSync(file, 'utf8');

code = code.replace(/<Header[\s\S]*?\/>/g, '');

fs.writeFileSync(file, code);
console.log("Removed Header from SettingsExport.");
