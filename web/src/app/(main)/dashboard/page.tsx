"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Header from "@/components/Header";
import { Loader2 } from "lucide-react";
import { DashboardProvider, useDashboard } from "@/contexts/DashboardContext";
import { useAuth } from "@/contexts/AuthContext";
import DashboardFilters from "@/components/dashboard/DashboardFilters";
import DashboardKPIs from "@/components/dashboard/DashboardKPIs";
import DashboardCharts from "@/components/dashboard/DashboardCharts";

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
    <div className="flex-1 overflow-y-auto w-full">
      <div className="max-w-[1400px] mx-auto p-4 md:p-6 w-full">
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-white tracking-tight">Inteligência Financeira</h1>
          <p className="text-sm text-slate-400 mt-1">
            Visão geral de saídas, aprovações e categorias.
          </p>
        </div>

        <DashboardFilters />

        {loading ? (
          <div className="flex flex-col gap-6 animate-pulse">
            {/* Skeletons KPIs */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
              {[1, 2, 3].map(i => (
                <div key={i} className="bg-slate-800/50 h-[140px] rounded-2xl border border-slate-700/50"></div>
              ))}
            </div>
            {/* Skeletons Charts Row 1 */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              <div className="bg-slate-800/50 h-[380px] rounded-2xl border border-slate-700/50"></div>
              {userRole === "MASTER" ? (
                <>
                  <div className="bg-slate-800/50 h-[380px] rounded-2xl border border-slate-700/50"></div>
                  <div className="bg-slate-800/50 h-[380px] rounded-2xl border border-slate-700/50"></div>
                </>
              ) : (
                <div className="bg-slate-800/50 h-[380px] rounded-2xl border border-slate-700/50 lg:col-span-2"></div>
              )}
            </div>
            {/* Skeleton Area Chart */}
            <div className="bg-slate-800/50 h-[400px] rounded-2xl border border-slate-700/50"></div>
          </div>
        ) : data ? (
          <>
            <DashboardKPIs kpis={data.kpis} />
            <DashboardCharts data={data} />
          </>
        ) : (
          <div className="flex items-center justify-center h-40 text-slate-400">
            Falha ao carregar dashboard.
          </div>
        )}
      </div>
    </div>
  );
}

export default function DashboardPage() {
  return (
    <div className="flex flex-col h-full bg-slate-900 text-slate-100 overflow-hidden">
      <Header onNewRequest={() => { window.location.href = "/"; }} />
      <DashboardProvider>
        <DashboardContent />
      </DashboardProvider>
    </div>
  );
}
