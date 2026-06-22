
-- =====================================================================
-- Phase 0 — Foundations migration
-- =====================================================================

-- ---------- 1. Org-scoped roles ----------
ALTER TABLE public.user_roles
  ADD COLUMN IF NOT EXISTS org_id uuid REFERENCES public.organizations(id) ON DELETE CASCADE;

-- Backfill org_id from profiles where possible
UPDATE public.user_roles ur
SET org_id = p.org_id
FROM public.profiles p
WHERE ur.user_id = p.id AND ur.org_id IS NULL AND p.org_id IS NOT NULL;

-- New unique constraint allowing same (user, role) across different orgs.
-- NULL org_id is treated distinct by Postgres unique, so global roles still work.
ALTER TABLE public.user_roles DROP CONSTRAINT IF EXISTS user_roles_user_id_role_key;
CREATE UNIQUE INDEX IF NOT EXISTS user_roles_user_org_role_uniq
  ON public.user_roles (user_id, COALESCE(org_id, '00000000-0000-0000-0000-000000000000'::uuid), role);

-- ---------- 2. Helper functions ----------
CREATE OR REPLACE FUNCTION public.has_role_in_org(_user_id uuid, _org_id uuid, _role public.app_role)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id
      AND role = _role
      AND (org_id = _org_id OR org_id IS NULL)
  )
$$;

CREATE OR REPLACE FUNCTION public.current_user_org_ids()
RETURNS SETOF uuid
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT DISTINCT org_id FROM public.user_roles
   WHERE user_id = auth.uid() AND org_id IS NOT NULL
  UNION
  SELECT org_id FROM public.profiles
   WHERE id = auth.uid() AND org_id IS NOT NULL
$$;

-- ---------- 3. Status enums ----------
DO $$ BEGIN
  CREATE TYPE public.candidate_status AS ENUM ('new','screening','interviewing','offer','hired','rejected','archived');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.interview_status AS ENUM ('scheduled','in_progress','completed','cancelled','no_show','evaluation_pending');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.job_status AS ENUM ('draft','open','paused','closed','archived');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Convert columns (tables are empty, safe)
ALTER TABLE public.candidates
  ALTER COLUMN status DROP DEFAULT,
  ALTER COLUMN status TYPE public.candidate_status USING status::public.candidate_status,
  ALTER COLUMN status SET DEFAULT 'new'::public.candidate_status;

ALTER TABLE public.interviews
  ALTER COLUMN status DROP DEFAULT,
  ALTER COLUMN status TYPE public.interview_status USING status::public.interview_status,
  ALTER COLUMN status SET DEFAULT 'scheduled'::public.interview_status;

-- job_descriptions.status may not exist or be text; add/convert defensively
DO $$
DECLARE col_type text;
BEGIN
  SELECT data_type INTO col_type FROM information_schema.columns
   WHERE table_schema='public' AND table_name='job_descriptions' AND column_name='status';
  IF col_type IS NULL THEN
    ALTER TABLE public.job_descriptions ADD COLUMN status public.job_status NOT NULL DEFAULT 'draft';
  ELSIF col_type <> 'USER-DEFINED' THEN
    ALTER TABLE public.job_descriptions
      ALTER COLUMN status DROP DEFAULT,
      ALTER COLUMN status TYPE public.job_status USING COALESCE(status, 'draft')::public.job_status,
      ALTER COLUMN status SET DEFAULT 'draft'::public.job_status;
  END IF;
END $$;

-- ---------- 4. Soft delete ----------
ALTER TABLE public.candidates       ADD COLUMN IF NOT EXISTS deleted_at timestamptz;
ALTER TABLE public.interviews       ADD COLUMN IF NOT EXISTS deleted_at timestamptz;
ALTER TABLE public.job_descriptions ADD COLUMN IF NOT EXISTS deleted_at timestamptz;

-- ---------- 5. Indexes ----------
CREATE INDEX IF NOT EXISTS candidates_org_status_idx     ON public.candidates(org_id, status) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS candidates_created_at_idx     ON public.candidates(created_at DESC);
CREATE INDEX IF NOT EXISTS interviews_org_scheduled_idx  ON public.interviews(org_id, scheduled_at) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS interviews_candidate_idx      ON public.interviews(candidate_id);
CREATE INDEX IF NOT EXISTS profiles_org_idx              ON public.profiles(org_id);
CREATE INDEX IF NOT EXISTS user_roles_user_idx           ON public.user_roles(user_id);
CREATE INDEX IF NOT EXISTS user_roles_org_role_idx       ON public.user_roles(org_id, role);

-- ---------- 6. Audit log ----------
CREATE TABLE IF NOT EXISTS public.audit_events (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id       uuid REFERENCES public.organizations(id) ON DELETE SET NULL,
  actor_id     uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  entity_type  text NOT NULL,
  entity_id    uuid,
  action       text NOT NULL,
  diff         jsonb NOT NULL DEFAULT '{}'::jsonb,
  ip           inet,
  user_agent   text,
  created_at   timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.audit_events TO authenticated;
GRANT ALL    ON public.audit_events TO service_role;

ALTER TABLE public.audit_events ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Org admins read audit events" ON public.audit_events;
CREATE POLICY "Org admins read audit events" ON public.audit_events
  FOR SELECT TO authenticated
  USING (
    public.has_role(auth.uid(), 'admin')
    OR (org_id IS NOT NULL AND public.has_role_in_org(auth.uid(), org_id, 'admin'))
  );

CREATE INDEX IF NOT EXISTS audit_events_org_created_idx ON public.audit_events(org_id, created_at DESC);
CREATE INDEX IF NOT EXISTS audit_events_entity_idx      ON public.audit_events(entity_type, entity_id);

-- ---------- 7. Soft-delete filter on existing read policies ----------
-- Recreate candidate/interview/job policies so they hide soft-deleted rows.

DROP POLICY IF EXISTS "Candidates view own record" ON public.candidates;
CREATE POLICY "Candidates view own record" ON public.candidates
  FOR SELECT TO authenticated
  USING (auth.uid() = user_id AND deleted_at IS NULL);

DROP POLICY IF EXISTS "Recruiters manage org candidates" ON public.candidates;
CREATE POLICY "Recruiters manage org candidates" ON public.candidates
  FOR ALL TO authenticated
  USING (
    public.has_role(auth.uid(), 'recruiter')
    AND org_id IS NOT NULL
    AND org_id IN (SELECT public.current_user_org_ids())
  )
  WITH CHECK (
    public.has_role(auth.uid(), 'recruiter')
    AND org_id IS NOT NULL
    AND org_id IN (SELECT public.current_user_org_ids())
  );

DROP POLICY IF EXISTS "Candidates view own interviews" ON public.interviews;
CREATE POLICY "Candidates view own interviews" ON public.interviews
  FOR SELECT TO authenticated
  USING (
    deleted_at IS NULL AND EXISTS (
      SELECT 1 FROM public.candidates c
       WHERE c.id = interviews.candidate_id AND c.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Recruiters manage org interviews" ON public.interviews;
CREATE POLICY "Recruiters manage org interviews" ON public.interviews
  FOR ALL TO authenticated
  USING (
    public.has_role(auth.uid(), 'recruiter')
    AND org_id IS NOT NULL
    AND org_id IN (SELECT public.current_user_org_ids())
  )
  WITH CHECK (
    public.has_role(auth.uid(), 'recruiter')
    AND org_id IS NOT NULL
    AND org_id IN (SELECT public.current_user_org_ids())
  );
