
ALTER TABLE public.questions
  ADD COLUMN IF NOT EXISTS category text,
  ADD COLUMN IF NOT EXISTS mandatory boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS hints jsonb NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS bank_name text,
  ADD COLUMN IF NOT EXISTS sort_order integer NOT NULL DEFAULT 0;

CREATE INDEX IF NOT EXISTS idx_questions_bank_name ON public.questions(org_id, bank_name) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_questions_category ON public.questions(org_id, category) WHERE deleted_at IS NULL;

CREATE TABLE IF NOT EXISTS public.jd_candidate_matches (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL,
  job_id uuid NOT NULL REFERENCES public.job_descriptions(id) ON DELETE CASCADE,
  candidate_id uuid NOT NULL REFERENCES public.candidates(id) ON DELETE CASCADE,
  match_score numeric,
  missing_skills jsonb NOT NULL DEFAULT '[]'::jsonb,
  strengths jsonb NOT NULL DEFAULT '[]'::jsonb,
  focus_areas jsonb NOT NULL DEFAULT '[]'::jsonb,
  shortlisted boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(job_id, candidate_id)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.jd_candidate_matches TO authenticated;
GRANT ALL ON public.jd_candidate_matches TO service_role;

ALTER TABLE public.jd_candidate_matches ENABLE ROW LEVEL SECURITY;

CREATE POLICY "org members read jd matches" ON public.jd_candidate_matches
  FOR SELECT TO authenticated USING (org_id IN (SELECT public.current_user_org_ids()));
CREATE POLICY "org members insert jd matches" ON public.jd_candidate_matches
  FOR INSERT TO authenticated WITH CHECK (org_id IN (SELECT public.current_user_org_ids()));
CREATE POLICY "org members update jd matches" ON public.jd_candidate_matches
  FOR UPDATE TO authenticated USING (org_id IN (SELECT public.current_user_org_ids()))
  WITH CHECK (org_id IN (SELECT public.current_user_org_ids()));
CREATE POLICY "org members delete jd matches" ON public.jd_candidate_matches
  FOR DELETE TO authenticated USING (org_id IN (SELECT public.current_user_org_ids()));

CREATE TRIGGER jd_matches_touch BEFORE UPDATE ON public.jd_candidate_matches
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

CREATE OR REPLACE FUNCTION public.get_completion_rates()
RETURNS TABLE(org_id uuid, status text, total bigint)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT i.org_id, i.status::text, count(*)::bigint
  FROM public.interviews i
  WHERE i.deleted_at IS NULL AND i.org_id IN (SELECT public.current_user_org_ids())
  GROUP BY i.org_id, i.status
$$;

CREATE OR REPLACE FUNCTION public.get_hiring_trends()
RETURNS TABLE(org_id uuid, week date, scheduled bigint, completed bigint, hired bigint)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT
    i.org_id,
    date_trunc('week', i.scheduled_at)::date AS week,
    count(*) FILTER (WHERE i.status IN ('scheduled','in_progress','completed','evaluation_pending'))::bigint,
    count(*) FILTER (WHERE i.status IN ('completed','evaluation_pending'))::bigint,
    count(*) FILTER (WHERE i.recommendation IN ('strong_hire','hire'))::bigint
  FROM public.interviews i
  WHERE i.deleted_at IS NULL
    AND i.scheduled_at IS NOT NULL
    AND i.scheduled_at >= now() - interval '90 days'
    AND i.org_id IN (SELECT public.current_user_org_ids())
  GROUP BY i.org_id, week
  ORDER BY week
$$;

CREATE OR REPLACE FUNCTION public.get_integrity_summary()
RETURNS TABLE(org_id uuid, total_interviews bigint, avg_integrity numeric, flagged bigint)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT
    i.org_id,
    count(*)::bigint,
    avg(i.integrity_score)::numeric,
    count(*) FILTER (WHERE i.integrity_score < 80)::bigint
  FROM public.interviews i
  WHERE i.deleted_at IS NULL AND i.org_id IN (SELECT public.current_user_org_ids())
  GROUP BY i.org_id
$$;

REVOKE EXECUTE ON FUNCTION public.get_completion_rates() FROM anon, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.get_hiring_trends() FROM anon, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.get_integrity_summary() FROM anon, PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_completion_rates() TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.get_hiring_trends() TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.get_integrity_summary() TO authenticated, service_role;
