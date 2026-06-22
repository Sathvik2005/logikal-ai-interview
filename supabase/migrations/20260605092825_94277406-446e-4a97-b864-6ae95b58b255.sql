
-- Recruiter module tables
CREATE TABLE public.job_descriptions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid,
  created_by uuid NOT NULL,
  title text NOT NULL,
  department text,
  location text,
  employment_type text,
  description text,
  requirements text,
  status text NOT NULL DEFAULT 'draft',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.job_descriptions TO authenticated;
GRANT ALL ON public.job_descriptions TO service_role;
ALTER TABLE public.job_descriptions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Recruiters manage job descriptions" ON public.job_descriptions FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'recruiter') OR has_role(auth.uid(), 'admin'))
  WITH CHECK (has_role(auth.uid(), 'recruiter') OR has_role(auth.uid(), 'admin'));
CREATE TRIGGER job_descriptions_touch BEFORE UPDATE ON public.job_descriptions FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

CREATE TABLE public.personas (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid,
  created_by uuid NOT NULL,
  name text NOT NULL,
  persona_type text NOT NULL DEFAULT 'technical',
  tone text,
  difficulty text,
  prompt text,
  config jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.personas TO authenticated;
GRANT ALL ON public.personas TO service_role;
ALTER TABLE public.personas ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Recruiters manage personas" ON public.personas FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'recruiter') OR has_role(auth.uid(), 'admin'))
  WITH CHECK (has_role(auth.uid(), 'recruiter') OR has_role(auth.uid(), 'admin'));
CREATE TRIGGER personas_touch BEFORE UPDATE ON public.personas FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

CREATE TABLE public.candidates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid,
  user_id uuid, -- optional link to auth.users
  created_by uuid NOT NULL,
  full_name text NOT NULL,
  email text NOT NULL,
  phone text,
  role_applied text,
  status text NOT NULL DEFAULT 'new',
  ai_score numeric,
  resume_url text,
  resume_summary text,
  skills text[],
  experience_years numeric,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.candidates TO authenticated;
GRANT ALL ON public.candidates TO service_role;
ALTER TABLE public.candidates ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Recruiters manage candidates" ON public.candidates FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'recruiter') OR has_role(auth.uid(), 'admin'))
  WITH CHECK (has_role(auth.uid(), 'recruiter') OR has_role(auth.uid(), 'admin'));
CREATE POLICY "Candidates view own record" ON public.candidates FOR SELECT TO authenticated
  USING (auth.uid() = user_id);
CREATE TRIGGER candidates_touch BEFORE UPDATE ON public.candidates FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

CREATE TABLE public.interviews (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid,
  created_by uuid NOT NULL,
  candidate_id uuid NOT NULL REFERENCES public.candidates(id) ON DELETE CASCADE,
  job_id uuid REFERENCES public.job_descriptions(id) ON DELETE SET NULL,
  persona_id uuid REFERENCES public.personas(id) ON DELETE SET NULL,
  scheduled_at timestamptz,
  duration_minutes integer DEFAULT 45,
  status text NOT NULL DEFAULT 'scheduled',
  transcript jsonb NOT NULL DEFAULT '[]'::jsonb,
  evaluation jsonb NOT NULL DEFAULT '{}'::jsonb,
  overall_score numeric,
  recommendation text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.interviews TO authenticated;
GRANT ALL ON public.interviews TO service_role;
ALTER TABLE public.interviews ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Recruiters manage interviews" ON public.interviews FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'recruiter') OR has_role(auth.uid(), 'admin'))
  WITH CHECK (has_role(auth.uid(), 'recruiter') OR has_role(auth.uid(), 'admin'));
CREATE POLICY "Candidates view own interviews" ON public.interviews FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.candidates c WHERE c.id = candidate_id AND c.user_id = auth.uid()));
CREATE TRIGGER interviews_touch BEFORE UPDATE ON public.interviews FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
