const fs = require('fs');
const path = require('path');

const sidePath = path.join(process.cwd(), "src/components/Sidebar.tsx");
let code = fs.readFileSync(sidePath, "utf-8");

// 1. Add Home icon to imports
code = code.replace(
  'ChevronRight,',
  'ChevronRight,\n  Home,'
);

// 2. Wrap logo in Link with aria-label
code = code.replace(
  '<div className="flex items-center h-full pt-1 overflow-hidden">\n              <img',
  '<Link href="/" aria-label="Ir para a p\u00e1gina inicial" className="flex items-center h-full pt-1 overflow-hidden">\n              <img'
);

// Also fix the closing div for the logo wrapper
code = code.replace(
  `              />
            </div>`,
  `              />
            </Link>`
);

// 3. Add "In\u00edcio" as first menu item and change Kanban href to /kanban
code = code.replace(
  '{ name: "Solicita\u00e7\u00f5es Kanban", href: "/", icon: Columns',
  '{ name: "In\u00edcio", href: "/", icon: Home, requiredRoles: ["MASTER", "FINANCEIRO", "GESTOR"] },\n  { name: "Solicita\u00e7\u00f5es Kanban", href: "/kanban", icon: Columns'
);

fs.writeFileSync(sidePath, code);
console.log("Sidebar.tsx updated.");
