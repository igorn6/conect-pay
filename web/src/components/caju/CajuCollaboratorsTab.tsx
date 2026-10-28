"use client";

import { useState, useMemo } from "react";
import {
  Search,
  SlidersHorizontal,
  Users,
  CreditCard,
  UserCheck,
  UserX,
  ArrowUpDown,
  X,
  Sparkles,
  AlertCircle,
  CheckCircle2,
} from "lucide-react";
import type { CajuCollaborator } from "@/constants/caju";
import { formatCpf, normalizeCpf } from "@/constants/caju";
import AnimatedCurrency from "@/components/ui/AnimatedCurrency";
import { supabase } from "@/lib/supabase";

export interface CajuCollaboratorsTabProps {
  collaborators: CajuCollaborator[];
  cardsBalance: number;
  isMaster: boolean;
  userId: string | null;
  onDataUpdated: (hub?: any) => void;
}

type FilterType = "ALL" | "POSITIVE" | "ZERO";
type SortType = "BALANCE_DESC" | "NAME_ASC";

export default function CajuCollaboratorsTab({
  collaborators,
  cardsBalance,
  isMaster,
  userId,
  onDataUpdated,
}: CajuCollaboratorsTabProps) {
  const [searchTerm, setSearchTerm] = useState("");
  const [filter, setFilter] = useState<FilterType>("ALL");
  const [sortBy, setSortBy] = useState<SortType>("BALANCE_DESC");

  // Estado do Modal de Ajuste (exclusivo Master)
  const [adjustCollab, setAdjustCollab] = useState<CajuCollaborator | null>(null);
  const [newBalanceInput, setNewBalanceInput] = useState("");
  const [reason, setReason] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [adjustError, setAdjustError] = useState<string | null>(null);

  // Contagens para a barra de resumo e filtros
  const countTotal = collaborators.length;
  const countPositive = useMemo(
    () => collaborators.filter((c) => (c.balance || 0) > 0).length,
    [collaborators]
  );
  const countZero = useMemo(
    () => collaborators.filter((c) => (c.balance || 0) <= 0).length,
    [collaborators]
  );

  // Filtragem e Ordenação
  const filteredCollaborators = useMemo(() => {
    let list = [...collaborators];

    // Filtro por status de saldo
    if (filter === "POSITIVE") {
      list = list.filter((c) => (c.balance || 0) > 0);
    } else if (filter === "ZERO") {
      list = list.filter((c) => (c.balance || 0) <= 0);
    }

    // Filtro de busca (Nome ou CPF com/sem pontuação)
    const cleanSearch = searchTerm.trim().toLowerCase();
    if (cleanSearch) {
      const searchDigits = cleanSearch.replace(/\D/g, "");
      list = list.filter((c) => {
        const nameMatch = (c.name || "").toLowerCase().includes(cleanSearch);
        const cpfRawMatch = searchDigits && (c.cpf || "").includes(searchDigits);
        const cpfFormattedMatch = formatCpf(c.cpf).toLowerCase().includes(cleanSearch);
        return nameMatch || cpfRawMatch || cpfFormattedMatch;
      });
    }

    // Ordenação
    if (sortBy === "BALANCE_DESC") {
      list.sort((a, b) => (b.balance || 0) - (a.balance || 0) || a.name.localeCompare(b.name, "pt-BR"));
    } else if (sortBy === "NAME_ASC") {
      list.sort((a, b) => a.name.localeCompare(b.name, "pt-BR"));
    }

    return list;
  }, [collaborators, filter, searchTerm, sortBy]);

  // Helpers de formatação e avatar
  const getInitials = (name: string) => {
    const parts = (name || "").trim().split(/\s+/).filter(Boolean);
    if (parts.length === 0) return "C";
    if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
    return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
  };

  const handleAmountInput = (val: string) => {
    const digits = val.replace(/\D/g, "");
    if (!digits) {
      setNewBalanceInput("");
      return;
    }
    const num = parseInt(digits, 10) / 100;
    setNewBalanceInput(
      num.toLocaleString("pt-BR", {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      })
    );
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

  // Abrir Modal de Ajuste
  const handleOpenAdjust = (collab: CajuCollaborator) => {
    setAdjustCollab(collab);
    setNewBalanceInput(
      (collab.balance || 0).toLocaleString("pt-BR", {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      })
    );
    setReason("");
    setAdjustError(null);
  };

  // Submeter Ajuste do Colaborador
  const handleSubmitAdjust = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!adjustCollab) return;

    setAdjustError(null);
    const parsedNumber = parseCurrencyInput(newBalanceInput);

    if (!Number.isFinite(parsedNumber) || parsedNumber < 0) {
      setAdjustError("Informe um saldo válido (maior ou igual a zero).");
      return;
    }

    const trimmedReason = reason.trim();
    if (!trimmedReason) {
      setAdjustError("A justificativa/motivo do ajuste é obrigatória.");
      return;
    }

    try {
      setSubmitting(true);
      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData?.session?.access_token;
      const headers: Record<string, string> = { "Content-Type": "application/json" };
      if (token) headers["Authorization"] = `Bearer ${token}`;
      if (userId) headers["x-user-id"] = userId;

      const res = await fetch("/api/caju/adjust", {
        method: "POST",
        headers,
        body: JSON.stringify({
          target: "COLLABORATOR",
          collaboratorId: adjustCollab.id,
          newBalance: parsedNumber,
          reason: trimmedReason,
          userId,
        }),
      });

      const resJson = await res.json();
      if (!res.ok) {
        throw new Error(resJson.error || "Falha ao ajustar saldo do colaborador.");
      }

      onDataUpdated(resJson);
      setAdjustCollab(null);
    } catch (err: any) {
      setAdjustError(err.message || "Erro inesperado ao salvar ajuste.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* 1. Header Summary Bar */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Total Colaboradores */}
        <div
          className="p-4 rounded-2xl border transition-all hover:border-rose-500/30"
          style={{ backgroundColor: "var(--bg-secondary)", borderColor: "var(--surface-border)" }}
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-slate-400">Total Colaboradores</span>
            <div className="w-8 h-8 rounded-lg bg-rose-500/10 text-rose-400 flex items-center justify-center border border-rose-500/20">
              <Users size={16} />
            </div>
          </div>
          <p className="text-2xl font-bold text-white mt-2 tabular-nums">{countTotal}</p>
          <p className="text-xs text-slate-500 mt-0.5">Cadastrados no Hub Caju</p>
        </div>

        {/* Com Saldo > 0 */}
        <div
          className="p-4 rounded-2xl border transition-all hover:border-emerald-500/30"
          style={{ backgroundColor: "var(--bg-secondary)", borderColor: "var(--surface-border)" }}
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-slate-400">Com Saldo Ativo</span>
            <div className="w-8 h-8 rounded-lg bg-emerald-500/10 text-emerald-400 flex items-center justify-center border border-emerald-500/20">
              <UserCheck size={16} />
            </div>
          </div>
          <p className="text-2xl font-bold text-emerald-400 mt-2 tabular-nums">{countPositive}</p>
          <p className="text-xs text-slate-500 mt-0.5">Saldo &gt; R$ 0,00 nos cartões</p>
        </div>

        {/* Zerados */}
        <div
          className="p-4 rounded-2xl border transition-all hover:border-slate-600"
          style={{ backgroundColor: "var(--bg-secondary)", borderColor: "var(--surface-border)" }}
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-slate-400">Cartões Zerados</span>
            <div className="w-8 h-8 rounded-lg bg-white/5 text-slate-400 flex items-center justify-center border border-white/10">
              <UserX size={16} />
            </div>
          </div>
          <p className="text-2xl font-bold text-slate-400 mt-2 tabular-nums">{countZero}</p>
          <p className="text-xs text-slate-500 mt-0.5">Sem saldo remanescente</p>
        </div>

        {/* Saldo Total em Cartões */}
        <div
          className="p-4 rounded-2xl border bg-gradient-to-br from-rose-950/20 via-transparent to-emerald-950/20 transition-all hover:border-rose-500/40"
          style={{ backgroundColor: "var(--bg-secondary)", borderColor: "var(--surface-border)" }}
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-slate-400">Soma Total nos Cartões</span>
            <div className="w-8 h-8 rounded-lg bg-emerald-500/15 text-emerald-400 flex items-center justify-center border border-emerald-500/30">
              <CreditCard size={16} />
            </div>
          </div>
          <div className="text-2xl font-bold text-emerald-400 mt-2">
            <AnimatedCurrency value={cardsBalance} className="text-emerald-400" />
          </div>
          <p className="text-xs text-slate-500 mt-0.5">Disponível com os colaboradores</p>
        </div>
      </div>

      {/* 2. Barra de Ferramentas: Busca, Filtros e Ordenação */}
      <div
        className="p-4 rounded-2xl border space-y-3 sm:space-y-0 sm:flex sm:items-center sm:justify-between sm:gap-4"
        style={{ backgroundColor: "var(--bg-secondary)", borderColor: "var(--surface-border)" }}
      >
        {/* Campo de Busca */}
        <div className="relative flex-1 min-w-[240px] max-w-md">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Buscar por nome ou CPF..."
            className="w-full pl-9 pr-8 py-2 rounded-xl text-xs sm:text-sm bg-black/40 border text-white placeholder-slate-500 focus:outline-none focus:border-rose-500/60 transition-all"
            style={{ borderColor: "var(--surface-border)" }}
          />
          {searchTerm && (
            <button
              onClick={() => setSearchTerm("")}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white p-1 rounded-md"
            >
              <X size={14} />
            </button>
          )}
        </div>

        {/* Filtros e Ordenação */}
        <div className="flex items-center gap-2 flex-wrap">
          {/* Pills de Filtro */}
          <div className="flex items-center gap-1 p-1 rounded-xl bg-black/40 border border-white/5">
            <button
              type="button"
              onClick={() => setFilter("ALL")}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all cursor-pointer ${
                filter === "ALL"
                  ? "bg-rose-500 text-white shadow-sm"
                  : "text-slate-400 hover:text-white hover:bg-white/5"
              }`}
            >
              Todos <span className="opacity-75 text-[11px]">({countTotal})</span>
            </button>

            <button
              type="button"
              onClick={() => setFilter("POSITIVE")}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all cursor-pointer ${
                filter === "POSITIVE"
                  ? "bg-emerald-600 text-white shadow-sm"
                  : "text-slate-400 hover:text-white hover:bg-white/5"
              }`}
            >
              Com Saldo &gt; 0 <span className="opacity-75 text-[11px]">({countPositive})</span>
            </button>

            <button
              type="button"
              onClick={() => setFilter("ZERO")}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all cursor-pointer ${
                filter === "ZERO"
                  ? "bg-slate-700 text-white shadow-sm"
                  : "text-slate-400 hover:text-white hover:bg-white/5"
              }`}
            >
              Zerados <span className="opacity-75 text-[11px]">({countZero})</span>
            </button>
          </div>

          {/* Seletor de Ordenação */}
          <div className="flex items-center gap-1.5 bg-black/40 border border-white/5 px-2.5 py-1.5 rounded-xl text-xs text-slate-300">
            <ArrowUpDown size={13} className="text-rose-400" />
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as SortType)}
              className="bg-transparent text-xs text-white focus:outline-none cursor-pointer pr-1"
            >
              <option value="BALANCE_DESC" className="bg-[#18181b] text-white">
                Maior Saldo
              </option>
              <option value="NAME_ASC" className="bg-[#18181b] text-white">
                Nome (A–Z)
              </option>
            </select>
          </div>
        </div>
      </div>

      {/* 3. Tabela Responsiva de Colaboradores */}
      <div
        className="rounded-2xl border overflow-hidden shadow-xl"
        style={{ backgroundColor: "var(--bg-secondary)", borderColor: "var(--surface-border)" }}
      >
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs sm:text-sm">
            <thead>
              <tr
                className="border-b uppercase text-[11px] font-semibold tracking-wider text-slate-400"
                style={{ backgroundColor: "rgba(0, 0, 0, 0.25)", borderColor: "var(--surface-border)" }}
              >
                <th className="py-3.5 px-4 w-12 text-center">#</th>
                <th className="py-3.5 px-4">Colaborador</th>
                <th className="py-3.5 px-4">CPF</th>
                <th className="py-3.5 px-4 hidden md:table-cell">Participação</th>
                <th className="py-3.5 px-4 text-right">Saldo Atual</th>
                {isMaster && <th className="py-3.5 px-4 text-right w-24">Ações</th>}
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {filteredCollaborators.length === 0 ? (
                <tr>
                  <td
                    colSpan={isMaster ? 6 : 5}
                    className="py-12 text-center text-slate-400"
                  >
                    <div className="flex flex-col items-center justify-center gap-2">
                      <div className="w-10 h-10 rounded-full bg-white/5 flex items-center justify-center text-slate-500">
                        <Users size={18} />
                      </div>
                      <p className="font-medium text-slate-300">Nenhum colaborador encontrado</p>
                      <p className="text-xs text-slate-500">
                        Ajuste o termo de busca ou os filtros de saldo.
                      </p>
                    </div>
                  </td>
                </tr>
              ) : (
                filteredCollaborators.map((collab, index) => {
                  const balanceVal = Number(collab.balance || 0);
                  const isPositive = balanceVal > 0;
                  const sharePercent = cardsBalance > 0 ? (balanceVal / cardsBalance) * 100 : 0;
                  const initials = getInitials(collab.name);

                  return (
                    <tr
                      key={collab.id || collab.cpf}
                      className="hover:bg-white/[0.03] transition-colors group"
                    >
                      {/* Posição # */}
                      <td className="py-3.5 px-4 text-center font-mono text-xs text-slate-500">
                        {String(index + 1).padStart(2, "0")}
                      </td>

                      {/* Colaborador: Avatar + Nome + Badge */}
                      <td className="py-3.5 px-4">
                        <div className="flex items-center gap-3">
                          <div
                            className={`w-9 h-9 rounded-xl flex items-center justify-center font-bold text-xs shrink-0 border ${
                              isPositive
                                ? "bg-gradient-to-br from-rose-500/20 to-orange-500/20 text-rose-300 border-rose-500/30"
                                : "bg-white/5 text-slate-400 border-white/10"
                            }`}
                          >
                            {initials}
                          </div>
                          <div className="min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="font-semibold text-white truncate max-w-[220px] sm:max-w-xs md:max-w-sm">
                                {collab.name}
                              </span>
                              {!collab.is_seed && (
                                <span className="inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-full bg-rose-500/15 text-rose-300 border border-rose-500/30">
                                  Auto-cadastrado CSV
                                </span>
                              )}
                            </div>
                            <span className="text-[11px] text-slate-400 md:hidden font-mono mt-0.5 block">
                              {formatCpf(collab.cpf)}
                            </span>
                          </div>
                        </div>
                      </td>

                      {/* CPF */}
                      <td className="py-3.5 px-4 font-mono text-xs text-slate-400 whitespace-nowrap">
                        {formatCpf(collab.cpf)}
                      </td>

                      {/* Participação (% do total) */}
                      <td className="py-3.5 px-4 hidden md:table-cell">
                        <div className="flex items-center gap-2 max-w-[160px]">
                          <div className="flex-1 bg-white/10 rounded-full h-1.5 overflow-hidden">
                            <div
                              className="h-full bg-gradient-to-r from-rose-500 to-emerald-400 rounded-full transition-all duration-500"
                              style={{ width: `${Math.min(100, Math.max(0, sharePercent))}%` }}
                            />
                          </div>
                          <span className="text-xs font-mono text-slate-400 w-11 text-right tabular-nums">
                            {sharePercent.toFixed(1)}%
                          </span>
                        </div>
                      </td>

                      {/* Saldo Atual */}
                      <td className="py-3.5 px-4 text-right whitespace-nowrap">
                        <AnimatedCurrency
                          value={balanceVal}
                          className={`font-semibold text-xs sm:text-sm ${
                            isPositive ? "text-emerald-400" : "text-slate-400"
                          }`}
                        />
                      </td>

                      {/* Ações (Apenas Master) */}
                      {isMaster && (
                        <td className="py-3.5 px-4 text-right whitespace-nowrap">
                          <button
                            type="button"
                            onClick={() => handleOpenAdjust(collab)}
                            className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium text-slate-300 hover:text-white bg-white/5 hover:bg-rose-500/20 border border-white/10 hover:border-rose-500/40 transition-all cursor-pointer"
                            title="Ajustar saldo do colaborador"
                          >
                            <SlidersHorizontal size={13} className="text-rose-400" />
                            <span>Ajustar</span>
                          </button>
                        </td>
                      )}
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* 4. Modal de Ajuste de Saldo de Colaborador (Exclusivo Master) */}
      {adjustCollab && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-md animate-in fade-in">
          <div
            className="w-full max-w-md rounded-2xl border p-6 shadow-2xl relative space-y-4 animate-in zoom-in-95"
            style={{ backgroundColor: "var(--bg-secondary)", borderColor: "var(--surface-border)" }}
          >
            {/* Header Modal */}
            <div className="flex items-start justify-between pb-3 border-b border-white/10">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-rose-500/20 text-rose-400 flex items-center justify-center shrink-0 border border-rose-500/30">
                  <SlidersHorizontal size={20} />
                </div>
                <div>
                  <h3 className="text-base font-bold text-white">Ajustar Saldo de Colaborador</h3>
                  <p className="text-xs text-slate-400 mt-0.5">
                    Perfil Master &bull; Auditoria registrada em caju_movements
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setAdjustCollab(null)}
                className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-white/10 transition-colors cursor-pointer"
              >
                <X size={16} />
              </button>
            </div>

            {/* Informações do Colaborador */}
            <div
              className="p-3.5 rounded-xl border space-y-1.5"
              style={{ backgroundColor: "var(--bg-primary)", borderColor: "var(--surface-border)" }}
            >
              <div className="flex items-center justify-between text-xs">
                <span className="text-slate-400">Colaborador:</span>
                <span className="font-semibold text-white truncate max-w-[200px]">
                  {adjustCollab.name}
                </span>
              </div>
              <div className="flex items-center justify-between text-xs">
                <span className="text-slate-400">CPF:</span>
                <span className="font-mono text-slate-300">{formatCpf(adjustCollab.cpf)}</span>
              </div>
              <div className="flex items-center justify-between text-xs pt-1 border-t border-white/5">
                <span className="text-slate-400">Saldo Atual no Cartão:</span>
                <AnimatedCurrency
                  value={adjustCollab.balance}
                  className="font-bold text-emerald-400"
                />
              </div>
            </div>

            {/* Formulário */}
            <form onSubmit={handleSubmitAdjust} className="space-y-4">
              {/* Novo Saldo */}
              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1.5">
                  Novo Saldo Desejado (R$) *
                </label>
                <div className="relative">
                  <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 font-medium text-xs sm:text-sm">
                    R$
                  </span>
                  <input
                    type="text"
                    value={newBalanceInput}
                    onChange={(e) => handleAmountInput(e.target.value)}
                    placeholder="0,00"
                    required
                    className="w-full pl-10 pr-4 py-2.5 rounded-xl text-sm font-semibold bg-black/40 border text-white placeholder-slate-500 focus:outline-none focus:border-rose-500 transition-all font-mono"
                    style={{ borderColor: "var(--surface-border)" }}
                  />
                </div>
              </div>

              {/* Justificativa Obrigatória */}
              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1.5">
                  Motivo / Justificativa do Ajuste *
                </label>
                <textarea
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  placeholder="Ex: Conciliação manual pós-resgate, acerto de despesa presencial..."
                  rows={3}
                  required
                  className="w-full px-3.5 py-2.5 rounded-xl text-xs sm:text-sm bg-black/40 border text-white placeholder-slate-500 focus:outline-none focus:border-rose-500 transition-all resize-none"
                  style={{ borderColor: "var(--surface-border)" }}
                />
              </div>

              {/* Erro */}
              {adjustError && (
                <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs flex items-center gap-2">
                  <AlertCircle size={15} className="shrink-0 text-rose-400" />
                  <span>{adjustError}</span>
                </div>
              )}

              {/* Botões */}
              <div className="flex items-center justify-end gap-3 pt-2 border-t border-white/10">
                <button
                  type="button"
                  onClick={() => setAdjustCollab(null)}
                  disabled={submitting}
                  className="px-4 py-2.5 rounded-xl text-xs font-semibold text-slate-400 hover:text-white hover:bg-white/10 transition-colors cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={submitting || !newBalanceInput || !reason.trim()}
                  className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-gradient-to-r from-rose-600 to-pink-600 hover:from-rose-500 hover:to-pink-500 text-white font-bold text-xs shadow-md transition-all disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
                >
                  {submitting ? (
                    <>
                      <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                      <span>Salvando...</span>
                    </>
                  ) : (
                    <>
                      <CheckCircle2 size={15} />
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
