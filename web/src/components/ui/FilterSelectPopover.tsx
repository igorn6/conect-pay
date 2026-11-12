"use client";

import { useId, useMemo, useRef, useState, type KeyboardEvent, type ReactNode } from "react";
import { Check, ChevronDown, Search, X } from "lucide-react";
import { FloatingPopover } from "@/components/ui/FloatingPopover";
import { normalizeText } from "@/utils/kanbanFilters";

export interface FilterSelectOption {
  value: string;
  label: string;
  dotColor?: string;
  initials?: string;
  count?: number;
}

interface FilterSelectPopoverProps {
  value: string;
  onChange: (value: string) => void;
  options: FilterSelectOption[];
  placeholder: string;
  allLabel: string;
  icon?: ReactNode;
  searchable?: boolean;
  searchPlaceholder?: string;
  popoverWidth?: number;
  maxTriggerWidthClass?: string;
  align?: "left" | "right";
}

export function FilterSelectPopover({
  value,
  onChange,
  options,
  placeholder,
  allLabel,
  icon,
  searchable,
  searchPlaceholder = "Filtrar opções...",
  popoverWidth = 276,
  maxTriggerWidthClass = "max-w-[175px]",
  align = "left",
}: FilterSelectPopoverProps) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [highlightedIndex, setHighlightedIndex] = useState(0);

  const triggerRef = useRef<HTMLButtonElement>(null);
  const popoverRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const triggerId = useId();
  const listboxId = useId();

  const shouldShowSearch = searchable ?? options.length > 6;

  const selectedOption = useMemo(
    () => options.find((o) => o.value === value) || null,
    [options, value]
  );

  const filteredOptions = useMemo(() => {
    const q = normalizeText(query);
    const list: (FilterSelectOption & { isAll?: boolean })[] = [
      { value: "", label: allLabel, isAll: true },
      ...options,
    ];
    if (!q) return list;
    return list.filter((o) => normalizeText(o.label).includes(q));
  }, [options, query, allLabel]);

  const openMenu = () => {
    setQuery("");
    const baseList: (FilterSelectOption & { isAll?: boolean })[] = [
      { value: "", label: allLabel, isAll: true },
      ...options,
    ];
    const selectedIdx = baseList.findIndex((o) => o.value === value);
    setHighlightedIndex(selectedIdx >= 0 ? selectedIdx : 0);
    setOpen(true);
    if (shouldShowSearch) {
      setTimeout(() => searchInputRef.current?.focus(), 20);
    }
  };

  const toggleOpen = () => {
    if (open) {
      setOpen(false);
    } else {
      openMenu();
    }
  };

  const handleSelect = (val: string) => {
    onChange(val);
    setOpen(false);
    setTimeout(() => document.getElementById(triggerId)?.focus(), 0);
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLElement>) => {
    if (!open) {
      if (e.key === "ArrowDown" || e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        openMenu();
      }
      return;
    }

    if (e.key === "ArrowDown") {
      e.preventDefault();
      setHighlightedIndex((i) => Math.min(filteredOptions.length - 1, i + 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setHighlightedIndex((i) => Math.max(0, i - 1));
    } else if (e.key === "Home") {
      e.preventDefault();
      setHighlightedIndex(0);
    } else if (e.key === "End") {
      e.preventDefault();
      setHighlightedIndex(Math.max(0, filteredOptions.length - 1));
    } else if (e.key === "Enter") {
      e.preventDefault();
      const picked = filteredOptions[highlightedIndex];
      if (picked) handleSelect(picked.value);
    }
  };

  const isActive = Boolean(value);

  return (
    <>
      <button
        id={triggerId}
        ref={triggerRef}
        type="button"
        role="combobox"
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={open ? listboxId : undefined}
        onClick={toggleOpen}
        onKeyDown={handleKeyDown}
        className={`group inline-flex items-center justify-between gap-1.5 h-[34px] px-2.5 rounded-lg text-xs transition-all cursor-pointer shrink-0 border ${
          open
            ? "bg-[var(--bg-card)] border-[#6c5ce7] ring-2 ring-[#6c5ce7]/20 text-[var(--text-primary)]"
            : isActive
            ? "bg-[#6c5ce7]/10 border-[#6c5ce7]/55 text-[var(--text-primary)]"
            : "bg-[var(--bg-primary)] hover:bg-[var(--bg-card)] border-[var(--surface-border)] text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
        }`}
      >
        <span className="flex items-center gap-1.5 min-w-0">
          {selectedOption?.dotColor ? (
            <span
              className="w-2 h-2 rounded-full shrink-0"
              style={{ backgroundColor: selectedOption.dotColor }}
            />
          ) : (
            icon && (
              <span
                className={
                  isActive ? "text-[#a29bfe] shrink-0" : "text-[var(--text-muted)] shrink-0"
                }
              >
                {icon}
              </span>
            )
          )}
          <span className={`truncate font-medium ${maxTriggerWidthClass}`}>
            {selectedOption ? selectedOption.label : placeholder}
          </span>
        </span>

        {isActive ? (
          <span
            role="button"
            tabIndex={-1}
            aria-label={`Limpar ${placeholder}`}
            onClick={(e) => {
              e.stopPropagation();
              onChange("");
            }}
            className="p-0.5 rounded hover:bg-white/10 text-[var(--text-muted)] hover:text-[var(--text-primary)] transition-colors"
          >
            <X size={12} />
          </span>
        ) : (
          <ChevronDown
            size={13}
            className={`text-[var(--text-muted)] shrink-0 transition-transform duration-150 ${
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
        align={align}
        width={popoverWidth}
      >
        <div onKeyDown={handleKeyDown}>
          {shouldShowSearch && (
            <div className="p-2 border-b border-[var(--surface-border)]">
              <div className="relative flex items-center">
                <Search
                  size={13}
                  className="absolute left-2.5 text-[var(--text-muted)] pointer-events-none"
                />
                <input
                  ref={searchInputRef}
                  type="text"
                  value={query}
                  onChange={(e) => {
                    setQuery(e.target.value);
                    setHighlightedIndex(0);
                  }}
                  placeholder={searchPlaceholder}
                  className="w-full h-[30px] pl-8 pr-7 rounded-md bg-[var(--bg-primary)] border border-[var(--surface-border)] text-xs text-[var(--text-primary)] placeholder:text-[var(--text-muted)] focus:outline-none focus:border-[#6c5ce7]"
                />
                {query && (
                  <button
                    type="button"
                    onClick={() => setQuery("")}
                    className="absolute right-2 text-[var(--text-muted)] hover:text-[var(--text-primary)] cursor-pointer"
                  >
                    <X size={12} />
                  </button>
                )}
              </div>
            </div>
          )}

          <div
            id={listboxId}
            role="listbox"
            className="max-h-[260px] overflow-y-auto atelier-scrollbar p-1.5 flex flex-col gap-0.5"
          >
            {filteredOptions.length === 0 ? (
              <div className="py-6 px-3 text-center text-xs text-[var(--text-muted)]">
                Nenhuma opção encontrada
              </div>
            ) : (
              filteredOptions.map((opt, idx) => {
                const isSelected = opt.value === value;
                const isHighlighted = idx === highlightedIndex;
                return (
                  <button
                    key={opt.value || "__ALL__"}
                    type="button"
                    role="option"
                    aria-selected={isSelected}
                    onMouseEnter={() => setHighlightedIndex(idx)}
                    onClick={() => handleSelect(opt.value)}
                    className={`w-full flex items-center justify-between gap-2 px-2.5 py-1.5 rounded-md text-xs text-left transition-colors cursor-pointer ${
                      isSelected
                        ? "bg-[#6c5ce7]/15 text-[var(--text-primary)] font-semibold"
                        : isHighlighted
                        ? "bg-[var(--surface-hover)] text-[var(--text-primary)]"
                        : "text-[var(--text-secondary)] hover:bg-[var(--surface-hover)]"
                    }`}
                  >
                    <span className="flex items-center gap-2 min-w-0">
                      {opt.dotColor && (
                        <span
                          className="w-2 h-2 rounded-full shrink-0"
                          style={{ backgroundColor: opt.dotColor }}
                        />
                      )}
                      {opt.initials && (
                        <span className="w-5 h-5 rounded-full bg-[var(--bg-elevated)] border border-[var(--surface-border)] text-[9px] font-mono flex items-center justify-center shrink-0 text-[var(--text-secondary)]">
                          {opt.initials}
                        </span>
                      )}
                      <span className="truncate">{opt.label}</span>
                    </span>

                    <span className="flex items-center gap-1.5 shrink-0">
                      {typeof opt.count === "number" && (
                        <span className="font-mono tabular-nums text-[10px] text-[var(--text-muted)]">
                          {opt.count}
                        </span>
                      )}
                      {isSelected && <Check size={13} className="text-[#8b7ef8]" />}
                    </span>
                  </button>
                );
              })
            )}
          </div>
        </div>
      </FloatingPopover>
    </>
  );
}

