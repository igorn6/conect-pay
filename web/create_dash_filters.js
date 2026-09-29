const fs = require('fs');
const path = require('path');

const code = `"use client";

import { useDashboard } from "@/contexts/DashboardContext";
import { useAuth } from "@/contexts/AuthContext";
import { useSectors } from "@/hooks/useSectors";
import { format, parseISO, isValid } from "date-fns";
import { Calendar, Filter } from "lucide-react";

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
    <div className="flex flex-col md:flex-row gap-4 mb-6 p-4 bg-slate-800 rounded-xl border border-slate-700 items-center justify-between">
      <div className="flex items-center gap-2">
        <Filter className="text-slate-400" size={18} />
        <h2 className="text-sm font-semibold text-slate-200">Filtros Avan\u00e7ados</h2>
      </div>

      <div className="flex flex-col sm:flex-row gap-4 w-full md:w-auto">
        <div className="flex items-center gap-2 bg-slate-900 px-3 py-1.5 rounded-lg border border-slate-700">
          <Calendar size={16} className="text-slate-400" />
          <input
            type="date"
            value={format(startDate, "yyyy-MM-dd")}
            onChange={handleStartDate}
            className="bg-transparent text-sm text-slate-200 outline-none w-[120px] color-scheme-dark"
          />
          <span className="text-slate-500">at\u00e9</span>
          <input
            type="date"
            value={format(endDate, "yyyy-MM-dd")}
            onChange={handleEndDate}
            className="bg-transparent text-sm text-slate-200 outline-none w-[120px] color-scheme-dark"
          />
        </div>

        {userRole === "MASTER" && (
          <select
            value={selectedSectorId || ""}
            onChange={(e) => setSelectedSectorId(e.target.value || null)}
            className="bg-slate-900 border border-slate-700 text-slate-200 text-sm rounded-lg px-3 py-2 outline-none min-w-[180px]"
          >
            <option value="">Todos os Setores (Global)</option>
            {sectors.map(sec => (
              <option key={sec.id} value={sec.name}>{sec.name}</option>
            ))}
          </select>
        )}
      </div>
    </div>
  );
}
`;

const dir = path.join(process.cwd(), "src/components/dashboard");
if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
fs.writeFileSync(path.join(dir, "DashboardFilters.tsx"), code);
console.log("DashboardFilters.tsx created.");
