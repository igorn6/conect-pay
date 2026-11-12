"use client";

import type { KeyboardEvent } from "react";

export interface SegmentedOption<T extends string> {
  value: T;
  label: string;
  shortLabel?: string;
  count?: number;
  disabled?: boolean;
  title?: string;
}

interface FilterSegmentedControlProps<T extends string> {
  value: T;
  onChange: (value: T) => void;
  options: SegmentedOption<T>[];
  ariaLabel?: string;
}

export function FilterSegmentedControl<T extends string>({
  value,
  onChange,
  options,
  ariaLabel = "Alternar visualização",
}: FilterSegmentedControlProps<T>) {
  const handleKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    if (e.key !== "ArrowLeft" && e.key !== "ArrowRight") return;
    e.preventDefault();
    const enabled = options.filter((o) => !o.disabled);
    if (enabled.length < 2) return;
    const idx = enabled.findIndex((o) => o.value === value);
    const nextIdx =
      e.key === "ArrowRight"
        ? (idx + 1) % enabled.length
        : (idx - 1 + enabled.length) % enabled.length;
    onChange(enabled[nextIdx].value);
  };

  return (
    <div
      role="radiogroup"
      aria-label={ariaLabel}
      onKeyDown={handleKeyDown}
      className="inline-flex items-center h-[34px] p-[3px] rounded-lg bg-[var(--bg-primary)] border border-[var(--surface-border)] shrink-0"
    >
      {options.map((opt) => {
        const active = opt.value === value;
        return (
          <button
            key={opt.value}
            type="button"
            role="radio"
            aria-checked={active}
            disabled={opt.disabled}
            title={opt.title}
            onClick={() => !opt.disabled && onChange(opt.value)}
            className={`relative inline-flex items-center gap-1.5 h-[26px] px-2 2xl:px-2.5 rounded-[6px] text-xs font-medium whitespace-nowrap transition-all duration-150 select-none cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed ${
              active
                ? "bg-[var(--bg-card)] text-[var(--text-primary)] border border-[#6c5ce7]/55 shadow-[0_1px_10px_rgba(108,92,231,0.18)]"
                : "border border-transparent text-[var(--text-muted)] hover:text-[var(--text-primary)]"
            }`}
          >
            {opt.shortLabel ? (
              <>
                <span className="hidden 2xl:inline">{opt.label}</span>
                <span className="2xl:hidden">{opt.shortLabel}</span>
              </>
            ) : (
              <span>{opt.label}</span>
            )}
            {typeof opt.count === "number" && (
              <span
                className={`font-mono tabular-nums text-[10px] px-1.5 py-0.2 rounded ${
                  active
                    ? "bg-[#6c5ce7]/20 text-[var(--text-primary)]"
                    : "bg-white/[0.06] text-[var(--text-muted)]"
                }`}
              >
                {opt.count}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}

