-- =====================================================================
-- Add prompt_library (used by the NestJS PromptLibraryService; was only
-- defined in the Prisma schema, never in Supabase migrations)
-- =====================================================================

CREATE TABLE IF NOT EXISTS public.prompt_library (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL UNIQUE,
  prompt_type text NOT NULL,
  prompt_text text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Backend-only table: RLS on with no policies, so only the service role can access it.
ALTER TABLE public.prompt_library ENABLE ROW LEVEL SECURITY;

DROP TRIGGER IF EXISTS prompt_library_touch ON public.prompt_library;
CREATE TRIGGER prompt_library_touch
  BEFORE UPDATE ON public.prompt_library
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
