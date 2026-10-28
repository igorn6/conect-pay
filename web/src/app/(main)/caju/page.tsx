"use client";

import { useEffect, useState, useCallback, useMemo } from "react";
import { useRouter } from "next/navigation";
import {
  CreditCard,
  RefreshCw,
  Plus,
  SlidersHorizontal,
  Sparkles,
  FileCheck2,
  Upload,
  Users,
  Building2,
  ShoppingBag,
  ArrowDownLeft,
  Calendar,
  AlertCircle,
  X,
  Check,
  ShieldCheck,
  Wallet,
  Clock,
  Layers,
  ChevronLeft,
  ChevronRight,
  ArrowRight,
  History,
} from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/lib/supabase";
import AnimatedCurrency from "@/components/ui/AnimatedCurrency";
import CajuCollaboratorsTab from "@/components/caju/CajuCollaboratorsTab";
import CajuCsvImportModal from "@/components/caju/CajuCsvImportModal";
import CajuRechargeModal from "@/components/caju/CajuRechargeModal";
import CajuStatementSection from "@/components/caju/CajuStatementSection";
import {
  CAJU_CUTOFF_LABEL,
  round2,
  type CajuSnapshot,
  type CajuCollaborator,
  type CajuTransaction,
  type CajuDailyClosing,
  type CajuMovement,
} from "@/constants/caju";

