const fs = require('fs');
const path = require('path');

const sidebarPath = path.join(process.cwd(), "src/components/Sidebar.tsx");
let content = fs.readFileSync(sidebarPath, "utf-8");

content = content.replace(
  'name: "Configura\u00e7\u00f5es", href: "/configuracoes", icon: Settings, requiredRoles: ["MASTER", "FINANCEIRO"]',
  'name: "Configura\u00e7\u00f5es", href: "/configuracoes", icon: Settings, requiredRoles: ["MASTER", "FINANCEIRO", "GESTOR"]'
);

fs.writeFileSync(sidebarPath, content);
console.log("Sidebar.tsx patched!");
