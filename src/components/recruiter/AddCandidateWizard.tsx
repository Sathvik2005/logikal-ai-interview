import { useMemo, useState, type ReactNode } from "react";
import { toast } from "sonner";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Icon } from "@/components/recruiter/RecruiterShell";
import { type Candidate } from "@/components/recruiter/mock-data";
import { makeInitials, useCreateCandidate, uploadCandidateResume } from "@/components/recruiter/use-candidates";
import { useJobsQuery } from "@/components/recruiter/use-jobs";
import { useServerFn } from "@tanstack/react-start";

// ============================================================================
// Types
// ============================================================================

type Source = "Referral" | "LinkedIn" | "Career site" | "Import" | "Other";
type Seniority = "Junior" | "Mid" | "Senior" | "Staff" | "Principal";

type CustomRole = {
  roleTitle: string;
  department: string;
  experienceLevel: string;
  employmentType: string;
  location: string;
  skills: string[];
  responsibilities: string;
  notes: string;
};

type Form = {
  name: string;
  email: string;
  phone: string;
  location: string;
  linkedin: string;
  role: string;
  seniority: Seniority;
  experienceYears: number;
  status: Candidate["status"];
  source: Source;
  skills: string[];
  resumeName: string | null;
  resumeFile: File | null;
  notes: string;
  sendWelcome: boolean;
  scheduleAfter: boolean;
  alignmentType: "jd" | "custom";
  jobId: string | null;
  customRole: CustomRole | null;
};

const DEFAULT: Form = {
  name: "",
  email: "",
  phone: "",
  location: "",
  linkedin: "",
  role: "",
  seniority: "Mid",
  experienceYears: 3,
  status: "new",
  source: "Career site",
  skills: [],
  resumeName: null,
  resumeFile: null,
  notes: "",
  sendWelcome: true,
  scheduleAfter: false,
  alignmentType: "jd",
  jobId: null,
  customRole: {
    roleTitle: "",
    department: "",
    experienceLevel: "Mid",
    employmentType: "Full-time",
    location: "",
    skills: [],
    responsibilities: "",
    notes: "",
  },
};

const STEPS = [
  { id: 1, title: "Basics", icon: "person" },
  { id: 2, title: "Role & Pipeline", icon: "work" },
  { id: 3, title: "Skills & Resume", icon: "stars" },
  { id: 4, title: "Review", icon: "check_circle" },
] as const;

const SOURCES: { id: Source; icon: string; hint: string }[] = [
  { id: "Referral", icon: "handshake", hint: "Internal or external referral" },
  { id: "LinkedIn", icon: "share", hint: "Sourced via LinkedIn" },
  { id: "Career site", icon: "language", hint: "Applied via website" },
  { id: "Import", icon: "upload_file", hint: "Bulk import / ATS" },
  { id: "Other", icon: "more_horiz", hint: "Anything else" },
];

const ALL_ROLES: string[] = [
  "Senior Software Engineer",
  "Product Manager",
  "Data Scientist",
  "UX Designer",
  "Engineering Manager",
  "DevOps Engineer",
];
const ALL_SKILLS: string[] = [
  "React",
  "TypeScript",
  "Node.js",
  "Python",
  "AWS",
  "SQL",
  "GraphQL",
  "Kubernetes",
  "System Design",
  "Product Strategy",
];

// ============================================================================
// Component
// ============================================================================

