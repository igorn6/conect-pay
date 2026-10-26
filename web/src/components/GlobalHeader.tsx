"use client";

import { MessageSquare, LogOut, UserCircle, Palette } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { useTheme, Theme } from "@/contexts/ThemeContext";
import { useChat } from "@/contexts/ChatContext";
import React from "react";
import { useRouter } from "next/navigation";

/**
 * Cabecalho fixo global - aparece em todas as paginas.
 * Contem: foto/perfil, icone do chat com badge, botao sair.
 */
import ShinyBadge from "@/components/ui/ShinyBadge";

export default function GlobalHeader() {
  const [showThemeMenu, setShowThemeMenu] = React.useState(false);
  const { theme, changeThemeWithTransition } = useTheme();
  const { userName, userRole, avatarUrl, logout, sectorName } = useAuth();
  const { isChatOpen, setIsChatOpen, totalUnread } = useChat();
  const router = useRouter();

  const avatar = avatarUrl
    || `https://ui-avatars.com/api/?name=${encodeURIComponent(userName || "U")}&background=1e293b&color=cbd5e1&size=36`;

  const roleLabel =
    userRole === "MASTER"
      ? "Master"
      : userRole === "FINANCEIRO"
      ? "Financeiro"
      : sectorName
      ? `Gestor • ${sectorName}`
      : "Gestor";

  return (
    <header
      className="flex items-center justify-between px-6 h-[73px] border-b shrink-0 z-30 backdrop-blur-xl transition-colors duration-300"
      style={{
        backgroundColor: "color-mix(in srgb, var(--bg-secondary) 85%, transparent)",
        borderColor: "var(--surface-border)",
      }}
    >
      {/* Left: Profile */}
      <button
        onClick={() => router.push("/configuracoes")}
        className="flex items-center gap-3 pl-12 md:pl-0 hover:opacity-90 transition-opacity cursor-pointer group"
      >
        <div className="relative">
          <img
            src={avatar}
            alt="Avatar"
            className="w-10 h-10 rounded-full object-cover border border-white/10 group-hover:border-white/20 transition-colors shadow-sm"
          />
          <span className="absolute bottom-0 right-0 w-2.5 h-2.5 rounded-full bg-emerald-500/80 ring-2 ring-slate-950" />
        </div>
        <div className="hidden sm:block text-left">
          <p className="text-sm font-semibold leading-tight tracking-tight" style={{ color: "var(--text-primary)" }}>
            {userName}
          </p>
          <div className="mt-1">
            <ShinyBadge variant="neutral" className="text-[10px] font-mono tracking-tight py-0.5 px-2">
              {roleLabel}
            </ShinyBadge>
          </div>
        </div>
      </button>

      {/* Right: Chat + Logout */}
      <div className="flex items-center gap-3">
        {/* Theme Selector */}
        <div className="relative">
          <button
            onClick={() => setShowThemeMenu(!showThemeMenu)}
            className="p-2.5 rounded-lg hover:bg-white/5 transition-colors cursor-pointer"
            style={{ color: "var(--text-muted)" }}
            title="Tema"
          >
            <Palette size={20} />
          </button>
          
          {showThemeMenu && (
            <>
              <div className="fixed inset-0 z-40" onClick={() => setShowThemeMenu(false)} />
              <div className="absolute right-0 mt-2 w-48 rounded-xl border z-50 overflow-hidden shadow-xl"
                   style={{ backgroundColor: "var(--bg-primary)", borderColor: "var(--surface-border)" }}>
                {(['light', 'dark', 'n8n', 'authkit', 'jeton', 'designtech'] as Theme[]).map((t) => {
                  const labelMap: Record<string, string> = { 
                    light: "Modo Claro", 
                    dark: "Modo Escuro", 
                    n8n: "Modo Cyber", 
                    authkit: "Modo Authkit", 
                    jeton: "Modo Jeton",
                    designtech: "Modo Designtech"
                  };
                  return (
                  <button
                    key={t}
                    onClick={() => { changeThemeWithTransition(t); setShowThemeMenu(false); }}
                    className="w-full text-left px-4 py-3 text-sm transition-colors hover:bg-white/5 flex items-center justify-between"
                    style={{ 
                      color: theme === t ? "var(--text-primary)" : "var(--text-muted)",
                    }}
                  >
                    <span>{labelMap[t]}</span>
                    {theme === t && (
                      <div className={`w-1.5 h-1.5 rounded-full ${
                        t === "designtech"
                          ? "bg-[#FF6A00] shadow-[0_0_8px_#FF6A00]"
                          : t === "jeton"
                          ? "bg-[#f73b20]"
                          : t === "authkit"
                          ? "bg-[#7c4dff]"
                          : t === "n8n"
                          ? "bg-[#fd8925]"
                          : "bg-emerald-500"
                      }`} />
                    )}
                  </button>
                )})}
              </div>
            </>
          )}
        </div>

        {/* Chat toggle */}
        <button
          onClick={() => setIsChatOpen(!isChatOpen)}
          className="relative p-2.5 rounded-lg hover:bg-white/5 transition-colors cursor-pointer"
          title="Chat"
          style={{ color: isChatOpen ? "var(--text-primary)" : "var(--text-muted)" }}
        >
          <MessageSquare size={22} />
          {totalUnread > 0 && (
            <span className="absolute -top-1 -right-1 bg-rose-600 text-white text-[10px] font-bold rounded-full min-w-[18px] h-[18px] flex items-center justify-center px-1 shadow-md">
              {totalUnread > 99 ? "99+" : totalUnread}
            </span>
          )}
        </button>

        {/* Logout */}
        <button
          onClick={logout}
          className="p-2.5 rounded-lg hover:bg-white/5 text-gray-400 hover:text-red-400 transition-colors cursor-pointer"
          title="Sair"
        >
          <LogOut size={20} />
        </button>
      </div>
    </header>
  );
}

