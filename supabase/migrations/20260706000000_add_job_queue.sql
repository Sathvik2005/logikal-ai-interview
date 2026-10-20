-- =====================================================================
-- Durable background job queue (replaces the in-memory queue).
-- Workers claim rows with FOR UPDATE SKIP LOCKED, so several backend
-- instances can run safely; jobs survive restarts and are retried.
-- =====================================================================

CREATE TABLE IF NOT EXISTS public.job_queue (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  task text NOT NULL,
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  status text NOT NULL DEFAULT 'pending',        -- pending | running | done | dead
  attempts integer NOT NULL DEFAULT 0,
  max_attempts integer NOT NULL DEFAULT 5,
  run_at timestamptz NOT NULL DEFAULT now(),
  locked_at timestamptz,
  locked_by text,
  last_error text,
  completed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT job_queue_status_chk CHECK (status IN ('pending', 'running', 'done', 'dead'))
);

CREATE INDEX IF NOT EXISTS job_queue_claim_idx
  ON public.job_queue (run_at, created_at) WHERE status = 'pending';
CREATE INDEX IF NOT EXISTS job_queue_running_idx
  ON public.job_queue (locked_at) WHERE status = 'running';

-- Backend-only table: RLS on with no policies, so only the service role / backend role can access it.
ALTER TABLE public.job_queue ENABLE ROW LEVEL SECURITY;