export function AddCandidateWizard({
  open,
  onOpenChange,
  onScheduleRequest,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  onScheduleRequest?: (candidate: Candidate) => void;
}) {
  const createMutation = useCreateCandidate();
  const uploadResumeFn = useServerFn(uploadCandidateResume);
  const [step, setStep] = useState(1);
  const [form, setForm] = useState<Form>(DEFAULT);
  const [isProcessing, setIsProcessing] = useState(false);

  const set = <K extends keyof Form>(k: K, v: Form[K]) => setForm((f) => ({ ...f, [k]: v }));

  const emailValid = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email.trim());
  const phoneValid = form.phone.trim().length >= 5;
  const notesValid = form.resumeFile ? true : form.notes.trim().length >= 40;

  const canAdvance = useMemo(() => {
    if (step === 1) return form.name.trim().length >= 2 && emailValid && phoneValid;
    if (step === 2) {
      if (form.alignmentType === "jd") {
        return !!form.jobId && form.experienceYears > 0;
      } else {
        return !!form.customRole?.roleTitle?.trim() && form.experienceYears > 0;
      }
    }
    if (step === 3) return form.skills.length >= 3 && notesValid;
    return true;
  }, [step, form, emailValid, phoneValid, notesValid]);

  const close = () => {
    onOpenChange(false);
    setTimeout(() => {
      setStep(1);
      setForm(DEFAULT);
    }, 200);
  };

  const fileToBase64 = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onload = () => {
        const base64String = reader.result as string;
        const base64Data = base64String.split(",")[1];
        resolve(base64Data);
      };
      reader.onerror = (error) => reject(error);
    });
  };

  const submit = async () => {
    try {
      setIsProcessing(true);
      const created = await createMutation.mutateAsync({
        name: form.name.trim(),
        email: form.email.trim(),
        phone: form.phone.trim() || null,
        role: form.role.trim(),
        status: form.status === "archived" ? "new" : form.status,
        experienceYears: form.experienceYears,
        skills: form.skills,
        notes: form.notes.trim() || null,
        sendWelcome: form.sendWelcome,
        jobId: form.alignmentType === "jd" ? form.jobId : null,
        customRole: form.alignmentType === "custom" ? form.customRole : null,
      });

      if (form.resumeFile) {
        try {
          const fileBase64 = await fileToBase64(form.resumeFile);
          await uploadResumeFn({
            data: {
              id: created.id,
              fileName: form.resumeFile.name,
              fileBase64,
              mimeType: form.resumeFile.type,
            }
          });
          toast.success("Resume processed and analyzed by Gemini.");
        } catch (uploadErr) {
          console.error("Resume processing failed:", uploadErr);
          toast.error("Candidate created, but resume parsing failed. You can upload/retry from their profile.");
        }
      }

      toast.success(
        form.sendWelcome
          ? `${created.name} added — welcome email queued`
          : `${created.name} added to pipeline`,
      );

      if (form.scheduleAfter) {
        onScheduleRequest?.({
          id: created.id,
          name: created.name,
          email: created.email,
          role: created.role,
          status: created.status === "archived" ? "new" : created.status,
          score: created.score,
          avatar: created.avatar,
          appliedAt: created.appliedAt,
          skills: created.skills,
          experienceYears: created.experienceYears,
        });
      }
      close();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to add candidate");
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(o) => (o ? onOpenChange(true) : close())}>
      <DialogContent className="relative p-0 gap-0 bg-white border border-outline-variant shadow-2xl rounded-2xl overflow-hidden max-w-[960px] w-[96vw] max-h-[88vh] sm:max-w-[960px] flex flex-col [&>button]:hidden">
        {isProcessing && (
          <div className="absolute inset-0 bg-white/80 backdrop-blur-sm z-50 flex flex-col items-center justify-center gap-3">
            <div className="w-12 h-12 border-4 border-primary border-t-transparent rounded-full animate-spin" />
            <p className="text-sm font-semibold text-on-surface">Processing Candidate Profile...</p>
            <p className="text-xs text-on-surface-variant">Gemini is extracting resume details & aligning to the role.</p>
          </div>
        )}
        {/* Header */}
        <header className="px-6 py-3.5 border-b border-outline-variant bg-white/95 backdrop-blur flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <span className="w-9 h-9 rounded-lg bg-primary text-on-primary flex items-center justify-center">
              <Icon name="person_add" />
            </span>
            <div>
              <h2 className="text-[15px] font-semibold text-on-surface leading-tight">
                Add Candidate
              </h2>
              <p className="text-xs text-on-surface-variant">
                Capture a new candidate in a guided flow.
              </p>
            </div>
          </div>
          <button
            onClick={close}
            className="p-1.5 text-on-surface-variant hover:bg-surface-container rounded-md"
            aria-label="Close"
          >
            <Icon name="close" className="text-base" />
          </button>
        </header>

        {/* Stepper */}
        <div className="px-6 pt-4 pb-3 border-b border-outline-variant bg-gradient-to-b from-surface-container-low/80 to-white shrink-0">
          <ol className="flex items-center">
            {STEPS.map((s, i) => {
              const active = s.id === step;
              const done = s.id < step;
              return (
                <li key={s.id} className="flex items-center flex-1 last:flex-none min-w-0">
                  <button
                    type="button"
                    onClick={() => s.id <= step && setStep(s.id)}
                    disabled={s.id > step}
                    className={`group flex items-center gap-2 min-w-0 ${s.id > step ? "cursor-default" : "cursor-pointer"}`}
                  >
                    <span
                      className={`w-7 h-7 rounded-full flex items-center justify-center text-[11px] font-semibold border transition-all shrink-0 ${
                        active
                          ? "bg-primary border-primary text-on-primary shadow-sm shadow-primary/30 ring-4 ring-primary-container/30"
                          : done
                            ? "bg-secondary border-secondary text-on-primary"
                            : "bg-white border-outline-variant text-outline"
                      }`}
                    >
                      {done ? <Icon name="check" className="text-[15px]" /> : s.id}
                    </span>
                    <span
                      className={`hidden md:inline text-xs font-medium whitespace-nowrap truncate ${
                        active
                          ? "text-on-surface"
                          : done
                            ? "text-on-surface group-hover:text-on-surface"
                            : "text-outline"
                      }`}
                    >
                      {s.title}
                    </span>
                  </button>
                  {i < STEPS.length - 1 && (
                    <div
                      className={`h-px flex-1 mx-2 transition-colors ${s.id < step ? "bg-secondary" : "bg-surface-container-high"}`}
                    />
                  )}
                </li>
              );
            })}
          </ol>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-6 py-6 bg-white">
          <div className="grid md:grid-cols-[1fr_300px] gap-6">
            <div>
              {step === 1 && <StepBasics form={form} set={set} emailValid={emailValid} />}
              {step === 2 && <StepRole form={form} set={set} />}
              {step === 3 && <StepSkills form={form} set={set} />}
              {step === 4 && <StepReview form={form} set={set} onJump={setStep} />}
            </div>
            <SummaryCard form={form} />
          </div>
        </div>

        {/* Footer */}
        <footer className="px-6 py-3 border-t border-outline-variant bg-white/95 backdrop-blur flex items-center justify-between shrink-0">
          <div className="text-xs text-on-surface-variant">
            Step {step} of {STEPS.length} — {STEPS[step - 1]?.title}
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={close}
              className="px-3 py-1.5 text-sm font-medium text-on-surface-variant hover:bg-surface-container rounded-md"
            >
              Cancel
            </button>
            <button
              onClick={() => setStep((s) => Math.max(1, s - 1))}
              disabled={step === 1}
              className="px-3 py-1.5 text-sm font-medium border border-outline-variant rounded-md hover:bg-surface-container-low disabled:opacity-40 disabled:cursor-not-allowed text-on-surface inline-flex items-center gap-1"
            >
              <Icon name="arrow_back" className="text-base" /> Back
            </button>
            {step < STEPS.length ? (
              <button
                onClick={() => canAdvance && setStep((s) => Math.min(STEPS.length, s + 1))}
                disabled={!canAdvance}
                className="px-4 py-1.5 text-sm font-semibold bg-primary text-on-primary rounded-md hover:bg-primary disabled:opacity-40 disabled:cursor-not-allowed inline-flex items-center gap-1.5 shadow-sm shadow-primary/20"
              >
                Continue <Icon name="arrow_forward" className="text-base" />
              </button>
            ) : (
              <button
                onClick={submit}
                className="px-4 py-1.5 text-sm font-semibold bg-secondary text-on-primary rounded-md hover:bg-secondary inline-flex items-center gap-1.5 shadow-sm shadow-secondary/20"
              >
                <Icon name="check" className="text-base" />
                {form.scheduleAfter ? "Add & schedule" : "Add candidate"}
              </button>
            )}
          </div>
        </footer>
      </DialogContent>
    </Dialog>
  );
}

