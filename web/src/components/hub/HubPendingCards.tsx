"use client";

import Link from "next/link";
import { AlertTriangle, FileText, CheckCircle, XCircle, ClipboardCheck } from "lucide-react";

export interface PendingCounts {
  novaSolicitacao: number;
  emAprovacao: number;
  aguardandoPagamento: number;
  recusado: number;
  validacaoGestor: number;
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
      <div className="h-3 w-48 bg-slate-700 rounded" />
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
  const isGestor = role === "GESTOR";

  return (
    <div>
      <h2 className="text-lg font-semibold text-white mb-4">Suas Tarefas</h2>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {isMasterOrFinanceiro && (
          <>
            <Link href="/kanban" className="bg-slate-800 border border-slate-700 rounded-2xl p-5 flex flex-col gap-2 group hover:border-amber-500/50 transition-colors cursor-pointer">
              <div className="flex items-center gap-2 text-amber-400">
                <FileText size={18} />
                <span className="text-xs font-medium uppercase tracking-wider">Novas Solicitações</span>
              </div>
              <span className="text-3xl font-bold text-white">{counts.novaSolicitacao}</span>
              <span className="text-sm text-slate-400 group-hover:text-amber-200 transition-colors">
                {counts.novaSolicitacao > 0 
                  ? "Faça a triagem inicial para dar andamento." 
                  : "Ufa! Nada por aqui, você está em dia."}
              </span>
            </Link>

            <Link href="/kanban" className="bg-slate-800 border border-slate-700 rounded-2xl p-5 flex flex-col gap-2 group hover:border-blue-500/50 transition-colors cursor-pointer">
              <div className="flex items-center gap-2 text-blue-400">
                <CheckCircle size={18} />
                <span className="text-xs font-medium uppercase tracking-wider">Aprovação Final</span>
              </div>
              <span className="text-3xl font-bold text-white">{counts.emAprovacao}</span>
              <span className="text-sm text-slate-400 group-hover:text-blue-200 transition-colors">
                {counts.emAprovacao > 0 
                  ? "Aprove ou rejeite o andamento financeiro." 
                  : "Ufa! Nada por aqui, você está em dia."}
              </span>
            </Link>
          </>
        )}

        {isGestor && (
          <>
            <Link href="/kanban" className="bg-slate-800 border border-slate-700 rounded-2xl p-5 flex flex-col gap-2 group hover:border-purple-500/50 transition-colors cursor-pointer">
              <div className="flex items-center gap-2 text-purple-400">
                <ClipboardCheck size={18} />
                <span className="text-xs font-medium uppercase tracking-wider">Validação do Gestor</span>
              </div>
              <span className="text-3xl font-bold text-white">{counts.validacaoGestor}</span>
              <span className="text-sm text-slate-400 group-hover:text-purple-200 transition-colors">
                {counts.validacaoGestor > 0 
                  ? "Solicitações aguardando sua conferência no setor." 
                  : "Ufa! Nada por aqui, você está em dia."}
              </span>
            </Link>
          </>
        )}

        {(!isMasterOrFinanceiro) && (
          <>
            <Link href="/kanban" className="bg-slate-800 border border-slate-700 rounded-2xl p-5 flex flex-col gap-2 group hover:border-orange-500/50 transition-colors cursor-pointer">
              <div className="flex items-center gap-2 text-orange-400">
                <AlertTriangle size={18} />
                <span className="text-xs font-medium uppercase tracking-wider">Aguardando Notas</span>
              </div>
              <span className="text-3xl font-bold text-white">{counts.aguardandoPagamento}</span>
              <span className="text-sm text-slate-400 group-hover:text-orange-200 transition-colors">
                {counts.aguardandoPagamento > 0 
                  ? "Você tem notas ou comprovantes para anexar." 
                  : "Ufa! Nada por aqui, você está em dia."}
              </span>
            </Link>

            <Link href="/kanban" className="bg-slate-800 border border-slate-700 rounded-2xl p-5 flex flex-col gap-2 group hover:border-red-500/50 transition-colors cursor-pointer">
              <div className="flex items-center gap-2 text-red-400">
                <XCircle size={18} />
                <span className="text-xs font-medium uppercase tracking-wider">Recusadas / Correção</span>
              </div>
              <span className="text-3xl font-bold text-white">{counts.recusado}</span>
              <span className="text-sm text-slate-400 group-hover:text-red-200 transition-colors">
                {counts.recusado > 0 
                  ? "Veja o motivo e corrija suas solicitações devolvidas." 
                  : "Ufa! Nada por aqui, você está em dia."}
              </span>
            </Link>
          </>
        )}
      </div>
    </div>
  );
}
