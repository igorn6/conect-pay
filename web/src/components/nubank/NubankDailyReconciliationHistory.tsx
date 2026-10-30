"use client";

import { useEffect, useState } from "react";
import {
  Calendar,
  CheckCircle2,
  AlertTriangle,
  RefreshCw,
  ChevronDown,
  ArrowDownLeft,
  ArrowUpRight,
  FileText,
  ShieldCheck,
  ClipboardCopy,
} from "lucide-react";
import AnimatedCurrency from "@/components/ui/AnimatedCurrency";
import { copyOutflowsToSheets } from "@/utils/exportToGoogleSheets";

interface ReconciliationItem {
  id: string;
  item_date: string;
  amount: number;
  description: string;
  matched: boolean;
}

interface ReconciliationDay {
  id: string;
  reconciliation_date: string;
  system_balance: number;
  statement_balance: number;
  difference: number;
  status: "CONCILIADO" | "DIVERGENTE";
  total_entries: number;
  total_exits: number;
  matched_count: number;
  unmatched_count: number;
  source_file_name?: string;
  created_at: string;
  nubank_statement_items?: ReconciliationItem[];
}

interface NubankDailyReconciliationHistoryProps {
  userId?: string | null;
  refreshTrigger?: number;
  onOpenValidator: () => void;
}

