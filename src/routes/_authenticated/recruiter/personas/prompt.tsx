import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { z } from "zod";
import { CardShadow, Icon, PageHeader } from "@/components/recruiter/RecruiterShell";
import { usePersonasQuery, useUpsertPersona } from "@/components/recruiter/use-personas";
import { generatePersonaPrompt } from "@/lib/personas.functions";
import { useServerFn } from "@tanstack/react-start";

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

const inputCls =
  "w-full px-3 py-1.5 border border-outline-variant rounded-lg text-sm bg-white focus:ring-2 focus:ring-primary-container outline-none placeholder:text-outline";

function PromptEditor() {
  const { id } = Route.useSearch();
  const navigate = useNavigate();
  const { data: personas } = usePersonasQuery();
  const upsert = useUpsertPersona();
  const generatePromptFn = useServerFn(generatePersonaPrompt);

  const existing = personas?.find((p) => p.id === id);
  const [name, setName] = useState("");
  const [prompt, setPrompt] = useState(PRESETS[0].text);

  // Tabs for the right-hand panel
  const [rightTab, setRightTab] = useState<"ai" | "presets">("ai");

  // AI Generator Form Parameters
  const [role, setRole] = useState("Senior Software Engineer");
  const [domain, setDomain] = useState("Backend Development");
  const [style, setStyle] = useState("Inquisitive & Technical");
  const [strictness, setStrictness] = useState("Balanced");
  const [tone, setTone] = useState("Professional & Formal");
  const [difficulty, setDifficulty] = useState("Hard");
  const [responsibilities, setResponsibilities] = useState("Designing high-performance APIs, database schema normalization, and system design tradeoffs.");
  const [isGenerating, setIsGenerating] = useState(false);

  // Audio Voice Preview States
  const [isPlaying, setIsPlaying] = useState(false);

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

  const handleGenerate = async () => {
    if (name.trim().length < 2) {
      toast.error("Please enter a Persona Name first before generating a prompt.");
      return;
    }
    try {
      setIsGenerating(true);
      const generatedPrompt = await generatePromptFn({
        data: {
          name: name.trim(),
          role: role.trim(),
          domain: domain.trim(),
          style,
          strictness,
          tone,
          difficulty,
          responsibilities: responsibilities.trim(),
        }
      });
      setPrompt(generatedPrompt);
      toast.success("AI Prompt generated successfully!");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not generate prompt");
    } finally {
      setIsGenerating(false);
    }
  };

  const playVoicePreview = () => {
    setIsPlaying(true);
    // Simulate playing for 4 seconds
    setTimeout(() => {
      setIsPlaying(false);
    }, 4000);
  };

  return (
    <>
      <div className="mb-md">
        <Link
          to="/recruiter/personas"
          className="text-primary text-body-md hover:underline inline-flex items-center gap-1"
        >
          <Icon name="arrow_back" />
          Back to personas
        </Link>
      </div>
      <PageHeader
        title="Persona Prompt Editor"
        subtitle="Author the system prompt that drives the interviewer's behavior. Every save creates an immutable version snapshot used by future interviews."
      />

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-lg">
        {/* Left Column: Name & Prompt Text Area */}
        <CardShadow className="p-lg lg:col-span-2 space-y-md bg-white">
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
            <div className="flex justify-between items-center mb-sm">
              <h3 className="text-headline-sm">System Prompt</h3>
              {prompt && (
                <button
                  type="button"
                  onClick={playVoicePreview}
                  className="px-3 py-1 bg-secondary text-on-primary text-xs font-semibold rounded-full flex items-center gap-1.5 shadow-sm hover:brightness-110"
                >
                  <Icon name={isPlaying ? "stop" : "volume_up"} className="text-sm" />
                  {isPlaying ? "Voice preview active..." : "Preview Persona Voice"}
                </button>
              )}
            </div>

            {isPlaying && (
              <div className="mb-md p-md bg-secondary-fixed/30 border border-secondary/30 rounded-lg flex items-center justify-between animate-fade-in">
                <div className="flex items-center gap-2">
                  <span className="w-2.5 h-2.5 rounded-full bg-secondary animate-ping" />
                  <p className="text-xs text-on-secondary-fixed-variant">
                    Opening intro sample plays: "Welcome! I'm here to examine your architecture skills..."
                  </p>
                </div>
                {/* Micro voice waves */}
                <div className="flex items-end gap-0.5 h-6">
                  {[1, 2, 3, 4, 5, 6, 7, 8].map((bar) => (
                    <div
                      key={bar}
                      className="w-1 bg-secondary rounded-full animate-bounce"
                      style={{
                        height: `${Math.floor(Math.random() * 20) + 4}px`,
                        animationDelay: `${bar * 0.08}s`,
                      }}
                    />
                  ))}
                </div>
              </div>
            )}

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

        {/* Right Column: AI Generator & Presets Sidebar Tabs */}
        <CardShadow className="p-lg bg-white flex flex-col min-h-[480px]">
          <div className="flex border-b border-outline-variant gap-4 mb-4 shrink-0">
            <button
              type="button"
              onClick={() => setRightTab("ai")}
              className={`pb-2 text-sm font-semibold border-b-2 transition flex items-center gap-1.5 ${
                rightTab === "ai"
                  ? "border-primary text-primary"
                  : "border-transparent text-on-surface-variant hover:text-on-surface"
              }`}
            >
              <Icon name="auto_awesome" className="text-sm" />
              AI Generator
            </button>
            <button
              type="button"
              onClick={() => setRightTab("presets")}
              className={`pb-2 text-sm font-semibold border-b-2 transition flex items-center gap-1.5 ${
                rightTab === "presets"
                  ? "border-primary text-primary"
                  : "border-transparent text-on-surface-variant hover:text-on-surface"
              }`}
            >
              <Icon name="bookmarks" className="text-sm" />
              Presets
            </button>
          </div>

          {rightTab === "presets" ? (
            <ul className="space-y-2 overflow-y-auto flex-1">
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
          ) : (
            <div className="space-y-3 overflow-y-auto flex-1 pr-0.5">
              <label className="block">
                <span className="block text-[11px] font-semibold text-on-surface-variant mb-1 uppercase">Target Role</span>
                <input
                  className={inputCls}
                  value={role}
                  onChange={(e) => setRole(e.target.value)}
                  placeholder="e.g. Senior Frontend Engineer"
                />
              </label>

              <label className="block">
                <span className="block text-[11px] font-semibold text-on-surface-variant mb-1 uppercase">Domain / Specialization</span>
                <input
                  className={inputCls}
                  value={domain}
                  onChange={(e) => setDomain(e.target.value)}
                  placeholder="e.g. React & Performance"
                />
              </label>

              <div className="grid grid-cols-2 gap-2">
                <label className="block">
                  <span className="block text-[11px] font-semibold text-on-surface-variant mb-1 uppercase">Tone</span>
                  <select
                    className={inputCls}
                    value={tone}
                    onChange={(e) => setTone(e.target.value)}
                  >
                    <option value="Professional & Formal">Formal</option>
                    <option value="Friendly & Encouraging">Encouraging</option>
                    <option value="Challenging & Direct">Challenging</option>
                    <option value="Clinical & Neutral">Neutral</option>
                  </select>
                </label>
                <label className="block">
                  <span className="block text-[11px] font-semibold text-on-surface-variant mb-1 uppercase">Strictness</span>
                  <select
                    className={inputCls}
                    value={strictness}
                    onChange={(e) => setStrictness(e.target.value)}
                  >
                    <option value="Lenient">Lenient</option>
                    <option value="Balanced">Balanced</option>
                    <option value="Strict">Strict</option>
                  </select>
                </label>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <label className="block">
                  <span className="block text-[11px] font-semibold text-on-surface-variant mb-1 uppercase">Difficulty</span>
                  <select
                    className={inputCls}
                    value={difficulty}
                    onChange={(e) => setDifficulty(e.target.value)}
                  >
                    <option value="Easy">Easy</option>
                    <option value="Medium">Medium</option>
                    <option value="Hard">Hard</option>
                  </select>
                </label>
                <label className="block">
                  <span className="block text-[11px] font-semibold text-on-surface-variant mb-1 uppercase">Communication</span>
                  <select
                    className={inputCls}
                    value={style}
                    onChange={(e) => setStyle(e.target.value)}
                  >
                    <option value="Inquisitive & Technical">Inquisitive</option>
                    <option value="Conversational & Fluid">Fluid</option>
                    <option value="Structured & STAR">STAR Method</option>
                  </select>
                </label>
              </div>

              <label className="block">
                <span className="block text-[11px] font-semibold text-on-surface-variant mb-1 uppercase">Rigor / Core Focus Areas</span>
                <textarea
                  className={`${inputCls} min-h-[60px]`}
                  value={responsibilities}
                  onChange={(e) => setResponsibilities(e.target.value)}
                  placeholder="Key items to evaluate..."
                />
              </label>

              <button
                type="button"
                onClick={handleGenerate}
                disabled={isGenerating}
                className="w-full mt-4 py-2 bg-primary text-on-primary rounded-lg text-sm font-semibold hover:brightness-110 disabled:opacity-50 flex items-center justify-center gap-1.5 shadow-sm shadow-primary/20"
              >
                <Icon name="auto_awesome" />
                {isGenerating ? "Generating Prompt..." : "Generate AI Prompt"}
              </button>
            </div>
          )}
        </CardShadow>
      </div>
    </>
  );
}
