"use client";

import Link from "next/link";
import { AlertTriangle, FileText, CheckCircle, XCircle, ClipboardCheck, ArrowUpRight } from "lucide-react";
import SpotlightCard from "@/components/ui/SpotlightCard";
import CountUp from "@/components/ui/CountUp";

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
    <div className="bg-slate-900/60 border border-white/5 rounded-2xl p-5 animate-pulse">
      <div className="h-4 w-24 bg-white/10 rounded mb-3" />
      <div className="h-8 w-16 bg-white/10 rounded mb-2" />
      <div className="h-3 w-48 bg-white/5 rounded" />
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
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-sm font-bold uppercase tracking-wider text-slate-300 flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-emerald-400 shadow-[0_0_8px_rgba(16,185,129,0.8)]" />
          Fila de Ação Imediata
        </h2>
        <span className="text-[11px] font-mono text-slate-500">Pipeline em tempo real</span>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {isMasterOrFinanceiro && (
          <>
            {/* Novas Solicitações */}
            <Link href="/kanban" className="block group">
              <SpotlightCard
                spotlightColor="rgba(245, 158, 11, 0.18)"
                className="h-full p-5 rounded-2xl bg-slate-950/60 backdrop-blur-xl border border-white/[0.08] hover:border-amber-500/40 transition-all duration-300 flex flex-col justify-between"
              >
                <div>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2 text-amber-400">
                      <div className="p-2 rounded-xl bg-amber-500/10 border border-amber-500/20">
                        <FileText size={16} />
                      </div>
                      <span className="text-xs font-bold uppercase tracking-wider">Novas Solicitações</span>
                    </div>
                    <ArrowUpRight size={14} className="text-slate-500 group-hover:text-amber-400 group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition-all" />
                  </div>

                  <div className="mt-4">
                    <div className="text-3xl font-black font-mono tracking-tight text-white group-hover:text-amber-300 transition-colors">
                      <CountUp value={counts.novaSolicitacao} currency={false} decimals={0} />
                    </div>
                    <p className="text-xs text-slate-400 mt-1 leading-relaxed">
                      {counts.novaSolicitacao > 0
                        ? "Triagem inicial requerida para dar andamento."
                        : "Fila zerada. Nenhuma solicitação pendente."}
                    </p>
                  </div>
                </div>

                <div className="mt-4 pt-3 border-t border-white/[0.06] flex items-center justify-between text-[10px] font-mono text-slate-500">
                  <span>Estágio 1 • Triagem</span>
                  <span className="text-amber-400/80 group-hover:text-amber-300">Acessar Kanban →</span>
                </div>
              </SpotlightCard>
            </Link>

            {/* Aprovação Final */}
            <Link href="/kanban" className="block group">
              <SpotlightCard
                spotlightColor="rgba(59, 130, 246, 0.18)"
                className="h-full p-5 rounded-2xl bg-slate-950/60 backdrop-blur-xl border border-white/[0.08] hover:border-blue-500/40 transition-all duration-300 flex flex-col justify-between"
              >
                <div>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2 text-blue-400">
                      <div className="p-2 rounded-xl bg-blue-500/10 border border-blue-500/20">
                        <CheckCircle size={16} />
                      </div>
                      <span className="text-xs font-bold uppercase tracking-wider">Aprovação Final</span>
                    </div>
                    <ArrowUpRight size={14} className="text-slate-500 group-hover:text-blue-400 group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition-all" />
                  </div>

                  <div className="mt-4">
                    <div className="text-3xl font-black font-mono tracking-tight text-white group-hover:text-blue-300 transition-colors">
                      <CountUp value={counts.emAprovacao} currency={false} decimals={0} />
                    </div>
                    <p className="text-xs text-slate-400 mt-1 leading-relaxed">
                      {counts.emAprovacao > 0
                        ? "Aprove ou rejeite o andamento financeiro."
                        : "Todas as aprovações foram liquidadas."}
                    </p>
                  </div>
                </div>

                <div className="mt-4 pt-3 border-t border-white/[0.06] flex items-center justify-between text-[10px] font-mono text-slate-500">
                  <span>Estágio 2 • Decisão</span>
                  <span className="text-blue-400/80 group-hover:text-blue-300">Acessar Kanban →</span>
                </div>
              </SpotlightCard>
            </Link>

            {/* Aguardando Pagamento */}
            <Link href="/kanban" className="block group">
              <SpotlightCard
                spotlightColor="rgba(16, 185, 129, 0.18)"
                className="h-full p-5 rounded-2xl bg-slate-950/60 backdrop-blur-xl border border-white/[0.08] hover:border-emerald-500/40 transition-all duration-300 flex flex-col justify-between"
              >
                <div>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2 text-emerald-400">
                      <div className="p-2 rounded-xl bg-emerald-500/10 border border-emerald-500/20">
                        <ClipboardCheck size={16} />
                      </div>
                      <span className="text-xs font-bold uppercase tracking-wider">Aguardando Pagamento</span>
                    </div>
                    <ArrowUpRight size={14} className="text-slate-500 group-hover:text-emerald-400 group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition-all" />
                  </div>

                  <div className="mt-4">
                    <div className="text-3xl font-black font-mono tracking-tight text-white group-hover:text-emerald-300 transition-colors">
                      <CountUp value={counts.aguardandoPagamento} currency={false} decimals={0} />
                    </div>
                    <p className="text-xs text-slate-400 mt-1 leading-relaxed">
                      {counts.aguardandoPagamento > 0
                        ? "Aprovadas para liquidação bancária imediata."
                        : "Sem pagamentos pendentes de liquidação."}
                    </p>
                  </div>
                </div>

                <div className="mt-4 pt-3 border-t border-white/[0.06] flex items-center justify-between text-[10px] font-mono text-slate-500">
                  <span>Estágio 3 • Execução</span>
                  <span className="text-emerald-400/80 group-hover:text-emerald-300">Liquidar Pagamentos →</span>
                </div>
              </SpotlightCard>
            </Link>
          </>
        )}

        {isGestor && (
          <Link href="/kanban" className="block group">
            <SpotlightCard
              spotlightColor="rgba(168, 85, 247, 0.18)"
              className="h-full p-5 rounded-2xl bg-slate-950/60 backdrop-blur-xl border border-white/[0.08] hover:border-purple-500/40 transition-all duration-300 flex flex-col justify-between"
            >
              <div>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 text-purple-400">
                    <div className="p-2 rounded-xl bg-purple-500/10 border border-purple-500/20">
                      <ClipboardCheck size={16} />
                    </div>
                    <span className="text-xs font-bold uppercase tracking-wider">Validação Setorial</span>
                  </div>
                  <ArrowUpRight size={14} className="text-slate-500 group-hover:text-purple-400 group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition-all" />
                </div>

                <div className="mt-4">
                  <div className="text-3xl font-black font-mono tracking-tight text-white group-hover:text-purple-300 transition-colors">
                    <CountUp value={counts.validacaoGestor} currency={false} decimals={0} />
                  </div>
                  <p className="text-xs text-slate-400 mt-1 leading-relaxed">
                    {counts.validacaoGestor > 0
                      ? "Solicitações aguardando sua conferência no setor."
                      : "Tudo validado no setor."}
                  </p>
                </div>
              </div>

              <div className="mt-4 pt-3 border-t border-white/[0.06] flex items-center justify-between text-[10px] font-mono text-slate-500">
                <span>Gestão • Validação</span>
                <span className="text-purple-400/80 group-hover:text-purple-300">Conferir Setor →</span>
              </div>
            </SpotlightCard>
          </Link>
        )}

        {!isMasterOrFinanceiro && (
          <>
            <Link href="/kanban" className="block group">
              <SpotlightCard
                spotlightColor="rgba(249, 115, 22, 0.18)"
                className="h-full p-5 rounded-2xl bg-slate-950/60 backdrop-blur-xl border border-white/[0.08] hover:border-orange-500/40 transition-all duration-300 flex flex-col justify-between"
              >
                <div>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2 text-orange-400">
                      <div className="p-2 rounded-xl bg-orange-500/10 border border-orange-500/20">
                        <AlertTriangle size={16} />
                      </div>
                      <span className="text-xs font-bold uppercase tracking-wider">Aguardando Notas</span>
                    </div>
                    <ArrowUpRight size={14} className="text-slate-500 group-hover:text-orange-400 group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition-all" />
                  </div>

                  <div className="mt-4">
                    <div className="text-3xl font-black font-mono tracking-tight text-white group-hover:text-orange-300 transition-colors">
                      <CountUp value={counts.aguardandoPagamento} currency={false} decimals={0} />
                    </div>
                    <p className="text-xs text-slate-400 mt-1 leading-relaxed">
                      {counts.aguardandoPagamento > 0
                        ? "Você possui notas ou comprovantes para anexar."
                        : "Nenhuma pendência de comprovante."}
                    </p>
                  </div>
                </div>

                <div className="mt-4 pt-3 border-t border-white/[0.06] flex items-center justify-between text-[10px] font-mono text-slate-500">
                  <span>Anexo • Comprovantes</span>
                  <span className="text-orange-400/80 group-hover:text-orange-300">Anexar →</span>
                </div>
              </SpotlightCard>
            </Link>

            <Link href="/kanban" className="block group">
              <SpotlightCard
                spotlightColor="rgba(239, 68, 68, 0.18)"
                className="h-full p-5 rounded-2xl bg-slate-950/60 backdrop-blur-xl border border-white/[0.08] hover:border-red-500/40 transition-all duration-300 flex flex-col justify-between"
              >
                <div>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2 text-red-400">
                      <div className="p-2 rounded-xl bg-red-500/10 border border-red-500/20">
                        <XCircle size={16} />
                      </div>
                      <span className="text-xs font-bold uppercase tracking-wider">Recusadas / Correção</span>
                    </div>
                    <ArrowUpRight size={14} className="text-slate-500 group-hover:text-red-400 group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition-all" />
                  </div>

                  <div className="mt-4">
                    <div className="text-3xl font-black font-mono tracking-tight text-white group-hover:text-red-300 transition-colors">
                      <CountUp value={counts.recusado} currency={false} decimals={0} />
                    </div>
                    <p className="text-xs text-slate-400 mt-1 leading-relaxed">
                      {counts.recusado > 0
                        ? "Veja o motivo e corrija suas solicitações devolvidas."
                        : "Nenhuma solicitação recusada."}
                    </p>
                  </div>
                </div>

                <div className="mt-4 pt-3 border-t border-white/[0.06] flex items-center justify-between text-[10px] font-mono text-slate-500">
                  <span>Correções</span>
                  <span className="text-red-400/80 group-hover:text-red-300">Verificar →</span>
                </div>
              </SpotlightCard>
            </Link>
          </>
        )}
      </div>
    </div>
  );
}
