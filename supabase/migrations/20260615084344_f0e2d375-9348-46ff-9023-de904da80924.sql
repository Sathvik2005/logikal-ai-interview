
CREATE EXTENSION IF NOT EXISTS btree_gist;

-- ============================================================
-- PHASE 3
-- ============================================================

ALTER TABLE public.job_descriptions
  ADD COLUMN IF NOT EXISTS competencies jsonb NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS seniority text,
  ADD COLUMN IF NOT EXISTS salary_min numeric,
  ADD COLUMN IF NOT EXISTS salary_max numeric,
  ADD COLUMN IF NOT EXISTS salary_currency text,
  ADD COLUMN IF NOT EXISTS persona_id uuid REFERENCES public.personas(id) ON DELETE SET NULL;

CREATE TABLE IF NOT EXISTS public.persona_versions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  persona_id uuid NOT NULL REFERENCES public.personas(id) ON DELETE CASCADE,
  org_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  version integer NOT NULL,
  system_prompt text NOT NULL,
  rubric jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_by uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (persona_id, version)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.persona_versions TO authenticated;
GRANT ALL ON public.persona_versions TO service_role;
ALTER TABLE public.persona_versions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins manage all persona_versions" ON public.persona_versions TO authenticated
  USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Recruiters manage org persona_versions" ON public.persona_versions TO authenticated
  USING (public.has_role(auth.uid(), 'recruiter') AND org_id IN (SELECT public.current_user_org_ids()))
  WITH CHECK (public.has_role(auth.uid(), 'recruiter') AND org_id IN (SELECT public.current_user_org_ids()));
CREATE INDEX IF NOT EXISTS persona_versions_persona_idx ON public.persona_versions (persona_id, version DESC);

CREATE TABLE IF NOT EXISTS public.questions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  created_by uuid NOT NULL,
  competency text,
  difficulty text,
  type text NOT NULL DEFAULT 'open',
  prompt text NOT NULL,
  expected_signals jsonb NOT NULL DEFAULT '[]'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  deleted_at timestamptz
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.questions TO authenticated;
GRANT ALL ON public.questions TO service_role;
ALTER TABLE public.questions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins manage all questions" ON public.questions TO authenticated
  USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Recruiters manage org questions" ON public.questions TO authenticated
  USING (deleted_at IS NULL AND public.has_role(auth.uid(), 'recruiter') AND org_id IN (SELECT public.current_user_org_ids()))
  WITH CHECK (public.has_role(auth.uid(), 'recruiter') AND org_id IN (SELECT public.current_user_org_ids()));
CREATE INDEX IF NOT EXISTS questions_org_competency_idx ON public.questions (org_id, competency) WHERE deleted_at IS NULL;
CREATE TRIGGER questions_touch BEFORE UPDATE ON public.questions FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

