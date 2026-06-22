import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";
import { CardShadow, Icon } from "@/components/recruiter/RecruiterShell";
import { useServerFn } from "@tanstack/react-start";
import { upsertJob, suggestJobDescription } from "@/lib/jobs.functions";

export const Route = createFileRoute("/_authenticated/recruiter/jobs/new")({
  component: NewJob,
});

function NewJob() {
  const navigate = useNavigate();
  const createJobFn = useServerFn(upsertJob);
  const suggest = useServerFn(suggestJobDescription);

  const [form, setForm] = useState({ title: "", department: "", location: "", employment_type: "Full-time", description: "", requirements: "" });
  const [saving, setSaving] = useState(false);
  const [generating, setGenerating] = useState(false);
  const set = <K extends keyof typeof form>(k: K, v: string) => setForm((f) => ({ ...f, [k]: v }));

  const save = async (status: "draft" | "open") => {
    if (!form.title) return toast.error("Title is required");
    setSaving(true);
    try {
      await createJobFn({
        data: {
          title: form.title,
          department: form.department || null,
          location: form.location || null,
          employmentType: form.employment_type || null,
          description: form.description || null,
          requirements: form.requirements || null,
          status,
        }
      });
      toast.success(status === "draft" ? "Saved as draft" : "Published");
      navigate({ to: "/recruiter/jobs" });
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to save job description");
    } finally {
      setSaving(false);
    }
  };

  const handleSuggest = async () => {
    if (!form.title) return toast.error("Please enter a job title first");
    setGenerating(true);
    try {
      const res = await suggest({ data: { title: form.title, department: form.department } });
      set("description", res.description);
      set("requirements", res.requirements);
      toast.success("AI suggested description and requirements!");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to generate suggestions");
    } finally {
      setGenerating(false);
    }
  };

  return (
    <>
      <Link to="/recruiter/jobs" className="text-primary text-body-md hover:underline mb-md inline-flex items-center gap-1"><Icon name="arrow_back" />Back to JDs</Link>
      <div className="mb-lg">
        <h2 className="text-headline-lg">New Job Description</h2>
        <p className="text-body-lg text-on-surface-variant">Define the role; your AI persona will calibrate to these requirements.</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-lg">
        <CardShadow className="lg:col-span-2 p-lg space-y-md">
          <Field label="Title"><input value={form.title} onChange={(e) => set("title", e.target.value)} className="input" placeholder="Senior Software Engineer" /></Field>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-md">
            <Field label="Department"><input value={form.department} onChange={(e) => set("department", e.target.value)} className="input" placeholder="Engineering" /></Field>
            <Field label="Location"><input value={form.location} onChange={(e) => set("location", e.target.value)} className="input" placeholder="Remote / NYC" /></Field>
            <Field label="Employment Type">
              <select value={form.employment_type} onChange={(e) => set("employment_type", e.target.value)} className="input">
                <option>Full-time</option><option>Part-time</option><option>Contract</option><option>Intern</option>
              </select>
            </Field>
          </div>
          <Field label="Description"><textarea rows={6} value={form.description} onChange={(e) => set("description", e.target.value)} className="input" placeholder="What the candidate will own…" /></Field>
          <Field label="Requirements"><textarea rows={6} value={form.requirements} onChange={(e) => set("requirements", e.target.value)} className="input" placeholder="Must-have skills, experience, qualifications…" /></Field>
          <div className="flex gap-sm pt-md">
            <button type="button" disabled={saving} onClick={() => save("draft")} className="px-4 py-2 border border-outline-variant rounded-lg hover:bg-surface-container-low disabled:opacity-50">Save Draft</button>
            <button type="button" disabled={saving} onClick={() => save("open")} className="px-4 py-2 bg-primary text-on-primary rounded-lg hover:brightness-110 disabled:opacity-50">Publish</button>
          </div>
        </CardShadow>

        <CardShadow className="p-lg ai-insight space-y-md h-fit">
          <h3 className="text-headline-sm flex items-center gap-2"><Icon name="auto_awesome" className="text-secondary" />AI Assist</h3>
          <p className="text-body-md">Once you publish, your selected AI persona will generate a tailored question set and rubric for this role.</p>
          <button
            type="button"
            disabled={generating}
            onClick={handleSuggest}
            className="w-full px-3 py-2 bg-primary text-on-primary rounded-lg flex items-center justify-center gap-2 hover:brightness-110 disabled:opacity-50 cursor-pointer"
          >
            <Icon name="auto_fix_high" />
            {generating ? "Generating..." : "Suggest description from title"}
          </button>
        </CardShadow>
      </div>

      <style>{`.input { width:100%; padding:0.5rem 0.75rem; background: var(--surface); border:1px solid var(--outline-variant); border-radius:0.5rem; outline:none; }
        .input:focus { box-shadow: 0 0 0 2px var(--primary-container); }`}</style>
    </>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="text-label-caps uppercase text-on-surface-variant block mb-1">{label}</span>
      {children}
    </label>
  );
}
