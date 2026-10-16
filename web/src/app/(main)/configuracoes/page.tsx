"use client";

import { useState } from "react";
import { Settings, Shield, Tags, Building2, Bell, Paintbrush } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import SettingsProfile from "@/components/settings/SettingsProfile";
import SettingsCategories from "@/components/settings/SettingsCategories";
import SettingsSectors from "@/components/settings/SettingsSectors";
import SettingsNotifications from "@/components/settings/SettingsNotifications";
import SettingsAppearance from "@/components/settings/SettingsAppearance";
import SettingsUsers from "@/components/settings/SettingsUsers";
import SettingsExport from "@/components/settings/SettingsExport";
import { Download, Users } from "lucide-react";

type TabType = "perfil" | "categorias" | "notificacoes" | "setores" | "aparencia" | "usuarios" | "exportacao";

export default function ConfiguraçõesPage() {
  const { userRole } = useAuth();
  const [activeTab, setActiveTab] = useState<TabType>("perfil");

  return (
    <div className="flex h-full bg-transparent text-slate-200 w-full overflow-hidden">
      
      {/* Sidebar de Abas */}
      <div className="w-64 flex-shrink-0 border-r border-white/[0.08] bg-slate-950/40 backdrop-blur-xl flex flex-col hidden md:flex">
        <div className="p-6 border-b border-white/[0.08]">
          <h2 className="text-base font-bold text-white flex items-center gap-2">
            <div className="p-1.5 rounded-lg bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
              <Settings size={16} />
            </div>
            <span>Configurações</span>
          </h2>
          <p className="text-[11px] text-slate-400 mt-1 font-mono">Preferências e governança do sistema.</p>
        </div>
        
        <nav className="flex-1 overflow-y-auto p-3 space-y-1.5 custom-scrollbar">
          {[
            { id: "perfil", label: "Meu Perfil", icon: Shield, show: true },
            { id: "aparencia", label: "Aparência", icon: Paintbrush, show: true },
            { id: "categorias", label: "Categorias", icon: Tags, show: userRole === "MASTER" || userRole === "FINANCEIRO" },
            { id: "notificacoes", label: "Notificações", icon: Bell, show: true },
            { id: "setores", label: "Setores", icon: Building2, show: userRole === "MASTER" },
            { id: "exportacao", label: "Exportação", icon: Download, show: userRole === "MASTER" || userRole === "FINANCEIRO" },
            { id: "usuarios", label: "Usuários", icon: Users, show: userRole === "MASTER" },
          ].filter(t => t.show).map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as TabType)}
                className={`w-full flex items-center gap-2.5 px-3.5 py-2.5 rounded-xl text-xs font-semibold transition-all cursor-pointer ${
                  isActive 
                    ? "bg-white/[0.08] text-white border border-white/15 shadow-[0_0_15px_rgba(16,185,129,0.1)]" 
                    : "text-slate-400 hover:text-white hover:bg-white/[0.03]"
                }`}
              >
                <Icon size={15} className={isActive ? "text-emerald-400" : "text-slate-500"} />
                <span>{tab.label}</span>
              </button>
            );
          })}
        </nav>
      </div>

      {/* Mobile Tab Bar */}
      <div className="md:hidden flex overflow-x-auto gap-2 p-3 border-b border-white/[0.08] bg-slate-950/60 backdrop-blur-xl shrink-0 custom-scrollbar">
        {[
          { id: "perfil", label: "Perfil", show: true },
          { id: "aparencia", label: "Aparência", show: true },
          { id: "categorias", label: "Categorias", show: userRole === "MASTER" || userRole === "FINANCEIRO" },
          { id: "notificacoes", label: "Notificações", show: true },
          { id: "setores", label: "Setores", show: userRole === "MASTER" },
          { id: "exportacao", label: "Exportação", show: userRole === "MASTER" || userRole === "FINANCEIRO" },
          { id: "usuarios", label: "Usuários", show: userRole === "MASTER" },
        ].filter(t => t.show).map(tab => (
          <button 
            key={tab.id}
            onClick={() => setActiveTab(tab.id as TabType)} 
            className={`px-3 py-1.5 rounded-xl text-xs font-medium whitespace-nowrap transition-all ${
              activeTab === tab.id 
                ? "bg-white/[0.08] text-white border border-white/15" 
                : "text-slate-400 bg-white/[0.02]"
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Main Content Area */}
      <div className="flex-1 overflow-y-auto bg-transparent p-6 md:p-10 custom-scrollbar">
        <div className="max-w-4xl mx-auto">
          {activeTab === "perfil" && <SettingsProfile />}
          {activeTab === "aparencia" && <SettingsAppearance />}
          {activeTab === "usuarios" && <SettingsUsers />}
          {activeTab === "exportacao" && <SettingsExport />}
          
          {( userRole === "MASTER" || userRole === "FINANCEIRO" ) && activeTab === "categorias" && (
            <SettingsCategories />
          )}
          
          {activeTab === "notificacoes" && <SettingsNotifications />}
          
          {userRole === "MASTER" && activeTab === "setores" && (
            <SettingsSectors />
          )}
        </div>
      </div>

    </div>
  );
}
