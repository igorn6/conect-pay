"use client";

import { CheckCircle2, Clock, AlertCircle, FileText, XCircle, Banknote, ArrowRight } from "lucide-react";
import type { PaymentRequest } from "@/types/database";

interface HubRecentActivityProps {
  activities: PaymentRequest[];
  profilesMap: Record<string, string>;
  isLoading: boolean;
}

const STATUS_CONFIG: Record<string, { icon: typeof Clock; color: string; badgeCls: string; label: string }> = {
  NOVA_SOLICITACAO: { icon: FileText, color: "#38bdf8", badgeCls: "bg-sky-500/15 border-sky-500/30 text-sky-300", label: "Nova" },
  EM_APROVACAO: { icon: Clock, color: "#f59e0b", badgeCls: "bg-amber-500/15 border-amber-500/30 text-amber-300", label: "Pendente" },
  VALIDACAO_GESTOR: { icon: Clock, color: "#c084fc", badgeCls: "bg-purple-500/15 border-purple-500/30 text-purple-300", label: "Validação Gestor" },
  CORRECAO_PENDENTE: { icon: AlertCircle, color: "#fb923c", badgeCls: "bg-orange-500/15 border-orange-500/30 text-orange-300", label: "Correção" },
  VALIDADO_GESTOR: { icon: CheckCircle2, color: "#e879f9", badgeCls: "bg-fuchsia-500/15 border-fuchsia-500/30 text-fuchsia-300", label: "Validado" },
  AGUARDANDO_PAGAMENTO: { icon: Clock, color: "#60a5fa", badgeCls: "bg-blue-500/15 border-blue-500/30 text-blue-300", label: "Aguardando Pgto" },
  FINALIZADO: { icon: CheckCircle2, color: "#34d399", badgeCls: "bg-emerald-500/15 border-emerald-500/30 text-emerald-300", label: "Finalizado" },
  RECUSADO: { icon: XCircle, color: "#f87171", badgeCls: "bg-red-500/15 border-red-500/30 text-red-300", label: "Recusado" },
  PAGAMENTO_FINALIZADO: { icon: CheckCircle2, color: "#34d399", badgeCls: "bg-emerald-500/15 border-emerald-500/30 text-emerald-300", label: "Finalizado" },
  AGUARDANDO_NOTINHA: { icon: AlertCircle, color: "#60a5fa", badgeCls: "bg-blue-500/15 border-blue-500/30 text-blue-300", label: "Aguardando Pgto" },
};

function SkeletonRow() {
  return (
    <div className="flex items-center gap-4 py-3.5 animate-pulse">
      <div className="w-8 h-8 rounded-xl bg-white/5" />
      <div className="flex-1">
        <div className="h-3.5 w-40 bg-white/10 rounded mb-1.5" />
        <div className="h-3 w-24 bg-white/5 rounded" />
      </div>
      <div className="h-3 w-16 bg-white/10 rounded" />
    </div>
  );
}

function formatTimeAgo(dateStr?: string | null): string {
  if (!dateStr) return "Recente";
  const now = new Date();
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return "Recente";
  const diffMs = Math.max(0, now.getTime() - d.getTime());
  const diffMin = Math.floor(diffMs / 60000);
  if (diffMin < 1) return "Agora";
  if (diffMin < 60) return diffMin + " min atrás";
  const diffH = Math.floor(diffMin / 60);
  if (diffH < 24) return diffH + "h atrás";
  const diffD = Math.floor(diffH / 24);
  if (diffD === 1) return "Ontem";
  return diffD + " dias atrás";
}

export default function HubRecentActivity({ activities, profilesMap, isLoading }: HubRecentActivityProps) {
  return (
    <div className="rounded-2xl p-6 bg-slate-950/60 backdrop-blur-xl border border-white/[0.08] shadow-[0_8px_32px_rgba(0,0,0,0.3)]">
      <div className="flex items-center justify-between mb-5">
        <h2 className="text-sm font-bold uppercase tracking-wider text-slate-200 flex items-center gap-2.5">
          <div className="p-1.5 rounded-lg bg-white/[0.04] text-slate-300 border border-white/10">
            <Banknote size={16} />
          </div>
          <span>Últimas Movimentações Financeiras</span>
        </h2>
        <span className="text-[11px] font-mono text-slate-500">Histórico de liquidação</span>
      </div>

      {isLoading ? (
        <div className="divide-y divide-white/[0.04]">
          <SkeletonRow />
          <SkeletonRow />
          <SkeletonRow />
          <SkeletonRow />
        </div>
      ) : activities.length === 0 ? (
        <p className="text-xs font-mono text-center py-8 text-slate-500">
          Nenhuma movimentação recente detectada no período.
        </p>
      ) : (
        <div className="divide-y divide-white/[0.04]">
          {activities.map((req) => {
            const cfg = STATUS_CONFIG[req.status] || STATUS_CONFIG.NOVA_SOLICITACAO;
            const Icon = cfg.icon;
            const requester = profilesMap[req.real_requester_id] || profilesMap[req.created_by] || "Usuário";
            const amount = Number(req.amount).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

            return (
              <div 
                key={req.id} 
                className="flex items-center gap-4 py-3.5 first:pt-0 last:pb-0 group hover:bg-white/[0.02] -mx-2 px-2 rounded-xl transition-colors cursor-pointer"
              >
                <div 
                  className="w-8 h-8 rounded-xl flex items-center justify-center shrink-0 border"
                  style={{
                    backgroundColor: `${cfg.color}15`,
                    borderColor: `${cfg.color}35`,
                    color: cfg.color,
                  }}
                >
                  <Icon size={14} />
                </div>

                <div className="flex-1 min-w-0">
                  <p className="text-xs truncate font-semibold text-slate-200 group-hover:text-white transition-colors">
                    {req.title || "Solicitação"}
                  </p>
                  <p className="text-[11px] truncate mt-0.5 text-slate-400 font-mono">
                    {requester}
                  </p>
                </div>

                <div className="text-right shrink-0 flex flex-col items-end gap-1">
                  <span className="text-xs font-mono font-bold tracking-tight text-white group-hover:text-emerald-400 transition-colors">
                    {amount}
                  </span>
                  <div className="flex items-center gap-1.5">
                    <span className={`inline-block text-[9px] font-mono font-bold uppercase tracking-wider px-1.5 py-0.5 rounded border ${cfg.badgeCls}`}>
                      {cfg.label}
                    </span>
                    <span className="text-[10px] font-mono text-slate-500">
                      {formatTimeAgo(req.updated_at)}
                    </span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
