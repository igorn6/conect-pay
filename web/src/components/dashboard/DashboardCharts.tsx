"use client";

import {
  PieChart, Pie, Cell, Tooltip, ResponsiveContainer,
  BarChart, Bar, XAxis, YAxis, CartesianGrid,
  AreaChart, Area, Legend
} from "recharts";
import { SearchX } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";

const COLORS = ["#4f46e5", "#10b981", "#e11d48", "#f59e0b", "#8b5cf6", "#06b6d4"];

interface ChartData {
  gastosPorCategoria: { name: string; value: number }[];
  gastosPorSetor: { name: string; value: number }[];
  topSolicitantes: { name: string; value: number }[];
  tendenciaDiaria: { date: string; value: number }[];
}

export default function DashboardCharts({ data }: { data: ChartData }) {
  const { userRole } = useAuth();
  
  if (data.gastosPorCategoria.length === 0 && data.tendenciaDiaria.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-20 bg-slate-800/50 rounded-2xl border border-slate-700/50">
        <SearchX size={64} className="text-slate-500 mb-4" />
        <h2 className="text-xl font-semibold text-slate-300">Nenhuma movimentação financeira</h2>
        <p className="text-slate-500 mt-2">Não há dados finalizados para o período e filtros selecionados.</p>
      </div>
    );
  }

  const formatCurrency = (val: number) => {
    return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(val);
  };

  const CustomTooltip = ({ active, payload }: any) => {
    if (active && payload && payload.length) {
      return (
        <div className="bg-slate-900 border border-slate-700 p-3 rounded-lg shadow-xl">
          <p className="text-sm font-semibold text-slate-200">{payload[0].name || payload[0].payload.date}</p>
          <p className="text-sm text-brand-primary">{formatCurrency(payload[0].value)}</p>
        </div>
      );
    }
    return null;
  };

  return (
    <div className="flex flex-col gap-6">
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Gastos por Categoria */}
        <div className="bg-slate-800 p-6 rounded-2xl border border-slate-700 shadow-sm flex flex-col h-[380px]">
          <h3 className="text-sm font-semibold text-slate-400 uppercase tracking-wider mb-4">Gastos por Categoria</h3>
          <div className="flex-1 min-h-0">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={data.gastosPorCategoria}
                  innerRadius={60}
                  outerRadius={100}
                  paddingAngle={5}
                  dataKey="value"
                  stroke="none"
                >
                  {data.gastosPorCategoria.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip content={<CustomTooltip />} />
                <Legend verticalAlign="bottom" height={36} wrapperStyle={{ fontSize: '12px', color: '#94a3b8' }} />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Gastos por Setor (Master Only) ou Top Solicitantes para Gestor ocupar espaço */}
        {userRole === "MASTER" ? (
          <div className="bg-slate-800 p-6 rounded-2xl border border-slate-700 shadow-sm flex flex-col h-[380px]">
            <h3 className="text-sm font-semibold text-slate-400 uppercase tracking-wider mb-4">Gastos por Setor</h3>
            <div className="flex-1 min-h-0">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={data.gastosPorSetor}
                    innerRadius={60}
                    outerRadius={100}
                    paddingAngle={5}
                    dataKey="value"
                    stroke="none"
                  >
                    {data.gastosPorSetor.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[(index + 2) % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip content={<CustomTooltip />} />
                  <Legend verticalAlign="bottom" height={36} wrapperStyle={{ fontSize: '12px', color: '#94a3b8' }} />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </div>
        ) : null}

        {/* Top Solicitantes */}
        <div className={`bg-slate-800 p-6 rounded-2xl border border-slate-700 shadow-sm flex flex-col h-[380px] ${userRole !== 'MASTER' ? 'lg:col-span-2' : ''}`}>
          <h3 className="text-sm font-semibold text-slate-400 uppercase tracking-wider mb-4">Top Solicitantes</h3>
          <div className="flex-1 flex flex-col gap-4 overflow-y-auto pr-2">
            {data.topSolicitantes.map((req, i) => {
              const max = data.topSolicitantes[0]?.value || 1;
              const percent = Math.round((req.value / max) * 100);
              return (
                <div key={i} className="flex flex-col gap-1.5">
                  <div className="flex justify-between items-center text-sm">
                    <span className="font-medium text-slate-200 truncate pr-2">{req.name}</span>
                    <span className="font-bold text-brand-primary">{formatCurrency(req.value)}</span>
                  </div>
                  <div className="w-full bg-slate-700 h-2 rounded-full overflow-hidden">
                    <div 
                      className="bg-brand-primary h-full rounded-full transition-all duration-1000" 
                      style={{ width: `${percent}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </div>

      </div>

      {/* Tendência Diária */}
      <div className="bg-slate-800 p-6 rounded-2xl border border-slate-700 shadow-sm flex flex-col h-[400px]">
        <h3 className="text-sm font-semibold text-slate-400 uppercase tracking-wider mb-6">Tendência de Saídas (Período)</h3>
        <div className="flex-1 min-h-0">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={data.tendenciaDiaria} margin={{ top: 10, right: 30, left: 20, bottom: 0 }}>
              <defs>
                <linearGradient id="colorValue" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#14b8a6" stopOpacity={0.3}/>
                  <stop offset="95%" stopColor="#14b8a6" stopOpacity={0}/>
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#334155" vertical={false} />
              <XAxis dataKey="date" stroke="#94a3b8" fontSize={12} tickLine={false} axisLine={false} dy={10} />
              <YAxis stroke="#94a3b8" fontSize={12} tickLine={false} axisLine={false} dx={-10} tickFormatter={(val) => `R$ ${(val / 1000)}k`} />
              <Tooltip content={<CustomTooltip />} />
              <Area type="monotone" dataKey="value" stroke="#14b8a6" strokeWidth={3} fillOpacity={1} fill="url(#colorValue)" />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
}
