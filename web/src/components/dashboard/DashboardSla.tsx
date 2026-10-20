"use client";

import { Clock, Hourglass, CheckCircle2, ArrowRight, Gauge } from "lucide-react";
import type { DashboardSlaAverages } from "@/utils/sla";
import SpotlightCard from "@/components/ui/SpotlightCard";
import ShinyBadge from "@/components/ui/ShinyBadge";

interface DashboardSlaProps {
  sla?: DashboardSlaAverages;
}

export default function DashboardSla({ sla }: DashboardSlaProps) {
  if (!sla) return null;

  return (
    <div className="mb-8">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2.5">
          <div className="p-2 rounded-lg bg-white/[0.04] border border-white/10 text-slate-300">
            <Gauge size={16} />
          </div>
          <div>
            <h2 className="text-sm uppercase font-mono tracking-wider font-bold text-white">
              Velocidade Operacional & SLA de Pagamentos
            </h2>
            <p className="text-xs text-slate-400 mt-0.5">
              Latência média e throughput por fase de governança
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-white/[0.04] border border-white/10 text-[10px] font-mono text-slate-400">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500/80" />
            Horário Comercial (Seg–Sex, 08h às 18h)
          </span>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
        
        {/* Card 1: Triagem & Aprovação */}
        <SpotlightCard
          spotlightColor="rgba(255, 255, 255, 0.05)"
          borderColor="rgba(255, 255, 255, 0.1)"
          className="p-5 glass-panel-elevated relative group"
        >
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <Hourglass size={16} className="text-slate-400" />
              <span className="text-xs font-semibold text-slate-300">Triagem Inicial</span>
            </div>
            <ShinyBadge variant="neutral" className="text-[10px]">
              Nova ➔ Pendente
            </ShinyBadge>
          </div>

          <div className="mt-2">
            <p className="text-2xl sm:text-3xl font-black font-mono text-white tracking-tight">
              {sla.avgNovaToPendenteFormatted}
            </p>
            <p className="text-[11px] text-slate-400 mt-1 font-mono">
              Amostra de <strong className="text-slate-200">{sla.countNovaToPendente}</strong> {sla.countNovaToPendente === 1 ? "solicitação" : "solicitações"}
            </p>
          </div>

          <div className="mt-3 pt-2.5 border-t border-white/5 text-[10px] text-slate-400 font-mono">
            Tempo gasto entre validação e envio ao financeiro
          </div>
        </SpotlightCard>

        {/* Card 2: Liquidação Financeira */}
        <SpotlightCard
          spotlightColor="rgba(255, 255, 255, 0.05)"
          borderColor="rgba(255, 255, 255, 0.1)"
          className="p-5 glass-panel-elevated relative group"
        >
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <CheckCircle2 size={16} className="text-slate-400" />
              <span className="text-xs font-semibold text-slate-300">Liquidação Bancária</span>
            </div>
            <ShinyBadge variant="neutral" className="text-[10px]">
              Pendente ➔ Pago
            </ShinyBadge>
          </div>

          <div className="mt-2">
            <p className="text-2xl sm:text-3xl font-black font-mono text-white tracking-tight">
              {sla.avgPendenteToFinalizadoFormatted}
            </p>
            <p className="text-[11px] text-slate-400 mt-1 font-mono">
              Amostra de <strong className="text-slate-200">{sla.countPendenteToFinalizado}</strong> {sla.countPendenteToFinalizado === 1 ? "pagamento" : "pagamentos"}
            </p>
          </div>

          <div className="mt-3 pt-2.5 border-t border-white/5 text-[10px] text-slate-400 font-mono">
            Tempo de baixa efetiva e comprovante
          </div>
        </SpotlightCard>

        {/* Card 3: Ciclo Completo */}
        <SpotlightCard
          spotlightColor="rgba(255, 255, 255, 0.05)"
          borderColor="rgba(255, 255, 255, 0.1)"
          className="p-5 glass-panel-elevated relative group"
        >
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <Clock size={16} className="text-slate-400" />
              <span className="text-xs font-semibold text-slate-300">Ciclo Total Médio</span>
            </div>
            <ShinyBadge variant="neutral" className="text-[10px]">
              Lead Time
            </ShinyBadge>
          </div>

          <div className="mt-2">
            <p className="text-2xl sm:text-3xl font-black font-mono text-white tracking-tight">
              {sla.avgTotalCycleFormatted}
            </p>
            <p className="text-[11px] text-slate-400 mt-1 font-mono">
              Amostra de <strong className="text-slate-200">{sla.countTotalFinalizados}</strong> {sla.countTotalFinalizados === 1 ? "ciclo concluído" : "ciclos"}
            </p>
          </div>

          <div className="mt-3 pt-2.5 border-t border-white/5 text-[10px] text-slate-400 font-mono">
            Desde a inserção inicial até o encerramento do processo
          </div>
        </SpotlightCard>
      </div>
    </div>
  );
}
