import { createClient, type SupabaseClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
// O Service Role Key deve estar disponível no ambiente de produção; em dev local cai para anon key se não estiver presente
const rawKey = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();
const isValidServiceKey = Boolean(
  rawKey && rawKey !== "[SENSITIVE]" && rawKey !== "dummy-key-for-build-only"
);
const supabaseServiceKey = isValidServiceKey
  ? rawKey!
  : process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "dummy-key-for-build-only";

export const hasServiceRoleKey = isValidServiceKey;

// Cliente do Supabase com privilégios de Admin em produção (ou anon fallback em dev local)
export const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false,
  },
});

export function createAuthenticatedClientFromToken(accessToken: string): SupabaseClient {
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
  return createClient(supabaseUrl, anonKey, {
    global: {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    },
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
}
