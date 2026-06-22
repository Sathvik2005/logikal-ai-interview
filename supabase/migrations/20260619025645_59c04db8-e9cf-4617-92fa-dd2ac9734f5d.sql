
-- 1. current_user_org_ids: remove profiles fallback (prevents profile-based escalation)
CREATE OR REPLACE FUNCTION public.current_user_org_ids()
 RETURNS SETOF uuid
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT DISTINCT org_id FROM public.user_roles
   WHERE user_id = auth.uid() AND org_id IS NOT NULL
$function$;

-- 2. Prevent users from changing their own profile.org_id
CREATE OR REPLACE FUNCTION public.prevent_profile_org_change()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.org_id IS DISTINCT FROM OLD.org_id THEN
    -- Only admins may change org_id assignment
    IF NOT public.has_role(auth.uid(), 'admin') THEN
      NEW.org_id := OLD.org_id;
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS profiles_prevent_org_change ON public.profiles;
CREATE TRIGGER profiles_prevent_org_change
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.prevent_profile_org_change();

-- 3. Notification outbox: scope admin reads to their org
DROP POLICY IF EXISTS "Admins read notification_outbox" ON public.notification_outbox;
CREATE POLICY "Admins read notification_outbox"
  ON public.notification_outbox
  FOR SELECT
  TO authenticated
  USING (
    has_role(auth.uid(), 'admin')
    AND org_id IN (SELECT public.current_user_org_ids())
  );

-- 4. interview_invitations: revoke raw token columns from authenticated role
REVOKE SELECT (token, candidate_token_hash) ON public.interview_invitations FROM authenticated;
REVOKE SELECT (token, candidate_token_hash) ON public.interview_invitations FROM anon;

-- 5. Storage: identity bucket — scope to recruiter's org via identity_verifications
DROP POLICY IF EXISTS identity_recruiter_read ON storage.objects;
CREATE POLICY identity_recruiter_read
  ON storage.objects
  FOR SELECT
  TO authenticated
  USING (
    bucket_id = 'identity'
    AND (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'recruiter'))
    AND EXISTS (
      SELECT 1 FROM public.identity_verifications iv
      WHERE (iv.selfie_path = storage.objects.name OR iv.id_document_path = storage.objects.name)
        AND iv.org_id IN (SELECT public.current_user_org_ids())
    )
  );

-- 6. Storage: snapshots bucket — scope to recruiter's org via proctoring_snapshots
DROP POLICY IF EXISTS snapshots_recruiter_read ON storage.objects;
CREATE POLICY snapshots_recruiter_read
  ON storage.objects
  FOR SELECT
  TO authenticated
  USING (
    bucket_id = 'snapshots'
    AND (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'recruiter'))
    AND EXISTS (
      SELECT 1 FROM public.proctoring_snapshots ps
      WHERE ps.storage_path = storage.objects.name
        AND ps.org_id IN (SELECT public.current_user_org_ids())
    )
  );
