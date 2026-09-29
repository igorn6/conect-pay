const fs = require('fs');
const path = require('path');

const hookPath = path.join(process.cwd(), "src/hooks/useProfilesMap.ts");
const code = `import { useState, useEffect } from "react";

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
        const response = await fetch("/api/admin/users");
        if (!response.ok) throw new Error("Erro ao buscar perfis na API");
        
        const data = await response.json();

        if (isMounted && data) {
          setProfilesList(data as Profile[]);
          const map: Record<string, string> = {};
          data.forEach((p: Profile) => map[p.id] = p.name);
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
console.log("Updated useProfilesMap to use API route.");
