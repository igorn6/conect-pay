"use client";

import React, { useState, useMemo } from "react";
import {
  Search,
  Filter,
  Sparkles,
  Eye,
  CheckCircle2,
  Clock,
  ChevronDown,
  ChevronUp,
  ChevronLeft,
  ChevronRight,
  X,
  FileCheck2,
  Upload,
  ShieldCheck,
  AlertCircle,
  Calendar,
  Layers,
  Users,
  Building2,
  CreditCard,
  ArrowRightLeft,
  ArrowDownLeft,
  ShoppingBag,
  ExternalLink,
} from "lucide-react";
import AnimatedCurrency from "@/components/ui/AnimatedCurrency";
import {
  formatCpf,
  getEffectiveFinancialDate,
  isWeekendDay,
  getHolidayName,
  isCajuBusinessDay,
  type CajuTransaction,
  type CajuDailyClosing,
  type CajuMovement,
  type CajuMatchDetails,
  type CajuTxType,
  type CajuReconciliationStatus,
} from "@/constants/caju";

export interface CajuStatementSectionProps {
  transactions: CajuTransaction[];
  dailyClosings: CajuDailyClosing[];
  movements: CajuMovement[];
  viewMode: "STATEMENT" | "CLOSINGS";
  selectedDate?: string;
  onSelectDate?: (date: string) => void;
  onOpenImportModal: () => void;
}

