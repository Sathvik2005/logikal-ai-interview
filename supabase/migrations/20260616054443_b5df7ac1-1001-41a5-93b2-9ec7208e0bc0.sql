CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net;

-- Idempotent: drop existing job by name before recreating
DO $$
BEGIN
  PERFORM cron.unschedule('interview-reminders-5min')
    WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'interview-reminders-5min');
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

SELECT cron.schedule(
  'interview-reminders-5min',
  '*/5 * * * *',
  $$
  SELECT net.http_post(
    url := 'https://project--27be9937-4871-4f5e-a820-84aca02a3bf0.lovable.app/api/public/cron/interview-reminders',
    headers := '{"Content-Type":"application/json","apikey":"eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imdpd3hkY2pxb3ltcXh1cHJqdWl4Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODA2MjQzOTIsImV4cCI6MjA5NjIwMDM5Mn0.pw3GrftHgtrlzX1uyhUYmimBNh-yjoukQGUJwnNTksI"}'::jsonb,
    body := '{}'::jsonb
  );
  $$
);