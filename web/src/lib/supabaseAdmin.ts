import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
// O Service Role Key deve estar disponível no ambiente de produção; em dev local cai para anon key se não estiver presente
const rawKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const isValidServiceKey = rawKey && rawKey !== "[SENSITIVE]" && rawKey !== "dummy-key-for-build-only";
const supabaseServiceKey = isValidServiceKey ? rawKey : (process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "dummy-key-for-build-only");

// Cliente do Supabase com privilégios de Admin (ou anon key em desenvolvimento local)
export const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false,
  },
});
