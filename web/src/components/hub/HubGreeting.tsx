"use client";

import { Plus, UserCircle, LogOut } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { useTheme } from "@/contexts/ThemeContext";

interface HubGreetingProps {
  userName: string;
  onNewRequest: () => void;
}

export default function HubGreeting({ userName, onNewRequest }: HubGreetingProps) {
  const { userRole, logout } = useAuth();
  const { theme } = useTheme();
  
  const now = new Date();
  const formatted = now.toLocaleDateString("pt-BR", {
    weekday: "long",
    day: "numeric",
    month: "long",
  });
  const capitalized = formatted.charAt(0).toUpperCase() + formatted.slice(1);

  return (
    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
      
      {/* Esquerda: Saudao, Data e Perfil */}
      <div className="flex flex-col gap-2">
        <h1 className="text-2xl sm:text-3xl font-bold text-white tracking-tight">
          Olá, {userName} 👋
        </h1>
        
        <div className="flex flex-wrap items-center gap-3">
          <p className="text-slate-400 text-sm">{capitalized}</p>
          
          <div className="hidden sm:block w-1 h-1 rounded-full bg-slate-700" />
          
          <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-slate-800/80 border border-slate-700/50">
            <UserCircle size={14} className="text-indigo-400" />
            <span className="text-xs font-semibold text-slate-300">
              Perfil: {userRole}
            </span>
          </div>
        </div>
      </div>

      {/* Direita: Ações (Sair e Nova Solicitação) */}
      <div className="flex items-center gap-3">
        <button
          onClick={logout}
          className="flex items-center justify-center p-3 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-red-400 border border-slate-700/50 transition-colors"
          title="Sair da Conta"
        >
          <LogOut size={20} />
        </button>

        <button
          onClick={onNewRequest}
          className={`flex items-center gap-2 px-6 py-3 font-semibold text-sm shadow-lg transition-all hover:-translate-y-0.5 active:translate-y-0 text-white border-none ${
            theme === 'authkit'
              ? 'bg-[#663af3] hover:opacity-90 rounded-full shadow-[0_0_20px_rgba(102,58,243,0.4)]'
              : theme === 'n8n' 
              ? 'bg-[image:var(--gradient-ember-cta)] shadow-[0_0_15px_rgba(253,137,37,0.4)] rounded-xl' 
              : 'bg-indigo-600 hover:bg-indigo-500 shadow-indigo-500/25 rounded-xl'
          }`}
        >
          <Plus size={20} />
          Nova Solicitação
        </button>
      </div>

    </div>
  );
}
