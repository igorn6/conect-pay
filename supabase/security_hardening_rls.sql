-- Security Hardening Migration: Row Level Security (RLS) & Storage Policies
-- Closes all unauthenticated (anon/public) table & storage access and prevents privilege escalation.

BEGIN;

-- ============================================================================
-- 1. Security Helper Functions (SECURITY DEFINER, non-recursive)
-- ============================================================================

CREATE OR REPLACE FUNCTION public.get_my_role()
RETURNS text
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT UPPER(TRIM(role::text))
  FROM public.profiles
  WHERE id = auth.uid();
$$;

CREATE OR REPLACE FUNCTION public.get_my_sector()
RETURNS text
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT sector::text
  FROM public.profiles
  WHERE id = auth.uid();
$$;

CREATE OR REPLACE FUNCTION public.is_active_user()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, auth
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.profiles p
    JOIN auth.users u ON u.id = p.id
    WHERE p.id = auth.uid()
      AND (u.banned_until IS NULL OR u.banned_until <= now())
  );
$$;

CREATE OR REPLACE FUNCTION public.can_access_payment_request(
  p_created_by uuid,
  p_real_requester_id uuid,
  p_visibility text
)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT CASE
    WHEN NOT public.is_active_user() THEN false
    WHEN public.get_my_role() IN ('MASTER', 'FINANCEIRO') THEN true
    WHEN auth.uid() = p_created_by OR auth.uid() = p_real_requester_id THEN true
    WHEN COALESCE(p_visibility, 'COMPARTILHADA') = 'INDIVIDUAL' THEN false
    WHEN public.get_my_sector() IS NOT NULL AND EXISTS (
      SELECT 1
      FROM public.profiles req_p
      WHERE req_p.id IN (p_created_by, p_real_requester_id)
        AND req_p.sector::text = public.get_my_sector()
    ) THEN true
    ELSE false
  END;
$$;

