-- ============================================================
-- CONECT PAY — Schema DDL para Supabase (PostgreSQL)
-- Versão: 1.0.0 | Data: 2026-09-03
-- ============================================================
-- Execute este script inteiro no SQL Editor do Supabase.
-- Ele é idempotente: usa IF NOT EXISTS / DO $$ … $$ onde possível.
-- ============================================================


-- ────────────────────────────────────────────────────────────
-- 1. TIPOS ENUMERADOS (ENUMs)
-- ────────────────────────────────────────────────────────────

-- Papel do usuário no sistema
DO $$ BEGIN
  CREATE TYPE user_role AS ENUM ('FINANCEIRO', 'GESTOR');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- Status do card no Kanban
DO $$ BEGIN
  CREATE TYPE request_status AS ENUM (
    'NOVA_SOLICITACAO',
    'EM_APROVACAO',
    'AGUARDANDO_NOTINHA',
    'PAGAMENTO_FINALIZADO',
    'RECUSADO'
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;


-- ────────────────────────────────────────────────────────────
-- 2. TABELA: profiles
--    Gerencia os dados complementares dos usuários.
--    O id referencia auth.users (gerenciado pelo Supabase Auth).
-- ────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS profiles (
  id          UUID PRIMARY KEY REFERENCES auth.users (id) ON DELETE CASCADE,
  name        VARCHAR(255) NOT NULL,
  role        user_role    NOT NULL DEFAULT 'GESTOR',
  created_at  TIMESTAMPTZ  NOT NULL DEFAULT now(),
  updated_at  TIMESTAMPTZ  NOT NULL DEFAULT now()
);

COMMENT ON TABLE  profiles          IS 'Perfis de usuário vinculados ao Supabase Auth.';
COMMENT ON COLUMN profiles.id       IS 'UUID do usuário — FK para auth.users.';
COMMENT ON COLUMN profiles.name     IS 'Nome completo do usuário.';
COMMENT ON COLUMN profiles.role     IS 'Papel: FINANCEIRO (opera pagamentos) ou GESTOR (aprova solicitações).';


-- ────────────────────────────────────────────────────────────
-- 3. TABELA: payment_requests
--    Coração do Kanban — cada registro é um card de solicitação.
-- ────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS payment_requests (
  -- Identificador
  id                  UUID            PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Dados da solicitação
  title               VARCHAR(255)    NOT NULL,
  amount              DECIMAL(12,2)   NOT NULL CHECK (amount > 0),
  refunded_amount     DECIMAL(12,2)   DEFAULT NULL
                        CHECK (refunded_amount IS NULL OR refunded_amount >= 0),
  category            VARCHAR(100)    NOT NULL,

  -- Status do card no Kanban
  status              request_status  NOT NULL DEFAULT 'NOVA_SOLICITACAO',

  -- Dados de pagamento
  payment_type        VARCHAR(50)     NOT NULL,       -- Ex.: 'Pix', 'Caju', 'TED'
  pix_key             VARCHAR(255)    DEFAULT NULL,    -- Chave Pix (quando aplicável)
  pix_owner           VARCHAR(255)    DEFAULT NULL,    -- Titular da chave Pix
  notes               TEXT            DEFAULT NULL,    -- Observações livres

  -- Rastreabilidade / Compliance
  real_requester_id   UUID            NOT NULL REFERENCES profiles (id),
  created_by          UUID            NOT NULL REFERENCES profiles (id),

  -- Arquivos (URLs do Supabase Storage)
  receipt_url         VARCHAR(500)    DEFAULT NULL,    -- Foto da notinha fiscal
  payment_proof_url   VARCHAR(500)    DEFAULT NULL,    -- Comprovante de transferência

  -- Lixeira (Soft Delete)
  is_deleted          BOOLEAN         NOT NULL DEFAULT false,

  -- Timestamps automáticos
  created_at          TIMESTAMPTZ     NOT NULL DEFAULT now(),
  updated_at          TIMESTAMPTZ     NOT NULL DEFAULT now()
);

-- Índices para consultas frequentes
CREATE INDEX IF NOT EXISTS idx_pr_status           ON payment_requests (status);
CREATE INDEX IF NOT EXISTS idx_pr_created_by       ON payment_requests (created_by);
CREATE INDEX IF NOT EXISTS idx_pr_real_requester    ON payment_requests (real_requester_id);
CREATE INDEX IF NOT EXISTS idx_pr_created_at       ON payment_requests (created_at DESC);

COMMENT ON TABLE  payment_requests                    IS 'Solicitações de pagamento — cards do Kanban.';
COMMENT ON COLUMN payment_requests.amount             IS 'Valor solicitado (sempre positivo).';
COMMENT ON COLUMN payment_requests.refunded_amount    IS 'Troco: diferença quando a notinha é menor que o adiantamento.';
COMMENT ON COLUMN payment_requests.real_requester_id  IS 'Quem realmente pediu o dinheiro (compliance).';
COMMENT ON COLUMN payment_requests.created_by         IS 'Quem digitou a solicitação no sistema.';
COMMENT ON COLUMN payment_requests.receipt_url        IS 'URL da foto da notinha fiscal no Storage.';
COMMENT ON COLUMN payment_requests.payment_proof_url  IS 'URL do comprovante de transferência no Storage.';


-- ────────────────────────────────────────────────────────────
-- 4. TABELA: audit_logs
--    Tabela IMUTÁVEL de rastreabilidade financeira.
--    Registra toda movimentação e aprovação de cards.
-- ────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS audit_logs (
  id            UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
  action        VARCHAR(500)  NOT NULL,               -- Descrição da ação realizada
  request_id    UUID          NOT NULL REFERENCES payment_requests (id) ON DELETE CASCADE,
  performed_by  UUID          NOT NULL REFERENCES profiles (id),
  created_at    TIMESTAMPTZ   NOT NULL DEFAULT now()
);

-- Índices para consultas de auditoria
CREATE INDEX IF NOT EXISTS idx_al_request_id    ON audit_logs (request_id);
CREATE INDEX IF NOT EXISTS idx_al_performed_by  ON audit_logs (performed_by);
CREATE INDEX IF NOT EXISTS idx_al_created_at    ON audit_logs (created_at DESC);

COMMENT ON TABLE  audit_logs                IS 'Log imutável de auditoria — compliance financeiro.';
COMMENT ON COLUMN audit_logs.action         IS 'Descrição textual da movimentação (ex.: "Status alterado de EM_APROVACAO para AGUARDANDO_NOTINHA").';
COMMENT ON COLUMN audit_logs.request_id     IS 'Solicitação de pagamento associada.';
COMMENT ON COLUMN audit_logs.performed_by   IS 'Usuário que executou a ação.';


-- ────────────────────────────────────────────────────────────
-- 5. TRIGGER: Atualização automática de updated_at
--    Dispara em UPDATE nas tabelas profiles e payment_requests.
-- ────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- profiles
DROP TRIGGER IF EXISTS trg_profiles_updated_at ON profiles;
CREATE TRIGGER trg_profiles_updated_at
  BEFORE UPDATE ON profiles
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at();

-- payment_requests
DROP TRIGGER IF EXISTS trg_payment_requests_updated_at ON payment_requests;
CREATE TRIGGER trg_payment_requests_updated_at
  BEFORE UPDATE ON payment_requests
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at();


-- ────────────────────────────────────────────────────────────
-- 6. ROW LEVEL SECURITY (RLS)
--    Habilita RLS em todas as tabelas. As policies específicas
--    devem ser criadas conforme a lógica de autorização do app.
-- ────────────────────────────────────────────────────────────

ALTER TABLE profiles          ENABLE ROW LEVEL SECURITY;
ALTER TABLE payment_requests  ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_logs        ENABLE ROW LEVEL SECURITY;

-- Policy: profiles — usuários autenticados podem ler todos os perfis
CREATE POLICY "profiles_select_authenticated"
  ON profiles FOR SELECT
  TO authenticated
  USING (true);

-- Policy: profiles — cada usuário só edita o próprio perfil
CREATE POLICY "profiles_update_own"
  ON profiles FOR UPDATE
  TO authenticated
  USING  (id = auth.uid())
  WITH CHECK (id = auth.uid());

-- Policy: payment_requests — leitura para qualquer usuário autenticado
CREATE POLICY "pr_select_authenticated"
  ON payment_requests FOR SELECT
  TO authenticated
  USING (true);

-- Policy: payment_requests — qualquer autenticado pode criar solicitações
CREATE POLICY "pr_insert_authenticated"
  ON payment_requests FOR INSERT
  TO authenticated
  WITH CHECK (true);

-- Policy: payment_requests — qualquer autenticado pode atualizar (o app controla via role)
CREATE POLICY "pr_update_authenticated"
  ON payment_requests FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

-- Policy: audit_logs — somente leitura para autenticados (imutável)
CREATE POLICY "al_select_authenticated"
  ON audit_logs FOR SELECT
  TO authenticated
  USING (true);

-- Policy: audit_logs — qualquer autenticado pode inserir logs
CREATE POLICY "al_insert_authenticated"
  ON audit_logs FOR INSERT
  TO authenticated
  WITH CHECK (true);


-- ────────────────────────────────────────────────────────────
-- 7. STORAGE: Bucket "attachments"
--    Bucket público para notinhas fiscais e comprovantes.
-- ────────────────────────────────────────────────────────────

INSERT INTO storage.buckets (id, name, public)
VALUES ('attachments', 'attachments', true)
ON CONFLICT (id) DO NOTHING;

-- Policy: qualquer autenticado pode fazer upload no bucket
CREATE POLICY "attachments_insert_authenticated"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (bucket_id = 'attachments');

-- Policy: leitura pública (bucket público)
CREATE POLICY "attachments_select_public"
  ON storage.objects FOR SELECT
  TO public
  USING (bucket_id = 'attachments');

-- Policy: autenticados podem atualizar seus próprios arquivos
CREATE POLICY "attachments_update_authenticated"
  ON storage.objects FOR UPDATE
  TO authenticated
  USING (bucket_id = 'attachments');

-- Policy: autenticados podem deletar seus próprios arquivos
CREATE POLICY "attachments_delete_authenticated"
  ON storage.objects FOR DELETE
  TO authenticated
  USING (bucket_id = 'attachments');


-- ============================================================
-- ✅ Schema criado com sucesso!
-- Tabelas: profiles, payment_requests, audit_logs
-- ENUMs: user_role, request_status
-- Triggers: updated_at automático
-- RLS: habilitado com policies básicas
-- Storage: bucket "attachments" público
-- ============================================================

-- ============================================================
-- 📌 CATEGORIES (MVP)
-- ============================================================

-- 1. Criação da tabela de categorias com a trava de Soft Delete
CREATE TABLE public.categories (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    is_deleted BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 2. Habilitar segurança básica (RLS)
ALTER TABLE public.categories ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Permitir leitura anonima categorias MVP" ON public.categories FOR SELECT TO public USING (true);
CREATE POLICY "Permitir insercao anonima categorias MVP" ON public.categories FOR INSERT TO public WITH CHECK (true);
CREATE POLICY "Permitir update anonimo categorias MVP" ON public.categories FOR UPDATE TO public USING (true);

-- 3. Inserção das categorias gerenciais aprovadas
INSERT INTO public.categories (name) VALUES
('Alimentação'),
('Transporte'),
('Material de Escritório e Suprimentos'),
('Marketing e Publicidade'),
('Equipamentos TI'),
('Combustível'),
('Hospedagem'),
('Impostos e Taxas'),
('Manutenção e Reparos'),
('Outros');

-- ============================================================
-- FIX: Policies para acesso anonimo (MVP sem Supabase Auth)
-- O app usa login simulado via localStorage, logo todas as
-- queries sao feitas com a role 'anon'. Sem essas policies,
-- o RLS bloqueia tudo e o app exibe "Failed to fetch".
-- ============================================================

-- payment_requests: permitir acesso anonimo (MVP)
CREATE POLICY "pr_select_anon_mvp" ON payment_requests FOR SELECT TO anon USING (true);
CREATE POLICY "pr_insert_anon_mvp" ON payment_requests FOR INSERT TO anon WITH CHECK (true);
CREATE POLICY "pr_update_anon_mvp" ON payment_requests FOR UPDATE TO anon USING (true) WITH CHECK (true);

-- profiles: permitir acesso anonimo (MVP)
CREATE POLICY "profiles_select_anon_mvp" ON profiles FOR SELECT TO anon USING (true);

-- audit_logs: permitir acesso anonimo (MVP)
CREATE POLICY "al_select_anon_mvp" ON audit_logs FOR SELECT TO anon USING (true);
CREATE POLICY "al_insert_anon_mvp" ON audit_logs FOR INSERT TO anon WITH CHECK (true);
