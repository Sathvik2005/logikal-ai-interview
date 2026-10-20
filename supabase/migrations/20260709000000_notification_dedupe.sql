-- Idempotent notifications: a retried job must never email the same person twice for the same event.
-- dedupe_key is derived from (kind, recipient, the event id) by the backend; NULL means "no dedupe".

ALTER TABLE public.notification_outbox
  ADD COLUMN IF NOT EXISTS dedupe_key text;

CREATE UNIQUE INDEX IF NOT EXISTS notification_outbox_dedupe_key_uidx
  ON public.notification_outbox (dedupe_key)
  WHERE dedupe_key IS NOT NULL;
