const fs = require('fs');
const path = require('path');
const file = path.join(process.cwd(), "src/lib/supabaseAdmin.ts");
let code = fs.readFileSync(file, 'utf8');

code = code.replace(
  'const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;',
  'const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || "dummy-key-for-build-only";'
);

fs.writeFileSync(file, code);
console.log("Patched supabaseAdmin.ts to prevent build crash.");
