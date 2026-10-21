-- ============================================================================
-- Validador e Conciliador Diário de Extrato Nubank
-- ============================================================================

CREATE TABLE IF NOT EXISTS nubank_daily_reconciliation (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  reconciliation_date DATE NOT NULL,
  system_balance      NUMERIC(14,2) NOT NULL,
  statement_balance   NUMERIC(14,2) NOT NULL,
  difference          NUMERIC(14,2) NOT NULL,
  status              TEXT NOT NULL CHECK (status IN ('CONCILIADO', 'DIVERGENTE')),
  total_entries       NUMERIC(14,2) DEFAULT 0,
  total_exits         NUMERIC(14,2) DEFAULT 0,
  matched_count       INT DEFAULT 0,
  unmatched_count     INT DEFAULT 0,
  source_file_name    TEXT,
  notes               TEXT,
  created_by          UUID,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT uq_nubank_reconciliation_date UNIQUE (reconciliation_date)
);

CREATE INDEX IF NOT EXISTS idx_nubank_daily_recon_date 
  ON nubank_daily_reconciliation (reconciliation_date DESC);

CREATE TABLE IF NOT EXISTS nubank_statement_items (
  id                   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  reconciliation_id    UUID REFERENCES nubank_daily_reconciliation(id) ON DELETE CASCADE,
  item_date            DATE NOT NULL,
  amount               NUMERIC(14,2) NOT NULL,
  description          TEXT NOT NULL,
  identifier           TEXT,
  matched              BOOLEAN NOT NULL DEFAULT false,
  matched_movement_id  UUID REFERENCES nubank_movements(id) ON DELETE SET NULL,
  created_at           TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_nubank_stmt_items_date 
  ON nubank_statement_items (item_date DESC);

-- Enable RLS
ALTER TABLE nubank_daily_reconciliation ENABLE ROW LEVEL SECURITY;
ALTER TABLE nubank_statement_items ENABLE ROW LEVEL SECURITY;
