import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabase";
import type { UserSector } from "@/types/database";

export function useSectors() {
  const [sectors, setSectors] = useState<UserSector[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let isMounted = true;

    async function fetchSectors() {
      try {
        setIsLoading(true);
        const { data, error } = await supabase
          .from("sectors")
          .select("*")
          .eq("is_deleted", false)
          .order("name");

        if (error) throw error;

        if (isMounted) {
          setSectors(data as UserSector[]);
        }
      } catch (err: any) {
        console.error("Erro ao buscar setores:", err);
        if (isMounted) {
          setError(err.message || "Erro ao carregar setores.");
        }
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    }

    fetchSectors();

    return () => {
      isMounted = false;
    };
  }, []);

  return { sectors, isLoading, error };
}
