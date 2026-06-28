CREATE TABLE public.workspace_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid UNIQUE REFERENCES public.organizations(id) ON DELETE CASCADE,
  org_name text NOT NULL DEFAULT 'Logikality AI',
  logo_url text,
  primary_color text DEFAULT '#3b82f6',
  require_mfa boolean NOT NULL DEFAULT false,
  allowed_domains text[] NOT NULL DEFAULT '{}',
  retention_months int NOT NULL DEFAULT 12,
  updated_by uuid,
  updated_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.workspace_settings TO authenticated;
GRANT ALL ON public.workspace_settings TO service_role;

ALTER TABLE public.workspace_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated can view workspace settings"
  ON public.workspace_settings FOR SELECT TO authenticated USING (true);

CREATE POLICY "Admins manage workspace settings INSERT"
  ON public.workspace_settings FOR INSERT TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins manage workspace settings UPDATE"
  ON public.workspace_settings FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins manage workspace settings DELETE"
  ON public.workspace_settings FOR DELETE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

CREATE TRIGGER workspace_settings_touch_updated_at
  BEFORE UPDATE ON public.workspace_settings
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

INSERT INTO public.workspace_settings (org_name) VALUES ('Logikality AI');