const fs = require('fs');
const path = require('path');

// 1. Fix Sidebar.tsx
const sidebarPath = path.join(process.cwd(), "src/components/Sidebar.tsx");
let sidebarCode = fs.readFileSync(sidebarPath, "utf-8");
sidebarCode = sidebarCode.replace("mix-blend-lighten ", "");
fs.writeFileSync(sidebarPath, sidebarCode);
console.log("Sidebar.tsx patched (removed mix-blend-lighten).");

// 2. Fix AuthContext.tsx
const authPath = path.join(process.cwd(), "src/contexts/AuthContext.tsx");
let authCode = fs.readFileSync(authPath, "utf-8");

if (!authCode.includes("sectorId: string | null")) {
  authCode = authCode.replace(
    "userId: string | null;",
    "userId: string | null;\n  sectorId: string | null;"
  );
  authCode = authCode.replace(
    "const [userId, setUserId] = useState<string | null>(null);",
    "const [userId, setUserId] = useState<string | null>(null);\n  const [sectorId, setSectorId] = useState<string | null>(null);"
  );
  authCode = authCode.replace(
    'select("name, role, must_change_password")',
    'select("name, role, sector, must_change_password")'
  );
  authCode = authCode.replace(
    "setUserId(null);",
    "setUserId(null);\n          setSectorId(null);"
  );
  authCode = authCode.replace(
    "setUserId(id);",
    "setUserId(id);\n          setSectorId(data.sector);"
  );
  authCode = authCode.replace(
    "userId,",
    "userId,\n        sectorId,"
  );
  
  fs.writeFileSync(authPath, authCode);
  console.log("AuthContext.tsx patched (added sectorId).");
} else {
  console.log("AuthContext.tsx already has sectorId.");
}