// ============================================================================
// Step frame
// ============================================================================

function StepFrame({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle: string;
  children: ReactNode;
}) {
  return (
    <div>
      <div className="mb-5">
        <h3 className="text-[17px] font-semibold text-on-surface">{title}</h3>
        <p className="text-sm text-on-surface-variant mt-0.5">{subtitle}</p>
      </div>
      {children}
    </div>
  );
}

function Field({
  label,
  hint,
  error,
  children,
}: {
  label: string;
  hint?: string;
  error?: string;
  children: ReactNode;
}) {
  return (
    <label className="block">
      <span className="block text-xs font-semibold text-on-surface mb-1.5">{label}</span>
      {children}
      {error ? (
        <span className="block text-[11px] text-on-error-container mt-1">{error}</span>
      ) : hint ? (
        <span className="block text-[11px] text-on-surface-variant mt-1">{hint}</span>
      ) : null}
    </label>
  );
}

const inputCls =
  "w-full px-3 py-2 border border-outline-variant rounded-lg text-sm bg-white focus:ring-2 focus:ring-primary-container outline-none placeholder:text-outline";

// ============================================================================
// Step 1 — Basics
// ============================================================================

function StepBasics({
  form,
  set,
  emailValid,
}: {
  form: Form;
  set: <K extends keyof Form>(k: K, v: Form[K]) => void;
  emailValid: boolean;
}) {
  return (
    <StepFrame title="Candidate basics" subtitle="Who are you adding to the pipeline?">
      <div className="grid sm:grid-cols-2 gap-4">
        <Field label="Full name">
          <input
            className={inputCls}
            value={form.name}
            onChange={(e) => set("name", e.target.value)}
            placeholder="e.g. Jordan Park"
          />
        </Field>
        <Field
          label="Email"
          error={form.email && !emailValid ? "Enter a valid email address" : undefined}
        >
          <input
            type="email"
            className={inputCls}
            value={form.email}
            onChange={(e) => set("email", e.target.value)}
            placeholder="jordan@example.com"
          />
        </Field>
        <Field
          label="Phone *"
          hint="Required — used for interview reminders"
          error={
            form.phone && form.phone.trim().length < 5 ? "Enter a valid phone number" : undefined
          }
        >
          <input
            className={inputCls}
            value={form.phone}
            onChange={(e) => set("phone", e.target.value)}
            placeholder="+1 555 123 4567"
          />
        </Field>
        <Field label="Location" hint="Optional">
          <input
            className={inputCls}
            value={form.location}
            onChange={(e) => set("location", e.target.value)}
            placeholder="Remote · NYC"
          />
        </Field>
        <div className="sm:col-span-2">
          <Field label="LinkedIn URL" hint="Optional">
            <input
              className={inputCls}
              value={form.linkedin}
              onChange={(e) => set("linkedin", e.target.value)}
              placeholder="https://linkedin.com/in/…"
            />
          </Field>
        </div>
      </div>
    </StepFrame>
  );
}

