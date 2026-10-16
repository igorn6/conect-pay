"use client";

import { useDashboard } from "@/contexts/DashboardContext";
import { useAuth } from "@/contexts/AuthContext";
import { useSectors } from "@/hooks/useSectors";
import { format, parseISO, isValid } from "date-fns";
import { Calendar, Filter, Sparkles } from "lucide-react";

export default function DashboardFilters() {
  const { startDate, setStartDate, endDate, setEndDate, selectedSectorId, setSelectedSectorId } = useDashboard();
  const { userRole } = useAuth();
  const { sectors } = useSectors();

  const handleStartDate = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    if (val) {
      const parsed = parseISO(val);
      if (isValid(parsed)) setStartDate(parsed);
    }
  };

  const handleEndDate = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    if (val) {
      const parsed = parseISO(val);
      if (isValid(parsed)) setEndDate(parsed);
    }
  };

  return (
    <div className="flex flex-col md:flex-row gap-4 mb-6 p-4 rounded-2xl border border-white/10 glass-panel items-center justify-between shadow-lg">
      <div className="flex items-center gap-2.5">
        <div className="p-2 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400">
          <Filter size={16} />
        </div>
        <div>
          <h2 className="text-xs uppercase font-mono tracking-wider font-bold text-white">
            Parâmetros de Auditoria
          </h2>
          <p className="text-[11px] text-slate-400">Filtre por recorte temporal e centro de custo</p>
        </div>
      </div>

      <div className="flex flex-col sm:flex-row gap-3 w-full md:w-auto">
        <div className="flex items-center gap-2 px-3 py-2 rounded-xl border border-white/10 bg-slate-950/60 backdrop-blur-md">
          <Calendar size={15} className="text-emerald-400 shrink-0" />
          <input
            type="date"
            value={format(startDate, "yyyy-MM-dd")}
            onChange={handleStartDate}
            className="bg-transparent text-xs font-mono text-slate-200 outline-none w-[125px] color-scheme-dark cursor-pointer"
          />
          <span className="text-slate-500 text-xs font-mono">até</span>
          <input
            type="date"
            value={format(endDate, "yyyy-MM-dd")}
            onChange={handleEndDate}
            className="bg-transparent text-xs font-mono text-slate-200 outline-none w-[125px] color-scheme-dark cursor-pointer"
          />
        </div>

        {userRole === "MASTER" && (
          <select
            value={selectedSectorId || ""}
            onChange={(e) => setSelectedSectorId(e.target.value || null)}
            className="border border-white/10 bg-slate-950/60 backdrop-blur-md text-slate-200 text-xs font-mono rounded-xl px-3 py-2 outline-none min-w-[180px] cursor-pointer"
          >
            <option value="" className="bg-slate-900 text-slate-200">Todos os Setores</option>
            {sectors.map((s) => (
              <option key={s.id} value={s.id} className="bg-slate-900 text-slate-200">
                {s.name}
              </option>
            ))}
          </select>
        )}
      </div>
    </div>
  );
}
