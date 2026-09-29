import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabase";
import type { Category } from "@/types/database";

export function useCategories() {
  const [categories, setCategories] = useState<Category[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let isMounted = true;

    async function fetchCategories() {
      try {
        setIsLoading(true);
        const { data, error } = await supabase
          .from("categories")
          .select("*")
          .eq("is_deleted", false)
          .order("name");

        if (error) throw error;

        if (isMounted) {
          setCategories(data as Category[]);
        }
      } catch (err: any) {
        console.error("Erro ao buscar categorias:", err);
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
