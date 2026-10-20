-- =====================================================================
-- Fix Database Discrepancies (July 2026)
-- 1. Add all backend workflow statuses to candidate_status enum
-- 2. Add missing updated_at column to organizations table
-- =====================================================================

-- ---------- 1. Extend candidate_status enum with backend workflow values ----------
-- These values are used by the NestJS backend's CandidateWorkflowService
-- but were never added to the Postgres enum.

ALTER TYPE public.candidate_status ADD VALUE IF NOT EXISTS 'applied' AFTER 'new';
ALTER TYPE public.candidate_status ADD VALUE IF NOT EXISTS 'resume_imported' AFTER 'applied';
ALTER TYPE public.candidate_status ADD VALUE IF NOT EXISTS 'resume_parsed' AFTER 'resume_imported';
ALTER TYPE public.candidate_status ADD VALUE IF NOT EXISTS 'jd_matched' AFTER 'resume_parsed';
ALTER TYPE public.candidate_status ADD VALUE IF NOT EXISTS 'shortlisted' AFTER 'jd_matched';
ALTER TYPE public.candidate_status ADD VALUE IF NOT EXISTS 'interview_assigned' AFTER 'shortlisted';
ALTER TYPE public.candidate_status ADD VALUE IF NOT EXISTS 'interview_scheduled' AFTER 'interview_assigned';
ALTER TYPE public.candidate_status ADD VALUE IF NOT EXISTS 'invitation_sent' AFTER 'interview_scheduled';
ALTER TYPE public.candidate_status ADD VALUE IF NOT EXISTS 'interview_started' AFTER 'invitation_sent';
ALTER TYPE public.candidate_status ADD VALUE IF NOT EXISTS 'interview_running' AFTER 'interview_started';
ALTER TYPE public.candidate_status ADD VALUE IF NOT EXISTS 'evaluation_processing' AFTER 'interview_running';
ALTER TYPE public.candidate_status ADD VALUE IF NOT EXISTS 'recruiter_review' AFTER 'evaluation_processing';
ALTER TYPE public.candidate_status ADD VALUE IF NOT EXISTS 'hiring_decision' AFTER 'recruiter_review';

-- ---------- 2. Add missing updated_at to organizations ----------
ALTER TABLE public.organizations
  ADD COLUMN IF NOT EXISTS updated_at timestamptz DEFAULT now();

-- Add the touch trigger for organizations too
DROP TRIGGER IF EXISTS organizations_touch ON public.organizations;
CREATE TRIGGER organizations_touch
  BEFORE UPDATE ON public.organizations
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- ---------- 3. Fix demo seed: ensure profiles and roles for admin + candidate ----------
-- The handle_new_user() trigger should have done this, but direct auth.users INSERTs
-- in migration scripts don't always fire the trigger.

DO $$
DECLARE
  v_admin_id UUID;
  v_candidate_id UUID;
  v_recruiter_id UUID;
  v_org_id UUID;
BEGIN
  -- Get the demo org
  SELECT id INTO v_org_id FROM public.organizations WHERE name = 'Logikality Demo Org' LIMIT 1;

  -- Admin profile + role
  SELECT id INTO v_admin_id FROM auth.users WHERE email = 'superadmin@lokality.ai';
  IF v_admin_id IS NOT NULL THEN
    INSERT INTO public.profiles (id, email, full_name, org_id)
    VALUES (v_admin_id, 'superadmin@lokality.ai', 'Super Admin', v_org_id)
    ON CONFLICT (id) DO UPDATE SET
      org_id = COALESCE(EXCLUDED.org_id, public.profiles.org_id),
      full_name = EXCLUDED.full_name,
      email = EXCLUDED.email;

    IF NOT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = v_admin_id AND role = 'admin') THEN
      INSERT INTO public.user_roles (user_id, role) VALUES (v_admin_id, 'admin');
    END IF;
  END IF;

  -- Candidate profile + role
  SELECT id INTO v_candidate_id FROM auth.users WHERE email = 'sarah.j@example.com';
  IF v_candidate_id IS NOT NULL THEN
    INSERT INTO public.profiles (id, email, full_name, org_id)
    VALUES (v_candidate_id, 'sarah.j@example.com', 'Sarah Jenkins', v_org_id)
    ON CONFLICT (id) DO UPDATE SET
      org_id = COALESCE(EXCLUDED.org_id, public.profiles.org_id),
      full_name = EXCLUDED.full_name,
      email = EXCLUDED.email;

    IF NOT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = v_candidate_id AND role = 'candidate') THEN
      INSERT INTO public.user_roles (user_id, role) VALUES (v_candidate_id, 'candidate');
    END IF;
  END IF;

  -- Ensure recruiter also has org_id set in user_roles
  SELECT id INTO v_recruiter_id FROM auth.users WHERE email = 'recruitersatya@logikality.demo';
  IF v_recruiter_id IS NOT NULL AND v_org_id IS NOT NULL THEN
    UPDATE public.user_roles
    SET org_id = v_org_id
    WHERE user_id = v_recruiter_id AND role = 'recruiter' AND org_id IS NULL;
  END IF;
END $$;
