
-- Helper: get current user's org_id (SECURITY DEFINER to avoid RLS recursion on profiles)
CREATE OR REPLACE FUNCTION public.current_user_org_id()
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT org_id FROM public.profiles WHERE id = auth.uid()
$$;

-- CANDIDATES: scope recruiters to their org; admins keep full access
DROP POLICY IF EXISTS "Recruiters manage candidates" ON public.candidates;
CREATE POLICY "Admins manage all candidates" ON public.candidates
  FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Recruiters manage org candidates" ON public.candidates
  FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'recruiter'::app_role) AND org_id IS NOT NULL AND org_id = public.current_user_org_id())
  WITH CHECK (has_role(auth.uid(), 'recruiter'::app_role) AND org_id IS NOT NULL AND org_id = public.current_user_org_id());

-- INTERVIEWS
DROP POLICY IF EXISTS "Recruiters manage interviews" ON public.interviews;
CREATE POLICY "Admins manage all interviews" ON public.interviews
  FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Recruiters manage org interviews" ON public.interviews
  FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'recruiter'::app_role) AND org_id IS NOT NULL AND org_id = public.current_user_org_id())
  WITH CHECK (has_role(auth.uid(), 'recruiter'::app_role) AND org_id IS NOT NULL AND org_id = public.current_user_org_id());

-- JOB DESCRIPTIONS
DROP POLICY IF EXISTS "Recruiters manage job descriptions" ON public.job_descriptions;
CREATE POLICY "Admins manage all job descriptions" ON public.job_descriptions
  FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Recruiters manage org job descriptions" ON public.job_descriptions
  FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'recruiter'::app_role) AND org_id IS NOT NULL AND org_id = public.current_user_org_id())
  WITH CHECK (has_role(auth.uid(), 'recruiter'::app_role) AND org_id IS NOT NULL AND org_id = public.current_user_org_id());

-- PERSONAS
DROP POLICY IF EXISTS "Recruiters manage personas" ON public.personas;
CREATE POLICY "Admins manage all personas" ON public.personas
  FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Recruiters manage org personas" ON public.personas
  FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'recruiter'::app_role) AND org_id IS NOT NULL AND org_id = public.current_user_org_id())
  WITH CHECK (has_role(auth.uid(), 'recruiter'::app_role) AND org_id IS NOT NULL AND org_id = public.current_user_org_id());

-- WORKSPACE SETTINGS: admins only (was visible to every authenticated user)
DROP POLICY IF EXISTS "Authenticated can view workspace settings" ON public.workspace_settings;
CREATE POLICY "Admins view workspace settings" ON public.workspace_settings
  FOR SELECT TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role));
