/**
 * Utilitário de Exportação de Dados para o Google Sheets (Formato TSV).
 *
 * Objetivo: Formatar transações de saída (Compras / Débitos) para a área de transferência (Clipboard)
 * no layout exato esperado pelo Google Sheets, pulando propositalmente as colunas B e C (Categoria e Fluxos)
 * para não sobrescrever fórmulas ou dropdowns existentes na planilha de conciliação.
 *
 * Estrutura das Colunas Geradas (Delimitador: Tabulação \t):
 * - Coluna A: Data (DD/MM/YYYY)
 * - Coluna B: Vazia
 * - Coluna C: Vazia
 * - Coluna D: Motivo/Destino ([Estabelecimento] - [Nome do Colaborador/Titular])
 * - Coluna E: Banco ("Caju" | "Nubank")
 * - Coluna F: Valor (Numérico formatado padrão pt-BR, ex: "15,40", sem prefixo "R$")
 */

export type SupportedBankName = "Caju" | "Nubank";

export type DatePresetFilter = "ALL" | "TODAY" | "YESTERDAY" | "7_DAYS" | "15_DAYS" | "30_DAYS";

export const DATE_PRESET_OPTIONS: ReadonlyArray<{ id: DatePresetFilter; label: string }> = [
  { id: "ALL", label: "Todas" },
  { id: "TODAY", label: "Hoje" },
  { id: "YESTERDAY", label: "Ontem" },
  { id: "7_DAYS", label: "7 dias" },
  { id: "15_DAYS", label: "15 dias" },
  { id: "30_DAYS", label: "1 mês" },
];

export interface TransactionLike {
  id?: string;
  tx_type?: string | null;
  type?: string | null;
  raw_type?: string | null;
  amount?: number | string | null;
  occurred_at?: string | null;
  created_at?: string | null;
  date?: string | null;
  item_date?: string | null;
  merchant?: string | null;
  establishment?: string | null;
  advance_name?: string | null;
  collaborator_name?: string | null;
  holder?: string | null;
  holder_name?: string | null;
  description?: string | null;
  [key: string]: any;
}

export interface CopyOutflowsResult {
  success: boolean;
  count: number;
  message: string;
}

/**
 * Emite notificação global na aplicação através do canal customizado de Toast.
 */
export function showAppToast(message: string, type: "success" | "warning" | "error" = "success"): void {
  if (typeof window !== "undefined") {
    window.dispatchEvent(
      new CustomEvent("app-toast", {
        detail: { message, type },
      })
    );
  }
}

export const toast = {
  success: (message: string) => showAppToast(message, "success"),
  warning: (message: string) => showAppToast(message, "warning"),
  error: (message: string) => showAppToast(message, "error"),
};

/**
 * Formata qualquer formato de data (ISO, YYYY-MM-DD, timestamp) em DD/MM/YYYY.
 */
export function formatDateToDDMMYYYY(rawDate: unknown): string {
  if (!rawDate) return "";

  if (typeof rawDate === "string") {
    const trimmed = rawDate.trim();
    // Já formatado em DD/MM/YYYY
    if (/^\d{2}\/\d{2}\/\d{4}$/.test(trimmed)) {
      return trimmed;
    }

    // Padrão ISO YYYY-MM-DD
    const isoMatch = trimmed.match(/^(\d{4})-(\d{2})-(\d{2})/);
    if (isoMatch) {
      const [, year, month, day] = isoMatch;
      return `${day}/${month}/${year}`;
    }
  }

  try {
    const dateObj = new Date(rawDate as any);
    if (isNaN(dateObj.getTime())) return String(rawDate);
    return dateObj.toLocaleDateString("pt-BR", {
      timeZone: "America/Sao_Paulo",
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
    });
  } catch {
    return String(rawDate);
  }
}

/**
 * Converte data para string YYYY-MM-DD no fuso horário de Brasília.
 */
