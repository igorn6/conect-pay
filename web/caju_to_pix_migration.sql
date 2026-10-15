-- =============================================================
-- Migration: Conversão de Caju para Pix Pós-Fechamento
-- Adiciona a coluna payment_conversion_log (JSONB) na tabela payment_requests
-- =============================================================

ALTER TABLE payment_requests
ADD COLUMN IF NOT EXISTS payment_conversion_log JSONB DEFAULT NULL;

COMMENT ON COLUMN payment_requests.payment_conversion_log IS 
'Registro de conversão de modalidade pós-fechamento (ex: Caju para Pix). Estrutura: { convertedAt, convertedBy, originalMethod, newMethod, collaboratorPixKey, cajuBalanceWithdrawn, reason }';
