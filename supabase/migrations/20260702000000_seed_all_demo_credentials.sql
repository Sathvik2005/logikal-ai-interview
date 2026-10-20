-- Seed admin, recruiter, and candidate demo users
DO $$
DECLARE
  v_admin_id UUID;
  v_recruiter_id UUID;
  v_candidate_id UUID;
  v_org_admin_id UUID;
  v_org_id UUID;
  v_acme_org_id UUID;
BEGIN
  -- Demo data guard: only seed when explicitly enabled (dev/QA). Never in production.
  -- Enable with: ALTER DATABASE postgres SET app.seed_demo = 'on';
  IF current_setting('app.seed_demo', true) IS DISTINCT FROM 'on' THEN
    RAISE NOTICE 'Skipping demo seed (app.seed_demo is not on).';
    RETURN;
  END IF;
  -- Ensure Demo Org exists
  SELECT id INTO v_org_id FROM public.organizations WHERE name='Logikality Demo Org' LIMIT 1;
  IF v_org_id IS NULL THEN
    INSERT INTO public.organizations (name, industry, size, status)
    VALUES ('Logikality Demo Org', 'Technology', '11-50', 'active')
    RETURNING id INTO v_org_id;
  END IF;

  -- Ensure Acme Corp Org exists
  SELECT id INTO v_acme_org_id FROM public.organizations WHERE name='Acme Corp' LIMIT 1;
  IF v_acme_org_id IS NULL THEN
    INSERT INTO public.organizations (name, industry, size, status)
    VALUES ('Acme Corp', 'Technology', '51-200', 'active')
    RETURNING id INTO v_acme_org_id;
  END IF;

  -- 1. Create/Update Super Admin
  SELECT id INTO v_admin_id FROM auth.users WHERE email = 'superadmin@lokality.ai';
  IF v_admin_id IS NULL THEN
    v_admin_id := gen_random_uuid();
    INSERT INTO auth.users (
      id,
      instance_id,
      email,
      encrypted_password,
      email_confirmed_at,
      raw_app_meta_data,
      raw_user_meta_data,
      aud,
      role,
      created_at,
      updated_at
    ) VALUES (
      v_admin_id,
      '00000000-0000-0000-0000-000000000000',
      'superadmin@lokality.ai',
      crypt('SuperAdmin@2026!Active', gen_salt('bf')),
      now(),
      '{"provider": "email", "providers": ["email"]}'::jsonb,
      '{"full_name": "Super Admin", "role": "admin"}'::jsonb,
      'authenticated',
      'authenticated',
      now(),
      now()
    );
  ELSE
    UPDATE auth.users SET encrypted_password = crypt('SuperAdmin@2026!Active', gen_salt('bf')) WHERE id = v_admin_id;
  END IF;

  -- 2. Create/Update Recruiter (Satya)
  SELECT id INTO v_recruiter_id FROM auth.users WHERE email = 'recruitersatya@logikality.demo';
  IF v_recruiter_id IS NULL THEN
    v_recruiter_id := gen_random_uuid();
    INSERT INTO auth.users (
      id,
      instance_id,
      email,
      encrypted_password,
      email_confirmed_at,
      raw_app_meta_data,
      raw_user_meta_data,
      aud,
      role,
      created_at,
      updated_at
    ) VALUES (
      v_recruiter_id,
      '00000000-0000-0000-0000-000000000000',
      'recruitersatya@logikality.demo',
      crypt('Recruiter@2026!Active', gen_salt('bf')),
      now(),
      '{"provider": "email", "providers": ["email"]}'::jsonb,
      '{"full_name": "Satya Recruiter", "role": "recruiter"}'::jsonb,
      'authenticated',
      'authenticated',
      now(),
      now()
    );
  ELSE
    UPDATE auth.users SET encrypted_password = crypt('Recruiter@2026!Active', gen_salt('bf')) WHERE id = v_recruiter_id;
  END IF;

  -- Update profiles/roles for Satya Recruiter
  UPDATE public.profiles
  SET org_id = v_org_id, full_name = 'Satya Recruiter'
  WHERE id = v_recruiter_id;

  DELETE FROM public.user_roles WHERE user_id = v_recruiter_id AND role <> 'recruiter';
  IF NOT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = v_recruiter_id AND role = 'recruiter') THEN
    INSERT INTO public.user_roles (user_id, role, org_id) VALUES (v_recruiter_id, 'recruiter', v_org_id);
  END IF;

  -- 3. Create/Update Org Admin (Acme Admin)
  SELECT id INTO v_org_admin_id FROM auth.users WHERE email = 'orgadmin@acme.com';
  IF v_org_admin_id IS NULL THEN
    v_org_admin_id := gen_random_uuid();
    INSERT INTO auth.users (
      id,
      instance_id,
      email,
      encrypted_password,
      email_confirmed_at,
      raw_app_meta_data,
      raw_user_meta_data,
      aud,
      role,
      created_at,
      updated_at
    ) VALUES (
      v_org_admin_id,
      '00000000-0000-0000-0000-000000000000',
      'orgadmin@acme.com',
      crypt('OrgAdmin@2026!Active', gen_salt('bf')),
      now(),
      '{"provider": "email", "providers": ["email"]}'::jsonb,
      '{"full_name": "Acme Org Admin", "role": "admin"}'::jsonb,
      'authenticated',
      'authenticated',
      now(),
      now()
    );
  ELSE
    UPDATE auth.users SET encrypted_password = crypt('OrgAdmin@2026!Active', gen_salt('bf')) WHERE id = v_org_admin_id;
  END IF;

  -- Profile and role for Org Admin
  INSERT INTO public.profiles (id, email, full_name, org_id)
  VALUES (v_org_admin_id, 'orgadmin@acme.com', 'Acme Org Admin', v_acme_org_id)
  ON CONFLICT (id) DO UPDATE SET org_id = EXCLUDED.org_id, full_name = EXCLUDED.full_name;

  DELETE FROM public.user_roles WHERE user_id = v_org_admin_id AND role <> 'admin';
  IF NOT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = v_org_admin_id AND role = 'admin') THEN
    INSERT INTO public.user_roles (user_id, role, org_id) VALUES (v_org_admin_id, 'admin', v_acme_org_id);
  END IF;

  -- 4. Create/Update Candidate (Sarah Jenkins)
  SELECT id INTO v_candidate_id FROM auth.users WHERE email = 'sarah.j@example.com';
  IF v_candidate_id IS NULL THEN
    v_candidate_id := gen_random_uuid();
    INSERT INTO auth.users (
      id,
      instance_id,
      email,
      encrypted_password,
      email_confirmed_at,
      raw_app_meta_data,
      raw_user_meta_data,
      aud,
      role,
      created_at,
      updated_at
    ) VALUES (
      v_candidate_id,
      '00000000-0000-0000-0000-000000000000',
      'sarah.j@example.com',
      crypt('Candidate@2026!Active', gen_salt('bf')),
      now(),
      '{"provider": "email", "providers": ["email"]}'::jsonb,
      '{"full_name": "Sarah Jenkins", "role": "candidate"}'::jsonb,
      'authenticated',
      'authenticated',
      now(),
      now()
    );
  ELSE
    UPDATE auth.users SET encrypted_password = crypt('Candidate@2026!Active', gen_salt('bf')) WHERE id = v_candidate_id;
  END IF;

END $$;
