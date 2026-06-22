import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";
import { CardShadow, Icon } from "@/components/recruiter/RecruiterShell";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/_authenticated/recruiter/personas/new")({
  component: NewPersona,
});

function NewPersona() {
  const navigate = useNavigate();
  const [form, setForm] = useState({ name: "", persona_type: "technical", tone: "Direct", difficulty: "Medium", prompt: "" });
  const [saving, setSaving] = useState(false);
  const set = <K extends keyof typeof form>(k: K, v: string) => setForm((f) => ({ ...f, [k]: v }));

  const save = async () => {
    if (!form.name) return toast.error("Name is required");
    setSaving(true);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { setSaving(false); return toast.error("Not signed in"); }
    const { error } = await supabase.from("personas").insert({ ...form, created_by: user.id });
    setSaving(false);
    if (error) return toast.error(error.message);
    toast.success("Persona created");
    navigate({ to: "/recruiter/personas" });
  };

  return (
    <>
      <Link to="/recruiter/personas" className="text-primary text-body-md hover:underline mb-md inline-flex items-center gap-1"><Icon name="arrow_back" />Back to personas</Link>
      <div className="mb-lg"><h2 className="text-headline-lg">New AI Persona</h2><p className="text-body-lg text-on-surface-variant">Configure how your AI interviewer behaves.</p></div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-lg">
        <CardShadow className="lg:col-span-2 p-lg space-y-md">
          <Field label="Name"><input value={form.name} onChange={(e) => set("name", e.target.value)} className="ip" placeholder="Principal Engineer" /></Field>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-md">
            <Field label="Type">
              <select value={form.persona_type} onChange={(e) => set("persona_type", e.target.value)} className="ip">
                <option value="technical">Technical</option><option value="behavioral">Behavioral</option><option value="product">Product</option><option value="leadership">Leadership</option>
              </select>
            </Field>
            <Field label="Tone">
              <select value={form.tone} onChange={(e) => set("tone", e.target.value)} className="ip">
                <option>Direct</option><option>Curious</option><option>Socratic</option><option>Empathetic</option><option>Challenging</option>
              </select>
            </Field>
            <Field label="Difficulty">
              <select value={form.difficulty} onChange={(e) => set("difficulty", e.target.value)} className="ip">
                <option>Easy</option><option>Medium</option><option>Hard</option>
              </select>
            </Field>
          </div>
          <Field label="System Prompt"><textarea rows={10} value={form.prompt} onChange={(e) => set("prompt", e.target.value)} className="ip font-data-mono" placeholder="You are a principal engineer at a top-tier tech company…" /></Field>
          <div className="flex gap-sm pt-md">
            <Link to="/recruiter/personas" className="px-4 py-2 border border-outline-variant rounded-lg hover:bg-surface-container-low">Cancel</Link>
            <button type="button" disabled={saving} onClick={save} className="px-4 py-2 bg-primary text-on-primary rounded-lg hover:brightness-110">Create persona</button>
          </div>
        </CardShadow>

        <CardShadow className="p-lg ai-insight h-fit">
          <h3 className="text-headline-sm flex items-center gap-2 mb-2"><Icon name="auto_awesome" className="text-secondary" />Preview</h3>
          <p className="text-body-md text-on-surface-variant">
            "Hi, I'm {form.name || "your interviewer"}. Today we'll spend ~45 minutes on {form.persona_type} questions at a {form.difficulty.toLowerCase()} difficulty level. My style is {form.tone.toLowerCase()}."
          </p>
        </CardShadow>
      </div>
      <style>{`.ip{width:100%;padding:.5rem .75rem;background:var(--surface);border:1px solid var(--outline-variant);border-radius:.5rem;outline:none}.ip:focus{box-shadow:0 0 0 2px var(--primary-container)}`}</style>
    </>
  );
}
function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (<label className="block"><span className="text-label-caps uppercase text-on-surface-variant block mb-1">{label}</span>{children}</label>);
}
