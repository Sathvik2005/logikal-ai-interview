
-- Add evaluation_status + integrity_score to interviews
ALTER TABLE public.interviews
  ADD COLUMN IF NOT EXISTS evaluation_status text NOT NULL DEFAULT 'pending',
  ADD COLUMN IF NOT EXISTS integrity_score numeric;

-- interview_sessions
CREATE TABLE IF NOT EXISTS public.interview_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  interview_id uuid NOT NULL REFERENCES public.interviews(id) ON DELETE CASCADE,
  org_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  started_at timestamptz NOT NULL DEFAULT now(),
  ended_at timestamptz,
  device_info jsonb NOT NULL DEFAULT '{}'::jsonb,
  network_quality jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.interview_sessions TO authenticated;
GRANT ALL ON public.interview_sessions TO service_role;
ALTER TABLE public.interview_sessions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Org members read interview_sessions" ON public.interview_sessions
  FOR SELECT TO authenticated
  USING (org_id IN (SELECT public.current_user_org_ids()));
CREATE POLICY "Candidates read own interview_sessions" ON public.interview_sessions
  FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.interviews i
    JOIN public.candidates c ON c.id = i.candidate_id
    WHERE i.id = interview_sessions.interview_id AND c.user_id = auth.uid()
  ));
CREATE INDEX IF NOT EXISTS interview_sessions_interview_idx ON public.interview_sessions (interview_id);

-- interview_events (append-only integrity stream)
CREATE TABLE IF NOT EXISTS public.interview_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id uuid NOT NULL REFERENCES public.interview_sessions(id) ON DELETE CASCADE,
  type text NOT NULL,
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.interview_events TO authenticated;
GRANT ALL ON public.interview_events TO service_role;
ALTER TABLE public.interview_events ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Org members read interview_events" ON public.interview_events
  FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.interview_sessions s
    WHERE s.id = interview_events.session_id AND s.org_id IN (SELECT public.current_user_org_ids())
  ));
CREATE INDEX IF NOT EXISTS interview_events_session_idx ON public.interview_events (session_id, at);
CREATE INDEX IF NOT EXISTS interview_events_type_idx ON public.interview_events (session_id, type);

-- interview_turns (append-only transcript)
CREATE TABLE IF NOT EXISTS public.interview_turns (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id uuid NOT NULL REFERENCES public.interview_sessions(id) ON DELETE CASCADE,
  speaker text NOT NULL,            -- 'candidate' | 'persona' | 'system'
  text text NOT NULL,
  audio_path text,                   -- key inside `recordings` bucket
  started_at timestamptz NOT NULL,
  ended_at timestamptz,
  turn_score jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.interview_turns TO authenticated;
GRANT ALL ON public.interview_turns TO service_role;
ALTER TABLE public.interview_turns ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Org members read interview_turns" ON public.interview_turns
  FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.interview_sessions s
    WHERE s.id = interview_turns.session_id AND s.org_id IN (SELECT public.current_user_org_ids())
  ));
CREATE POLICY "Candidates read own interview_turns" ON public.interview_turns
  FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.interview_sessions s
    JOIN public.interviews i ON i.id = s.interview_id
    JOIN public.candidates c ON c.id = i.candidate_id
    WHERE s.id = interview_turns.session_id AND c.user_id = auth.uid()
  ));
CREATE INDEX IF NOT EXISTS interview_turns_session_idx ON public.interview_turns (session_id, started_at);

-- ai_jobs queue
CREATE TABLE IF NOT EXISTS public.ai_jobs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  kind text NOT NULL,                -- 'transcribe' | 'score_turn' | 'finalize_evaluation'
  entity_type text NOT NULL,         -- 'interview' | 'turn' | 'session'
  entity_id uuid NOT NULL,
  status text NOT NULL DEFAULT 'pending',  -- 'pending' | 'running' | 'done' | 'failed' | 'dlq'
  attempts integer NOT NULL DEFAULT 0,
  last_error text,
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  run_after timestamptz NOT NULL DEFAULT now(),
  started_at timestamptz,
  completed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.ai_jobs TO authenticated;
GRANT ALL ON public.ai_jobs TO service_role;
ALTER TABLE public.ai_jobs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Org members read ai_jobs" ON public.ai_jobs
  FOR SELECT TO authenticated
  USING (org_id IN (SELECT public.current_user_org_ids()));
CREATE INDEX IF NOT EXISTS ai_jobs_status_idx ON public.ai_jobs (status, run_after);
CREATE INDEX IF NOT EXISTS ai_jobs_entity_idx ON public.ai_jobs (entity_type, entity_id);
CREATE TRIGGER ai_jobs_touch BEFORE UPDATE ON public.ai_jobs FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
