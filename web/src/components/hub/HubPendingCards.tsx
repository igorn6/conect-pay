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
      <h2 className="text-lg font-semibold mb-4" style={{ color: "var(--text-primary)" }}>
        Suas Tarefas
      </h2>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {isMasterOrFinanceiro && (
          <>
            <Link
              href="/kanban"
              className="rounded-2xl p-5 flex flex-col gap-2 group transition-all border shadow-xs hover:border-amber-500/50 cursor-pointer"
              style={{
                backgroundColor: "var(--bg-card)",
                borderColor: "var(--surface-border)",
              }}
            >
              <div className="flex items-center gap-2 text-amber-500">
                <FileText size={18} />
                <span className="text-xs font-semibold uppercase tracking-wider">Novas Solicitações</span>
              </div>
              <span className="text-3xl font-bold" style={{ color: "var(--text-primary)" }}>
                {counts.novaSolicitacao}
              </span>
              <span className="text-sm" style={{ color: "var(--text-secondary)" }}>
                {counts.novaSolicitacao > 0
                  ? "Faça a triagem inicial para dar andamento."
                  : "Ufa! Nada por aqui, você está em dia."}
              </span>
            </Link>

            <Link
              href="/kanban"
              className="rounded-2xl p-5 flex flex-col gap-2 group transition-all border shadow-xs hover:border-blue-500/50 cursor-pointer"
              style={{
                backgroundColor: "var(--bg-card)",
                borderColor: "var(--surface-border)",
              }}
            >
              <div className="flex items-center gap-2 text-blue-500">
                <CheckCircle size={18} />
                <span className="text-xs font-semibold uppercase tracking-wider">Aprovação Final</span>
              </div>
              <span className="text-3xl font-bold" style={{ color: "var(--text-primary)" }}>
                {counts.emAprovacao}
              </span>
              <span className="text-sm" style={{ color: "var(--text-secondary)" }}>
                {counts.emAprovacao > 0
                  ? "Aprove ou rejeite o andamento financeiro."
                  : "Ufa! Nada por aqui, você está em dia."}
              </span>
            </Link>

            <Link
              href="/kanban"
              className="rounded-2xl p-5 flex flex-col gap-2 group transition-all border shadow-xs hover:border-emerald-500/50 cursor-pointer"
              style={{
                backgroundColor: "var(--bg-card)",
                borderColor: "var(--surface-border)",
              }}
            >
              <div className="flex items-center gap-2 text-emerald-500">
                <ClipboardCheck size={18} />
                <span className="text-xs font-semibold uppercase tracking-wider">Aguardando Pagamento</span>
              </div>
              <span className="text-3xl font-bold" style={{ color: "var(--text-primary)" }}>
                {counts.aguardandoPagamento}
              </span>
              <span className="text-sm" style={{ color: "var(--text-secondary)" }}>
                {counts.aguardandoPagamento > 0
                  ? "Solicitações aprovadas para pagar e anexar comprovante."
                  : "Ufa! Nada por aqui, você está em dia."}
              </span>
            </Link>
          </>
        )}

        {isGestor && (
          <>
            <Link
              href="/kanban"
              className="rounded-2xl p-5 flex flex-col gap-2 group transition-all border shadow-xs hover:border-purple-500/50 cursor-pointer"
              style={{
                backgroundColor: "var(--bg-card)",
                borderColor: "var(--surface-border)",
              }}
            >
              <div className="flex items-center gap-2 text-purple-500">
                <ClipboardCheck size={18} />
                <span className="text-xs font-semibold uppercase tracking-wider">Validação do Gestor</span>
              </div>
              <span className="text-3xl font-bold" style={{ color: "var(--text-primary)" }}>
                {counts.validacaoGestor}
              </span>
              <span className="text-sm" style={{ color: "var(--text-secondary)" }}>
                {counts.validacaoGestor > 0
                  ? "Solicitações aguardando sua conferência no setor."
                  : "Ufa! Nada por aqui, você está em dia."}
              </span>
            </Link>
          </>
        )}

        {!isMasterOrFinanceiro && (
          <>
            <Link
              href="/kanban"
              className="rounded-2xl p-5 flex flex-col gap-2 group transition-all border shadow-xs hover:border-orange-500/50 cursor-pointer"
              style={{
                backgroundColor: "var(--bg-card)",
                borderColor: "var(--surface-border)",
              }}
            >
              <div className="flex items-center gap-2 text-orange-500">
                <AlertTriangle size={18} />
                <span className="text-xs font-semibold uppercase tracking-wider">Aguardando Notas</span>
              </div>
              <span className="text-3xl font-bold" style={{ color: "var(--text-primary)" }}>
                {counts.aguardandoPagamento}
              </span>
              <span className="text-sm" style={{ color: "var(--text-secondary)" }}>
                {counts.aguardandoPagamento > 0
                  ? "Você tem notas ou comprovantes para anexar."
                  : "Ufa! Nada por aqui, você está em dia."}
              </span>
            </Link>

            <Link
              href="/kanban"
              className="rounded-2xl p-5 flex flex-col gap-2 group transition-all border shadow-xs hover:border-red-500/50 cursor-pointer"
              style={{
                backgroundColor: "var(--bg-card)",
                borderColor: "var(--surface-border)",
              }}
            >
              <div className="flex items-center gap-2 text-red-500">
                <XCircle size={18} />
                <span className="text-xs font-semibold uppercase tracking-wider">Recusadas / Correção</span>
              </div>
              <span className="text-3xl font-bold" style={{ color: "var(--text-primary)" }}>
                {counts.recusado}
              </span>
              <span className="text-sm" style={{ color: "var(--text-secondary)" }}>
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
