import { KanbanColumnConfig } from '@/types/database';

export const KANBAN_COLUMNS: KanbanColumnConfig[] = [
  {
    key: "NOVA_SOLICITACAO",
    label: "Novas Solicitações",
    color: "#64748b",
    bgColor: "#64748b10"
  },
  {
    key: "EM_APROVACAO",
    label: "Pendente",
    color: "#f59e0b",
    bgColor: "#f59e0b10"
  },
  {
    key: "VALIDACAO_GESTOR",
    label: "Validação do Gestor",
    color: "#a855f7",
    bgColor: "#a855f710"
  },
  {
    key: "CORRECAO_PENDENTE",
    label: "Correção Pendente",
    color: "#f97316",
    bgColor: "#f9731610"
  },
  {
    key: "VALIDADO_GESTOR",
    label: "Validado pelo Gestor",
    color: "#d946ef",
    bgColor: "#d946ef10"
  },
  {
    key: "AGUARDANDO_PAGAMENTO",
    label: "Aguardando Nota",
    color: "#3b82f6",
    bgColor: "#3b82f610"
  },
  {
    key: "FINALIZADO",
    label: "Finalizado",
    color: "#10b981",
    bgColor: "#10b98110"
  },
  {
    key: "RECUSADO",
    label: "Recusado",
    color: "#ef4444",
    bgColor: "#ef444410"
  }
];

export const STATUS_LABELS: Record<string, string> = {
  NOVA_SOLICITACAO: "Novas Solicitações",
  EM_APROVACAO: "Pendente",
  VALIDACAO_GESTOR: "Validação do Gestor",
  CORRECAO_PENDENTE: "Correção Pendente",
  VALIDADO_GESTOR: "Validado pelo Gestor",
  AGUARDANDO_PAGAMENTO: "Aguardando Nota",
  FINALIZADO: "Finalizado",
  RECUSADO: "Recusado",
};

export function getStatusLabel(status: string): string {
  if (!status) return "";
  return STATUS_LABELS[status] || status.replace(/_/g, " ");
}
