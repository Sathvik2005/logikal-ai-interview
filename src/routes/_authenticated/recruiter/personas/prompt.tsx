import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { z } from "zod";
import { CardShadow, Icon } from "@/components/recruiter/RecruiterShell";
import { usePersonasQuery, useUpsertPersona } from "@/components/recruiter/use-personas";

const searchSchema = z.object({
  id: z.string().uuid().optional(),
});

export const Route = createFileRoute("/_authenticated/recruiter/personas/prompt")({
  validateSearch: (s) => searchSchema.parse(s),
  component: PromptEditor,
});

const PRESETS = [
  {
    id: "t1",
    label: "Technical Deep-Dive",
    text: "You are a Principal Engineer. Probe system design tradeoffs. Push back on hand-wavy answers. Ask 'why' three times.",
  },
  {
    id: "t2",
    label: "Behavioral STAR",
    text: "You are a hiring manager. Use the STAR framework. Probe for situation, task, action, result. Look for leadership signals.",
  },
  {
    id: "t3",
    label: "Product Sense",
    text: "You are a Product Director. Ask candidate to design a product for an underserved user. Evaluate clarity of thinking and prioritization.",
  },
];

function PromptEditor() {
  const { id } = Route.useSearch();
  const navigate = useNavigate();
  const { data: personas } = usePersonasQuery();
  const upsert = useUpsertPersona();

  const existing = personas?.find((p) => p.id === id);
  const [name, setName] = useState("");
  const [prompt, setPrompt] = useState(PRESETS[0].text);

  useEffect(() => {
    if (existing) {
      setName(existing.name);
      if (existing.prompt) setPrompt(existing.prompt);
    }
  }, [existing]);

  const handleSave = async () => {
    if (name.trim().length < 2) {
      toast.error("Persona name is required (min 2 characters).");
      return;
    }
    try {
      await upsert.mutateAsync({ id, name: name.trim(), prompt });
      toast.success(id ? "Prompt updated — new version snapshot saved" : "Persona created");
      navigate({ to: "/recruiter/personas" });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not save persona");
    }
  };

  return (
    <>
      <Link
        to="/recruiter/personas"
        className="text-primary text-body-md hover:underline mb-md inline-flex items-center gap-1"
      >
        <Icon name="arrow_back" />
        Back to personas
      </Link>
      <div className="mb-lg">
        <h2 className="text-headline-lg">Persona Prompt Editor</h2>
        <p className="text-body-lg text-on-surface-variant">
          Author the system prompt that drives the interviewer's behavior. Every save creates an
          immutable version snapshot used by future interviews.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-lg">
        <CardShadow className="p-lg lg:col-span-2 space-y-md">
          <div>
            <label className="text-label-caps uppercase text-on-surface-variant block mb-1">
              Persona name
            </label>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Senior Backend Interviewer"
              className="w-full px-3 py-2 border border-outline-variant rounded-lg bg-white outline-none focus:ring-2 focus:ring-primary-container"
            />
          </div>
          <div>
            <h3 className="text-headline-sm mb-sm">System Prompt</h3>
            <textarea
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              rows={16}
              className="w-full font-data-mono text-data-mono p-md bg-surface-container-low border border-outline-variant rounded-lg outline-none focus:ring-2 focus:ring-primary-container"
            />
          </div>
          <div className="flex justify-between items-center">
            <span className="text-label-caps uppercase text-on-surface-variant">
              {prompt.length} characters
            </span>
            <div className="flex gap-sm">
              <Link
                to="/recruiter/personas"
                className="px-4 py-2 border border-outline-variant rounded-lg hover:bg-surface-container-low"
              >
                Cancel
              </Link>
              <button
                type="button"
                onClick={handleSave}
                disabled={upsert.isPending}
                className="px-4 py-2 bg-primary text-on-primary rounded-lg hover:brightness-110 disabled:opacity-50 inline-flex items-center gap-2"
              >
                <Icon name="save" />
                {upsert.isPending ? "Saving…" : id ? "Save new version" : "Create persona"}
              </button>
            </div>
          </div>
        </CardShadow>

        <CardShadow className="p-lg">
          <h3 className="text-headline-sm mb-md">Presets</h3>
          <ul className="space-y-2">
            {PRESETS.map((p) => (
              <li key={p.id}>
                <button
                  type="button"
                  onClick={() => setPrompt(p.text)}
                  className="w-full text-left p-md rounded-lg border border-outline-variant hover:bg-surface-container-low transition"
                >
                  <p className="font-semibold">{p.label}</p>
                  <p className="text-body-md text-on-surface-variant line-clamp-2">{p.text}</p>
                </button>
              </li>
            ))}
          </ul>
        </CardShadow>
      </div>
    </>
  );
}
