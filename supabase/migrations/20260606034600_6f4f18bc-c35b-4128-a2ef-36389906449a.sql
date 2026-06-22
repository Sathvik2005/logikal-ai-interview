
DO $$
DECLARE
  v_user_id uuid;
  v_org_id uuid;
BEGIN
  SELECT id INTO v_user_id FROM auth.users WHERE email='recruitersatya@logikality.demo';
  IF v_user_id IS NULL THEN RAISE EXCEPTION 'user not found'; END IF;

  SELECT id INTO v_org_id FROM public.organizations WHERE name='Logikality Demo Org' LIMIT 1;
  IF v_org_id IS NULL THEN
    INSERT INTO public.organizations (name, industry, size, status)
    VALUES ('Logikality Demo Org', 'Technology', '11-50', 'active')
    RETURNING id INTO v_org_id;
  END IF;

  UPDATE auth.users
  SET encrypted_password = crypt('Recruiter@2026', gen_salt('bf')),
      email_confirmed_at = COALESCE(email_confirmed_at, now()),
      updated_at = now()
  WHERE id = v_user_id;

  INSERT INTO public.profiles (id, email, full_name, org_id)
  VALUES (v_user_id, 'recruitersatya@logikality.demo', 'Satya Recruiter', v_org_id)
  ON CONFLICT (id) DO UPDATE SET org_id = EXCLUDED.org_id, full_name = EXCLUDED.full_name, email = EXCLUDED.email;

  DELETE FROM public.user_roles WHERE user_id = v_user_id AND role <> 'recruiter';
  INSERT INTO public.user_roles (user_id, role)
  VALUES (v_user_id, 'recruiter')
  ON CONFLICT (user_id, role) DO NOTHING;
END $$;
