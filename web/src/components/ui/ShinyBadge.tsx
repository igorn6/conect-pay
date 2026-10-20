"use client";

import React from "react";

interface ShinyBadgeProps {
  children: React.ReactNode;
  variant?: "emerald" | "amber" | "purple" | "neutral" | "rose" | "slate" | "blue" | string;
  size?: "sm" | "md" | "lg";
  className?: string;
  icon?: React.ReactNode;
  shimmer?: boolean;
}

export default function ShinyBadge({
  children,
  variant = "emerald",
  size = "md",
  className = "",
  icon,
  shimmer = false,
}: ShinyBadgeProps) {
  const variantStyles: Record<string, string> = {
    emerald: "bg-emerald-500/10 text-emerald-300 border-emerald-500/20",
    amber: "bg-amber-500/10 text-amber-300 border-amber-500/20",
    purple: "bg-purple-500/10 text-purple-300 border-purple-500/20",
    neutral: "bg-white/[0.05] text-slate-300 border-white/10",
    slate: "bg-white/[0.05] text-slate-300 border-white/10",
    rose: "bg-rose-500/10 text-rose-300 border-rose-500/20",
    blue: "bg-blue-500/10 text-blue-300 border-blue-500/20",
  };

  const sizeStyles: Record<string, string> = {
    sm: "px-2 py-0.5 text-[10px]",
    md: "px-2.5 py-0.5 text-[11px]",
    lg: "px-3 py-1 text-xs",
  };

  const selectedVariant = variantStyles[variant] || variantStyles.neutral;
  const selectedSize = sizeStyles[size] || sizeStyles.md;

  return (
    <span
      className={`relative inline-flex items-center gap-1.5 rounded-full font-medium border overflow-hidden backdrop-blur-sm select-none ${selectedSize} ${selectedVariant} ${className}`}
    >
      {/* Optional Metallic Shimmer Sweep */}
      {shimmer && (
        <span
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 -translate-x-full animate-[shimmer_3s_infinite] bg-gradient-to-r from-transparent via-white/15 to-transparent"
        />
      )}
      {icon && <span className="shrink-0">{icon}</span>}
      <span className="relative z-10">{children}</span>
    </span>
  );
}
