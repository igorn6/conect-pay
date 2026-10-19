import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabase";

export interface Profile {
  id: string;
  name: string;
  is_active: boolean;
  sector?: string | null;
  role?: string;
  email?: string;
}

export function useProfilesMap() {
  const [profilesMap, setProfilesMap] = useState<Record<string, string>>({});
  const [profilesList, setProfilesList] = useState<Profile[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let isMounted = true;

    async function fetchProfiles() {
      try {
        // Busca direta da tabela profiles no Supabase (latência < 30ms, pública para leitura)
        const { data, error } = await supabase
          .from("profiles")
          .select("id, name, sector, role, email")
          .order("name");

        if (error) {
          // Fallback para API admin caso necessário
          const response = await fetch("/api/admin/users");
          if (!response.ok) throw error;
          const fallbackData = await response.json();
          if (isMounted && fallbackData) {
            setProfilesList(fallbackData as Profile[]);
            const map: Record<string, string> = {};
            fallbackData.forEach((p: Profile) => {
              map[p.id] = p.name;
            });
            setProfilesMap(map);
          }
          return;
        }

        if (isMounted && data) {
          const list: Profile[] = data.map((p: any) => ({
            id: p.id,
            name: p.name || "Sem Nome",
            is_active: true,
            sector: p.sector || null,
            role: p.role || "",
            email: p.email || "",
          }));
          setProfilesList(list);
          const map: Record<string, string> = {};
          list.forEach((p: Profile) => {
            map[p.id] = p.name;
          });
          setProfilesMap(map);
        }
      } catch (err) {
        console.error("Erro ao buscar perfis:", err);
      } finally {
        if (isMounted) setIsLoading(false);
      }
    }

    fetchProfiles();

    return () => {
      isMounted = false;
    };
  }, []);

  return { profilesMap, profilesList, isLoading };
}
