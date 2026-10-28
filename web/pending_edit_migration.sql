-- =============================================================
-- Migration: Ajuste Manual de Solicitações (Financeiro / Master)
-- Permite que o Financeiro proponha ajustes manuais (valor, título, forma de pagamento, etc.)
-- com aprovação/confirmação explícita obrigatória do Master.
-- =============================================================

ALTER TABLE payment_requests
ADD COLUMN IF NOT EXISTS pending_edit JSONB DEFAULT NULL,
ADD COLUMN IF NOT EXISTS edit_history JSONB DEFAULT '[]'::jsonb;

COMMENT ON COLUMN payment_requests.pending_edit IS 
'Registro de alteração pendente de autorização do Master solicitada pelo Financeiro. Estrutura: { requested_by_id, requested_by_name, requested_at, reason, original_data, new_data }';

COMMENT ON COLUMN payment_requests.edit_history IS 
'Histórico cronológico de alterações autorizadas/recusadas pelo Master.';
