"use client";

import { useMemo, useRef, useState } from "react";
import { Calendar, ChevronDown, ChevronLeft, ChevronRight, X } from "lucide-react";
import { FloatingPopover } from "@/components/ui/FloatingPopover";
import type { KanbanPeriodMode } from "@/types/kanbanFilters";
import { getTodayBrtDateKey } from "@/utils/kanbanFilters";

interface FilterMonthPopoverProps {
  periodMode: KanbanPeriodMode;
  month: string; // "YYYY-MM"
  onChange: (mode: KanbanPeriodMode, month?: string) => void;
  monthCounts: Record<string, number>;
}

const MONTH_NAMES = [
  "Jan",
  "Fev",
  "Mar",
  "Abr",
  "Mai",
  "Jun",
  "Jul",
  "Ago",
  "Set",
  "Out",
  "Nov",
  "Dez",
];

const PRESETS: { mode: KanbanPeriodMode; label: string }[] = [
  { mode: "ALL", label: "Todo período" },
  { mode: "DUE_TODAY_OR_OVERDUE", label: "Vence Hoje / Vencidos" },
  { mode: "DUE_NEXT_7D", label: "Vence em 7 dias" },
  { mode: "THIS_MONTH", label: "Mês atual" },
  { mode: "LAST_MONTH", label: "Mês passado" },
];

