"use client";

import { Plus, UserCircle, LogOut, Radio } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import MagnetButton from "@/components/ui/MagnetButton";
import ShinyBadge from "@/components/ui/ShinyBadge";

interface HubGreetingProps {
  userName: string;
  onNewRequest: () => void;
}

export default function HubGreeting({ userName, onNewRequest }: HubGreetingProps) {
  const { userRole, logout } = useAuth();
  
  const now = new Date();
  const formatted = now.toLocaleDateString("pt-BR", {
    weekday: "long",
    day: "numeric",
    month: "long",
  });
  const capitalized = formatted.charAt(0).toUpperCase() + formatted.slice(1);

  return (
    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 p-5 rounded-2xl bg-slate-950/40 backdrop-blur-xl border border-white/[0.08] shadow-[0_8px_32px_rgba(0,0,0,0.3)]">
      
      {/* Esquerda: Saudação editorial, Data e Perfil */}
      <div className="flex flex-col gap-1.5">
        <div className="flex items-center gap-2">
          <span className="flex h-2 w-2 relative">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
            <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
          </span>
          <span className="text-[11px] font-mono uppercase tracking-widest text-emerald-400 font-semibold">
            Terminal Operacional
          </span>
        </div>

        <h1 className="text-2xl sm:text-3xl font-bold text-white tracking-tight">
          Olá, <span className="bg-gradient-to-r from-white via-slate-100 to-slate-300 bg-clip-text text-transparent">{userName}</span>
        </h1>
        
        <div className="flex flex-wrap items-center gap-3 mt-0.5">
          <p className="text-slate-400 text-xs font-mono">{capitalized}</p>
          <div className="hidden sm:block w-1 h-1 rounded-full bg-slate-700" />
          <ShinyBadge variant={userRole === "MASTER" ? "emerald" : "slate"} size="sm">
            {userRole}
          </ShinyBadge>
        </div>
      </div>

      {/* Direita: Ações (Sair e Nova Solicitação) */}
      <div className="flex items-center gap-2.5">
        <button
          onClick={logout}
          className="flex items-center justify-center p-2.5 rounded-xl bg-slate-900/80 hover:bg-rose-950/40 text-slate-400 hover:text-rose-300 border border-white/10 hover:border-rose-500/30 transition-all cursor-pointer"
          title="Encerrar Sessão"
        >
          <LogOut size={16} />
        </button>

        <MagnetButton
          onClick={onNewRequest}
          className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-gradient-to-r from-emerald-500 via-emerald-600 to-teal-700 hover:from-emerald-400 hover:to-teal-600 text-slate-950 font-bold text-xs uppercase tracking-wider shadow-[0_0_20px_rgba(16,185,129,0.35)] transition-all cursor-pointer active:scale-95"
        >
          <Plus size={16} strokeWidth={3} />
          <span>Nova Solicitação</span>
        </MagnetButton>
      </div>

    </div>
  );
}
