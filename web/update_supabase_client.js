const fs = require('fs');
const path = require('path');
const file = path.join(process.cwd(), "src/lib/supabase.ts");

const code = `import { createBrowserClient } from "@supabase/ssr";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

export const supabase = createBrowserClient(supabaseUrl, supabaseAnonKey);
`;

fs.writeFileSync(file, code);
console.log("Updated supabase.ts to use createBrowserClient.");
