-- 1. Create missing tables
CREATE TABLE IF NOT EXISTS public.question_banks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  created_by uuid NOT NULL,
  title text NOT NULL,
  job_title text,
  department text,
  experience_level text,
  interview_type text,
  description text,
  tags text[] NOT NULL DEFAULT '{}',
  difficulty_level text,
  category text,
  status text NOT NULL DEFAULT 'active',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  deleted_at timestamptz
);

CREATE TABLE IF NOT EXISTS public.candidate_timeline (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  candidate_id uuid NOT NULL REFERENCES public.candidates(id) ON DELETE CASCADE,
  event_type text NOT NULL,
  title text NOT NULL,
  description text,
  meta jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.interview_templates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  org_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  job_id uuid REFERENCES public.job_descriptions(id) ON DELETE SET NULL,
  persona_id uuid REFERENCES public.personas(id) ON DELETE SET NULL,
  question_bank_ids uuid[] DEFAULT '{}',
  evaluation_criteria jsonb NOT NULL DEFAULT '{}'::jsonb,
  knowledge_base text,
  duration_minutes integer NOT NULL DEFAULT 45,
  difficulty text NOT NULL DEFAULT 'medium',
  meeting_provider text NOT NULL DEFAULT 'teams',
  proctoring_policy jsonb NOT NULL DEFAULT '{}'::jsonb,
  report_template jsonb NOT NULL DEFAULT '{}'::jsonb,
  notification_rules jsonb NOT NULL DEFAULT '{}'::jsonb,
  retry_policy jsonb NOT NULL DEFAULT '{}'::jsonb,
  language text NOT NULL DEFAULT 'en',
  follow_up_strategy text NOT NULL DEFAULT 'adaptive',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- 2. Add missing candidate columns
ALTER TABLE public.candidates
  ADD COLUMN IF NOT EXISTS job_id uuid REFERENCES public.job_descriptions(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS custom_role jsonb DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS resume_analysis jsonb DEFAULT '{}'::jsonb;

-- 3. Add missing columns to questions table
ALTER TABLE public.questions 
  ADD COLUMN IF NOT EXISTS question_bank_id uuid REFERENCES public.question_banks(id) ON DELETE CASCADE,
  ADD COLUMN IF NOT EXISTS expected_answer text,
  ADD COLUMN IF NOT EXISTS ai_follow_up boolean DEFAULT true,
  ADD COLUMN IF NOT EXISTS estimated_time integer,
  ADD COLUMN IF NOT EXISTS evaluation_weight integer DEFAULT 1,
  ADD COLUMN IF NOT EXISTS keywords text[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS notes text,
  ADD COLUMN IF NOT EXISTS priority integer DEFAULT 1,
  ADD COLUMN IF NOT EXISTS section_title text;

-- 4. Add missing template_id to interviews
ALTER TABLE public.interviews
  ADD COLUMN IF NOT EXISTS template_id uuid REFERENCES public.interview_templates(id) ON DELETE SET NULL;

-- 5. Seed the default organization record to prevent foreign key issues
INSERT INTO public.organizations (id, name, created_at, updated_at)
VALUES ('00000000-0000-0000-0000-000000000000', 'Default System Organization', now(), now())
ON CONFLICT (id) DO NOTHING;
