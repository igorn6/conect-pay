const fs = require("fs");
const path = require("path");
const dir = path.join(__dirname, "src/app/(main)/configuracoes");

const content = `"use client";

import { useState } from "react";
import { Settings, Shield, Tags, Building2, Bell } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import SettingsProfile from "@/components/settings/SettingsProfile";
import SettingsCategories from "@/components/settings/SettingsCategories";
import SettingsSectors from "@/components/settings/SettingsSectors";
import SettingsNotifications from "@/components/settings/SettingsNotifications";

type TabType = "perfil" | "categorias" | "notificacoes" | "setores";

export default function ConfiguracoesPage() {
  const { userRole } = useAuth();
  const [activeTab, setActiveTab] = useState<TabType>("perfil");

  return (
    <div className="flex h-[calc(100vh-4rem)] bg-slate-950 text-slate-200 w-full overflow-hidden">
      
      {/* Sidebar de Abas */}
      <div className="w-64 flex-shrink-0 border-r border-slate-800 bg-slate-900/50 flex flex-col hidden md:flex">
        <div className="p-6 border-b border-slate-800">
          <h2 className="text-lg font-bold text-white flex items-center gap-2">
            <Settings size={20} className="text-emerald-500" />
            Configura\u00e7\u00f5es
          </h2>
          <p className="text-xs text-slate-400 mt-1">Gerencie sua conta e sistema.</p>
        </div>
        
        <nav className="flex-1 overflow-y-auto p-4 space-y-2">
          <button
            onClick={() => setActiveTab("perfil")}
            className={\`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-colors \${
              activeTab === "perfil" 
                ? "bg-slate-700 text-white shadow-sm" 
                : "text-slate-400 hover:text-slate-200 hover:bg-slate-800/50"
            }\`}
          >
            <Shield size={18} />
            Meu Perfil
          </button>
          
          <button
            onClick={() => setActiveTab("categorias")}
            className={\`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-colors \${
              activeTab === "categorias" 
                ? "bg-slate-700 text-white shadow-sm" 
                : "text-slate-400 hover:text-slate-200 hover:bg-slate-800/50"
            }\`}
          >
            <Tags size={18} />
            Categorias
          </button>

          <button
            onClick={() => setActiveTab("notificacoes")}
            className={\`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-colors \${
              activeTab === "notificacoes" 
                ? "bg-slate-700 text-white shadow-sm" 
                : "text-slate-400 hover:text-slate-200 hover:bg-slate-800/50"
            }\`}
          >
            <Bell size={18} />
            Notifica\u00e7\u00f5es
          </button>

          {userRole === "MASTER" && (
            <button
              onClick={() => setActiveTab("setores")}
              className={\`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-colors \${
                activeTab === "setores" 
                  ? "bg-slate-700 text-white shadow-sm" 
                  : "text-slate-400 hover:text-slate-200 hover:bg-slate-800/50"
              }\`}
            >
              <Building2 size={18} />
              Setores
            </button>
          )}
        </nav>
      </div>

      {/* Mobile Tabs (Renderizadas no topo) */}
      <div className="md:hidden flex overflow-x-auto border-b border-slate-800 bg-slate-900/80 p-2 gap-2 flex-shrink-0">
        <button
          onClick={() => setActiveTab("perfil")}
          className={\`px-4 py-2 rounded-lg text-sm font-medium whitespace-nowrap \${
            activeTab === "perfil" ? "bg-slate-700 text-white" : "text-slate-400"
          }\`}
        >
          Meu Perfil
        </button>
        <button
          onClick={() => setActiveTab("categorias")}
          className={\`px-4 py-2 rounded-lg text-sm font-medium whitespace-nowrap \${
            activeTab === "categorias" ? "bg-slate-700 text-white" : "text-slate-400"
          }\`}
        >
          Categorias
        </button>
        <button
          onClick={() => setActiveTab("notificacoes")}
          className={\`px-4 py-2 rounded-lg text-sm font-medium whitespace-nowrap \${
            activeTab === "notificacoes" ? "bg-slate-700 text-white" : "text-slate-400"
          }\`}
        >
          Notifica\u00e7\u00f5es
        </button>
        {userRole === "MASTER" && (
          <button
            onClick={() => setActiveTab("setores")}
            className={\`px-4 py-2 rounded-lg text-sm font-medium whitespace-nowrap \${
              activeTab === "setores" ? "bg-slate-700 text-white" : "text-slate-400"
            }\`}
          >
            Setores
          </button>
        )}
      </div>

      {/* Conte\u00fado Principal */}
      <div className="flex-1 overflow-y-auto p-4 sm:p-8 bg-slate-950">
        <div className="max-w-4xl mx-auto">
          {activeTab === "perfil" && <SettingsProfile />}
          {activeTab === "categorias" && <SettingsCategories />}
          {activeTab === "notificacoes" && <SettingsNotifications />}
          {activeTab === "setores" && userRole === "MASTER" && <SettingsSectors />}
        </div>
      </div>

    </div>
  );
}
`;

fs.writeFileSync(path.join(dir, "page.tsx"), content, "utf-8");
console.log("Rewrote configuracoes/page.tsx");
