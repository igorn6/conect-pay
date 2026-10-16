"use client";

import { useEffect, useState, useCallback, useMemo } from "react";
import { useRouter } from "next/navigation";
import {
  Wallet,
  ArrowDownLeft,
  ArrowUpRight,
  RefreshCw,
  Plus,
  AlertCircle,
  AlertTriangle,
  SlidersHorizontal,
  Mail,
  Copy,
  Check,
  ExternalLink,
  ShieldAlert,
  Calendar,
  Filter,
  FileText,
  Clock,
  Sparkles,
  ArrowRight,
  Search,
} from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import type { NubankSnapshot, NubankMovement } from "@/constants/nubank";

export default function NubankCajuPage() {
  const router = useRouter();
  const { userRole, userName, userId } = useAuth();
  const isMaster = userRole === "MASTER";
  const isFinanceiro = userRole === "FINANCEIRO";

  // Redireciona gestores que tentarem acessar diretamente
  useEffect(() => {
    if (userRole && !isMaster && !isFinanceiro) {
      router.push("/");
    }
  }, [userRole, isMaster, isFinanceiro, router]);

  const [snapshot, setSnapshot] = useState<NubankSnapshot | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Filtros do extrato
  const [movementFilter, setMovementFilter] = useState<"ALL" | "ENTRADA" | "SAIDA" | "REEMBOLSO" | "AJUSTE">("ALL");
  const [searchQuery, setSearchQuery] = useState("");

  // Modais
  const [isRecharging, setIsRecharging] = useState(false);
  const [rechargeSuccessData, setRechargeSuccessData] = useState<{
    card: any;
    email: { to: string; subject: string; body: string; encodedSubject: string; encodedBody: string };
  } | null>(null);
  const [copiedEmail, setCopiedEmail] = useState(false);

  const [isRefundModalOpen, setIsRefundModalOpen] = useState(false);
  const [refundAmount, setRefundAmount] = useState("");
  const [refundDescription, setRefundDescription] = useState("");
  const [isSubmittingRefund, setIsSubmittingRefund] = useState(false);
  const [refundError, setRefundError] = useState<string | null>(null);

  const [isAdjustModalOpen, setIsAdjustModalOpen] = useState(false);
  const [adjustTargetBalance, setAdjustTargetBalance] = useState("");
  const [adjustReason, setAdjustReason] = useState("");
  const [isSubmittingAdjust, setIsSubmittingAdjust] = useState(false);
  const [adjustError, setAdjustError] = useState<string | null>(null);

  // Buscar dados
  const fetchBalance = useCallback(async (isSilent = false) => {
    try {
      if (!isSilent) setRefreshing(true);
      setError(null);

      const res = await fetch("/api/nubank-balance?limit=100", { cache: "no-store" });
      if (!res.ok) throw new Error("Falha ao consultar saldo Nubank");
      const data: NubankSnapshot = await res.json();
      setSnapshot(data);
    } catch (err: any) {
      console.error("Erro ao carregar dados do Nubank:", err);
      setError(err.message || "Erro de conexão");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    fetchBalance(false);
    const handleUpdate = () => fetchBalance(true);
    window.addEventListener("nubank-balance-updated", handleUpdate);
    return () => window.removeEventListener("nubank-balance-updated", handleUpdate);
  }, [fetchBalance]);

  const formatBRL = (val: number) => {
    return new Intl.NumberFormat("pt-BR", {
      style: "currency",
      currency: "BRL",
    }).format(val);
  };

  const handleAmountInput = (val: string, setter: (v: string) => void) => {
    let num = val.replace(/\D/g, "");
    if (!num) {
      setter("");
      return;
    }
    num = (Number(num) / 100).toFixed(2);
    setter(num.replace(".", ",").replace(/\B(?=(\d{3})+(?!\d))/g, "."));
  };

  const parseCurrencyInput = (val: string): number => {
    const clean = val.replace(/[\R$\s.]/g, "").replace(",", ".");
    return parseFloat(clean) || 0;
  };

  // Ação: Solicitar Recarga Nubank
  const handleRequestRecharge = async () => {
    try {
      setIsRecharging(true);
      const res = await fetch("/api/nubank-balance/request-recharge", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
      });

      if (!res.ok) {
        const errJson = await res.json();
        throw new Error(errJson.error || "Falha ao solicitar recarga.");
      }

      const data = await res.json();
      setRechargeSuccessData(data);
      fetchBalance(true);
    } catch (err: any) {
      alert("Erro ao solicitar recarga: " + err.message);
    } finally {
      setIsRecharging(false);
    }
  };

  // Submeter Reembolso
  const handleSubmitRefund = async (e: React.FormEvent) => {
    e.preventDefault();
    setRefundError(null);
    const amountNum = parseCurrencyInput(refundAmount);
    if (amountNum <= 0) {
      setRefundError("Informe um valor válido maior que zero.");
      return;
    }
    if (!refundDescription.trim()) {
      setRefundError("A justificativa/motivo do reembolso é obrigatória.");
      return;
    }

    try {
      setIsSubmittingRefund(true);
      const res = await fetch("/api/nubank-balance/refund", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          amount: amountNum,
          description: refundDescription.trim(),
        }),
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Erro ao registrar reembolso.");
      }

      setIsRefundModalOpen(false);
      setRefundAmount("");
      setRefundDescription("");
      fetchBalance(true);
    } catch (err: any) {
      setRefundError(err.message || "Erro inesperado.");
    } finally {
      setIsSubmittingRefund(false);
    }
  };

  // Submeter Ajuste Master
  const handleSubmitAdjust = async (e: React.FormEvent) => {
    e.preventDefault();
    setAdjustError(null);
    const targetBalanceNum = parseCurrencyInput(adjustTargetBalance);
    if (targetBalanceNum < 0) {
      setAdjustError("Informe um saldo válido.");
      return;
    }
    if (!adjustReason.trim()) {
      setAdjustError("O motivo do ajuste é obrigatório.");
      return;
    }

    try {
      setIsSubmittingAdjust(true);
      const res = await fetch("/api/nubank-balance/adjust", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          targetBalance: targetBalanceNum,
          reason: adjustReason.trim(),
        }),
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Erro ao ajustar saldo.");
      }

      setIsAdjustModalOpen(false);
      setAdjustTargetBalance("");
      setAdjustReason("");
      fetchBalance(true);
    } catch (err: any) {
      setAdjustError(err.message || "Erro inesperado.");
    } finally {
      setIsSubmittingAdjust(false);
    }
  };

  // Filtragem do Extrato
  const filteredMovements = useMemo(() => {
    if (!snapshot?.movements) return [];
    return snapshot.movements.filter((mov) => {
      if (movementFilter === "ENTRADA" && mov.amount <= 0) return false;
      if (movementFilter === "SAIDA" && mov.amount >= 0) return false;
      if (movementFilter === "REEMBOLSO" && mov.type !== "REEMBOLSO") return false;
      if (movementFilter === "AJUSTE" && mov.type !== "AJUSTE") return false;

      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const desc = (mov.description || "").toLowerCase();
        const type = mov.type.toLowerCase();
        return desc.includes(q) || type.includes(q);
      }
      return true;
    });
  }, [snapshot?.movements, movementFilter, searchQuery]);

  // Totais do Extrato
  const { totalEntradas, totalSaidas } = useMemo(() => {
    let ent = 0;
    let sai = 0;
    if (snapshot?.movements) {
      for (const m of snapshot.movements) {
        if (m.amount > 0) ent += m.amount;
        else sai += Math.abs(m.amount);
      }
    }
    return { totalEntradas: ent, totalSaidas: sai };
  }, [snapshot?.movements]);

  const currentBalance = snapshot?.balance ?? 609.74;
  const isBalanceCritical = currentBalance <= 350;

  if (!isMaster && !isFinanceiro) return null;

  return (
    <div className="flex-1 overflow-y-auto w-full p-4 md:p-6 custom-scrollbar" style={{ color: "var(--text-primary)" }}>
      <div className="max-w-[1360px] mx-auto space-y-6">
        
        {/* Top Header */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 pb-2 border-b" style={{ borderColor: "var(--surface-border)" }}>
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-2xl font-bold tracking-tight">Nubank / Caju</h1>
              <span className="text-xs font-bold uppercase tracking-wider px-2.5 py-0.5 rounded-full bg-[#820AD1]/20 text-[#d8b4fe] border border-[#820AD1]/40">
                Nubank 02 • Ativo
              </span>
              <span className="text-[10px] font-semibold uppercase tracking-wider px-2 py-0.5 rounded-full bg-slate-800 text-slate-400 border border-slate-700">
                Caju • Em breve
              </span>
            </div>
            <p className="text-sm mt-1" style={{ color: "var(--text-secondary)" }}>
              Gestão de saldo corporativo, extrato de movimentações e recargas centralizadas.
            </p>
          </div>

          <div className="flex items-center gap-2.5 flex-wrap">
            <button
              onClick={() => fetchBalance(false)}
              disabled={refreshing}
              className="p-2.5 rounded-xl border transition-colors cursor-pointer hover:bg-white/5"
              style={{ borderColor: "var(--surface-border)", color: "var(--text-muted)" }}
              title="Atualizar saldo e extrato"
            >
              <RefreshCw size={16} className={refreshing ? "animate-spin text-[#c084fc]" : ""} />
            </button>

            {isMaster && (
              <button
                onClick={() => {
                  setAdjustError(null);
                  setAdjustTargetBalance("");
                  setAdjustReason("");
                  setIsAdjustModalOpen(true);
                }}
                className="flex items-center gap-1.5 px-3.5 py-2.5 rounded-xl border text-xs font-semibold transition-all hover:bg-white/5 cursor-pointer"
                style={{ borderColor: "var(--surface-border)", color: "var(--text-secondary)" }}
              >
                <SlidersHorizontal size={14} />
                <span>Ajustar Saldo</span>
              </button>
            )}

            <button
              onClick={() => {
                setRefundError(null);
                setRefundAmount("");
                setRefundDescription("");
                setIsRefundModalOpen(true);
              }}
              className="flex items-center gap-1.5 px-3.5 py-2.5 rounded-xl border text-xs font-semibold transition-all hover:bg-white/5 cursor-pointer"
              style={{ borderColor: "var(--surface-border)", color: "var(--text-secondary)" }}
            >
              <Plus size={14} />
              <span>Registrar Reembolso</span>
            </button>

            <button
              onClick={handleRequestRecharge}
              disabled={isRecharging}
              className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-400 hover:to-teal-500 text-slate-950 font-bold text-xs shadow-lg shadow-emerald-950/40 transition-all cursor-pointer hover:scale-[1.02] active:scale-[0.98] disabled:opacity-50"
            >
              <Sparkles size={14} className="text-slate-950" />
              <span>{isRecharging ? "Lançando..." : "⚡ Solicitar Recarga (R$ 1.500)"}</span>
            </button>
          </div>
        </div>

        {/* ALERTA CRÍTICO: Saldo <= R$ 350 */}
        {isBalanceCritical && !loading && (
          <div className="p-4 sm:p-5 rounded-2xl bg-amber-500/10 border-2 border-amber-500/40 shadow-xl flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 animate-in fade-in">
            <div className="flex items-start gap-3.5">
              <div className="p-2.5 rounded-xl bg-amber-500/20 text-amber-400 shrink-0 mt-0.5">
                <AlertTriangle size={24} className="animate-pulse" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-amber-400 uppercase tracking-wide">
                  Atenção: Saldo Nubank Atingiu o Limite Crítico ({formatBRL(currentBalance)})
                </h3>
                <p className="text-xs text-amber-200/90 leading-relaxed mt-0.5">
                  O saldo está em R$ 350,00 ou menos. Solicite a recarga de R$ 1.500,00 para garantir que as baixas do Kanban continuem sendo liquidadas sem interrupções.
                </p>
              </div>
            </div>

            <button
              onClick={handleRequestRecharge}
              disabled={isRecharging}
              className="w-full sm:w-auto px-5 py-2.5 rounded-xl bg-amber-400 hover:bg-amber-300 text-slate-950 font-bold text-xs shadow-md shadow-amber-950/30 transition-all cursor-pointer shrink-0 flex items-center justify-center gap-1.5"
            >
              <Sparkles size={14} />
              <span>{isRecharging ? "Lançando..." : "Solicitar Recarga Imediata (R$ 1.500)"}</span>
            </button>
          </div>
        )}

        {/* Saldo Principal + Cards de Visão Geral */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          
          {/* Card 1: Saldo Principal Nubank */}
          <div className="rounded-2xl p-6 relative overflow-hidden shadow-xl border bg-gradient-to-br from-slate-900 via-[#181126] to-slate-900 border-[#820AD1]/40 flex flex-col justify-between">
            <div className="absolute top-0 right-0 -mr-12 -mt-12 w-48 h-48 bg-[#820AD1]/20 rounded-full blur-3xl pointer-events-none" />
            
            <div>
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold uppercase tracking-wider text-[#d8b4fe]">
                  Saldo em Conta Nubank
                </span>
                <div className="w-8 h-8 rounded-xl bg-[#820AD1]/30 text-[#d8b4fe] flex items-center justify-center">
                  <Wallet size={16} />
                </div>
              </div>

              <div className="mt-3">
                {loading ? (
                  <div className="h-10 w-44 bg-slate-800 rounded animate-pulse" />
                ) : (
                  <div className="text-3xl sm:text-4xl font-black text-white tracking-tight">
                    {formatBRL(currentBalance)}
                  </div>
                )}
                <p className="text-[11px] text-slate-400 mt-1">
                  Abatimento e liquidação automática atrelados ao Kanban.
                </p>
              </div>
            </div>

            <div className="pt-4 mt-4 border-t border-slate-800/80 flex items-center justify-between text-[11px] text-slate-400">
              <span>Trava anti-duplicidade: <strong className="text-emerald-400">Ativa</strong></span>
              {snapshot?.updatedAt && (
                <span>Atualizado às {new Date(snapshot.updatedAt).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}</span>
              )}
            </div>
          </div>

          {/* Card 2: Total Entradas / Recargas */}
          <div 
            className="rounded-2xl p-6 shadow-sm border flex flex-col justify-between"
            style={{ backgroundColor: "var(--bg-card)", borderColor: "var(--surface-border)" }}
          >
            <div>
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold uppercase tracking-wider" style={{ color: "var(--text-muted)" }}>
                  Entradas / Recargas
                </span>
                <div className="w-8 h-8 rounded-xl bg-emerald-500/15 text-emerald-400 flex items-center justify-center">
                  <ArrowDownLeft size={16} />
                </div>
              </div>

              <div className="mt-3">
                <div className="text-2xl sm:text-3xl font-bold text-emerald-400">
                  {formatBRL(totalEntradas)}
                </div>
                <p className="text-[11px] mt-1" style={{ color: "var(--text-muted)" }}>
                  Entradas de recargas aprovadas e reembolsos creditados.
                </p>
              </div>
            </div>

            <div className="pt-4 mt-4 border-t text-[11px]" style={{ borderColor: "var(--surface-border)", color: "var(--text-muted)" }}>
              <span>Conciliação histórica Nubank 02</span>
            </div>
          </div>

          {/* Card 3: Total Saídas / Pagamentos */}
          <div 
            className="rounded-2xl p-6 shadow-sm border flex flex-col justify-between"
            style={{ backgroundColor: "var(--bg-card)", borderColor: "var(--surface-border)" }}
          >
            <div>
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold uppercase tracking-wider" style={{ color: "var(--text-muted)" }}>
                  Saídas / Pagamentos
                </span>
                <div className="w-8 h-8 rounded-xl bg-rose-500/15 text-rose-400 flex items-center justify-center">
                  <ArrowUpRight size={16} />
                </div>
              </div>

              <div className="mt-3">
                <div className="text-2xl sm:text-3xl font-bold text-rose-400">
                  {formatBRL(totalSaidas)}
                </div>
                <p className="text-[11px] mt-1" style={{ color: "var(--text-muted)" }}>
                  Total debitado por solicitações finalizadas na conta.
                </p>
              </div>
            </div>

            <div className="pt-4 mt-4 border-t text-[11px]" style={{ borderColor: "var(--surface-border)", color: "var(--text-muted)" }}>
              <span>Total de saídas registradas</span>
            </div>
          </div>
        </div>

        {/* Extrato Bancário Completo */}
        <div 
          className="rounded-2xl border shadow-sm overflow-hidden"
          style={{ backgroundColor: "var(--bg-secondary)", borderColor: "var(--surface-border)" }}
        >
          {/* Header do Extrato com Filtros */}
          <div className="p-4 sm:p-5 border-b flex flex-col md:flex-row items-start md:items-center justify-between gap-4" style={{ borderColor: "var(--surface-border)" }}>
            <div>
              <h2 className="text-base font-bold tracking-tight">Extrato de Movimentações Nubank</h2>
              <p className="text-xs mt-0.5" style={{ color: "var(--text-muted)" }}>
                Registro contínuo e auditável de cada débito e crédito realizado.
              </p>
            </div>

            {/* Controles de Filtro e Busca */}
            <div className="flex items-center gap-2.5 flex-wrap w-full md:w-auto">
              <div className="relative flex-1 md:w-56">
                <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: "var(--text-muted)" }} />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Buscar no extrato..."
                  className="w-full pl-8 pr-3 py-1.5 rounded-lg text-xs outline-none border transition-colors"
                  style={{
                    backgroundColor: "var(--bg-card)",
                    borderColor: "var(--surface-border)",
                    color: "var(--text-primary)",
                  }}
                />
              </div>

              <div className="flex items-center gap-1 p-1 rounded-lg border" style={{ backgroundColor: "var(--bg-card)", borderColor: "var(--surface-border)" }}>
                {(
                  [
                    { id: "ALL", label: "Todas" },
                    { id: "ENTRADA", label: "Entradas" },
                    { id: "SAIDA", label: "Saídas" },
                    { id: "REEMBOLSO", label: "Reembolsos" },
                    { id: "AJUSTE", label: "Ajustes" },
                  ] as const
                ).map((tab) => (
                  <button
                    key={tab.id}
                    onClick={() => setMovementFilter(tab.id)}
                    className="px-2.5 py-1 rounded-md text-[11px] font-semibold transition-all cursor-pointer"
                    style={
                      movementFilter === tab.id
                        ? { backgroundColor: "var(--surface-hover)", color: "var(--text-primary)" }
                        : { color: "var(--text-muted)" }
                    }
                  >
                    {tab.label}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Tabela do Extrato */}
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="border-b text-[11px] uppercase tracking-wider font-mono font-semibold" style={{ borderColor: "var(--surface-border)", backgroundColor: "var(--surface-hover)", color: "var(--text-muted)" }}>
                  <th className="px-5 py-3.5">Data / Hora</th>
                  <th className="px-4 py-3.5">Tipo</th>
                  <th className="px-4 py-3.5">Descrição / Motivo</th>
                  <th className="px-4 py-3.5 text-right">Valor</th>
                  <th className="px-5 py-3.5 text-right">Saldo Resultante</th>
                </tr>
              </thead>
              <tbody className="divide-y" style={{ borderColor: "var(--surface-border)" }}>
                {loading ? (
                  <tr>
                    <td colSpan={5} className="py-12 text-center text-xs" style={{ color: "var(--text-muted)" }}>
                      <RefreshCw size={20} className="animate-spin mx-auto mb-2 text-[#c084fc]" />
                      <span>Carregando extrato bancário...</span>
                    </td>
                  </tr>
                ) : filteredMovements.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="py-12 text-center text-xs" style={{ color: "var(--text-muted)" }}>
                      <FileText size={28} className="mx-auto mb-2 opacity-40" />
                      <span>Nenhuma movimentação encontrada para os filtros selecionados.</span>
                    </td>
                  </tr>
                ) : (
                  filteredMovements.map((mov) => {
                    const isPositive = mov.amount > 0;
                    return (
                      <tr 
                        key={mov.id} 
                        className="transition-colors hover:bg-white/[0.02]"
                      >
                        <td className="px-5 py-3.5 whitespace-nowrap font-mono" style={{ color: "var(--text-secondary)" }}>
                          {new Date(mov.created_at).toLocaleDateString("pt-BR", {
                            day: "2-digit",
                            month: "2-digit",
                            year: "numeric",
                          })}{" "}
                          <span className="opacity-70 text-[10px]">
                            {new Date(mov.created_at).toLocaleTimeString("pt-BR", {
                              hour: "2-digit",
                              minute: "2-digit",
                            })}
                          </span>
                        </td>

                        <td className="px-4 py-3.5 whitespace-nowrap">
                          {mov.type === "ENTRADA" && (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/15 text-emerald-400 border border-emerald-500/30">
                              <ArrowDownLeft size={10} />
                              <span>Recarga / Entrada</span>
                            </span>
                          )}
                          {mov.type === "SAIDA" && (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-rose-500/15 text-rose-400 border border-rose-500/30">
                              <ArrowUpRight size={10} />
                              <span>Pagamento Débito</span>
                            </span>
                          )}
                          {mov.type === "REEMBOLSO" && (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-500/15 text-amber-300 border border-amber-500/30">
                              <Plus size={10} />
                              <span>Reembolso</span>
                            </span>
                          )}
                          {mov.type === "AJUSTE" && (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-purple-500/15 text-purple-300 border border-purple-500/30">
                              <SlidersHorizontal size={10} />
                              <span>Ajuste Manual</span>
                            </span>
                          )}
                        </td>

                        <td className="px-4 py-3.5 font-medium max-w-md truncate" title={mov.description || undefined} style={{ color: "var(--text-primary)" }}>
                          {mov.description || "Movimentação Nubank"}
                        </td>

                        <td className="px-4 py-3.5 text-right font-bold font-mono whitespace-nowrap">
                          <span className={isPositive ? "text-emerald-400" : "text-rose-400"}>
                            {isPositive ? "+" : ""}
                            {formatBRL(mov.amount)}
                          </span>
                        </td>

                        <td className="px-5 py-3.5 text-right font-mono font-semibold whitespace-nowrap" style={{ color: "var(--text-primary)" }}>
                          {formatBRL(mov.balance_after)}
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>

      </div>

      {/* ========================================================
          MODAL DE RECARGA CONCLUÍDA (E-mail para Tássio)
          ======================================================== */}
      {rechargeSuccessData && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in">
          <div 
            className="w-full max-w-lg rounded-2xl border p-6 shadow-2xl relative"
            style={{ backgroundColor: "var(--bg-secondary)", borderColor: "var(--surface-border)" }}
          >
            <div className="flex items-start gap-3.5 mb-4">
              <div className="w-10 h-10 rounded-xl bg-emerald-500/20 text-emerald-400 flex items-center justify-center shrink-0">
                <Sparkles size={20} />
              </div>
              <div>
                <h3 className="text-base font-bold" style={{ color: "var(--text-primary)" }}>
                  Solicitação de Recarga Lançada no Kanban!
                </h3>
                <p className="text-xs mt-0.5" style={{ color: "var(--text-secondary)" }}>
                  O card de R$ 1.500,00 foi inserido no Kanban. Envie o e-mail padronizado para Tássio:
                </p>
              </div>
            </div>

            {/* Caixa de Texto do E-mail */}
            <div 
              className="p-4 rounded-xl border font-mono text-xs whitespace-pre-wrap leading-relaxed select-text"
              style={{ backgroundColor: "var(--bg-primary)", borderColor: "var(--surface-border)", color: "var(--text-primary)" }}
            >
              {rechargeSuccessData.email.body}
            </div>

            {/* Ações */}
            <div className="flex items-center justify-between gap-3 mt-5 flex-wrap">
              <button
                type="button"
                onClick={() => {
                  navigator.clipboard.writeText(rechargeSuccessData.email.body);
                  setCopiedEmail(true);
                  setTimeout(() => setCopiedEmail(false), 2000);
                }}
                className="flex items-center gap-1.5 px-3.5 py-2.5 rounded-xl border text-xs font-semibold transition-all hover:bg-white/5 cursor-pointer"
                style={{ borderColor: "var(--surface-border)", color: "var(--text-secondary)" }}
              >
                {copiedEmail ? <Check size={14} className="text-emerald-400" /> : <Copy size={14} />}
                <span>{copiedEmail ? "Copiado!" : "Copiar Texto"}</span>
              </button>

              <div className="flex items-center gap-2">
                <a
                  href={`https://mail.google.com/mail/?view=cm&fs=1&to=${rechargeSuccessData.email.to}&su=${rechargeSuccessData.email.encodedSubject}&body=${rechargeSuccessData.email.encodedBody}`}
                  target="_blank"
                  rel="noreferrer"
                  className="flex items-center gap-1.5 px-4 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs shadow-md transition-all cursor-pointer"
                >
                  <Mail size={14} />
                  <span>Abrir no Gmail</span>
                </a>

                <button
                  type="button"
                  onClick={() => setRechargeSuccessData(null)}
                  className="px-4 py-2.5 rounded-xl text-xs font-semibold hover:bg-white/10 transition-colors cursor-pointer"
                  style={{ color: "var(--text-muted)" }}
                >
                  Fechar
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* MODAL REGISTRAR REEMBOLSO */}
      {isRefundModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in">
          <div className="w-full max-w-md rounded-2xl border p-6 shadow-2xl relative" style={{ backgroundColor: "var(--bg-secondary)", borderColor: "var(--surface-border)" }}>
            <div className="flex items-center justify-between pb-3 mb-4 border-b" style={{ borderColor: "var(--surface-border)" }}>
              <div className="flex items-center gap-2">
                <div className="p-2 rounded-lg bg-emerald-500/10 text-emerald-400">
                  <Plus size={18} />
                </div>
                <h3 className="text-sm font-bold" style={{ color: "var(--text-primary)" }}>Registrar Reembolso no Nubank</h3>
              </div>
              <button onClick={() => setIsRefundModalOpen(false)} className="text-slate-400 hover:text-white">✕</button>
            </div>

            <form onSubmit={handleSubmitRefund} className="space-y-4">
              {refundError && (
                <div className="p-3 rounded-lg bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs">
                  {refundError}
                </div>
              )}

              <div>
                <label className="block text-xs font-semibold mb-1" style={{ color: "var(--text-secondary)" }}>Valor do Reembolso (R$) *</label>
                <input
                  type="text"
                  required
                  value={refundAmount}
                  onChange={(e) => handleAmountInput(e.target.value, setRefundAmount)}
                  placeholder="0,00"
                  className="w-full px-3.5 py-2.5 rounded-xl text-sm font-bold outline-none border focus:border-emerald-500"
                  style={{ backgroundColor: "var(--bg-card)", borderColor: "var(--surface-border)", color: "var(--text-primary)" }}
                />
              </div>

              <div>
                <label className="block text-xs font-semibold mb-1" style={{ color: "var(--text-secondary)" }}>Motivo / Justificativa *</label>
                <textarea
                  required
                  rows={3}
                  value={refundDescription}
                  onChange={(e) => setRefundDescription(e.target.value)}
                  placeholder="Ex: Devolução de Pix pago em duplicidade..."
                  className="w-full px-3.5 py-2.5 rounded-xl text-xs outline-none border focus:border-emerald-500"
                  style={{ backgroundColor: "var(--bg-card)", borderColor: "var(--surface-border)", color: "var(--text-primary)" }}
                />
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button type="button" onClick={() => setIsRefundModalOpen(false)} className="px-4 py-2 rounded-xl text-xs text-slate-400 hover:text-white">Cancelar</button>
                <button type="submit" disabled={isSubmittingRefund} className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs">
                  {isSubmittingRefund ? "Salvando..." : "Confirmar Reembolso"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL AJUSTAR SALDO (MASTER) */}
      {isAdjustModalOpen && isMaster && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in">
          <div className="w-full max-w-md rounded-2xl border p-6 shadow-2xl relative" style={{ backgroundColor: "var(--bg-secondary)", borderColor: "var(--surface-border)" }}>
            <div className="flex items-center justify-between pb-3 mb-4 border-b" style={{ borderColor: "var(--surface-border)" }}>
              <div className="flex items-center gap-2">
                <div className="p-2 rounded-lg bg-purple-500/10 text-purple-400">
                  <SlidersHorizontal size={18} />
                </div>
                <h3 className="text-sm font-bold" style={{ color: "var(--text-primary)" }}>Ajuste Manual de Saldo (Master)</h3>
              </div>
              <button onClick={() => setIsAdjustModalOpen(false)} className="text-slate-400 hover:text-white">✕</button>
            </div>

            <form onSubmit={handleSubmitAdjust} className="space-y-4">
              {adjustError && (
                <div className="p-3 rounded-lg bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs">
                  {adjustError}
                </div>
              )}

              <div>
                <label className="block text-xs font-semibold mb-1" style={{ color: "var(--text-secondary)" }}>Novo Saldo Real no Nubank (R$) *</label>
                <input
                  type="text"
                  required
                  value={adjustTargetBalance}
                  onChange={(e) => handleAmountInput(e.target.value, setAdjustTargetBalance)}
                  placeholder={formatBRL(currentBalance)}
                  className="w-full px-3.5 py-2.5 rounded-xl text-sm font-bold outline-none border focus:border-purple-500"
                  style={{ backgroundColor: "var(--bg-card)", borderColor: "var(--surface-border)", color: "var(--text-primary)" }}
                />
              </div>

              <div>
                <label className="block text-xs font-semibold mb-1" style={{ color: "var(--text-secondary)" }}>Justificativa Obrigatória *</label>
                <textarea
                  required
                  rows={3}
                  value={adjustReason}
                  onChange={(e) => setAdjustReason(e.target.value)}
                  placeholder="Ex: Conciliação bancária conforme extrato oficial do aplicativo Nubank..."
                  className="w-full px-3.5 py-2.5 rounded-xl text-xs outline-none border focus:border-purple-500"
                  style={{ backgroundColor: "var(--bg-card)", borderColor: "var(--surface-border)", color: "var(--text-primary)" }}
                />
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button type="button" onClick={() => setIsAdjustModalOpen(false)} className="px-4 py-2 rounded-xl text-xs text-slate-400 hover:text-white">Cancelar</button>
                <button type="submit" disabled={isSubmittingAdjust} className="px-4 py-2 rounded-xl bg-purple-600 hover:bg-purple-500 text-white font-bold text-xs">
                  {isSubmittingAdjust ? "Ajustando..." : "Confirmar Ajuste"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
}
