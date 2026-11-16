// Monta, para o e-mail de pagamento, um bloco por pagamento (split) da solicitação.
// Usado quando o card tem mais de um pagamento: antes o e-mail trazia só o primeiro
// Pix/boleto e os demais ficavam de fora.

export interface EmailSplit {
  payment_type?: string | null;
  amount?: number | string | null;
  pix_key?: string | null;
  pix_owner?: string | null;
  caju_phone?: string | null;
  boleto_barcode?: string | null;
  boleto_due_date?: string | null;
}

const formatBRL = (value: unknown) =>
  (Number(value) || 0).toLocaleString("pt-BR", { minimumFractionDigits: 2 });

const formatDueDate = (isoDate: string) => {
  const d = new Date(`${isoDate}T12:00:00Z`);
  return Number.isNaN(d.getTime()) ? isoDate : d.toLocaleDateString("pt-BR");
};

/**
 * Um bloco por pagamento, no mesmo padrão do e-mail de pagamento único:
 *   Pagamento N / Valor / Chave pix (ou Linha digitável + Vencimento) / Titular
 *
 * includeKeys = false omite chave/linha digitável (e-mail de "pagamento realizado").
 */
export function buildSplitEmailBlocks(
  splits: EmailSplit[],
  fallbackOwner: string,
  opts: { includeKeys: boolean } = { includeKeys: true }
): string {
  return splits
    .map((split, idx) => {
      const type = String(split.payment_type || "").toUpperCase();
      const pixKey = String(split.pix_key || "").trim();
      const barcode = String(split.boleto_barcode || "").trim();
      const cajuPhone = String(split.caju_phone || "").trim();
      const owner = String(split.pix_owner || "").trim();

      const lines = [`Pagamento ${idx + 1}`, `Valor: R$ ${formatBRL(split.amount)}`];

      if (opts.includeKeys) {
        if (type === "BOLETO" || (!pixKey && barcode)) {
          lines.push(barcode ? `Linha digitável: ${barcode}` : "Linha digitável:");
          if (split.boleto_due_date) {
            lines.push(`Vencimento: ${formatDueDate(split.boleto_due_date)}`);
          }
        } else if (pixKey) {
          lines.push(`Chave pix: ${pixKey}`);
        } else if (type === "PIX") {
          lines.push("Chave pix:");
        }
      }

      // No Caju o "titular" exibido no card é o telefone/identificação da conta Caju.
      const titular = type === "CAJU" ? cajuPhone || owner || fallbackOwner : owner || fallbackOwner;
      lines.push(`Titular: ${titular}`);

      return lines.join("\n");
    })
    .join("\n\n");
}
