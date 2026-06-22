
REVOKE EXECUTE ON FUNCTION public.has_role(uuid, public.app_role)              FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.has_role_in_org(uuid, uuid, public.app_role) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.current_user_org_ids()                       FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.current_user_org_id()                        FROM PUBLIC, anon;

GRANT EXECUTE ON FUNCTION public.has_role(uuid, public.app_role)               TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.has_role_in_org(uuid, uuid, public.app_role)  TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.current_user_org_ids()                        TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.current_user_org_id()                         TO authenticated, service_role;
