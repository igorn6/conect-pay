"use client";

import { useState, useEffect } from "react";
import {
  Plus, Trash2, Loader2, Tags, Search, Sparkles, CheckCircle2,
  XCircle, ArrowRight, RefreshCw, AlertCircle, Wand2, HelpCircle
} from "lucide-react";
import { supabase } from "@/lib/supabase";
import type { Category, CategorySuggestion } from "@/types/database";

interface SweepResult {
  id: string;
  title: string;
  notes?: string;
  amount: number;
  currentCategory: string;
  suggestedCategory: string;
  isNewCategory: boolean;
  suggestedNewCategoryName?: string;
  confidence: number;
  reason: string;
}

export default function SettingsCategories() {
  const [activeTab, setActiveTab] = useState<"CATEGORIES" | "AI_SUGGESTIONS">("CATEGORIES");

  // Categorias normais
  const [categories, setCategories] = useState<Category[]>([]);
  const [newCatName, setNewCatName] = useState("");
  const [catLoading, setCatLoading] = useState(false);
  const [catSearch, setCatSearch] = useState("");
  const [isFetching, setIsFetching] = useState(true);

  // Sugestões da IA
  const [suggestions, setSuggestions] = useState<CategorySuggestion[]>([]);
  const [isFetchingSuggestions, setIsFetchingSuggestions] = useState(false);
  const [actionLoadingId, setActionLoadingId] = useState<string | null>(null);
  const [mergeTargetCat, setMergeTargetCat] = useState<Record<string, string>>({});

  // Varredura de "Outros"
  const [isSweepModalOpen, setIsSweepModalOpen] = useState(false);
  const [isSweeping, setIsSweeping] = useState(false);
  const [sweepResults, setSweepResults] = useState<SweepResult[]>([]);
  const [isApplyingSweep, setIsApplyingSweep] = useState(false);

  useEffect(() => {
    fetchCategories();
    fetchSuggestions();
  }, []);

  const fetchCategories = async () => {
    setIsFetching(true);
    const { data } = await supabase
      .from("categories")
      .select("*")
      .eq("is_deleted", false)
      .order("name");
    if (data) setCategories(data as Category[]);
    setIsFetching(false);
  };

  const fetchSuggestions = async () => {
    setIsFetchingSuggestions(true);
    try {
      const res = await fetch("/api/categories/suggestions?status=PENDENTE");
      if (res.ok) {
        const data = await res.json();
        setSuggestions(data || []);
      }
    } catch (e) {
      console.error("Erro ao buscar sugestões:", e);
    } finally {
      setIsFetchingSuggestions(false);
    }
  };

  const handleAddCategory = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newCatName.trim()) return;
    setCatLoading(true);
    const { error } = await supabase.from("categories").insert([{ name: newCatName.trim() }]);
    if (error) {
      alert("Erro ao adicionar categoria: " + error.message);
      console.error(error);
    }
    setNewCatName("");
    await fetchCategories();
    setCatLoading(false);
  };

  const handleDeleteCategory = async (id: string) => {
    if (!window.confirm("Atenção: Deseja realmente remover esta categoria?")) return;
    setCatLoading(true);
    await supabase.from("categories").update({ is_deleted: true }).eq("id", id);
    await fetchCategories();
    setCatLoading(false);
  };

  // Ações de aprovação/rejeição de sugestões
  const handleSuggestionAction = async (
    suggestionId: string,
    action: "APPROVE" | "REJECT" | "MERGE"
  ) => {
    try {
      setActionLoadingId(suggestionId);
      const targetCategoryName = mergeTargetCat[suggestionId];

      if (action === "MERGE" && !targetCategoryName) {
        alert("Selecione a categoria existente com a qual deseja mesclar.");
        setActionLoadingId(null);
        return;
      }

      const res = await fetch("/api/categories/suggestions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          suggestionId,
          action,
          targetCategoryName: action === "MERGE" ? targetCategoryName : undefined,
        }),
      });

      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Erro ao processar sugestão");

      // Atualiza listas
      await Promise.all([fetchCategories(), fetchSuggestions()]);
    } catch (e: any) {
      alert(e.message || "Erro ao processar sugestão");
    } finally {
      setActionLoadingId(null);
    }
  };

  // Iniciar varredura de "Outros" com IA (Dry Run)
  const handleStartSweep = async () => {
    try {
      setIsSweepModalOpen(true);
      setIsSweeping(true);
      setSweepResults([]);

      const res = await fetch("/api/ai/sweep", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ apply: false }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Erro na varredura");

      setSweepResults(data.results || []);
    } catch (e: any) {
      alert("Falha na varredura: " + e.message);
    } finally {
      setIsSweeping(false);
    }
  };

  // Aplicar resultados da varredura
  const handleApplySweep = async () => {
    if (!window.confirm(`Deseja aplicar a categorização com IA em todas as ${sweepResults.length} despesas?`)) {
      return;
    }

    try {
      setIsApplyingSweep(true);
      const res = await fetch("/api/ai/sweep", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ apply: true }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Erro ao aplicar varredura");

      alert(`Sucesso! ${data.totalProcessed} solicitações reclassificadas pela IA.`);
      setIsSweepModalOpen(false);
      await Promise.all([fetchCategories(), fetchSuggestions()]);
    } catch (e: any) {
      alert("Erro ao aplicar: " + e.message);
    } finally {
      setIsApplyingSweep(false);
    }
  };

  const filteredCategories = categories.filter((c) =>
    c.name.toLowerCase().includes(catSearch.toLowerCase())
  );

  return (
    <div className="animate-in fade-in slide-in-from-bottom-2 duration-300">
      {/* Top Header */}
      <div className="mb-6 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white mb-1">Categorias & Inteligência Artificial</h1>
          <p className="text-slate-400 text-sm">
            Gerenciamento de categorias, sugestões automáticas do Gemini e reclassificação de custos.
          </p>
        </div>

        <button
          onClick={handleStartSweep}
          className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-gradient-to-r from-indigo-500 to-purple-600 hover:from-indigo-600 hover:to-purple-700 text-white font-semibold text-sm shadow-lg shadow-indigo-500/20 hover:shadow-indigo-500/30 transition-all cursor-pointer shrink-0"
          title="Analisar e reclassificar todas as solicitações cadastradas em 'Outros'"
        >
          <Sparkles size={16} />
          <span>Varredura com IA ("Outros")</span>
        </button>
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-2 mb-4 border-b border-slate-800 pb-2">
        <button
          onClick={() => setActiveTab("CATEGORIES")}
          className={`px-4 py-2 rounded-lg text-sm font-semibold transition-all flex items-center gap-2 ${
            activeTab === "CATEGORIES"
              ? "bg-slate-800 text-white border border-slate-700"
              : "text-slate-400 hover:text-slate-200"
          }`}
        >
          <Tags size={16} />
          <span>Categorias Ativas ({categories.length})</span>
        </button>

        <button
          onClick={() => setActiveTab("AI_SUGGESTIONS")}
          className={`px-4 py-2 rounded-lg text-sm font-semibold transition-all flex items-center gap-2 ${
            activeTab === "AI_SUGGESTIONS"
              ? "bg-indigo-500/20 text-indigo-300 border border-indigo-500/30"
              : "text-slate-400 hover:text-slate-200"
          }`}
        >
          <Sparkles size={16} className="text-indigo-400" />
          <span>Sugestões da IA</span>
          {suggestions.length > 0 && (
            <span className="px-2 py-0.5 text-xs font-bold rounded-full bg-indigo-500 text-white">
              {suggestions.length}
            </span>
          )}
        </button>
      </div>

      {/* TAB 1: CATEGORIAS ATIVAS */}
      {activeTab === "CATEGORIES" && (
        <div className="bg-slate-800 border border-slate-700 rounded-2xl shadow-sm overflow-hidden flex flex-col h-[520px]">
          {/* Header Actions */}
          <div className="p-5 border-b border-slate-700 bg-slate-800/50 flex flex-col sm:flex-row gap-4 items-center justify-between">
            <div className="relative w-full sm:max-w-xs">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" size={16} />
              <input
                type="text"
                placeholder="Buscar categoria..."
                value={catSearch}
                onChange={(e) => setCatSearch(e.target.value)}
                className="w-full bg-slate-900 border border-slate-700 rounded-lg pl-9 pr-4 py-2 text-sm text-slate-200 outline-none focus:border-indigo-500 transition-colors"
              />
            </div>
            <form onSubmit={handleAddCategory} className="flex gap-2 w-full sm:w-auto">
              <input
                type="text"
                placeholder="Nova categoria manual"
                value={newCatName}
                onChange={(e) => setNewCatName(e.target.value)}
                className="flex-1 sm:w-48 bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-200 outline-none focus:border-indigo-500 transition-colors"
              />
              <button
                type="submit"
                disabled={catLoading || !newCatName.trim()}
                className="bg-indigo-500 hover:bg-indigo-600 text-white px-4 py-2 rounded-lg font-medium flex items-center justify-center gap-2 disabled:opacity-50 transition-colors cursor-pointer"
              >
                {catLoading ? <Loader2 size={16} className="animate-spin" /> : <Plus size={16} />}
                Adicionar
              </button>
            </form>
          </div>

          {/* Data List */}
          <div className="flex-1 overflow-y-auto p-2">
            {isFetching ? (
              <div className="flex items-center justify-center h-full text-slate-400">
                <Loader2 size={24} className="animate-spin" />
              </div>
            ) : (
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr>
                    <th className="px-4 py-3 text-xs font-semibold text-slate-400 border-b border-slate-700 w-full">
                      Nome da Categoria
                    </th>
                    <th className="px-4 py-3 text-xs font-semibold text-slate-400 border-b border-slate-700 text-right">
                      Ações
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {filteredCategories.length === 0 ? (
                    <tr>
                      <td colSpan={2} className="px-4 py-8 text-center text-slate-500 text-sm">
                        Nenhuma categoria encontrada.
                      </td>
                    </tr>
                  ) : (
                    filteredCategories.map((cat) => (
                      <tr key={cat.id} className="hover:bg-slate-700/30 transition-colors group">
                        <td className="px-4 py-3 text-sm text-slate-200 font-medium">
                          <div className="flex items-center gap-3">
                            <div className="w-8 h-8 rounded bg-slate-900 flex items-center justify-center text-slate-400">
                              <Tags size={14} />
                            </div>
                            {cat.name}
                          </div>
                        </td>
                        <td className="px-4 py-3 text-right">
                          <button
                            onClick={() => handleDeleteCategory(cat.id)}
                            className="p-2 text-slate-500 hover:text-red-400 hover:bg-red-500/10 rounded-md transition-colors opacity-0 group-hover:opacity-100 focus:opacity-100 cursor-pointer"
                            title="Remover"
                          >
                            <Trash2 size={16} />
                          </button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            )}
          </div>
        </div>
      )}

      {/* TAB 2: SUGESTÕES DE NOVAS CATEGORIAS DA IA */}
      {activeTab === "AI_SUGGESTIONS" && (
        <div className="bg-slate-800 border border-slate-700 rounded-2xl shadow-sm overflow-hidden flex flex-col min-h-[520px]">
          <div className="p-5 border-b border-slate-700 bg-slate-800/50 flex items-center justify-between">
            <div>
              <h2 className="text-sm font-bold text-white flex items-center gap-2">
                <Sparkles size={16} className="text-indigo-400" />
                Novas Categorias Propostas pelo Gemini
              </h2>
              <p className="text-xs text-slate-400 mt-0.5">
                Solicitações cuja despesa não pertencia a nenhuma categoria existente e a IA recomendou uma nova categoria.
              </p>
            </div>
            <button
              onClick={fetchSuggestions}
              disabled={isFetchingSuggestions}
              className="p-2 text-slate-400 hover:text-white rounded-lg hover:bg-slate-700 transition-colors"
              title="Recarregar"
            >
              <RefreshCw size={16} className={isFetchingSuggestions ? "animate-spin" : ""} />
            </button>
          </div>

          <div className="flex-1 p-5 overflow-y-auto space-y-4">
            {isFetchingSuggestions ? (
              <div className="flex items-center justify-center h-48 text-slate-400">
                <Loader2 size={24} className="animate-spin" />
              </div>
            ) : suggestions.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-16 text-center text-slate-400">
                <CheckCircle2 size={40} className="text-emerald-500/60 mb-3" />
                <p className="text-base font-semibold text-slate-200">Tudo em dia!</p>
                <p className="text-sm text-slate-400 mt-1 max-w-md">
                  Não há novas categorias pendentes de validação no momento. As solicitações estão usando as categorias oficiais.
                </p>
              </div>
            ) : (
              suggestions.map((sug) => (
                <div
                  key={sug.id}
                  className="bg-slate-900/90 border border-slate-700/80 rounded-xl p-5 flex flex-col md:flex-row md:items-center justify-between gap-4 hover:border-indigo-500/40 transition-colors"
                >
                  <div className="flex-1 space-y-1.5">
                    <div className="flex items-center gap-2.5">
                      <span className="text-base font-bold text-white tracking-wide">
                        {sug.name}
                      </span>
                      <span className="px-2 py-0.5 text-[10px] font-black uppercase tracking-wider rounded-md bg-indigo-500/20 text-indigo-300 border border-indigo-500/30">
                        {Math.round((sug.confidence || 0.9) * 100)}% Confiança
                      </span>
                    </div>

                    {sug.reason && (
                      <p className="text-xs text-slate-300 leading-relaxed">
                        <strong className="text-slate-400">Motivo da IA:</strong> {sug.reason}
                      </p>
                    )}

                    {sug.sample_request_title && (
                      <p className="text-xs text-slate-400">
                        <strong>Solicitação de exemplo:</strong> #{sug.sample_request_title}
                      </p>
                    )}
                  </div>

                  {/* Actions */}
                  <div className="flex flex-wrap items-center gap-2 shrink-0">
                    {/* Botão Aprovar */}
                    <button
                      onClick={() => handleSuggestionAction(sug.id, "APPROVE")}
                      disabled={actionLoadingId === sug.id}
                      className="px-3.5 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer disabled:opacity-50 shadow-sm"
                    >
                      {actionLoadingId === sug.id ? (
                        <Loader2 size={14} className="animate-spin" />
                      ) : (
                        <CheckCircle2 size={14} />
                      )}
                      <span>Aprovar & Criar</span>
                    </button>

                    {/* Mesclar em categoria existente */}
                    <div className="flex items-center gap-1.5 bg-slate-800 p-1 rounded-lg border border-slate-700">
                      <select
                        value={mergeTargetCat[sug.id] || ""}
                        onChange={(e) =>
                          setMergeTargetCat((prev) => ({ ...prev, [sug.id]: e.target.value }))
                        }
                        className="bg-slate-900 border border-slate-700 text-slate-200 text-xs rounded px-2 py-1 outline-none"
                      >
                        <option value="">Vincular a existente...</option>
                        {categories.map((c) => (
                          <option key={c.id} value={c.name}>
                            {c.name}
                          </option>
                        ))}
                      </select>

                      <button
                        onClick={() => handleSuggestionAction(sug.id, "MERGE")}
                        disabled={actionLoadingId === sug.id || !mergeTargetCat[sug.id]}
                        className="px-2.5 py-1 rounded bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold flex items-center gap-1 transition-colors cursor-pointer disabled:opacity-40"
                        title="Vincular a uma categoria existente"
                      >
                        <ArrowRight size={12} />
                        <span>Mesclar</span>
                      </button>
                    </div>

                    {/* Descartar */}
                    <button
                      onClick={() => handleSuggestionAction(sug.id, "REJECT")}
                      disabled={actionLoadingId === sug.id}
                      className="p-2 rounded-lg text-slate-400 hover:text-red-400 hover:bg-red-500/10 transition-colors cursor-pointer"
                      title="Descartar sugestão"
                    >
                      <XCircle size={16} />
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      )}

      {/* MODAL DE VARREDURA DE 'OUTROS' COM IA */}
      {isSweepModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="w-full max-w-4xl max-h-[88vh] bg-slate-900 border border-slate-700 rounded-2xl shadow-2xl flex flex-col overflow-hidden animate-in zoom-in-95 duration-200">
            {/* Modal Header */}
            <div className="p-5 border-b border-slate-800 flex items-center justify-between bg-slate-900/60">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-xl bg-indigo-500/20 text-indigo-400 border border-indigo-500/30">
                  <Sparkles size={20} />
                </div>
                <div>
                  <h3 className="text-lg font-bold text-white tracking-tight">
                    Varredura de Despesas com IA ("Outros")
                  </h3>
                  <p className="text-xs text-slate-400">
                    O Gemini analisou os títulos e observações de despesas sem categoria para categorizá-las com precisão.
                  </p>
                </div>
              </div>
              <button
                onClick={() => setIsSweepModalOpen(false)}
                className="text-slate-400 hover:text-white p-2 rounded-lg"
              >
                ✕
              </button>
            </div>

            {/* Modal Body */}
            <div className="flex-1 overflow-y-auto p-5 custom-scrollbar">
              {isSweeping ? (
                <div className="flex flex-col items-center justify-center py-20 text-center text-slate-400 space-y-3">
                  <Loader2 size={36} className="animate-spin text-indigo-400" />
                  <p className="text-base font-semibold text-white">Analisando despesas com o Gemini...</p>
                  <p className="text-xs text-slate-400 max-w-sm">
                    Avaliando título, notas e valores contra o plano de contas corporativo.
                  </p>
                </div>
              ) : sweepResults.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-16 text-center text-slate-400">
                  <CheckCircle2 size={40} className="text-emerald-500 mb-2" />
                  <p className="text-base font-bold text-white">Nenhuma despesa pendente em 'Outros'!</p>
                  <p className="text-xs text-slate-400 mt-1">
                    Todas as solicitações ativas já possuem uma categoria específica atribuída.
                  </p>
                </div>
              ) : (
                <div className="space-y-4">
                  <div className="flex items-center justify-between text-xs text-slate-400 px-1">
                    <span>
                      Encontradas <strong className="text-white">{sweepResults.length}</strong> solicitações para reclassificar
                    </span>
                    <span>Revise as propostas da IA abaixo antes de aplicar</span>
                  </div>

                  <div className="space-y-3">
                    {sweepResults.map((item) => (
                      <div
                        key={item.id}
                        className="bg-slate-800/80 border border-slate-700/80 rounded-xl p-4 flex flex-col md:flex-row md:items-center justify-between gap-4"
                      >
                        <div className="flex-1 space-y-1">
                          <div className="flex items-center gap-2">
                            <span className="text-sm font-bold text-white">{item.title}</span>
                            <span className="text-xs font-semibold text-emerald-400">
                              R$ {Number(item.amount).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
                            </span>
                          </div>

                          {item.notes && (
                            <p className="text-xs text-slate-400 line-clamp-1 italic">
                              "{item.notes}"
                            </p>
                          )}

                          <p className="text-[11px] text-slate-300">
                            <strong className="text-indigo-400">IA:</strong> {item.reason}
                          </p>
                        </div>

                        {/* Comparação de Categorias */}
                        <div className="flex items-center gap-2.5 shrink-0 bg-slate-900/80 px-3.5 py-2 rounded-lg border border-slate-700">
                          <span className="text-xs text-slate-400 line-through">
                            {item.currentCategory}
                          </span>
                          <ArrowRight size={14} className="text-slate-400" />
                          <div className="flex flex-col items-end">
                            <span className="text-xs font-bold text-indigo-300">
                              {item.suggestedCategory}
                            </span>
                            {item.isNewCategory && (
                              <span className="text-[9px] uppercase font-black text-amber-400">
                                Nova Categoria
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Modal Footer */}
            <div className="p-5 border-t border-slate-800 flex items-center justify-between bg-slate-900/60">
              <button
                type="button"
                onClick={() => setIsSweepModalOpen(false)}
                className="px-4 py-2 rounded-lg text-slate-400 hover:text-white text-xs font-semibold transition-colors cursor-pointer"
              >
                Cancelar
              </button>

              <button
                type="button"
                onClick={handleApplySweep}
                disabled={isApplyingSweep || isSweeping || sweepResults.length === 0}
                className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-600 hover:to-teal-700 text-white font-bold text-xs shadow-lg shadow-emerald-500/20 hover:shadow-emerald-500/30 transition-all flex items-center gap-2 disabled:opacity-40 cursor-pointer"
              >
                {isApplyingSweep ? (
                  <>
                    <Loader2 size={16} className="animate-spin" />
                    <span>Aplicando Categorizações...</span>
                  </>
                ) : (
                  <>
                    <CheckCircle2 size={16} />
                    <span>Aplicar Todas as {sweepResults.length} Categorias</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
