"use client";

import { DollarSign, AlertCircle, XCircle, TrendingUp, Clock, ArrowUpRight } from "lucide-react";
import SpotlightCard from "@/components/ui/SpotlightCard";
import TiltCard from "@/components/ui/TiltCard";
import CountUp from "@/components/ui/CountUp";
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
        
        {/* KPI 1: Total Gasto (Liquid Emerald) */}
        <TiltCard maxTilt={5} glare={true}>
          <SpotlightCard
            spotlightColor="rgba(16, 185, 129, 0.16)"
            borderColor="rgba(16, 185, 129, 0.22)"
            className="h-full p-6 glass-panel-elevated relative group"
          >
            <div className="flex items-center justify-between gap-2 mb-3">
              <div className="flex items-center gap-2.5">
                <div className="p-2.5 rounded-xl bg-emerald-500/15 border border-emerald-500/30 text-emerald-400 shadow-sm shadow-emerald-950/40">
                  <TrendingUp size={18} />
                </div>
                <div>
                  <h3 className="text-xs uppercase font-mono tracking-wider text-emerald-300/90 font-bold">
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
                <CountUp to={kpis.totalGasto} />
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

        {/* KPI 2: Pagamentos Pendentes (Warm Amber) */}
        <TiltCard maxTilt={5} glare={true}>
          <SpotlightCard
            spotlightColor="rgba(245, 158, 11, 0.16)"
            borderColor="rgba(245, 158, 11, 0.22)"
            className="h-full p-6 glass-panel-elevated relative group"
          >
            <div className="flex items-center justify-between gap-2 mb-3">
              <div className="flex items-center gap-2.5">
                <div className="p-2.5 rounded-xl bg-amber-500/15 border border-amber-500/30 text-amber-400 shadow-sm shadow-amber-950/40">
                  <Clock size={18} />
                </div>
                <div>
                  <h3 className="text-xs uppercase font-mono tracking-wider text-amber-300/90 font-bold">
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
                <CountUp to={kpis.totalPendente} />
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

        {/* KPI 3: Recusados / Cancelados (Refined Garnet) */}
        <TiltCard maxTilt={5} glare={true}>
          <SpotlightCard
            spotlightColor="rgba(239, 68, 68, 0.14)"
            borderColor="rgba(239, 68, 68, 0.2)"
            className="h-full p-6 glass-panel-elevated relative group"
          >
            <div className="flex items-center justify-between gap-2 mb-3">
              <div className="flex items-center gap-2.5">
                <div className="p-2.5 rounded-xl bg-rose-500/15 border border-rose-500/30 text-rose-400 shadow-sm shadow-rose-950/40">
                  <XCircle size={18} />
                </div>
                <div>
                  <h3 className="text-xs uppercase font-mono tracking-wider text-rose-300/90 font-bold">
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
                <CountUp to={kpis.totalRecusado} />
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
          <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
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
