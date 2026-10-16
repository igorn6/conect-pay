"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { 
  Columns, 
  Search, 
  LayoutDashboard, 
  Download, 
  Settings, 
  Users, 
  Menu, 
  X, 
  ChevronLeft, 
  ChevronRight,
  Home,
  UserCircle,
  Sparkles,
  Wallet
} from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { useTheme } from "@/contexts/ThemeContext";
import BrandLogo from "@/components/BrandLogo";
import { APP_VERSION } from "@/constants/version";

const NAV_ITEMS = [
  { name: "Início", href: "/", icon: Home, requiredRoles: ["MASTER", "FINANCEIRO", "GESTOR"] },
  { name: "Solicitações Kanban", href: "/kanban", icon: Columns, requiredRoles: ["MASTER", "FINANCEIRO", "GESTOR"] },
  { name: "Consultar Solicitações", href: "/consultas", icon: Search, requiredRoles: ["MASTER", "FINANCEIRO", "GESTOR"] },
  { name: "Dashboard", href: "/dashboard", icon: LayoutDashboard, requiredRoles: ["MASTER", "FINANCEIRO", "GESTOR"] },
  { name: "Nubank / Caju", href: "/nubank", icon: Wallet, requiredRoles: ["MASTER", "FINANCEIRO"] },
  { name: "Assistente IA", href: "/relatorios", icon: Sparkles, requiredRoles: ["MASTER", "FINANCEIRO", "GESTOR"] },
  { name: "Configurações", href: "/configuracoes", icon: Settings, requiredRoles: ["MASTER", "FINANCEIRO", "GESTOR"] },
];

export default function Sidebar() {
  const pathname = usePathname();
  const { theme } = useTheme();
  const { userRole } = useAuth();
  const [isOpen, setIsOpen] = useState(false);
  const [isCollapsed, setIsCollapsed] = useState(false);

  return (
    <>
      {/* Botão Hambúrguer Mobile (Fixo) Ki */}
      <button
        onClick={() => setIsOpen(true)}
        className="md:hidden fixed top-4 left-4 z-40 p-2 rounded-lg bg-slate-900 border border-slate-800 text-white shadow-lg hover:bg-slate-800 transition-colors"
      >
        <Menu size={20} />
      </button>

      {/* Backdrop Mobile */}
      {isOpen && (
        <div
          className="fixed inset-0 bg-black/60 z-40 md:hidden backdrop-blur-sm"
          onClick={() => setIsOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside 
        className={`fixed inset-y-0 left-0 z-50 border-r h-full flex flex-col shrink-0 transition-all duration-300 ease-in-out md:relative md:translate-x-0 ${
          isOpen ? "translate-x-0" : "-translate-x-full"
        } ${isCollapsed ? "w-64 md:w-20" : "w-64"}`} 
        style={{
          backgroundColor: "var(--bg-secondary)",
          borderColor: "var(--surface-border)",
        }}
      >
        {/* Toggle Button (Floating Tab) */}
        <button
          onClick={() => setIsCollapsed(!isCollapsed)}
          className="hidden md:flex absolute -right-[20px] top-[90px] z-50 items-center justify-center w-[20px] h-10 border-y border-r border-l-0 rounded-r-full transition-colors cursor-pointer"
          style={{
            backgroundColor: "var(--bg-secondary)",
            borderColor: "var(--surface-border)",
            color: "var(--text-muted)",
          }}
          title={isCollapsed ? "Expandir Menu" : "Recolher Menu"}
        >
          {isCollapsed ? <ChevronRight size={14} strokeWidth={2.5} className="-ml-1" /> : <ChevronLeft size={14} strokeWidth={2.5} className="-ml-1" />}
        </button>

        {/* Header / Brand */}
        <div 
          className="flex items-center justify-between px-6 h-[73px] border-b shrink-0"
          style={{ borderColor: "var(--surface-border)" }}
        >
          <Link target="_self" href="/" aria-label="Ir para a página inicial" className="flex items-center h-full pt-1 overflow-hidden">
            <BrandLogo isCollapsed={isCollapsed} />
          </Link>
          
          <button 
            onClick={() => setIsOpen(false)} 
            className="md:hidden p-1.5 rounded-lg transition-colors"
            style={{ color: "var(--text-muted)" }}
          >
            <X size={20} />
          </button>
        </div>

        {/* Navigation */}
        <nav className="flex-1 overflow-y-auto py-6 px-4 flex flex-col gap-1.5">
          {!isCollapsed && (
            <div 
              className="text-xs font-semibold mb-2 px-3 tracking-wider uppercase whitespace-nowrap font-mono"
              style={{ color: "var(--text-muted)" }}
            >
              MENU
            </div>
          )}
          
          {NAV_ITEMS.map((item) => {
            // Controle de Acesso Estrito
            if (!item.requiredRoles.includes(userRole as string)) return null;

            const isActive = pathname === item.href;

            return (
              <Link
                key={item.name}
                href={item.href}
                title={isCollapsed ? item.name : undefined}
                className={`flex items-center gap-3 px-3 py-3 rounded-xl text-sm font-medium transition-all overflow-hidden ${
                  isCollapsed ? "justify-center" : "justify-start"
                }`}
                style={
                  isActive 
                    ? {
                        backgroundColor: "var(--surface-hover)",
                        color: "var(--text-primary)",
                        fontWeight: 600,
                        border: "1px solid var(--surface-border)",
                      }
                    : {
                        color: "var(--text-secondary)",
                      }
                }
                onClick={() => setIsOpen(false)}
              >
                <item.icon 
                  size={18} 
                  className="shrink-0 transition-colors" 
                  style={{ color: isActive ? "var(--brand-primary)" : "inherit" }} 
                />
                {!isCollapsed && <span className="whitespace-nowrap">{item.name}</span>}
              </Link>
            );
          })}
        </nav>

        {/* Rodapé com Versão */}
        <div 
          className="px-5 py-3 border-t text-[11px] flex items-center justify-between shrink-0"
          style={{ borderColor: "var(--surface-border)", color: "var(--text-muted)" }}
        >
          {!isCollapsed ? (
            <>
              <span className="font-medium" style={{ color: "var(--text-secondary)" }}>Conect Pay</span>
              <span className="font-mono font-semibold" style={{ color: "var(--text-primary)" }}>v{APP_VERSION}</span>
            </>
          ) : (
            <span className="w-full text-center font-mono text-[10px]" style={{ color: "var(--text-muted)" }}>v{APP_VERSION}</span>
          )}
        </div>
      </aside>
    </>
  );
}
