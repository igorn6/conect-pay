-- =============================================================
-- Migration: Stage History & SLA Tracking
-- Adiciona a coluna stage_history na tabela payment_requests
-- =============================================================

ALTER TABLE payment_requests
  ADD COLUMN IF NOT EXISTS stage_history JSONB DEFAULT '[]'::jsonb;

-- Popula stage_history para cards existentes que ainda não possuem histórico
UPDATE payment_requests
SET stage_history = jsonb_build_array(
  jsonb_build_object(
    'stage', 'NOVA_SOLICITACAO',
    'entered_at', created_at::text,
    'left_at', CASE WHEN status = 'NOVA_SOLICITACAO' THEN NULL ELSE updated_at::text END,
    'duration_seconds', CASE 
      WHEN status = 'NOVA_SOLICITACAO' THEN NULL 
      ELSE GREATEST(0, ROUND(EXTRACT(EPOCH FROM (updated_at - created_at))))
    END
  ),
  CASE WHEN status != 'NOVA_SOLICITACAO' THEN
    jsonb_build_object(
      'stage', status::text,
      'entered_at', updated_at::text,
      'left_at', NULL,
      'duration_seconds', NULL
    )
  ELSE NULL END
) - 'null'
WHERE stage_history IS NULL OR stage_history = '[]'::jsonb;
