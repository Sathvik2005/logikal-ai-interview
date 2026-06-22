import { useState, useMemo, useRef } from "react";
import Papa from "papaparse";
import { toast } from "sonner";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Icon } from "@/components/recruiter/RecruiterShell";
import { bulkImportCandidates, type BulkImportRow } from "@/lib/bulk-import.functions";

type FieldKey = "name" | "email" | "phone" | "role" | "experienceYears" | "skills" | "resumeUrl";

const FIELD_LABELS: Record<FieldKey, string> = {
  name: "Full name *",
  email: "Email *",
  phone: "Phone",
  role: "Role",
  experienceYears: "Experience (years)",
  skills: "Skills",
  resumeUrl: "Resume URL",
};

const FIELD_HINTS: Record<FieldKey, RegExp> = {
  name: /^(full[\s_-]?name|name|candidate)$/i,
  email: /e[\s_-]?mail/i,
  phone: /(phone|mobile|tel)/i,
  role: /(role|position|title|applied)/i,
  experienceYears: /(experience|years|yoe|exp)/i,
  skills: /(skill|tech|stack)/i,
  resumeUrl: /(resume|cv|url|link)/i,
};

type Row = Record<string, string>;

type Draft = {
  id: string;
  name: string;
  email: string;
  phone: string;
  role: string;
  experienceYears: number;
  skills: string[];
  resumeUrl: string;
  errors: string[];
};

function autoMap(headers: string[]): Record<FieldKey, string | null> {
  const out: Record<FieldKey, string | null> = {
    name: null, email: null, phone: null, role: null, experienceYears: null, skills: null, resumeUrl: null,
  };
  (Object.keys(FIELD_HINTS) as FieldKey[]).forEach((k) => {
    const match = headers.find((h) => FIELD_HINTS[k].test(h));
    if (match) out[k] = match;
  });
  return out;
}

function emailValid(v: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v.trim());
}

const STEPS = ["Upload", "Map fields", "Review", "Import"] as const;

