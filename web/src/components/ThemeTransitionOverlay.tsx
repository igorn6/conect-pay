"use client";

import { useTheme } from "@/contexts/ThemeContext";

export default function ThemeTransitionOverlay() {
  const { isTransitioning, transitionProgress } = useTheme();

  if (!isTransitioning) return null;

  return (
    <div className="fixed inset-0 z-[9999] flex flex-col items-center justify-center bg-[#0e0918] text-[#d1cece] transition-opacity duration-300">
      <div className="flex flex-col items-center gap-6 w-full max-w-md px-6">
        
        {/* Animated Icon / Logo Placeholder */}
        <div className="relative flex items-center justify-center w-16 h-16 rounded-2xl bg-[#1a1624] shadow-[0_0_15px_rgba(253,137,37,0.15)] border border-[#3e3a46]">
          <div className="absolute inset-0 rounded-2xl bg-[image:var(--gradient-ember-cta)] opacity-20 animate-pulse" />
          <svg className="w-8 h-8 text-[#fd8925] z-10 animate-spin" style={{ animationDuration: '3s' }} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M12 2v20M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" />
          </svg>
        </div>

        {/* Text */}
        <div className="text-center space-y-2">
          <h2 className="text-xl font-bold text-white tracking-tight">Atualizando Módulos Visuais...</h2>
          <p className="text-sm text-[#9d9797]">Aplicando novas configurações de interface</p>
        </div>

        {/* Progress Bar Container */}
        <div className="w-full h-1.5 bg-[#1b1728] rounded-full overflow-hidden mt-4 border border-[#3e3a46]">
          <div 
            className="h-full bg-[image:var(--gradient-ember-cta)] transition-all duration-100 ease-out"
            style={{ width: `${Math.min(100, Math.max(0, transitionProgress))}%` }}
          />
        </div>
        
        <div className="text-xs text-[#48556a] font-monão mt-2">
          SYS_THEME_INIT: {Math.round(transitionProgress)}%
        </div>

      </div>
    </div>
  );
}
