-- ============================================================================
-- Correção de Estornos Fantasmas e Saneamento do Cofre Nubank
-- ============================================================================

-- 1) Atualiza a função revert_nubank_movement com trava de segurança:
-- Só permite estorno de saldo financeiro se houver registro prévio de SAIDA ou ENTRADA
-- na tabela nubank_movements para o cartão. Caso contrário, apenas limpa a flag.
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
  v_prior_id  UUID;
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

  -- 3) Trava de segurança: verifica se este cartão realmente movimentou o saldo Nubank
  SELECT id INTO v_prior_id
    FROM nubank_movements
   WHERE payment_request_id = p_request_id
     AND type IN ('SAIDA', 'ENTRADA')
   LIMIT 1;

  IF NOT FOUND THEN
    SELECT balance INTO v_balance FROM nubank_balance WHERE id = 'nubank';
    RETURN jsonb_build_object('processed', false, 'reason', 'Cartão não possui movimentação prévia no Nubank.', 'balance', v_balance);
  END IF;

  -- 4) Determina se despesa (devolve saldo +) ou recarga (retira saldo -)
  IF v_card.request_kind = 'RECARGA_NUBANK' THEN
    v_delta := -ROUND(COALESCE(v_card.amount, 0), 2);
    v_type  := 'AJUSTE';
    v_desc  := COALESCE(p_description, 'Estorno de Recarga Nubank: ' || COALESCE(v_card.title, 'Sem título'));
  ELSE
    v_delta := ROUND(COALESCE(v_card.amount, 0), 2);
    v_type  := 'REEMBOLSO';
    v_desc  := COALESCE(p_description, 'Estorno Nubank: ' || COALESCE(v_card.title, 'Sem título'));
  END IF;

  -- 5) Atualiza o saldo Nubank com lock de linha
  SELECT balance INTO v_balance FROM nubank_balance WHERE id = 'nubank' FOR UPDATE;
  v_new := v_balance + v_delta;
  UPDATE nubank_balance SET balance = v_new, updated_at = now() WHERE id = 'nubank';

  -- 6) Registra movimentação no histórico
  INSERT INTO nubank_movements (type, amount, balance_after, description, payment_request_id, created_by)
  VALUES (v_type, v_delta, v_new, v_desc, p_request_id, p_user);

  RETURN jsonb_build_object('processed', true, 'balance', v_new, 'delta', v_delta);
END;
$$;

-- 2) Saneamento: Limpa balance_processed = false em todas as solicitações não-Nubank
-- que foram indevidamente marcadas pelo backfill antigo e nunca movimentaram o saldo.
UPDATE payment_requests
   SET balance_processed = false
 WHERE balance_processed = true
   AND (request_kind IS NULL OR request_kind != 'RECARGA_NUBANK')
   AND (cnpj IS NULL OR (cnpj NOT ILIKE '%nubank%' AND cnpj NOT ILIKE 'nu%'))
   AND id NOT IN (
     SELECT payment_request_id 
     FROM nubank_movements 
     WHERE payment_request_id IS NOT NULL
   );

-- 3) Correção dos dois estornos fantasmas (R$ 30,00 e R$ 200,00) de hoje:
-- Remove as duas movimentações indevidas geradas às 18:39 UTC e restaura o saldo para R$ 1.515,45.
DELETE FROM nubank_movements
 WHERE id IN (
   '8d02da92-0f4b-4d25-acf7-83d10ef32ca2', -- R$ 30,00 Ticket Café
   '98b6f5f9-d847-4a08-83be-ae19a9bc29e8'  -- R$ 200,00 Pagamento de Pousada
 );

UPDATE nubank_balance
   SET balance = 1515.45,
       updated_at = now()
 WHERE id = 'nubank';
