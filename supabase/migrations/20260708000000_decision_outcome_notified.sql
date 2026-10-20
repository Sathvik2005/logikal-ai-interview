-- Track when (and by whom) the candidate was told the outcome of a hiring decision.
-- The outcome email is always a deliberate human action, sent at most once per decision.

ALTER TABLE public.candidate_decisions
  ADD COLUMN IF NOT EXISTS outcome_notified_at timestamptz,
  ADD COLUMN IF NOT EXISTS outcome_notified_by text;
