-- ============================================================================
-- Validador de Saldo Nubank (Cofre Nubank)
-- Registro da migração (já aplicada via script). Idempotente: pode rodar de novo.
-- ============================================================================

-- 1) Campos de controle nos cartões -------------------------------------------
ALTER TABLE payment_requests ADD COLUMN IF NOT EXISTS balance_processed BOOLEAN NOT NULL DEFAULT false;
-- 'RECARGA_NUBANK' | 'RECARGA_CAJU' | NULL (solicitação comum)
ALTER TABLE payment_requests ADD COLUMN IF NOT EXISTS request_kind TEXT;

-- 2) Backfill (executa UMA única vez, antes das tabelas existirem) -------------
-- Cartões que já passaram da coluna "Pendente" antes desta funcionalidade já foram
-- pagos ANTES do saldo inicial (R$ 609,74) e não podem descontar de novo.
DO $$
BEGIN
  IF to_regclass('public.nubank_balance') IS NULL THEN
    UPDATE payment_requests
       SET balance_processed = true
     WHERE status NOT IN ('NOVA_SOLICITACAO', 'EM_APROVACAO', 'RECUSADO');
  END IF;
END $$;

-- 3) Saldo atual (linha única) -------------------------------------------------
CREATE TABLE IF NOT EXISTS nubank_balance (
  id         TEXT PRIMARY KEY DEFAULT 'nubank',
  balance    NUMERIC(14,2) NOT NULL DEFAULT 609.74,
  updated_at TIMESTAMPTZ   NOT NULL DEFAULT now()
);
INSERT INTO nubank_balance (id, balance) VALUES ('nubank', 609.74) ON CONFLICT (id) DO NOTHING;

-- 4) Histórico de movimentações -------------------------------------------------
CREATE TABLE IF NOT EXISTS nubank_movements (
  id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  type               TEXT NOT NULL CHECK (type IN ('ENTRADA', 'SAIDA', 'REEMBOLSO', 'AJUSTE')),
  amount             NUMERIC(14,2) NOT NULL,        -- delta com sinal (+ entra / - sai)
  balance_after      NUMERIC(14,2) NOT NULL,
  description        TEXT,
  payment_request_id UUID REFERENCES payment_requests(id) ON DELETE SET NULL,
  created_by         UUID,
  created_at         TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_nubank_movements_created_at ON nubank_movements (created_at DESC);

-- Acesso somente via service role (API). Sem policies = anon/authenticated bloqueados.
ALTER TABLE nubank_balance   ENABLE ROW LEVEL SECURITY;
ALTER TABLE nubank_movements ENABLE ROW LEVEL SECURITY;

-- 5) Função atômica ---------------------------------------------------------------
-- p_request_id informado => trava anti-duplicidade: só aplica se conseguir virar
-- balance_processed de false para true NA MESMA transação.
-- p_absolute informado   => ajuste manual (define o saldo exato; delta é calculado).
CREATE OR REPLACE FUNCTION apply_nubank_movement(
  p_type        TEXT,
  p_delta       NUMERIC,
  p_description TEXT,
  p_user        UUID,
  p_request_id  UUID    DEFAULT NULL,
  p_absolute    NUMERIC DEFAULT NULL
) RETURNS JSONB
LANGUAGE plpgsql
AS $$
DECLARE
  v_balance NUMERIC;
  v_new     NUMERIC;
  v_delta   NUMERIC;
  v_rows    INT;
