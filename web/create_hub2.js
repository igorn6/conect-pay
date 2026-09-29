const fs = require('fs');
const path = require('path');

// === 3. HubRecentActivity.tsx ===
const activity = Buffer.from(`"use client";

import { CheckCircle2, Clock, AlertCircle, FileText, XCircle, Banknote } from "lucide-react";
import type { PaymentRequest } from "@/types/database";

interface HubRecentActivityProps {
  activities: PaymentRequest[];
  profilesMap: Record<string, string>;
  isLoading: boolean;
}

const STATUS_CONFIG: Record<string, { icon: typeof Clock; color: string; label: string }> = {
  NOVA_SOLICITACAO: { icon: FileText, color: "text-amber-400", label: "Nova" },
  EM_APROVACAO: { icon: Clock, color: "text-blue-400", label: "Em Aprova\u00e7\u00e3o" },
  AGUARDANDO_NOTINHA: { icon: AlertCircle, color: "text-orange-400", label: "Aguardando Nota" },
  PAGAMENTO_FINALIZADO: { icon: CheckCircle2, color: "text-emerald-400", label: "Finalizado" },
  RECUSADO: { icon: XCircle, color: "text-red-400", label: "Recusado" },
};

function SkeletonRow() {
  return (
    <div className="flex items-center gap-4 py-3 animate-pulse">
      <div className="w-8 h-8 rounded-full bg-slate-700" />
      <div className="flex-1">
        <div className="h-3.5 w-40 bg-slate-700 rounded mb-1.5" />
        <div className="h-3 w-24 bg-slate-700 rounded" />
      </div>
      <div className="h-3 w-16 bg-slate-700 rounded" />
    </div>
  );
}

function formatTimeAgo(dateStr: string): string {
  const now = new Date();
  const d = new Date(dateStr);
  const diffMs = now.getTime() - d.getTime();
  const diffMin = Math.floor(diffMs / 60000);
  if (diffMin < 1) return "Agora";
  if (diffMin < 60) return diffMin + " min atr\u00e1s";
  const diffH = Math.floor(diffMin / 60);
  if (diffH < 24) return diffH + "h atr\u00e1s";
  const diffD = Math.floor(diffH / 24);
  if (diffD === 1) return "Ontem";
  return diffD + " dias atr\u00e1s";
}

export default function HubRecentActivity({ activities, profilesMap, isLoading }: HubRecentActivityProps) {
  return (
    <div className="bg-slate-800 border border-slate-700 rounded-2xl p-5">
      <h2 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
        <Banknote size={20} className="text-emerald-500" />
        \u00daltimas Movimenta\u00e7\u00f5es
      </h2>

      {isLoading ? (
        <div className="divide-y divide-slate-700/50">
          <SkeletonRow />
          <SkeletonRow />
          <SkeletonRow />
          <SkeletonRow />
          <SkeletonRow />
        </div>
      ) : activities.length === 0 ? (
        <p className="text-sm text-slate-400 text-center py-8">Nenhuma movimenta\u00e7\u00e3o recente.</p>
      ) : (
        <div className="divide-y divide-slate-700/50">
          {activities.map((req) => {
            const cfg = STATUS_CONFIG[req.status] || STATUS_CONFIG.NOVA_SOLICITACAO;
            const Icon = cfg.icon;
            const requester = profilesMap[req.real_requester_id] || profilesMap[req.created_by] || "Usu\u00e1rio";
            const amount = Number(req.amount).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

            return (
              <div key={req.id} className="flex items-center gap-4 py-3 first:pt-0 last:pb-0">
                <div className={"w-8 h-8 rounded-full flex items-center justify-center bg-slate-700/50 " + cfg.color}>
                  <Icon size={16} />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-white truncate font-medium">
                    {req.title || "Solicita\u00e7\u00e3o"}
                  </p>
                  <p className="text-xs text-slate-400 truncate">
                    {requester} \u00b7 {amount}
                  </p>
                </div>
                <div className="text-right shrink-0">
                  <span className={"text-xs font-medium " + cfg.color}>{cfg.label}</span>
                  <p className="text-[10px] text-slate-500 mt-0.5">{formatTimeAgo(req.updated_at)}</p>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
`).toString('base64');

fs.writeFileSync(
  path.join(process.cwd(), "src/components/hub/HubRecentActivity.tsx"),
  Buffer.from(activity, 'base64')
);

console.log("HubRecentActivity created.");
