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
    <div className="flex h-full bg-slate-950 text-slate-200 w-full overflow-hidden">
      
      {/* Sidebar de Abas */}
      <div className="w-64 flex-shrink-0 border-r border-slate-800 bg-slate-900/50 flex flex-col hidden md:flex">
        <div className="p-6 border-b border-slate-800">
          <h2 className="text-lg font-bold text-white flex items-center gap-2">
            <Settings size={20} className="text-emerald-500" />
            Configurações
          </h2>
          <p className="text-xs text-slate-400 mt-1">Gerencie sua conta e sistema.</p>
        </div>
        
        <nav className="flex-1 overflow-y-auto p-4 space-y-2">
          <button
            onClick={() => setActiveTab("perfil")}
            className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-colors ${
              activeTab === "perfil" 
                ? "bg-slate-700 text-white shadow-sm" 
                : "text-slate-400 hover:text-slate-200 hover:bg-slate-800/50"
            }`}
          >
            <Shield size={18} />
            Meu Perfil
          </button>
          
          <button
            onClick={() => setActiveTab("aparencia")}
            className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-colors ${
              activeTab === "aparencia" 
                ? "bg-slate-700 text-white shadow-sm" 
                : "text-slate-400 hover:text-slate-200 hover:bg-slate-800/50"
            }`}
          >
            <Paintbrush size={18} />
            Aparência
          </button>

          {( userRole === "MASTER" || userRole === "FINANCEIRO" ) && (
            <button
              onClick={() => setActiveTab("categorias")}
              className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-colors ${
                activeTab === "categorias" 
                  ? "bg-slate-700 text-white shadow-sm" 
                  : "text-slate-400 hover:text-slate-200 hover:bg-slate-800/50"
              }`}
            >
              <Tags size={18} />
              Categorias
            </button>
          )}

          <button
            onClick={() => setActiveTab("notificacoes")}
            className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-colors ${
              activeTab === "notificacoes" 
                ? "bg-slate-700 text-white shadow-sm" 
                : "text-slate-400 hover:text-slate-200 hover:bg-slate-800/50"
            }`}
          >
            <Bell size={18} />
            Notificações
          </button>

          {userRole === "MASTER" && (
            <button
              onClick={() => setActiveTab("setores")}
              className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-colors ${
                activeTab === "setores" 
                  ? "bg-slate-700 text-white shadow-sm" 
                  : "text-slate-400 hover:text-slate-200 hover:bg-slate-800/50"
              }`}
            >
              <Building2 size={18} />
              Setores
            </button>
          )}
        
          {(userRole === "MASTER" || userRole === "FINANCEIRO") && (
            <button
              onClick={() => setActiveTab("exportacao")}
              className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-colors ${
                activeTab === "exportacao" 
                  ? "bg-slate-700 text-white shadow-sm" 
                  : "text-slate-400 hover:text-slate-200 hover:bg-slate-800/50"
              }`}
            >
              <Download size={18} />
              Exportação
            </button>
          )}

          {userRole === "MASTER" && (
            <button
              onClick={() => setActiveTab("usuarios")}
              className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-colors ${
                activeTab === "usuarios" 
                  ? "bg-slate-700 text-white shadow-sm" 
                  : "text-slate-400 hover:text-slate-200 hover:bg-slate-800/50"
              }`}
            >
              <Users size={18} />
              Usuários
            </button>
          )}
        </nav>
      </div>


      {/* Mobile Tab Bar */}
      <div className="md:hidden flex overflow-x-auto gap-2 p-4 border-b border-slate-800 bg-slate-900/50 shrink-0">
        <button onClick={() => setActiveTab("perfil")} className={`px-4 py-2 rounded-lg text-xs font-medium whitespace-nowrap transition-colors ${activeTab === "perfil" ? "bg-slate-700 text-white" : "text-slate-400 bg-slate-800"}`}>Perfil</button>
        <button onClick={() => setActiveTab("aparencia")} className={`px-4 py-2 rounded-lg text-xs font-medium whitespace-nowrap transition-colors ${activeTab === "aparencia" ? "bg-slate-700 text-white" : "text-slate-400 bg-slate-800"}`}>Aparência</button>
        {(userRole === "MASTER" || userRole === "FINANCEIRO") && (
          <button onClick={() => setActiveTab("categorias")} className={`px-4 py-2 rounded-lg text-xs font-medium whitespace-nowrap transition-colors ${activeTab === "categorias" ? "bg-slate-700 text-white" : "text-slate-400 bg-slate-800"}`}>Categorias</button>
        )}
        <button onClick={() => setActiveTab("notificacoes")} className={`px-4 py-2 rounded-lg text-xs font-medium whitespace-nowrap transition-colors ${activeTab === "notificacoes" ? "bg-slate-700 text-white" : "text-slate-400 bg-slate-800"}`}>Notificações</button>
        {userRole === "MASTER" && (
          <button onClick={() => setActiveTab("setores")} className={`px-4 py-2 rounded-lg text-xs font-medium whitespace-nowrap transition-colors ${activeTab === "setores" ? "bg-slate-700 text-white" : "text-slate-400 bg-slate-800"}`}>Setores</button>
        )}
        {(userRole === "MASTER" || userRole === "FINANCEIRO") && (
          <button onClick={() => setActiveTab("exportacao")} className={`px-4 py-2 rounded-lg text-xs font-medium whitespace-nowrap transition-colors ${activeTab === "exportacao" ? "bg-slate-700 text-white" : "text-slate-400 bg-slate-800"}`}>Exportação</button>
        )}
        {userRole === "MASTER" && (
          <button onClick={() => setActiveTab("usuarios")} className={`px-4 py-2 rounded-lg text-xs font-medium whitespace-nowrap transition-colors ${activeTab === "usuarios" ? "bg-slate-700 text-white" : "text-slate-400 bg-slate-800"}`}>Usuários</button>
        )}
      </div>

      {/* Main Content Area */}
      <div className="flex-1 overflow-y-auto bg-slate-950 p-6 md:p-10">
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