export function getLocalDateString(raw: unknown): string {
  if (!raw) return "";
  if (typeof raw === "string") {
    const match = raw.match(/^(\d{4}-\d{2}-\d{2})/);
    if (match && !raw.includes("T") && !raw.includes("Z")) {
      return match[1];
    }
  }
  try {
    const d = new Date(raw as any);
    if (isNaN(d.getTime())) return "";
    return new Intl.DateTimeFormat("en-CA", {
      timeZone: "America/Sao_Paulo",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).format(d);
  } catch {
    return "";
  }
}

/**
 * Avalia se uma data atende ao filtro de período pré-definido selecionado:
 * - "TODAY": apenas hoje
 * - "YESTERDAY": apenas ontem
 * - "7_DAYS": últimos 7 dias
 * - "15_DAYS": últimos 15 dias
 * - "30_DAYS": último mês (30 dias)
 */
export function matchesDatePreset(
  rawDate: unknown,
  preset: DatePresetFilter
): boolean {
  if (preset === "ALL") return true;
  const txDateStr = getLocalDateString(rawDate);
  if (!txDateStr) return false;

  const now = new Date();
  const todayStr = getLocalDateString(now);

  if (preset === "TODAY") {
    return txDateStr === todayStr;
  }

  // Ontem: 24 horas atrás
  const yesterday = new Date(now.getTime() - 24 * 60 * 60 * 1000);
  const yesterdayStr = getLocalDateString(yesterday);
  if (preset === "YESTERDAY") {
    return txDateStr === yesterdayStr;
  }

  // 7 dias: transações desde 7 dias atrás
  if (preset === "7_DAYS") {
    const d7 = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    const d7Str = getLocalDateString(d7);
    return txDateStr >= d7Str;
  }

  // 15 dias: transações desde 15 dias atrás
  if (preset === "15_DAYS") {
    const d15 = new Date(now.getTime() - 15 * 24 * 60 * 60 * 1000);
    const d15Str = getLocalDateString(d15);
    return txDateStr >= d15Str;
  }

  // 1 mês (30 dias): transações desde 30 dias atrás
  if (preset === "30_DAYS") {
    const d30 = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    const d30Str = getLocalDateString(d30);
    return txDateStr >= d30Str;
  }

  return true;
}

/**
 * Extrai e formata o Motivo/Destino no formato exato da planilha:
 * `Colaborador | Estabelecimento`
 */
export function formatReasonDestination(tx: TransactionLike, bankName: SupportedBankName): string {
  // 1. Extração direta de propriedades estruturadas (padrão Caju / cartões corporativos)
  const establishment = (
    tx.merchant ||
    tx.establishment ||
    tx.advance_name ||
    ""
  ).trim();

  const collaborator = (
    tx.collaborator_name ||
    tx.holder ||
    tx.holder_name ||
    ""
  ).trim();

  if (collaborator && establishment) {
    return `${collaborator} | ${establishment}`;
  }

  // 2. Extração a partir do campo 'description' (padrão Nubank / extratos bancários)
  if (tx.description) {
    const rawDesc = String(tx.description).trim();

    // Se já está no formato Colaborador | Estabelecimento
    if (rawDesc.includes(" | ")) {
      return rawDesc;
    }

    // Padrão Pix: "Transferência enviada pelo PixNome Sobrenome - •••.123.456-•• - BANCO..."
    const pixMatch = rawDesc.match(/Transferência enviada pelo Pix\s*([^-–•]+)/i);
    if (pixMatch) {
      const extractedName = pixMatch[1].trim();
      return `${extractedName} | Transferência Pix`;
    }

    // Padrão Boleto: "Pagamento de boleto efetuadoBENEFICIARIO..."
    const boletoMatch = rawDesc.match(/Pagamento de boleto efetuado\s*(.+)/i);
    if (boletoMatch) {
      const beneficiary = boletoMatch[1].trim();
      const holder = collaborator || "Lima e Trindade";
      return `${holder} | ${beneficiary}`;
    }

    // Padrão Compra no Débito: "Compra no débito Estabelecimento Nome"
    const debitCardMatch = rawDesc.match(/Compra no débito\s+(.+)/i);
    if (debitCardMatch) {
      const rest = debitCardMatch[1].trim();
      const d4Match = rest.match(/Envio D4\s+(.+)/i);
      if (d4Match) {
        return `${d4Match[1].trim()} | Envio D4`;
      }
      return `${collaborator || "Lima e Trindade"} | ${rest}`;
    }

    // Padrão Ajustes manuais internos Conect Pay:
    // "saida de compras envio D4 por isabel (por Igor Nascimento)"
    const d4ManualMatch = rawDesc.match(/envio D4 por\s+([^()]+)/i);
    if (d4ManualMatch) {
      const name = d4ManualMatch[1].trim();
      return `${name.charAt(0).toUpperCase() + name.slice(1)} | Envio D4`;
    }

    // "chip e recarga feitos por thainara comercial (por Igor Nascimento)"
    const chipMatch = rawDesc.match(/chip e recarga feitos por\s+([^()]+)/i);
    if (chipMatch) {
      const name = chipMatch[1].trim();
      return `${name.charAt(0).toUpperCase() + name.slice(1)} | Chip e Recarga`;
    }

    // "Pagamento: PAGAMENTO ELLEN"
    const pagEllenMatch = rawDesc.match(/Pagamento:\s*PAGAMENTO\s+(.+)/i);
    if (pagEllenMatch) {
      const name = pagEllenMatch[1].trim();
      return `${name} | Pagamento ${name}`;
    }

    // "Pagamento: Recarga no celular do pré venda"
    const recargaMatch = rawDesc.match(/Pagamento:\s*(Recarga no celular do pré venda)/i);
    if (recargaMatch) {
      return `Pré-Venda | ${recargaMatch[1].trim()}`;
    }

    // "Pagamento: SOLICITAÇÃO DE TICKET: JANTA"
    const ticketMatch = rawDesc.match(/Pagamento:\s*SOLICITAÇÃO DE TICKET:\s*(.+)/i);
    if (ticketMatch) {
      return `Ticket Alimentação | Janta`;
    }

    // Limpeza de prefixo "Pagamento: " genérico
    let cleanDesc = rawDesc.replace(/^Pagamento:\s*/i, "").trim();

    const defaultHolder = collaborator || (bankName === "Caju" ? "Colaborador Caju" : "Lima e Trindade");
    return `${defaultHolder} | ${cleanDesc}`;
  }

  // 3. Fallbacks de segurança
  const fallbackEstablishment = establishment || (bankName === "Caju" ? "Despesa Cartão" : "Despesa Nubank");
  const fallbackHolder = collaborator || (bankName === "Caju" ? "Colaborador Caju" : "Lima e Trindade");
  return `${fallbackHolder} | ${fallbackEstablishment}`;
}

/**
 * Formata o valor numérico em padrão brasileiro pt-BR (ex: "15,40" ou "1.250,00"),
 * garantindo valor absoluto positivo e SEM o prefixo "R$".
 */
export function formatAmountNumberOnly(rawAmount: unknown): string {
  let num = 0;
  if (typeof rawAmount === "number") {
    num = rawAmount;
  } else if (typeof rawAmount === "string") {
    const clean = rawAmount.replace(/[R$\s+]/gi, "").trim();
    if (clean.includes(",") && clean.includes(".")) {
      if (clean.lastIndexOf(",") > clean.lastIndexOf(".")) {
        num = parseFloat(clean.replace(/\./g, "").replace(",", "."));
      } else {
        num = parseFloat(clean.replace(/,/g, ""));
      }
    } else if (clean.includes(",")) {
      num = parseFloat(clean.replace(",", "."));
    } else {
      num = parseFloat(clean) || 0;
    }
  }

  const absVal = Math.abs(num);
  return new Intl.NumberFormat("pt-BR", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(absVal);
}

/**
 * Identifica se a transação representa uma Saída (Compra / Pagamento Débito / Ajuste Débito).
 */
export function isOutflowTransaction(tx: TransactionLike): boolean {
  if (!tx) return false;

  const typeStr = String(tx.tx_type || tx.type || tx.raw_type || "").toUpperCase().trim();

  // 1. Verificação primária pelo valor numérico: se for negativo, É SAÍDA
  let numVal: number | null = null;
  if (typeof tx.amount === "number") {
    numVal = tx.amount;
  } else if (typeof tx.amount === "string") {
    const clean = tx.amount.replace(/[R$\s+]/gi, "").trim();
    if (clean.includes(",") && clean.includes(".")) {
      if (clean.lastIndexOf(",") > clean.lastIndexOf(".")) {
        numVal = parseFloat(clean.replace(/\./g, "").replace(",", "."));
      } else {
        numVal = parseFloat(clean.replace(/,/g, ""));
      }
    } else if (clean.includes(",")) {
      numVal = parseFloat(clean.replace(",", "."));
    } else {
      numVal = parseFloat(clean);
    }
  }

  if (numVal !== null && !isNaN(numVal)) {
    // Se o valor é estritamente negativo (ex: -14.75, -25.20, -325.17), SEMPRE é saída
    if (numVal < 0) return true;
    // Se o valor é estritamente positivo e o tipo é entrada, não é saída
    if (numVal > 0 && (typeStr === "ENTRADA" || typeStr === "RECARGA" || typeStr === "REEMBOLSO" || typeStr === "IN")) {
      return false;
    }
  }

  // 2. Tipos explícitos de saída
  if (
    typeStr === "COMPRA" ||
    typeStr === "SAIDA" ||
    typeStr === "OUT" ||
    typeStr === "DEBIT" ||
    typeStr === "DEBITO" ||
    typeStr === "PAGAMENTO"
  ) {
    return true;
  }

  // 3. Tipos explícitos de entrada/estorno que NÃO devem ser exportados como saídas
  if (
    typeStr === "ENTRADA" ||
    typeStr === "RECARGA" ||
    typeStr === "DEPOSITO" ||
    typeStr === "REEMBOLSO" ||
    typeStr === "RESGATE"
  ) {
    return false;
  }

  return false;
}

/**
 * Utilitário seguro para escrita na área de transferência (Clipboard) do navegador.
 */
export async function writeTextToClipboard(text: string): Promise<boolean> {
  if (typeof window === "undefined") return false;

  try {
    if (navigator?.clipboard?.writeText) {
      await navigator.clipboard.writeText(text);
      return true;
    }
  } catch (err) {
    console.warn("navigator.clipboard.writeText falhou, acionando fallback execCommand:", err);
  }

  try {
    const textarea = document.createElement("textarea");
    textarea.value = text;
    textarea.style.position = "fixed";
    textarea.style.left = "-999999px";
    textarea.style.top = "-999999px";
    textarea.setAttribute("readonly", "");
    document.body.appendChild(textarea);
    textarea.focus();
    textarea.select();
    const successful = document.execCommand("copy");
    document.body.removeChild(textarea);
    return successful;
  } catch (err) {
    console.error("Falha ao copiar para o clipboard via fallback:", err);
    return false;
  }
}

/**
 * Função Principal do Épico:
 * Formata as transações de saída para o Google Sheets e copia para o Clipboard.
 *
 * Colunas na Ordem Exata (separadas por \t):
 * - Coluna A: Data (DD/MM/YYYY)
 * - Coluna B: Vazia (\t)
 * - Coluna C: Vazia (\t)
 * - Coluna D: Motivo/Destino ([Estabelecimento] - [Nome do Colaborador/Titular])
 * - Coluna E: Banco ("Caju" | "Nubank")
 * - Coluna F: Valor (Formatado em número decimal pt-BR, sem R$)
 *
 * @param transactions Lista de transações visíveis/filtradas
 * @param bankName Nome do banco ('Caju' | 'Nubank')
 */
export async function copyOutflowsToSheets(
  transactions: TransactionLike[],
  bankName: SupportedBankName
): Promise<CopyOutflowsResult> {
  const outflows = (transactions || []).filter(isOutflowTransaction);

  // Tratamento de lista sem saídas
  if (outflows.length === 0) {
    const emptyMsg = "Nenhuma saída encontrada neste período.";
    toast.warning(emptyMsg);
    return {
      success: false,
      count: 0,
      message: emptyMsg,
    };
  }

  // Mapeamento das linhas TSV (com suporte a desmembramento de pagamentos consolidados como ART CREA)
  const lines: string[] = [];

  for (const tx of outflows) {
    const rawDate = tx.occurred_at || tx.created_at || tx.date || tx.item_date;
    const colA = formatDateToDDMMYYYY(rawDate);
    const colB = "";
    const colC = "";
    const colE = bankName;

    const descUpper = String(tx.description || "").toUpperCase();
    const amountVal = Math.abs(
      typeof tx.amount === "number"
        ? tx.amount
        : parseFloat(String(tx.amount || "0").replace(/[^\d.-]/g, ""))
    );

    // Detecção de ART CREA consolidada (3 boletos de R$ 108,39 = R$ 325,17)
    if (descUpper.includes("ART CREA") && Math.abs(amountVal - 325.17) < 0.05) {
      const artBeneficiary = "CONS REGIONAL DE ENGENHARIA E AGRONOMIA";
      const colD = `Lima e Trindade | ${artBeneficiary}`;
      const colF = "108,39";
      for (let i = 0; i < 3; i++) {
        lines.push(`${colA}\t${colB}\t${colC}\t${colD}\t${colE}\t${colF}`);
      }
      continue;
    }

    const colD = formatReasonDestination(tx, bankName);
    const colF = formatAmountNumberOnly(tx.amount);
    lines.push(`${colA}\t${colB}\t${colC}\t${colD}\t${colE}\t${colF}`);
  }

  const formattedTsv = lines.join("\n");
  const copied = await writeTextToClipboard(formattedTsv);

  if (!copied) {
    const errorMsg = "Não foi possível acessar a área de transferência.";
    toast.error(errorMsg);
    return {
      success: false,
      count: lines.length,
      message: errorMsg,
    };
  }

  const plural = lines.length === 1 ? "transação copiada" : "transações copiadas";
  const successMsg = `${lines.length} ${plural}. Cole na coluna A do seu Sheets.`;
  toast.success(successMsg);

  return {
    success: true,
    count: lines.length,
    message: successMsg,
  };
}
