
CREATE SCHEMA IF NOT EXISTS extensions;
GRANT USAGE ON SCHEMA extensions TO authenticated, service_role;
ALTER EXTENSION btree_gist SET SCHEMA extensions;

CREATE OR REPLACE FUNCTION public.interview_window(_start timestamptz, _mins integer)
RETURNS tstzrange
LANGUAGE sql
IMMUTABLE
SET search_path = public
AS $$
  SELECT tstzrange(_start, _start + (COALESCE(_mins, 45) || ' minutes')::interval, '[)')
$$;
