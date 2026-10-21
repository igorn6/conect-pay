"use client";

import { useEffect, useState } from "react";
import { DashboardProvider, useDashboard } from "@/contexts/DashboardContext";
import { useAuth } from "@/contexts/AuthContext";
import DashboardFilters from "@/components/dashboard/DashboardFilters";
import DashboardKPIs from "@/components/dashboard/DashboardKPIs";
import DashboardCharts from "@/components/dashboard/DashboardCharts";
import DashboardSla from "@/components/dashboard/DashboardSla";
import ShinyBadge from "@/components/ui/ShinyBadge";
import { BarChart3, ShieldCheck } from "lucide-react";

function DashboardContent() {
  const { startDate, endDate, selectedSectorId } = useDashboard();
  const { userId, userRole, sectorId } = useAuth();

  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchData() {
      if (!userId || !userRole) return;

      setLoading(true);
      try {
        const params = new URLSearchParams();
        params.append("userId", userId);
        params.append("userRole", userRole);
        if (sectorId) params.append("userSector", sectorId);
        if (selectedSectorId) params.append("selectedSectorId", selectedSectorId);
        if (startDate) params.append("startDate", startDate.toISOString());
        if (endDate) params.append("endDate", endDate.toISOString());

        const res = await fetch(`/api/dashboard?${params.toString()}`);
        if (!res.ok) throw new Error("Erro ao buscar dados do BI");

        const json = await res.json();
        setData(json);
      } catch (err) {
        console.error("Dashboard Fetch Error:", err);
      } finally {
        setLoading(false);
      }
    }

    fetchData();
  }, [userId, userRole, sectorId, selectedSectorId, startDate, endDate]);

  return (
    <div className="flex-1 flex flex-col h-full w-full min-h-0 overflow-y-auto atelier-scrollbar">
      <div className="max-w-[1440px] mx-auto p-4 md:p-8 w-full space-y-6">
        
        {/* Terminal Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-2 border-b border-white/5">
          <div>
            <div className="flex items-center gap-2.5">
              <div className="p-2 rounded-xl bg-white/[0.04] border border-white/10 text-slate-300">
                <BarChart3 size={20} />
              </div>
              <h1 className="text-2xl font-bold tracking-tight text-white flex items-center gap-2">
                Inteligência Financeira
              </h1>
              <ShinyBadge variant="neutral" className="hidden sm:inline-flex text-[10px] font-mono">
                BI Operacional
              </ShinyBadge>
            </div>
            <p className="text-xs text-slate-400 mt-1 font-mono">
              Consolidação analítica de saídas, aprovações, SLA e gargalos orçamentários.
            </p>
          </div>

          <div className="flex items-center gap-2 text-xs font-mono text-slate-400">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500/80" />
            <span>Dados Sincronizados</span>
          </div>
        </div>

        <DashboardFilters />

        {loading ? (
          <div className="flex flex-col gap-6 animate-pulse">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {[1, 2, 3].map((i) => (
                <div key={i} className="glass-panel h-[160px] rounded-2xl border border-white/10" />
              ))}
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {[1, 2, 3].map((i) => (
                <div key={i} className="glass-panel h-[130px] rounded-2xl border border-white/10" />
              ))}
            </div>
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              <div className="glass-panel h-[420px] rounded-2xl border border-white/10" />
              <div className="glass-panel h-[420px] rounded-2xl border border-white/10" />
              <div className="glass-panel h-[420px] rounded-2xl border border-white/10" />
            </div>
          </div>
        ) : data ? (
          <>
            <DashboardKPIs kpis={data.kpis} />
            <DashboardSla sla={data.sla} />
            <DashboardCharts data={data} />
          </>
        ) : (
          <div className="flex items-center justify-center h-48 glass-panel rounded-2xl border border-white/10 text-slate-400 font-mono text-xs">
            Falha ao carregar dashboard financeiro.
          </div>
        )}
      </div>
    </div>
  );
}

export default function DashboardPage() {
  return (
    <div className="flex flex-col h-full bg-transparent text-slate-100 overflow-hidden relative">
      <DashboardProvider>
        <DashboardContent />
      </DashboardProvider>
    </div>
  );
}
