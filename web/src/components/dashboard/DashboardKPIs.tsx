"use client";

import { DollarSign, AlertCircle, XCircle } from "lucide-react";

interface KPIProps {
  kpis: {
    totalGasto: number;
    totalPendente: number;
    totalRecusado: number;
  };
}

export default function DashboardKPIs({ kpis }: KPIProps) {
  const formatValue = (val: number) => {
    return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(val);
  };

  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
      <div className="bg-slate-800 p-6 rounded-2xl border border-brand-primary/20 shadow-[0_0_15px_rgba(20,184,166,0.1)] relative overflow-hidden">
        <div className="absolute top-0 right-0 p-4 opacity-10">
          <DollarSign size={80} className="text-brand-primary" />
        </div>
        <div className="flex items-center gap-3 mb-2">
          <div className="p-2 bg-brand-primary/10 rounded-lg text-brand-primary">
            <DollarSign size={20} />
          </div>
          <h3 className="text-slate-400 font-medium">Total Gasto (Finalizado)</h3>
        </div>
        <p className="text-3xl font-black text-white">{formatValue(kpis.totalGasto)}</p>
      </div>

      <div className="bg-slate-800 p-6 rounded-2xl border border-amber-500/20 shadow-[0_0_15px_rgba(245,158,11,0.1)] relative overflow-hidden">
        <div className="absolute top-0 right-0 p-4 opacity-10">
          <AlertCircle size={80} className="text-amber-500" />
        </div>
        <div className="flex items-center gap-3 mb-2">
          <div className="p-2 bg-amber-500/10 rounded-lg text-amber-500">
            <AlertCircle size={20} />
          </div>
          <h3 className="text-slate-400 font-medium">Pagamento Pendente</h3>
        </div>
        <p className="text-3xl font-black text-white">{formatValue(kpis.totalPendente)}</p>
      </div>

      <div className="bg-slate-800 p-6 rounded-2xl border border-red-500/20 shadow-[0_0_15px_rgba(239,68,68,0.1)] relative overflow-hidden">
        <div className="absolute top-0 right-0 p-4 opacity-10">
          <XCircle size={80} className="text-red-500" />
        </div>
        <div className="flex items-center gap-3 mb-2">
          <div className="p-2 bg-red-500/10 rounded-lg text-red-500">
            <XCircle size={20} />
          </div>
          <h3 className="text-slate-400 font-medium">Recusados / Cancelados</h3>
        </div>
        <p className="text-3xl font-black text-white">{formatValue(kpis.totalRecusado)}</p>
      </div>
    </div>
  );
}
