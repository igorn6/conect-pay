const fs = require('fs');
const path = require('path');

const p = path.join(process.cwd(), "src/contexts/AuthContext.tsx");
let code = fs.readFileSync(p, "utf-8");

code = code.replace(
  `  const [userId,
        sectorId, setUserId] = useState<string | null>(null);`,
  `  const [userId, setUserId] = useState<string | null>(null);`
);

fs.writeFileSync(p, code);
console.log("AuthContext.tsx syntax error fixed.");
