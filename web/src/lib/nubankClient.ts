import { supabase } from "@/lib/supabase";

/** Gatilho do Cofre Nubank: chamar após qualquer transição de status feita por Financeiro/Master/Gestor. */
export const NUBANK_BALANCE_EVENT = "nubank-balance-updated";

export async function syncNubankBalance(paymentId: string): Promise<void> {
  try {
    const { data } = await supabase.auth.getSession();
    const session = data?.session;
    const token = session?.access_token;
    const userId = session?.user?.id;

    const headers: Record<string, string> = {
      "Content-Type": "application/json",
    };
    if (token) {
      headers["Authorization"] = `Bearer ${token}`;
    }
    if (userId) {
      headers["x-user-id"] = userId;
    }

    const res = await fetch("/api/nubank-balance/process-card", {
      method: "POST",
      headers,
      body: JSON.stringify({ paymentId, userId }),
    });
    if (!res.ok) {
      console.warn("[Nubank] Falha ao sincronizar saldo:", await res.text());
    }
  } catch (e) {
    console.warn("[Nubank] Erro de rede ao sincronizar saldo:", e);
  } finally {
    if (typeof window !== "undefined") window.dispatchEvent(new Event(NUBANK_BALANCE_EVENT));
  }
}
