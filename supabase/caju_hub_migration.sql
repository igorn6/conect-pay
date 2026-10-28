-- =====================================================================
-- CAJU HUB — Migração idempotente (pode ser executada várias vezes)
-- Marco zero: 27/10/2026 12:04:21 (America/Bahia, -03:00)
--   Saldo Livre inicial ........ R$ 5.845,80
--   Saldo nos Cartões (44) ..... R$ 6.555,31
--   Patrimônio Total ........... R$ 12.401,11
-- =====================================================================

-- 1. Carteira (Saldo Livre / Caixa Despesas p/ Distribuir)
CREATE TABLE IF NOT EXISTS caju_wallet (
  id            TEXT PRIMARY KEY DEFAULT 'caju',
  free_balance  NUMERIC(14,2) NOT NULL DEFAULT 0,
  cutoff_at     TIMESTAMPTZ   NOT NULL,
  updated_at    TIMESTAMPTZ   NOT NULL DEFAULT now()
);

INSERT INTO caju_wallet (id, free_balance, cutoff_at)
VALUES ('caju', 5845.80, '2026-10-27T12:04:21-03:00')
ON CONFLICT (id) DO NOTHING;

-- 2. Colaboradores (saldo individual nos cartões)
CREATE TABLE IF NOT EXISTS caju_collaborators (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name        TEXT NOT NULL,
  cpf         TEXT NOT NULL UNIQUE,            -- apenas dígitos (11)
  balance     NUMERIC(14,2) NOT NULL DEFAULT 0,
  is_seed     BOOLEAN NOT NULL DEFAULT false,  -- veio do marco zero oficial
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 3. Lotes de importação de extrato CSV
CREATE TABLE IF NOT EXISTS caju_import_batches (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  file_name        TEXT,
  total_rows       INT NOT NULL DEFAULT 0,
  completed_rows   INT NOT NULL DEFAULT 0,
  inserted_rows    INT NOT NULL DEFAULT 0,
  duplicate_rows   INT NOT NULL DEFAULT 0,
  ignored_rows     INT NOT NULL DEFAULT 0,
  applied_rows     INT NOT NULL DEFAULT 0,
  new_collaborators INT NOT NULL DEFAULT 0,
  created_by       UUID,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 4. Transações do extrato (histórico oficial + anti-duplicidade por hash)
CREATE TABLE IF NOT EXISTS caju_transactions (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tx_hash               TEXT NOT NULL UNIQUE,
  advance_name          TEXT,
  collaborator_name     TEXT NOT NULL,
  cpf                   TEXT NOT NULL,
  collaborator_id       UUID REFERENCES caju_collaborators(id) ON DELETE SET NULL,
  tx_type               TEXT NOT NULL CHECK (tx_type IN ('DEPOSITO','RESGATE','COMPRA','OUTRO')),
  raw_type              TEXT,
  merchant              TEXT,
  amount                NUMERIC(14,2) NOT NULL,  -- sempre positivo
  occurred_at           TIMESTAMPTZ NOT NULL,
  applied_to_balance    BOOLEAN NOT NULL DEFAULT false, -- true = posterior ao marco zero e já refletido nos saldos
  reconciliation_status TEXT NOT NULL DEFAULT 'NAO_APLICAVEL'
                        CHECK (reconciliation_status IN ('CONCILIADO','SEM_CONCILIACAO','NAO_APLICAVEL')),
  match_kind            TEXT CHECK (match_kind IN ('EXATO','PARCIAL')),
  matched_request_id    UUID,
  match_details         JSONB,
  import_batch_id       UUID REFERENCES caju_import_batches(id) ON DELETE SET NULL,
  created_at            TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_caju_tx_occurred ON caju_transactions (occurred_at DESC);
CREATE INDEX IF NOT EXISTS idx_caju_tx_cpf ON caju_transactions (cpf);
CREATE INDEX IF NOT EXISTS idx_caju_tx_type ON caju_transactions (tx_type);

-- 5. Livro-razão de movimentações internas (recargas, ajustes, aplicações do extrato)
CREATE TABLE IF NOT EXISTS caju_movements (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  type                TEXT NOT NULL CHECK (type IN (
                        'RECARGA','RECARGA_ESTORNO','AJUSTE_LIVRE','AJUSTE_COLABORADOR',
                        'DEPOSITO','RESGATE','COMPRA')),
  free_delta          NUMERIC(14,2) NOT NULL DEFAULT 0,
  cards_delta         NUMERIC(14,2) NOT NULL DEFAULT 0,
  free_balance_after  NUMERIC(14,2),
  collaborator_id     UUID REFERENCES caju_collaborators(id) ON DELETE SET NULL,
  transaction_id      UUID REFERENCES caju_transactions(id) ON DELETE SET NULL,
  payment_request_id  UUID,
  description         TEXT,
  created_by          UUID,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_caju_mov_created ON caju_movements (created_at DESC);

-- 6. Controle idempotente das recargas vindas do Kanban
CREATE TABLE IF NOT EXISTS caju_recharge_credits (
  payment_request_id UUID PRIMARY KEY,
  amount             NUMERIC(14,2) NOT NULL,
  credited           BOOLEAN NOT NULL DEFAULT false,
  is_baseline        BOOLEAN NOT NULL DEFAULT false, -- já contemplada no marco zero (sem efeito no saldo)
  updated_at         TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- =====================================================================
-- FUNÇÕES ATÔMICAS
-- =====================================================================

-- Importa um lote de transações (jsonb array) de forma atômica e idempotente.
-- Cada item: {hash, advance_name, collaborator_name, cpf, tx_type, raw_type, merchant, amount, occurred_at}
CREATE OR REPLACE FUNCTION caju_import_rows(p_rows JSONB, p_batch UUID, p_user UUID)
RETURNS JSONB LANGUAGE plpgsql AS $$
DECLARE
  r            JSONB;
  v_cutoff     TIMESTAMPTZ;
  v_collab     UUID;
  v_tx         UUID;
  v_new_collab BOOLEAN;
  v_after      TIMESTAMPTZ;
  v_amount     NUMERIC;
  v_type       TEXT;
  v_free_d     NUMERIC;
  v_card_d     NUMERIC;
  v_free_after NUMERIC;
  n_ins INT := 0; n_dup INT := 0; n_app INT := 0; n_new INT := 0;
  v_inserted   UUID[] := '{}';
BEGIN
  SELECT cutoff_at INTO v_cutoff FROM caju_wallet WHERE id = 'caju' FOR UPDATE;

  FOR r IN SELECT * FROM jsonb_array_elements(p_rows) LOOP
    -- Anti-duplicidade imediata
    IF EXISTS (SELECT 1 FROM caju_transactions WHERE tx_hash = r->>'hash') THEN
      n_dup := n_dup + 1;
      CONTINUE;
    END IF;

    -- Auto-cadastro do colaborador (chave: CPF)
    SELECT id INTO v_collab FROM caju_collaborators WHERE cpf = r->>'cpf';
    v_new_collab := false;
    IF v_collab IS NULL THEN
      INSERT INTO caju_collaborators (name, cpf, balance, is_seed)
      VALUES (r->>'collaborator_name', r->>'cpf', 0, false)
      RETURNING id INTO v_collab;
      v_new_collab := true;
      n_new := n_new + 1;
    END IF;

    v_after  := (r->>'occurred_at')::timestamptz;
    v_amount := ROUND(ABS((r->>'amount')::numeric), 2);
    v_type   := r->>'tx_type';

    INSERT INTO caju_transactions (
      tx_hash, advance_name, collaborator_name, cpf, collaborator_id, tx_type, raw_type,
      merchant, amount, occurred_at, applied_to_balance, reconciliation_status, import_batch_id)
    VALUES (
      r->>'hash', r->>'advance_name', r->>'collaborator_name', r->>'cpf', v_collab, v_type, r->>'raw_type',
      r->>'merchant', v_amount, v_after, false,
      CASE WHEN v_type = 'DEPOSITO' THEN 'SEM_CONCILIACAO' ELSE 'NAO_APLICAVEL' END,
      p_batch)
    ON CONFLICT (tx_hash) DO NOTHING
    RETURNING id INTO v_tx;

    IF v_tx IS NULL THEN
      n_dup := n_dup + 1;
      CONTINUE;
    END IF;
    n_ins := n_ins + 1;
    v_inserted := array_append(v_inserted, v_tx);

    -- Somente transações POSTERIORES ao marco zero alteram os saldos
    IF v_after > v_cutoff AND v_type IN ('DEPOSITO','RESGATE','COMPRA') THEN
      IF v_type = 'DEPOSITO' THEN
        v_free_d := -v_amount; v_card_d := v_amount;
      ELSIF v_type = 'RESGATE' THEN
        v_free_d := v_amount;  v_card_d := -v_amount;
      ELSE
        v_free_d := 0;         v_card_d := -v_amount;
      END IF;

      UPDATE caju_collaborators SET balance = balance + v_card_d, updated_at = now() WHERE id = v_collab;
      UPDATE caju_wallet SET free_balance = free_balance + v_free_d, updated_at = now()
       WHERE id = 'caju' RETURNING free_balance INTO v_free_after;
      UPDATE caju_transactions SET applied_to_balance = true WHERE id = v_tx;

      INSERT INTO caju_movements (type, free_delta, cards_delta, free_balance_after, collaborator_id,
                                  transaction_id, description, created_by, created_at)
      VALUES (v_type, v_free_d, v_card_d, v_free_after, v_collab, v_tx,
              initcap(lower(r->>'raw_type')) || ' • ' || (r->>'collaborator_name') ||
              COALESCE(' • ' || NULLIF(r->>'merchant',''), ''),
              p_user, v_after);
      n_app := n_app + 1;
    END IF;
  END LOOP;

  RETURN jsonb_build_object('inserted', n_ins, 'duplicates', n_dup, 'applied', n_app,
                            'new_collaborators', n_new, 'inserted_ids', to_jsonb(v_inserted));
END;
$$;

-- Crédito / estorno idempotente de Recarga Caju vinda do Kanban
CREATE OR REPLACE FUNCTION caju_sync_recharge(p_request_id UUID, p_amount NUMERIC, p_should_credit BOOLEAN,
                                              p_description TEXT, p_user UUID)
RETURNS JSONB LANGUAGE plpgsql AS $$
DECLARE
  v_row   caju_recharge_credits%ROWTYPE;
  v_after NUMERIC;
  v_amt   NUMERIC := ROUND(ABS(p_amount), 2);
BEGIN
  PERFORM 1 FROM caju_wallet WHERE id = 'caju' FOR UPDATE;
  SELECT * INTO v_row FROM caju_recharge_credits WHERE payment_request_id = p_request_id FOR UPDATE;

  IF v_row.payment_request_id IS NOT NULL AND v_row.is_baseline THEN
    RETURN jsonb_build_object('processed', false, 'reason', 'baseline');
  END IF;

  IF p_should_credit THEN
    IF v_row.payment_request_id IS NOT NULL AND v_row.credited THEN
      RETURN jsonb_build_object('processed', false, 'reason', 'already_credited');
    END IF;
    UPDATE caju_wallet SET free_balance = free_balance + v_amt, updated_at = now()
     WHERE id = 'caju' RETURNING free_balance INTO v_after;
    INSERT INTO caju_recharge_credits (payment_request_id, amount, credited, updated_at)
    VALUES (p_request_id, v_amt, true, now())
    ON CONFLICT (payment_request_id) DO UPDATE SET amount = EXCLUDED.amount, credited = true, updated_at = now();
    INSERT INTO caju_movements (type, free_delta, free_balance_after, payment_request_id, description, created_by)
    VALUES ('RECARGA', v_amt, v_after, p_request_id, p_description, p_user);
    RETURN jsonb_build_object('processed', true, 'action', 'CREDIT', 'free_balance', v_after);
  ELSE
    IF v_row.payment_request_id IS NULL OR NOT v_row.credited THEN
      RETURN jsonb_build_object('processed', false, 'reason', 'nothing_to_revert');
    END IF;
    UPDATE caju_wallet SET free_balance = free_balance - v_row.amount, updated_at = now()
     WHERE id = 'caju' RETURNING free_balance INTO v_after;
    UPDATE caju_recharge_credits SET credited = false, updated_at = now() WHERE payment_request_id = p_request_id;
    INSERT INTO caju_movements (type, free_delta, free_balance_after, payment_request_id, description, created_by)
    VALUES ('RECARGA_ESTORNO', -v_row.amount, v_after, p_request_id, p_description, p_user);
    RETURN jsonb_build_object('processed', true, 'action', 'REVERT', 'free_balance', v_after);
  END IF;
END;
$$;

-- Ajuste manual do Saldo Livre (entrada +valor ou valor absoluto)
CREATE OR REPLACE FUNCTION caju_adjust_free(p_delta NUMERIC, p_absolute NUMERIC, p_description TEXT, p_user UUID)
RETURNS JSONB LANGUAGE plpgsql AS $$
DECLARE v_cur NUMERIC; v_new NUMERIC; v_delta NUMERIC;
BEGIN
  SELECT free_balance INTO v_cur FROM caju_wallet WHERE id = 'caju' FOR UPDATE;
  IF p_absolute IS NOT NULL THEN v_new := ROUND(p_absolute, 2); v_delta := v_new - v_cur;
  ELSE v_delta := ROUND(p_delta, 2); v_new := v_cur + v_delta; END IF;
  UPDATE caju_wallet SET free_balance = v_new, updated_at = now() WHERE id = 'caju';
  INSERT INTO caju_movements (type, free_delta, free_balance_after, description, created_by)
  VALUES ('AJUSTE_LIVRE', v_delta, v_new, p_description, p_user);
  RETURN jsonb_build_object('free_balance', v_new, 'delta', v_delta);
END;
$$;

-- Ajuste manual do saldo de um colaborador (MASTER) — valor absoluto
CREATE OR REPLACE FUNCTION caju_adjust_collaborator(p_collaborator UUID, p_absolute NUMERIC, p_description TEXT, p_user UUID)
RETURNS JSONB LANGUAGE plpgsql AS $$
DECLARE v_cur NUMERIC; v_new NUMERIC := ROUND(p_absolute, 2); v_free NUMERIC;
BEGIN
  SELECT balance INTO v_cur FROM caju_collaborators WHERE id = p_collaborator FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Colaborador não encontrado'; END IF;
  UPDATE caju_collaborators SET balance = v_new, updated_at = now() WHERE id = p_collaborator;
  SELECT free_balance INTO v_free FROM caju_wallet WHERE id = 'caju';
  INSERT INTO caju_movements (type, cards_delta, free_balance_after, collaborator_id, description, created_by)
  VALUES ('AJUSTE_COLABORADOR', v_new - v_cur, v_free, p_collaborator, p_description, p_user);
  RETURN jsonb_build_object('balance', v_new, 'delta', v_new - v_cur);
END;
$$;