export default function NubankDailyReconciliationHistory({
  userId,
  refreshTrigger,
  onOpenValidator,
}: NubankDailyReconciliationHistoryProps) {
  const [history, setHistory] = useState<ReconciliationDay[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const fetchHistory = async () => {
    try {
      setLoading(true);
      const url = userId
        ? `/api/nubank-balance/reconcile?userId=${encodeURIComponent(userId)}`
        : "/api/nubank-balance/reconcile";
      const res = await fetch(url);
      if (!res.ok) throw new Error("Erro ao carregar conciliações.");
      const json = await res.json();
      setHistory(json.reconciliations || []);
    } catch (e) {
      console.warn("Erro ao buscar histórico de conciliação:", e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchHistory();
  }, [refreshTrigger]);

  const formatBRL = (val: number) =>
    new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(val);

  return (
    <div
      className="rounded-3xl border p-5 md:p-6 shadow-xl space-y-5"
      style={{
        backgroundColor: "var(--bg-secondary)",
        borderColor: "var(--surface-border)",
      }}
    >
      {/* Top Header da Seção */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 pb-4 border-b border-white/[0.08]">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-2xl bg-emerald-500/15 border border-emerald-500/30 text-emerald-400 flex items-center justify-center">
            <ShieldCheck size={20} />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-base font-bold text-white tracking-tight">
                Histórico Diário de Fechamento & Conciliação
              </h3>
              <span className="text-[10px] font-mono font-semibold uppercase px-2 py-0.5 rounded-full bg-emerald-500/15 text-emerald-400 border border-emerald-500/30">
                Oficial
              </span>
            </div>
            <p className="text-xs text-slate-400 mt-0.5">
              Registro auditado dia a dia: Saldo final do Conect Pay vs Saldo oficial do Extrato Nubank.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={fetchHistory}
            disabled={loading}
            className="p-2 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800/60 transition-colors cursor-pointer"
            title="Atualizar histórico"
          >
            <RefreshCw size={14} className={loading ? "animate-spin text-[#c084fc]" : ""} />
          </button>

          <button
            type="button"
            onClick={onOpenValidator}
            className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-purple-600/20 hover:bg-purple-600/30 border border-purple-500/30 text-xs font-semibold text-[#d8b4fe] hover:text-white transition-all cursor-pointer"
          >
            <Calendar size={13} />
            <span>Auditar Novo Extrato</span>
          </button>
        </div>
      </div>

      {/* Tabela do Histórico Diário */}
      {loading && history.length === 0 ? (
        <div className="py-10 text-center space-y-2">
          <RefreshCw size={24} className="animate-spin mx-auto text-[#c084fc]" />
          <p className="text-xs text-slate-400 font-mono">Carregando fechamentos diários...</p>
        </div>
      ) : history.length === 0 ? (
        <div className="py-12 text-center space-y-3 bg-slate-950/30 rounded-2xl border border-white/[0.04]">
          <div className="w-12 h-12 rounded-2xl bg-slate-900 border border-white/10 text-slate-500 flex items-center justify-center mx-auto">
            <Calendar size={22} />
          </div>
          <div>
            <p className="text-sm font-semibold text-slate-300">Nenhum fechamento diário registrado ainda</p>
            <p className="text-xs text-slate-500 mt-1 max-w-md mx-auto">
              Clique em <strong>&quot;Validar Extrato Nubank&quot;</strong> acima, importe o arquivo de 7 dias do banco e registre o fechamento diário oficial.
            </p>
          </div>
          <button
            type="button"
            onClick={onOpenValidator}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-[#820AD1] hover:bg-[#7308bd] text-white text-xs font-bold transition-all cursor-pointer shadow-md shadow-purple-950/40"
          >
            <FileText size={14} />
            <span>Importar Extrato Agora</span>
          </button>
        </div>
      ) : (
        <div className="rounded-2xl border border-white/[0.08] overflow-hidden bg-slate-950/50">
          <div className="overflow-x-auto custom-scrollbar">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-900/90 text-slate-400 font-mono text-[10px] uppercase tracking-wider border-b border-white/[0.08]">
                <tr>
                  <th className="px-5 py-3">Data Fechamento</th>
                  <th className="px-4 py-3 text-right">Saldo Conect Pay</th>
                  <th className="px-4 py-3 text-right">Saldo Extrato Nubank</th>
                  <th className="px-4 py-3 text-right">Diferença</th>
                  <th className="px-4 py-3">Entradas / Saídas</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3 text-center">Itens</th>
                  <th className="px-4 py-3 text-right">Ação</th>
                </tr>
              </thead>
                {history.map((day) => {
                  const isConciliated = day.status === "CONCILIADO";
                  const isExpanded = expandedId === day.id;
                  const dateFormatted = day.reconciliation_date.split("-").reverse().join("/");

                  return (
                    <tbody key={day.id} className="divide-y divide-white/[0.04]">
                      <tr className="group hover:bg-white/[0.02] transition-colors">
                        <td className="px-5 py-3.5 whitespace-nowrap font-mono font-bold text-white flex items-center gap-2">
                          <Calendar size={13} className="text-[#d8b4fe]" />
                          <span>{dateFormatted}</span>
                        </td>

                        <td className="px-4 py-3.5 text-right font-mono font-bold text-white whitespace-nowrap">
                          <AnimatedCurrency value={Number(day.system_balance)} prefix="R$ " />
                        </td>

                        <td className="px-4 py-3.5 text-right font-mono font-bold text-[#d8b4fe] whitespace-nowrap">
                          <AnimatedCurrency value={Number(day.statement_balance)} prefix="R$ " />
                        </td>

                        <td className="px-4 py-3.5 text-right font-mono font-bold whitespace-nowrap">
                          <span className={Math.abs(Number(day.difference)) < 0.01 ? "text-emerald-400" : "text-rose-400"}>
                            {formatBRL(Number(day.difference))}
                          </span>
                        </td>

                        <td className="px-4 py-3.5 whitespace-nowrap font-mono text-[11px]">
                          <span className="text-emerald-400">+{formatBRL(Number(day.total_entries))}</span>
                          <span className="text-slate-500 mx-1">/</span>
                          <span className="text-rose-400">-{formatBRL(Number(day.total_exits))}</span>
                        </td>

                        <td className="px-4 py-3.5 whitespace-nowrap">
                          <span
                            className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-bold ${
                              isConciliated
                                ? "bg-emerald-500/15 text-emerald-400 border border-emerald-500/30"
                                : "bg-rose-500/15 text-rose-400 border border-rose-500/30"
                            }`}
                          >
                            {isConciliated ? <CheckCircle2 size={11} /> : <AlertTriangle size={11} />}
                            <span>{isConciliated ? "Conciliado" : "Divergente"}</span>
                          </span>
                        </td>

                        <td className="px-4 py-3.5 text-center font-mono text-xs text-slate-400 whitespace-nowrap">
                          {day.matched_count} / {day.matched_count + day.unmatched_count}
                        </td>

                        <td className="px-4 py-3.5 text-right whitespace-nowrap">
                          {day.nubank_statement_items && day.nubank_statement_items.length > 0 && (
                            <button
                              type="button"
                              onClick={() => setExpandedId(isExpanded ? null : day.id)}
                              className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800/80 transition-colors cursor-pointer"
                              title="Ver lançamentos deste dia"
                            >
                              <ChevronDown
                                size={14}
                                className={`transition-transform duration-200 ${isExpanded ? "rotate-180" : ""}`}
                              />
                            </button>
                          )}
                        </td>
                      </tr>

                      {isExpanded && day.nubank_statement_items && day.nubank_statement_items.length > 0 && (
                        <tr className="bg-slate-900/60 border-t border-white/[0.06]">
                          <td colSpan={8} className="p-4 sm:p-5">
                            <div className="space-y-3">
                              <div className="flex items-center justify-between flex-wrap gap-2">
                                <div className="flex items-center gap-2">
                                  <span className="text-xs font-mono font-bold text-slate-300 uppercase tracking-wider">
                                    Lançamentos auditados em {dateFormatted} ({day.nubank_statement_items.length} itens)
                                  </span>
                                  {day.source_file_name && (
                                    <span className="text-[10px] font-mono text-slate-500">
                                      • {day.source_file_name}
                                    </span>
                                  )}
                                </div>

                                <button
                                  type="button"
                                  onClick={() => copyOutflowsToSheets(day.nubank_statement_items || [], "Nubank")}
                                  className="inline-flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-semibold text-purple-300 hover:text-white bg-purple-500/10 hover:bg-purple-500/20 border border-purple-500/30 hover:border-purple-500/60 transition-all cursor-pointer shadow-sm"
                                  title="Copiar saídas auditadas deste dia para colar na coluna A da planilha Google Sheets"
                                >
                                  <ClipboardCopy size={13} className="text-purple-400" />
                                  <span>📋 Copiar Lançamentos do Dia ({day.nubank_statement_items.length})</span>
                                </button>
                              </div>
                              <div className="rounded-xl border border-white/[0.06] overflow-hidden divide-y divide-white/[0.04]">
                                {day.nubank_statement_items.map((it) => (
                                  <div
                                    key={it.id}
                                    className="p-2.5 flex items-center justify-between text-xs hover:bg-white/[0.02]"
                                  >
                                    <div className="flex items-center gap-2 max-w-md truncate">
                                      <span
                                        className={`w-2 h-2 rounded-full shrink-0 ${
                                          it.matched ? "bg-emerald-400" : "bg-rose-400"
                                        }`}
                                      />
                                      <span className="text-white font-medium truncate" title={it.description}>
                                        {it.description}
                                      </span>
                                    </div>

                                    <div className="flex items-center gap-3 shrink-0">
                                      <span
                                        className={`font-mono font-bold ${
                                          it.amount > 0 ? "text-emerald-400" : "text-rose-400"
                                        }`}
                                      >
                                        {it.amount > 0 ? "+" : ""}
                                        {formatBRL(Number(it.amount))}
                                      </span>

                                      <span
                                        className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                                          it.matched
                                            ? "bg-emerald-500/15 text-emerald-400 border border-emerald-500/30"
                                            : "bg-rose-500/15 text-rose-400 border border-rose-500/30"
                                        }`}
                                      >
                                        {it.matched ? "Conciliado" : "Não Lançado"}
                                      </span>
                                    </div>
                                  </div>
                                ))}
                              </div>
                            </div>
                          </td>
                        </tr>
                      )}
                    </tbody>
                  );
                })}
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
