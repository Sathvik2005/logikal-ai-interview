
-- 1. Extend interview_invitations
ALTER TABLE public.interview_invitations
  ADD COLUMN IF NOT EXISTS token uuid UNIQUE DEFAULT gen_random_uuid(),
  ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'pending',
  ADD COLUMN IF NOT EXISTS email text,
  ADD COLUMN IF NOT EXISTS candidate_id uuid REFERENCES public.candidates(id) ON DELETE CASCADE,
  ADD COLUMN IF NOT EXISTS org_id uuid,
  ADD COLUMN IF NOT EXISTS sent_at timestamptz,
  ADD COLUMN IF NOT EXISTS opened_at timestamptz,
  ADD COLUMN IF NOT EXISTS joined_at timestamptz;

-- Backfill org_id, candidate_id, email from interviews/candidates for any pre-existing rows
UPDATE public.interview_invitations inv
   SET org_id = i.org_id,
       candidate_id = i.candidate_id
  FROM public.interviews i
 WHERE inv.interview_id = i.id
   AND (inv.org_id IS NULL OR inv.candidate_id IS NULL);

UPDATE public.interview_invitations inv
   SET email = c.email
  FROM public.candidates c
 WHERE inv.candidate_id = c.id
   AND inv.email IS NULL;

CREATE INDEX IF NOT EXISTS interview_invitations_candidate_idx ON public.interview_invitations(candidate_id);
CREATE INDEX IF NOT EXISTS interview_invitations_email_idx ON public.interview_invitations(lower(email));
CREATE INDEX IF NOT EXISTS interview_invitations_token_idx ON public.interview_invitations(token);

-- 2. Candidate self-read policy
DROP POLICY IF EXISTS "Candidates read own interview_invitations" ON public.interview_invitations;
CREATE POLICY "Candidates read own interview_invitations"
  ON public.interview_invitations
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.candidates c
       WHERE c.id = interview_invitations.candidate_id
         AND (c.user_id = auth.uid()
              OR lower(c.email) = lower(coalesce((auth.jwt() ->> 'email'), '')))
    )
  );

-- Allow recruiter inserts/updates (admin via existing policies already covers admins; recruiters need write)
DROP POLICY IF EXISTS "Org recruiters manage interview_invitations" ON public.interview_invitations;
CREATE POLICY "Org recruiters manage interview_invitations"
  ON public.interview_invitations
  FOR ALL
  TO authenticated
  USING (
    org_id IN (SELECT public.current_user_org_ids())
  )
  WITH CHECK (
    org_id IN (SELECT public.current_user_org_ids())
  );

-- 3. Claim helper: link candidate to auth user when emails match
CREATE OR REPLACE FUNCTION public.claim_invitation_for_user(_token uuid)
RETURNS TABLE (interview_id uuid, status text)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _inv public.interview_invitations%ROWTYPE;
  _user_email text;
BEGIN
  SELECT * INTO _inv FROM public.interview_invitations WHERE token = _token;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Invitation not found';
  END IF;

  SELECT lower(email) INTO _user_email FROM auth.users WHERE id = auth.uid();
  IF _user_email IS NULL THEN
    RAISE EXCEPTION 'Not signed in';
  END IF;

  IF lower(coalesce(_inv.email, '')) <> _user_email THEN
    RAISE EXCEPTION 'Invitation email does not match signed-in user';
  END IF;

  -- Link candidate record if not yet linked
  UPDATE public.candidates
     SET user_id = auth.uid()
   WHERE id = _inv.candidate_id
     AND user_id IS NULL;

  UPDATE public.interview_invitations
     SET joined_at = COALESCE(joined_at, now()),
         status = CASE WHEN status IN ('pending','sent','opened') THEN 'joined' ELSE status END
   WHERE id = _inv.id;

  RETURN QUERY SELECT _inv.interview_id, 'joined'::text;
END;
$$;

REVOKE ALL ON FUNCTION public.claim_invitation_for_user(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.claim_invitation_for_user(uuid) TO authenticated;
