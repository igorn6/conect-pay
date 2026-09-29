const fs = require('fs');
const path = require('path');

// Fix SettingsAppearance.tsx
const appPath = path.join(process.cwd(), "src/components/settings/SettingsAppearance.tsx");
let appCode = fs.readFileSync(appPath, "utf-8");
appCode = appCode.replace('<Sun size=,{20}', '<Sun size={20}');
fs.writeFileSync(appPath, appCode);

// Fix Sidebar.tsx
const sidePath = path.join(process.cwd(), "src/components/Sidebar.tsx");
let sideCode = fs.readFileSync(sidePath, "utf-8");
sideCode = sideCode.replace('className={aflex', 'className={`flex');
fs.writeFileSync(sidePath, sideCode);

console.log("Syntax errors fixed 2!");
