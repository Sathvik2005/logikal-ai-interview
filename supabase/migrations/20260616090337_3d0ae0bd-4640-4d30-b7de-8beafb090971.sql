
-- 1) Pin persona version per interview (additive, nullable)
ALTER TABLE public.interviews
  ADD COLUMN IF NOT EXISTS persona_version_id uuid REFERENCES public.persona_versions(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_interviews_persona_version_id ON public.interviews(persona_version_id);

-- 2) New per-interview curated question list
CREATE TABLE IF NOT EXISTS public.interview_questions (
  interview_id uuid NOT NULL REFERENCES public.interviews(id) ON DELETE CASCADE,
  question_id  uuid NOT NULL REFERENCES public.questions(id)  ON DELETE CASCADE,
  ordering     integer NOT NULL DEFAULT 0,
  source       text NOT NULL DEFAULT 'persona',
  created_at   timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (interview_id, question_id)
);

CREATE INDEX IF NOT EXISTS idx_interview_questions_interview ON public.interview_questions(interview_id, ordering);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.interview_questions TO authenticated;
GRANT ALL ON public.interview_questions TO service_role;

ALTER TABLE public.interview_questions ENABLE ROW LEVEL SECURITY;

-- Recruiters in the org owning the interview can manage rows.
CREATE POLICY "interview_questions org members read"
  ON public.interview_questions FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.interviews i
      WHERE i.id = interview_questions.interview_id
        AND (
          i.org_id IN (SELECT public.current_user_org_ids())
          OR EXISTS (
            SELECT 1 FROM public.candidates c
            WHERE c.id = i.candidate_id AND c.user_id = auth.uid()
          )
        )
    )
  );

CREATE POLICY "interview_questions org members write"
  ON public.interview_questions FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.interviews i
      WHERE i.id = interview_questions.interview_id
        AND i.org_id IN (SELECT public.current_user_org_ids())
    )
  );

CREATE POLICY "interview_questions org members update"
  ON public.interview_questions FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.interviews i
      WHERE i.id = interview_questions.interview_id
        AND i.org_id IN (SELECT public.current_user_org_ids())
    )
  );

CREATE POLICY "interview_questions org members delete"
  ON public.interview_questions FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.interviews i
      WHERE i.id = interview_questions.interview_id
        AND i.org_id IN (SELECT public.current_user_org_ids())
    )
  );
