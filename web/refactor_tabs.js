const fs = require('fs');
const path = require('path');

const srcDir = path.join(process.cwd(), "src");

// 1. Move and rename to components
const usersSrc = path.join(srcDir, "app/(main)/configuracoes/usuarios/page.tsx");
const usersDest = path.join(srcDir, "components/settings/SettingsUsers.tsx");
let usersCode = fs.readFileSync(usersSrc, 'utf8');
usersCode = usersCode.replace('export default function UsuariosPage()', 'export default function SettingsUsers()');
fs.writeFileSync(usersDest, usersCode);

const exportSrc = path.join(srcDir, "app/(main)/configuracoes/exportacao/page.tsx");
const exportDest = path.join(srcDir, "components/settings/SettingsExport.tsx");
let exportCode = fs.readFileSync(exportSrc, 'utf8');
exportCode = exportCode.replace('export default function ExportPage()', 'export default function SettingsExport()');
exportCode = exportCode.replace('import Header from "@/components/Header";\n', '');
exportCode = exportCode.replace(/<Header[^>]*>\s*(.*?)<\/Header>/gs, ''); // If Header has children
exportCode = exportCode.replace(/<Header[^>]*\/>/g, ''); // If Header is self-closing
fs.writeFileSync(exportDest, exportCode);

// 2. Remove from Sidebar
const sidebarFile = path.join(srcDir, "components/Sidebar.tsx");
let sidebarCode = fs.readFileSync(sidebarFile, 'utf8');
sidebarCode = sidebarCode.replace(/\{ name: "Exporta.*?", href: "\/exportacao", icon: Download, requiredRoles: \["MASTER", "FINANCEIRO"\] \},\n?\s*/g, '');
sidebarCode = sidebarCode.replace(/\{ name: "Usu.*?", href: "\/usuarios", icon: Users, requiredRoles: \["MASTER"\] \},\n?\s*/g, '');
fs.writeFileSync(sidebarFile, sidebarCode);

// 3. Add tabs to configuracoes/page.tsx
const configPageFile = path.join(srcDir, "app/(main)/configuracoes/page.tsx");
let configCode = fs.readFileSync(configPageFile, 'utf8');

// Add imports
configCode = configCode.replace('import SettingsAppearance from "@/components/settings/SettingsAppearance";',
  'import SettingsAppearance from "@/components/settings/SettingsAppearance";\nimport SettingsUsers from "@/components/settings/SettingsUsers";\nimport SettingsExport from "@/components/settings/SettingsExport";\nimport { Download, Users } from "lucide-react";');

// Add TabType
configCode = configCode.replace('type TabType = "perfil" | "categorias" | "notificacoes" | "setores" | "aparencia";',
  'type TabType = "perfil" | "categorias" | "notificacoes" | "setores" | "aparencia" | "usuarios" | "exportacao";');

// Add Sidebar buttons
const exportBtn = `
          {(userRole === "MASTER" || userRole === "FINANCEIRO") && (
            <button
              onClick={() => setActiveTab("exportacao")}
              className={\`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-colors \${
                activeTab === "exportacao" 
                  ? "bg-slate-700 text-white shadow-sm" 
                  : "text-slate-400 hover:text-slate-200 hover:bg-slate-800/50"
              }\`}
            >
              <Download size={18} />
              Exportação
            </button>
          )}
`;
const usersBtn = `
          {userRole === "MASTER" && (
            <button
              onClick={() => setActiveTab("usuarios")}
              className={\`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-colors \${
                activeTab === "usuarios" 
                  ? "bg-slate-700 text-white shadow-sm" 
                  : "text-slate-400 hover:text-slate-200 hover:bg-slate-800/50"
              }\`}
            >
              <Users size={18} />
              Usuários
            </button>
          )}
`;
configCode = configCode.replace('</nav>', exportBtn + usersBtn + '        </nav>');

// Render tabs in Main Content Area
// Need to find where it renders the components
configCode = configCode.replace(
  '{activeTab === "aparencia" && <SettingsAppearance />}',
  '{activeTab === "aparencia" && <SettingsAppearance />}\n          {activeTab === "usuarios" && <SettingsUsers />}\n          {activeTab === "exportacao" && <SettingsExport />}'
);
fs.writeFileSync(configPageFile, configCode);

console.log("Refactoring complete.");
