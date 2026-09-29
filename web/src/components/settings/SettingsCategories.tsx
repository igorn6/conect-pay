"use client";

import { useState, useEffect } from "react";
import { Plus, Trash2, Loader2, Tags, Search } from "lucide-react";
import { supabase } from "@/lib/supabase";
import type { Category } from "@/types/database";

export default function SettingsCategories() {
  const [categories, setCategories] = useState<Category[]>([]);
  const [newCatName, setNewCatName] = useState("");
  const [catLoading, setCatLoading] = useState(false);
  const [catSearch, setCatSearch] = useState("");
  const [isFetching, setIsFetching] = useState(true);

  useEffect(() => {
    fetchCategories();
  }, []);

  const fetchCategories = async () => {
    setIsFetching(true);
    const { data } = await supabase.from("categories").select("*").eq("is_deleted", false).order("name");
    if (data) setCategories(data as Category[]);
    setIsFetching(false);
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

  const filteredCategories = categories.filter(c => c.name.toLowerCase().includes(catSearch.toLowerCase()));

  return (
    <div className="animate-in fade-in slide-in-from-bottom-2 duration-300">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-white mb-2">Categorias do Kanban</h1>
        <p className="text-slate-400 text-sm">Gerencie as categorias de despesas e classificações de solicitações.</p>
      </div>

      <div className="bg-slate-800 border border-slate-700 rounded-2xl shadow-sm overflow-hidden flex flex-col h-[500px]">
        {/* Header Actions */}
        <div className="p-5 border-b border-slate-700 bg-slate-800/50 flex flex-col sm:flex-row gap-4 items-center justify-between">
          <div className="relative w-full sm:max-w-xs">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" size={16} />
            <input 
              type="text" 
              placeholder="Buscar categoria..."
              value={catSearch}
              onChange={e => setCatSearch(e.target.value)}
              className="w-full bg-slate-900 border border-slate-700 rounded-lg pl-9 pr-4 py-2 text-sm text-slate-200 outline-none focus:border-emerald-500 transition-colors"
            />
          </div>
          <form onSubmit={handleAddCategory} className="flex gap-2 w-full sm:w-auto">
            <input
              type="text"
              placeholder="Nova categoria"
              value={newCatName}
              onChange={(e) => setNewCatName(e.target.value)}
              className="flex-1 sm:w-48 bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-200 outline-none focus:border-emerald-500 transition-colors"
            />
            <button
              type="submit"
              disabled={catLoading || !newCatName.trim()}
              className="bg-emerald-500 hover:bg-emerald-600 text-white px-4 py-2 rounded-lg font-medium flex items-center justify-center gap-2 disabled:opacity-50 transition-colors"
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
                  <th className="px-4 py-3 text-xs font-semibold text-slate-400 border-b border-slate-700 w-full">Nome da Categoria</th>
                  <th className="px-4 py-3 text-xs font-semibold text-slate-400 border-b border-slate-700 text-right">Ações</th>
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
                  filteredCategories.map(cat => (
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
                          className="p-2 text-slate-500 hover:text-red-400 hover:bg-red-500/10 rounded-md transition-colors opacity-0 group-hover:opacity-100 focus:opacity-100"
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
    </div>
  );
}
