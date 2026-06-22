
-- 1. identity_verifications
CREATE TABLE IF NOT EXISTS public.identity_verifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  interview_id uuid NOT NULL REFERENCES public.interviews(id) ON DELETE CASCADE,
  candidate_id uuid NOT NULL REFERENCES public.candidates(id) ON DELETE CASCADE,
  selfie_path text,
  id_document_path text,
  match_score numeric,
  status text NOT NULL DEFAULT 'pending',
  device_fingerprint jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_identity_interview ON public.identity_verifications(interview_id);

GRANT SELECT, INSERT, UPDATE ON public.identity_verifications TO authenticated;
GRANT ALL ON public.identity_verifications TO service_role;

ALTER TABLE public.identity_verifications ENABLE ROW LEVEL SECURITY;

CREATE POLICY "identity_candidate_self_rw"
ON public.identity_verifications FOR ALL TO authenticated
USING (EXISTS (SELECT 1 FROM public.candidates c WHERE c.id = identity_verifications.candidate_id AND c.user_id = auth.uid()))
WITH CHECK (EXISTS (SELECT 1 FROM public.candidates c WHERE c.id = identity_verifications.candidate_id AND c.user_id = auth.uid()));

CREATE POLICY "identity_org_recruiter_read"
ON public.identity_verifications FOR SELECT TO authenticated
USING (
  org_id IN (SELECT public.current_user_org_ids())
  AND (public.has_role(auth.uid(),'recruiter') OR public.has_role(auth.uid(),'admin'))
);

CREATE TRIGGER trg_identity_touch
BEFORE UPDATE ON public.identity_verifications
FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- 2. proctoring_snapshots
CREATE TABLE IF NOT EXISTS public.proctoring_snapshots (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  session_id uuid NOT NULL REFERENCES public.interview_sessions(id) ON DELETE CASCADE,
  interview_id uuid NOT NULL REFERENCES public.interviews(id) ON DELETE CASCADE,
  kind text NOT NULL,
  storage_path text NOT NULL,
  meta jsonb DEFAULT '{}'::jsonb,
  captured_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_snap_session ON public.proctoring_snapshots(session_id, captured_at);

GRANT SELECT ON public.proctoring_snapshots TO authenticated;
GRANT ALL ON public.proctoring_snapshots TO service_role;

ALTER TABLE public.proctoring_snapshots ENABLE ROW LEVEL SECURITY;

CREATE POLICY "snapshots_org_recruiter_read"
ON public.proctoring_snapshots FOR SELECT TO authenticated
USING (
  org_id IN (SELECT public.current_user_org_ids())
  AND (public.has_role(auth.uid(),'recruiter') OR public.has_role(auth.uid(),'admin'))
);

-- 3. interview_reports
CREATE TABLE IF NOT EXISTS public.interview_reports (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  interview_id uuid NOT NULL UNIQUE REFERENCES public.interviews(id) ON DELETE CASCADE,
  executive_summary text,
  scores jsonb NOT NULL DEFAULT '{}'::jsonb,
  strengths jsonb NOT NULL DEFAULT '[]'::jsonb,
  weaknesses jsonb NOT NULL DEFAULT '[]'::jsonb,
  knowledge_gaps jsonb NOT NULL DEFAULT '[]'::jsonb,
  integrity_score numeric,
  integrity_timeline jsonb NOT NULL DEFAULT '[]'::jsonb,
  evidence jsonb NOT NULL DEFAULT '[]'::jsonb,
  recommendation text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.interview_reports TO authenticated;
GRANT ALL ON public.interview_reports TO service_role;

ALTER TABLE public.interview_reports ENABLE ROW LEVEL SECURITY;

CREATE POLICY "reports_org_recruiter_read"
ON public.interview_reports FOR SELECT TO authenticated
USING (
  org_id IN (SELECT public.current_user_org_ids())
  AND (public.has_role(auth.uid(),'recruiter') OR public.has_role(auth.uid(),'admin'))
);

CREATE TRIGGER trg_reports_touch
BEFORE UPDATE ON public.interview_reports
FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- 4. Storage RLS policies
CREATE POLICY "identity_candidate_upload"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (
  bucket_id = 'identity'
  AND (storage.foldername(name))[1] = auth.uid()::text
);

CREATE POLICY "identity_candidate_read_own"
ON storage.objects FOR SELECT TO authenticated
USING (
  bucket_id = 'identity'
  AND (storage.foldername(name))[1] = auth.uid()::text
);

CREATE POLICY "identity_recruiter_read"
ON storage.objects FOR SELECT TO authenticated
USING (
  bucket_id = 'identity'
  AND (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'recruiter'))
);

CREATE POLICY "snapshots_recruiter_read"
ON storage.objects FOR SELECT TO authenticated
USING (
  bucket_id = 'snapshots'
  AND (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'recruiter'))
);