/** Formata data/hora ISO no fuso de Brasília (dd/MM/yyyy HH:mm). */
function formatDateTimeBr(iso: string | null | undefined): string {
  if (!iso) return "—";
  try {
    const d = new Date(iso);
    if (isNaN(d.getTime())) return String(iso);
    return d.toLocaleString("pt-BR", {
      timeZone: "America/Sao_Paulo",
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return String(iso);
  }
}

/** Formata YYYY-MM-DD para dd/MM/yyyy. */
function formatDayBr(dateStr: string | null | undefined): string {
  if (!dateStr) return "—";
  const parts = dateStr.split("-");
  if (parts.length === 3) {
    return `${parts[2]}/${parts[1]}/${parts[0]}`;
  }
  return dateStr;
}

/** Extrai data YYYY-MM-DD no fuso de Brasília a partir de ISO. */
function getBrasiliaDateString(iso: string): string {
  try {
    const ms = new Date(iso).getTime() - 3 * 3600_000;
    return new Date(ms).toISOString().slice(0, 10);
  } catch {
    return "";
  }
}

export default function CajuStatementSection({
  transactions,
  dailyClosings,
  movements,
  viewMode,
  selectedDate,
  onSelectDate,
  onOpenImportModal,
}: CajuStatementSectionProps) {
  // Filtros de Extrato
  const [searchQuery, setSearchQuery] = useState("");
  const [typeFilter, setTypeFilter] = useState<"ALL" | CajuTxType>("ALL");
  const [reconcileFilter, setReconcileFilter] = useState<"ALL" | "CONCILIADO" | "SEM_CONCILIACAO">("ALL");
  const [originFilter, setOriginFilter] = useState<"ALL" | "APPLIED" | "HISTORICAL">("ALL");

  // Paginação
  const [page, setPage] = useState(1);
  const pageSize = 50;

  // Modal de Detalhes da Conciliação IA
  const [selectedTx, setSelectedTx] = useState<CajuTransaction | null>(null);

  // Expansão de Fechamentos Diários
  const [expandedClosingDate, setExpandedClosingDate] = useState<string | null>(null);

  // Filtragem de Transações
  const filteredTransactions = useMemo(() => {
    return transactions.filter((tx) => {
      // Busca textual
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        const nameMatch = (tx.collaborator_name || "").toLowerCase().includes(q);
        const cpfMatch = (tx.cpf || "").includes(q.replace(/\D/g, ""));
        const merchantMatch = (tx.merchant || "").toLowerCase().includes(q);
        const advanceMatch = (tx.advance_name || "").toLowerCase().includes(q);
        if (!nameMatch && !cpfMatch && !merchantMatch && !advanceMatch) return false;
      }

      // Tipo de transação
      if (typeFilter !== "ALL" && tx.tx_type !== typeFilter) {
        return false;
      }

      // Conciliação IA (apenas depósitos possuem conciliação válida)
      if (reconcileFilter === "CONCILIADO") {
        if (tx.tx_type !== "DEPOSITO" || tx.reconciliation_status !== "CONCILIADO") return false;
      } else if (reconcileFilter === "SEM_CONCILIACAO") {
        if (tx.tx_type === "DEPOSITO" && tx.reconciliation_status === "CONCILIADO") return false;
      }

      // Marco Zero / Histórico
      if (originFilter === "APPLIED" && !tx.applied_to_balance) return false;
      if (originFilter === "HISTORICAL" && tx.applied_to_balance) return false;

      return true;
    });
  }, [transactions, searchQuery, typeFilter, reconcileFilter, originFilter]);

  // Total de páginas
  const totalPages = Math.max(1, Math.ceil(filteredTransactions.length / pageSize));
  const currentPage = Math.min(page, totalPages);
  const paginatedTransactions = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return filteredTransactions.slice(start, start + pageSize);
  }, [filteredTransactions, currentPage, pageSize]);

  // Métricas agregadas da seleção atual
  const stats = useMemo(() => {
    let totalDeposits = 0;
    let reconciledCount = 0;
    let totalPurchases = 0;
    let totalRescues = 0;
    let sumFiltered = 0;

    for (const tx of filteredTransactions) {
      sumFiltered += tx.amount;
      if (tx.tx_type === "DEPOSITO") {
        totalDeposits++;
        if (tx.reconciliation_status === "CONCILIADO") reconciledCount++;
      } else if (tx.tx_type === "COMPRA") {
        totalPurchases++;
      } else if (tx.tx_type === "RESGATE") {
        totalRescues++;
      }
    }

    return {
      count: filteredTransactions.length,
      sumFiltered,
      totalDeposits,
      reconciledCount,
      totalPurchases,
      totalRescues,
    };
  }, [filteredTransactions]);

  // Transações do dia expandido (na visão Fechamentos - agrupadas pelo dia de liquidação financeira efetiva)
  const dayTransactions = useMemo(() => {
    if (!expandedClosingDate) return [];
    return transactions.filter(
      (t) => getEffectiveFinancialDate(t.occurred_at) === expandedClosingDate
    );
  }, [transactions, expandedClosingDate]);

  return (
    <div className="space-y-4">
      {/* ========================================================
          VISÃO 1: EXTRATO OFICIAL & VALIDADOR IA AUTOMÁTICO
          ======================================================== */}
      {viewMode === "STATEMENT" && (
        <div className="space-y-4">
          {/* Barra de Filtros e Busca */}
          <div
            className="p-4 rounded-2xl border backdrop-blur-xl shadow-lg space-y-3"
            style={{ backgroundColor: "var(--bg-secondary)", borderColor: "var(--surface-border)" }}
          >
            <div className="flex flex-col lg:flex-row items-stretch lg:items-center justify-between gap-3">
              {/* Campo de Busca */}
              <div className="relative flex-1">
                <Search
                  size={15}
                  className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none"
                />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => {
                    setSearchQuery(e.target.value);
                    setPage(1);
                  }}
                  placeholder="Buscar por colaborador, CPF, estabelecimento ou adiantamento..."
                  className="w-full pl-9 pr-8 py-2 rounded-xl text-xs outline-none border focus:border-rose-500 transition-all font-medium"
                  style={{
                    backgroundColor: "var(--bg-card)",
                    borderColor: "var(--surface-border)",
                    color: "var(--text-primary)",
                  }}
                />
                {searchQuery && (
                  <button
                    onClick={() => {
                      setSearchQuery("");
                      setPage(1);
                    }}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white"
                  >
                    <X size={13} />
                  </button>
                )}
              </div>

              {/* Ações Rápidas: Importar CSV */}
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={onOpenImportModal}
                  className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-semibold text-rose-300 hover:text-white bg-rose-500/10 hover:bg-rose-500/20 border border-rose-500/30 hover:border-rose-500/60 shadow-[0_0_12px_rgba(244,63,94,0.12)] transition-all cursor-pointer shrink-0"
                >
                  <Upload size={13} className="text-rose-400" />
                  <span>Importar Extrato CSV</span>
                </button>
              </div>
            </div>

            {/* Linha de Filtros Semânticos */}
            <div className="flex items-center justify-between gap-2 flex-wrap pt-1 border-t border-white/[0.06]">
              <div className="flex items-center gap-1.5 flex-wrap">
                {/* Tipo de Transação */}
                <span className="text-[11px] font-semibold text-slate-400 mr-1 flex items-center gap-1">
                  <Filter size={12} />
                  <span>Tipo:</span>
                </span>
                {(
                  [
                    { key: "ALL", label: "Todas" },
                    { key: "RECARGA", label: "Recargas" },
                    { key: "DEPOSITO", label: "Depósitos" },
                    { key: "COMPRA", label: "Compras" },
                    { key: "RESGATE", label: "Resgates" },
                  ] as const
                ).map((t) => (
                  <button
                    key={t.key}
                    type="button"
                    onClick={() => {
                      setTypeFilter(t.key);
                      setPage(1);
                    }}
                    className={`px-2.5 py-1 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                      typeFilter === t.key
                        ? "bg-rose-500/20 text-rose-300 border border-rose-500/40 shadow-sm"
                        : "text-slate-400 hover:text-white hover:bg-white/5 border border-transparent"
                    }`}
                  >
                    {t.label}
                  </button>
                ))}

                <div className="h-3.5 w-px bg-white/10 mx-1 hidden sm:block" />

                {/* Validador IA */}
                <span className="text-[11px] font-semibold text-slate-400 mr-1 flex items-center gap-1">
                  <Sparkles size={12} className="text-rose-400" />
                  <span>IA:</span>
                </span>
                {(
                  [
                    { key: "ALL", label: "Todos" },
                    { key: "CONCILIADO", label: "Conciliados" },
                    { key: "SEM_CONCILIACAO", label: "Sem Conciliação" },
                  ] as const
                ).map((rf) => (
                  <button
                    key={rf.key}
                    type="button"
                    onClick={() => {
                      setReconcileFilter(rf.key);
                      setPage(1);
                    }}
                    className={`px-2.5 py-1 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                      reconcileFilter === rf.key
                        ? "bg-rose-500/20 text-rose-300 border border-rose-500/40 shadow-sm"
                        : "text-slate-400 hover:text-white hover:bg-white/5 border border-transparent"
                    }`}
                  >
                    {rf.label}
                  </button>
                ))}

                <div className="h-3.5 w-px bg-white/10 mx-1 hidden sm:block" />

                {/* Marco Zero */}
                {(
                  [
                    { key: "ALL", label: "Todos os Marcos" },
                    { key: "APPLIED", label: "Pós-Marco Zero" },
                    { key: "HISTORICAL", label: "Histórico Base" },
                  ] as const
                ).map((of) => (
                  <button
                    key={of.key}
                    type="button"
                    onClick={() => {
                      setOriginFilter(of.key);
                      setPage(1);
                    }}
                    className={`px-2 py-0.5 rounded-md text-[11px] font-medium transition-all cursor-pointer ${
                      originFilter === of.key
                        ? "bg-white/10 text-white border border-white/20"
                        : "text-slate-400 hover:text-slate-200 border border-transparent"
                    }`}
                  >
                    {of.label}
                  </button>
                ))}
              </div>

              {/* Contador Resumido */}
              <div className="text-[11px] text-slate-400 font-mono">
                Exibindo <span className="text-white font-bold">{filteredTransactions.length}</span> de{" "}
                <span className="text-slate-300">{transactions.length}</span> transações
                {stats.totalDeposits > 0 && (
                  <span className="ml-1 text-emerald-400 font-medium">
                    ({stats.reconciledCount}/{stats.totalDeposits} depósitos conc.)
                  </span>
                )}
              </div>
            </div>
          </div>

          {/* Tabela de Transações */}
          <div
            className="rounded-2xl border overflow-hidden backdrop-blur-xl shadow-xl"
            style={{ backgroundColor: "var(--bg-secondary)", borderColor: "var(--surface-border)" }}
          >
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr
                    className="border-b uppercase tracking-wider font-semibold text-[11px]"
                    style={{
                      borderColor: "var(--surface-border)",
                      backgroundColor: "var(--bg-primary)",
                      color: "var(--text-secondary)",
                    }}
                  >
                    <th className="py-3 px-4 font-semibold">Data / Hora</th>
                    <th className="py-3 px-4 font-semibold">Colaborador & CPF</th>
                    <th className="py-3 px-4 font-semibold">Tipo & Origem</th>
                    <th className="py-3 px-4 font-semibold">Impacto Matemático</th>
                    <th className="py-3 px-4 font-semibold text-right">Valor</th>
                    <th className="py-3 px-4 font-semibold text-center">Validador IA</th>
                  </tr>
                </thead>
                <tbody className="divide-y" style={{ borderColor: "var(--surface-border)" }}>
                  {paginatedTransactions.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="py-12 text-center text-slate-400">
                        <div className="flex flex-col items-center justify-center gap-2">
                          <FileCheck2 size={32} className="text-slate-500 opacity-60" />
                          <p className="text-sm font-medium text-slate-300">
                            Nenhuma transação encontrada com os filtros selecionados.
                          </p>
                          <p className="text-xs text-slate-400">
                            Tente ajustar a busca ou limpar os filtros de tipo e status de conciliação.
                          </p>
                        </div>
                      </td>
                    </tr>
                  ) : (
                    paginatedTransactions.map((tx) => {
                      const isDeposit = tx.tx_type === "DEPOSITO";
                      const isRescue = tx.tx_type === "RESGATE";
                      const isPurchase = tx.tx_type === "COMPRA";
                      const isRecharge = tx.tx_type === "RECARGA";
                      const isReconciled = isDeposit && tx.reconciliation_status === "CONCILIADO";

                      return (
                        <tr
                          key={tx.id}
                          className="hover:bg-white/[0.03] transition-colors"
                          style={{ borderColor: "var(--surface-border)" }}
                        >
                          {/* Data/Hora & Tag de Marco */}
                          <td className="py-3.5 px-4 whitespace-nowrap">
                            <div className="flex flex-col gap-1">
                              <span className="font-mono text-slate-200 font-medium">
                                {formatDateTimeBr(tx.occurred_at)}
                              </span>
                              <div>
                                {tx.applied_to_balance ? (
                                  <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-md bg-emerald-500/15 border border-emerald-500/30 text-emerald-400 tracking-tight">
                                    Pós-Marco Zero
                                  </span>
                                ) : (
                                  <span className="text-[10px] font-medium px-1.5 py-0.5 rounded-md bg-slate-500/15 border border-slate-500/30 text-slate-400 tracking-tight">
                                    Histórico Base
                                  </span>
                                )}
                              </div>
                            </div>
                          </td>

                          {/* Colaborador & CPF */}
                          <td className="py-3.5 px-4">
                            <div className="flex flex-col">
                              <span className="font-bold text-white leading-tight">
                                {tx.collaborator_name}
                              </span>
                              <span className="font-mono text-[11px] text-slate-400 mt-0.5">
                                {formatCpf(tx.cpf)}
                              </span>
                            </div>
                          </td>

                          {/* Tipo & Origem */}
                          <td className="py-3.5 px-4 whitespace-nowrap">
                            <div className="flex flex-col gap-0.5">
                              {isDeposit && (
                                <span className="inline-flex items-center gap-1 w-fit px-2 py-0.5 rounded-md text-[11px] font-bold bg-emerald-500/15 border border-emerald-500/30 text-emerald-400">
                                  <CreditCard size={11} />
                                  <span>Depósito</span>
                                </span>
                              )}
                              {isRecharge && (
                                <span className="inline-flex items-center gap-1 w-fit px-2 py-0.5 rounded-md text-[11px] font-bold bg-teal-500/15 border border-teal-500/30 text-teal-300">
                                  <ArrowDownLeft size={11} />
                                  <span>Recarga Pix</span>
                                </span>
                              )}
                              {isRescue && (
                                <span className="inline-flex items-center gap-1 w-fit px-2 py-0.5 rounded-md text-[11px] font-bold bg-amber-500/15 border border-amber-500/30 text-amber-300">
                                  <ArrowRightLeft size={11} />
                                  <span>Resgate: Empresa</span>
                                </span>
                              )}
                              {isPurchase && (
                                <span className="inline-flex items-center gap-1 w-fit px-2 py-0.5 rounded-md text-[11px] font-bold bg-rose-500/15 border border-rose-500/30 text-rose-400">
                                  <ShoppingBag size={11} />
                                  <span>Compra</span>
                                </span>
                              )}
                              {!isDeposit && !isRescue && !isPurchase && (
                                <span className="inline-flex items-center gap-1 w-fit px-2 py-0.5 rounded-md text-[11px] font-bold bg-slate-500/15 border border-slate-500/30 text-slate-400">
                                  <span>{tx.tx_type}</span>
                                </span>
                              )}

                              {/* Subtítulo: Advance Name ou Merchant */}
                              <span className="text-[11px] text-slate-400 truncate max-w-[200px]" title={tx.advance_name || tx.merchant || ""}>
                                {tx.advance_name || tx.merchant || "—"}
                              </span>
                            </div>
                          </td>

                          {/* Impacto Matemático */}
                          <td className="py-3.5 px-4 whitespace-nowrap">
                            {isDeposit && (
                              <span className="text-[11px] font-medium text-emerald-400/90 font-mono">
                                Livre (-) → Cartão (+)
                              </span>
                            )}
                            {isRescue && (
                              <span className="text-[11px] font-medium text-amber-300/90 font-mono">
                                Cartão (-) → Livre (+)
                              </span>
                            )}
                            {isPurchase && (
                              <span className="text-[11px] font-medium text-rose-400/90 font-mono">
                                Cartão (-) • Patrimônio (-)
                              </span>
                            )}
                            {!isDeposit && !isRescue && !isPurchase && (
                              <span className="text-[11px] text-slate-500 font-mono">—</span>
                            )}
                          </td>

                          {/* Valor */}
                          <td className="py-3.5 px-4 text-right whitespace-nowrap">
                            <AnimatedCurrency
                              value={tx.amount}
                              prefix="R$ "
                              className={`text-xs font-bold font-mono ${
                                isDeposit
                                  ? "text-emerald-400"
                                  : isPurchase
                                  ? "text-rose-400"
                                  : isRescue
                                  ? "text-amber-300"
                                  : "text-white"
                              }`}
                            />
                          </td>

                          {/* Coluna Validador IA (Comportamento Limpo) */}
                          <td className="py-3.5 px-4 whitespace-nowrap text-center">
                            {isDeposit ? (
                              isReconciled ? (
                                <div className="inline-flex items-center gap-1.5 justify-center">
                                  <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-emerald-500/15 text-emerald-400 border border-emerald-500/30">
                                    <CheckCircle2 size={11} className="shrink-0" />
                                    <span>Conciliado</span>
                                  </span>
                                  <button
                                    type="button"
                                    onClick={() => setSelectedTx(tx)}
                                    className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg text-[11px] font-semibold bg-rose-500/10 hover:bg-rose-500/20 text-rose-300 border border-rose-500/30 hover:border-rose-500/50 transition-colors cursor-pointer"
                                    title="Ver detalhes da conciliação pela IA"
                                  >
                                    <Sparkles size={11} className="text-rose-400" />
                                    <span>Detalhes</span>
                                  </button>
                                </div>
                              ) : (
                                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium bg-slate-500/15 text-slate-400 border border-slate-500/30">
                                  Sem Conciliação
                                </span>
                              )
                            ) : (
                              <span className="text-xs text-slate-400 font-medium">
                                {isPurchase ? "Uso Cartão" : isRescue ? "Resgate Interno" : "—"}
                              </span>
                            )}
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>

            {/* Rodapé da Tabela: Paginação */}
            {totalPages > 1 && (
              <div
                className="flex items-center justify-between p-3.5 border-t text-xs"
                style={{ borderColor: "var(--surface-border)", backgroundColor: "var(--bg-primary)" }}
              >
                <span className="text-slate-400 font-mono">
                  Página <strong className="text-white">{currentPage}</strong> de{" "}
                  <strong className="text-white">{totalPages}</strong> (
                  {filteredTransactions.length} registros)
                </span>

                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    onClick={() => setPage((p) => Math.max(1, p - 1))}
                    disabled={currentPage === 1}
                    className="p-1.5 rounded-lg border text-slate-400 hover:text-white hover:bg-white/5 disabled:opacity-40 disabled:pointer-events-none transition-colors cursor-pointer"
                    style={{ borderColor: "var(--surface-border)" }}
                    title="Página anterior"
                  >
                    <ChevronLeft size={14} />
                  </button>

                  <div className="flex items-center gap-1">
                    {Array.from({ length: Math.min(5, totalPages) }, (_, idx) => {
                      let pageNumber: number;
                      if (totalPages <= 5) {
                        pageNumber = idx + 1;
                      } else if (currentPage <= 3) {
                        pageNumber = idx + 1;
                      } else if (currentPage >= totalPages - 2) {
                        pageNumber = totalPages - 4 + idx;
                      } else {
                        pageNumber = currentPage - 2 + idx;
                      }

                      return (
                        <button
                          key={pageNumber}
                          type="button"
                          onClick={() => setPage(pageNumber)}
                          className={`w-7 h-7 rounded-lg text-xs font-semibold font-mono transition-all cursor-pointer ${
                            currentPage === pageNumber
                              ? "bg-rose-500/25 text-rose-300 border border-rose-500/50"
                              : "text-slate-400 hover:text-white hover:bg-white/5"
                          }`}
                        >
                          {pageNumber}
                        </button>
                      );
                    })}
                  </div>

                  <button
                    type="button"
                    onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                    disabled={currentPage === totalPages}
                    className="p-1.5 rounded-lg border text-slate-400 hover:text-white hover:bg-white/5 disabled:opacity-40 disabled:pointer-events-none transition-colors cursor-pointer"
                    style={{ borderColor: "var(--surface-border)" }}
                    title="Próxima página"
                  >
                    <ChevronRight size={14} />
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ========================================================
          VISÃO 2: FECHAMENTOS DIÁRIOS OFICIAL CAJU
          ======================================================== */}
      {viewMode === "CLOSINGS" && (
        <div className="space-y-4">
          <div
            className="p-4 rounded-2xl border backdrop-blur-xl shadow-lg flex items-center justify-between gap-3 flex-wrap"
            style={{ backgroundColor: "var(--bg-secondary)", borderColor: "var(--surface-border)" }}
          >
            <div>
              <h3 className="text-sm font-bold text-white flex items-center gap-2">
                <Calendar size={15} className="text-rose-400" />
                <span>Fechamentos Diários Oficial Caju</span>
              </h3>
              <p className="text-xs text-slate-400 mt-0.5">
                Reconstrução contábil diária dos saldos Livre, Colaboradores e Patrimônio Total a partir do Marco Zero.
              </p>
            </div>
            <div className="text-xs font-mono text-slate-400">
              Total de dias registrados: <span className="text-white font-bold">{dailyClosings.length}</span>
            </div>
          </div>

          <div
            className="rounded-2xl border overflow-hidden backdrop-blur-xl shadow-xl"
            style={{ backgroundColor: "var(--bg-secondary)", borderColor: "var(--surface-border)" }}
          >
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr
                    className="border-b uppercase tracking-wider font-semibold text-[11px]"
                    style={{
                      borderColor: "var(--surface-border)",
                      backgroundColor: "var(--bg-primary)",
                      color: "var(--text-secondary)",
                    }}
                  >
                    <th className="py-3 px-4 font-semibold">Data</th>
                    <th className="py-3 px-4 font-semibold text-right">Saldo Inicial (Dia Ant.)</th>
                    <th className="py-3 px-4 font-semibold">Entradas Recarga</th>
                    <th className="py-3 px-4 font-semibold">Depósitos Cartões</th>
                    <th className="py-3 px-4 font-semibold">Resgates Empresa</th>
                    <th className="py-3 px-4 font-semibold">Saídas Compras</th>
                    <th className="py-3 px-4 font-semibold text-right">Saldo em Posse (Livre)</th>
                    <th className="py-3 px-4 font-semibold text-right">Saldo Colaborador</th>
                    <th className="py-3 px-4 font-semibold text-right">Saldo Total do Dia</th>
                    <th className="py-3 px-4 font-semibold text-center">Conciliação IA</th>
                    <th className="py-3 px-3 text-center">Ações</th>
                  </tr>
                </thead>
                <tbody className="divide-y" style={{ borderColor: "var(--surface-border)" }}>
                  {dailyClosings.length === 0 ? (
                    <tr>
                      <td colSpan={11} className="py-12 text-center text-slate-400">
                        Nenhum fechamento diário disponível.
                      </td>
                    </tr>
                  ) : (
                    dailyClosings.map((closing) => {
                      const isExpanded = expandedClosingDate === closing.date;
                      const isSelectedOnTop = selectedDate === closing.date;

                      return (
                        <React.Fragment key={closing.date}>
                          <tr
                            onClick={() => onSelectDate?.(closing.date)}
                            className={`hover:bg-white/[0.04] transition-colors cursor-pointer ${
                              isSelectedOnTop
                                ? "bg-rose-500/[0.08]"
                                : isExpanded
                                ? "bg-white/[0.02]"
                                : ""
                            }`}
                            style={{ borderColor: "var(--surface-border)" }}
                          >
                            {/* Data & Badge Marco */}
                            <td className="py-3.5 px-4 whitespace-nowrap">
                              <div className="flex flex-col gap-1">
                                <div className="flex items-center gap-1.5 flex-wrap">
                                  <span className="font-mono text-white font-bold text-xs">
                                    {formatDayBr(closing.date)}
                                  </span>
                                  {isSelectedOnTop && (
                                    <span className="text-[9px] font-bold uppercase px-1.5 py-0.5 rounded bg-rose-500/30 border border-rose-400/50 text-rose-200">
                                      No Topo
                                    </span>
                                  )}
                                  {closing.isWeekend ? (
                                    <span className="text-[9px] font-bold uppercase px-1.5 py-0.5 rounded bg-slate-800 text-slate-300 border border-slate-700">
                                      Fim de Semana
                                    </span>
                                  ) : closing.isHoliday ? (
                                    <span className="text-[9px] font-bold uppercase px-1.5 py-0.5 rounded bg-purple-900/60 text-purple-200 border border-purple-500/40">
                                      Feriado
                                    </span>
                                  ) : null}
                                </div>
                                <div className="flex items-center gap-1 flex-wrap">
                                  {closing.isWeekend ? (
                                    <span className="text-[10px] font-medium text-slate-400">
                                      Repete saldo anterior (sem mov.)
                                    </span>
                                  ) : closing.isHoliday ? (
                                    <span className="text-[10px] font-medium text-purple-300 truncate max-w-[150px]" title={closing.holidayName}>
                                      {closing.holidayName}
                                    </span>
                                  ) : closing.isHistorical ? (
                                    <span className="text-[10px] font-medium px-1.5 py-0.5 rounded-md bg-slate-500/15 border border-slate-500/30 text-slate-400">
                                      Reconstrução Reversa
                                    </span>
                                  ) : (
                                    <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-md bg-emerald-500/15 border border-emerald-500/30 text-emerald-400">
                                      Pós-Marco Zero
                                    </span>
                                  )}
                                </div>
                              </div>
                            </td>

                            {/* Saldo Inicial (Dia Anterior) */}
                            <td className="py-3.5 px-4 text-right whitespace-nowrap">
                              <div className="flex flex-col items-end">
                                <AnimatedCurrency
                                  value={closing.totalBalanceStart ?? closing.totalBalanceEnd}
                                  prefix="R$ "
                                  className="text-xs font-bold font-mono text-slate-200"
                                />
                                <span className="text-[10px] font-mono text-slate-400">
                                  L: {(closing.freeBalanceStart ?? closing.freeBalanceEnd).toLocaleString("pt-BR", { minimumFractionDigits: 2 })} | C: {(closing.cardsBalanceStart ?? closing.cardsBalanceEnd).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
                                </span>
                              </div>
                            </td>

                            {/* Entradas Recarga */}
                            <td className="py-3.5 px-4 whitespace-nowrap">
                              <AnimatedCurrency
                                value={closing.recharges}
                                prefix="R$ "
                                className={`text-xs font-mono font-medium ${
                                  closing.recharges > 0 ? "text-emerald-400 font-bold" : "text-slate-400"
                                }`}
                              />
                            </td>

                            {/* Depósitos Cartões */}
                            <td className="py-3.5 px-4 whitespace-nowrap">
                              <AnimatedCurrency
                                value={closing.deposits}
                                prefix="R$ "
                                className={`text-xs font-mono font-medium ${
                                  closing.deposits > 0 ? "text-cyan-400 font-bold" : "text-slate-400"
                                }`}
                              />
                            </td>

                            {/* Resgates Empresa */}
                            <td className="py-3.5 px-4 whitespace-nowrap">
                              <AnimatedCurrency
                                value={closing.rescues}
                                prefix="R$ "
                                className={`text-xs font-mono font-medium ${
                                  closing.rescues > 0 ? "text-amber-300 font-bold" : "text-slate-400"
                                }`}
                              />
                            </td>

                            {/* Saídas Compras */}
                            <td className="py-3.5 px-4 whitespace-nowrap">
                              <AnimatedCurrency
                                value={closing.purchases}
                                prefix="R$ "
                                className={`text-xs font-mono font-medium ${
                                  closing.purchases > 0 ? "text-rose-400 font-bold" : "text-slate-400"
                                }`}
                              />
                            </td>

                            {/* Saldo Livre Final do Dia */}
                            <td className="py-3.5 px-4 text-right whitespace-nowrap">
                              <AnimatedCurrency
                                value={closing.freeBalanceEnd}
                                prefix="R$ "
                                className="text-xs font-bold font-mono text-rose-300"
                              />
                            </td>

                            {/* Saldo Cartões Final */}
                            <td className="py-3.5 px-4 text-right whitespace-nowrap">
                              <AnimatedCurrency
                                value={closing.cardsBalanceEnd}
                                prefix="R$ "
                                className="text-xs font-bold font-mono text-purple-300"
                              />
                            </td>

                            {/* Patrimônio Total */}
                            <td className="py-3.5 px-4 text-right whitespace-nowrap">
                              <AnimatedCurrency
                                value={closing.totalBalanceEnd}
                                prefix="R$ "
                                className="text-xs font-bold font-mono text-emerald-400"
                              />
                            </td>

                            {/* Conciliação IA */}
                            <td className="py-3.5 px-4 whitespace-nowrap text-center">
                              {closing.depositsCount > 0 ? (
                                <span
                                  className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold ${
                                    closing.reconciledDeposits === closing.depositsCount
                                      ? "bg-emerald-500/15 text-emerald-400 border border-emerald-500/30"
                                      : "bg-amber-500/15 text-amber-300 border border-amber-500/30"
                                  }`}
                                >
                                  {closing.reconciledDeposits === closing.depositsCount && (
                                    <CheckCircle2 size={11} />
                                  )}
                                  <span>
                                    {closing.reconciledDeposits} / {closing.depositsCount} conc.
                                  </span>
                                </span>
                              ) : (
                                <span className="text-[11px] text-slate-500">—</span>
                              )}
                            </td>

                            {/* Ações: Expandir */}
                            <td
                              className="py-3.5 px-3 whitespace-nowrap text-center"
                              onClick={(e) => e.stopPropagation()}
                            >
                              <button
                                type="button"
                                onClick={() =>
                                  setExpandedClosingDate(isExpanded ? null : closing.date)
                                }
                                className="p-1 rounded-lg hover:bg-white/10 text-slate-400 hover:text-white transition-colors cursor-pointer"
                                title={isExpanded ? "Recolher detalhes" : "Inspecionar transações do dia"}
                              >
                                {isExpanded ? <ChevronUp size={15} /> : <ChevronDown size={15} />}
                              </button>
                            </td>
                          </tr>

                          {/* Linha Expandida com as Transações do Dia */}
                          {isExpanded && (
                            <tr
                              key={`${closing.date}-expanded`}
                              style={{
                                backgroundColor: "rgba(0, 0, 0, 0.25)",
                                borderColor: "var(--surface-border)",
                              }}
                            >
                              <td colSpan={11} className="p-4">
                                <div
                                  className="rounded-xl p-4 border space-y-3"
                                  style={{
                                    backgroundColor: "var(--bg-primary)",
                                    borderColor: "var(--surface-border)",
                                  }}
                                >
                                  <div className="flex items-center justify-between">
                                    <div className="flex items-center gap-2">
                                      <Clock size={14} className="text-rose-400" />
                                      <span className="text-xs font-bold text-white uppercase tracking-wider">
                                        Transações do dia {formatDayBr(closing.date)} ({dayTransactions.length})
                                      </span>
                                    </div>
                                    <span className="text-[11px] text-slate-400 font-mono">
                                      Total do dia: {closing.txCount} eventos
                                    </span>
                                  </div>

                                  {dayTransactions.length === 0 ? (
                                    closing.isWeekend ? (
                                      <div className="py-5 text-center space-y-1 bg-slate-900/60 rounded-xl border border-white/5 p-4">
                                        <p className="text-xs font-semibold text-slate-200">
                                          Fim de Semana — Sem movimentação contábil neste dia.
                                        </p>
                                        <p className="text-[11px] text-slate-400 max-w-lg mx-auto">
                                          O saldo permaneceu exatamente igual ao fechamento de sexta-feira. Todas as compras e depósitos realizados no sábado e domingo foram transferidos e debitados na segunda-feira (próximo dia útil).
                                        </p>
                                      </div>
                                    ) : closing.isHoliday ? (
                                      <div className="py-5 text-center space-y-1 bg-purple-950/30 rounded-xl border border-purple-500/20 p-4">
                                        <p className="text-xs font-semibold text-purple-200">
                                          Feriado Nacional ({closing.holidayName}) — Sem movimentação contábil.
                                        </p>
                                        <p className="text-[11px] text-purple-300/80 max-w-lg mx-auto">
                                          O saldo permaneceu estável. Eventuais transações deste dia foram transferidas para o próximo dia útil seguinte.
                                        </p>
                                      </div>
                                    ) : (
                                      <p className="text-xs text-slate-400 py-3 text-center">
                                        Nenhuma transação individual detalhada carregada para este dia.
                                      </p>
                                    )
                                  ) : (
                                    <div className="overflow-x-auto">
                                      <table className="w-full text-left text-xs border-collapse">
                                        <thead>
                                          <tr className="text-slate-400 border-b border-white/[0.06] text-[10px] uppercase font-semibold">
                                            <th className="py-2 px-3">Data/Hora Real</th>
                                            <th className="py-2 px-3">Colaborador</th>
                                            <th className="py-2 px-3">Tipo</th>
                                            <th className="py-2 px-3">Detalhe</th>
                                            <th className="py-2 px-3 text-right">Valor</th>
                                            <th className="py-2 px-3 text-center">Conciliação IA</th>
                                          </tr>
                                        </thead>
                                        <tbody className="divide-y divide-white/[0.04]">
                                          {dayTransactions.map((tx) => {
                                            const rawDay = getBrasiliaDateString(tx.occurred_at);
                                            const isShiftedFromWeekend = rawDay !== closing.date;
                                            return (
                                              <tr key={tx.id} className="hover:bg-white/[0.02]">
                                                <td className="py-2 px-3 font-mono text-slate-300">
                                                  <div className="flex flex-col">
                                                    <span>{formatDateTimeBr(tx.occurred_at)}</span>
                                                    {isShiftedFromWeekend && (
                                                      <span className="text-[9px] text-amber-300 font-sans font-semibold">
                                                        Feito em {formatDayBr(rawDay)} (transferido do fds)
                                                      </span>
                                                    )}
                                                  </div>
                                                </td>
                                                <td className="py-2 px-3 font-semibold text-white">
                                                  {tx.collaborator_name}
                                                </td>
                                                <td className="py-2 px-3">
                                                  <span
                                                    className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${
                                                      tx.tx_type === "DEPOSITO"
                                                        ? "bg-emerald-500/15 text-emerald-400"
                                                        : tx.tx_type === "RECARGA"
                                                        ? "bg-teal-500/15 text-teal-300"
                                                        : tx.tx_type === "COMPRA"
                                                        ? "bg-rose-500/15 text-rose-400"
                                                        : "bg-amber-500/15 text-amber-300"
                                                    }`}
                                                  >
                                                    {tx.tx_type === "RECARGA" ? "RECARGA" : tx.tx_type}
                                                  </span>
                                                </td>
                                                <td className="py-2 px-3 text-slate-400 truncate max-w-[200px]">
                                                  {tx.advance_name || tx.merchant || "—"}
                                                </td>
                                                <td className="py-2 px-3 text-right font-mono font-bold text-white">
                                                  <AnimatedCurrency value={tx.amount} prefix="R$ " />
                                                </td>
                                                <td className="py-2 px-3 text-center">
                                                  {tx.tx_type === "DEPOSITO" ? (
                                                    tx.reconciliation_status === "CONCILIADO" ? (
                                                      <button
                                                        type="button"
                                                        onClick={() => setSelectedTx(tx)}
                                                        className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-500/15 text-emerald-400 border border-emerald-500/30 hover:bg-emerald-500/25 transition-colors cursor-pointer"
                                                      >
                                                        <Sparkles size={10} />
                                                        <span>Conciliado (IA)</span>
                                                      </button>
                                                    ) : (
                                                      <span className="text-[10px] text-slate-500">
                                                        Sem conciliação
                                                      </span>
                                                    )
                                                  ) : (
                                                    <span className="text-[10px] text-slate-600">—</span>
                                                  )}
                                                </td>
                                              </tr>
                                            );
                                          })}
                                        </tbody>
                                      </table>
                                    </div>
                                  )}
                                </div>
                              </td>
                            </tr>
                          )}
                        </React.Fragment>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================
          MODAL: DETALHES DA CONCILIAÇÃO IA
          (Abre exclusivamente ao clicar em "Detalhes" num depósito)
          ======================================================== */}
      {selectedTx && selectedTx.match_details && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-md animate-in fade-in">
          <div
            className="w-full max-w-2xl rounded-2xl border p-6 shadow-2xl relative space-y-5 animate-in zoom-in-95 max-h-[90vh] overflow-y-auto custom-scrollbar"
            style={{ backgroundColor: "var(--bg-secondary)", borderColor: "var(--surface-border)" }}
          >
            {/* Header do Modal */}
            <div
              className="flex items-start justify-between pb-3 border-b"
              style={{ borderColor: "var(--surface-border)" }}
            >
              <div className="flex items-start gap-3">
                <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-rose-500/20 to-pink-500/20 text-rose-400 flex items-center justify-center shrink-0 border border-rose-500/30">
                  <Sparkles size={20} />
                </div>
                <div>
                  <h3 className="text-base font-bold text-white flex items-center gap-2">
                    <span>Detalhes da Conciliação IA</span>
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-rose-500/20 border border-rose-500/40 text-rose-300">
                      Auditado
                    </span>
                  </h3>
                  <p className="text-xs text-slate-400 mt-0.5 font-mono">
                    Depósito #{selectedTx.id.slice(0, 8)} • Hash #{selectedTx.tx_hash.slice(0, 10)}
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setSelectedTx(null)}
                className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-white/10 transition-colors cursor-pointer"
              >
                <X size={16} />
              </button>
            </div>

            {/* Classificação do Match & Confiança */}
            <div className="flex items-center justify-between gap-3 p-3.5 rounded-xl bg-slate-900/60 border border-white/10 flex-wrap">
              <div className="flex items-center gap-2">
                {selectedTx.match_details.kind === "EXATO" ? (
                  <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-emerald-500/15 border border-emerald-500/40 text-emerald-300">
                    <ShieldCheck size={14} />
                    <span>Convergência Exata</span>
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-amber-500/15 border border-amber-500/40 text-amber-300">
                    <AlertCircle size={14} />
                    <span>Divergência Parcial / Lote Analisado pela IA</span>
                  </span>
                )}

                <span className="text-xs font-mono font-bold text-rose-400 bg-rose-500/10 px-2.5 py-1 rounded-full border border-rose-500/30">
                  {Math.round(selectedTx.match_details.confidence * 100)}% de Confiança
                </span>
              </div>

              {/* Sinais Verificados */}
              <div className="flex items-center gap-1.5 flex-wrap">
                <span
                  className={`text-[10px] font-bold px-2 py-0.5 rounded-md border ${
                    selectedTx.match_details.signals?.name
                      ? "bg-emerald-500/15 border-emerald-500/30 text-emerald-400"
                      : "bg-slate-500/15 border-slate-500/30 text-slate-400"
                  }`}
                >
                  {selectedTx.match_details.signals?.name ? "Nome Verificado" : "Nome Parcial"}
                </span>

                <span
                  className={`text-[10px] font-bold px-2 py-0.5 rounded-md border ${
                    selectedTx.match_details.signals?.date
                      ? "bg-emerald-500/15 border-emerald-500/30 text-emerald-400"
                      : "bg-amber-500/15 border-amber-500/30 text-amber-300"
                  }`}
                >
                  {selectedTx.match_details.signals?.date ? "Data/Horário Convergente" : "Data Flexível"}
                </span>

                <span
                  className={`text-[10px] font-bold px-2 py-0.5 rounded-md border ${
                    selectedTx.match_details.signals?.amount === "EXATO"
                      ? "bg-emerald-500/15 border-emerald-500/30 text-emerald-400"
                      : selectedTx.match_details.signals?.amount === "LOTE"
                      ? "bg-purple-500/15 border-purple-500/30 text-purple-300"
                      : selectedTx.match_details.signals?.amount === "PROXIMO"
                      ? "bg-amber-500/15 border-amber-500/30 text-amber-300"
                      : "bg-rose-500/15 border-rose-500/30 text-rose-300"
                  }`}
                >
                  {selectedTx.match_details.signals?.amount === "EXATO"
                    ? "Valor Exato"
                    : selectedTx.match_details.signals?.amount === "LOTE"
                    ? "Lote Multi-Favorecido"
                    : selectedTx.match_details.signals?.amount === "PROXIMO"
                    ? "Valor Próximo"
                    : "Valor Divergente"}
                </span>

                {selectedTx.match_details.signals?.category && (
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-cyan-500/15 border border-cyan-500/30 text-cyan-300">
                    Categoria Caju
                  </span>
                )}
              </div>
            </div>

            {/* Comparativo: Extrato Caju vs Solicitação Kanban */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Lado Esquerdo: Depósito Caju */}
              <div
                className="p-4 rounded-xl border space-y-2.5"
                style={{ backgroundColor: "var(--bg-primary)", borderColor: "var(--surface-border)" }}
              >
                <div className="flex items-center gap-1.5 text-xs font-bold text-rose-400 uppercase tracking-wider">
                  <CreditCard size={13} />
                  <span>Depósito no Extrato Caju</span>
                </div>

                <div className="space-y-1.5 text-xs">
                  <div>
                    <span className="text-slate-400 block text-[11px]">Colaborador:</span>
                    <strong className="text-white text-sm">{selectedTx.collaborator_name}</strong>
                  </div>
                  <div>
                    <span className="text-slate-400 block text-[11px]">CPF:</span>
                    <span className="font-mono text-slate-300">{formatCpf(selectedTx.cpf)}</span>
                  </div>
                  <div>
                    <span className="text-slate-400 block text-[11px]">Data / Horário do Depósito:</span>
                    <span className="font-mono text-slate-300">{formatDateTimeBr(selectedTx.occurred_at)}</span>
                  </div>
                  <div>
                    <span className="text-slate-400 block text-[11px]">Identificador do Adiantamento:</span>
                    <span className="text-slate-300 font-medium">
                      {selectedTx.advance_name || "Adiantamento Caju"}
                    </span>
                  </div>
                  <div className="pt-1 border-t border-white/[0.06]">
                    <span className="text-slate-400 block text-[11px]">Valor Depositado no Cartão:</span>
                    <AnimatedCurrency
                      value={selectedTx.amount}
                      prefix="R$ "
                      className="text-lg font-extrabold text-emerald-400 font-mono"
                    />
                  </div>
                </div>
              </div>

              {/* Lado Direito: Card Vinculado no Kanban */}
              <div
                className="p-4 rounded-xl border space-y-2.5"
                style={{ backgroundColor: "var(--bg-primary)", borderColor: "var(--surface-border)" }}
              >
                <div className="flex items-center gap-1.5 text-xs font-bold text-purple-400 uppercase tracking-wider">
                  <Layers size={13} />
                  <span>Card Vinculado no Kanban</span>
                </div>

                <div className="space-y-1.5 text-xs">
                  <div>
                    <span className="text-slate-400 block text-[11px]">Título da Solicitação:</span>
                    <strong className="text-white text-sm">
                      {selectedTx.match_details.requestTitle || "Solicitação no Kanban"}
                    </strong>
                  </div>
                  <div>
                    <span className="text-slate-400 block text-[11px]">Identificador do Card:</span>
                    <span className="font-mono text-purple-300 font-bold">
                      #{selectedTx.match_details.requestId?.slice(0, 8)}
                    </span>
                  </div>
                  <div>
                    <span className="text-slate-400 block text-[11px]">Beneficiário Identificado no Card:</span>
                    <span className="text-slate-300 font-medium">
                      {selectedTx.match_details.requestBeneficiary || "Não especificado"}
                    </span>
                  </div>
                  <div className="flex items-center justify-between gap-2">
                    <div>
                      <span className="text-slate-400 block text-[11px]">Status no Kanban:</span>
                      <span className="inline-block mt-0.5 px-2 py-0.5 rounded text-[10px] font-bold bg-purple-500/20 text-purple-300 border border-purple-500/40">
                        {selectedTx.match_details.requestStatus || "FINALIZADO"}
                      </span>
                    </div>
                    {selectedTx.match_details.requestDate && (
                      <div className="text-right">
                        <span className="text-slate-400 block text-[11px]">Data Solicitação:</span>
                        <span className="font-mono text-slate-300 text-[11px]">
                          {formatDateTimeBr(selectedTx.match_details.requestDate).slice(0, 10)}
                        </span>
                      </div>
                    )}
                  </div>
                  <div className="pt-1 border-t border-white/[0.06]">
                    <span className="text-slate-400 block text-[11px]">Valor Total da Solicitação Kanban:</span>
                    <AnimatedCurrency
                      value={selectedTx.match_details.requestAmount}
                      prefix="R$ "
                      className="text-lg font-extrabold text-white font-mono"
                    />
                  </div>
                </div>
              </div>
            </div>

            {/* Detalhe de Lote Agrupado (se 1 card agrupa múltiplos depósitos) */}
            {selectedTx.match_details.group && (
              <div className="p-3.5 rounded-xl bg-purple-950/30 border border-purple-500/30 space-y-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1.5 text-xs font-bold text-purple-300">
                    <Users size={14} />
                    <span>Lote Multi-Colaboradores Agrupado pela IA</span>
                  </div>
                  <span className="text-xs font-mono text-purple-200">
                    {selectedTx.match_details.group.count} depósitos • Soma:{" "}
                    <AnimatedCurrency value={selectedTx.match_details.group.sum} prefix="R$ " />
                  </span>
                </div>
                <div className="flex items-center gap-1.5 flex-wrap">
                  {selectedTx.match_details.group.members.map((member, i) => (
                    <span
                      key={i}
                      className="text-[10px] px-2 py-0.5 rounded-md bg-purple-500/20 border border-purple-500/40 text-purple-200 font-medium"
                    >
                      {member}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {/* Box Destacado de Explicação da IA */}
            <div className="p-4 rounded-xl bg-gradient-to-br from-rose-950/30 via-slate-900/60 to-purple-950/30 border border-rose-500/35 space-y-2">
              <div className="flex items-center gap-2">
                <Sparkles size={15} className="text-rose-400" />
                <span className="text-xs font-bold text-rose-300 uppercase tracking-wider">
                  Parecer do Validador IA:
                </span>
              </div>
              <p className="text-xs text-slate-200 leading-relaxed select-text">
                {selectedTx.match_details.explanation}
              </p>
              {selectedTx.match_details.amountDifference !== 0 && (
                <div className="text-[11px] text-amber-300 font-mono pt-1">
                  Diferença de valor apurada:{" "}
                  <strong>
                    {selectedTx.match_details.amountDifference > 0 ? "+" : ""}
                    <AnimatedCurrency value={selectedTx.match_details.amountDifference} prefix="R$ " />
                  </strong>
                </div>
              )}
            </div>

            {/* Botão de Fechar */}
            <div
              className="flex items-center justify-end pt-3 border-t"
              style={{ borderColor: "var(--surface-border)" }}
            >
              <button
                type="button"
                onClick={() => setSelectedTx(null)}
                className="px-5 py-2.5 rounded-xl text-xs font-semibold text-slate-300 hover:text-white bg-white/5 hover:bg-white/10 transition-colors cursor-pointer"
              >
                Fechar Detalhes
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