export default function CajuPage() {
  const router = useRouter();
  const { userRole, userName, userId } = useAuth();
  const isMaster = userRole === "MASTER";
  const isFinanceiro = userRole === "FINANCEIRO";

  // Redireciona gestores para a home (mesma regra do /nubank)
  useEffect(() => {
    if (userRole && !isMaster && !isFinanceiro) {
      router.push("/");
    }
  }, [userRole, isMaster, isFinanceiro, router]);

  // Estados dos Dados do Hub Caju
  const [snapshot, setSnapshot] = useState<CajuSnapshot | null>(null);
  const [collaborators, setCollaborators] = useState<CajuCollaborator[]>([]);
  const [transactions, setTransactions] = useState<CajuTransaction[]>([]);
  const [movements, setMovements] = useState<CajuMovement[]>([]);
  const [dailyClosings, setDailyClosings] = useState<CajuDailyClosing[]>([]);

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Navegação de Abas
  const [activeTab, setActiveTab] = useState<"COLLABORATORS" | "STATEMENT" | "CLOSINGS">("COLLABORATORS");

  // Dia selecionado no Card de Patrimônio Total (Destrinchamento Diário Reverso)
  const [selectedDate, setSelectedDate] = useState<string>("2026-10-27");

  // Modais
  const [isRechargeModalOpen, setIsRechargeModalOpen] = useState(false);
  const [isImportModalOpen, setIsImportModalOpen] = useState(false);
  const [isAdjustModalOpen, setIsAdjustModalOpen] = useState(false);

  // Formulário do Modal de Ajuste / Entrada de Saldo Livre
  const [adjustMode, setAdjustMode] = useState<"DELTA" | "ABSOLUTE">("DELTA");
  const [adjustDelta, setAdjustDelta] = useState("3.000,00");
  const [adjustAbsolute, setAdjustAbsolute] = useState("");
  const [adjustReason, setAdjustReason] = useState("Entrada de recarga manual Caju");
  const [adjustSubmitting, setAdjustSubmitting] = useState(false);
  const [adjustError, setAdjustError] = useState<string | null>(null);

  // Busca de Dados do Hub Caju
  const fetchHub = useCallback(
    async (isSilent = false) => {
      try {
        if (!isSilent) setRefreshing(true);
        setError(null);

        const { data: sessionData } = await supabase.auth.getSession();
        const token = sessionData?.session?.access_token;
        const headers: Record<string, string> = { "Content-Type": "application/json" };
        if (token) headers["Authorization"] = `Bearer ${token}`;
        if (userId) headers["x-user-id"] = userId;

        const url = `/api/caju?limit=5000${userId ? `&userId=${encodeURIComponent(userId)}` : ""}`;
        const res = await fetch(url, { headers, cache: "no-store" });

        if (!res.ok) {
          const errData = await res.json().catch(() => ({}));
          throw new Error(errData.error || "Falha ao consultar dados do Hub Caju.");
        }

        const data = await res.json();
        setSnapshot(data.snapshot || null);
        setCollaborators(data.collaborators || []);
        setTransactions(data.transactions || []);
        setMovements(data.movements || []);
        const closings: CajuDailyClosing[] = data.dailyClosings || [];
        setDailyClosings(closings);
        if (closings.length > 0) {
          setSelectedDate((prev) =>
            closings.some((c) => c.date === prev) ? prev : closings[0].date
          );
        }
      } catch (err: any) {
        console.error("Erro ao carregar Hub Caju:", err);
        setError(err.message || "Erro de conexão ao carregar dados do Caju.");
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [userId]
  );

  useEffect(() => {
    fetchHub(false);

    const handleUpdate = () => fetchHub(true);
    window.addEventListener("caju-balance-updated", handleUpdate);
    window.addEventListener("nubank-balance-updated", handleUpdate);

    return () => {
      window.removeEventListener("caju-balance-updated", handleUpdate);
      window.removeEventListener("nubank-balance-updated", handleUpdate);
    };
  }, [fetchHub]);

  // Cálculos Derivados do Patrimônio Total Atual (Hoje)
  const freeBalance = snapshot?.freeBalance ?? 5845.8;
  const cardsBalance =
    snapshot?.cardsBalance ??
    round2(collaborators.reduce((sum, c) => sum + (c.balance || 0), 0));
  const totalBalance = round2(freeBalance + cardsBalance);
  const monthPurchases = snapshot?.monthPurchases ?? 0;
  const collaboratorsCount = snapshot?.collaboratorsCount ?? collaborators.length;
  const collaboratorsWithBalance =
    snapshot?.collaboratorsWithBalance ?? collaborators.filter((c) => c.balance > 0).length;

  // Fechamento Diário Selecionado para Exibição no Card de Patrimônio Total
  const latestDate = dailyClosings[0]?.date || "2026-10-27";
  const selectedDayIndex = useMemo(() => {
    const idx = dailyClosings.findIndex((c) => c.date === selectedDate);
    return idx >= 0 ? idx : 0;
  }, [dailyClosings, selectedDate]);

  const selectedClosing = dailyClosings[selectedDayIndex] || null;
  const isLatestDay = !selectedClosing || selectedClosing.date === latestDate;

  // Como dailyClosings é ordenado DESC (do mais recente 27/10 para 01/09):
  // - Dia anterior cronológico (D-1) está em selectedDayIndex + 1
  // - Próximo dia cronológico (D+1) está em selectedDayIndex - 1
  const prevChronologicalDay =
    selectedDayIndex + 1 < dailyClosings.length
      ? dailyClosings[selectedDayIndex + 1]
      : null;
  const nextChronologicalDay =
    selectedDayIndex - 1 >= 0 ? dailyClosings[selectedDayIndex - 1] : null;

  const displayedTotalBalance = selectedClosing
    ? selectedClosing.totalBalanceEnd
    : totalBalance;
  const displayedFreeBalance = selectedClosing
    ? selectedClosing.freeBalanceEnd
    : freeBalance;
  const displayedCardsBalance = selectedClosing
    ? selectedClosing.cardsBalanceEnd
    : cardsBalance;

  const formatDayBr = (dateStr: string | null | undefined): string => {
    if (!dateStr) return "—";
    const parts = dateStr.split("-");
    if (parts.length === 3) return `${parts[2]}/${parts[1]}/${parts[0]}`;
    return dateStr;
  };

  const formatShortDayBr = (dateStr: string | null | undefined): string => {
    if (!dateStr) return "—";
    const parts = dateStr.split("-");
    if (parts.length === 3) return `${parts[2]}/${parts[1]}`;
    return dateStr;
  };

  // Parser de input monetário
  const parseCurrencyInput = (val: string): number => {
    if (!val) return NaN;
    const clean = val.replace(/[R$\s]/g, "");
    if (clean.includes(",") && clean.includes(".")) {
      return parseFloat(clean.replace(/\./g, "").replace(",", "."));
    }
    if (clean.includes(",")) {
      return parseFloat(clean.replace(/\s/g, "").replace(",", "."));
    }
    return parseFloat(clean.replace(/\s/g, ""));
  };

  const handleCurrencyInputChange = (val: string, setter: (formatted: string) => void) => {
    let clean = val.replace(/\D/g, "");
    if (!clean) {
      setter("");
      return;
    }
    const num = parseInt(clean, 10) / 100;
    const formatted = num.toLocaleString("pt-BR", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });
    setter(formatted);
  };

  // Submissão do Ajuste / Entrada de Saldo Livre
  const handleSubmitAdjust = async (e: React.FormEvent) => {
    e.preventDefault();
    setAdjustError(null);

    try {
      setAdjustSubmitting(true);
      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData?.session?.access_token;
      const headers: Record<string, string> = { "Content-Type": "application/json" };
      if (token) headers["Authorization"] = `Bearer ${token}`;
      if (userId) headers["x-user-id"] = userId;

      let payload: any = {
        target: "FREE",
        reason:
          adjustReason.trim() ||
          (adjustMode === "DELTA"
            ? "Entrada manual de recarga Caju"
            : "Ajuste contábil de Saldo Livre Caju"),
        userId,
      };

      if (adjustMode === "DELTA") {
        const deltaNum = parseCurrencyInput(adjustDelta);
        if (!Number.isFinite(deltaNum) || deltaNum <= 0) {
          setAdjustError("Informe um valor de entrada válido maior que zero.");
          return;
        }
        payload.delta = deltaNum;
      } else {
        const absNum = parseCurrencyInput(adjustAbsolute);
        if (!Number.isFinite(absNum) || absNum < 0) {
          setAdjustError("Informe um saldo absoluto válido (>= 0).");
          return;
        }
        payload.newBalance = absNum;
      }

      const res = await fetch("/api/caju/adjust", {
        method: "POST",
        headers,
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const errJson = await res.json().catch(() => ({}));
        throw new Error(errJson.error || "Falha ao ajustar Saldo Livre.");
      }

      const data = await res.json();
      if (data.snapshot) {
        setSnapshot(data.snapshot);
        setCollaborators(data.collaborators || []);
        setTransactions(data.transactions || []);
        setMovements(data.movements || []);
        setDailyClosings(data.dailyClosings || []);
      } else {
        await fetchHub(true);
      }

      setIsAdjustModalOpen(false);
      window.dispatchEvent(new Event("caju-balance-updated"));
    } catch (err: any) {
      setAdjustError(err.message || "Erro inesperado ao realizar ajuste.");
    } finally {
      setAdjustSubmitting(false);
    }
  };

  const applyHubPayload = useCallback((data: any) => {
    if (!data || !data.snapshot) return false;
    setSnapshot(data.snapshot);
    setCollaborators(data.collaborators || []);
    setTransactions(data.transactions || []);
    setMovements(data.movements || []);
    setDailyClosings(data.dailyClosings || []);
    return true;
  }, []);

  if (userRole && !isMaster && !isFinanceiro) return null;

  return (
    <div
      id="caju-scroll-container"
      className="flex-1 flex flex-col w-full min-h-0 overflow-y-auto p-4 md:p-6 custom-scrollbar bg-transparent"
      style={{
        color: "var(--text-primary)",
        overflowY: "auto",
        height: "100%",
        maxHeight: "100%",
        WebkitOverflowScrolling: "touch",
      }}
    >
      <div className="max-w-[1360px] mx-auto w-full space-y-6 pb-16">
        {/* ========================================================
            TOP HEADER & GLASS TOOLBAR UNIFICADA
            ======================================================== */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4 border-b border-white/[0.08]">
          <div className="space-y-1">
            <div className="flex items-center gap-2.5 flex-wrap">
              <h1 className="text-2xl font-extrabold tracking-tight text-white">
                Hub Caju • Benefícios & Cartões Corporativos
              </h1>
              <div className="flex items-center gap-1.5">
                <span className="text-[10px] font-bold uppercase tracking-wider px-2.5 py-0.5 rounded-full bg-rose-500/20 border border-rose-500/40 text-rose-300">
                  Caju • CNPJ 2
                </span>
                <span className="text-[10px] font-bold uppercase tracking-wider px-2.5 py-0.5 rounded-full bg-emerald-500/15 border border-emerald-500/30 text-emerald-400">
                  Validador IA Ativo
                </span>
              </div>
            </div>
            <p className="text-xs text-slate-400 font-normal">
              Marco Zero Oficial: <strong className="text-slate-200">{CAJU_CUTOFF_LABEL}</strong> • Conciliação contínua e gestão patrimonial em tempo real.
            </p>
          </div>

          {/* Barra de Ações Operacionais (Glass Toolbar Unificada) */}
          <div className="inline-flex items-center gap-1.5 p-1 rounded-2xl bg-slate-900/80 border border-white/10 backdrop-blur-xl shadow-lg shrink-0">
            <button
              onClick={() => fetchHub(false)}
              disabled={refreshing}
              className="p-2 rounded-xl text-slate-400 hover:text-white hover:bg-white/[0.06] transition-all cursor-pointer disabled:opacity-50"
              title="Atualizar saldo e dados do Caju"
            >
              <RefreshCw size={14} className={refreshing ? "animate-spin text-rose-400" : ""} />
            </button>

            <div className="h-4 w-px bg-white/10" />

            <button
              onClick={() => {
                setAdjustError(null);
                setAdjustMode("DELTA");
                setAdjustDelta("3.000,00");
                setAdjustAbsolute(freeBalance.toFixed(2).replace(".", ","));
                setAdjustReason("Entrada de recarga manual Caju");
                setIsAdjustModalOpen(true);
              }}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold text-slate-300 hover:text-white hover:bg-white/[0.06] transition-all cursor-pointer"
            >
              <SlidersHorizontal size={13} className="text-rose-400" />
              <span>Entrada / Ajustar Saldo Livre</span>
            </button>

            <div className="h-4 w-px bg-white/10" />

            <button
              onClick={() => setIsImportModalOpen(true)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold text-rose-200 hover:text-white bg-rose-950/40 hover:bg-rose-900/60 border border-rose-500/30 transition-all cursor-pointer shadow-[0_0_12px_rgba(244,63,94,0.15)]"
              title="Importar e conciliar extrato CSV Caju"
            >
              <Upload size={13} className="text-rose-400" />
              <span>Importar Extrato CSV</span>
            </button>
          </div>
        </div>

        {/* ========================================================
            CARD CORPORATIVO PRINCIPAL — ESTILO PREMIUM TRANSLÚCIDO (ROSA/CORAL)
            COM DESTRINCHAMENTO DIÁRIO REVERSO (27/10 ATÉ 27/09 E 01/09)
            ======================================================== */}
        <div className="rounded-2xl bg-gradient-to-br from-slate-900/95 via-[#261019] to-slate-900/95 border border-rose-500/35 p-6 shadow-xl relative overflow-hidden group hover:border-rose-500/50 transition-all duration-300">
          <div className="absolute top-0 right-0 -mr-20 -mt-20 w-80 h-80 bg-rose-500/15 rounded-full blur-3xl pointer-events-none" />

          <div className="relative z-10 flex flex-col justify-between">
            {/* Topo do Card: Ícone, Seletor de Dia, Hero Number e Botão Recarga Caju */}
            <div className="flex items-start justify-between gap-4 flex-wrap lg:flex-nowrap">
              <div className="flex items-start gap-4 flex-1 min-w-0">
                <div className="w-13 h-13 rounded-2xl bg-gradient-to-br from-rose-500 to-pink-700 flex items-center justify-center text-white shadow-lg shadow-rose-950/60 shrink-0 border border-rose-400/20">
                  <CreditCard size={24} className="text-white drop-shadow-sm" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-[11px] font-bold uppercase tracking-wider text-rose-300 bg-rose-500/25 px-2.5 py-0.5 rounded-full border border-rose-500/40">
                      Caju • Patrimônio Total em {formatDayBr(selectedClosing?.date || latestDate)}
                    </span>
                    {isLatestDay ? (
                      <span className="inline-flex items-center gap-1 text-[11px] text-emerald-400 font-semibold bg-emerald-500/15 px-2 py-0.5 rounded-full border border-emerald-500/30">
                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                        Saldo Atual (Hoje • Marco Zero)
                      </span>
                    ) : selectedClosing?.isWeekend ? (
                      <span className="inline-flex items-center gap-1 text-[11px] text-slate-300 font-semibold bg-slate-800 px-2 py-0.5 rounded-full border border-slate-700">
                        <History size={11} />
                        Fim de Semana (Repete Saldo de Sexta)
                      </span>
                    ) : selectedClosing?.isHoliday ? (
                      <span className="inline-flex items-center gap-1 text-[11px] text-purple-300 font-semibold bg-purple-900/50 px-2 py-0.5 rounded-full border border-purple-500/40">
                        <History size={11} />
                        Feriado ({selectedClosing.holidayName})
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 text-[11px] text-amber-300 font-semibold bg-amber-500/15 px-2 py-0.5 rounded-full border border-amber-500/30">
                        <History size={11} />
                        Fechamento Histórico ({formatDayBr(selectedClosing?.date)})
                      </span>
                    )}
                  </div>

                  {/* Hero Number: SALDO TOTAL CAJU NO DIA SELECIONADO */}
                  <div className="flex items-center gap-3 mt-2 flex-wrap">
                    {loading ? (
                      <div className="h-10 w-48 bg-slate-800 rounded animate-pulse" />
                    ) : error ? (
                      <div className="flex items-center gap-1.5 text-rose-400 text-sm font-semibold">
                        <AlertCircle size={16} />
                        <span>Erro ao consultar saldo</span>
                      </div>
                    ) : (
                      <div className="flex items-center gap-2.5 flex-wrap">
                        <AnimatedCurrency
                          value={displayedTotalBalance}
                          prefix="R$ "
                          prefixClassName="text-2xl md:text-3xl text-rose-300/80 font-medium mr-1"
                          className="text-3xl md:text-4xl font-extrabold text-white tracking-tight font-mono"
                        />
                        <span className="text-xs font-mono font-bold px-2.5 py-1 rounded-lg bg-white/10 text-rose-200 border border-rose-500/30">
                          Dia {formatDayBr(selectedClosing?.date || latestDate)}
                        </span>
                        <button
                          onClick={() => fetchHub(true)}
                          disabled={refreshing}
                          title="Atualizar saldo agora"
                          className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-white/10 transition-colors cursor-pointer"
                        >
                          <RefreshCw
                            size={15}
                            className={refreshing ? "animate-spin text-rose-400" : ""}
                          />
                        </button>
                      </div>
                    )}
                  </div>

                  {/* Subtítulo da Fórmula */}
                  <p className="text-xs text-slate-300 mt-1 font-medium">
                    Patrimônio Total ({formatDayBr(selectedClosing?.date || latestDate)}) = Saldo Livre (
                    <span className="text-rose-300 font-mono font-bold">
                      R$ {displayedFreeBalance.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </span>
                    ) + Saldo nos Cartões (
                    <span className="text-purple-300 font-mono font-bold">
                      R$ {displayedCardsBalance.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </span>
                    )
                  </p>
                </div>
              </div>

              {/* Controles Superiores Direitos: Navegador de Data + Recarga Caju (R$ 3.000) */}
              <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2.5 self-start shrink-0 w-full lg:w-auto">
                {/* Navegador Interativo de Data no Topo */}
                {dailyClosings.length > 0 && (
                  <div className="flex items-center gap-1 p-1 rounded-xl bg-slate-950/80 border border-rose-500/35 shadow-inner">
                    <button
                      type="button"
                      onClick={() =>
                        prevChronologicalDay && setSelectedDate(prevChronologicalDay.date)
                      }
                      disabled={!prevChronologicalDay}
                      className="p-1.5 rounded-lg text-slate-300 hover:text-white hover:bg-rose-500/20 disabled:opacity-30 disabled:cursor-not-allowed transition-colors cursor-pointer"
                      title={
                        prevChronologicalDay
                          ? `Voltar para o dia anterior (${formatDayBr(prevChronologicalDay.date)})`
                          : "Primeiro dia do histórico (01/09/2026)"
                      }
                    >
                      <ChevronLeft size={15} />
                    </button>

                    <div className="flex items-center gap-1.5 px-2">
                      <Calendar size={13} className="text-rose-400 shrink-0" />
                      <select
                        value={selectedClosing?.date || latestDate}
                        onChange={(e) => setSelectedDate(e.target.value)}
                        aria-label="Selecionar dia para ver o Patrimônio Total Caju"
                        className="bg-transparent text-xs font-mono font-bold text-white outline-none cursor-pointer pr-1"
                      >
                        {dailyClosings.map((c, idx) => (
                          <option
                            key={c.date}
                            value={c.date}
                            className="bg-slate-900 text-white font-mono"
                          >
                            {formatDayBr(c.date)}{" "}
                            {idx === 0 ? "(Hoje)" : idx === 1 ? "(Ontem)" : ""} — R${" "}
                            {c.totalBalanceEnd.toLocaleString("pt-BR", {
                              minimumFractionDigits: 2,
                              maximumFractionDigits: 2,
                            })}
                          </option>
                        ))}
                      </select>
                    </div>

                    <button
                      type="button"
                      onClick={() =>
                        nextChronologicalDay && setSelectedDate(nextChronologicalDay.date)
                      }
                      disabled={!nextChronologicalDay}
                      className="p-1.5 rounded-lg text-slate-300 hover:text-white hover:bg-rose-500/20 disabled:opacity-30 disabled:cursor-not-allowed transition-colors cursor-pointer"
                      title={
                        nextChronologicalDay
                          ? `Avançar para o próximo dia (${formatDayBr(nextChronologicalDay.date)})`
                          : "Dia mais recente (Hoje)"
                      }
                    >
                      <ChevronRight size={15} />
                    </button>

                    {!isLatestDay && (
                      <button
                        type="button"
                        onClick={() => setSelectedDate(latestDate)}
                        className="px-2 py-1 rounded-lg text-[10px] font-bold uppercase tracking-wider bg-rose-500/25 hover:bg-rose-500/40 text-rose-200 border border-rose-500/40 transition-colors cursor-pointer ml-0.5"
                        title="Voltar para o saldo de Hoje (27/10/2026)"
                      >
                        Hoje
                      </button>
                    )}
                  </div>
                )}

                <button
                  type="button"
                  onClick={() => setIsRechargeModalOpen(true)}
                  className="px-4 py-2.5 rounded-xl text-xs sm:text-sm font-semibold flex items-center justify-center gap-2 bg-gradient-to-r from-rose-500/20 to-pink-500/20 hover:from-rose-500/30 hover:to-pink-500/30 text-rose-200 border border-rose-500/40 hover:border-rose-400/70 shadow-[0_0_20px_rgba(244,63,94,0.18)] hover:shadow-[0_0_25px_rgba(244,63,94,0.3)] active:scale-[0.98] transition-all duration-200 cursor-pointer"
                  title="Solicitar Recarga Caju de R$ 3.000,00"
                >
                  <Sparkles className="w-4 h-4 text-rose-400 animate-pulse" />
                  <span>Recarga Caju (R$ 3.000)</span>
                </button>
              </div>
            </div>

            {/* ========================================================
                FITA HORIZONTAL DE DIAS (27/10 ATÉ 27/09 E 01/09)
                ======================================================== */}
            {dailyClosings.length > 0 && (
              <div className="mt-5 pt-4 border-t border-rose-500/20">
                <div className="flex items-center justify-between gap-2 mb-2 flex-wrap">
                  <span className="text-[11px] font-bold uppercase tracking-wider text-rose-200/90 flex items-center gap-1.5">
                    <Calendar size={12} className="text-rose-400" />
                    <span>Linha do Tempo Diária (Clique no dia para ver o saldo exato daquela data):</span>
                  </span>
                  <div className="flex items-center gap-1.5 text-[10px]">
                    <button
                      type="button"
                      onClick={() => setSelectedDate("2026-10-27")}
                      className={`px-2 py-0.5 rounded-md font-mono font-semibold border transition-all cursor-pointer ${
                        selectedClosing?.date === "2026-10-27"
                          ? "bg-rose-500/30 text-white border-rose-400"
                          : "bg-slate-900/70 text-slate-300 border-white/10 hover:text-white"
                      }`}
                    >
                      Hoje (27/10)
                    </button>
                    <button
                      type="button"
                      onClick={() => setSelectedDate("2026-10-26")}
                      className={`px-2 py-0.5 rounded-md font-mono font-semibold border transition-all cursor-pointer ${
                        selectedClosing?.date === "2026-10-26"
                          ? "bg-rose-500/30 text-white border-rose-400"
                          : "bg-slate-900/70 text-slate-300 border-white/10 hover:text-white"
                      }`}
                    >
                      Ontem (26/10)
                    </button>
                    <button
                      type="button"
                      onClick={() => setSelectedDate("2026-09-27")}
                      className={`px-2 py-0.5 rounded-md font-mono font-semibold border transition-all cursor-pointer ${
                        selectedClosing?.date === "2026-09-27"
                          ? "bg-rose-500/30 text-white border-rose-400"
                          : "bg-slate-900/70 text-slate-300 border-white/10 hover:text-white"
                      }`}
                    >
                      Início Extrato (27/09)
                    </button>
                    <button
                      type="button"
                      onClick={() => setSelectedDate("2026-09-01")}
                      className={`px-2 py-0.5 rounded-md font-mono font-semibold border transition-all cursor-pointer ${
                        selectedClosing?.date === "2026-09-01"
                          ? "bg-rose-500/30 text-white border-rose-400"
                          : "bg-slate-900/70 text-slate-300 border-white/10 hover:text-white"
                      }`}
                    >
                      01/09/2026
                    </button>
                  </div>
                </div>

                <div className="flex items-center gap-2 overflow-x-auto pb-2 pt-0.5 custom-scrollbar">
                  {dailyClosings.map((day, idx) => {
                    const isSelected = day.date === (selectedClosing?.date || latestDate);
                    const hasActivity =
                      day.recharges > 0 ||
                      day.deposits > 0 ||
                      day.rescues > 0 ||
                      day.purchases > 0;
                    return (
                      <button
                        key={day.date}
                        type="button"
                        onClick={() => setSelectedDate(day.date)}
                        className={`px-3 py-2 rounded-xl border text-left shrink-0 transition-all cursor-pointer flex flex-col gap-0.5 min-w-[118px] ${
                          isSelected
                            ? "bg-rose-500/25 border-rose-400 text-white shadow-[0_0_15px_rgba(244,63,94,0.28)] scale-[1.01]"
                            : hasActivity
                            ? "bg-slate-950/65 border-white/10 text-slate-300 hover:border-rose-500/40 hover:text-white"
                            : "bg-slate-950/35 border-white/5 text-slate-400 hover:border-white/20 hover:text-slate-200"
                        }`}
                      >
                        <div className="flex items-center justify-between gap-1">
                          <span className="text-[11px] font-mono font-bold">
                            {formatShortDayBr(day.date)}
                          </span>
                          <span
                            className={`text-[9px] font-bold uppercase px-1.5 py-0.2 rounded ${
                              idx === 0
                                ? "bg-emerald-500/20 text-emerald-300"
                                : idx === 1
                                ? "bg-amber-500/20 text-amber-300"
                                : hasActivity
                                ? "bg-rose-500/20 text-rose-300"
                                : "bg-white/5 text-slate-400"
                            }`}
                          >
                            {idx === 0
                              ? "Hoje"
                              : idx === 1
                              ? "Ontem"
                              : `${day.txCount} mov`}
                          </span>
                        </div>
                        <span
                          className={`text-xs font-mono font-extrabold ${
                            isSelected ? "text-white" : "text-rose-200"
                          }`}
                        >
                          R${" "}
                          {day.totalBalanceEnd.toLocaleString("pt-BR", {
                            minimumFractionDigits: 2,
                            maximumFractionDigits: 2,
                          })}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {/* ========================================================
                PONTE DE DESTRINCHAMENTO DO DIA (SALDO DO DIA <-> MOVIMENTAÇÕES <-> SALDO DE ONTEM)
                ======================================================== */}
            {selectedClosing && (
              <div className="mt-3 p-4 rounded-xl bg-slate-950/75 border border-rose-500/30 backdrop-blur-md">
                <div className="flex items-center justify-between gap-2 flex-wrap mb-3">
                  <div className="flex items-center gap-2">
                    <span className="text-[11px] font-bold uppercase tracking-wider text-rose-300">
                      Prova Real & Destrinchamento Reverso de {formatDayBr(selectedClosing.date)}
                    </span>
                    <span className="text-[11px] text-slate-400">
                      (Como chegamos no saldo do dia anterior revertendo as transações deste dia)
                    </span>
                  </div>
                  {prevChronologicalDay && (
                    <button
                      type="button"
                      onClick={() => setSelectedDate(prevChronologicalDay.date)}
                      className="inline-flex items-center gap-1.5 text-[11px] font-bold text-rose-300 hover:text-white bg-rose-500/15 hover:bg-rose-500/30 border border-rose-500/30 px-2.5 py-1 rounded-lg transition-all cursor-pointer"
                    >
                      <span>Ver Saldo de {formatDayBr(prevChronologicalDay.date)}</span>
                      <ArrowRight size={12} />
                    </button>
                  )}
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-3 gap-3 items-stretch">
                  {/* Coluna 1: Saldo Final do Dia Selecionado (D) */}
                  <div className="p-3 rounded-xl bg-slate-900/90 border border-rose-500/30 flex flex-col justify-between">
                    <div className="flex items-center justify-between text-[11px] text-slate-300">
                      <span className="font-bold uppercase text-rose-300">
                        1. Saldo Final em {formatShortDayBr(selectedClosing.date)}
                      </span>
                      <span className="font-mono text-[10px] text-slate-400">Fechamento</span>
                    </div>
                    <div className="text-lg font-extrabold font-mono text-white my-1">
                      <AnimatedCurrency value={selectedClosing.totalBalanceEnd} prefix="R$ " />
                    </div>
                    <div className="flex items-center justify-between text-[11px] font-mono text-slate-300 pt-1.5 border-t border-white/10">
                      <span>
                        Livre:{" "}
                        <strong className="text-rose-300">
                          R${" "}
                          {selectedClosing.freeBalanceEnd.toLocaleString("pt-BR", {
                            minimumFractionDigits: 2,
                            maximumFractionDigits: 2,
                          })}
                        </strong>
                      </span>
                      <span>
                        Cartões:{" "}
                        <strong className="text-purple-300">
                          R${" "}
                          {selectedClosing.cardsBalanceEnd.toLocaleString("pt-BR", {
                            minimumFractionDigits: 2,
                            maximumFractionDigits: 2,
                          })}
                        </strong>
                      </span>
                    </div>
                  </div>

                  {/* Coluna 2: Movimentações ocorridas no Dia (D) */}
                  <div className="p-3 rounded-xl bg-slate-900/90 border border-white/10 flex flex-col justify-between">
                    <div className="flex items-center justify-between text-[11px] text-slate-300 mb-1.5">
                      <span className="font-bold uppercase text-amber-300">
                        2. Movimentações de {formatShortDayBr(selectedClosing.date)}
                      </span>
                      <span className="font-mono text-[10px] text-slate-400">
                        {selectedClosing.isWeekend
                          ? "Fim de Semana"
                          : selectedClosing.isHoliday
                          ? "Feriado"
                          : `${selectedClosing.txCount} eventos`}
                      </span>
                    </div>

                    {selectedClosing.isWeekend ? (
                      <div className="p-2 rounded-lg bg-slate-800/80 border border-white/5 text-[11px] text-slate-300 leading-relaxed my-auto">
                        <span className="font-bold text-white block mb-0.5">Sem movimentações contábeis</span>
                        As compras e saídas de sábado e domingo são debitadas na segunda-feira (próximo dia útil). Por isso, este saldo repete exatamente a sexta-feira anterior.
                      </div>
                    ) : selectedClosing.isHoliday ? (
                      <div className="p-2 rounded-lg bg-purple-900/40 border border-purple-500/20 text-[11px] text-purple-200 leading-relaxed my-auto">
                        <span className="font-bold text-white block mb-0.5">Feriado ({selectedClosing.holidayName})</span>
                        Sem movimentação contábil. Eventuais transações foram transferidas para o próximo dia útil.
                      </div>
                    ) : (
                      <div className="grid grid-cols-2 gap-x-3 gap-y-1 text-[11px] font-mono">
                        <div className="flex items-center justify-between">
                          <span className="text-slate-400">Recargas Caju:</span>
                          <span
                            className={
                              selectedClosing.recharges > 0
                                ? "text-emerald-400 font-bold"
                                : "text-slate-400"
                            }
                          >
                            +R${" "}
                            {selectedClosing.recharges.toLocaleString("pt-BR", {
                              minimumFractionDigits: 2,
                              maximumFractionDigits: 2,
                            })}
                          </span>
                        </div>
                        <div className="flex items-center justify-between">
                          <span className="text-slate-400">Compras (Saídas):</span>
                          <span
                            className={
                              selectedClosing.purchases > 0
                                ? "text-rose-400 font-bold"
                                : "text-slate-400"
                            }
                          >
                            -R${" "}
                            {selectedClosing.purchases.toLocaleString("pt-BR", {
                              minimumFractionDigits: 2,
                              maximumFractionDigits: 2,
                            })}
                          </span>
                        </div>
                        <div className="flex items-center justify-between">
                          <span className="text-slate-400">Depósitos Cartões:</span>
                          <span
                            className={
                              selectedClosing.deposits > 0
                                ? "text-cyan-400 font-bold"
                                : "text-slate-400"
                            }
                          >
                            R${" "}
                            {selectedClosing.deposits.toLocaleString("pt-BR", {
                              minimumFractionDigits: 2,
                              maximumFractionDigits: 2,
                            })}
                          </span>
                        </div>
                        <div className="flex items-center justify-between">
                          <span className="text-slate-400">Resgates Empresa:</span>
                          <span
                            className={
                              selectedClosing.rescues > 0
                                ? "text-amber-300 font-bold"
                                : "text-slate-400"
                            }
                          >
                            R${" "}
                            {selectedClosing.rescues.toLocaleString("pt-BR", {
                              minimumFractionDigits: 2,
                              maximumFractionDigits: 2,
                            })}
                          </span>
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Coluna 3: Saldo do Dia Anterior / Início do Dia (D-1) */}
                  <div className="p-3 rounded-xl bg-slate-900/90 border border-emerald-500/30 flex flex-col justify-between">
                    <div className="flex items-center justify-between text-[11px] text-slate-300">
                      <span className="font-bold uppercase text-emerald-300">
                        3. Saldo Dia Anterior (
                        {prevChronologicalDay
                          ? formatShortDayBr(prevChronologicalDay.date)
                          : "Início"}
                        )
                      </span>
                      <span className="font-mono text-[10px] text-emerald-400">
                        = Início de {formatShortDayBr(selectedClosing.date)}
                      </span>
                    </div>
                    <div className="text-lg font-extrabold font-mono text-emerald-400 my-1">
                      <AnimatedCurrency
                        value={
                          selectedClosing.totalBalanceStart ?? selectedClosing.totalBalanceEnd
                        }
                        prefix="R$ "
                      />
                    </div>
                    <div className="flex items-center justify-between text-[11px] font-mono text-slate-300 pt-1.5 border-t border-white/10">
                      <span>
                        Livre Ant.:{" "}
                        <strong className="text-rose-300">
                          R${" "}
                          {(
                            selectedClosing.freeBalanceStart ?? selectedClosing.freeBalanceEnd
                          ).toLocaleString("pt-BR", {
                            minimumFractionDigits: 2,
                            maximumFractionDigits: 2,
                          })}
                        </strong>
                      </span>
                      <span>
                        Cartões Ant.:{" "}
                        <strong className="text-purple-300">
                          R${" "}
                          {(
                            selectedClosing.cardsBalanceStart ?? selectedClosing.cardsBalanceEnd
                          ).toLocaleString("pt-BR", {
                            minimumFractionDigits: 2,
                            maximumFractionDigits: 2,
                          })}
                        </strong>
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* 3 INDICADORES INTERNOS (CARDS INTERNOS INTEGRADOS DINÂMICOS POR DIA) */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3.5 mt-4 pt-4 border-t border-rose-500/20">
              {/* Indicador 1: Saldo Livre (Caixa Despesas) */}
              <div
                className="p-4 rounded-xl border backdrop-blur-md transition-all hover:border-rose-500/40"
                style={{ backgroundColor: "rgba(15, 23, 42, 0.6)", borderColor: "var(--surface-border)" }}
              >
                <div className="flex items-center justify-between mb-1">
                  <span className="text-[11px] font-bold uppercase tracking-wider text-rose-300 flex items-center gap-1.5">
                    <Building2 size={13} className="text-rose-400" />
                    <span>Saldo Livre em {formatShortDayBr(selectedClosing?.date || latestDate)}</span>
                  </span>
                  <span className="text-[10px] font-mono text-slate-400">Caixa Despesas</span>
                </div>
                <div className="mt-1">
                  <AnimatedCurrency
                    value={displayedFreeBalance}
                    prefix="R$ "
                    className="text-xl font-extrabold text-white font-mono"
                  />
                </div>
                <p className="text-[11px] text-slate-400 mt-1 leading-tight">
                  {selectedClosing ? (
                    <>
                      Início do dia:{" "}
                      <strong className="text-slate-200 font-mono">
                        R${" "}
                        {(selectedClosing.freeBalanceStart ?? selectedClosing.freeBalanceEnd).toLocaleString(
                          "pt-BR",
                          { minimumFractionDigits: 2, maximumFractionDigits: 2 }
                        )}
                      </strong>{" "}
                      • Recargas: +R${" "}
                      {selectedClosing.recharges.toLocaleString("pt-BR", {
                        minimumFractionDigits: 2,
                      })}
                    </>
                  ) : (
                    "Recebe +R$ 3.000 ao finalizar Recarga Caju no Kanban."
                  )}
                </p>
              </div>

              {/* Indicador 2: Saldo nos Cartões (Colaboradores) */}
              <div
                className="p-4 rounded-xl border backdrop-blur-md transition-all hover:border-purple-500/40"
                style={{ backgroundColor: "rgba(15, 23, 42, 0.6)", borderColor: "var(--surface-border)" }}
              >
                <div className="flex items-center justify-between mb-1">
                  <span className="text-[11px] font-bold uppercase tracking-wider text-purple-300 flex items-center gap-1.5">
                    <Users size={13} className="text-purple-400" />
                    <span>Saldo nos Cartões em {formatShortDayBr(selectedClosing?.date || latestDate)}</span>
                  </span>
                  <span className="text-[10px] font-mono text-slate-400">Em posse da equipe</span>
                </div>
                <div className="mt-1">
                  <AnimatedCurrency
                    value={displayedCardsBalance}
                    prefix="R$ "
                    className="text-xl font-extrabold text-white font-mono"
                  />
                </div>
                <p className="text-[11px] text-slate-400 mt-1 leading-tight">
                  {selectedClosing ? (
                    <>
                      Início do dia:{" "}
                      <strong className="text-slate-200 font-mono">
                        R${" "}
                        {(selectedClosing.cardsBalanceStart ?? selectedClosing.cardsBalanceEnd).toLocaleString(
                          "pt-BR",
                          { minimumFractionDigits: 2, maximumFractionDigits: 2 }
                        )}
                      </strong>{" "}
                      • Depósitos: +R${" "}
                      {selectedClosing.deposits.toLocaleString("pt-BR", {
                        minimumFractionDigits: 2,
                      })}
                    </>
                  ) : (
                    `${collaboratorsCount} colaboradores (${collaboratorsWithBalance} com saldo ativo).`
                  )}
                </p>
              </div>

              {/* Indicador 3: Saídas (Compras no Dia / Mês) */}
              <div
                className="p-4 rounded-xl border backdrop-blur-md transition-all hover:border-amber-500/40"
                style={{ backgroundColor: "rgba(15, 23, 42, 0.6)", borderColor: "var(--surface-border)" }}
              >
                <div className="flex items-center justify-between mb-1">
                  <span className="text-[11px] font-bold uppercase tracking-wider text-amber-300 flex items-center gap-1.5">
                    <ShoppingBag size={13} className="text-amber-400" />
                    <span>
                      {isLatestDay
                        ? "Saídas (Compras no Mês)"
                        : `Compras em ${formatShortDayBr(selectedClosing?.date)}`}
                    </span>
                  </span>
                  <span className="text-[10px] font-mono text-slate-400">Consumo real</span>
                </div>
                <div className="mt-1">
                  <AnimatedCurrency
                    value={
                      isLatestDay
                        ? monthPurchases
                        : selectedClosing?.purchases ?? 0
                    }
                    prefix="R$ "
                    className="text-xl font-extrabold text-rose-300 font-mono"
                  />
                </div>
                <p className="text-[11px] text-slate-400 mt-1 leading-tight">
                  {selectedClosing ? (
                    <>
                      No dia {formatShortDayBr(selectedClosing.date)}:{" "}
                      <strong className="text-rose-300 font-mono">
                        R${" "}
                        {selectedClosing.purchases.toLocaleString("pt-BR", {
                          minimumFractionDigits: 2,
                          maximumFractionDigits: 2,
                        })}
                      </strong>{" "}
                      • Acumulado Mês:{" "}
                      <strong className="text-slate-200 font-mono">
                        R${" "}
                        {monthPurchases.toLocaleString("pt-BR", {
                          minimumFractionDigits: 2,
                          maximumFractionDigits: 2,
                        })}
                      </strong>
                    </>
                  ) : (
                    "Total gasto em estabelecimentos no mês."
                  )}
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* ========================================================
            BARRA DE NAVEGAÇÃO DE ABAS
            ======================================================== */}
        <div className="flex items-center gap-2 border-b border-white/[0.08] pb-1 overflow-x-auto custom-scrollbar">
          <button
            type="button"
            onClick={() => setActiveTab("COLLABORATORS")}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold transition-all cursor-pointer whitespace-nowrap ${
              activeTab === "COLLABORATORS"
                ? "bg-rose-500/20 text-rose-300 border border-rose-500/40 shadow-[0_0_15px_rgba(244,63,94,0.15)]"
                : "border border-transparent text-slate-400 hover:text-white hover:bg-white/5"
            }`}
          >
            <Users size={14} className={activeTab === "COLLABORATORS" ? "text-rose-400" : "text-slate-400"} />
            <span>Colaboradores & Saldos</span>
            <span className="px-1.5 py-0.5 rounded-full text-[10px] font-mono bg-white/10 text-white">
              {collaborators.length}
            </span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab("STATEMENT")}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold transition-all cursor-pointer whitespace-nowrap ${
              activeTab === "STATEMENT"
                ? "bg-rose-500/20 text-rose-300 border border-rose-500/40 shadow-[0_0_15px_rgba(244,63,94,0.15)]"
                : "border border-transparent text-slate-400 hover:text-white hover:bg-white/5"
            }`}
          >
            <Sparkles size={14} className={activeTab === "STATEMENT" ? "text-rose-400" : "text-slate-400"} />
            <span>Extrato Oficial & Validador IA</span>
            <span className="px-1.5 py-0.5 rounded-full text-[10px] font-mono bg-white/10 text-white">
              {transactions.length}
            </span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab("CLOSINGS")}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold transition-all cursor-pointer whitespace-nowrap ${
              activeTab === "CLOSINGS"
                ? "bg-rose-500/20 text-rose-300 border border-rose-500/40 shadow-[0_0_15px_rgba(244,63,94,0.15)]"
                : "border border-transparent text-slate-400 hover:text-white hover:bg-white/5"
            }`}
          >
            <Calendar size={14} className={activeTab === "CLOSINGS" ? "text-rose-400" : "text-slate-400"} />
            <span>Fechamentos Diários (01/09 a 27/10)</span>
            <span className="px-1.5 py-0.5 rounded-full text-[10px] font-mono bg-white/10 text-white">
              {dailyClosings.length}
            </span>
          </button>
        </div>

        {/* ========================================================
            CONTEÚDO DA ABA ATIVA
            ======================================================== */}
        <div>
          {activeTab === "COLLABORATORS" && (
            <CajuCollaboratorsTab
              collaborators={collaborators}
              cardsBalance={cardsBalance}
              isMaster={isMaster}
              userId={userId}
              onDataUpdated={(hubData) => {
                if (!applyHubPayload(hubData)) fetchHub(true);
              }}
            />
          )}

          {activeTab === "STATEMENT" && (
            <CajuStatementSection
              transactions={transactions}
              dailyClosings={dailyClosings}
              movements={movements}
              viewMode="STATEMENT"
              selectedDate={selectedClosing?.date || latestDate}
              onSelectDate={(d) => setSelectedDate(d)}
              onOpenImportModal={() => setIsImportModalOpen(true)}
            />
          )}

          {activeTab === "CLOSINGS" && (
            <CajuStatementSection
              transactions={transactions}
              dailyClosings={dailyClosings}
              movements={movements}
              viewMode="CLOSINGS"
              selectedDate={selectedClosing?.date || latestDate}
              onSelectDate={(d) => setSelectedDate(d)}
              onOpenImportModal={() => setIsImportModalOpen(true)}
            />
          )}
        </div>
      </div>

      {/* ========================================================
          MODAL: RECARGA CAJU (R$ 3.000)
          ======================================================== */}
      <CajuRechargeModal
        isOpen={isRechargeModalOpen}
        onClose={() => setIsRechargeModalOpen(false)}
        onSuccess={() => fetchHub(true)}
      />

      {/* ========================================================
          MODAL: IMPORTAR EXTRATO CSV CAJU
          ======================================================== */}
      <CajuCsvImportModal
        isOpen={isImportModalOpen}
        onClose={() => setIsImportModalOpen(false)}
        userId={userId}
        onImported={(hubData) => {
          if (!applyHubPayload(hubData)) fetchHub(true);
        }}
      />

      {/* ========================================================
          MODAL: ENTRADA / AJUSTAR SALDO LIVRE (CAIXA DESPESAS)
          ======================================================== */}
      {isAdjustModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-md animate-in fade-in">
          <div
            className="w-full max-w-lg rounded-2xl border p-6 shadow-2xl relative space-y-4 animate-in zoom-in-95 max-h-[90vh] overflow-y-auto custom-scrollbar"
            style={{ backgroundColor: "var(--bg-secondary)", borderColor: "var(--surface-border)" }}
          >
            {/* Header */}
            <div
              className="flex items-center justify-between pb-3 border-b"
              style={{ borderColor: "var(--surface-border)" }}
            >
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-rose-500/20 text-rose-400 flex items-center justify-center shrink-0 border border-rose-500/30">
                  <SlidersHorizontal size={20} />
                </div>
                <div>
                  <h3 className="text-base font-bold text-white">
                    Entrada / Ajustar Saldo Livre Caju
                  </h3>
                  <p className="text-xs text-slate-400 mt-0.5">
                    Saldo atual em caixa:{" "}
                    <strong className="text-rose-300 font-mono">
                      <AnimatedCurrency value={freeBalance} prefix="R$ " />
                    </strong>
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsAdjustModalOpen(false)}
                className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-white/10 transition-colors cursor-pointer"
              >
                <X size={16} />
              </button>
            </div>

            {/* Alternador de Modo: Entrada de Recarga (+ Delta) vs Redefinir Saldo (Master) */}
            <div className="grid grid-cols-2 gap-2 p-1 rounded-xl bg-slate-900/60 border border-white/10">
              <button
                type="button"
                onClick={() => setAdjustMode("DELTA")}
                className={`py-2 px-3 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center justify-center gap-1.5 ${
                  adjustMode === "DELTA"
                    ? "bg-rose-500/20 text-rose-300 border border-rose-500/40 shadow-sm"
                    : "text-slate-400 hover:text-white"
                }`}
              >
                <Plus size={13} className="text-emerald-400" />
                <span>Entrada Manual (+ Delta)</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  if (isMaster) {
                    setAdjustMode("ABSOLUTE");
                  }
                }}
                disabled={!isMaster}
                className={`py-2 px-3 rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-1.5 ${
                  adjustMode === "ABSOLUTE"
                    ? "bg-rose-500/20 text-rose-300 border border-rose-500/40 shadow-sm"
                    : isMaster
                    ? "text-slate-400 hover:text-white cursor-pointer"
                    : "text-slate-600 opacity-50 cursor-not-allowed"
                }`}
                title={!isMaster ? "Apenas o perfil MASTER pode redefinir o saldo absoluto" : ""}
              >
                <ShieldCheck size={13} className={isMaster ? "text-purple-400" : "text-slate-600"} />
                <span>Saldo Absoluto {isMaster ? "(Master)" : "(Bloqueado)"}</span>
              </button>
            </div>

            {adjustError && (
              <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs flex items-center gap-2">
                <AlertCircle size={14} className="shrink-0" />
                <span>{adjustError}</span>
              </div>
            )}

            <form onSubmit={handleSubmitAdjust} className="space-y-4">
              {adjustMode === "DELTA" ? (
                /* Modo 1: Entrada de Recarga (+ Delta) */
                <div className="space-y-3">
                  <div>
                    <label className="block text-xs font-semibold mb-1 text-slate-300">
                      Valor de Entrada a Acrescentar (R$) *
                    </label>
                    <input
                      type="text"
                      required
                      value={adjustDelta}
                      onChange={(e) =>
                        handleCurrencyInputChange(e.target.value, setAdjustDelta)
                      }
                      placeholder="3.000,00"
                      className="w-full px-3.5 py-2.5 rounded-xl text-sm outline-none border focus:border-rose-500 font-bold font-mono text-emerald-400"
                      style={{
                        backgroundColor: "var(--bg-card)",
                        borderColor: "var(--surface-border)",
                      }}
                    />
                  </div>

                  {/* Botões Rápidos */}
                  <div>
                    <span className="text-[11px] font-semibold text-slate-400 block mb-1.5">
                      Preenchimento Rápido:
                    </span>
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                      {[
                        { label: "+ R$ 3.000", value: "3.000,00" },
                        { label: "+ R$ 1.000", value: "1.000,00" },
                        { label: "+ R$ 2.000", value: "2.000,00" },
                        { label: "+ R$ 5.000", value: "5.000,00" },
                      ].map((q) => (
                        <button
                          key={q.value}
                          type="button"
                          onClick={() => setAdjustDelta(q.value)}
                          className="px-2.5 py-1.5 rounded-lg border text-xs font-mono font-semibold transition-all hover:bg-white/5 cursor-pointer text-slate-300 hover:text-white"
                          style={{ borderColor: "var(--surface-border)" }}
                        >
                          {q.label}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Prévia do Resultado */}
                  <div
                    className="p-3 rounded-xl border flex items-center justify-between text-xs"
                    style={{
                      backgroundColor: "var(--bg-primary)",
                      borderColor: "var(--surface-border)",
                    }}
                  >
                    <span className="text-slate-400">Saldo Livre resultante:</span>
                    <span className="font-mono font-bold text-white text-sm">
                      <AnimatedCurrency
                        value={round2(freeBalance + (parseCurrencyInput(adjustDelta) || 0))}
                        prefix="R$ "
                      />
                    </span>
                  </div>
                </div>
              ) : (
                /* Modo 2: Saldo Absoluto (Exclusivo Master) */
                <div className="space-y-3">
                  <div>
                    <label className="block text-xs font-semibold mb-1 text-slate-300">
                      Novo Saldo Livre Absoluto (R$) *
                    </label>
                    <input
                      type="text"
                      required
                      value={adjustAbsolute}
                      onChange={(e) =>
                        handleCurrencyInputChange(e.target.value, setAdjustAbsolute)
                      }
                      placeholder={freeBalance.toFixed(2).replace(".", ",")}
                      className="w-full px-3.5 py-2.5 rounded-xl text-sm outline-none border focus:border-rose-500 font-bold font-mono text-purple-300"
                      style={{
                        backgroundColor: "var(--bg-card)",
                        borderColor: "var(--surface-border)",
                      }}
                    />
                  </div>

                  <div className="p-3 rounded-xl bg-purple-500/10 border border-purple-500/30 text-purple-200 text-xs leading-relaxed">
                    A redefinição absoluta sobrescreve o valor do Caixa Despesas e registra uma movimentação contábil de ajuste para auditoria no histórico.
                  </div>
                </div>
              )}

              {/* Motivo do Ajuste */}
              <div>
                <label className="block text-xs font-semibold mb-1 text-slate-300">
                  Motivo / Justificativa *
                </label>
                <input
                  type="text"
                  required
                  value={adjustReason}
                  onChange={(e) => setAdjustReason(e.target.value)}
                  placeholder="Ex: Entrada manual de recarga Caju"
                  className="w-full px-3.5 py-2.5 rounded-xl text-xs outline-none border focus:border-rose-500 font-medium"
                  style={{
                    backgroundColor: "var(--bg-card)",
                    borderColor: "var(--surface-border)",
                    color: "var(--text-primary)",
                  }}
                />
              </div>

              {/* Botões de Ação */}
              <div
                className="flex items-center justify-end gap-3 pt-3 border-t"
                style={{ borderColor: "var(--surface-border)" }}
              >
                <button
                  type="button"
                  onClick={() => setIsAdjustModalOpen(false)}
                  disabled={adjustSubmitting}
                  className="px-4 py-2.5 rounded-xl text-xs font-semibold text-slate-400 hover:text-white transition-colors cursor-pointer"
                >
                  Cancelar
                </button>

                <button
                  type="submit"
                  disabled={adjustSubmitting}
                  className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-gradient-to-r from-rose-500 via-rose-600 to-pink-700 hover:from-rose-400 hover:to-pink-600 text-white font-bold text-xs uppercase tracking-wider shadow-lg shadow-rose-950/40 transition-all cursor-pointer active:scale-95 disabled:opacity-50"
                >
                  {adjustSubmitting ? (
                    <span>Salvando...</span>
                  ) : (
                    <>
                      <Check size={14} />
                      <span>Confirmar Ajuste</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
