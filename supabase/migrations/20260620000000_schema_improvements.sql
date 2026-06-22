-- Performance index optimizations for recruitment activity monitoring

CREATE INDEX IF NOT EXISTS idx_interview_events_session_id 
  ON public.interview_events(session_id);

CREATE INDEX IF NOT EXISTS idx_interview_turns_session_id 
  ON public.interview_turns(session_id);

CREATE INDEX IF NOT EXISTS idx_proctoring_snapshots_session_id 
  ON public.proctoring_snapshots(session_id);
