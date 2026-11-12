"use client";

import {
  AlertTriangle,
  CheckCircle2,
  Fuel,
  Milestone,
  ShieldAlert,
  UtensilsCrossed,
} from "lucide-react";
import AnimatedCurrency from "@/components/ui/AnimatedCurrency";
import type { MonthlyExpenseBudgetSummary } from "@/lib/expenseBudget";

interface BudgetCeilingMonitorProps {
  budget: MonthlyExpenseBudgetSummary;
  selectedMonth: string; // "YYYY-MM"
}

const MONTH_LABELS = [
  "Janeiro",
  "Fevereiro",
  "Março",
  "Abril",
  "Maio",
  "Junho",
  "Julho",
  "Agosto",
  "Setembro",
  "Outubro",
  "Novembro",
  "Dezembro",
];

function formatMonthTitle(monthKey: string): string {
  const [y, m] = monthKey.split("-").map(Number);
  if (!y || !m) return monthKey;
  return `${MONTH_LABELS[m - 1] || m} de ${y}`;
}

function formatBrl(value: number): string {
  return value.toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
  });
}

export default function BudgetCeilingMonitor({
  budget,
  selectedMonth,
}: BudgetCeilingMonitorProps) {
  const isCritical = budget.level === "CRITICAL_3K";
  const isWarning = budget.level === "WARNING_2K";
  const isExceededSoft = budget.totalSpent > budget.softLimit;
  const isExceededCeiling = budget.totalSpent > budget.hardCeiling;

  const containerStyle = isCritical
    ? "border-rose-500/60 bg-rose-950/25 shadow-[0_0_28px_rgba(244,63,94,0.14)]"
    : isWarning
    ? "border-amber-500/60 bg-amber-950/20 shadow-[0_0_26px_rgba(245,158,11,0.12)]"
    : "border-emerald-500/30 bg-[rgba(15,23,42,0.65)]";

  const barGradient = isCritical
    ? "from-amber-400 via-rose-500 to-rose-600"
    : isWarning
    ? "from-emerald-400 via-amber-400 to-orange-500"
    : "from-emerald-400 to-teal-500";

  const badgeClass = isCritical
    ? "bg-rose-500/20 border-rose-500/50 text-rose-300"
    : isWarning
    ? "bg-amber-500/20 border-amber-500/50 text-amber-300"
    : "bg-emerald-500/15 border-emerald-500/35 text-emerald-300";

  return (
    <section
      aria-label="Monitor de Teto Mensal da Andreia"
      className={`rounded-2xl border p-4 md:p-5 transition-colors ${containerStyle}`}
    >
      {/* Topo: Identificação + Alerta Visual + Valor Acumulado */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div className="space-y-1.5">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-300">
              Monitor de Teto Mensal · Andreia
            </span>
            <span className="text-[11px] font-mono text-slate-400">
              ({formatMonthTitle(selectedMonth)})
            </span>

            {isCritical ? (
              <span
                className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-bold border ${badgeClass}`}
              >
                <ShieldAlert size={13} className="shrink-0 animate-pulse" />
                {isExceededCeiling
                  ? `TETO MÁXIMO EXCEDIDO (+${formatBrl(budget.exceededCeilingBy)})`
                  : "TETO MÁXIMO DE R$ 3.000 ATINGIDO"}
              </span>
            ) : isWarning ? (
              <span
                className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-bold border ${badgeClass}`}
              >
                <AlertTriangle size={13} className="shrink-0 animate-pulse" />
                {isExceededSoft
                  ? `LIMITE DE R$ 2.000 EXCEDIDO (+${formatBrl(budget.exceededSoftBy)})`
                  : "LIMITE DE R$ 2.000 ATINGIDO"}
              </span>
            ) : (
              <span
                className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-semibold border ${badgeClass}`}
              >
                <CheckCircle2 size={13} className="shrink-0" />
                Dentro do limite base (R$ 2.000)
              </span>
            )}
          </div>

          {/* Valor principal + comparação imediata */}
          <div className="flex items-baseline gap-2.5 flex-wrap">
            <AnimatedCurrency
              value={budget.totalSpent}
              prefix="R$ "
              className={`text-2xl md:text-3xl font-extrabold font-mono tracking-tight ${
                isCritical
                  ? "text-rose-300"
                  : isWarning
                  ? "text-amber-300"
                  : "text-white"
              }`}
            />
            <span className="text-xs md:text-sm text-slate-400 font-medium">
              gastos de{" "}
              <strong className="text-slate-200 font-mono">
                {formatBrl(budget.softLimit)}
              </strong>{" "}
              <span className="text-slate-500">·</span>{" "}
              <span
                className={`font-mono font-bold ${
                  isCritical
                    ? "text-rose-300"
                    : isWarning
                    ? "text-amber-300"
                    : "text-emerald-300"
                }`}
              >
                {budget.pctOfSoftLimit.toLocaleString("pt-BR")}%
              </span>{" "}
              da meta
            </span>
          </div>
        </div>

        {/* Decomposição instantânea: Combustível (Km) + Alimentação + Pedágio */}
        <div className="grid grid-cols-3 gap-2 sm:gap-2.5 shrink-0">
          <div className="px-3 py-2 rounded-xl bg-black/25 border border-white/[0.08]">
            <div className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wider text-blue-300">
              <Fuel size={12} />
              <span>Km / Comb.</span>
            </div>
            <div className="text-sm font-bold font-mono text-white mt-0.5 tabular-nums">
              {formatBrl(budget.fuelTotal)}
            </div>
            <div className="text-[10px] text-slate-400 font-mono">
              {budget.totalKm.toLocaleString("pt-BR")} km rodados
            </div>
          </div>

          <div className="px-3 py-2 rounded-xl bg-black/25 border border-white/[0.08]">
            <div className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wider text-amber-300">
              <UtensilsCrossed size={12} />
              <span>Alimentação</span>
            </div>
            <div className="text-sm font-bold font-mono text-white mt-0.5 tabular-nums">
              {formatBrl(budget.mealTotal)}
            </div>
            <div className="text-[10px] text-slate-400">Refeições</div>
          </div>

          <div className="px-3 py-2 rounded-xl bg-black/25 border border-white/[0.08]">
            <div className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wider text-purple-300">
              <Milestone size={12} />
              <span>Pedágio</span>
            </div>
            <div className="text-sm font-bold font-mono text-white mt-0.5 tabular-nums">
              {formatBrl(budget.tollTotal)}
            </div>
            <div className="text-[10px] text-slate-400">Tarifas</div>
          </div>
        </div>
      </div>

      {/* Barra de Progresso 0 -> R$ 2.000 (Alerta) -> R$ 3.000 (Teto Máximo) */}
      <div className="mt-4 space-y-2">
        <div className="relative h-3.5 w-full rounded-full bg-slate-950/80 border border-white/10 overflow-hidden">
          {/* Zona de atenção entre R$ 2.000 e R$ 3.000 */}
          <div
            className="absolute inset-y-0 right-0 bg-amber-500/[0.08]"
            style={{ width: `${100 - budget.softMarkerPct}%` }}
          />

          {/* Preenchimento real proporcional a R$ 3.000 */}
          <div
            className={`h-full rounded-full bg-gradient-to-r ${barGradient} transition-all duration-500`}
            style={{ width: `${budget.ceilingBarFillPct}%` }}
          />

          {/* Marcador fixo do Alerta R$ 2.000 (66.7%) */}
          <div
            aria-hidden="true"
            title="Marco de alerta: R$ 2.000,00"
            className="absolute inset-y-0 w-0.5 bg-white/80 shadow-[0_0_8px_rgba(255,255,255,0.85)]"
            style={{ left: `${budget.softMarkerPct}%` }}
          />
        </div>

        {/* Legenda da barra + Status textual acionável */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-[11px]">
          <div className="flex items-center gap-3 flex-wrap text-slate-400 font-mono">
            <span>R$ 0</span>
            <span
              className={
                isWarning || isCritical
                  ? "text-amber-300 font-bold"
                  : "text-slate-300 font-semibold"
              }
            >
              Marco Alerta: {formatBrl(budget.softLimit)}
            </span>
            <span
              className={
                isCritical
                  ? "text-rose-300 font-bold"
                  : "text-slate-400 font-semibold"
              }
            >
              Teto Máx.: {formatBrl(budget.hardCeiling)}
            </span>
          </div>

          <div className="font-medium">
            {isCritical ? (
              <span className="text-rose-300 font-semibold">
                {isExceededCeiling
                  ? `Atenção: passou ${formatBrl(budget.exceededCeilingBy)} do teto máximo permitido de R$ 3.000,00.`
                  : "Atenção: atingiu exatamente o teto máximo permitido de R$ 3.000,00."}
              </span>
            ) : isWarning ? (
              <span className="text-amber-300 font-semibold">
                Aviso: já excedeu os R$ 2.000,00 em{" "}
                <strong>{formatBrl(budget.exceededSoftBy)}</strong> · Margem até o teto máximo (R$ 3.000):{" "}
                <strong className="font-mono">{formatBrl(budget.remainingToCeiling)}</strong>
              </span>
            ) : (
              <span className="text-slate-300">
                Faltam{" "}
                <strong className="text-emerald-300 font-mono">
                  {formatBrl(budget.remainingToSoft)}
                </strong>{" "}
                para atingir R$ 2.000,00{" "}
                <span className="text-slate-500">
                  ({formatBrl(budget.remainingToCeiling)} até o teto de R$ 3.000)
                </span>
              </span>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}

