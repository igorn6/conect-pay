import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabase";
import type { Category } from "@/types/database";

// Cache em memória para resposta instantânea entre navegações
let cachedCategories: Category[] | null = null;

// Categorias padrão do Conect Pay para inicialização imediata (0ms)
const DEFAULT_CATEGORIES: Category[] = [
  { id: "cat-1", name: "Alimentação", color: "#10b981" },
  { id: "cat-2", name: "Transporte", color: "#3b82f6" },
  { id: "cat-3", name: "Material de Escritório e Suprimentos", color: "#8b5cf6" },
  { id: "cat-4", name: "Marketing e Publicidade", color: "#ec4899" },
  { id: "cat-5", name: "Equipamentos TI", color: "#06b6d4" },
  { id: "cat-6", name: "Combustível", color: "#f59e0b" },
  { id: "cat-7", name: "Hospedagem", color: "#14b8a6" },
  { id: "cat-8", name: "Impostos e Taxas", color: "#ef4444" },
  { id: "cat-9", name: "Manutenção e Reparos", color: "#f97316" },
  { id: "cat-10", name: "Outros", color: "#64748b" },
  { id: "cat-11", name: "Resciões, FGTS, Férias...", color: "#d946ef" },
  { id: "cat-12", name: "Meta de funcionário", color: "#eab308" },
  { id: "cat-13", name: "Treinamentos e Capacitações", color: "#84cc16" },
  { id: "cat-14", name: "Prestador de serviços avulsos", color: "#a855f7" },
  { id: "cat-15", name: "Materiais Eletricos E Complementares", color: "#6366f1" },
  { id: "cat-16", name: "Transferência entre Contas", color: "#0ea5e9" },
  { id: "cat-17", name: "ART - CREA", color: "#22c55e" },
  { id: "cat-18", name: "Material/Ferramentas Marketing", color: "#f43f5e" },
  { id: "cat-19", name: "Marketing - Ações de Rua", color: "#fb923c" },
];

export function useCategories() {
  const [categories, setCategories] = useState<Category[]>(
    cachedCategories || DEFAULT_CATEGORIES
  );
  const [isLoading, setIsLoading] = useState(!cachedCategories);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let isMounted = true;

    async function fetchCategories() {
      try {
        const { data, error } = await supabase
          .from("categories")
          .select("*")
          .eq("is_deleted", false)
          .order("name");

        if (error) throw error;

        if (isMounted && data) {
          const fetched = data as Category[];
          cachedCategories = fetched;
          setCategories(fetched);
        }
      } catch (err: any) {
        console.error("Erro ao sincronizar categorias:", err);
        if (isMounted) {
          setError(err.message || "Erro ao carregar categorias.");
        }
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    }

    fetchCategories();

    return () => {
      isMounted = false;
    };
  }, []);

  return { categories, isLoading, error };
}