-- Restrict helper execution to authenticated users and service_role only
REVOKE ALL ON FUNCTION public.get_my_role() FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.get_my_sector() FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.is_active_user() FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.can_access_payment_request(uuid, uuid, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_my_role() TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.get_my_sector() TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.is_active_user() TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.can_access_payment_request(uuid, uuid, text) TO authenticated, service_role;

-- ============================================================================
-- 2. Enable RLS on ALL 22 public tables
-- ============================================================================

ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.caju_collaborators ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.caju_import_batches ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.caju_movements ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.caju_recharge_credits ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.caju_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.caju_wallet ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.category_suggestions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.chat_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.chat_participants ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.chats ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.expense_trips ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.nubank_balance ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.nubank_daily_reconciliation ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.nubank_movements ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.nubank_statement_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payment_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.prospectors ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.push_subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sectors ENABLE ROW LEVEL SECURITY;

-- ============================================================================
-- 3. Drop legacy overly-permissive / anon / public policies
-- ============================================================================

DROP POLICY IF EXISTS "al_insert_anon_mvp" ON public.audit_logs;
DROP POLICY IF EXISTS "al_select_anon_mvp" ON public.audit_logs;
DROP POLICY IF EXISTS "al_insert_authenticated" ON public.audit_logs;
DROP POLICY IF EXISTS "al_select_authenticated" ON public.audit_logs;

DROP POLICY IF EXISTS "Permitir insercao anonima categorias MVP" ON public.categories;
DROP POLICY IF EXISTS "Permitir leitura anonima categorias MVP" ON public.categories;
DROP POLICY IF EXISTS "Permitir update anonimo categorias MVP" ON public.categories;

DROP POLICY IF EXISTS "Users can insert messages in their chats" ON public.chat_messages;
DROP POLICY IF EXISTS "Users can read messages in their chats" ON public.chat_messages;
DROP POLICY IF EXISTS "Users can update messages in their chats" ON public.chat_messages;
DROP POLICY IF EXISTS "Users can add participants" ON public.chat_participants;
DROP POLICY IF EXISTS "Users can view participants of their chats" ON public.chat_participants;
DROP POLICY IF EXISTS "Users can start chats" ON public.chats;
DROP POLICY IF EXISTS "Users can view their own chats" ON public.chats;

DROP POLICY IF EXISTS "nb_all_public" ON public.nubank_balance;
DROP POLICY IF EXISTS "nm_all_public" ON public.nubank_movements;

DROP POLICY IF EXISTS "pr_insert_anon_mvp" ON public.payment_requests;
DROP POLICY IF EXISTS "pr_insert_public" ON public.payment_requests;
DROP POLICY IF EXISTS "pr_select_anon_mvp" ON public.payment_requests;
DROP POLICY IF EXISTS "pr_select_public" ON public.payment_requests;
DROP POLICY IF EXISTS "pr_update_anon_mvp" ON public.payment_requests;
DROP POLICY IF EXISTS "pr_update_public" ON public.payment_requests;

DROP POLICY IF EXISTS "profiles_select_all" ON public.profiles;
DROP POLICY IF EXISTS "profiles_update_own" ON public.profiles;

DROP POLICY IF EXISTS "Allow all access to service role" ON public.push_subscriptions;

-- ============================================================================
-- 4. Strictly Authenticated Least-Privilege Policies
-- ============================================================================

-- PROFILES: Active authenticated users can read profiles; users can update their own non-privilege fields only.
DROP POLICY IF EXISTS "profiles_select_authenticated" ON public.profiles;
CREATE POLICY "profiles_select_authenticated"
  ON public.profiles FOR SELECT TO authenticated
  USING (public.is_active_user());

DROP POLICY IF EXISTS "profiles_update_own_safe" ON public.profiles;
CREATE POLICY "profiles_update_own_safe"
  ON public.profiles FOR UPDATE TO authenticated
  USING (auth.uid() = id AND public.is_active_user())
  WITH CHECK (
    auth.uid() = id
    AND public.is_active_user()
    AND UPPER(TRIM(role::text)) = public.get_my_role()
    AND sector::text IS NOT DISTINCT FROM public.get_my_sector()
  );

-- SECTORS: Active authenticated users can read; MASTER manages.
DROP POLICY IF EXISTS "sectors_select_authenticated" ON public.sectors;
CREATE POLICY "sectors_select_authenticated"
  ON public.sectors FOR SELECT TO authenticated
  USING (public.is_active_user());

DROP POLICY IF EXISTS "sectors_manage_master" ON public.sectors;
CREATE POLICY "sectors_manage_master"
  ON public.sectors FOR ALL TO authenticated
  USING (public.is_active_user() AND public.get_my_role() = 'MASTER')
  WITH CHECK (public.is_active_user() AND public.get_my_role() = 'MASTER');

-- CATEGORIES: Active authenticated users can read; MASTER & FINANCEIRO manage.
DROP POLICY IF EXISTS "categories_select_authenticated" ON public.categories;
CREATE POLICY "categories_select_authenticated"
  ON public.categories FOR SELECT TO authenticated
  USING (public.is_active_user());

DROP POLICY IF EXISTS "categories_manage_finance" ON public.categories;
CREATE POLICY "categories_manage_finance"
  ON public.categories FOR ALL TO authenticated
  USING (public.is_active_user() AND public.get_my_role() IN ('MASTER', 'FINANCEIRO'))
  WITH CHECK (public.is_active_user() AND public.get_my_role() IN ('MASTER', 'FINANCEIRO'));

-- CATEGORY_SUGGESTIONS: Authenticated read; MASTER & FINANCEIRO write.
DROP POLICY IF EXISTS "category_suggestions_select_authenticated" ON public.category_suggestions;
CREATE POLICY "category_suggestions_select_authenticated"
  ON public.category_suggestions FOR SELECT TO authenticated
  USING (public.is_active_user());

DROP POLICY IF EXISTS "category_suggestions_manage_finance" ON public.category_suggestions;
CREATE POLICY "category_suggestions_manage_finance"
  ON public.category_suggestions FOR ALL TO authenticated
  USING (public.is_active_user() AND public.get_my_role() IN ('MASTER', 'FINANCEIRO'))
  WITH CHECK (public.is_active_user() AND public.get_my_role() IN ('MASTER', 'FINANCEIRO'));

-- PAYMENT_REQUESTS: Zero anon access; role + sector isolation for GESTOR. No client DELETE.
DROP POLICY IF EXISTS "payment_requests_select_authorized" ON public.payment_requests;
CREATE POLICY "payment_requests_select_authorized"
  ON public.payment_requests FOR SELECT TO authenticated
  USING (public.can_access_payment_request(created_by, real_requester_id, visibility));

DROP POLICY IF EXISTS "payment_requests_insert_authorized" ON public.payment_requests;
CREATE POLICY "payment_requests_insert_authorized"
  ON public.payment_requests FOR INSERT TO authenticated
  WITH CHECK (
    public.is_active_user()
    AND (
      public.get_my_role() IN ('MASTER', 'FINANCEIRO')
      OR (
        public.get_my_role() = 'GESTOR'
        AND created_by = auth.uid()
      )
    )
  );

DROP POLICY IF EXISTS "payment_requests_update_authorized" ON public.payment_requests;
CREATE POLICY "payment_requests_update_authorized"
  ON public.payment_requests FOR UPDATE TO authenticated
  USING (public.can_access_payment_request(created_by, real_requester_id, visibility))
  WITH CHECK (
    public.is_active_user()
    AND (
      public.get_my_role() IN ('MASTER', 'FINANCEIRO')
      OR public.can_access_payment_request(created_by, real_requester_id, visibility)
    )
  );

-- AUDIT_LOGS: Active authenticated users can read and append logs.
DROP POLICY IF EXISTS "audit_logs_select_authenticated" ON public.audit_logs;
CREATE POLICY "audit_logs_select_authenticated"
  ON public.audit_logs FOR SELECT TO authenticated
  USING (public.is_active_user());

DROP POLICY IF EXISTS "audit_logs_insert_authenticated" ON public.audit_logs;
CREATE POLICY "audit_logs_insert_authenticated"
  ON public.audit_logs FOR INSERT TO authenticated
  WITH CHECK (public.is_active_user());

-- CHATS, CHAT_PARTICIPANTS, CHAT_MESSAGES: Authenticated participants only.
DROP POLICY IF EXISTS "chats_select_authenticated" ON public.chats;
CREATE POLICY "chats_select_authenticated"
  ON public.chats FOR SELECT TO authenticated
  USING (public.is_active_user() AND public.is_chat_participant(id, auth.uid()));

DROP POLICY IF EXISTS "chats_insert_authenticated" ON public.chats;
CREATE POLICY "chats_insert_authenticated"
  ON public.chats FOR INSERT TO authenticated
  WITH CHECK (public.is_active_user());

DROP POLICY IF EXISTS "chat_participants_select_authenticated" ON public.chat_participants;
CREATE POLICY "chat_participants_select_authenticated"
  ON public.chat_participants FOR SELECT TO authenticated
  USING (
    public.is_active_user()
    AND (profile_id = auth.uid() OR public.is_chat_participant(chat_id, auth.uid()))
  );

DROP POLICY IF EXISTS "chat_participants_insert_authenticated" ON public.chat_participants;
CREATE POLICY "chat_participants_insert_authenticated"
  ON public.chat_participants FOR INSERT TO authenticated
  WITH CHECK (public.is_active_user());

DROP POLICY IF EXISTS "chat_messages_select_authenticated" ON public.chat_messages;
CREATE POLICY "chat_messages_select_authenticated"
  ON public.chat_messages FOR SELECT TO authenticated
  USING (public.is_active_user() AND public.is_chat_participant(chat_id, auth.uid()));

DROP POLICY IF EXISTS "chat_messages_insert_authenticated" ON public.chat_messages;
CREATE POLICY "chat_messages_insert_authenticated"
  ON public.chat_messages FOR INSERT TO authenticated
  WITH CHECK (
    public.is_active_user()
    AND sender_id = auth.uid()
    AND public.is_chat_participant(chat_id, auth.uid())
  );

DROP POLICY IF EXISTS "chat_messages_update_authenticated" ON public.chat_messages;
CREATE POLICY "chat_messages_update_authenticated"
  ON public.chat_messages FOR UPDATE TO authenticated
  USING (public.is_active_user() AND public.is_chat_participant(chat_id, auth.uid()))
  WITH CHECK (public.is_active_user() AND public.is_chat_participant(chat_id, auth.uid()));

-- PUSH_SUBSCRIPTIONS: Users can manage only their own subscriptions.
DROP POLICY IF EXISTS "push_subscriptions_own" ON public.push_subscriptions;
CREATE POLICY "push_subscriptions_own"
  ON public.push_subscriptions FOR ALL TO authenticated
  USING (public.is_active_user() AND user_id = auth.uid())
  WITH CHECK (public.is_active_user() AND user_id = auth.uid());

-- NUBANK VAULT & RECONCILIATION: Read-only for MASTER/FINANCEIRO; mutations strictly via service_role APIs.
DROP POLICY IF EXISTS "nubank_balance_select_finance" ON public.nubank_balance;
CREATE POLICY "nubank_balance_select_finance"
  ON public.nubank_balance FOR SELECT TO authenticated
  USING (public.is_active_user() AND public.get_my_role() IN ('MASTER', 'FINANCEIRO'));

DROP POLICY IF EXISTS "nubank_movements_select_finance" ON public.nubank_movements;
CREATE POLICY "nubank_movements_select_finance"
  ON public.nubank_movements FOR SELECT TO authenticated
  USING (public.is_active_user() AND public.get_my_role() IN ('MASTER', 'FINANCEIRO'));

DROP POLICY IF EXISTS "nubank_daily_rec_select_finance" ON public.nubank_daily_reconciliation;
CREATE POLICY "nubank_daily_rec_select_finance"
  ON public.nubank_daily_reconciliation FOR SELECT TO authenticated
  USING (public.is_active_user() AND public.get_my_role() IN ('MASTER', 'FINANCEIRO'));

DROP POLICY IF EXISTS "nubank_stmt_items_select_finance" ON public.nubank_statement_items;
CREATE POLICY "nubank_stmt_items_select_finance"
  ON public.nubank_statement_items FOR SELECT TO authenticated
  USING (public.is_active_user() AND public.get_my_role() IN ('MASTER', 'FINANCEIRO'));

-- CAJU HUB: Read-only for MASTER/FINANCEIRO; mutations strictly via service_role APIs.
DROP POLICY IF EXISTS "caju_wallet_select_finance" ON public.caju_wallet;
CREATE POLICY "caju_wallet_select_finance"
  ON public.caju_wallet FOR SELECT TO authenticated
  USING (public.is_active_user() AND public.get_my_role() IN ('MASTER', 'FINANCEIRO'));

DROP POLICY IF EXISTS "caju_collaborators_select_finance" ON public.caju_collaborators;
CREATE POLICY "caju_collaborators_select_finance"
  ON public.caju_collaborators FOR SELECT TO authenticated
  USING (public.is_active_user() AND public.get_my_role() IN ('MASTER', 'FINANCEIRO'));

DROP POLICY IF EXISTS "caju_transactions_select_finance" ON public.caju_transactions;
CREATE POLICY "caju_transactions_select_finance"
  ON public.caju_transactions FOR SELECT TO authenticated
  USING (public.is_active_user() AND public.get_my_role() IN ('MASTER', 'FINANCEIRO'));

DROP POLICY IF EXISTS "caju_movements_select_finance" ON public.caju_movements;
CREATE POLICY "caju_movements_select_finance"
  ON public.caju_movements FOR SELECT TO authenticated
  USING (public.is_active_user() AND public.get_my_role() IN ('MASTER', 'FINANCEIRO'));

DROP POLICY IF EXISTS "caju_import_batches_select_finance" ON public.caju_import_batches;
CREATE POLICY "caju_import_batches_select_finance"
  ON public.caju_import_batches FOR SELECT TO authenticated
  USING (public.is_active_user() AND public.get_my_role() IN ('MASTER', 'FINANCEIRO'));

DROP POLICY IF EXISTS "caju_recharge_credits_select_finance" ON public.caju_recharge_credits;
CREATE POLICY "caju_recharge_credits_select_finance"
  ON public.caju_recharge_credits FOR SELECT TO authenticated
  USING (public.is_active_user() AND public.get_my_role() IN ('MASTER', 'FINANCEIRO'));

-- EXPENSE TRIPS & PROSPECTORS: Active authenticated users can read; active staff can manage trips.
DROP POLICY IF EXISTS "prospectors_select_authenticated" ON public.prospectors;
CREATE POLICY "prospectors_select_authenticated"
  ON public.prospectors FOR SELECT TO authenticated
  USING (public.is_active_user());

DROP POLICY IF EXISTS "expense_trips_select_authenticated" ON public.expense_trips;
CREATE POLICY "expense_trips_select_authenticated"
  ON public.expense_trips FOR SELECT TO authenticated
  USING (public.is_active_user());

DROP POLICY IF EXISTS "expense_trips_insert_authenticated" ON public.expense_trips;
CREATE POLICY "expense_trips_insert_authenticated"
  ON public.expense_trips FOR INSERT TO authenticated
  WITH CHECK (
    public.is_active_user()
    AND public.get_my_role() IN ('MASTER', 'FINANCEIRO', 'GESTOR')
  );

DROP POLICY IF EXISTS "expense_trips_update_authenticated" ON public.expense_trips;
CREATE POLICY "expense_trips_update_authenticated"
  ON public.expense_trips FOR UPDATE TO authenticated
  USING (
    public.is_active_user()
    AND public.get_my_role() IN ('MASTER', 'FINANCEIRO', 'GESTOR')
  )
  WITH CHECK (
    public.is_active_user()
    AND public.get_my_role() IN ('MASTER', 'FINANCEIRO', 'GESTOR')
  );

DROP POLICY IF EXISTS "expense_trips_delete_finance" ON public.expense_trips;
CREATE POLICY "expense_trips_delete_finance"
  ON public.expense_trips FOR DELETE TO authenticated
  USING (
    public.is_active_user()
    AND public.get_my_role() IN ('MASTER', 'FINANCEIRO')
  );

-- Lock down financial vault RPC functions from direct client/anon PostgREST execution
DO $$
DECLARE
  fn_name text;
  fn_oid oid;
BEGIN
  FOREACH fn_name IN ARRAY ARRAY[
    'apply_nubank_movement',
    'revert_nubank_movement',
    'caju_adjust_collaborator',
    'caju_adjust_free',
    'caju_import_rows',
    'caju_sync_recharge'
  ] LOOP
    FOR fn_oid IN
      SELECT p.oid
      FROM pg_proc p
      JOIN pg_namespace n ON n.oid = p.pronamespace
      WHERE n.nspname = 'public' AND p.proname = fn_name
    LOOP
      EXECUTE format('REVOKE ALL ON FUNCTION %s FROM PUBLIC, anon, authenticated', fn_oid::regprocedure);
      EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO service_role', fn_oid::regprocedure);
    END LOOP;
  END LOOP;
END $$;

-- ============================================================================
-- 5. Storage Buckets (Remove public/anon write/update/delete/listing)
-- ============================================================================

DROP POLICY IF EXISTS "Public Access for attachments" ON storage.objects;
DROP POLICY IF EXISTS "Public Update for attachments" ON storage.objects;
DROP POLICY IF EXISTS "Public Upload for attachments" ON storage.objects;
DROP POLICY IF EXISTS "attachments_select_public" ON storage.objects;
DROP POLICY IF EXISTS "attachments_insert_authenticated" ON storage.objects;
DROP POLICY IF EXISTS "attachments_update_authenticated" ON storage.objects;
DROP POLICY IF EXISTS "attachments_delete_authenticated" ON storage.objects;

DROP POLICY IF EXISTS "liberar tudo 1lnm9mj_0" ON storage.objects;
DROP POLICY IF EXISTS "liberar tudo 1lnm9mj_1" ON storage.objects;
DROP POLICY IF EXISTS "liberar tudo 1lnm9mj_2" ON storage.objects;
DROP POLICY IF EXISTS "liberar tudo 1lnm9mj_3" ON storage.objects;

DROP POLICY IF EXISTS "liberar tudo 1mt4rzk_0" ON storage.objects;
DROP POLICY IF EXISTS "liberar tudo 1mt4rzk_1" ON storage.objects;
DROP POLICY IF EXISTS "liberar tudo 1mt4rzk_2" ON storage.objects;
DROP POLICY IF EXISTS "liberar tudo 1mt4rzk_3" ON storage.objects;

DROP POLICY IF EXISTS "liberar tudo 1oj01fe_0" ON storage.objects;
DROP POLICY IF EXISTS "liberar tudo 1oj01fe_1" ON storage.objects;
DROP POLICY IF EXISTS "liberar tudo 1oj01fe_2" ON storage.objects;
DROP POLICY IF EXISTS "liberar tudo 1oj01fe_3" ON storage.objects;

DROP POLICY IF EXISTS "storage_select_authenticated" ON storage.objects;
CREATE POLICY "storage_select_authenticated"
  ON storage.objects FOR SELECT TO authenticated
  USING (
    bucket_id IN ('attachments', 'receipts', 'avatars', 'chat_attachments')
    AND public.is_active_user()
  );

DROP POLICY IF EXISTS "storage_insert_authenticated" ON storage.objects;
CREATE POLICY "storage_insert_authenticated"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id IN ('attachments', 'receipts', 'avatars', 'chat_attachments')
    AND public.is_active_user()
  );

DROP POLICY IF EXISTS "storage_update_owner_or_finance" ON storage.objects;
CREATE POLICY "storage_update_owner_or_finance"
  ON storage.objects FOR UPDATE TO authenticated
  USING (
    bucket_id IN ('attachments', 'receipts', 'avatars', 'chat_attachments')
    AND public.is_active_user()
    AND (owner = auth.uid() OR public.get_my_role() IN ('MASTER', 'FINANCEIRO'))
  )
  WITH CHECK (
    bucket_id IN ('attachments', 'receipts', 'avatars', 'chat_attachments')
    AND public.is_active_user()
    AND (owner = auth.uid() OR public.get_my_role() IN ('MASTER', 'FINANCEIRO'))
  );

DROP POLICY IF EXISTS "storage_delete_owner_or_finance" ON storage.objects;

CREATE POLICY "storage_delete_owner_or_finance"
  ON storage.objects FOR DELETE TO authenticated
  USING (
    bucket_id IN ('attachments', 'receipts', 'avatars', 'chat_attachments')
    AND public.is_active_user()
    AND (owner = auth.uid() OR public.get_my_role() IN ('MASTER', 'FINANCEIRO'))
  );

COMMIT;

