
CREATE MATERIALIZED VIEW IF NOT EXISTS public.mv_recruiter_funnel AS
SELECT c.org_id, c.created_by AS recruiter_id, c.status::text AS status, count(*)::bigint AS total
FROM public.candidates c
WHERE c.deleted_at IS NULL
GROUP BY c.org_id, c.created_by, c.status;

CREATE UNIQUE INDEX IF NOT EXISTS mv_recruiter_funnel_uq
  ON public.mv_recruiter_funnel (org_id, recruiter_id, status);

CREATE MATERIALIZED VIEW IF NOT EXISTS public.mv_time_to_hire AS
SELECT c.org_id, c.id AS candidate_id, c.created_at AS sourced_at,
  min(i.scheduled_at) FILTER (WHERE i.status = 'completed') AS first_completed_at,
  EXTRACT(epoch FROM (min(i.scheduled_at) FILTER (WHERE i.status = 'completed') - c.created_at)) / 86400.0 AS days_to_hire
FROM public.candidates c
LEFT JOIN public.interviews i ON i.candidate_id = c.id AND i.deleted_at IS NULL
WHERE c.deleted_at IS NULL
GROUP BY c.org_id, c.id, c.created_at;

CREATE UNIQUE INDEX IF NOT EXISTS mv_time_to_hire_uq ON public.mv_time_to_hire (org_id, candidate_id);

CREATE MATERIALIZED VIEW IF NOT EXISTS public.mv_persona_effectiveness AS
SELECT i.org_id, i.persona_id,
  count(*) FILTER (WHERE i.status = 'completed')::bigint AS completed_count,
  avg(i.overall_score) FILTER (WHERE i.status = 'completed')::numeric(6,2) AS avg_score,
  (count(*) FILTER (WHERE i.recommendation IN ('strong_hire','hire'))::numeric
    / NULLIF(count(*) FILTER (WHERE i.status = 'completed'),0))::numeric(6,3) AS hire_rate
FROM public.interviews i
WHERE i.deleted_at IS NULL AND i.persona_id IS NOT NULL
GROUP BY i.org_id, i.persona_id;

CREATE UNIQUE INDEX IF NOT EXISTS mv_persona_effectiveness_uq ON public.mv_persona_effectiveness (org_id, persona_id);

CREATE MATERIALIZED VIEW IF NOT EXISTS public.mv_candidate_quality_by_role AS
SELECT c.org_id, COALESCE(c.role_applied, 'unspecified') AS role_applied,
  count(*)::bigint AS total_candidates,
  avg(i.overall_score)::numeric(6,2) AS avg_interview_score,
  count(*) FILTER (WHERE i.recommendation IN ('strong_hire','hire'))::bigint AS hire_recommendations
FROM public.candidates c
LEFT JOIN public.interviews i ON i.candidate_id = c.id AND i.deleted_at IS NULL AND i.status = 'completed'
WHERE c.deleted_at IS NULL
GROUP BY c.org_id, COALESCE(c.role_applied, 'unspecified');

CREATE UNIQUE INDEX IF NOT EXISTS mv_candidate_quality_by_role_uq ON public.mv_candidate_quality_by_role (org_id, role_applied);

CREATE OR REPLACE FUNCTION public.refresh_analytics_mvs()
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  REFRESH MATERIALIZED VIEW CONCURRENTLY public.mv_recruiter_funnel;
  REFRESH MATERIALIZED VIEW CONCURRENTLY public.mv_time_to_hire;
  REFRESH MATERIALIZED VIEW CONCURRENTLY public.mv_persona_effectiveness;
  REFRESH MATERIALIZED VIEW CONCURRENTLY public.mv_candidate_quality_by_role;
END;
$$;

CREATE OR REPLACE FUNCTION public.get_recruiter_funnel()
RETURNS TABLE(org_id uuid, recruiter_id uuid, status text, total bigint)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT m.org_id, m.recruiter_id, m.status, m.total FROM public.mv_recruiter_funnel m
  WHERE m.org_id IN (SELECT public.current_user_org_ids())
$$;

CREATE OR REPLACE FUNCTION public.get_time_to_hire()
RETURNS TABLE(org_id uuid, candidate_id uuid, sourced_at timestamptz, first_completed_at timestamptz, days_to_hire numeric)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT m.org_id, m.candidate_id, m.sourced_at, m.first_completed_at, m.days_to_hire FROM public.mv_time_to_hire m
  WHERE m.org_id IN (SELECT public.current_user_org_ids())
$$;

CREATE OR REPLACE FUNCTION public.get_persona_effectiveness()
RETURNS TABLE(org_id uuid, persona_id uuid, completed_count bigint, avg_score numeric, hire_rate numeric)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT m.org_id, m.persona_id, m.completed_count, m.avg_score, m.hire_rate FROM public.mv_persona_effectiveness m
  WHERE m.org_id IN (SELECT public.current_user_org_ids())
$$;

CREATE OR REPLACE FUNCTION public.get_candidate_quality_by_role()
RETURNS TABLE(org_id uuid, role_applied text, total_candidates bigint, avg_interview_score numeric, hire_recommendations bigint)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT m.org_id, m.role_applied, m.total_candidates, m.avg_interview_score, m.hire_recommendations FROM public.mv_candidate_quality_by_role m
  WHERE m.org_id IN (SELECT public.current_user_org_ids())
$$;

GRANT EXECUTE ON FUNCTION public.get_recruiter_funnel() TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_time_to_hire() TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_persona_effectiveness() TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_candidate_quality_by_role() TO authenticated;
GRANT EXECUTE ON FUNCTION public.refresh_analytics_mvs() TO service_role;

CREATE TABLE IF NOT EXISTS public.report_exports (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  requested_by uuid NOT NULL,
  kind text NOT NULL,
  entity_id uuid,
  storage_path text NOT NULL,
  status text NOT NULL DEFAULT 'ready',
  error text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE ON public.report_exports TO authenticated;
GRANT ALL ON public.report_exports TO service_role;

ALTER TABLE public.report_exports ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Members can read their org report exports"
  ON public.report_exports FOR SELECT TO authenticated
  USING (org_id IN (SELECT public.current_user_org_ids()));

CREATE POLICY "Members can insert their org report exports"
  ON public.report_exports FOR INSERT TO authenticated
  WITH CHECK (org_id IN (SELECT public.current_user_org_ids()) AND requested_by = auth.uid());

CREATE TRIGGER touch_report_exports_updated_at
  BEFORE UPDATE ON public.report_exports
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
