-- ============================================================================
-- Conect Pay - Kanban Filters Hardening & Performance Indexes
-- ============================================================================
-- 1. Strict whitelist check on payment_requests.visibility inside RLS helper
-- 2. CHECK constraint enforcing only COMPARTILHADA | INDIVIDUAL (or NULL)
-- 3. Partial / composite indexes for fast active Kanban & filter queries
-- ============================================================================

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
    WHEN COALESCE(p_visibility, 'COMPARTILHADA') <> 'COMPARTILHADA' THEN false
    WHEN public.get_my_sector() IS NOT NULL AND EXISTS (
      SELECT 1
      FROM public.profiles req_p
      WHERE req_p.id IN (p_created_by, p_real_requester_id)
        AND req_p.sector::text = public.get_my_sector()
    ) THEN true
    ELSE false
  END;
$$;

REVOKE ALL ON FUNCTION public.can_access_payment_request(uuid, uuid, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.can_access_payment_request(uuid, uuid, text) TO authenticated, service_role;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'payment_requests_visibility_check'
      AND conrelid = 'public.payment_requests'::regclass
  ) THEN
    ALTER TABLE public.payment_requests
      ADD CONSTRAINT payment_requests_visibility_check
      CHECK (visibility IS NULL OR visibility IN ('COMPARTILHADA', 'INDIVIDUAL'));
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_pr_not_deleted_status_created_at
  ON public.payment_requests (status, created_at DESC)
  WHERE COALESCE(is_deleted, false) = false;

CREATE INDEX IF NOT EXISTS idx_pr_not_deleted_created_at
  ON public.payment_requests (created_at DESC)
  WHERE COALESCE(is_deleted, false) = false;

CREATE INDEX IF NOT EXISTS idx_pr_not_deleted_due_date
  ON public.payment_requests (due_date)
  WHERE COALESCE(is_deleted, false) = false;

CREATE INDEX IF NOT EXISTS idx_pr_not_deleted_category
  ON public.payment_requests (category, created_at DESC)
  WHERE COALESCE(is_deleted, false) = false;

CREATE INDEX IF NOT EXISTS idx_profiles_sector
  ON public.profiles (sector);

