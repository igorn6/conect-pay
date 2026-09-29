const fs = require('fs');
const path = require('path');
const file = path.join(process.cwd(), "src/contexts/AuthContext.tsx");
let code = fs.readFileSync(file, 'utf8');

code = code.replace(
  'value={{ userRole, userName, userId, sectorId, logout }}',
  'value={{ userRole, userName, userId, sectorId, avatarUrl, setAvatarUrl, logout }}'
);

fs.writeFileSync(file, code);
console.log("Updated AuthContext.tsx Provider value");