CREATE TABLE IF NOT EXISTS public.persona_questions (
  persona_version_id uuid NOT NULL REFERENCES public.persona_versions(id) ON DELETE CASCADE,
  question_id uuid NOT NULL REFERENCES public.questions(id) ON DELETE CASCADE,
  ordering integer NOT NULL DEFAULT 0,
  PRIMARY KEY (persona_version_id, question_id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.persona_questions TO authenticated;
GRANT ALL ON public.persona_questions TO service_role;
ALTER TABLE public.persona_questions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Org members manage persona_questions" ON public.persona_questions TO authenticated
  USING (EXISTS (SELECT 1 FROM public.persona_versions pv WHERE pv.id = persona_questions.persona_version_id AND pv.org_id IN (SELECT public.current_user_org_ids())))
  WITH CHECK (EXISTS (SELECT 1 FROM public.persona_versions pv WHERE pv.id = persona_questions.persona_version_id AND pv.org_id IN (SELECT public.current_user_org_ids())));

-- ============================================================
-- PHASE 4
-- ============================================================

CREATE TABLE IF NOT EXISTS public.interview_slots (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  recruiter_id uuid NOT NULL,
  starts_at timestamptz NOT NULL,
  ends_at timestamptz NOT NULL,
  status text NOT NULL DEFAULT 'available',
  created_at timestamptz NOT NULL DEFAULT now(),
  CHECK (ends_at > starts_at)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.interview_slots TO authenticated;
GRANT ALL ON public.interview_slots TO service_role;
ALTER TABLE public.interview_slots ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins manage all interview_slots" ON public.interview_slots TO authenticated
  USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Recruiters manage org interview_slots" ON public.interview_slots TO authenticated
  USING (public.has_role(auth.uid(), 'recruiter') AND org_id IN (SELECT public.current_user_org_ids()))
  WITH CHECK (public.has_role(auth.uid(), 'recruiter') AND org_id IN (SELECT public.current_user_org_ids()));
CREATE INDEX IF NOT EXISTS interview_slots_recruiter_idx ON public.interview_slots (recruiter_id, starts_at);

CREATE TABLE IF NOT EXISTS public.interview_invitations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  interview_id uuid NOT NULL REFERENCES public.interviews(id) ON DELETE CASCADE,
  candidate_token_hash text NOT NULL UNIQUE,
  expires_at timestamptz NOT NULL,
  accepted_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.interview_invitations TO authenticated;
GRANT ALL ON public.interview_invitations TO service_role;
ALTER TABLE public.interview_invitations ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Org recruiters read interview_invitations" ON public.interview_invitations
  FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.interviews i WHERE i.id = interview_invitations.interview_id AND i.org_id IN (SELECT public.current_user_org_ids())));
CREATE INDEX IF NOT EXISTS interview_invitations_interview_idx ON public.interview_invitations (interview_id);

CREATE TABLE IF NOT EXISTS public.interview_reschedules (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  interview_id uuid NOT NULL REFERENCES public.interviews(id) ON DELETE CASCADE,
  from_at timestamptz,
  to_at timestamptz NOT NULL,
  reason text,
  actor_id uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.interview_reschedules TO authenticated;
GRANT ALL ON public.interview_reschedules TO service_role;
ALTER TABLE public.interview_reschedules ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Org members read interview_reschedules" ON public.interview_reschedules
  FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.interviews i WHERE i.id = interview_reschedules.interview_id AND i.org_id IN (SELECT public.current_user_org_ids())));
CREATE INDEX IF NOT EXISTS interview_reschedules_interview_idx ON public.interview_reschedules (interview_id, created_at DESC);

-- recruiter_id column + IMMUTABLE range helper
ALTER TABLE public.interviews ADD COLUMN IF NOT EXISTS recruiter_id uuid;
UPDATE public.interviews SET recruiter_id = created_by WHERE recruiter_id IS NULL;

CREATE OR REPLACE FUNCTION public.interview_window(_start timestamptz, _mins integer)
RETURNS tstzrange
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT tstzrange(_start, _start + (COALESCE(_mins, 45) || ' minutes')::interval, '[)')
$$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'interviews_no_recruiter_overlap') THEN
    ALTER TABLE public.interviews
      ADD CONSTRAINT interviews_no_recruiter_overlap
      EXCLUDE USING gist (
        recruiter_id WITH =,
        public.interview_window(scheduled_at, duration_minutes) WITH &&
      )
      WHERE (scheduled_at IS NOT NULL AND deleted_at IS NULL AND status IN ('scheduled','in_progress'));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'interviews_no_candidate_overlap') THEN
    ALTER TABLE public.interviews
      ADD CONSTRAINT interviews_no_candidate_overlap
      EXCLUDE USING gist (
        candidate_id WITH =,
        public.interview_window(scheduled_at, duration_minutes) WITH &&
      )
      WHERE (scheduled_at IS NOT NULL AND deleted_at IS NULL AND status IN ('scheduled','in_progress'));
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS public.notification_outbox (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  kind text NOT NULL,
  recipient_email text NOT NULL,
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  status text NOT NULL DEFAULT 'pending',
  error text,
  send_after timestamptz NOT NULL DEFAULT now(),
  sent_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.notification_outbox TO authenticated;
GRANT ALL ON public.notification_outbox TO service_role;
ALTER TABLE public.notification_outbox ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Org members read notification_outbox" ON public.notification_outbox
  FOR SELECT TO authenticated
  USING (org_id IN (SELECT public.current_user_org_ids()));
CREATE INDEX IF NOT EXISTS notification_outbox_status_idx ON public.notification_outbox (status, send_after);
CREATE INDEX IF NOT EXISTS notification_outbox_org_idx ON public.notification_outbox (org_id, created_at DESC);
