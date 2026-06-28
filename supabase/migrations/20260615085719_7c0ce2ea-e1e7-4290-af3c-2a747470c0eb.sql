
-- rate_limits: simple bucket per key per window
CREATE TABLE IF NOT EXISTS public.rate_limits (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  key text NOT NULL,
  window_start timestamptz NOT NULL,
  count integer NOT NULL DEFAULT 0,
  UNIQUE (key, window_start)
);
GRANT SELECT, INSERT, UPDATE ON public.rate_limits TO authenticated;
GRANT ALL ON public.rate_limits TO service_role;
ALTER TABLE public.rate_limits ENABLE ROW LEVEL SECURITY;
CREATE POLICY "service role manages rate limits" ON public.rate_limits
  FOR ALL TO service_role USING (true) WITH CHECK (true);

CREATE OR REPLACE FUNCTION public.check_rate_limit(_key text, _max int, _window_seconds int)
RETURNS boolean
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  bucket_start timestamptz;
  current_count int;
BEGIN
  bucket_start := date_trunc('second', now()) - ((extract(epoch FROM now())::bigint % _window_seconds) || ' seconds')::interval;
  INSERT INTO public.rate_limits (key, window_start, count)
    VALUES (_key, bucket_start, 1)
    ON CONFLICT (key, window_start) DO UPDATE SET count = public.rate_limits.count + 1
  RETURNING count INTO current_count;
  RETURN current_count <= _max;
END;
$$;
REVOKE EXECUTE ON FUNCTION public.check_rate_limit(text, int, int) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.check_rate_limit(text, int, int) TO authenticated, service_role;

-- error_events: structured logs
CREATE TABLE IF NOT EXISTS public.error_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid,
  actor_id uuid,
  source text NOT NULL,
  level text NOT NULL DEFAULT 'error',
  message text NOT NULL,
  stack text,
  context jsonb NOT NULL DEFAULT '{}'::jsonb,
  request_id text,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.error_events TO authenticated;
GRANT ALL ON public.error_events TO service_role;
ALTER TABLE public.error_events ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins read org errors" ON public.error_events FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin') AND (org_id IS NULL OR org_id IN (SELECT public.current_user_org_ids())));
CREATE INDEX IF NOT EXISTS error_events_org_created_idx ON public.error_events (org_id, created_at DESC);

-- gdpr_requests
CREATE TABLE IF NOT EXISTS public.gdpr_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid,
  user_id uuid NOT NULL,
  kind text NOT NULL CHECK (kind IN ('export','deletion')),
  status text NOT NULL DEFAULT 'pending',
  storage_path text,
  error text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT ON public.gdpr_requests TO authenticated;
GRANT ALL ON public.gdpr_requests TO service_role;
ALTER TABLE public.gdpr_requests ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Owner reads own gdpr requests" ON public.gdpr_requests FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR (public.has_role(auth.uid(),'admin') AND org_id IN (SELECT public.current_user_org_ids())));
CREATE POLICY "Owner creates own gdpr requests" ON public.gdpr_requests FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());
CREATE TRIGGER touch_gdpr_requests BEFORE UPDATE ON public.gdpr_requests
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- Retention job: anonymise soft-deleted candidates past retention_months
CREATE OR REPLACE FUNCTION public.anonymise_expired_candidates()
RETURNS int
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  affected int := 0;
BEGIN
  WITH expired AS (
    SELECT c.id FROM public.candidates c
    LEFT JOIN public.workspace_settings w ON w.org_id = c.org_id
    WHERE c.deleted_at IS NOT NULL
      AND c.deleted_at < now() - (COALESCE(w.retention_months, (SELECT retention_months FROM public.workspace_settings WHERE org_id IS NULL LIMIT 1), 12) || ' months')::interval
      AND c.email NOT LIKE 'anonymised+%'
  )
  UPDATE public.candidates c
     SET full_name = 'Anonymised',
         email = 'anonymised+' || c.id || '@example.invalid',
         phone = NULL,
         resume_url = NULL,
         resume_summary = NULL,
         skills = NULL
   FROM expired
   WHERE c.id = expired.id;
  GET DIAGNOSTICS affected = ROW_COUNT;
  RETURN affected;
END;
$$;
REVOKE EXECUTE ON FUNCTION public.anonymise_expired_candidates() FROM public, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.anonymise_expired_candidates() TO service_role;
