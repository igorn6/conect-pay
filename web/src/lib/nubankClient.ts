/** Gatilho do Cofre Nubank: chamar após qualquer transição de status feita por Financeiro/Master. */
export const NUBANK_BALANCE_EVENT = "nubank-balance-updated";

/**
 * Pede ao servidor para (re)avaliar o cartão. A API é idempotente (balance_processed),
 * então é seguro chamar a cada transição. Nunca lança erro: não pode travar o Kanban.
 */
export async function syncNubankBalance(paymentId: string): Promise<void> {
  try {
    const res = await fetch("/api/nubank-balance/process-card", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ paymentId }),
    });
    if (!res.ok) {
      console.warn("[Nubank] Falha ao sincronizar saldo:", await res.text());
      return;
    }
    if (typeof window !== "undefined") window.dispatchEvent(new Event(NUBANK_BALANCE_EVENT));
  } catch (e) {
    console.warn("[Nubank] Erro de rede ao sincronizar saldo:", e);
  }
}
