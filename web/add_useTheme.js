const fs = require('fs');
const path = require('path');

const sidebarPath = path.join(process.cwd(), "src/components/Sidebar.tsx");
let sidebarCode = fs.readFileSync(sidebarPath, "utf-8");

if (!sidebarCode.includes('import { useTheme }')) {
  sidebarCode = sidebarCode.replace(
    'import { useAuth } from "@/contexts/AuthContext";',
    'import { useAuth } from "@/contexts/AuthContext";\nimport { useTheme } from "@/contexts/ThemeContext";'
  );
  fs.writeFileSync(sidebarPath, sidebarCode);
  console.log("Sidebar.tsx: Added useTheme import.");
} else {
  console.log("Sidebar.tsx: useTheme already imported.");
}
