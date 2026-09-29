import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
// O Service Role Key deve estar disponível não ambiente, NUNCA não NEXT_PUBLIC
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || "dummy-key-for-build-only";

// Cliente do Supabase com privilégios de Admin (ignora RLS e permite gerenciar usuários)
export const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false,
  },
});
