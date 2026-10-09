"use client";

import {
  PieChart, Pie, Cell, Tooltip, ResponsiveContainer,
  BarChart, Bar, XAxis, YAxis, CartesianGrid,
  AreaChart, Area, Legend
} from "recharts";
import { SearchX } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";

const COLORS = [
  "#38bdf8", "#818cf8", "#c084fc", "#f472b6", "#fb7185", 
  "#f97316", "#fbbf24", "#34d399", "#2dd4bf", "#22d3ee", 
  "#a78bfa", "#e879f9", "#4ade80", "#60a5fa", "#f87171", "#fb923c"
];

interface ChartData {
  gastosPorCategoria: { name: string; value: number }[];
  gastosPorSetor: { name: string; value: number }[];
  topSolicitantes: { name: string; value: number }[];
  tendenciaDiaria: { date: string; fullDate?: string; value: number }[];
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

  const totalCategorias = data.gastosPorCategoria.reduce((acc, c) => acc + c.value, 0) || 1;
  const totalSetores = data.gastosPorSetor.reduce((acc, s) => acc + s.value, 0) || 1;

  const CustomPieTooltip = ({ active, payload }: any) => {
    if (active && payload && payload.length) {
      const item = payload[0];
      return (
        <div className="bg-slate-900/95 backdrop-blur-sm border border-slate-700 p-3 rounded-xl shadow-2xl text-xs">
          <p className="font-bold text-slate-200 mb-1">{item.name}</p>
          <p className="font-extrabold text-brand-primary text-sm">{formatCurrency(item.value)}</p>
        </div>
      );
    }
    return null;
  };

  const CustomTrendTooltip = ({ active, payload }: any) => {
    if (active && payload && payload.length) {
      const item = payload[0].payload;
      return (
        <div className="bg-slate-900/95 backdrop-blur-sm border border-slate-700 p-3 rounded-xl shadow-2xl text-xs">
          <p className="font-bold text-slate-400 mb-1">{item.fullDate || item.date}</p>
          <p className="font-extrabold text-emerald-400 text-sm">{formatCurrency(item.value)}</p>
        </div>
      );
    }
    return null;
  };

  return (
    <div className="flex flex-col gap-6">
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Gastos por Categoria */}
        <div className="bg-slate-800 p-6 rounded-2xl border border-slate-700 shadow-sm flex flex-col min-h-[460px]">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-semibold text-slate-400 uppercase tracking-wider">Gastos por Categoria</h3>
            <span className="text-xs text-slate-500 font-medium">{data.gastosPorCategoria.length} categorias</span>
          </div>

          {/* Gráfico Donut */}
          <div className="h-[180px] w-full shrink-0">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={data.gastosPorCategoria}
                  innerRadius={55}
                  outerRadius={80}
                  paddingAngle={3}
                  dataKey="value"
                  stroke="none"
                >
                  {data.gastosPorCategoria.map((_, index) => (
                    <Cell key={`cat-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip content={<CustomPieTooltip />} />
              </PieChart>
            </ResponsiveContainer>
          </div>

          {/* Lista Scrollável de Categorias */}
          <div className="flex-1 overflow-y-auto max-h-[190px] pr-1 mt-2 space-y-2 border-t border-slate-700/60 pt-3">
            {data.gastosPorCategoria.map((cat, i) => {
              const color = COLORS[i % COLORS.length];
              const pct = Math.round((cat.value / totalCategorias) * 100);
              return (
                <div key={i} className="flex items-center justify-between text-xs py-1 px-1.5 rounded-lg hover:bg-slate-700/40 transition-colors">
                  <div className="flex items-center gap-2 min-w-0 pr-2">
                    <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: color }} />
                    <span className="text-slate-200 truncate font-medium" title={cat.name}>{cat.name}</span>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <span className="text-slate-400 font-mono text-[11px]">{pct}%</span>
                    <span className="text-white font-bold">{formatCurrency(cat.value)}</span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Gastos por Setor (Master Only) */}
        {userRole === "MASTER" ? (
          <div className="bg-slate-800 p-6 rounded-2xl border border-slate-700 shadow-sm flex flex-col min-h-[460px]">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-semibold text-slate-400 uppercase tracking-wider">Gastos por Setor</h3>
              <span className="text-xs text-slate-500 font-medium">{data.gastosPorSetor.length} setores</span>
            </div>

            {/* Gráfico Donut Setores */}
            <div className="h-[180px] w-full shrink-0">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={data.gastosPorSetor}
                    innerRadius={55}
                    outerRadius={80}
                    paddingAngle={3}
                    dataKey="value"
                    stroke="none"
                  >
                    {data.gastosPorSetor.map((_, index) => (
                      <Cell key={`sec-${index}`} fill={COLORS[(index + 3) % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip content={<CustomPieTooltip />} />
                </PieChart>
              </ResponsiveContainer>
            </div>

            {/* Lista Scrollável de Setores */}
            <div className="flex-1 overflow-y-auto max-h-[190px] pr-1 mt-2 space-y-2 border-t border-slate-700/60 pt-3">
              {data.gastosPorSetor.map((sec, i) => {
                const color = COLORS[(i + 3) % COLORS.length];
                const pct = Math.round((sec.value / totalSetores) * 100);
                return (
                  <div key={i} className="flex items-center justify-between text-xs py-1 px-1.5 rounded-lg hover:bg-slate-700/40 transition-colors">
                    <div className="flex items-center gap-2 min-w-0 pr-2">
                      <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: color }} />
                      <span className="text-slate-200 truncate font-medium" title={sec.name}>{sec.name}</span>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <span className="text-slate-400 font-mono text-[11px]">{pct}%</span>
                      <span className="text-white font-bold">{formatCurrency(sec.value)}</span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        ) : null}

        {/* Top Solicitantes */}
        <div className={`bg-slate-800 p-6 rounded-2xl border border-slate-700 shadow-sm flex flex-col min-h-[460px] ${userRole !== 'MASTER' ? 'lg:col-span-2' : ''}`}>
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
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-sm font-semibold text-slate-400 uppercase tracking-wider">Tendência de Saídas (Período)</h3>
          <span className="text-xs text-slate-500 font-medium">Ordem cronológica por data</span>
        </div>
        <div className="flex-1 min-h-0">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={data.tendenciaDiaria} margin={{ top: 10, right: 30, left: 20, bottom: 0 }}>
              <defs>
                <linearGradient id="colorValue" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#10b981" stopOpacity={0.35}/>
                  <stop offset="95%" stopColor="#10b981" stopOpacity={0}/>
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#334155" vertical={false} />
              <XAxis dataKey="date" stroke="#94a3b8" fontSize={12} tickLine={false} axisLine={false} dy={10} />
              <YAxis stroke="#94a3b8" fontSize={12} tickLine={false} axisLine={false} dx={-10} tickFormatter={(val) => `R$ ${(val / 1000).toFixed(0)}k`} />
              <Tooltip content={<CustomTrendTooltip />} />
              <Area type="monotone" dataKey="value" stroke="#10b981" strokeWidth={3} fillOpacity={1} fill="url(#colorValue)" />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
}
