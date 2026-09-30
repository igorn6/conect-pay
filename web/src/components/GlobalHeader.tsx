"use client";

import { MessageSquare, LogOut, UserCircle } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { useChat } from "@/contexts/ChatContext";
import { useRouter } from "next/navigation";

/**
 * Cabecalho fixo global - aparece em todas as paginas.
 * Contem: foto/perfil, icone do chat com badge, botao sair.
 */
export default function GlobalHeader() {
  const { userName, userRole, avatarUrl, logout } = useAuth();
  const { isChatOpen, setIsChatOpen, totalUnread } = useChat();
  const router = useRouter();

  const avatar = avatarUrl
    || `https://ui-avatars.com/api/?name=${encodeURIComponent(userName || "U")}&background=10b981&color=fff&size=36`;

  const roleLabel =
    userRole === "MASTER"
      ? "Master"
      : userRole === "FINANCEIRO"
      ? "Financeiro"
      : "Gestor";

  return (
    <header
      className="flex items-center justify-between px-6 h-[73px] border-b shrink-0 z-30"
      style={{
        backgroundColor: "var(--bg-secondary)",
        borderColor: "var(--surface-border)",
      }}
    >
      {/* Left: Profile */}
      <button
        onClick={() => router.push("/configuracoes")}
        className="flex items-center gap-3 pl-12 md:pl-0 hover:opacity-80 transition-opacity cursor-pointer"
      >
        <img
          src={avatar}
          alt="Avatar"
          className="w-10 h-10 rounded-full object-cover border-2 border-emerald-500/30"
        />
        <div className="hidden sm:block text-left">
          <p className="text-base font-semibold leading-tight" style={{ color: "var(--text-primary)" }}>
            {userName}
          </p>
          <p className="text-xs leading-tight" style={{ color: "var(--text-muted)" }}>
            {roleLabel}
          </p>
        </div>
      </button>

      {/* Right: Chat + Logout */}
      <div className="flex items-center gap-3">
        {/* Chat toggle */}
        <button
          onClick={() => setIsChatOpen(!isChatOpen)}
          className="relative p-2.5 rounded-lg hover:bg-white/5 transition-colors cursor-pointer"
          title="Chat"
          style={{ color: isChatOpen ? "#10b981" : "var(--text-muted)" }}
        >
          <MessageSquare size={24} />
          {totalUnread > 0 && (
            <span className="absolute -top-1 -right-1 bg-red-500 text-white text-[10px] font-bold rounded-full min-w-[20px] h-[20px] flex items-center justify-center px-1 shadow-lg animate-pulse">
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
          <LogOut size={22} />
        </button>
      </div>
    </header>
  );
}

