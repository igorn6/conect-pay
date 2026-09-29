-- =============================================================
-- Maker-Checker Migration Script
-- Execute este script no SQL Editor do painel Supabase.
-- =============================================================

-- 1. Adicionar novas colunas
ALTER TABLE payment_requests
  ADD COLUMN IF NOT EXISTS rejection_reason TEXT,
  ADD COLUMN IF NOT EXISTS receipts_history JSONB DEFAULT '[]'::jsonb;

-- 2. Migrar status antigos para os novos
UPDATE payment_requests
  SET status = 'VALIDACAO_GESTOR'
  WHERE status = 'AGUARDANDO_NOTINHA';

UPDATE payment_requests
  SET status = 'FINALIZADO'
  WHERE status = 'PAGAMENTO_FINALIZADO';

-- 3. (Opcional) Popula receipts_history com comprovantes ja existentes
-- para nao perder dados antigos de payment_proof_url
UPDATE payment_requests
  SET receipts_history = jsonb_build_array(
    jsonb_build_object(
      'url', payment_proof_url,
      'uploadedAt', updated_at::text,
      'uploadedBy', created_by
    )
  )
  WHERE payment_proof_url IS NOT NULL
    AND payment_proof_url != ''
    AND (receipts_history IS NULL OR receipts_history = '[]'::jsonb);

-- =============================================================
-- FIM. Apos executar, verifique com:
-- SELECT status, count(*) FROM payment_requests GROUP BY status;
-- =============================================================
