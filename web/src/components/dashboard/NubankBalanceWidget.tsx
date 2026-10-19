"use client";

import { useEffect, useState, useCallback } from "react";
import {
  Wallet,
  ArrowUpRight,
  ArrowDownLeft,
  RotateCcw,
  SlidersHorizontal,
  RefreshCw,
  Plus,
  Loader2,
  AlertCircle,
  X,
  CheckCircle2,
  Shield,
  HelpCircle
} from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/lib/supabase";
import type { NubankSnapshot, NubankMovement } from "@/constants/nubank";

export default function NubankBalanceWidget() {
  const { userRole, userName, userId } = useAuth();
  const isMaster = userRole === "MASTER";
  const isFinanceiro = userRole === "FINANCEIRO";

  // Só exibe para Master ou Financeiro
  if (!isMaster && !isFinanceiro) {
    return null;
  }

  const [snapshot, setSnapshot] = useState<NubankSnapshot | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Modais
  const [isRefundModalOpen, setIsRefundModalOpen] = useState(false);
  const [isAdjustModalOpen, setIsAdjustModalOpen] = useState(false);

  // Form states - Reembolso
  const [refundAmount, setRefundAmount] = useState("");
  const [refundDescription, setRefundDescription] = useState("");
  const [isSubmittingRefund, setIsSubmittingRefund] = useState(false);
  const [refundError, setRefundError] = useState<string | null>(null);

  // Form states - Ajuste (Master)
  const [adjustTargetBalance, setAdjustTargetBalance] = useState("");
  const [adjustReason, setAdjustReason] = useState("");
  const [isSubmittingAdjust, setIsSubmittingAdjust] = useState(false);
  const [adjustError, setAdjustError] = useState<string | null>(null);

  const fetchBalance = useCallback(async (isSilent = false) => {
    try {
      if (!isSilent) setRefreshing(true);
      setError(null);

      const res = await fetch("/api/nubank-balance", { cache: "no-store" });
      if (!res.ok) {
        throw new Error("Falha ao consultar saldo Nubank");
      }
      const data: NubankSnapshot = await res.json();
      setSnapshot(data);
    } catch (err: any) {
      console.error("Erro ao carregar saldo Nubank:", err);
      setError(err.message || "Erro de conexão");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    fetchBalance(false);

    // Ouve notificações de atualização de saldo disparadas pelas ações do sistema
    const handleUpdateEvent = () => {
      fetchBalance(true);
    };

    window.addEventListener("nubank-balance-updated", handleUpdateEvent);
    return () => {
      window.removeEventListener("nubank-balance-updated", handleUpdateEvent);
    };
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

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Erro ao registrar reembolso.");
      }

      // Sucesso
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

  // Submeter Ajuste Manual (Master)
  const handleSubmitAdjust = async (e: React.FormEvent) => {
    e.preventDefault();
    setAdjustError(null);
    const targetBalanceNum = parseCurrencyInput(adjustTargetBalance);
    if (!Number.isFinite(targetBalanceNum) || targetBalanceNum < 0) {
      setAdjustError("Informe um saldo válido.");
      return;
    }
    if (!adjustReason.trim()) {
      setAdjustError("A justificativa do ajuste é obrigatória.");
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

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Erro ao ajustar saldo.");
      }

      // Sucesso
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

  return (
    <>
      <div className="mb-6 rounded-2xl bg-gradient-to-r from-slate-900 via-[#1a1329] to-slate-900 border border-[#820AD1]/30 p-5 md:p-6 shadow-xl relative overflow-hidden">
        {/* Glow de fundo Nubank roxo sutil */}
        <div className="absolute top-0 right-0 -mr-16 -mt-16 w-64 h-64 bg-[#820AD1]/15 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute bottom-0 left-1/3 -mb-16 w-48 h-48 bg-purple-600/10 rounded-full blur-2xl pointer-events-none" />

        <div className="relative z-10 flex flex-col lg:flex-row items-start lg:items-center justify-between gap-6">
          
          {/* Lado Esquerdo: Saldo em Destaque */}
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
                  <span className="text-3xl md:text-4xl font-black text-white tracking-tight">
                    {formatBRL(snapshot?.balance ?? 609.74)}
                  </span>
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
            </div>
          </div>

          {/* Lado Direito: Ações (Reembolso + Ajuste Master) */}
          <div className="flex flex-wrap items-center gap-2.5 w-full lg:w-auto">
            <button
              onClick={() => {
                setRefundError(null);
                setRefundAmount("");
                setRefundDescription("");
                setIsRefundModalOpen(true);
              }}
              className="flex-1 sm:flex-initial flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white text-xs font-bold shadow-md shadow-emerald-950/40 transition-all cursor-pointer hover:scale-[1.02] active:scale-[0.98]"
            >
              <Plus size={15} />
              <span>Registrar Reembolso</span>
            </button>

            {isMaster && (
              <button
                onClick={() => {
                  setAdjustError(null);
                  setAdjustTargetBalance(
                    snapshot?.balance !== undefined
                      ? snapshot.balance.toFixed(2).replace(".", ",")
                      : ""
                  );
                  setAdjustReason("");
                  setIsAdjustModalOpen(true);
                }}
                className="flex-1 sm:flex-initial flex items-center justify-center gap-2 px-3.5 py-2.5 rounded-xl bg-purple-950/70 hover:bg-purple-900/80 text-purple-200 border border-purple-500/40 text-xs font-bold transition-all cursor-pointer hover:border-purple-400"
                title="Ajuste manual de saldo (Exclusivo Master)"
              >
                <SlidersHorizontal size={14} />
                <span>Ajustar Saldo</span>
              </button>
            )}
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
                    className="p-3 rounded-xl bg-slate-950/50 border border-slate-800/80 hover:border-purple-500/30 transition-all flex flex-col justify-between gap-2 text-xs"
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
                        <span
                          className={`font-black text-xs ${
                            isPositive ? "text-emerald-400" : "text-rose-400"
                          }`}
                        >
                          {isPositive ? "+" : ""}
                          {formatBRL(mov.amount)}
                        </span>
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

      {/* MODAL REGISTRAR REEMBOLSO */}
      {isRefundModalOpen && (
        <div className="fixed inset-0 z-[80] flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm animate-in fade-in duration-150">
          <div
            className="w-full max-w-md rounded-2xl border shadow-2xl overflow-hidden flex flex-col bg-slate-900 border-slate-800 text-slate-100"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between p-5 border-b border-slate-800 bg-slate-900/90">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-emerald-500/20 text-emerald-400 flex items-center justify-center">
                  <RotateCcw size={18} />
                </div>
                <div>
                  <h3 className="text-base font-bold text-white">Registrar Reembolso</h3>
                  <p className="text-xs text-slate-400">Entrada de saldo no Nubank 02</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsRefundModalOpen(false)}
                className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors cursor-pointer"
              >
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleSubmitRefund} className="p-5 space-y-4">
              {refundError && (
                <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs flex items-start gap-2">
                  <AlertCircle size={16} className="shrink-0 mt-0.5 text-rose-400" />
                  <span>{refundError}</span>
                </div>
              )}

              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-300 mb-1.5">
                  Valor a Estornar (R$) *
                </label>
                <input
                  type="text"
                  required
                  placeholder="0,00"
                  value={refundAmount}
                  onChange={(e) => handleAmountInput(e.target.value, setRefundAmount)}
                  className="w-full px-3.5 py-2.5 rounded-xl bg-slate-950 border border-slate-700 text-white font-bold text-lg outline-none focus:border-emerald-500 transition-colors"
                />
              </div>

              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-300 mb-1.5">
                  Motivo / Justificativa *
                </label>
                <textarea
                  required
                  rows={3}
                  placeholder="Ex: Devolução de pagamento duplicado ou cancelamento de pedido"
                  value={refundDescription}
                  onChange={(e) => setRefundDescription(e.target.value)}
                  className="w-full px-3.5 py-2 rounded-xl bg-slate-950 border border-slate-700 text-white text-xs outline-none focus:border-emerald-500 transition-colors custom-scrollbar"
                />
              </div>

              <div className="flex items-center justify-end gap-2.5 pt-2">
                <button
                  type="button"
                  onClick={() => setIsRefundModalOpen(false)}
                  className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-400 hover:text-white hover:bg-slate-800 transition-colors cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={isSubmittingRefund}
                  className="flex items-center gap-2 px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold transition-all disabled:opacity-50 cursor-pointer"
                >
                  {isSubmittingRefund ? (
                    <>
                      <Loader2 size={14} className="animate-spin" />
                      <span>Processando...</span>
                    </>
                  ) : (
                    <>
                      <CheckCircle2 size={14} />
                      <span>Confirmar Reembolso</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL AJUSTAR SALDO (EXCLUSIVO MASTER) */}
      {isAdjustModalOpen && isMaster && (
        <div className="fixed inset-0 z-[80] flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm animate-in fade-in duration-150">
          <div
            className="w-full max-w-md rounded-2xl border shadow-2xl overflow-hidden flex flex-col bg-slate-900 border-purple-500/40 text-slate-100"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between p-5 border-b border-slate-800 bg-slate-900/90">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-purple-500/20 text-[#d8b4fe] flex items-center justify-center">
                  <Shield size={18} />
                </div>
                <div>
                  <h3 className="text-base font-bold text-white">Ajustar Saldo Manual</h3>
                  <p className="text-xs text-purple-300/80">Ação restrita ao perfil Master</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsAdjustModalOpen(false)}
                className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors cursor-pointer"
              >
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleSubmitAdjust} className="p-5 space-y-4">
              {adjustError && (
                <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs flex items-start gap-2">
                  <AlertCircle size={16} className="shrink-0 mt-0.5 text-rose-400" />
                  <span>{adjustError}</span>
                </div>
              )}

              <div className="p-3 rounded-xl bg-purple-500/10 border border-purple-500/20 text-purple-200 text-xs">
                Saldo atual: <span className="font-bold text-white">{formatBRL(snapshot?.balance ?? 0)}</span>.
                Ao definir o novo valor, o sistema calculará o delta necessário para o ajuste e gravará auditoria.
              </div>

              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-300 mb-1.5">
                  Novo Saldo Final (R$) *
                </label>
                <input
                  type="text"
                  required
                  placeholder="0,00"
                  value={adjustTargetBalance}
                  onChange={(e) => handleAmountInput(e.target.value, setAdjustTargetBalance)}
                  className="w-full px-3.5 py-2.5 rounded-xl bg-slate-950 border border-slate-700 text-white font-bold text-lg outline-none focus:border-purple-400 transition-colors"
                />
              </div>

              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-300 mb-1.5">
                  Justificativa do Ajuste *
                </label>
                <textarea
                  required
                  rows={3}
                  placeholder="Ex: Conciliação bancária mensal com extrato oficial do Nubank"
                  value={adjustReason}
                  onChange={(e) => setAdjustReason(e.target.value)}
                  className="w-full px-3.5 py-2 rounded-xl bg-slate-950 border border-slate-700 text-white text-xs outline-none focus:border-purple-400 transition-colors custom-scrollbar"
                />
              </div>

              <div className="flex items-center justify-end gap-2.5 pt-2">
                <button
                  type="button"
                  onClick={() => setIsAdjustModalOpen(false)}
                  className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-400 hover:text-white hover:bg-slate-800 transition-colors cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={isSubmittingAdjust}
                  className="flex items-center gap-2 px-4 py-2 rounded-xl bg-purple-600 hover:bg-purple-500 text-white text-xs font-bold transition-all disabled:opacity-50 cursor-pointer"
                >
                  {isSubmittingAdjust ? (
                    <>
                      <Loader2 size={14} className="animate-spin" />
                      <span>Salvando...</span>
                    </>
                  ) : (
                    <>
                      <CheckCircle2 size={14} />
                      <span>Salvar Novo Saldo</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
