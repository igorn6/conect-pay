"use client";

import { CheckCircle2, Clock, AlertCircle, FileText, XCircle, Banknote } from "lucide-react";
import type { PaymentRequest } from "@/types/database";

interface HubRecentActivityProps {
  activities: PaymentRequest[];
  profilesMap: Record<string, string>;
  isLoading: boolean;
}

const STATUS_CONFIG: Record<string, { icon: typeof Clock; color: string; bg: string; label: string }> = {
  NOVA_SOLICITACAO: { icon: FileText, color: "text-slate-600 dark:text-slate-400", bg: "bg-slate-100 dark:bg-slate-800", label: "Nova" },
  EM_APROVACAO: { icon: Clock, color: "text-amber-600 dark:text-amber-400", bg: "bg-amber-100 dark:bg-amber-950/50", label: "Pendente" },
  VALIDACAO_GESTOR: { icon: Clock, color: "text-purple-600 dark:text-purple-400", bg: "bg-purple-100 dark:bg-purple-950/50", label: "Validação Gestor" },
  CORRECAO_PENDENTE: { icon: AlertCircle, color: "text-orange-600 dark:text-orange-400", bg: "bg-orange-100 dark:bg-orange-950/50", label: "Correção" },
  VALIDADO_GESTOR: { icon: CheckCircle2, color: "text-fuchsia-600 dark:text-fuchsia-400", bg: "bg-fuchsia-100 dark:bg-fuchsia-950/50", label: "Validado Gestor" },
  AGUARDANDO_PAGAMENTO: { icon: Clock, color: "text-blue-600 dark:text-blue-400", bg: "bg-blue-100 dark:bg-blue-950/50", label: "Aguardando Pgto" },
  FINALIZADO: { icon: CheckCircle2, color: "text-emerald-600 dark:text-emerald-400", bg: "bg-emerald-100 dark:bg-emerald-950/50", label: "Finalizado" },
  RECUSADO: { icon: XCircle, color: "text-red-600 dark:text-red-400", bg: "bg-red-100 dark:bg-red-950/50", label: "Recusado" },
  // Fallbacks para compatibilidade
  PAGAMENTO_FINALIZADO: { icon: CheckCircle2, color: "text-emerald-600 dark:text-emerald-400", bg: "bg-emerald-100 dark:bg-emerald-950/50", label: "Finalizado" },
  AGUARDANDO_NOTINHA: { icon: AlertCircle, color: "text-blue-600 dark:text-blue-400", bg: "bg-blue-100 dark:bg-blue-950/50", label: "Aguardando Pgto" },
};

function SkeletonRow() {
  return (
    <div className="flex items-center gap-4 py-3 animate-pulse">
      <div className="w-8 h-8 rounded-full bg-slate-700/30" />
      <div className="flex-1">
        <div className="h-3.5 w-40 bg-slate-700/30 rounded mb-1.5" />
        <div className="h-3 w-24 bg-slate-700/30 rounded" />
      </div>
      <div className="h-3 w-16 bg-slate-700/30 rounded" />
    </div>
  );
}

function formatTimeAgo(dateStr: string): string {
  const now = new Date();
  const d = new Date(dateStr);
  const diffMs = now.getTime() - d.getTime();
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
    <div
      className="rounded-2xl p-5 border shadow-xs"
      style={{
        backgroundColor: "var(--bg-card)",
        borderColor: "var(--surface-border)",
      }}
    >
      <h2
        className="text-lg font-semibold mb-4 flex items-center gap-2"
        style={{ color: "var(--text-primary)" }}
      >
        <Banknote size={20} className="text-emerald-500" />
        Últimas Movimentações
      </h2>

      {isLoading ? (
        <div className="divide-y" style={{ borderColor: "var(--surface-border)" }}>
          <SkeletonRow />
          <SkeletonRow />
          <SkeletonRow />
          <SkeletonRow />
          <SkeletonRow />
        </div>
      ) : activities.length === 0 ? (
        <p className="text-sm text-center py-8" style={{ color: "var(--text-muted)" }}>
          Nenhuma movimentação recente.
        </p>
      ) : (
        <div className="divide-y" style={{ borderColor: "var(--surface-border)" }}>
          {activities.map((req) => {
            const cfg = STATUS_CONFIG[req.status] || STATUS_CONFIG.NOVA_SOLICITACAO;
            const Icon = cfg.icon;
            const requester = profilesMap[req.real_requester_id] || profilesMap[req.created_by] || "Usuário";
            const amount = Number(req.amount).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

            return (
              <div key={req.id} className="flex items-center gap-4 py-3 first:pt-0 last:pb-0">
                <div className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${cfg.bg} ${cfg.color}`}>
                  <Icon size={18} />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm truncate font-medium" style={{ color: "var(--text-primary)" }}>
                    {req.title || "Solicitação"}
                  </p>
                  <p className="text-xs truncate mt-0.5" style={{ color: "var(--text-secondary)" }}>
                    {requester} · {amount}
                  </p>
                </div>
                <div className="text-right shrink-0">
                  <span className={`inline-block text-xs font-semibold px-2 py-0.5 rounded-md ${cfg.bg} ${cfg.color}`}>
                    {cfg.label}
                  </span>
                  <p className="text-[11px] mt-0.5" style={{ color: "var(--text-muted)" }}>
                    {formatTimeAgo(req.updated_at)}
                  </p>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
