export type UserRole = "FINANCEIRO" | "GESTOR" | "MASTER";

export interface UserSector {
  id: string;
  name: string;
  is_deleted?: boolean;
  created_at?: string;
}

export type RequestVisibility = "COMPARTILHADA" | "INDIVIDUAL";

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

export interface StageHistoryItem {
  stage: string;
  entered_at: string;
  left_at?: string | null;
  duration_seconds?: number | null;
  moved_by?: string | null;
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
  payment_type: "Pix" | "Caju" | "Boleto" | "FOPAG" | "Retirada de Saldo" | string;
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
  barcode?: string | null;
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
  stage_history?: StageHistoryItem[] | null;
  ai_category_suggestion?: AiCategorySuggestion | null;
  payment_conversion_log?: PaymentConversionLog | null;
  balance_processed?: boolean | null;
  request_kind?: "RECARGA_NUBANK" | "RECARGA_CAJU" | null;
  pending_edit?: PendingEdit | null;
  edit_history?: EditHistoryItem[] | null;
  
  visibility?: RequestVisibility | null;
  profiles?: Profile;
  category?: string | null;
}

export interface PaymentConversionLog {
  convertedAt: string;
  convertedBy: string;
  originalMethod: string;
  newMethod: "PIX";
  collaboratorPixKey: string;
  cajuBalanceWithdrawn: boolean;
  reason: string;
}

export interface AiCategorySuggestion {
  category?: string | null;
  is_new_category_suggested: boolean;
  suggested_category_name?: string | null;
  confidence: number;
  reason: string;
}

export interface CategorySuggestion {
  id: string;
  name: string;
  reason?: string | null;
  confidence?: number;
  sample_request_id?: string | null;
  sample_request_title?: string | null;
  status: "PENDENTE" | "APROVADO" | "REJEITADO";
  created_at: string;
  updated_at: string;
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

export interface PendingEditData {
  title: string;
  amount: number;
  category?: string | null;
  category_id?: string | null;
  notes?: string | null;
  payment_type?: string | null;
  splits?: SplitPayment[] | null;
  pix_key?: string | null;
  pix_owner?: string | null;
  caju_phone?: string | null;
}

export interface PendingEdit {
  requested_by_id: string;
  requested_by_name: string;
  requested_at: string;
  reason: string;
  original_data: PendingEditData;
  new_data: PendingEditData;
}

export interface EditHistoryItem {
  id: string;
  action: "AUTHORIZED" | "REJECTED" | "DIRECT_EDIT";
  performed_by_id: string;
  performed_by_name: string;
  performed_at: string;
  reason?: string | null;
  changes_summary?: string;
  previous_data?: PendingEditData;
  applied_data?: PendingEditData;
}
