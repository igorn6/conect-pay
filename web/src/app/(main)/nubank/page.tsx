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
  FileCheck2,
  ShieldCheck,
  Building2,
  QrCode,
  CreditCard,
} from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/lib/supabase";
import type { NubankSnapshot, NubankMovement } from "@/constants/nubank";
import CountUp from "@/components/ui/CountUp";
import AnimatedCurrency from "@/components/ui/AnimatedCurrency";
import MagnetButton from "@/components/ui/MagnetButton";
import ShinyBadge from "@/components/ui/ShinyBadge";
import NubankStatementValidatorModal from "@/components/nubank/NubankStatementValidatorModal";
import NubankDailyReconciliationHistory from "@/components/nubank/NubankDailyReconciliationHistory";

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
  const [isRechargeModalOpen, setIsRechargeModalOpen] = useState(false);
  const [rechargeForm, setRechargeForm] = useState({
    amount: "1.500,00",
    paymentType: "BOLETO" as "BOLETO" | "PIX",
    barcode: "",
    pixKey: "",
    pixOwner: "Lima e Trindade",
    cnpj: "CNPJ 2",
    notes: "Recarga saldo Nubank",
    requesterName: "",
  });
  const [isSubmittingRecharge, setIsSubmittingRecharge] = useState(false);
  const [rechargeError, setRechargeError] = useState<string | null>(null);

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

  // Validador de Extrato e Conciliação Diária
  const [isValidatorModalOpen, setIsValidatorModalOpen] = useState(false);
  const [activeSection, setActiveSection] = useState<"MOVEMENTS" | "RECONCILIATION">("MOVEMENTS");
  const [reconcileRefreshTrigger, setReconcileRefreshTrigger] = useState(0);

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
    if (!val || !val.trim()) return NaN;
    const clean = val.trim().replace(/^R\$\s*/i, "").trim();
    if (clean.includes(",") && clean.includes(".")) {
      return parseFloat(clean.replace(/\./g, "").replace(",", "."));
    }
    if (clean.includes(",")) {
      return parseFloat(clean.replace(/\s/g, "").replace(",", "."));
    }
    return parseFloat(clean.replace(/\s/g, ""));
  };

  // Ação: Abrir Modal de Edição da Recarga Nubank
  const handleOpenRechargeModal = () => {
    setRechargeError(null);
    setRechargeForm({
      amount: "1.500,00",
      paymentType: "BOLETO",
      barcode: "",
      pixKey: "",
      pixOwner: "Lima e Trindade",
      cnpj: "CNPJ 2",
      notes: "Recarga saldo Nubank",
      requesterName: userName || "Igor Nascimento",
    });
    setIsRechargeModalOpen(true);
  };

  // Submeter Recarga Nubank (cria card no Kanban com dados editados e gera e-mail)
  const handleSubmitRecharge = async (e: React.FormEvent) => {
    e.preventDefault();
    setRechargeError(null);
    const amountNum = parseCurrencyInput(rechargeForm.amount);
    if (!Number.isFinite(amountNum) || amountNum <= 0) {
      setRechargeError("Informe um valor válido maior que zero.");
      return;
    }

    try {
      setIsSubmittingRecharge(true);
      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData?.session?.access_token;
      const headers: Record<string, string> = { "Content-Type": "application/json" };
      if (token) headers["Authorization"] = `Bearer ${token}`;
      if (userId) headers["x-user-id"] = userId;

      const res = await fetch("/api/nubank-balance/request-recharge", {
        method: "POST",
        headers,
        body: JSON.stringify({
          amount: amountNum,
          payment_type: rechargeForm.paymentType,
          boleto_barcode: rechargeForm.paymentType === "BOLETO" ? rechargeForm.barcode.trim() : null,
          pix_key: rechargeForm.paymentType === "PIX" ? rechargeForm.pixKey.trim() : "",
          pix_owner: rechargeForm.pixOwner.trim(),
          cnpj: rechargeForm.cnpj.trim(),
          notes: rechargeForm.notes.trim(),
          userId,
          requesterName: rechargeForm.requesterName.trim() || userName || "Igor Nascimento",
        }),
      });

      if (!res.ok) {
        const errJson = await res.json();
        throw new Error(errJson.error || "Falha ao solicitar recarga.");
      }

      const data = await res.json();
      setIsRechargeModalOpen(false);
      setRechargeSuccessData(data);
      fetchBalance(true);
      if (typeof window !== "undefined") {
        window.dispatchEvent(new Event("nubank-balance-updated"));
      }
    } catch (err: any) {
      setRechargeError(err.message || "Erro inesperado.");
    } finally {
      setIsSubmittingRecharge(false);
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
      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData?.session?.access_token;
      const headers: Record<string, string> = { "Content-Type": "application/json" };
      if (token) headers["Authorization"] = `Bearer ${token}`;
      if (userId) headers["x-user-id"] = userId;

      const res = await fetch("/api/nubank-balance/refund", {
        method: "POST",
        headers,
        body: JSON.stringify({
          amount: amountNum,
          description: refundDescription.trim(),
          reason: refundDescription.trim(),
          userId,
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
      if (typeof window !== "undefined") {
        window.dispatchEvent(new Event("nubank-balance-updated"));
      }
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
    if (!Number.isFinite(targetBalanceNum) || targetBalanceNum < 0) {
      setAdjustError("Informe um saldo válido.");
      return;
    }
    if (!adjustReason.trim()) {
      setAdjustError("O motivo do ajuste é obrigatório.");
      return;
    }

    try {
      setIsSubmittingAdjust(true);
      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData?.session?.access_token;
      const headers: Record<string, string> = { "Content-Type": "application/json" };
      if (token) headers["Authorization"] = `Bearer ${token}`;
      if (userId) headers["x-user-id"] = userId;

      const res = await fetch("/api/nubank-balance/adjust", {
        method: "POST",
        headers,
        body: JSON.stringify({
          newBalance: targetBalanceNum,
          targetBalance: targetBalanceNum,
          description: adjustReason.trim(),
          reason: adjustReason.trim(),
          userId,
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
      if (typeof window !== "undefined") {
        window.dispatchEvent(new Event("nubank-balance-updated"));
      }
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
  const { totalEntradas, totalSaidas, totalReembolsos } = useMemo(() => {
    let ent = 0;
    let sai = 0;
    let reemb = 0;
    if (snapshot?.movements) {
      for (const m of snapshot.movements) {
        if (m.type === "REEMBOLSO") {
          reemb += Math.abs(m.amount);
        } else if (m.type === "ENTRADA" || m.amount > 0) {
          ent += m.amount;
        } else if (m.type === "SAIDA" || m.amount < 0) {
          sai += Math.abs(m.amount);
        }
      }
    }
    return { totalEntradas: ent, totalSaidas: sai, totalReembolsos: reemb };
  }, [snapshot?.movements]);

  const currentBalance = snapshot?.balance ?? 609.74;
  const isBalanceCritical = currentBalance <= 350;

  if (!isMaster && !isFinanceiro) return null;

  return (
    <div className="flex-1 flex flex-col h-full w-full min-h-0 overflow-y-auto p-4 md:p-6 custom-scrollbar bg-transparent" style={{ color: "var(--text-primary)" }}>
      <div className="max-w-[1360px] mx-auto space-y-6">
        
        {/* Top Header */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 pb-4 border-b border-white/[0.08]">
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-2xl font-bold tracking-tight text-white">Nubank / Caju</h1>
              <ShinyBadge variant="purple" size="sm">
                Nubank 02 • Ativo
              </ShinyBadge>
              <span className="text-[10px] font-mono uppercase tracking-wider px-2 py-0.5 rounded-full bg-slate-900/60 text-slate-400 border border-white/10">
                Caju • Em breve
              </span>
            </div>
            <p className="text-xs text-slate-400 mt-1 font-mono">
              Liquidação em tempo real, extrato bancário corporativo e recargas centralizadas.
            </p>
          </div>

          <div className="flex items-center gap-2.5 flex-wrap">
            <button
              onClick={() => fetchBalance(false)}
              disabled={refreshing}
              className="p-2.5 rounded-xl border border-white/10 bg-slate-900/60 hover:bg-slate-800 text-slate-400 hover:text-white transition-all cursor-pointer backdrop-blur-md"
              title="Atualizar saldo e extrato"
            >
              <RefreshCw size={14} className={refreshing ? "animate-spin text-[#c084fc]" : ""} />
            </button>

            {isMaster && (
              <button
                onClick={() => {
                  setAdjustError(null);
                  setAdjustTargetBalance("");
                  setAdjustReason("");
                  setIsAdjustModalOpen(true);
                }}
                className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl border border-white/10 bg-slate-900/60 hover:bg-slate-800 text-xs font-semibold text-slate-300 hover:text-white transition-all cursor-pointer backdrop-blur-md"
              >
                <SlidersHorizontal size={13} />
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
              className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl border border-white/10 bg-slate-900/60 hover:bg-slate-800 text-xs font-semibold text-slate-300 hover:text-white transition-all cursor-pointer backdrop-blur-md"
            >
              <Plus size={13} />
              <span>Registrar Reembolso</span>
            </button>

            <button
              onClick={() => setIsValidatorModalOpen(true)}
              className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl border border-purple-500/30 bg-purple-950/40 hover:bg-purple-900/50 text-xs font-semibold text-purple-200 hover:text-white transition-all cursor-pointer backdrop-blur-md shadow-[0_0_15px_rgba(168,85,247,0.15)]"
              title="Importar e validar extrato Nubank (7 dias)"
            >
              <FileCheck2 size={13} className="text-purple-400" />
              <span>Validar Extrato</span>
            </button>

            <MagnetButton
              onClick={handleOpenRechargeModal}
              className="flex items-center gap-2 px-4 py-2 rounded-xl bg-gradient-to-r from-emerald-500 via-emerald-600 to-teal-700 hover:from-emerald-400 hover:to-teal-600 text-white font-bold text-xs uppercase tracking-wider shadow-[0_0_20px_rgba(16,185,129,0.35)] transition-all cursor-pointer active:scale-95"
            >
              <Sparkles size={14} className="text-white" />
              <span>Recarga (R$ 1.500)</span>
            </MagnetButton>
          </div>
        </div>

        {/* ALERTA CRÍTICO: Saldo <= R$ 350 */}
        {isBalanceCritical && !loading && (
          <div className="p-4 sm:p-5 rounded-2xl bg-amber-500/10 border border-amber-500/40 backdrop-blur-xl shadow-[0_0_30px_rgba(245,158,11,0.2)] flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 animate-in fade-in">
            <div className="flex items-start gap-3.5">
              <div className="p-2.5 rounded-xl bg-amber-500/20 text-amber-400 shrink-0 mt-0.5 border border-amber-500/30">
                <AlertTriangle size={20} className="animate-pulse" />
              </div>
              <div>
                <h3 className="text-xs font-bold text-amber-400 uppercase tracking-wider">
                  Atenção: Saldo Nubank Atingiu o Limite Crítico ({formatBRL(currentBalance)})
                </h3>
                <p className="text-xs text-amber-200/90 leading-relaxed mt-0.5">
                  O saldo está em R$ 350,00 ou menos. Solicite a recarga de R$ 1.500,00 para garantir liquidações contínuas no Kanban.
                </p>
              </div>
            </div>

            <MagnetButton
              onClick={handleOpenRechargeModal}
              className="w-full sm:w-auto px-5 py-2.5 rounded-xl bg-amber-400 hover:bg-amber-300 text-slate-950 font-bold text-xs uppercase tracking-wider shadow-md shadow-amber-950/30 transition-all cursor-pointer shrink-0 flex items-center justify-center gap-1.5"
            >
              <Sparkles size={14} />
              <span>Solicitar Recarga Imediata</span>
            </MagnetButton>
          </div>
        )}

        {/* Card Principal Corporativo Nubank (Design unificado conforme Dashboard) */}
        <div className="rounded-2xl bg-gradient-to-r from-slate-900 via-[#1a1329] to-slate-900 border border-[#820AD1]/30 p-5 md:p-6 shadow-xl relative overflow-hidden animate-in fade-in slide-in-from-bottom-1 duration-200">
          {/* Glow de fundo Nubank roxo sutil */}
          <div className="absolute top-0 right-0 -mr-16 -mt-16 w-64 h-64 bg-[#820AD1]/15 rounded-full blur-3xl pointer-events-none" />
          <div className="absolute bottom-0 left-1/3 -mb-16 w-48 h-48 bg-purple-600/10 rounded-full blur-2xl pointer-events-none" />

          <div className="relative z-10">
            {/* Saldo em Destaque */}
            <div className="flex items-start gap-4">
              <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-[#820AD1] to-[#5a0594] flex items-center justify-center text-white shadow-lg shadow-purple-950/50 shrink-0">
                <Wallet size={26} className="text-white drop-shadow-sm" />
              </div>

              <div>
                <div className="flex items-center gap-2">
                  <span className="text-xs font-bold uppercase tracking-wider text-[#d8b4fe] bg-[#820AD1]/20 px-2.5 py-0.5 rounded-full border border-[#820AD1]/40">
                    Nubank 02 • Saldo Corporativo
                  </span>
                  <span className="text-[11px] text-slate-400 font-medium hidden sm:inline">
                    (Trava anti-duplicidade ativa)
                  </span>
                </div>

                <div className="flex items-baseline gap-3 mt-1.5">
                  {loading ? (
                    <div className="h-9 w-40 bg-slate-800 rounded animate-pulse" />
                  ) : error ? (
                    <div className="flex items-center gap-1.5 text-rose-400 text-sm font-semibold">
                      <AlertCircle size={16} />
                      <span>Erro ao consultar</span>
                    </div>
                  ) : (
                    <AnimatedCurrency
                      value={currentBalance}
                      prefix="R$ "
                      prefixClassName="text-2xl md:text-3xl text-[#d8b4fe]/80 font-normal mr-1"
                      className="text-3xl md:text-4xl font-black text-white tracking-tight"
                    />
                  )}

                  <button
                    onClick={() => fetchBalance(false)}
                    disabled={refreshing}
                    title="Atualizar saldo agora"
                    className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800/80 transition-colors disabled:opacity-50 cursor-pointer"
                  >
                    <RefreshCw size={14} className={refreshing ? "animate-spin text-[#c084fc]" : ""} />
                  </button>
                </div>

                <p className="text-xs text-slate-400 mt-1">
                  Atualização em tempo real sincronizada com o fluxo do Kanban.
                </p>

                {/* Micro Indicadores Financeiros (Reembolsado, Entradas, Saídas) */}
                <div className="flex flex-wrap items-center gap-2.5 mt-3 pt-3 border-t border-slate-800/60 text-xs">
                  <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-amber-500/10 border border-amber-500/20 text-amber-300">
                    <span className="text-[10px] uppercase font-mono font-semibold tracking-wider text-amber-400/80">Reembolsado:</span>
                    <AnimatedCurrency value={totalReembolsos} prefix="R$ " prefixClassName="font-normal opacity-80 mr-0.5" className="font-bold font-mono text-xs text-amber-300" />
                  </div>
                  <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-emerald-400">
                    <span className="text-[10px] uppercase font-mono font-semibold tracking-wider text-emerald-400/80">Entradas:</span>
                    <AnimatedCurrency value={totalEntradas} prefix="R$ " prefixClassName="font-normal opacity-80 mr-0.5" className="font-bold font-mono text-xs text-emerald-400" />
                  </div>
                  <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-rose-500/10 border border-rose-500/20 text-rose-400">
                    <span className="text-[10px] uppercase font-mono font-semibold tracking-wider text-rose-400/80">Saídas:</span>
                    <AnimatedCurrency value={totalSaidas} prefix="R$ " prefixClassName="font-normal opacity-80 mr-0.5" className="font-bold font-mono text-xs text-rose-400" />
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Mini-Lista de Movimentações Recentes (Últimas 5) */}
          <div className="mt-6 pt-5 border-t border-slate-800/80">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <span className="text-xs font-bold uppercase tracking-wider text-slate-400">
                  Últimas Movimentações Nubank
                </span>
                <span className="text-[10px] text-slate-500 font-semibold bg-slate-800 px-2 py-0.5 rounded-full">
                  {snapshot?.movements?.length || 0} de 5
                </span>
              </div>
              {snapshot?.updatedAt && (
                <span className="text-[11px] text-slate-500">
                  Última sincronização: {new Date(snapshot.updatedAt).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}
                </span>
              )}
            </div>

            {loading ? (
              <div className="space-y-2">
                {[1, 2, 3].map((i) => (
                  <div key={i} className="h-10 bg-slate-800/40 rounded-xl animate-pulse" />
                ))}
              </div>
            ) : !snapshot?.movements || snapshot.movements.length === 0 ? (
              <div className="p-4 rounded-xl bg-slate-950/40 border border-slate-800/60 text-center text-xs text-slate-400">
                Nenhuma movimentação registrada no histórico recente.
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-2.5">
                {snapshot.movements.slice(0, 5).map((mov: NubankMovement) => {
                  const isPositive = mov.amount > 0;
                  const isRefund = mov.type === "REEMBOLSO";
                  const isRecharge = mov.type === "ENTRADA";
                  const isAdjustment = mov.type === "AJUSTE";

                  return (
                    <div
                      key={mov.id}
                      className="p-3 rounded-xl bg-slate-950/50 border border-slate-800/80 hover:border-purple-500/40 hover:-translate-y-0.5 hover:shadow-lg transition-all duration-200 ease-out flex flex-col justify-between gap-2 text-xs group"
                    >
                      <div className="flex items-start justify-between gap-1.5">
                        <div className="flex items-center gap-1.5 min-w-0">
                          <div
                            className={`w-6 h-6 rounded-lg flex items-center justify-center shrink-0 ${
                              isPositive
                                ? "bg-emerald-500/20 text-emerald-400"
                                : "bg-rose-500/20 text-rose-400"
                            }`}
                          >
                            {isPositive ? <ArrowDownLeft size={13} /> : <ArrowUpRight size={13} />}
                          </div>
                          <AnimatedCurrency
                            value={Math.abs(mov.amount)}
                            prefix={isPositive ? "+R$ " : "-R$ "}
                            prefixClassName="font-normal opacity-90 mr-0.5"
                            className={`font-black text-xs ${
                              isPositive ? "text-emerald-400" : "text-rose-400"
                            }`}
                          />
                        </div>

                        <span className="text-[10px] text-slate-500 shrink-0">
                          {new Date(mov.created_at).toLocaleDateString("pt-BR", {
                            day: "2-digit",
                            month: "2-digit",
                          })}
                        </span>
                      </div>

                      <p className="text-[11px] text-slate-300 font-medium truncate" title={mov.description || undefined}>
                        {mov.description}
                      </p>

                      <div className="flex items-center justify-between text-[10px] text-slate-500 pt-1 border-t border-slate-800/60">
                        <span className="uppercase tracking-wider font-semibold">
                          {isRefund
                            ? "Reembolso"
                            : isRecharge
                            ? "Recarga"
                            : isAdjustment
                            ? "Ajuste"
                            : "Saída"}
                        </span>
                        <span>Após: {formatBRL(mov.balance_after)}</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* Seletor de visualização: Extrato vs Auditoria e Fechamentos */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 pt-2">
          <div className="inline-flex p-1 rounded-2xl border border-white/10 bg-slate-900/70 backdrop-blur-xl">
            <button
              onClick={() => setActiveSection("MOVEMENTS")}
              className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                activeSection === "MOVEMENTS"
                  ? "bg-gradient-to-r from-[#820AD1] to-purple-600 text-white shadow-lg shadow-purple-950/40"
                  : "text-slate-400 hover:text-slate-200"
              }`}
            >
              <FileText size={14} />
              <span>Extrato de Movimentações ({filteredMovements.length})</span>
            </button>
            <button
              onClick={() => setActiveSection("RECONCILIATION")}
              className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                activeSection === "RECONCILIATION"
                  ? "bg-gradient-to-r from-purple-600 to-indigo-600 text-white shadow-lg shadow-purple-950/40"
                  : "text-slate-400 hover:text-slate-200"
              }`}
            >
              <ShieldCheck size={14} />
              <span>Fechamentos Diários & Conciliação</span>
            </button>
          </div>

          <button
            onClick={() => setIsValidatorModalOpen(true)}
            className="flex items-center gap-2 px-3.5 py-2 rounded-xl border border-purple-500/30 bg-purple-950/40 hover:bg-purple-900/60 text-xs font-bold text-purple-200 hover:text-white transition-all cursor-pointer backdrop-blur-md shadow-[0_0_15px_rgba(168,85,247,0.15)]"
          >
            <FileCheck2 size={14} className="text-purple-400" />
            <span>Validar Extrato Nubank (CSV / PDF)</span>
          </button>
        </div>

        {activeSection === "MOVEMENTS" ? (
          /* Extrato Bancário Completo */
          <div 
            className="rounded-2xl border border-white/[0.08] shadow-2xl overflow-hidden bg-slate-950/60 backdrop-blur-xl"
          >
            {/* Header do Extrato com Filtros */}
            <div className="p-4 sm:p-5 border-b border-white/[0.08] bg-white/[0.02] flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
              <div>
                <h2 className="text-base font-bold tracking-tight text-white flex items-center gap-2">
                  <span>Extrato de Movimentações Nubank</span>
                </h2>
                <p className="text-xs mt-0.5 text-slate-400 font-mono">
                  Registro contínuo e auditável de cada débito e crédito realizado.
                </p>
              </div>

              {/* Controles de Filtro e Busca */}
              <div className="flex items-center gap-2.5 flex-wrap w-full md:w-auto">
                <div className="relative flex-1 md:w-56">
                  <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Buscar no extrato..."
                    className="w-full pl-8 pr-3 py-1.5 rounded-xl text-xs outline-none border border-white/10 bg-slate-900/80 text-white placeholder-slate-500 focus:border-white/20 transition-all font-mono"
                  />
                </div>

                <div className="flex items-center gap-1 p-1 rounded-xl border border-white/10 bg-slate-900/80 backdrop-blur-md">
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
                      className={`px-2.5 py-1 rounded-lg text-[10px] font-mono font-semibold transition-all cursor-pointer ${
                        movementFilter === tab.id
                          ? "bg-white/10 text-white shadow-xs"
                          : "text-slate-400 hover:text-slate-200"
                      }`}
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
                  <tr className="border-b border-white/[0.08] text-[10px] uppercase tracking-wider font-mono font-bold bg-white/[0.03] text-slate-400">
                    <th className="px-5 py-3.5">Data / Hora</th>
                    <th className="px-4 py-3.5">Tipo</th>
                    <th className="px-4 py-3.5">Descrição / Motivo</th>
                    <th className="px-4 py-3.5 text-right">Valor</th>
                    <th className="px-5 py-3.5 text-right">Saldo Resultante</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/[0.06]">
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
        ) : (
          <NubankDailyReconciliationHistory
            userId={userId}
            refreshTrigger={reconcileRefreshTrigger}
            onOpenValidator={() => setIsValidatorModalOpen(true)}
          />
        )}

      </div>

      {/* ========================================================
          MODAL DE CONFIGURAÇÃO / EDIÇÃO DE RECARGA (PRÉ-ENVIO)
          ======================================================== */}
      {isRechargeModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-md animate-in fade-in">
          <div 
            className="w-full max-w-2xl rounded-2xl border p-6 shadow-2xl relative max-h-[90vh] overflow-y-auto custom-scrollbar"
            style={{ backgroundColor: "var(--bg-secondary)", borderColor: "var(--surface-border)" }}
          >
            {/* Header */}
            <div className="flex items-center justify-between pb-3 mb-4 border-b" style={{ borderColor: "var(--surface-border)" }}>
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-emerald-500/20 text-emerald-400 flex items-center justify-center shrink-0">
                  <Sparkles size={20} />
                </div>
                <div>
                  <h3 className="text-base font-bold" style={{ color: "var(--text-primary)" }}>
                    Solicitar Recarga de Saldo Nubank
                  </h3>
                  <p className="text-xs mt-0.5" style={{ color: "var(--text-secondary)" }}>
                    Edite as informações antes de lançar o card no Kanban e gerar o e-mail para Tássio.
                  </p>
                </div>
              </div>
              <button 
                onClick={() => setIsRechargeModalOpen(false)} 
                className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-white/10 transition-colors cursor-pointer"
              >
                ✕
              </button>
            </div>

            {rechargeError && (
              <div className="p-3 mb-4 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs flex items-center gap-2">
                <AlertCircle size={14} className="shrink-0" />
                <span>{rechargeError}</span>
              </div>
            )}

            <form onSubmit={handleSubmitRecharge} className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                
                {/* Motivo */}
                <div>
                  <label className="block text-xs font-semibold mb-1" style={{ color: "var(--text-secondary)" }}>
                    Motivo da Solicitação *
                  </label>
                  <input
                    type="text"
                    required
                    value={rechargeForm.notes}
                    onChange={(e) => setRechargeForm((prev) => ({ ...prev, notes: e.target.value }))}
                    placeholder="Recarga saldo Nubank"
                    className="w-full px-3.5 py-2.5 rounded-xl text-xs outline-none border focus:border-emerald-500 font-medium"
                    style={{ backgroundColor: "var(--bg-card)", borderColor: "var(--surface-border)", color: "var(--text-primary)" }}
                  />
                </div>

                {/* Valor */}
                <div>
                  <label className="block text-xs font-semibold mb-1" style={{ color: "var(--text-secondary)" }}>
                    Valor da Recarga (R$) *
                  </label>
                  <input
                    type="text"
                    required
                    value={rechargeForm.amount}
                    onChange={(e) => handleAmountInput(e.target.value, (val) => setRechargeForm((prev) => ({ ...prev, amount: val })))}
                    placeholder="1.500,00"
                    className="w-full px-3.5 py-2.5 rounded-xl text-xs outline-none border focus:border-emerald-500 font-bold font-mono"
                    style={{ backgroundColor: "var(--bg-card)", borderColor: "var(--surface-border)", color: "var(--text-primary)" }}
                  />
                </div>

                {/* Titular */}
                <div>
                  <label className="block text-xs font-semibold mb-1" style={{ color: "var(--text-secondary)" }}>
                    Titular / Favorecido *
                  </label>
                  <input
                    type="text"
                    required
                    value={rechargeForm.pixOwner}
                    onChange={(e) => setRechargeForm((prev) => ({ ...prev, pixOwner: e.target.value }))}
                    placeholder="Lima e Trindade"
                    className="w-full px-3.5 py-2.5 rounded-xl text-xs outline-none border focus:border-emerald-500 font-medium"
                    style={{ backgroundColor: "var(--bg-card)", borderColor: "var(--surface-border)", color: "var(--text-primary)" }}
                  />
                </div>

                {/* Conta Pagadora / CNPJ */}
                <div>
                  <label className="block text-xs font-semibold mb-1" style={{ color: "var(--text-secondary)" }}>
                    Conta Pagadora / CNPJ *
                  </label>
                  <select
                    value={rechargeForm.cnpj}
                    onChange={(e) => setRechargeForm((prev) => ({ ...prev, cnpj: e.target.value }))}
                    className="w-full px-3.5 py-2.5 rounded-xl text-xs outline-none border focus:border-emerald-500 font-medium cursor-pointer"
                    style={{ backgroundColor: "var(--bg-card)", borderColor: "var(--surface-border)", color: "var(--text-primary)" }}
                  >
                    <option value="CNPJ 2" style={{ backgroundColor: "var(--bg-secondary)" }}>CNPJ 2 (Padrão)</option>
                    <option value="CNPJ 1" style={{ backgroundColor: "var(--bg-secondary)" }}>CNPJ 1</option>
                    <option value="Conect Solucoes" style={{ backgroundColor: "var(--bg-secondary)" }}>Conect Soluções</option>
                  </select>
                </div>

                {/* Solicitante */}
                <div className="md:col-span-2">
                  <label className="block text-xs font-semibold mb-1" style={{ color: "var(--text-secondary)" }}>
                    Solicitante (Identificação no Kanban e E-mail) *
                  </label>
                  <input
                    type="text"
                    required
                    value={rechargeForm.requesterName}
                    onChange={(e) => setRechargeForm((prev) => ({ ...prev, requesterName: e.target.value }))}
                    placeholder={userName || "Igor Nascimento"}
                    className="w-full px-3.5 py-2.5 rounded-xl text-xs outline-none border focus:border-emerald-500 font-medium"
                    style={{ backgroundColor: "var(--bg-card)", borderColor: "var(--surface-border)", color: "var(--text-primary)" }}
                  />
                  <span className="text-[10px] text-slate-400 mt-1 block">
                    Seu nome será registrado como autor do card no Kanban e no texto enviado a Tássio.
                  </span>
                </div>

                {/* Forma de Pagamento */}
                <div className="md:col-span-2">
                  <label className="block text-xs font-semibold mb-1.5" style={{ color: "var(--text-secondary)" }}>
                    Forma de Pagamento da Recarga
                  </label>
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={() => setRechargeForm((prev) => ({ ...prev, paymentType: "BOLETO" }))}
                      className={`flex items-center justify-center gap-2 py-2.5 px-3 rounded-xl border text-xs font-bold transition-all cursor-pointer ${
                        rechargeForm.paymentType === "BOLETO"
                          ? "bg-emerald-500/20 border-emerald-500/50 text-emerald-300 shadow-[0_0_15px_rgba(16,185,129,0.15)]"
                          : "border-white/10 text-slate-400 hover:text-white hover:bg-white/5"
                      }`}
                    >
                      <FileText size={15} />
                      <span>Boleto Bancário (Linha Digitável)</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => setRechargeForm((prev) => ({ ...prev, paymentType: "PIX" }))}
                      className={`flex items-center justify-center gap-2 py-2.5 px-3 rounded-xl border text-xs font-bold transition-all cursor-pointer ${
                        rechargeForm.paymentType === "PIX"
                          ? "bg-emerald-500/20 border-emerald-500/50 text-emerald-300 shadow-[0_0_15px_rgba(16,185,129,0.15)]"
                          : "border-white/10 text-slate-400 hover:text-white hover:bg-white/5"
                      }`}
                    >
                      <QrCode size={15} />
                      <span>Chave Pix</span>
                    </button>
                  </div>
                </div>

                {/* Campo Dinâmico: Linha digitável ou Chave Pix */}
                <div className="md:col-span-2">
                  {rechargeForm.paymentType === "BOLETO" ? (
                    <div>
                      <label className="block text-xs font-semibold mb-1" style={{ color: "var(--text-secondary)" }}>
                        Linha Digitável / Código de Barras do Boleto
                      </label>
                      <textarea
                        rows={2}
                        value={rechargeForm.barcode}
                        onChange={(e) => setRechargeForm((prev) => ({ ...prev, barcode: e.target.value }))}
                        placeholder="Cole aqui a linha digitável do boleto de recarga Nubank..."
                        className="w-full px-3.5 py-2.5 rounded-xl text-xs font-mono outline-none border focus:border-emerald-500"
                        style={{ backgroundColor: "var(--bg-card)", borderColor: "var(--surface-border)", color: "var(--text-primary)" }}
                      />
                    </div>
                  ) : (
                    <div>
                      <label className="block text-xs font-semibold mb-1" style={{ color: "var(--text-secondary)" }}>
                        Chave Pix de Recarga
                      </label>
                      <input
                        type="text"
                        value={rechargeForm.pixKey}
                        onChange={(e) => setRechargeForm((prev) => ({ ...prev, pixKey: e.target.value }))}
                        placeholder="Informe a chave Pix (CNPJ, e-mail, telefone ou chave aleatória)..."
                        className="w-full px-3.5 py-2.5 rounded-xl text-xs font-mono outline-none border focus:border-emerald-500"
                        style={{ backgroundColor: "var(--bg-card)", borderColor: "var(--surface-border)", color: "var(--text-primary)" }}
                      />
                    </div>
                  )}
                </div>

              </div>

              {/* Prévia ao vivo do E-mail Padronizado */}
              <div className="pt-2">
                <div className="flex items-center gap-1.5 mb-1.5">
                  <Mail size={13} className="text-emerald-400" />
                  <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
                    Prévia do E-mail Padronizado para Tássio:
                  </span>
                </div>
                <div 
                  className="p-3.5 rounded-xl border font-mono text-xs whitespace-pre-wrap leading-relaxed select-text"
                  style={{ backgroundColor: "var(--bg-primary)", borderColor: "var(--surface-border)", color: "var(--text-primary)" }}
                >
                  {`--\n${new Date().getHours() < 12 ? "Bom dia" : "Boa tarde"}, Tassio!\n\nSolicito por meio deste o pagamento:\n\nMotivo: ${rechargeForm.notes.trim() || "Recarga saldo Nubank"}\nValor: R$ ${rechargeForm.amount || "1.500,00"}\nChave pix / Linha digitável: ${
                    rechargeForm.paymentType === "BOLETO"
                      ? (rechargeForm.barcode.trim() || "(informe a linha digitável acima)")
                      : (rechargeForm.pixKey.trim() || "(informe a chave pix acima)")
                  }\nTitular: ${rechargeForm.pixOwner.trim() || "Lima e Trindade"}\nSolicitante: ${rechargeForm.requesterName.trim() || userName || "Igor Nascimento"}`}
                </div>
              </div>

              {/* Botões de Ação do Modal */}
              <div className="flex items-center justify-end gap-3 pt-3 border-t" style={{ borderColor: "var(--surface-border)" }}>
                <button
                  type="button"
                  onClick={() => setIsRechargeModalOpen(false)}
                  disabled={isSubmittingRecharge}
                  className="px-4 py-2.5 rounded-xl text-xs font-semibold text-slate-400 hover:text-white hover:bg-white/5 transition-colors cursor-pointer"
                >
                  Cancelar
                </button>

                <button
                  type="submit"
                  disabled={isSubmittingRecharge}
                  className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-gradient-to-r from-emerald-500 via-emerald-600 to-teal-700 hover:from-emerald-400 hover:to-teal-600 text-slate-950 font-bold text-xs uppercase tracking-wider shadow-[0_0_20px_rgba(16,185,129,0.35)] transition-all cursor-pointer active:scale-95 disabled:opacity-50"
                >
                  <Sparkles size={14} className="text-slate-950" />
                  <span>{isSubmittingRecharge ? "Lançando no Kanban..." : "Lançar no Kanban"}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

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
                  O card de {formatBRL(rechargeSuccessData.card?.amount || 1500)} foi inserido no Kanban. Envie o e-mail padronizado para Tássio:
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

      {/* MODAL DE VALIDAÇÃO DE EXTRATO NUBANK */}
      <NubankStatementValidatorModal
        isOpen={isValidatorModalOpen}
        onClose={() => setIsValidatorModalOpen(false)}
        userId={userId}
        onReconciliationSaved={() => {
          fetchBalance(true);
          setReconcileRefreshTrigger((prev) => prev + 1);
        }}
      />

    </div>
  );
}
