
-- 1. Organizations: restrict SELECT to member orgs
DROP POLICY IF EXISTS "Authenticated can view organizations" ON public.organizations;
CREATE POLICY "Members can view their organizations"
  ON public.organizations FOR SELECT
  TO authenticated
  USING (
    id IN (SELECT public.current_user_org_ids())
    OR public.has_role(auth.uid(), 'admin'::public.app_role)
  );

-- 2. Notification outbox: admins only
DROP POLICY IF EXISTS "Org members read notification_outbox" ON public.notification_outbox;
CREATE POLICY "Admins read notification_outbox"
  ON public.notification_outbox FOR SELECT
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::public.app_role));

-- 3. Recordings storage bucket: admin-only direct access; server uses service role
CREATE POLICY "Admins can read recordings"
  ON storage.objects FOR SELECT
  TO authenticated
  USING (bucket_id = 'recordings' AND public.has_role(auth.uid(), 'admin'::public.app_role));
CREATE POLICY "Admins can insert recordings"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (bucket_id = 'recordings' AND public.has_role(auth.uid(), 'admin'::public.app_role));
CREATE POLICY "Admins can update recordings"
  ON storage.objects FOR UPDATE
  TO authenticated
  USING (bucket_id = 'recordings' AND public.has_role(auth.uid(), 'admin'::public.app_role));
CREATE POLICY "Admins can delete recordings"
  ON storage.objects FOR DELETE
  TO authenticated
  USING (bucket_id = 'recordings' AND public.has_role(auth.uid(), 'admin'::public.app_role));

-- 4. Revoke EXECUTE from anon/public on SECURITY DEFINER helpers
REVOKE EXECUTE ON FUNCTION public.get_candidate_quality_by_role() FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.get_persona_effectiveness() FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.get_recruiter_funnel() FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.get_time_to_hire() FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.refresh_analytics_mvs() FROM PUBLIC, anon;

-- 5. Fix has_role_in_org NULL org_id bypass
CREATE OR REPLACE FUNCTION public.has_role_in_org(_user_id uuid, _org_id uuid, _role public.app_role)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id
      AND role = _role
      AND org_id = _org_id
  )
$$;
