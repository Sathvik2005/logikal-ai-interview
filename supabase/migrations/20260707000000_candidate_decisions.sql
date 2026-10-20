-- =====================================================================
-- Human-in-the-loop hiring decisions.
-- Every final decision (hire / hold / reject) is made by a named person and recorded here with
-- the AI's recommendation at the time, so overrides are visible and auditable.
-- =====================================================================

CREATE TABLE IF NOT EXISTS public.candidate_decisions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  candidate_id uuid NOT NULL REFERENCES public.candidates(id) ON DELETE CASCADE,
  interview_id uuid REFERENCES public.interviews(id) ON DELETE SET NULL,
  decision text NOT NULL,
  note text,
  ai_recommendation text,
  ai_score numeric,
  overrode_ai boolean NOT NULL DEFAULT false,
  decided_by uuid NOT NULL,
  decided_by_email text,
  decided_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT candidate_decisions_decision_chk CHECK (decision IN ('hire', 'hold', 'reject'))
);

CREATE INDEX IF NOT EXISTS candidate_decisions_candidate_idx
  ON public.candidate_decisions (candidate_id, decided_at DESC);
CREATE INDEX IF NOT EXISTS candidate_decisions_org_idx
  ON public.candidate_decisions (org_id, decided_at DESC);

-- Backend-only table: RLS on with no policies, so only the service role / backend role can access it.
ALTER TABLE public.candidate_decisions ENABLE ROW LEVEL SECURITY;
