-- Run manually in the Supabase SQL editor (DEV/QA project only, never production).
-- Replace each <...> placeholder with the password for that account (see docs/CREDENTIALS.md).
-- Verified 2026-10-20: these 3 accounts exist in project evsp... but their documented passwords are rejected.
UPDATE auth.users
SET encrypted_password = crypt('<superadmin password>', gen_salt('bf')), updated_at = now()
WHERE email = 'superadmin@lokality.ai';

UPDATE auth.users
SET encrypted_password = crypt('<orgadmin password>', gen_salt('bf')), updated_at = now()
WHERE email = 'orgadmin@acme.com';

UPDATE auth.users
SET encrypted_password = crypt('<recruiter password>', gen_salt('bf')), updated_at = now()
WHERE email = 'recruitersatya@logikality.demo';

-- aisha.k@example.com and m.chen@example.com do not exist in that project; create them from the
-- dashboard (Authentication > Users), or enable the demo seed on a dev DB:
--   ALTER DATABASE postgres SET app.seed_demo = 'on';  -- then re-run the 20260702 seed section
