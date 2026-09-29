const fs = require('fs');
const path = require('path');

const sidebarPath = path.join(process.cwd(), "src/components/Sidebar.tsx");
let sidebarCode = fs.readFileSync(sidebarPath, "utf-8");

// Add import if missing
if (!sidebarCode.includes('import { useTheme }')) {
  sidebarCode = sidebarCode.replace(
    'import { LogOut, Home, LayoutDashboard, CreditCard, Users, Settings, PanelLeftClose, PanelLeft, Search } from "lucide-react";',
    'import { LogOut, Home, LayoutDashboard, CreditCard, Users, Settings, PanelLeftClose, PanelLeft, Search } from "lucide-react";\nimport { useTheme } from "@/contexts/ThemeContext";'
  );
}

// Add hook
if (!sidebarCode.includes('const { theme } = useTheme();')) {
  sidebarCode = sidebarCode.replace(
    'const pathname = usePathname();',
    'const pathname = usePathname();\n  const { theme } = useTheme();'
  );
}

// Replace logo
const logoRegex = /<img\s+src="\/logo-light\.png"[^>]+>/;
const newLogo = `{theme === "light" ? (
            <img 
              src="/logo-light.png" 
              alt="Conect Pay"
              className={\`h-[42px] object-cover object-left transition-all duration-300 mix-blend-multiply \${isCollapsed ? 'w-[42px]' : 'w-[180px]'}\`}
              style={{ filter: 'brightness(1.05) contrast(1.1)' }}
            />
          ) : (
            <img 
              src="/logo-dark.png" 
              alt="Conect Pay"
              className={\`h-[42px] object-cover object-left transition-all duration-300 mix-blend-lighten \${isCollapsed ? 'w-[42px]' : 'w-[180px]'}\`}
            />
          )}`;

sidebarCode = sidebarCode.replace(logoRegex, newLogo);

fs.writeFileSync(sidebarPath, sidebarCode);
console.log("Sidebar patched for theme-aware logo.");