export function ImportCandidatesWizard({
  open,
  onOpenChange,
  jobId,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  jobId?: string | null;
}) {
  const [step, setStep] = useState(0);
  const [headers, setHeaders] = useState<string[]>([]);
  const [rawRows, setRawRows] = useState<Row[]>([]);
  const [mapping, setMapping] = useState<Record<FieldKey, string | null>>({
    name: null, email: null, phone: null, role: null, experienceYears: null, skills: null, resumeUrl: null,
  });
  const [drafts, setDrafts] = useState<Draft[]>([]);
  const [filterMissing, setFilterMissing] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const importFn = useServerFn(bulkImportCandidates);
  const qc = useQueryClient();

  const importMut = useMutation({
    mutationFn: (rows: BulkImportRow[]) => importFn({ data: { rows, jobId: jobId ?? null } }),
    onSuccess: (res) => {
      toast.success(`Imported ${res.imported} candidate${res.imported === 1 ? "" : "s"}` + (res.skipped ? ` (${res.skipped} duplicates skipped)` : ""));
      qc.invalidateQueries({ queryKey: ["candidates"] });
      close();
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Import failed"),
  });

  function close() {
    onOpenChange(false);
    setTimeout(() => {
      setStep(0); setHeaders([]); setRawRows([]); setDrafts([]); setFilterMissing(false);
    }, 200);
  }

  function onFile(f: File) {
    Papa.parse<Row>(f, {
      header: true,
      skipEmptyLines: true,
      complete: (result) => {
        const hdrs = result.meta.fields ?? [];
        setHeaders(hdrs);
        setRawRows((result.data ?? []) as Row[]);
        setMapping(autoMap(hdrs));
        setStep(1);
      },
      error: (err) => toast.error(`CSV parse failed: ${err.message}`),
    });
  }

  function buildDrafts(): Draft[] {
    return rawRows.map((r, i) => {
      const name = (mapping.name ? r[mapping.name] : "").trim();
      const email = (mapping.email ? r[mapping.email] : "").trim().toLowerCase();
      const phone = (mapping.phone ? r[mapping.phone] : "").trim();
      const role = (mapping.role ? r[mapping.role] : "").trim();
      const expStr = mapping.experienceYears ? r[mapping.experienceYears] : "";
      const skillsStr = mapping.skills ? r[mapping.skills] : "";
      const resumeUrl = (mapping.resumeUrl ? r[mapping.resumeUrl] : "").trim();
      const errors: string[] = [];
      if (!name || name.length < 2) errors.push("Missing name");
      if (!email || !emailValid(email)) errors.push("Invalid email");
      return {
        id: `r${i}`,
        name,
        email,
        phone,
        role,
        experienceYears: Math.max(0, Math.min(60, Number(expStr) || 0)),
        skills: skillsStr.split(/[,;|]/).map((s) => s.trim()).filter(Boolean),
        resumeUrl,
        errors,
      };
    });
  }

  function applyMapping() {
    if (!mapping.name || !mapping.email) {
      toast.error("Map name and email columns to continue");
      return;
    }
    setDrafts(buildDrafts());
    setStep(2);
  }

  function updateDraft(id: string, patch: Partial<Draft>) {
    setDrafts((ds) =>
      ds.map((d) => {
        if (d.id !== id) return d;
        const merged = { ...d, ...patch };
        const errs: string[] = [];
        if (!merged.name || merged.name.length < 2) errs.push("Missing name");
        if (!merged.email || !emailValid(merged.email)) errs.push("Invalid email");
        merged.errors = errs;
        return merged;
      }),
    );
  }

  function removeDraft(id: string) {
    setDrafts((ds) => ds.filter((d) => d.id !== id));
  }

  const visible = useMemo(
    () => (filterMissing ? drafts.filter((d) => !d.resumeUrl) : drafts),
    [drafts, filterMissing],
  );
  const validDrafts = drafts.filter((d) => d.errors.length === 0);
  const missingResume = drafts.filter((d) => !d.resumeUrl).length;

  function doImport() {
    if (validDrafts.length === 0) {
      toast.error("No valid rows to import");
      return;
    }
    const rows: BulkImportRow[] = validDrafts.map((d) => ({
      name: d.name,
      email: d.email,
      phone: d.phone || null,
      role: d.role || null,
      experienceYears: d.experienceYears,
      skills: d.skills,
      resumeUrl: d.resumeUrl || null,
    }));
    importMut.mutate(rows);
  }

  return (
    <Dialog open={open} onOpenChange={(o) => (o ? onOpenChange(true) : close())}>
      <DialogContent className="p-0 gap-0 bg-white border border-outline-variant shadow-2xl rounded-2xl overflow-hidden max-w-[1120px] w-[96vw] max-h-[90vh] sm:max-w-[1120px] flex flex-col [&>button]:hidden">
        <header className="px-6 py-3.5 border-b border-outline-variant flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <span className="w-9 h-9 rounded-lg bg-primary text-on-primary flex items-center justify-center"><Icon name="upload_file" /></span>
            <div>
              <h2 className="text-[15px] font-semibold">Import Candidates from CSV</h2>
              <p className="text-xs text-on-surface-variant">{jobId ? "Importing against selected JD" : "Bulk add candidates to your pipeline"}</p>
            </div>
          </div>
          <button onClick={close} className="p-1.5 text-on-surface-variant hover:bg-surface-container rounded-md" aria-label="Close">
            <Icon name="close" className="text-base" />
          </button>
        </header>

        <div className="px-6 pt-4 pb-3 border-b border-outline-variant bg-gradient-to-b from-surface-container-low/80 to-white shrink-0">
          <ol className="flex items-center">
            {STEPS.map((s, i) => {
              const active = i === step;
              const done = i < step;
              return (
                <li key={s} className="flex items-center flex-1 last:flex-none min-w-0">
                  <div className={`flex items-center gap-2 min-w-0`}>
                    <span className={`w-7 h-7 rounded-full flex items-center justify-center text-[11px] font-semibold border ${active ? "bg-primary border-primary text-on-primary" : done ? "bg-secondary border-secondary text-on-primary" : "bg-white border-outline-variant text-outline"}`}>
                      {done ? <Icon name="check" className="text-[15px]" /> : i + 1}
                    </span>
                    <span className={`hidden md:inline text-xs font-medium ${active ? "text-on-surface" : "text-on-surface-variant"}`}>{s}</span>
                  </div>
                  {i < STEPS.length - 1 && <div className={`h-px flex-1 mx-2 ${i < step ? "bg-secondary" : "bg-surface-container-high"}`} />}
                </li>
              );
            })}
          </ol>
        </div>

        <div className="flex-1 overflow-y-auto px-6 py-6 bg-white">
          {step === 0 && (
            <div className="max-w-2xl mx-auto text-center py-8">
              <div className="w-16 h-16 mx-auto rounded-full bg-primary-container text-on-primary-container flex items-center justify-center mb-4"><Icon name="cloud_upload" /></div>
              <h3 className="text-headline-sm mb-2">Upload your CSV</h3>
              <p className="text-body-md text-on-surface-variant mb-6">We'll auto-detect columns like name, email, phone, role, experience, skills, and resume URL.</p>
              <input ref={fileRef} type="file" accept=".csv,text/csv" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) onFile(f); }} />
              <button onClick={() => fileRef.current?.click()} className="px-5 py-2.5 bg-primary text-on-primary rounded-lg font-semibold inline-flex items-center gap-2 hover:brightness-110"><Icon name="upload_file" />Choose CSV</button>
              <p className="text-label-caps uppercase text-on-surface-variant mt-4">Up to 500 rows · UTF-8</p>
            </div>
          )}

          {step === 1 && (
            <div>
              <h3 className="text-headline-sm mb-1">Map your columns</h3>
              <p className="text-body-md text-on-surface-variant mb-4">We auto-mapped what we could. Confirm or change the mapping below.</p>
              <div className="grid sm:grid-cols-2 gap-4">
                {(Object.keys(FIELD_LABELS) as FieldKey[]).map((k) => (
                  <label key={k} className="block">
                    <span className="block text-xs font-semibold mb-1.5">{FIELD_LABELS[k]}</span>
                    <select
                      value={mapping[k] ?? ""}
                      onChange={(e) => setMapping((m) => ({ ...m, [k]: e.target.value || null }))}
                      className="w-full px-3 py-2 border border-outline-variant rounded-lg text-sm bg-white"
                    >
                      <option value="">— Not mapped —</option>
                      {headers.map((h) => <option key={h} value={h}>{h}</option>)}
                    </select>
                  </label>
                ))}
              </div>
              <p className="text-label-caps uppercase text-on-surface-variant mt-4">Parsed {rawRows.length} row{rawRows.length === 1 ? "" : "s"}</p>
            </div>
          )}

          {step === 2 && (
            <div>
              <div className="flex items-center justify-between mb-4 gap-3 flex-wrap">
                <div>
                  <h3 className="text-headline-sm">Review candidates</h3>
                  <p className="text-body-md text-on-surface-variant">{validDrafts.length} valid · {drafts.length - validDrafts.length} with errors · {missingResume} missing resume</p>
                </div>
                <label className="flex items-center gap-2 text-body-md">
                  <input type="checkbox" checked={filterMissing} onChange={(e) => setFilterMissing(e.target.checked)} />
                  Show only missing resume
                </label>
              </div>
              <div className="border border-outline-variant rounded-xl overflow-hidden">
                <div className="w-full overflow-x-auto">
                  <table className="w-full text-body-md min-w-[900px]">
                    <thead className="bg-surface-container-low text-label-caps uppercase text-on-surface-variant">
                      <tr>
                        <th className="text-left p-3">Name</th>
                        <th className="text-left p-3">Email</th>
                        <th className="text-left p-3">Phone</th>
                        <th className="text-left p-3">Role</th>
                        <th className="text-left p-3">Exp</th>
                        <th className="text-left p-3">Resume</th>
                        <th className="p-3" />
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-outline-variant">
                      {visible.map((d) => (
                        <tr key={d.id} className={d.errors.length > 0 ? "bg-error-container/30" : ""}>
                          <td className="p-2"><input className="w-full px-2 py-1 border border-outline-variant rounded text-sm" value={d.name} onChange={(e) => updateDraft(d.id, { name: e.target.value })} /></td>
                          <td className="p-2"><input className="w-full px-2 py-1 border border-outline-variant rounded text-sm" value={d.email} onChange={(e) => updateDraft(d.id, { email: e.target.value })} /></td>
                          <td className="p-2"><input className="w-full px-2 py-1 border border-outline-variant rounded text-sm" value={d.phone} onChange={(e) => updateDraft(d.id, { phone: e.target.value })} /></td>
                          <td className="p-2"><input className="w-full px-2 py-1 border border-outline-variant rounded text-sm" value={d.role} onChange={(e) => updateDraft(d.id, { role: e.target.value })} /></td>
                          <td className="p-2 w-16"><input type="number" min={0} max={60} className="w-full px-2 py-1 border border-outline-variant rounded text-sm" value={d.experienceYears} onChange={(e) => updateDraft(d.id, { experienceYears: Number(e.target.value) })} /></td>
                          <td className="p-2">
                            {d.resumeUrl ? (
                              <a href={d.resumeUrl} target="_blank" rel="noreferrer" className="text-primary text-xs underline truncate inline-block max-w-[140px]">Link</a>
                            ) : (
                              <span className="inline-flex items-center gap-1 text-xs px-1.5 py-0.5 rounded-full bg-warning-container text-on-warning-container"><Icon name="warning" className="text-[12px]" />Missing</span>
                            )}
                            <input className="w-full mt-1 px-2 py-1 border border-outline-variant rounded text-xs" placeholder="Paste resume URL…" value={d.resumeUrl} onChange={(e) => updateDraft(d.id, { resumeUrl: e.target.value })} />
                          </td>
                          <td className="p-2 text-right">
                            <button onClick={() => removeDraft(d.id)} className="p-1 text-on-surface-variant hover:text-error" aria-label="Delete"><Icon name="delete" /></button>
                          </td>
                        </tr>
                      ))}
                      {visible.length === 0 && (
                        <tr><td colSpan={7} className="p-6 text-center text-on-surface-variant">No rows to show.</td></tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {step === 3 && (
            <div className="max-w-2xl mx-auto text-center py-8">
              <div className="w-16 h-16 mx-auto rounded-full bg-primary-container text-on-primary-container flex items-center justify-center mb-4"><Icon name="task_alt" /></div>
              <h3 className="text-headline-sm mb-2">Ready to import</h3>
              <p className="text-body-md text-on-surface-variant mb-4">{validDrafts.length} candidate{validDrafts.length === 1 ? "" : "s"} will be added.{jobId ? " AI match scoring will run in the background." : ""}</p>
              {missingResume > 0 && (
                <p className="text-body-md text-warning mb-4">{missingResume} candidate{missingResume === 1 ? "" : "s"} have no resume — you can add them later from their profile.</p>
              )}
              <button onClick={doImport} disabled={importMut.isPending || validDrafts.length === 0} className="px-5 py-2.5 bg-primary text-on-primary rounded-lg font-semibold inline-flex items-center gap-2 hover:brightness-110 disabled:opacity-60">
                <Icon name="cloud_upload" />{importMut.isPending ? "Importing…" : `Import ${validDrafts.length} candidates`}
              </button>
            </div>
          )}
        </div>

        <footer className="px-6 py-3 border-t border-outline-variant flex items-center justify-between shrink-0">
          <div className="text-xs text-on-surface-variant">Step {step + 1} of {STEPS.length}</div>
          <div className="flex items-center gap-2">
            <button onClick={close} className="px-3 py-1.5 text-sm font-medium text-on-surface-variant hover:bg-surface-container rounded-md">Cancel</button>
            <button onClick={() => setStep((s) => Math.max(0, s - 1))} disabled={step === 0} className="px-3 py-1.5 text-sm font-medium border border-outline-variant rounded-md disabled:opacity-40 inline-flex items-center gap-1"><Icon name="arrow_back" className="text-base" />Back</button>
            {step < 3 && (
              <button
                onClick={() => {
                  if (step === 0) toast.error("Choose a CSV file");
                  else if (step === 1) applyMapping();
                  else if (step === 2) setStep(3);
                }}
                disabled={step === 0 && rawRows.length === 0}
                className="px-4 py-1.5 text-sm font-semibold bg-primary text-on-primary rounded-md disabled:opacity-40 inline-flex items-center gap-1.5"
              >
                Continue <Icon name="arrow_forward" className="text-base" />
              </button>
            )}
          </div>
        </footer>
      </DialogContent>
    </Dialog>
  );
}
