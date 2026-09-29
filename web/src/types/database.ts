export type UserRole = "FINANCEIRO" | "GESTOR" | "MASTER";

export interface UserSector {
  id: string;
  name: string;
  is_deleted?: boolean;
  created_at?: string;
}

export type RequestStatus =
  | "NOVA_SOLICITACAO"
  | "EM_APROVACAO"
  | "AGUARDANDO_PAGAMENTO" | "VALIDADO_GESTOR"
  | "VALIDACAO_GESTOR"
  | "CORRECAO_PENDENTE"
  | "FINALIZADO"
  | "RECUSADO";

export interface ReceiptHistoryItem {
  url: string;
  uploadedAt: string;
  uploadedBy: string;
}

export interface Profile {
  id: string;
  name: string;
  email?: string;
  role: UserRole;
  sector?: string | null;
  avatar_url?: string | null;
  created_at?: string;
  updated_at?: string;
  must_change_password?: boolean;
}

export interface Category {
  id: string;
  name: string;
  color: string;
  created_at?: string;
}

export interface SplitPayment {
  id: string;
  payment_type: "Pix" | "Caju" | string;
  amount: number;
  pix_owner?: string | null;
  pix_key?: string | null;
  caju_phone?: string | null;
  boleto_barcode?: string | null;
  boleto_due_date?: string | null;
  boleto_notes?: string | null;
}

export interface PaymentRequest {
  id: string;
  title: string;
  description: string | null;
  amount: number;
  due_date: string;
  category_id: string;
  status: RequestStatus;
  invoice_url: string | null;
  barcode: string | null;
  payment_method: string | null;
  pix_key: string | null;
  pix_name?: string | null;
  caju_phone?: string | null;
  created_by: string;
  real_requester_id: string;
  created_at: string;
  updated_at: string;
  
  notes?: string | null;
  splits?: SplitPayment[] | null;
  pix_owner?: string | null;
  cnpj?: string | null;
  payment_type?: string | null;
  payment_proof_url?: string | null;
  refusal_reason?: string | null;
  rejection_reason?: string | null;
  receipts_history?: ReceiptHistoryItem[] | null;
  
  profiles?: Profile;
  category?: string | null;
}

export interface AuditLog {
  id: string;
  request_id: string;
  action: string;
  performed_by: string;
  old_status: RequestStatus | null;
  new_status: RequestStatus | null;
  notes: string | null;
  created_at: string;
  profiles?: Profile;
}

export interface KanbanColumnConfig {
  key: RequestStatus;
  label: string;
  color: string;
  bgColor: string;
}
