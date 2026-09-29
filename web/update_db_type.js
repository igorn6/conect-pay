const fs = require('fs');
const path = require('path');
const file = path.join(process.cwd(), "src/types/database.ts");
let code = fs.readFileSync(file, 'utf8');

code = code.replace(
  'sector?: string | null;\n  created_at?: string;',
  'sector?: string | null;\n  avatar_url?: string | null;\n  created_at?: string;'
);

fs.writeFileSync(file, code);
console.log("Added avatar_url to types/database.ts");
