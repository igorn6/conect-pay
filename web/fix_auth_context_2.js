const fs = require('fs');
const path = require('path');

const p = path.join(process.cwd(), "src/contexts/AuthContext.tsx");
let code = fs.readFileSync(p, "utf-8");

code = code.replace(
  "userId,\n        sectorId,",
  "userId,\n        sectorId,\n        logout"
);

if (code.includes(`      <AuthContext.Provider\n        value={{ userRole, userName, userId, logout }}\n      >`)) {
  code = code.replace(
    `      <AuthContext.Provider\n        value={{ userRole, userName, userId, logout }}\n      >`,
    `      <AuthContext.Provider\n        value={{ userRole, userName, userId, sectorId, logout }}\n      >`
  );
} else if (code.includes(`value={{ userRole, userName, userId, logout }}`)) {
  code = code.replace(
    `value={{ userRole, userName, userId, logout }}`,
    `value={{ userRole, userName, userId, sectorId, logout }}`
  );
}

fs.writeFileSync(p, code);
console.log("AuthContext.tsx syntax error fixed again.");
