"use client";

import { Clock, Hourglass, CheckCircle2, ArrowRight } from "lucide-react";
import type { DashboardSlaAverages } from "@/utils/sla";

interface DashboardSlaProps {
  sla?: DashboardSlaAverages;
}

export default function DashboardSla({ sla }: DashboardSlaProps) {
  if (!sla) return null;

  return (
    <div className="mb-6">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <Clock className="w-5 h-5 text-indigo-400" />
          <h2 className="text-base font-semibold text-white tracking-wide">
            Médias de SLA & Tempo de Atendimento
          </h2>
        </div>
        <span className="text-xs text-slate-400">
          Métricas calculadas com base nas transições de etapa
        </span>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Card 1: Nova Solicitação -> Pendente */}
        <div className="bg-slate-800 p-6 rounded-2xl border border-indigo-500/20 shadow-[0_0_15px_rgba(99,102,241,0.08)] relative overflow-hidden group hover:border-indigo-500/40 transition-all">
          <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-15 transition-opacity">
            <Clock size={80} className="text-indigo-400" />
          </div>
          <div className="flex items-center gap-3 mb-2">
            <div className="p-2 bg-indigo-500/10 rounded-lg text-indigo-400">
              <Hourglass size={20} />
            </div>
            <div>
              <h3 className="text-slate-300 font-medium text-sm flex items-center gap-1.5">
                Nova Solicitação <ArrowRight className="w-3 h-3 text-slate-400" /> Pendente
              </h3>
              <p className="text-[11px] text-slate-400">Tempo de validação e triagem</p>
            </div>
          </div>
          <div className="mt-3">
            <p className="text-3xl font-black text-white tracking-tight">
              {sla.avgNovaToPendenteFormatted}
            </p>
            <p className="text-xs text-slate-400 mt-1">
              Baseado em <strong className="text-slate-200">{sla.countNovaToPendente}</strong> {sla.countNovaToPendente === 1 ? "solicitação" : "solicitações"}
            </p>
          </div>
        </div>

        {/* Card 2: Pendente -> Finalizado */}
        <div className="bg-slate-800 p-6 rounded-2xl border border-emerald-500/20 shadow-[0_0_15px_rgba(16,185,129,0.08)] relative overflow-hidden group hover:border-emerald-500/40 transition-all">
          <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-15 transition-opacity">
            <CheckCircle2 size={80} className="text-emerald-400" />
          </div>
          <div className="flex items-center gap-3 mb-2">
            <div className="p-2 bg-emerald-500/10 rounded-lg text-emerald-400">
              <CheckCircle2 size={20} />
            </div>
            <div>
              <h3 className="text-slate-300 font-medium text-sm flex items-center gap-1.5">
                Pendente <ArrowRight className="w-3 h-3 text-slate-400" /> Finalizado
              </h3>
              <p className="text-[11px] text-slate-400">Tempo do financeiro até o pagamento</p>
            </div>
          </div>
          <div className="mt-3">
            <p className="text-3xl font-black text-white tracking-tight">
              {sla.avgPendenteToFinalizadoFormatted}
            </p>
            <p className="text-xs text-slate-400 mt-1">
              Baseado em <strong className="text-slate-200">{sla.countPendenteToFinalizado}</strong> {sla.countPendenteToFinalizado === 1 ? "pagamento finalizado" : "pagamentos finalizados"}
            </p>
          </div>
        </div>

        {/* Card 3: Ciclo Total */}
        <div className="bg-slate-800 p-6 rounded-2xl border border-sky-500/20 shadow-[0_0_15px_rgba(14,165,233,0.08)] relative overflow-hidden group hover:border-sky-500/40 transition-all">
          <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-15 transition-opacity">
            <Clock size={80} className="text-sky-400" />
          </div>
          <div className="flex items-center gap-3 mb-2">
            <div className="p-2 bg-sky-500/10 rounded-lg text-sky-400">
              <Clock size={20} />
            </div>
            <div>
              <h3 className="text-slate-300 font-medium text-sm">Ciclo Médio Total</h3>
              <p className="text-[11px] text-slate-400">Desde a abertura até a liquidação</p>
            </div>
          </div>
          <div className="mt-3">
            <p className="text-3xl font-black text-white tracking-tight">
              {sla.avgTotalCycleFormatted}
            </p>
            <p className="text-xs text-slate-400 mt-1">
              Baseado em <strong className="text-slate-200">{sla.countTotalFinalizados}</strong> {sla.countTotalFinalizados === 1 ? "ciclo concluído" : "ciclos concluídos"}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
