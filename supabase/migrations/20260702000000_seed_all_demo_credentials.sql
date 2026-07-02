-- Seed admin, recruiter, and candidate demo users
DO $$
DECLARE
  v_admin_id UUID := gen_random_uuid();
  v_recruiter_id UUID := gen_random_uuid();
  v_candidate_id UUID := gen_random_uuid();
  v_org_id UUID;
BEGIN
  -- Ensure Demo Org exists
  SELECT id INTO v_org_id FROM public.organizations WHERE name='Logikality Demo Org' LIMIT 1;
  IF v_org_id IS NULL THEN
    INSERT INTO public.organizations (name, industry, size, status)
    VALUES ('Logikality Demo Org', 'Technology', '11-50', 'active')
    RETURNING id INTO v_org_id;
  END IF;

  -- 1. Create Super Admin if not exists
  IF NOT EXISTS (SELECT 1 FROM auth.users WHERE email = 'superadmin@lokality.ai') THEN
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
      crypt('SuperAdmin@2026', gen_salt('bf')),
      now(),
      '{"provider": "email", "providers": ["email"]}'::jsonb,
      '{"full_name": "Super Admin", "role": "admin"}'::jsonb,
      'authenticated',
      'authenticated',
      now(),
      now()
    );
  END IF;

  -- 2. Create Recruiter (Satya) if not exists
  IF NOT EXISTS (SELECT 1 FROM auth.users WHERE email = 'recruitersatya@logikality.demo') THEN
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
      crypt('Recruiter@2026', gen_salt('bf')),
      now(),
      '{"provider": "email", "providers": ["email"]}'::jsonb,
      '{"full_name": "Satya Recruiter", "role": "recruiter"}'::jsonb,
      'authenticated',
      'authenticated',
      now(),
      now()
    );
  ELSE
    SELECT id INTO v_recruiter_id FROM auth.users WHERE email = 'recruitersatya@logikality.demo';
  END IF;

  -- Update profiles/roles for Satya Recruiter
  UPDATE public.profiles
  SET org_id = v_org_id, full_name = 'Satya Recruiter'
  WHERE id = v_recruiter_id;

  DELETE FROM public.user_roles WHERE user_id = v_recruiter_id AND role <> 'recruiter';
  INSERT INTO public.user_roles (user_id, role)
  VALUES (v_recruiter_id, 'recruiter')
  ON CONFLICT (user_id, role) DO NOTHING;

  -- 3. Create Candidate (Sarah Jenkins) if not exists
  IF NOT EXISTS (SELECT 1 FROM auth.users WHERE email = 'sarah.j@example.com') THEN
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
      crypt('Candidate@2026', gen_salt('bf')),
      now(),
      '{"provider": "email", "providers": ["email"]}'::jsonb,
      '{"full_name": "Sarah Jenkins", "role": "candidate"}'::jsonb,
      'authenticated',
      'authenticated',
      now(),
      now()
    );
  END IF;

END $$;
