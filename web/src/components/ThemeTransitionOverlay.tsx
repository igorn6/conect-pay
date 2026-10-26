"use client";

import { useTheme } from "@/contexts/ThemeContext";

export default function ThemeTransitionOverlay() {
  const { isTransitioning, transitionProgress, theme } = useTheme();

  if (!isTransitioning) return null;

  const isDesigntech = theme === "designtech";

  return (
    <div 
      className={`fixed inset-0 z-[9999] flex flex-col items-center justify-center transition-opacity duration-300 ${
        isDesigntech ? "bg-[#000000] text-[#9a9a9a]" : "bg-[#0e0918] text-[#d1cece]"
      }`}
    >
      <div className="flex flex-col items-center gap-6 w-full max-w-md px-6">
        
        {/* Animated Icon / Logo Placeholder */}
        <div 
          className={`relative flex items-center justify-center w-16 h-16 ${
            isDesigntech 
              ? "rounded-none bg-[#0d0d0d] border border-[#FF6A00]/50 shadow-[0_0_24px_rgba(255,106,0,0.35)]" 
              : "rounded-2xl bg-[#1a1624] shadow-[0_0_15px_rgba(253,137,37,0.15)] border border-[#3e3a46]"
          }`}
        >
          {isDesigntech && (
            <>
              <div className="absolute top-0.5 left-0.5 w-1.5 h-1.5 border-t border-l border-[#FF6A00]" />
              <div className="absolute top-0.5 right-0.5 w-1.5 h-1.5 border-t border-r border-[#FF6A00]" />
              <div className="absolute bottom-0.5 left-0.5 w-1.5 h-1.5 border-b border-l border-[#FF6A00]" />
              <div className="absolute bottom-0.5 right-0.5 w-1.5 h-1.5 border-b border-r border-[#FF6A00]" />
            </>
          )}
          <div 
            className={`absolute inset-0 ${isDesigntech ? "rounded-none bg-gradient-to-tr from-[#E35A00] to-[#FF6A00]" : "rounded-2xl bg-[image:var(--gradient-ember-cta)]"} opacity-20 animate-pulse`} 
          />
          <svg 
            className={`w-8 h-8 z-10 animate-spin ${isDesigntech ? "text-[#FF6A00]" : "text-[#fd8925]"}`} 
            style={{ animationDuration: '3s' }} 
            viewBox="0 0 24 24" 
            fill="none" 
            stroke="currentColor" 
            strokeWidth="2" 
            strokeLinecap="round" 
            strokeLinejoin="round"
          >
            <path d="M12 2v20M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" />
          </svg>
        </div>

        {/* Text */}
        <div className="text-center space-y-2">
          <h2 className="text-xl font-bold text-white tracking-tight">
            {isDesigntech ? "Conectsol Designtech: Sincronizando..." : "Atualizando Módulos Visuais..."}
          </h2>
          <p className="text-sm text-[#9a9a9a]">
            {isDesigntech ? "Editorial Silence × Industrial Solar Plasma" : "Aplicando novas configurações de interface"}
          </p>
        </div>

        {/* Progress Bar Container */}
        <div 
          className={`w-full h-1.5 overflow-hidden mt-4 border ${
            isDesigntech 
              ? "rounded-none bg-[#111111] border-white/10" 
              : "rounded-full bg-[#1b1728] border-[#3e3a46]"
          }`}
        >
          <div 
            className={`h-full transition-all duration-100 ease-out ${
              isDesigntech 
                ? "bg-gradient-to-r from-[#E35A00] via-[#FF6A00] to-[#FFA439] shadow-[0_0_12px_#FF6A00]" 
                : "bg-[image:var(--gradient-ember-cta)]"
            }`}
            style={{ width: `${Math.min(100, Math.max(0, transitionProgress))}%` }}
          />
        </div>
        
        <div className="text-xs text-[#6d6d6d] font-mono mt-2 tracking-wider">
          {isDesigntech ? `DESIGNTECH_CORE_INIT: ${Math.round(transitionProgress)}% · [0PX_ARCH / 75PX_PILL]` : `SYS_THEME_INIT: ${Math.round(transitionProgress)}%`}
        </div>

      </div>
    </div>
  );
}