// ============================================================================
// Step 2 — Role & Pipeline
// ============================================================================

function StepRole({
  form,
  set,
}: {
  form: Form;
  set: <K extends keyof Form>(k: K, v: Form[K]) => void;
}) {
  const { data: jobs } = useJobsQuery();

  return (
    <StepFrame title="Role & pipeline" subtitle="Where does this candidate fit?">
      <div className="flex gap-2 mb-6">
        <button
          type="button"
          onClick={() => {
            set("alignmentType", "jd");
            set("role", "");
          }}
          className={`flex-1 py-2 text-center text-sm font-semibold rounded-lg border transition ${
            form.alignmentType === "jd"
              ? "bg-primary text-on-primary border-primary shadow-sm"
              : "bg-white text-on-surface border-outline-variant hover:bg-surface-container-low"
          }`}
        >
          Existing Job Description
        </button>
        <button
          type="button"
          onClick={() => {
            set("alignmentType", "custom");
            set("role", form.customRole?.roleTitle || "");
          }}
          className={`flex-1 py-2 text-center text-sm font-semibold rounded-lg border transition ${
            form.alignmentType === "custom"
              ? "bg-primary text-on-primary border-primary shadow-sm"
              : "bg-white text-on-surface border-outline-variant hover:bg-surface-container-low"
          }`}
        >
          Custom Role
        </button>
      </div>

      {form.alignmentType === "jd" ? (
        <div className="grid sm:grid-cols-2 gap-4">
          <Field label="Job Description">
            <select
              className={inputCls}
              value={form.jobId || ""}
              onChange={(e) => {
                const val = e.target.value;
                const selectedJob = jobs?.find(j => j.id === val);
                set("jobId", val || null);
                set("role", selectedJob ? selectedJob.title : "");
              }}
            >
              <option value="">Select an existing JD...</option>
              {jobs?.map((j) => (
                <option key={j.id} value={j.id}>
                  {j.title} {j.department ? `(${j.department})` : ""}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Seniority">
            <select
              className={inputCls}
              value={form.seniority}
              onChange={(e) => set("seniority", e.target.value as Seniority)}
            >
              {(["Junior", "Mid", "Senior", "Staff", "Principal"] as const).map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
          </Field>
          <Field label={`Experience — ${form.experienceYears} yrs`}>
            <input
              type="range"
              min={0}
              max={20}
              value={form.experienceYears}
              onChange={(e) => set("experienceYears", Number(e.target.value))}
              className="w-full accent-primary"
            />
          </Field>
          <Field label="Pipeline status">
            <select
              className={inputCls}
              value={form.status}
              onChange={(e) => set("status", e.target.value as Candidate["status"])}
            >
              {(["new", "screening", "interviewing", "evaluated", "offer", "rejected"] as const).map(
                (s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ),
              )}
            </select>
          </Field>
        </div>
      ) : (
        <div className="grid sm:grid-cols-2 gap-4">
          <Field label="Role Title">
            <input
              className={inputCls}
              value={form.customRole?.roleTitle || ""}
              onChange={(e) => {
                const val = e.target.value;
                set("customRole", { ...form.customRole!, roleTitle: val });
                set("role", val);
              }}
              placeholder="e.g. Lead Frontend Architect"
            />
          </Field>
          <Field label="Department">
            <input
              className={inputCls}
              value={form.customRole?.department || ""}
              onChange={(e) => set("customRole", { ...form.customRole!, department: e.target.value })}
              placeholder="e.g. Engineering"
            />
          </Field>
          <Field label="Experience Level">
            <select
              className={inputCls}
              value={form.customRole?.experienceLevel || "Mid"}
              onChange={(e) => set("customRole", { ...form.customRole!, experienceLevel: e.target.value })}
            >
              <option value="Junior">Junior</option>
              <option value="Mid">Mid</option>
              <option value="Senior">Senior</option>
              <option value="Lead">Lead</option>
              <option value="Director/VP">Director/VP</option>
            </select>
          </Field>
          <Field label="Employment Type">
            <select
              className={inputCls}
              value={form.customRole?.employmentType || "Full-time"}
              onChange={(e) => set("customRole", { ...form.customRole!, employmentType: e.target.value })}
            >
              <option value="Full-time">Full-time</option>
              <option value="Part-time">Part-time</option>
              <option value="Contract">Contract</option>
              <option value="Internship">Internship</option>
            </select>
          </Field>
          <Field label="Location">
            <input
              className={inputCls}
              value={form.customRole?.location || ""}
              onChange={(e) => set("customRole", { ...form.customRole!, location: e.target.value })}
              placeholder="e.g. Remote (US/Canada)"
            />
          </Field>
          <Field label="Skills (comma separated)">
            <input
              className={inputCls}
              value={form.customRole?.skills?.join(", ") || ""}
              onChange={(e) => {
                const skillsArr = e.target.value.split(",").map(s => s.trim()).filter(Boolean);
                set("customRole", { ...form.customRole!, skills: skillsArr });
              }}
              placeholder="e.g. React, Node.js, TypeScript"
            />
          </Field>
          <div className="sm:col-span-2">
            <Field label="Responsibilities">
              <textarea
                className={`${inputCls} min-h-[60px]`}
                value={form.customRole?.responsibilities || ""}
                onChange={(e) => set("customRole", { ...form.customRole!, responsibilities: e.target.value })}
                placeholder="List core responsibilities of this custom role..."
              />
            </Field>
          </div>
          <div className="sm:col-span-2">
            <Field label="Custom Role Notes">
              <textarea
                className={`${inputCls} min-h-[60px]`}
                value={form.customRole?.notes || ""}
                onChange={(e) => set("customRole", { ...form.customRole!, notes: e.target.value })}
                placeholder="Any specific instructions or expectations for this candidate..."
              />
            </Field>
          </div>
          <Field label={`Experience — ${form.experienceYears} yrs`}>
            <input
              type="range"
              min={0}
              max={20}
              value={form.experienceYears}
              onChange={(e) => set("experienceYears", Number(e.target.value))}
              className="w-full accent-primary"
            />
          </Field>
          <Field label="Pipeline status">
            <select
              className={inputCls}
              value={form.status}
              onChange={(e) => set("status", e.target.value as Candidate["status"])}
            >
              {(["new", "screening", "interviewing", "evaluated", "offer", "rejected"] as const).map(
                (s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ),
              )}
            </select>
          </Field>
        </div>
      )}

      <div className="mt-6">
        <p className="text-xs font-semibold text-on-surface mb-2">Source</p>
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-2.5">
          {SOURCES.map((s) => {
            const selected = form.source === s.id;
            return (
              <button
                key={s.id}
                type="button"
                onClick={() => set("source", s.id)}
                className={`text-left p-3 rounded-xl border transition flex items-start gap-2.5 ${
                  selected
                    ? "border-primary bg-primary-fixed/60 ring-2 ring-primary-container/40"
                    : "border-outline-variant hover:border-outline-variant bg-white"
                }`}
              >
                <span
                  className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${
                    selected
                      ? "bg-primary text-on-primary"
                      : "bg-surface-container text-on-surface-variant"
                  }`}
                >
                  <Icon name={s.icon} className="text-base" />
                </span>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-sm font-medium text-on-surface">{s.id}</span>
                    {selected && <Icon name="check_circle" className="text-primary text-base" />}
                  </div>
                  <p className="text-[11px] text-on-surface-variant mt-0.5">{s.hint}</p>
                </div>
              </button>
            );
          })}
        </div>
      </div>
    </StepFrame>
  );
}

function StepSkills({
  form,
  set,
}: {
  form: Form;
  set: <K extends keyof Form>(k: K, v: Form[K]) => void;
}) {
  const [draft, setDraft] = useState("");
  const addSkill = (s: string) => {
    const v = s.trim();
    if (!v || form.skills.includes(v)) return;
    set("skills", [...form.skills, v]);
    setDraft("");
  };
  const removeSkill = (s: string) =>
    set(
      "skills",
      form.skills.filter((x) => x !== s),
    );
  const suggestions = ALL_SKILLS.filter((s) => !form.skills.includes(s)).slice(0, 8);

  return (
    <StepFrame title="Skills & resume" subtitle="Add highlights so AI matching can do its work.">
      <Field
        label={`Skills * (${form.skills.length}/3+)`}
        hint="Add at least 3 skills — press Enter to add"
        error={
          form.skills.length > 0 && form.skills.length < 3 ? "Add at least 3 skills" : undefined
        }
      >
        <div
          className={`${inputCls} flex flex-wrap items-center gap-1.5 min-h-[42px] cursor-text`}
          onClick={(e) =>
            (e.currentTarget.querySelector("input") as HTMLInputElement | null)?.focus()
          }
        >
          {form.skills.map((s) => (
            <span
              key={s}
              className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-primary-fixed text-primary text-xs font-medium"
            >
              {s}
              <button type="button" onClick={() => removeSkill(s)} className="hover:text-primary">
                <Icon name="close" className="text-[14px]" />
              </button>
            </span>
          ))}
          <input
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                addSkill(draft);
              } else if (e.key === "Backspace" && !draft && form.skills.length) {
                removeSkill(form.skills[form.skills.length - 1]);
              }
            }}
            className="flex-1 min-w-[120px] outline-none text-sm bg-transparent"
            placeholder={form.skills.length ? "" : "TypeScript, React, AWS…"}
          />
        </div>
      </Field>

      {suggestions.length > 0 && (
        <div className="mt-2">
          <p className="text-[11px] text-on-surface-variant mb-1.5">Suggestions</p>
          <div className="flex flex-wrap gap-1.5">
            {suggestions.map((s) => (
              <button
                key={s}
                type="button"
                onClick={() => addSkill(s)}
                className="px-2 py-0.5 rounded-md border border-outline-variant text-xs text-on-surface-variant hover:border-primary hover:text-primary"
              >
                + {s}
              </button>
            ))}
          </div>
        </div>
      )}

      <div className="mt-5">
        <p className="text-xs font-semibold text-on-surface mb-1.5">Resume</p>
        <label className="block border-2 border-dashed border-outline-variant rounded-xl px-4 py-6 text-center cursor-pointer hover:border-primary hover:bg-primary-fixed/30 transition">
          <input
            type="file"
            accept=".pdf,.doc,.docx"
            className="hidden"
            onChange={(e) => {
              const file = e.target.files?.[0] ?? null;
              set("resumeName", file ? file.name : null);
              set("resumeFile", file);
            }}
          />
          <Icon name="upload_file" className="text-outline text-2xl" />
          <p className="text-sm font-medium text-on-surface mt-1">
            {form.resumeName ? form.resumeName : "Drop a PDF or click to browse"}
          </p>
          <p className="text-[11px] text-on-surface-variant mt-0.5">PDF, DOC, DOCX up to 10MB</p>
        </label>
      </div>

      <div className="mt-5">
        <Field
          label={form.resumeFile ? `Resume summary (Optional when resume uploaded)` : `Resume summary * (${form.notes.trim().length}/40+ chars)`}
          hint={form.resumeFile ? "Optional — Gemini will automatically generate a summary from the uploaded resume file" : "Required — short summary used for AI matching and interview prep"}
          error={
            !form.resumeFile && form.notes.trim().length > 0 && form.notes.trim().length < 40
              ? "Write at least 40 characters"
              : undefined
          }
        >
          <textarea
            className={`${inputCls} min-h-[88px] resize-y`}
            value={form.notes}
            onChange={(e) => set("notes", e.target.value)}
            placeholder="Background, key strengths, screening highlights, fit signals…"
          />
        </Field>
      </div>
    </StepFrame>
  );
}

// ============================================================================
// Step 4 — Review
// ============================================================================

function StepReview({
  form,
  set,
  onJump,
}: {
  form: Form;
  set: <K extends keyof Form>(k: K, v: Form[K]) => void;
  onJump: (step: number) => void;
}) {
  const row = (label: string, value: ReactNode, step: number) => (
    <div className="flex items-start justify-between gap-3 py-2.5 border-b border-outline-variant last:border-0">
      <div className="min-w-0">
        <p className="text-[11px] uppercase tracking-wide text-on-surface-variant">{label}</p>
        <div className="text-sm text-on-surface mt-0.5">
          {value || <span className="text-outline">—</span>}
        </div>
      </div>
      <button
        type="button"
        onClick={() => onJump(step)}
        className="text-[11px] font-semibold text-primary hover:underline shrink-0"
      >
        Edit
      </button>
    </div>
  );

  return (
    <StepFrame title="Review & invite" subtitle="Confirm details and choose what happens next.">
      <div className="rounded-xl border border-outline-variant px-4">
        {row("Name", form.name, 1)}
        {row("Email", form.email, 1)}
        {row("Phone", form.phone, 1)}
        {row("Role", `${form.role} · ${form.seniority} · ${form.experienceYears} yrs`, 2)}
        {row("Status", form.status, 2)}
        {row("Source", form.source, 2)}
        {row(
          "Skills",
          form.skills.length ? (
            <div className="flex flex-wrap gap-1 mt-0.5">
              {form.skills.map((s) => (
                <span
                  key={s}
                  className="px-1.5 py-0.5 rounded bg-surface-container text-on-surface text-[11px]"
                >
                  {s}
                </span>
              ))}
            </div>
          ) : null,
          3,
        )}
        {row("Resume", form.resumeName, 3)}
      </div>

      <div className="mt-5 space-y-2.5">
        <Toggle
          icon="mail"
          title="Send welcome email"
          desc="Notify the candidate they've been added to the pipeline."
          checked={form.sendWelcome}
          onChange={(v) => set("sendWelcome", v)}
        />
        <Toggle
          icon="event"
          title="Schedule interview now"
          desc="Open the interview scheduling wizard right after saving."
          checked={form.scheduleAfter}
          onChange={(v) => set("scheduleAfter", v)}
        />
      </div>
    </StepFrame>
  );
}

function Toggle({
  icon,
  title,
  desc,
  checked,
  onChange,
}: {
  icon: string;
  title: string;
  desc: string;
  checked: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <button
      type="button"
      onClick={() => onChange(!checked)}
      className={`w-full flex items-start gap-3 p-3 rounded-xl border transition text-left ${
        checked
          ? "border-primary bg-primary-fixed/60"
          : "border-outline-variant hover:border-outline-variant bg-white"
      }`}
    >
      <span
        className={`w-9 h-9 rounded-lg flex items-center justify-center shrink-0 ${
          checked ? "bg-primary text-on-primary" : "bg-surface-container text-on-surface-variant"
        }`}
      >
        <Icon name={icon} className="text-base" />
      </span>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold text-on-surface">{title}</p>
        <p className="text-xs text-on-surface-variant mt-0.5">{desc}</p>
      </div>
      <span
        className={`mt-1 w-9 h-5 rounded-full relative transition ${checked ? "bg-primary" : "bg-outline-variant"}`}
        aria-hidden
      >
        <span
          className={`absolute top-0.5 w-4 h-4 rounded-full bg-white shadow transition-all ${checked ? "left-[18px]" : "left-0.5"}`}
        />
      </span>
    </button>
  );
}

// ============================================================================
// Summary card
// ============================================================================

function SummaryCard({ form }: { form: Form }) {
  const initials = makeInitials(form.name || "?");
  return (
    <aside className="rounded-2xl border border-outline-variant bg-gradient-to-b from-surface-container-low to-white p-4 h-fit sticky top-0">
      <p className="text-[11px] uppercase tracking-wide text-on-surface-variant mb-3">
        Live preview
      </p>
      <div className="flex items-center gap-3">
        <div className="w-12 h-12 rounded-full bg-primary text-on-primary flex items-center justify-center font-semibold text-lg">
          {initials}
        </div>
        <div className="min-w-0">
          <p className="font-semibold text-on-surface truncate">{form.name || "New candidate"}</p>
          <p className="text-xs text-on-surface-variant truncate">{form.email || "no email yet"}</p>
        </div>
      </div>

      <div className="mt-4 space-y-2 text-xs">
        <div className="flex items-center justify-between">
          <span className="text-on-surface-variant">Role</span>
          <span className="text-on-surface font-medium truncate ml-2">{form.role || "—"}</span>
        </div>
        <div className="flex items-center justify-between">
          <span className="text-on-surface-variant">Seniority</span>
          <span className="text-on-surface font-medium">
            {form.seniority} · {form.experienceYears}y
          </span>
        </div>
        <div className="flex items-center justify-between">
          <span className="text-on-surface-variant">Status</span>
          <span className="px-2 py-0.5 rounded-full bg-surface-container text-on-surface text-[10px] uppercase tracking-wide font-semibold">
            {form.status}
          </span>
        </div>
        <div className="flex items-center justify-between">
          <span className="text-on-surface-variant">Source</span>
          <span className="text-on-surface font-medium">{form.source}</span>
        </div>
      </div>

      {form.skills.length > 0 && (
        <div className="mt-4">
          <p className="text-[11px] uppercase tracking-wide text-on-surface-variant mb-1.5">
            Skills
          </p>
          <div className="flex flex-wrap gap-1">
            {form.skills.map((s) => (
              <span
                key={s}
                className="px-1.5 py-0.5 rounded bg-primary-fixed text-primary text-[11px] font-medium"
              >
                {s}
              </span>
            ))}
          </div>
        </div>
      )}
    </aside>
  );
}
