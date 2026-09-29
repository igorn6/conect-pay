"use client";

import { Plus, UserCircle, LogOut } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";

interface HeaderProps {
  onNewRequest: () => void;
}

/**
 * Header principal do Conect Pay.
 * Exibe saudação e o botão "Nova Solicitação".
 */
export default function Header({ onNewRequest }: HeaderProps) {
  const { userName, userRole, logout } = useAuth();
  return (
    <header
      className="flex items-center justify-between px-6 h-[73px] border-b shrink-0"
      style={{
        backgroundColor: "var(--bg-secondary)",
        borderColor: "var(--surface-border)",
      }}
    >
      {/* Mobile Menu & Greeting */}
      <div className="flex items-center gap-3 pl-12 md:pl-0">
        <div>
          <h1 className="text-sm font-medium" style={{ color: "var(--text-secondary)" }}>
            Bem-vindo(a),
          </h1>
          <p className="text-base font-bold leading-tight tracking-tight" style={{ color: "var(--text-primary)" }}>
            {userName}
          </p>
        </div>
      </div>

      {/* Ações */}
      <div className="flex items-center gap-4">
        
        <div className="hidden md:flex items-center gap-2 px-3 py-1.5 rounded-lg border"
          style={{
            backgroundColor: "var(--bg-card)",
            borderColor: "var(--surface-border)",
          }}>
          <UserCircle size={16} style={{ color: "var(--text-muted)" }} />
          <span className="text-xs font-semibold" style={{ color: "var(--text-primary)" }}>
            Perfil: {userRole}
          </span>
        </div>

        <button
          onClick={logout}
          className="p-2 rounded-lg hover:bg-white/5 text-gray-400 hover:text-red-400 transition-colors"
          title="Sair"
        >
          <LogOut size={18} />
        </button>

        <button
          onClick={onNewRequest}
          className="flex items-center gap-2 px-4 py-2.5 text-sm font-semibold text-white rounded-lg cursor-pointer"
          style={{
            background:
              "linear-gradient(135deg, var(--brand-primary), var(--brand-primary-hover))",
            boxShadow: "0 4px 14px var(--brand-glow)",
            transition: "var(--transition-base)",
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.transform = "translateY(-1px)";
            e.currentTarget.style.boxShadow = "0 6px 20px var(--brand-glow)";
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.transform = "translateY(0)";
            e.currentTarget.style.boxShadow = "0 4px 14px var(--brand-glow)";
          }}
        >
          <Plus size={18} strokeWidth={2.5} />
          Nova Solicitação
        </button>
      </div>
    </header>
  );
}
