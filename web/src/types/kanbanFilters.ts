export type KanbanScopeFilter = "ALL" | "MINE";

export type KanbanPeriodMode =
  | "ALL"
  | "DUE_TODAY_OR_OVERDUE"
  | "DUE_NEXT_7D"
  | "THIS_MONTH"
  | "LAST_MONTH"
  | "MONTH";

export type KanbanConditionFilter =
  | "NO_INVOICE"
  | "HAS_INVOICE"
  | "NO_PROOF"
  | "ATTENTION"
  | "RECHARGE";

export interface KanbanFilterState {
  search: string;
  scope: KanbanScopeFilter;
  periodMode: KanbanPeriodMode;
  month: string; // "YYYY-MM" when periodMode === "MONTH"
  category: string; // exact trimmed category name or ""
  requesterId: string;
  sectorId: string;
  paymentTypes: string[]; // "PIX" | "BOLETO" | "CAJU" | "FOPAG" | "RETIRADA_DE_SALDO"
  cnpj: string; // "" | "NONE" | "Nubank 02" | "CNPJ 1" | ...
  conditions: KanbanConditionFilter[];
}

export interface KanbanFacetCounts {
  scopeCounts: { ALL: number; MINE: number };
  categoryCounts: Record<string, number>;
  requesterCounts: Record<string, number>;
  sectorCounts: Record<string, number>;
  paymentTypeCounts: Record<string, number>;
  cnpjCounts: Record<string, number>;
  monthCounts: Record<string, number>;
  conditionCounts: Record<KanbanConditionFilter, number>;
  hiddenUrgentCount: number;
}

export interface KanbanActiveChip {
  id: string;
  label: string;
  onRemove: () => void;
}

export const DEFAULT_KANBAN_FILTERS: KanbanFilterState = {
  search: "",
  scope: "ALL",
  periodMode: "ALL",
  month: "",
  category: "",
  requesterId: "",
  sectorId: "",
  paymentTypes: [],
  cnpj: "",
  conditions: [],
};

export const PAYMENT_FILTER_OPTIONS = [
  { value: "PIX", label: "Pix" },
  { value: "BOLETO", label: "Boleto" },
  { value: "CAJU", label: "Caju" },
  { value: "FOPAG", label: "FOPAG" },
  { value: "RETIRADA_DE_SALDO", label: "Retirada de Saldo" },
] as const;

export const CNPJ_FILTER_OPTIONS = [
  { value: "NONE", label: "Sem CNPJ definido" },
  { value: "Nubank 02", label: "Nubank 02" },
  { value: "CNPJ 1", label: "CNPJ 1" },
  { value: "CNPJ 2", label: "CNPJ 2" },
  { value: "CNPJ 3", label: "CNPJ 3" },
  { value: "CNPJ 4", label: "CNPJ 4" },
] as const;

export const CONDITION_FILTER_OPTIONS: {
  value: KanbanConditionFilter;
  label: string;
  financeOnly?: boolean;
}[] = [
  { value: "NO_INVOICE", label: "Sem Notinha" },
  { value: "HAS_INVOICE", label: "Com Notinha" },
  { value: "NO_PROOF", label: "Sem Comprovante", financeOnly: true },
  { value: "ATTENTION", label: "Ajuste / Correção", financeOnly: true },
  { value: "RECHARGE", label: "Recargas" },
];

