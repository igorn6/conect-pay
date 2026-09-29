const fs = require('fs');
const path = require('path');

// === 1. HubGreeting.tsx ===
const greeting = Buffer.from(`"use client";

import { Plus } from "lucide-react";

interface HubGreetingProps {
  userName: string;
  onNewRequest: () => void;
}

export default function HubGreeting({ userName, onNewRequest }: HubGreetingProps) {
  const now = new Date();
  const formatted = now.toLocaleDateString("pt-BR", {
    weekday: "long",
    day: "numeric",
    month: "long",
  });
  const capitalized = formatted.charAt(0).toUpperCase() + formatted.slice(1);

  return (
    <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4">
      <div>
        <h1 className="text-2xl sm:text-3xl font-bold text-white tracking-tight">
          Ol\u00e1, {userName} \u{1F44B}
        </h1>
        <p className="text-slate-400 text-sm mt-1">{capitalized}</p>
      </div>
      <button
        onClick={onNewRequest}
        className="flex items-center gap-2 px-6 py-3 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-semibold text-sm shadow-lg shadow-indigo-500/25 transition-all hover:-translate-y-0.5 active:translate-y-0"
      >
        <Plus size={20} />
        Nova Solicita\u00e7\u00e3o
      </button>
    </div>
  );
}
`).toString('base64');

fs.writeFileSync(
  path.join(process.cwd(), "src/components/hub/HubGreeting.tsx"),
  Buffer.from(greeting, 'base64')
);

// === 2. HubPendingCards.tsx ===
const pending = Buffer.from(`"use client";

import Link from "next/link";
import { AlertTriangle, FileText, CheckCircle, XCircle, ArrowRight, Loader2 } from "lucide-react";

interface PendingCounts {
  novaSolicitacao: number;
  emAprovacao: number;
  aguardandoNotinha: number;
  recusado: number;
}

interface HubPendingCardsProps {
  role: string;
  counts: PendingCounts;
  isLoading: boolean;
}

function SkeletonCard() {
  return (
    <div className="bg-slate-800 border border-slate-700 rounded-2xl p-5 animate-pulse">
      <div className="h-4 w-24 bg-slate-700 rounded mb-3" />
      <div className="h-8 w-16 bg-slate-700 rounded mb-2" />
      <div className="h-3 w-32 bg-slate-700 rounded" />
    </div>
  );
}

export default function HubPendingCards({ role, counts, isLoading }: HubPendingCardsProps) {
  if (isLoading) {
    return (
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        <SkeletonCard />
        <SkeletonCard />
        <SkeletonCard />
      </div>
    );
  }

  const isMasterOrFinanceiro = role === "MASTER" || role === "FINANCEIRO";

  return (
    <div>
      <h2 className="text-lg font-semibold text-white mb-4">Pend\u00eancias</h2>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {isMasterOrFinanceiro ? (
          <>
            <div className="bg-slate-800 border border-slate-700 rounded-2xl p-5 flex flex-col gap-2 group hover:border-amber-500/50 transition-colors">
              <div className="flex items-center gap-2 text-amber-400">
                <FileText size={18} />
                <span className="text-xs font-medium uppercase tracking-wider">Novas Solicita\u00e7\u00f5es</span>
              </div>
              <span className="text-3xl font-bold text-white">{counts.novaSolicitacao}</span>
              <span className="text-xs text-slate-400">aguardando an\u00e1lise inicial</span>
            </div>

            <div className="bg-slate-800 border border-slate-700 rounded-2xl p-5 flex flex-col gap-2 group hover:border-blue-500/50 transition-colors">
              <div className="flex items-center gap-2 text-blue-400">
                <CheckCircle size={18} />
                <span className="text-xs font-medium uppercase tracking-wider">Em Aprova\u00e7\u00e3o</span>
              </div>
              <span className="text-3xl font-bold text-white">{counts.emAprovacao}</span>
              <span className="text-xs text-slate-400">aguardando aprova\u00e7\u00e3o financeira</span>
            </div>

            <Link
              href="/kanban"
              className="bg-slate-800 border border-slate-700 border-dashed rounded-2xl p-5 flex flex-col items-center justify-center gap-2 hover:border-indigo-500/50 hover:bg-slate-700/50 transition-all group"
            >
              <ArrowRight size={24} className="text-indigo-400 group-hover:translate-x-1 transition-transform" />
              <span className="text-sm font-medium text-indigo-400">Ver Kanban</span>
            </Link>
          </>
        ) : (
          <>
            <div className="bg-slate-800 border border-slate-700 rounded-2xl p-5 flex flex-col gap-2 group hover:border-orange-500/50 transition-colors">
              <div className="flex items-center gap-2 text-orange-400">
                <AlertTriangle size={18} />
                <span className="text-xs font-medium uppercase tracking-wider">Notas Pendentes</span>
              </div>
              <span className="text-3xl font-bold text-white">{counts.aguardandoNotinha}</span>
              <span className="text-xs text-slate-400">comprovantes para enviar</span>
            </div>

            <div className="bg-slate-800 border border-slate-700 rounded-2xl p-5 flex flex-col gap-2 group hover:border-red-500/50 transition-colors">
              <div className="flex items-center gap-2 text-red-400">
                <XCircle size={18} />
                <span className="text-xs font-medium uppercase tracking-wider">Recusadas</span>
              </div>
              <span className="text-3xl font-bold text-white">{counts.recusado}</span>
              <span className="text-xs text-slate-400">solicita\u00e7\u00f5es que precisam de aten\u00e7\u00e3o</span>
            </div>

            <Link
              href="/kanban"
              className="bg-slate-800 border border-slate-700 border-dashed rounded-2xl p-5 flex flex-col items-center justify-center gap-2 hover:border-indigo-500/50 hover:bg-slate-700/50 transition-all group"
            >
              <ArrowRight size={24} className="text-indigo-400 group-hover:translate-x-1 transition-transform" />
              <span className="text-sm font-medium text-indigo-400">Resolver Pend\u00eancias</span>
            </Link>
          </>
        )}
      </div>
    </div>
  );
}
`).toString('base64');

fs.writeFileSync(
  path.join(process.cwd(), "src/components/hub/HubPendingCards.tsx"),
  Buffer.from(pending, 'base64')
);

console.log("HubGreeting + HubPendingCards created.");