BEGIN
  INSERT INTO nubank_balance (id, balance) VALUES ('nubank', 609.74) ON CONFLICT (id) DO NOTHING;

  IF p_request_id IS NOT NULL THEN
    UPDATE payment_requests
       SET balance_processed = true
     WHERE id = p_request_id AND balance_processed = false;
    GET DIAGNOSTICS v_rows = ROW_COUNT;
    IF v_rows = 0 THEN
      SELECT balance INTO v_balance FROM nubank_balance WHERE id = 'nubank';
      RETURN jsonb_build_object('processed', false, 'balance', v_balance);
    END IF;
  END IF;

  SELECT balance INTO v_balance FROM nubank_balance WHERE id = 'nubank' FOR UPDATE;

  IF p_absolute IS NOT NULL THEN
    v_new   := ROUND(p_absolute, 2);
    v_delta := v_new - v_balance;
  ELSE
    v_delta := ROUND(p_delta, 2);
    v_new   := v_balance + v_delta;
  END IF;

  UPDATE nubank_balance SET balance = v_new, updated_at = now() WHERE id = 'nubank';

  INSERT INTO nubank_movements (type, amount, balance_after, description, payment_request_id, created_by)
  VALUES (p_type, v_delta, v_new, p_description, p_request_id, p_user);

  RETURN jsonb_build_object('processed', true, 'balance', v_new, 'delta', v_delta);
END;
$$;

-- 6) Função atômica de estorno / reversão de saldo --------------------------------
-- Chamada ao excluir o card (lixeira), recusar, retornar status ou trocar pagador.
-- Desfaz o saldo atômica e idempotentemente e seta balance_processed = false.
CREATE OR REPLACE FUNCTION revert_nubank_movement(
  p_request_id  UUID,
  p_user        UUID,
  p_description TEXT DEFAULT NULL
) RETURNS JSONB
LANGUAGE plpgsql
AS $$
DECLARE
  v_balance   NUMERIC;
  v_new       NUMERIC;
  v_delta     NUMERIC;
  v_rows      INT;
  v_card      RECORD;
  v_desc      TEXT;
  v_type      TEXT;
BEGIN
  -- Garante registro de saldo se não existir
  INSERT INTO nubank_balance (id, balance) VALUES ('nubank', 609.74) ON CONFLICT (id) DO NOTHING;

  -- 1) Busca dados do cartão
  SELECT id, title, amount, cnpj, request_kind, balance_processed, is_deleted, status
    INTO v_card
    FROM payment_requests
   WHERE id = p_request_id;

  IF NOT FOUND THEN
    SELECT balance INTO v_balance FROM nubank_balance WHERE id = 'nubank';
    RETURN jsonb_build_object('processed', false, 'reason', 'Cartão não encontrado.', 'balance', v_balance);
  END IF;

  -- 2) Trava anti-duplicidade atômica: só executa se balance_processed for true
  UPDATE payment_requests
     SET balance_processed = false
   WHERE id = p_request_id AND balance_processed = true;
  GET DIAGNOSTICS v_rows = ROW_COUNT;

  IF v_rows = 0 THEN
    SELECT balance INTO v_balance FROM nubank_balance WHERE id = 'nubank';
    RETURN jsonb_build_object('processed', false, 'reason', 'Cartão não estava com saldo debitado.', 'balance', v_balance);
  END IF;

  -- 3) Determina se despesa (devolve saldo +) ou recarga (retira saldo -)
  IF v_card.request_kind = 'RECARGA_NUBANK' THEN
    v_delta := -ROUND(COALESCE(v_card.amount, 0), 2);
    v_type  := 'AJUSTE';
    v_desc  := COALESCE(p_description, 'Estorno de Recarga Nubank: ' || COALESCE(v_card.title, 'Sem título'));
  ELSE
    v_delta := ROUND(COALESCE(v_card.amount, 0), 2);
    v_type  := 'REEMBOLSO';
    v_desc  := COALESCE(p_description, 'Estorno Nubank: ' || COALESCE(v_card.title, 'Sem título'));
  END IF;

  -- 4) Atualiza o saldo Nubank com lock de linha
  SELECT balance INTO v_balance FROM nubank_balance WHERE id = 'nubank' FOR UPDATE;
  v_new := v_balance + v_delta;
  UPDATE nubank_balance SET balance = v_new, updated_at = now() WHERE id = 'nubank';

  -- 5) Registra movimentação no histórico
  INSERT INTO nubank_movements (type, amount, balance_after, description, payment_request_id, created_by)
  VALUES (v_type, v_delta, v_new, v_desc, p_request_id, p_user);

  RETURN jsonb_build_object('processed', true, 'balance', v_new, 'delta', v_delta);
END;
$$;
