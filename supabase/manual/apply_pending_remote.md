# Applying pending schema to the remote Supabase project (checked 2026-10-20)

State of project `evsp...` (read-only check):
- `candidate_status` already has all 13 workflow values; `candidates.job_id/custom_role/resume_analysis`,
  `organizations.updated_at`, `candidate_timeline`, `interview_templates`, `question_banks`, `prompt_library` all exist.
  So migrations 20260704 and 20260705 are effectively applied already.
- NOT applied: row-level security and the `touch_updated_at` trigger on `prompt_library` (RLS is currently OFF).
- The remote migration history table is EMPTY (schema was created outside `supabase db push`).
  Do **not** run `supabase db push` as-is: it would re-run all 31 migrations on a live schema.

## 1. Close the RLS gap (SQL editor; idempotent)
Run `supabase/migrations/20260705000000_add_prompt_library.sql`.

## 2. Record history so future pushes only apply new migrations
```bash
npx supabase migration repair --status applied \
  20260605052635 20260605052659 20260605053308 20260605091721 20260605092825 20260605094015 \
  20260605100457 20260606034600 20260608081950 20260615083124 20260615083247 20260615083455 \
  20260615084344 20260615084414 20260615085001 20260615085404 20260615085425 20260615085719 \
  20260615095949 20260615101738 20260616053127 20260616054443 20260616054557 20260616055917 \
  20260616090337 20260619025645 20260620000000 20260621000000 20260702000000 20260704000000 \
  20260705000000 --db-url "<DIRECT_URL>"
npx supabase migration list --db-url "<DIRECT_URL>"   # local and remote columns should match
```
