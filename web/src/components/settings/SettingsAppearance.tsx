"use client";

import { Moon, Sun, Cpu, Sparkles } from "lucide-react";
import { useTheme, Theme } from "@/contexts/ThemeContext";

export default function SettingsAparencia() {
  const { theme, changeThemeWithTransition } = useTheme();

  return (
    <div className="space-y-8">
      <div>
        <h2 className="text-xl font-bold mb-2" style={{ color: "var(--text-primary)" }}>
          Aparência
        </h2>
        <p className="text-sm" style={{ color: "var(--text-secondary)" }}>
          Personalize o tema visual da interface com fluidez e contraste impecável.
        </p>
      </div>

      <div 
        className="rounded-2xl border p-6 shadow-sm transition-colors"
        style={{
          backgroundColor: "var(--bg-secondary)",
          borderColor: "var(--surface-border)",
        }}
      >
        <div className="flex items-center gap-4 mb-6">
          <div className="p-3 bg-emerald-500/10 rounded-xl text-emerald-500">
            <Cpu size={24} />
          </div>
          <div>
            <h3 className="text-lg font-semibold" style={{ color: "var(--text-primary)" }}>
              Tema da Interface
            </h3>
            <p className="text-sm" style={{ color: "var(--text-muted)" }}>
              Escolha entre paletas claras, escuras ou tecnológicas com alto contraste.
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-5 gap-4">
          
          {/* Card Modo Claro */}
          <button
            type="button"
            onClick={() => changeThemeWithTransition("light")}
            className="relative flex flex-col items-start p-5 rounded-xl border transition-all text-left cursor-pointer"
            style={{
              backgroundColor: theme === "light" ? "rgba(16, 185, 129, 0.08)" : "var(--bg-card)",
              borderColor: theme === "light" ? "var(--brand-primary)" : "var(--surface-border)",
              boxShadow: theme === "light" ? "0 0 15px rgba(16, 185, 129, 0.2)" : "none",
            }}
          >
            <div className="flex items-center gap-3 mb-3">
              <Sun size={20} className={theme === "light" ? "text-emerald-500" : "text-amber-500"} />
              <span className="font-semibold text-sm" style={{ color: "var(--text-primary)" }}>
                Modo Claro
              </span>
            </div>
            <div className="w-full h-24 rounded-lg bg-[#f8fafc] border border-[#cbd5e1] flex flex-col gap-2 p-3 shadow-inner">
              <div className="w-1/3 h-2.5 rounded bg-[#090d16]" />
              <div className="w-2/3 h-2 rounded bg-[#94a3b8]" />
              <div className="w-1/2 h-2 rounded bg-[#cbd5e1]" />
            </div>
            {theme === "light" && (
              <div className="absolute top-4 right-4">
                <div className="w-2.5 h-2.5 bg-emerald-500 rounded-full shadow-[0_0_10px_rgba(16,185,129,0.9)]" />
              </div>
            )}
          </button>

          {/* Card Modo Escuro */}
          <button
            type="button"
            onClick={() => changeThemeWithTransition("dark")}
            className="relative flex flex-col items-start p-5 rounded-xl border transition-all text-left cursor-pointer"
            style={{
              backgroundColor: theme === "dark" ? "rgba(16, 185, 129, 0.08)" : "var(--bg-card)",
              borderColor: theme === "dark" ? "var(--brand-primary)" : "var(--surface-border)",
              boxShadow: theme === "dark" ? "0 0 15px rgba(16, 185, 129, 0.2)" : "none",
            }}
          >
            <div className="flex items-center gap-3 mb-3">
              <Moon size={20} className={theme === "dark" ? "text-emerald-400" : "text-indigo-400"} />
              <span className="font-semibold text-sm" style={{ color: "var(--text-primary)" }}>
                Modo Escuro
              </span>
            </div>
            <div className="w-full h-24 rounded-lg bg-[#080b12] border border-[#253046] flex flex-col gap-2 p-3 shadow-inner">
              <div className="w-1/3 h-2.5 rounded bg-[#f8fafc]" />
              <div className="w-2/3 h-2 rounded bg-[#64748b]" />
              <div className="w-1/2 h-2 rounded bg-[#1e273d]" />
            </div>
            {theme === "dark" && (
              <div className="absolute top-4 right-4">
                <div className="w-2.5 h-2.5 bg-emerald-500 rounded-full shadow-[0_0_10px_rgba(16,185,129,0.9)]" />
              </div>
            )}
          </button>

          {/* Card Modo Cyber (n8n) */}
          <button
            type="button"
            onClick={() => changeThemeWithTransition("n8n")}
            className="relative flex flex-col items-start p-5 rounded-xl border transition-all text-left cursor-pointer"
            style={{
              backgroundColor: theme === "n8n" ? "rgba(253, 137, 37, 0.1)" : "var(--bg-card)",
              borderColor: theme === "n8n" ? "#fd8925" : "var(--surface-border)",
              boxShadow: theme === "n8n" ? "0 0 15px rgba(253, 137, 37, 0.2)" : "none",
            }}
          >
            <div className="flex items-center gap-3 mb-3">
              <Cpu size={20} className={theme === "n8n" ? "text-[#fd8925]" : "text-amber-500"} />
              <span className="font-semibold text-sm" style={{ color: "var(--text-primary)" }}>
                Modo Cyber
              </span>
            </div>
            <div className="w-full h-24 rounded-lg bg-[#090513] border border-[#3b2959] flex flex-col gap-2 p-3 relative overflow-hidden shadow-inner">
              <div className="w-1/3 h-2.5 rounded bg-[#ffffff]" />
              <div className="w-2/3 h-2 rounded bg-[#3b2959]" />
              <div className="absolute bottom-3 right-3 w-1/3 h-4 rounded bg-[image:var(--gradient-ember-cta)] shadow-md" />
            </div>
            {theme === "n8n" && (
              <div className="absolute top-4 right-4">
                <div className="w-2.5 h-2.5 rounded-full shadow-[0_0_10px_rgba(253,137,37,0.9)] bg-[#fd8925]" />
              </div>
            )}
          </button>

          {/* Card Modo Authkit (Vidro Fosco) */}
          <button
            type="button"
            onClick={() => changeThemeWithTransition("authkit")}
            className="relative flex flex-col items-start p-5 rounded-xl border transition-all text-left cursor-pointer"
            style={{
              backgroundColor: theme === "authkit" ? "rgba(124, 77, 255, 0.1)" : "var(--bg-card)",
              borderColor: theme === "authkit" ? "#7c4dff" : "var(--surface-border)",
              boxShadow: theme === "authkit" ? "0 0 15px rgba(124, 77, 255, 0.2)" : "none",
            }}
          >
            <div className="flex items-center gap-3 mb-3">
              <Sparkles size={20} className={theme === "authkit" ? "text-[#7c4dff]" : "text-violet-400"} />
              <span className="font-semibold text-sm" style={{ color: "var(--text-primary)" }}>
                Modo Authkit
              </span>
            </div>
            <div className="w-full h-24 rounded-lg bg-[#050711] border border-[#2a354c] flex flex-col gap-2 p-3 relative overflow-hidden shadow-inner backdrop-blur-sm">
              <div className="w-1/3 h-2.5 rounded bg-[#f8fbff]" />
              <div className="w-2/3 h-2 rounded bg-[#2a354c]" />
              <div className="absolute bottom-3 right-3 w-1/3 h-4 rounded-full bg-[#7c4dff] shadow-[0_0_10px_rgba(124,77,255,0.6)]" />
            </div>
            {theme === "authkit" && (
              <div className="absolute top-4 right-4">
                <div className="w-2.5 h-2.5 rounded-full shadow-[0_0_10px_rgba(124,77,255,0.9)] bg-[#7c4dff]" />
              </div>
            )}
          </button>
        
          {/* Card Modo Jeton */}
          <button
            type="button"
            onClick={() => changeThemeWithTransition("jeton")}
            className="relative flex flex-col items-start p-5 rounded-xl border transition-all text-left cursor-pointer"
            style={{
              backgroundColor: theme === "jeton" ? "rgba(247, 59, 32, 0.08)" : "var(--bg-card)",
              borderColor: theme === "jeton" ? "#f73b20" : "var(--surface-border)",
              boxShadow: theme === "jeton" ? "0 0 15px rgba(247, 59, 32, 0.2)" : "none",
            }}
          >
            <div className="flex items-center gap-3 mb-3">
              <Sparkles size={20} className={theme === "jeton" ? "text-[#f73b20]" : "text-orange-500"} />
              <span className="font-semibold text-sm" style={{ color: "var(--text-primary)" }}>
                Modo Jeton
              </span>
            </div>
            <div className="w-full h-24 rounded-lg bg-[#ffffff] border border-[#e2d7d5] flex flex-col gap-2 p-3 relative overflow-hidden shadow-inner">
              <div className="w-1/3 h-2.5 rounded bg-[#190805]" />
              <div className="w-2/3 h-2 rounded bg-[#e2d7d5]" />
              <div className="absolute bottom-3 right-3 w-1/3 h-4 rounded-full bg-[#f73b20] shadow-[0_0_10px_rgba(247,59,32,0.6)]" />
            </div>
            {theme === "jeton" && (
              <div className="absolute top-4 right-4">
                <div className="w-2.5 h-2.5 rounded-full shadow-[0_0_10px_rgba(247,59,32,0.9)] bg-[#f73b20]" />
              </div>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}