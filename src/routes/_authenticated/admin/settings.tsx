import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Card, Icon } from "@/components/admin/AdminShell";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/_authenticated/admin/settings")({
  component: SettingsPage,
});

type Settings = {
  id: string;
  org_name: string;
  logo_url: string | null;
  primary_color: string | null;
  require_mfa: boolean;
  allowed_domains: string[];
  retention_months: number;
};

function SettingsPage() {
  const [settings, setSettings] = useState<Settings | null>(null);
  const [saving, setSaving] = useState(false);
  const [savedAt, setSavedAt] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      const { data, error } = await supabase.from("workspace_settings").select("*").limit(1).maybeSingle();
      if (error) setError(error.message);
      else if (data) setSettings(data as Settings);
    })();
  }, []);

  const save = async () => {
    if (!settings) return;
    setSaving(true);
    setError(null);
    const { error } = await supabase
      .from("workspace_settings")
      .update({
        org_name: settings.org_name,
        logo_url: settings.logo_url,
        primary_color: settings.primary_color,
        require_mfa: settings.require_mfa,
        allowed_domains: settings.allowed_domains,
        retention_months: settings.retention_months,
      })
      .eq("id", settings.id);
    setSaving(false);
    if (error) setError(error.message);
    else setSavedAt(new Date().toLocaleTimeString());
  };

  if (!settings) return <div className="p-lg text-on-surface-variant">Loading workspace settings…</div>;

  const update = <K extends keyof Settings>(k: K, v: Settings[K]) => setSettings((s) => (s ? { ...s, [k]: v } : s));

  return (
    <div className="space-y-lg max-w-3xl">
      <header>
        <h1 className="text-headline-lg font-headline-lg text-on-surface">Workspace Settings</h1>
        <p className="text-body-lg text-on-surface-variant">Branding, authentication policy and data retention.</p>
      </header>

      <Card className="p-lg space-y-md">
        <h3 className="text-headline-sm font-headline-sm text-on-surface">Branding</h3>
        <Field label="Organization name" value={settings.org_name} onChange={(v) => update("org_name", v)} />
        <Field label="Logo URL" value={settings.logo_url ?? ""} onChange={(v) => update("logo_url", v)} placeholder="https://…/logo.svg" />
        <div>
          <label className="text-body-md text-on-surface-variant">Primary color</label>
          <div className="mt-1 flex items-center gap-2">
            <input
              type="color"
              value={settings.primary_color ?? "#3b82f6"}
              onChange={(e) => update("primary_color", e.target.value)}
              className="w-12 h-10 rounded-lg border border-outline-variant bg-transparent"
            />
            <input
              value={settings.primary_color ?? ""}
              onChange={(e) => update("primary_color", e.target.value)}
              className="flex-1 px-3 py-2 bg-surface border border-outline-variant rounded-lg outline-none focus:ring-2 focus:ring-primary-container text-body-md"
            />
          </div>
        </div>
      </Card>

      <Card className="p-lg space-y-md">
        <h3 className="text-headline-sm font-headline-sm text-on-surface">Authentication policy</h3>
        <label className="flex items-center justify-between p-3 rounded-lg bg-surface-container-low">
          <div>
            <p className="text-body-md text-on-surface font-semibold">Require MFA</p>
            <p className="text-body-md text-on-surface-variant">Enforce two-factor for every workspace member.</p>
          </div>
          <input type="checkbox" className="accent-primary w-5 h-5" checked={settings.require_mfa} onChange={(e) => update("require_mfa", e.target.checked)} />
        </label>
        <Field
          label="Allowed email domains (comma-separated)"
          value={settings.allowed_domains.join(", ")}
          onChange={(v) => update("allowed_domains", v.split(",").map((d) => d.trim()).filter(Boolean))}
          placeholder="acme.com, globex.com"
        />
      </Card>

      <Card className="p-lg space-y-md">
        <h3 className="text-headline-sm font-headline-sm text-on-surface">Data retention</h3>
        <div>
          <label className="text-body-md text-on-surface-variant">Retain interview recordings for (months)</label>
          <input
            type="number"
            min={1}
            max={60}
            value={settings.retention_months}
            onChange={(e) => update("retention_months", parseInt(e.target.value || "12", 10))}
            className="mt-1 w-32 px-3 py-2 bg-surface border border-outline-variant rounded-lg outline-none focus:ring-2 focus:ring-primary-container text-body-md"
          />
        </div>
      </Card>

      {error && <p className="text-body-md text-error flex items-center gap-2"><Icon name="error" /> {error}</p>}

      <div className="flex items-center justify-end gap-3 sticky bottom-0 py-3 bg-background/80 backdrop-blur-md">
        {savedAt && <span className="text-body-md text-success flex items-center gap-1"><Icon name="check_circle" /> Saved at {savedAt}</span>}
        <button type="button" onClick={save} disabled={saving} className="px-4 py-2 rounded-lg bg-primary text-on-primary font-semibold text-body-md hover:brightness-110 disabled:opacity-50">
          {saving ? "Saving…" : "Save changes"}
        </button>
      </div>
    </div>
  );
}

function Field({ label, value, onChange, placeholder }: { label: string; value: string; onChange: (v: string) => void; placeholder?: string }) {
  return (
    <div>
      <label className="text-body-md text-on-surface-variant">{label}</label>
      <input
        value={value}
        placeholder={placeholder}
        onChange={(e) => onChange(e.target.value)}
        className="mt-1 w-full px-3 py-2 bg-surface border border-outline-variant rounded-lg outline-none focus:ring-2 focus:ring-primary-container text-body-md"
      />
    </div>
  );
}
