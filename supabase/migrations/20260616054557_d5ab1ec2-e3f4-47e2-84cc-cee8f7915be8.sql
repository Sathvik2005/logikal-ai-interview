
-- 1) Restrict token column on interview_invitations from authenticated users.
-- Server-side flows (validateInvitationToken, getInvitationLink) use service role and are unaffected.
REVOKE SELECT (token) ON public.interview_invitations FROM authenticated;
REVOKE SELECT (token, candidate_token_hash) ON public.interview_invitations FROM anon;

-- 2) Revoke EXECUTE on SECURITY DEFINER functions from anon/public.
DO $$
DECLARE
  fn text;
  fns text[] := ARRAY[
    'public.get_persona_effectiveness()',
    'public.get_time_to_hire()',
    'public.get_candidate_quality_by_role()',
    'public.has_role(uuid, public.app_role)',
    'public.has_role_in_org(uuid, uuid, public.app_role)',
    'public.anonymise_expired_candidates()',
    'public.get_recruiter_funnel()',
    'public.refresh_analytics_mvs()',
    'public.check_rate_limit(text, integer, integer)',
    'public.current_user_org_id()',
    'public.current_user_org_ids()',
    'public.claim_invitation_for_user(uuid)'
  ];
BEGIN
  FOREACH fn IN ARRAY fns LOOP
    EXECUTE format('REVOKE ALL ON FUNCTION %s FROM PUBLIC, anon', fn);
    EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO authenticated, service_role', fn);
  END LOOP;
END $$;

-- Maintenance/admin-only functions: restrict to service_role only
REVOKE EXECUTE ON FUNCTION public.anonymise_expired_candidates() FROM authenticated;
REVOKE EXECUTE ON FUNCTION public.refresh_analytics_mvs() FROM authenticated;
