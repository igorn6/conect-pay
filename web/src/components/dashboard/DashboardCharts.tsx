"use client";

import {
  PieChart,
  Pie,
  Cell,
  Tooltip,
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  AreaChart,
  Area,
} from "recharts";
import { SearchX, PieChart as PieIcon, TrendingUp, Users } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import SpotlightCard from "@/components/ui/SpotlightCard";
import ShinyBadge from "@/components/ui/ShinyBadge";

const COLORS = [
  "#10b981", "#0284c7", "#6366f1", "#d97706", "#8b5cf6",
  "#0d9488", "#475569", "#2563eb", "#ea580c", "#059669",
  "#7c3aed", "#0891b2", "#64748b", "#3b82f6", "#b45309", "#4f46e5",
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
      <div className="flex flex-col items-center justify-center py-20 glass-panel rounded-2xl border border-white/10">
        <SearchX size={64} className="text-slate-500 mb-4 opacity-50" />
        <h2 className="text-lg font-bold font-mono text-slate-300">Nenhuma movimentação financeira</h2>
        <p className="text-xs text-slate-500 mt-1 font-mono">Não há dados finalizados para o período e filtros selecionados.</p>
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
        <div className="bg-slate-950/95 backdrop-blur-md border border-white/15 p-3 rounded-xl shadow-2xl text-xs font-mono">
          <p className="font-semibold text-slate-300 mb-1">{item.name}</p>
          <p className="font-bold text-white text-sm">{formatCurrency(item.value)}</p>
        </div>
      );
    }
    return null;
  };

  const CustomTrendTooltip = ({ active, payload }: any) => {
    if (active && payload && payload.length) {
      const item = payload[0].payload;
      return (
        <div className="bg-slate-950/95 backdrop-blur-md border border-white/15 p-3 rounded-xl shadow-2xl text-xs font-mono">
          <p className="font-semibold text-slate-400 mb-1">{item.fullDate || item.date}</p>
          <p className="font-bold text-white text-sm">{formatCurrency(item.value)}</p>
        </div>
      );
    }
    return null;
  };

  return (
    <div className="flex flex-col gap-6">
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Gastos por Categoria */}
        <SpotlightCard
          spotlightColor="rgba(255, 255, 255, 0.05)"
          borderColor="rgba(255, 255, 255, 0.1)"
          className="p-6 glass-panel-elevated flex flex-col min-h-[470px]"
        >
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <PieIcon size={16} className="text-slate-400" />
              <h3 className="text-xs uppercase font-mono tracking-wider font-bold text-white">
                Gastos por Categoria
              </h3>
            </div>
            <ShinyBadge variant="neutral" className="text-[10px] font-mono">
              {data.gastosPorCategoria.length} categorias
            </ShinyBadge>
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
          <div className="flex-1 overflow-y-auto max-h-[190px] pr-1 mt-2 space-y-1.5 border-t border-white/5 pt-3 atelier-scrollbar">
            {data.gastosPorCategoria.map((cat, i) => {
              const color = COLORS[i % COLORS.length];
              const pct = Math.round((cat.value / totalCategorias) * 100);
              return (
                <div
                  key={i}
                  className="flex items-center justify-between text-xs py-1.5 px-2 rounded-lg hover:bg-white/5 transition-colors font-mono"
                >
                  <div className="flex items-center gap-2 min-w-0 pr-2">
                    <span className="w-2 h-2 rounded-full shrink-0 shadow-sm" style={{ backgroundColor: color }} />
                    <span className="text-slate-200 truncate font-medium text-[11px]" title={cat.name}>
                      {cat.name}
                    </span>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <span className="text-slate-400 text-[10px]">{pct}%</span>
                    <span className="text-white font-bold tabular-nums text-[11px]">{formatCurrency(cat.value)}</span>
                  </div>
                </div>
              );
            })}
          </div>
        </SpotlightCard>

        {/* Gastos por Setor (Master Only) */}
        {userRole === "MASTER" ? (
          <SpotlightCard
            spotlightColor="rgba(255, 255, 255, 0.05)"
            borderColor="rgba(255, 255, 255, 0.1)"
            className="p-6 glass-panel-elevated flex flex-col min-h-[470px]"
          >
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <PieIcon size={16} className="text-slate-400" />
                <h3 className="text-xs uppercase font-mono tracking-wider font-bold text-white">
                  Gastos por Setor
                </h3>
              </div>
              <ShinyBadge variant="neutral" className="text-[10px] font-mono">
                {data.gastosPorSetor.length} setores
              </ShinyBadge>
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
            <div className="flex-1 overflow-y-auto max-h-[190px] pr-1 mt-2 space-y-1.5 border-t border-white/5 pt-3 atelier-scrollbar">
              {data.gastosPorSetor.map((sec, i) => {
                const color = COLORS[(i + 3) % COLORS.length];
                const pct = Math.round((sec.value / totalSetores) * 100);
                return (
                  <div
                    key={i}
                    className="flex items-center justify-between text-xs py-1.5 px-2 rounded-lg hover:bg-white/5 transition-colors font-mono"
                  >
                    <div className="flex items-center gap-2 min-w-0 pr-2">
                      <span className="w-2 h-2 rounded-full shrink-0 shadow-sm" style={{ backgroundColor: color }} />
                      <span className="text-slate-200 truncate font-medium text-[11px]" title={sec.name}>
                        {sec.name}
                      </span>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <span className="text-slate-400 text-[10px]">{pct}%</span>
                      <span className="text-white font-bold tabular-nums text-[11px]">{formatCurrency(sec.value)}</span>
                    </div>
                  </div>
                );
              })}
            </div>
          </SpotlightCard>
        ) : null}

        {/* Top Solicitantes */}
        <SpotlightCard
          spotlightColor="rgba(255, 255, 255, 0.05)"
          borderColor="rgba(255, 255, 255, 0.1)"
          className={`p-6 glass-panel-elevated flex flex-col min-h-[470px] ${userRole !== "MASTER" ? "lg:col-span-2" : ""}`}
        >
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <Users size={16} className="text-slate-400" />
              <h3 className="text-xs uppercase font-mono tracking-wider font-bold text-white">
                Maiores Solicitantes
              </h3>
            </div>
            <span className="text-[10px] font-mono text-slate-400">Classificação por volume</span>
          </div>

          <div className="flex-1 flex flex-col gap-3.5 overflow-y-auto pr-1 atelier-scrollbar">
            {data.topSolicitantes.map((req, i) => {
              const max = data.topSolicitantes[0]?.value || 1;
              const percent = Math.round((req.value / max) * 100);
              return (
                <div key={i} className="flex flex-col gap-1.5 p-2 rounded-xl hover:bg-white/5 transition-colors">
                  <div className="flex justify-between items-center text-xs font-mono">
                    <div className="flex items-center gap-2 min-w-0">
                      <span className="w-5 h-5 rounded-md bg-white/5 border border-white/10 flex items-center justify-center text-[10px] font-bold text-slate-300">
                        {String(i + 1).padStart(2, "0")}
                      </span>
                      <span className="font-medium text-slate-200 truncate pr-2">{req.name}</span>
                    </div>
                    <span className="font-bold tabular-nums text-white">{formatCurrency(req.value)}</span>
                  </div>
                  <div className="w-full bg-slate-800/80 h-1.5 rounded-full overflow-hidden">
                    <div
                      className="bg-slate-300 h-full rounded-full transition-all duration-1000"
                      style={{ width: `${percent}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </SpotlightCard>
      </div>

      {/* Tendência Diária */}
      <SpotlightCard
        spotlightColor="rgba(255, 255, 255, 0.05)"
        borderColor="rgba(255, 255, 255, 0.1)"
        className="p-6 glass-panel-elevated flex flex-col h-[420px]"
      >
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <TrendingUp size={16} className="text-slate-400" />
            <h3 className="text-xs uppercase font-mono tracking-wider font-bold text-white">
              Série Temporal de Liquidações
            </h3>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-[10px] font-mono text-slate-400">Curva diária consolidada</span>
            {data.tendenciaDiaria && data.tendenciaDiaria.length > 0 && (
              <ShinyBadge variant="neutral" className="text-[9px] font-mono">
                {data.tendenciaDiaria.length} dias
              </ShinyBadge>
            )}
          </div>
        </div>
        <div className="w-full h-[320px] min-h-[300px]">
          {data.tendenciaDiaria && data.tendenciaDiaria.length > 0 ? (
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={data.tendenciaDiaria} margin={{ top: 10, right: 30, left: 20, bottom: 0 }}>
                <defs>
                  <linearGradient id="colorValueOverdrive" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#10b981" stopOpacity={0.4} />
                    <stop offset="95%" stopColor="#10b981" stopOpacity={0.0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" vertical={false} />
                <XAxis dataKey="date" stroke="#64748b" fontSize={11} tickLine={false} axisLine={false} dy={10} fontStyle="mono" />
                <YAxis
                  stroke="#64748b"
                  fontSize={11}
                  tickLine={false}
                  axisLine={false}
                  dx={-10}
                  tickFormatter={(val) => `R$ ${(val / 1000).toFixed(0)}k`}
                  fontStyle="mono"
                />
                <Tooltip content={<CustomTrendTooltip />} />
                <Area
                  type="monotone"
                  dataKey="value"
                  stroke="#10b981"
                  strokeWidth={3}
                  fillOpacity={1}
                  fill="url(#colorValueOverdrive)"
                  activeDot={{ r: 6, fill: "#10b981", stroke: "#fff", strokeWidth: 2 }}
                  dot={{ r: 3, fill: "#10b981", stroke: "#fff", strokeWidth: 1 }}
                />
              </AreaChart>
            </ResponsiveContainer>
          ) : (
            <div className="flex flex-col items-center justify-center h-full text-slate-500 font-mono text-xs">
              <TrendingUp size={36} className="text-slate-600 mb-2 opacity-50" />
              <p className="font-semibold text-slate-400">Nenhuma liquidação registrada no período</p>
              <p className="text-[11px] text-slate-500 mt-1">Ajuste os filtros de data no topo da página para visualizar os dias com pagamentos.</p>
            </div>
          )}
        </div>
      </SpotlightCard>
    </div>
  );
}
