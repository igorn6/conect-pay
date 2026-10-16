/** Constantes e helpers compartilhados (cliente + servidor) do Cofre Nubank. */

export const NUBANK_ACCOUNT_LABEL = "Nubank 02";
export const NUBANK_INITIAL_BALANCE = 609.74;

export type RequestKind = "RECARGA_NUBANK" | "RECARGA_CAJU";

export const REQUEST_KIND_LABELS: Record<RequestKind, string> = {
  RECARGA_NUBANK: "Recarga de Saldo Nubank",
  RECARGA_CAJU: "Recarga de Saldo Caju",
};

/** Categoria gravada automaticamente nos cartões de recarga. */
export const RECHARGE_CATEGORY = "Recarga de Saldo";

export function isRechargeKind(kind: unknown): kind is RequestKind {
  return kind === "RECARGA_NUBANK" || kind === "RECARGA_CAJU";
}

/** O CNPJ / conta pagadora do cartão é o Nubank? (aceita o legado "Nubank" e "NU"). */
export function isNubankAccount(cnpj?: string | null): boolean {
  const v = (cnpj || "").trim().toLowerCase();
  if (!v) return false;
  return v === "nu" || v.startsWith("nubank") || v.startsWith("nu ");
}

export type NubankMovementType = "ENTRADA" | "SAIDA" | "REEMBOLSO" | "AJUSTE";

export interface NubankMovement {
  id: string;
  type: NubankMovementType;
  /** Delta com sinal: positivo entrou, negativo saiu. */
  amount: number;
  balance_after: number;
  description: string | null;
  payment_request_id: string | null;
  created_by: string | null;
  created_at: string;
}

export interface NubankSnapshot {
  balance: number;
  updatedAt: string | null;
  movements: NubankMovement[];
}
