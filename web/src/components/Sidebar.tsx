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
  Sun
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
  { name: "Relatórios (IA)", href: "/relatorios", icon: Sun, requiredRoles: ["MASTER", "FINANCEIRO", "GESTOR"] },
  { name: "Configurações", href: "/configuracoes", icon: Settings, requiredRoles: ["MASTER", "FINANCEIRO", "GESTOR"] },
];

export default function Sidebar() {
  const pathname = usePathname();
  const { theme } = useTheme();
  const { userRole, userName, avatarUrl, sectorName } = useAuth();
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
        className={`fixed inset-y-0 left-0 z-50 border-r border-slate-800 h-full flex flex-col shrink-0 bg-slate-900 transition-all duration-300 ease-in-out md:relative md:translate-x-0 ${
          isOpen ? "translate-x-0" : "-translate-x-full"
        } ${isCollapsed ? "w-64 md:w-20" : "w-64"}`} 
      >
        {/* Toggle Button (Floating Tab) */}
        <button
          onClick={() => setIsCollapsed(!isCollapsed)}
          className="hidden md:flex absolute -right-[20px] top-[90px] z-50 items-center justify-center w-[20px] h-10 bg-slate-900 hover:bg-slate-800 border-y border-r border-slate-800 border-l-0 rounded-r-full text-slate-500 hover:text-white transition-colors cursor-pointer"
          title={isCollapsed ? "Expandir Menu" : "Recolher Menu"}
        >
          {isCollapsed ? <ChevronRight size={14} strokeWidth={2.5} className="-ml-1" /> : <ChevronLeft size={14} strokeWidth={2.5} className="-ml-1" />}
        </button>

        {/* Header / Brand */}
        <div className="flex items-center justify-between px-6 h-[73px] border-b border-slate-800 shrink-0">
          <Link target="_self" href="/" aria-label="Ir para a página inicial" className="flex items-center h-full pt-1 overflow-hidden">
            <BrandLogo isCollapsed={isCollapsed} />
          </Link>
          
          <button onClick={() => setIsOpen(false)} className="md:hidden p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-white/10 transition-colors">
            <X size={20} />
          </button>
        </div>

        {/* User Profile Quick Link */}
        {(userRole === "GESTOR" || userRole === "MASTER" || userRole === "FINANCEIRO") && (
          <div className="px-4 pt-6 pb-2 border-b border-slate-800/50">
            <Link target="_self" 
              href="/configuracoes"
              onClick={() => setIsOpen(false)}
              className={`flex items-center gap-3 p-3 rounded-xl bg-slate-800/50 hover:bg-slate-800 border border-slate-700/50 transition-colors ${isCollapsed ? "justify-center" : ""}`}
              title="Meu Perfil"
            >
              <img 
                src={`https://ui-avatars.com/api/?name=${encodeURIComponent(userName || 'G')}&background=10b981&color=fff&size=32`} 
                alt="Avatar" 
                className="w-8 h-8 rounded-full shrink-0"
              />
              {!isCollapsed && (
                <div className="overflow-hidden">
                  <p className="text-sm font-medium text-slate-200 truncate">{userName || "Meu Perfil"}</p>
                  <p className="text-xs text-slate-500 truncate">{userRole === "GESTOR" ? (sectorName ? `Gestor • ${sectorName}` : "Gestor") : (userRole === "FINANCEIRO" ? "Financeiro" : "Master")}</p>
                </div>
              )}
            </Link>
          </div>
        )}

        {/* Navigation */}
        <nav className="flex-1 overflow-y-auto py-6 px-4 flex flex-col gap-1.5">
          {!isCollapsed && (
            <div className="text-xs font-semibold mb-2 px-3 tracking-wider uppercase whitespace-nowrap text-slate-500">
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
                className={`flex items-center gap-3 px-3 py-5.5 rounded-xl text-sm font-medium transition-all overflow-hidden ${
                  isActive 
                    ? "bg-slate-800 text-white" 
                    : "text-slate-400 hover:text-slate-200 hover:bg-slate-800/50"
                } ${isCollapsed ? "justify-center" : "justify-start"}`}
                onClick={() => setIsOpen(false)}
              >
                <item.icon size={18} className={`shrink-0 ${isActive ? "text-white" : "text-slate-400"}`} />
                {!isCollapsed && <span className="whitespace-nowrap">{item.name}</span>}
              </Link>
            );
          })}
        </nav>

        {/* Rodapé com Versão */}
        <div className="px-5 py-3 border-t border-slate-800/80 text-[11px] text-slate-500 flex items-center justify-between shrink-0">
          {!isCollapsed ? (
            <>
              <span className="font-medium text-slate-400">Conect Pay</span>
              <span className="font-mono text-slate-400 font-semibold">v{APP_VERSION}</span>
            </>
          ) : (
            <span className="w-full text-center font-mono text-[10px] text-slate-500">v{APP_VERSION}</span>
          )}
        </div>
      </aside>
    </>
  );
}
