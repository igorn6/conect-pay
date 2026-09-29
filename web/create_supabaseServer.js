const fs = require('fs');
const path = require('path');

const code = `import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/types/supabase";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

export const supabaseServer = createClient<Database>(supabaseUrl, supabaseServiceKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
});
`;

fs.writeFileSync(path.join(process.cwd(), "src/lib/supabaseServer.ts"), code);
console.log("supabaseServer.ts created.");
