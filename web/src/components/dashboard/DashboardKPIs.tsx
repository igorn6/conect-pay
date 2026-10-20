"use client";

import { DollarSign, AlertCircle, XCircle, TrendingUp, Clock, ArrowUpRight } from "lucide-react";
import SpotlightCard from "@/components/ui/SpotlightCard";
import TiltCard from "@/components/ui/TiltCard";
import CountUp from "@/components/ui/CountUp";
import AnimatedCurrency from "@/components/ui/AnimatedCurrency";
import ShinyBadge from "@/components/ui/ShinyBadge";

interface KPIProps {
  kpis: {
    totalGasto: number;
    totalPendente: number;
    totalRecusado: number;
  };
}

export default function DashboardKPIs({ kpis }: KPIProps) {
  const totalVolume = kpis.totalGasto + kpis.totalPendente + kpis.totalRecusado || 1;
  const pctGasto = Math.round((kpis.totalGasto / totalVolume) * 100);
  const pctPendente = Math.round((kpis.totalPendente / totalVolume) * 100);
  const pctRecusado = Math.round((kpis.totalRecusado / totalVolume) * 100);

  return (
    <div className="space-y-4 mb-8">
      {/* KPI Cards Grid com 3D Tilt e Specular Cursor Tracking */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
        
        {/* KPI 1: Total Gasto */}
        <TiltCard maxTilt={5} glare={true}>
          <SpotlightCard
            spotlightColor="rgba(255, 255, 255, 0.05)"
            borderColor="rgba(255, 255, 255, 0.1)"
            className="h-full p-6 glass-panel-elevated relative group"
          >
            <div className="flex items-center justify-between gap-2 mb-3">
              <div className="flex items-center gap-2.5">
                <div className="p-2.5 rounded-xl bg-white/[0.04] border border-white/10 text-emerald-400 shadow-xs">
                  <TrendingUp size={18} />
                </div>
                <div>
                  <h3 className="text-xs uppercase font-mono tracking-wider text-slate-200 font-bold">
                    Total Liquidado
                  </h3>
                  <p className="text-[11px] text-slate-400">Pagamentos finalizados</p>
                </div>
              </div>
              <ShinyBadge variant="emerald" className="text-[10px]">
                {pctGasto}% do total
              </ShinyBadge>
            </div>

            <div className="mt-4">
              <p className="text-3xl sm:text-4xl font-black text-white tracking-tight">
                <AnimatedCurrency value={kpis.totalGasto} prefix="R$ " prefixClassName="text-xl sm:text-2xl font-normal opacity-85 mr-1" />
              </p>
            </div>

            {/* Micro Progress Bar */}
            <div className="mt-4 pt-3 border-t border-white/5 flex items-center justify-between text-[11px] text-slate-400 font-mono">
              <span>Execução confirmada</span>
              <span className="text-emerald-400 font-semibold flex items-center gap-1">
                Ativo <ArrowUpRight size={12} />
              </span>
            </div>
          </SpotlightCard>
        </TiltCard>

        {/* KPI 2: Pagamentos Pendentes */}
        <TiltCard maxTilt={5} glare={true}>
          <SpotlightCard
            spotlightColor="rgba(255, 255, 255, 0.05)"
            borderColor="rgba(255, 255, 255, 0.1)"
            className="h-full p-6 glass-panel-elevated relative group"
          >
            <div className="flex items-center justify-between gap-2 mb-3">
              <div className="flex items-center gap-2.5">
                <div className="p-2.5 rounded-xl bg-white/[0.04] border border-white/10 text-amber-400 shadow-xs">
                  <Clock size={18} />
                </div>
                <div>
                  <h3 className="text-xs uppercase font-mono tracking-wider text-slate-200 font-bold">
                    Em Tramitação
                  </h3>
                  <p className="text-[11px] text-slate-400">Aguardando aprovação / baixa</p>
                </div>
              </div>
              <ShinyBadge variant="amber" className="text-[10px]">
                {pctPendente}% pendente
              </ShinyBadge>
            </div>

            <div className="mt-4">
              <p className="text-3xl sm:text-4xl font-black text-white tracking-tight">
                <AnimatedCurrency value={kpis.totalPendente} prefix="R$ " prefixClassName="text-xl sm:text-2xl font-normal opacity-85 mr-1" />
              </p>
            </div>

            {/* Micro Progress Bar */}
            <div className="mt-4 pt-3 border-t border-white/5 flex items-center justify-between text-[11px] text-slate-400 font-mono">
              <span>Comprometimento previsto</span>
              <span className="text-amber-400 font-semibold flex items-center gap-1">
                Fila Kanban
              </span>
            </div>
          </SpotlightCard>
        </TiltCard>

        {/* KPI 3: Recusados / Cancelados */}
        <TiltCard maxTilt={5} glare={true}>
          <SpotlightCard
            spotlightColor="rgba(255, 255, 255, 0.05)"
            borderColor="rgba(255, 255, 255, 0.1)"
            className="h-full p-6 glass-panel-elevated relative group"
          >
            <div className="flex items-center justify-between gap-2 mb-3">
              <div className="flex items-center gap-2.5">
                <div className="p-2.5 rounded-xl bg-white/[0.04] border border-white/10 text-rose-400 shadow-xs">
                  <XCircle size={18} />
                </div>
                <div>
                  <h3 className="text-xs uppercase font-mono tracking-wider text-slate-200 font-bold">
                    Recusados / Glosas
                  </h3>
                  <p className="text-[11px] text-slate-400">Cancelados pela governança</p>
                </div>
              </div>
              <ShinyBadge variant="rose" className="text-[10px]">
                {pctRecusado}% do total
              </ShinyBadge>
            </div>

            <div className="mt-4">
              <p className="text-3xl sm:text-4xl font-black text-white tracking-tight">
                <AnimatedCurrency value={kpis.totalRecusado} prefix="R$ " prefixClassName="text-xl sm:text-2xl font-normal opacity-85 mr-1" />
              </p>
            </div>

            {/* Micro Progress Bar */}
            <div className="mt-4 pt-3 border-t border-white/5 flex items-center justify-between text-[11px] text-slate-400 font-mono">
              <span>Retidos na triagem</span>
              <span className="text-rose-400 font-semibold">Auditados</span>
            </div>
          </SpotlightCard>
        </TiltCard>
      </div>

      {/* Terminal Ratio Strip: Balanço Proporcional */}
      <div className="p-4 rounded-xl border border-white/10 bg-slate-900/60 backdrop-blur-md flex flex-col sm:flex-row items-center justify-between gap-3 text-xs font-mono">
        <div className="flex items-center gap-2 text-slate-400">
          <span className="w-1.5 h-1.5 rounded-full bg-slate-400" />
          <span>Distribuição Financeira Global:</span>
        </div>
        
        <div className="flex-1 w-full sm:max-w-md h-2 rounded-full bg-slate-800 overflow-hidden flex shadow-inner">
          <div style={{ width: `${pctGasto}%` }} className="bg-emerald-500 transition-all duration-1000" title={`Liquidado: ${pctGasto}%`} />
          <div style={{ width: `${pctPendente}%` }} className="bg-amber-500 transition-all duration-1000" title={`Pendente: ${pctPendente}%`} />
          <div style={{ width: `${pctRecusado}%` }} className="bg-rose-500 transition-all duration-1000" title={`Recusado: ${pctRecusado}%`} />
        </div>

        <div className="flex items-center gap-3 text-[11px] text-slate-300">
          <span className="text-emerald-400">{pctGasto}% liq.</span>
          <span className="text-amber-400">{pctPendente}% pend.</span>
          <span className="text-rose-400">{pctRecusado}% rec.</span>
        </div>
      </div>
    </div>
  );
}