export function FilterMonthPopover({
  periodMode,
  month,
  onChange,
  monthCounts,
}: FilterMonthPopoverProps) {
  const [open, setOpen] = useState(false);
  const currentYear = Number(getTodayBrtDateKey().slice(0, 4));
  const [selectedYear, setSelectedYear] = useState<number>(() =>
    month ? Number(month.slice(0, 4)) || currentYear : currentYear
  );

  const triggerRef = useRef<HTMLButtonElement>(null);
  const popoverRef = useRef<HTMLDivElement>(null);

  const triggerLabel = useMemo(() => {
    if (periodMode === "ALL") return "Todo período";
    if (periodMode === "DUE_TODAY_OR_OVERDUE") return "Hoje / Vencidos";
    if (periodMode === "DUE_NEXT_7D") return "Próx. 7 dias";
    if (periodMode === "THIS_MONTH") return "Mês atual";
    if (periodMode === "LAST_MONTH") return "Mês passado";
    if (periodMode === "MONTH" && month) {
      const [y, m] = month.split("-").map(Number);
      return `${MONTH_NAMES[(m || 1) - 1]}/${y}`;
    }
    return "Período";
  }, [periodMode, month]);

  const isActive = periodMode !== "ALL";

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        aria-haspopup="dialog"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
        className={`inline-flex items-center justify-between gap-1.5 h-[34px] px-2.5 rounded-lg text-xs transition-all cursor-pointer shrink-0 border ${
          open
            ? "bg-[var(--bg-card)] border-[#6c5ce7] ring-2 ring-[#6c5ce7]/20 text-[var(--text-primary)]"
            : isActive
            ? "bg-[#6c5ce7]/10 border-[#6c5ce7]/55 text-[var(--text-primary)]"
            : "bg-[var(--bg-primary)] hover:bg-[var(--bg-card)] border-[var(--surface-border)] text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
        }`}
      >
        <span className="flex items-center gap-1.5 whitespace-nowrap">
          <Calendar
            size={13}
            className={isActive ? "text-[#a29bfe]" : "text-[var(--text-muted)]"}
          />
          <span className="font-medium">
            {periodMode === "ALL" ? (
              <>
                <span className="hidden 2xl:inline">Todo período</span>
                <span className="2xl:hidden">Período</span>
              </>
            ) : (
              triggerLabel
            )}
          </span>
        </span>

        {isActive ? (
          <span
            role="button"
            tabIndex={-1}
            aria-label="Limpar período"
            onClick={(e) => {
              e.stopPropagation();
              onChange("ALL", "");
            }}
            className="p-0.5 rounded hover:bg-white/10 text-[var(--text-muted)] hover:text-[var(--text-primary)] transition-colors"
          >
            <X size={12} />
          </span>
        ) : (
          <ChevronDown
            size={13}
            className={`text-[var(--text-muted)] transition-transform duration-150 ${
              open ? "rotate-180 text-[#a29bfe]" : ""
            }`}
          />
        )}
      </button>

      <FloatingPopover
        open={open}
        onClose={() => setOpen(false)}
        triggerRef={triggerRef}
        popoverRef={popoverRef}
        width={296}
      >
        <div className="p-3 flex flex-col gap-3">
          {/* Atalhos Operacionais */}
          <div className="flex flex-col gap-1">
            <span className="text-[10px] font-semibold uppercase tracking-wider text-[var(--text-muted)] px-1">
              Atalhos Rápidos
            </span>
            <div className="grid grid-cols-1 gap-1">
              {PRESETS.map((preset) => {
                const active = periodMode === preset.mode;
                return (
                  <button
                    key={preset.mode}
                    type="button"
                    onClick={() => {
                      onChange(preset.mode, "");
                      setOpen(false);
                    }}
                    className={`w-full flex items-center justify-between px-2.5 py-1.5 rounded-md text-xs text-left transition-colors cursor-pointer ${
                      active
                        ? "bg-[#6c5ce7]/15 text-[var(--text-primary)] font-semibold border border-[#6c5ce7]/40"
                        : "text-[var(--text-secondary)] hover:bg-[var(--surface-hover)] border border-transparent"
                    }`}
                  >
                    <span>{preset.label}</span>
                    {preset.mode === "DUE_TODAY_OR_OVERDUE" && (
                      <span className="text-[10px] text-amber-400 font-medium">
                        Prioridade
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          </div>

          <div className="h-px bg-[var(--surface-border)]" />

          {/* Grade Visual Mês/Ano (Competência de criação) */}
          <div className="flex flex-col gap-2">
            <div className="flex items-center justify-between px-1">
              <span className="text-[10px] font-semibold uppercase tracking-wider text-[var(--text-muted)]">
                Competência (Mês)
              </span>
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  onClick={() => setSelectedYear((y) => y - 1)}
                  className="p-1 rounded hover:bg-[var(--surface-hover)] text-[var(--text-muted)] hover:text-[var(--text-primary)] cursor-pointer"
                  aria-label="Ano anterior"
                >
                  <ChevronLeft size={13} />
                </button>
                <span className="font-mono tabular-nums text-xs font-semibold text-[var(--text-primary)] min-w-[40px] text-center">
                  {selectedYear}
                </span>
                <button
                  type="button"
                  onClick={() => setSelectedYear((y) => y + 1)}
                  className="p-1 rounded hover:bg-[var(--surface-hover)] text-[var(--text-muted)] hover:text-[var(--text-primary)] cursor-pointer"
                  aria-label="Próximo ano"
                >
                  <ChevronRight size={13} />
                </button>
              </div>
            </div>

            <div className="grid grid-cols-3 gap-1.5">
              {MONTH_NAMES.map((mLabel, idx) => {
                const mKey = `${selectedYear}-${String(idx + 1).padStart(2, "0")}`;
                const selected = periodMode === "MONTH" && month === mKey;
                const count = monthCounts[mKey] || 0;
                return (
                  <button
                    key={mKey}
                    type="button"
                    onClick={() => {
                      onChange("MONTH", mKey);
                      setOpen(false);
                    }}
                    className={`flex items-center justify-between px-2 py-1.5 rounded-md text-xs transition-all cursor-pointer border ${
                      selected
                        ? "bg-[#6c5ce7]/20 border-[#6c5ce7] text-[var(--text-primary)] font-semibold"
                        : "bg-[var(--bg-primary)] hover:bg-[var(--surface-hover)] border-[var(--surface-border)] text-[var(--text-secondary)]"
                    }`}
                  >
                    <span>{mLabel}</span>
                    <span
                      className={`font-mono tabular-nums text-[10px] ${
                        count > 0 ? "text-[var(--text-muted)]" : "opacity-35"
                      }`}
                    >
                      {count}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      </FloatingPopover>
    </>
  );
}

