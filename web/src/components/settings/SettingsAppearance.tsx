"use client";

import { Moon, Sun, Cpu, Sparkles } from "lucide-react";
import { useTheme, Theme } from "@/contexts/ThemeContext";

export default function SettingsAparencia() {
  const { theme, changeThemeWithTransition } = useTheme();

  return (
    <div className="space-y-8">
      <div>
        <h2 className="text-xl font-bold text-white mb-2">Aparência</h2>
        <p className="text-sm text-slate-400">
          Personalize o tema de cores da interface do sistema.
        </p>
      </div>

      <div className="bg-slate-800/50 rounded-2xl border border-slate-700/50 p-6">
        <div className="flex items-center gap-4 mb-6">
          <div className="p-3 bg-indigo-500/10 rounded-xl text-indigo-500">
            <Cpu size={24} />
          </div>
          <div>
            <h3 className="text-lg font-medium text-white">Tema da Interface</h3>
            <p className="text-sm text-slate-400">Escolha entre o modo claro, escuro, ou o novo tema tecnológico.</p>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-5 gap-4">
          
          {/* Card Modo Claro */}
          <button
            onClick={() => changeThemeWithTransition("light") }
            className={`relative flex flex-col items-start p-5 rounded-xl border transition-all ${
              theme === "light" 
                ? "border-emerald-500 bg-emerald-500/5"
                : "hover:border-slate-500 border-slate-700 bg-slate-900/50"
            }`}
          >
            <div className="flex items-center gap-3 mb-3">
              <Sun size={20} className={`${theme === 'light' ? 'text-emerald-500' : 'text-slate-400'}`} />
              <span className={`font-medium ${theme === 'light' ? 'text-emerald-500' : 'text-white'}`}>
                Modo Claro
              </span>
            </div>
            <div className="w-full h-24 rounded-md bg-[#f8fafc] border border-[#e2e8f0] flex flex-col gap-2 p-3">
              <div className="w-1/3 h-2 rounded bg-[#94a3b8]" />
              <div className="w-2/3 h-2 rounded bg-[#cbd5e1]" />
              <div className="w-1/2 h-2 rounded bg-[#cbd5e1]" />
            </div>
            {theme === "light" && (
              <div className="absolute top-4 right-4">
                <div className="w-2.5 h-2.5 bg-emerald-500 rounded-full shadow-[0_0_12px_hsla(150,100%,40%,0.8)]" />
              </div>
            )}
          </button>

          {/* Card Modo Escuro */}
          <button
            onClick={() => changeThemeWithTransition("dark") }
            className={`relative flex flex-col items-start p-5 rounded-xl border transition-all ${
              theme === "dark" 
                ? "border-emerald-500 bg-emerald-500/5"
                : "hover:border-slate-500 border-slate-700 bg-slate-900/50"
            }`}
          >
            <div className="flex items-center gap-3 mb-3">
              <Moon size={20} className={`${theme === 'dark' ? 'text-emerald-500' : 'text-slate-400'}`} />
              <span className={`font-medium ${theme === 'dark' ? 'text-emerald-500' : 'text-white'}`}>
                Modo Escuro
              </span>
            </div>
            <div className="w-full h-24 rounded-md bg-[#020617] border border-[#1e293b] flex flex-col gap-2 p-3">
              <div className="w-1/3 h-2 rounded bg-[#334155]" />
              <div className="w-2/3 h-2 rounded bg-[#1e293b]" />
              <div className="w-1/2 h-2 rounded bg-[#1e293b]" />
            </div>
            {theme === "dark" && (
              <div className="absolute top-4 right-4">
                <div className="w-2.5 h-2.5 bg-emerald-500 rounded-full shadow-[0_0_12px_hsla(150,100%,40%,0.8)]" />
              </div>
            )}
          </button>

          {/* Card Modo Cyber (n8n) */}
          <button
            onClick={() => changeThemeWithTransition("n8n") }
            className={`relative flex flex-col items-start p-5 rounded-xl border transition-all ${
              theme === "n8n" 
                ? "border-[#fd8925] bg-[#fd8925]/5"
                : "hover:border-[#3e3a46] border-[#3e3a46] bg-[#0e0918]/50"
            }`}
          >
            <div className="flex items-center gap-3 mb-3">
              <Cpu size={20} className={`${theme === 'n8n' ? 'text-[#fd8925]' : 'text-[#9d9797]'}`} />
              <span className={`font-medium ${theme === 'n8n' ? 'text-[#fd8925]' : 'text-[#d1cece]'}`}>
                Modo Cyber
              </span>
            </div>
            <div className="w-full h-24 rounded-md bg-[#0e0918] border border-[#3e3a46] flex flex-col gap-2 p-3 relative overflow-hidden">
              <div className="w-1/3 h-2 rounded bg-[#48556a]" />
              <div className="w-2/3 h-2 rounded bg-[#2c2834]" />
              <div className="absolute bottom-3 right-3 w-1/3 h-4 rounded bg-[image:var(--gradient-ember-cta)]" />
            </div>
            {theme === "n8n" && (
              <div className="absolute top-4 right-4">
                <div className="w-2.5 h-2.5 rounded-full shadow-[0_0_12px_rgba(253,137,37,0.8)] bg-[#fd8925]" />
              </div>
            )}
          </button>

          {/* Card Modo Authkit (Vidro Fosco) */}
          <button
            onClick={() => changeThemeWithTransition("authkit") }
            className={`relative flex flex-col items-start p-5 rounded-xl border transition-all ${
              theme === "authkit" 
                ? "border-[#663af3] bg-[#663af3]/10 shadow-[0_0_20px_rgba(102,58,243,0.15)]"
                : "hover:border-[#3a414f] border-[#2f343e] bg-[#05060f]/60"
            }`}
          >
            <div className="flex items-center gap-3 mb-3">
              <Sparkles size={20} className={`${theme === 'authkit' ? 'text-[#663af3]' : 'text-[#9da7ba]'}`} />
              <span className={`font-medium text-sm ${theme === 'authkit' ? 'text-[#d1e4fa]' : 'text-white'}`}>
                Modo Authkit
              </span>
            </div>
            <div className="w-full h-24 rounded-md bg-[#05060f] border border-slate-700/50 flex flex-col gap-2 p-3 relative overflow-hidden backdrop-blur-sm">
              <div className="w-1/3 h-2 rounded bg-[#3f4959]" />
              <div className="w-2/3 h-2 rounded bg-[#2f343e]" />
              <div className="absolute bottom-3 right-3 w-1/3 h-4 rounded-full bg-[#663af3] shadow-[0_0_10px_rgba(102,58,243,0.5)]" />
            </div>
            {theme === "authkit" && (
              <div className="absolute top-4 right-4">
                <div className="w-2.5 h-2.5 rounded-full shadow-[0_0_12px_rgba(102,58,243,0.9)] bg-[#663af3]" />
              </div>
            )}
          </button>
        
          {/* Card Modo Jeton */}
          <button
            onClick={() => changeThemeWithTransition("jeton") }
            className={`relative flex flex-col items-start p-5 rounded-xl border transition-all ${
              theme === "jeton" 
                ? "border-[#f73b20] bg-[#f73b20]/5 shadow-[0_0_20px_rgba(247,59,32,0.15)]"
                : "hover:border-[#e7dcdb] border-[#fdedea] bg-[#ffffff]/60"
            }`}
          >
            <div className="flex items-center gap-3 mb-3">
              <Sparkles size={20} className={`${theme === 'jeton' ? 'text-[#f73b20]' : 'text-[#ababab]'}`} />
              <span className={`font-medium text-sm ${theme === 'jeton' ? 'text-[#f73b20]' : 'text-[#360802]'}`}>
                Modo Jeton
              </span>
            </div>
            <div className="w-full h-24 rounded-md bg-[#ffffff] border border-[#e7dcdb] flex flex-col gap-2 p-3 relative overflow-hidden backdrop-blur-sm">
              <div className="w-1/3 h-2 rounded bg-[#f73b20]" />
              <div className="w-2/3 h-2 rounded bg-[#fdedea]" />
              <div className="absolute bottom-3 right-3 w-1/3 h-4 rounded-full bg-[#f73b20] shadow-[0_0_10px_rgba(247,59,32,0.5)]" />
            </div>
            {theme === "jeton" && (
              <div className="absolute top-4 right-4">
                <div className="w-2.5 h-2.5 rounded-full shadow-[0_0_12px_rgba(247,59,32,0.9)] bg-[#f73b20]" />
              </div>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}