-- Self-service sign-up creates candidates only.
-- The requested role in user_metadata is editable by the signing-up user, so it is ignored.
-- Staff roles come from raw_app_meta_data, which only the service role (an admin inviting a user) can set;
-- admins are never created by this trigger, and a recruiter still needs an organization assigned by an admin.
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  chosen_role public.app_role := 'candidate';
BEGIN
  IF NEW.raw_app_meta_data->>'role' = 'recruiter' THEN
    chosen_role := 'recruiter';
  END IF;

  INSERT INTO public.profiles (id, full_name, email)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.email),
    NEW.email
  );

  INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, chosen_role);

  RETURN NEW;
END;
$function$;
