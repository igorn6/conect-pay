"use client";

import React from "react";

interface ShinyBadgeProps {
  children: React.ReactNode;
  variant?: "emerald" | "amber" | "purple" | "neutral" | "rose";
  className?: string;
  icon?: React.ReactNode;
}

export default function ShinyBadge({
  children,
  variant = "emerald",
  className = "",
  icon,
}: ShinyBadgeProps) {
  const variantStyles = {
    emerald: "bg-emerald-500/10 text-emerald-400 border-emerald-500/30",
    amber: "bg-amber-500/10 text-amber-300 border-amber-500/30",
    purple: "bg-purple-500/10 text-purple-300 border-purple-500/30",
    neutral: "bg-slate-800/80 text-slate-300 border-slate-700/60",
    rose: "bg-rose-500/10 text-rose-300 border-rose-500/30",
  };

  return (
    <span
      className={`relative inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-semibold border overflow-hidden backdrop-blur-sm select-none ${variantStyles[variant]} ${className}`}
    >
      {/* Metallic Shimmer Sweep */}
      <span
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 -translate-x-full animate-[shimmer_3s_infinite] bg-gradient-to-r from-transparent via-white/15 to-transparent"
      />
      {icon && <span className="shrink-0">{icon}</span>}
      <span className="relative z-10">{children}</span>
    </span>
  );
}
