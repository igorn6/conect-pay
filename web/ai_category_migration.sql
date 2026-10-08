-- =============================================================
-- Migration: AI Categorization & Suggestions System
-- =============================================================

CREATE TABLE IF NOT EXISTS category_suggestions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  reason TEXT,
  confidence NUMERIC DEFAULT 1.0,
  sample_request_id UUID,
  sample_request_title TEXT,
  status TEXT DEFAULT 'PENDENTE', -- 'PENDENTE', 'APROVADO', 'REJEITADO'
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE payment_requests
ADD COLUMN IF NOT EXISTS ai_category_suggestion JSONB DEFAULT NULL;

GRANT ALL ON category_suggestions TO anon, authenticated, service_role;
