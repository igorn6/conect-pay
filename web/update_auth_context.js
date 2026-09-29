const fs = require('fs');
const path = require('path');
const file = path.join(process.cwd(), "src/contexts/AuthContext.tsx");
let code = fs.readFileSync(file, 'utf8');

// 1. Update Context Interface
code = code.replace(
  'sectorId: string | null;',
  'sectorId: string | null;\n  avatarUrl: string | null;\n  setAvatarUrl: (url: string | null) => void;'
);

// 2. Add state
code = code.replace(
  'const [sectorId, setSectorId] = useState<string | null>(null);',
  'const [sectorId, setSectorId] = useState<string | null>(null);\n  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);'
);

// 3. Select avatar_url in DB
code = code.replace(
  '.select("name, role, sector, must_change_password")',
  '.select("name, role, sector, must_change_password, avatar_url")'
);

// 4. Set state
code = code.replace(
  'setSectorId(data.sector);',
  'setSectorId(data.sector);\n          setAvatarUrl(data.avatar_url);'
);

// 5. Expose in provider
code = code.replace(
  'sectorId,\n        logout',
  'sectorId,\n        avatarUrl,\n        setAvatarUrl,\n        logout'
);

fs.writeFileSync(file, code);
console.log("Updated AuthContext.tsx");
