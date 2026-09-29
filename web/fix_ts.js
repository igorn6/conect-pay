const fs = require('fs');
const path = require('path');

// Fix SettingsAppearance.tsx
const appPath = path.join(process.cwd(), "src/components/settings/SettingsAppearance.tsx");
let appCode = fs.readFileSync(appPath, "utf-8");
appCode = appCode.replace('const { theme, stheme } = useTheme();', 'const { theme, setTheme } = useTheme();');
fs.writeFileSync(appPath, appCode);

// Fix configuracoes/page.tsx
const pagePath = path.join(process.cwd(), "src/app/(main)/configuracoes/page.tsx");
let pageCode = fs.readFileSync(pagePath, "utf-8");
// Let's check where the TabType definition is and fix it if it's missing or misspelled.
// I'll just make sure it's defined right above the component.
console.log(pageCode.substring(0, 500));
