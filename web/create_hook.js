const fs = require('fs');
const path = require('path');

const hookPath = path.join(process.cwd(), "src/hooks/useProfilesMap.ts");
const code = `import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabase";

export interface Profile {
  id: string;
  name: string;
  is_active: boolean;
}

export function useProfilesMap() {
  const [profilesMap, setProfilesMap] = useState<Record<string, string>>({});
  const [profilesList, setProfilesList] = useState<Profile[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let isMounted = true;

    async function fetchProfiles() {
      try {
        const { data, error } = await supabase
          .from("profiles")
          .select("id, name, is_active")
          .order("name");

        if (error) throw error;

        if (isMounted && data) {
          setProfilesList(data as Profile[]);
          const map: Record<string, string> = {};
          data.forEach(p => map[p.id] = p.name);
          setProfilesMap(map);
        }
      } catch (err) {
        console.error("Erro ao buscar perfis:", err);
      } finally {
        if (isMounted) setIsLoading(false);
      }
    }

    fetchProfiles();

    return () => { isMounted = false; };
  }, []);

  return { profilesMap, profilesList, isLoading };
}
`;

fs.writeFileSync(hookPath, code);
console.log("Hook useProfilesMap created.");
