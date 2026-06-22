import { useState, useRef } from "react";
import { toast } from "sonner";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Icon } from "@/components/recruiter/RecruiterShell";
import { bulkUpsertQuestions, parseQuestionsFromPdf } from "@/lib/question-bank.functions";
import { questionsKeys } from "@/components/recruiter/use-questions";

type Mode = "manual" | "pdf" | "hybrid";

type DraftQ = { id: string; prompt: string; category: string; difficulty: "easy" | "medium" | "hard"; mandatory: boolean; hints: string[] };

const STEPS = ["Mode", "Bank info", "Questions", "Save"] as const;
const CATEGORIES = ["Technical", "Behavioral", "Compliance", "Situational", "Coding"] as const;

function uid() { return Math.random().toString(36).slice(2, 9); }

function blankQ(): DraftQ {
  return { id: uid(), prompt: "", category: "Technical", difficulty: "medium", mandatory: false, hints: [] };
}

export function QuestionBankWizard({
  open,
  onOpenChange,
  defaultCompetency = "",
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  defaultCompetency?: string;
}) {
  const [step, setStep] = useState(0);
  const [mode, setMode] = useState<Mode>("manual");
  const [bankName, setBankName] = useState("");
  const [competency, setCompetency] = useState(defaultCompetency);
  const [items, setItems] = useState<DraftQ[]>([blankQ()]);
  const [parsing, setParsing] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const qc = useQueryClient();

  const parseFn = useServerFn(parseQuestionsFromPdf);
  const saveFn = useServerFn(bulkUpsertQuestions);

  const save = useMutation({
    mutationFn: () => saveFn({ data: { bankName: bankName.trim(), competency: competency.trim(), questions: items.filter((i) => i.prompt.trim().length >= 4).map(({ id: _id, ...rest }) => rest) } }),
    onSuccess: (res) => {
      toast.success(`Saved ${res.count} question${res.count === 1 ? "" : "s"}`);
      qc.invalidateQueries({ queryKey: questionsKeys.all });
      close();
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Save failed"),
  });

  function close() {
    onOpenChange(false);
    setTimeout(() => {
      setStep(0); setMode("manual"); setBankName(""); setCompetency(defaultCompetency); setItems([blankQ()]);
    }, 200);
  }

  function update(id: string, patch: Partial<DraftQ>) {
    setItems((xs) => xs.map((x) => (x.id === id ? { ...x, ...patch } : x)));
  }
  function remove(id: string) { setItems((xs) => xs.filter((x) => x.id !== id)); }
  function move(id: string, dir: -1 | 1) {
    setItems((xs) => {
      const i = xs.findIndex((x) => x.id === id);
      if (i < 0) return xs;
      const j = i + dir;
      if (j < 0 || j >= xs.length) return xs;
      const out = xs.slice();
      [out[i], out[j]] = [out[j], out[i]];
      return out;
    });
  }

  async function onPdf(f: File) {
    if (f.size > 8 * 1024 * 1024) { toast.error("PDF too large (max 8MB)"); return; }
    setParsing(true);
    try {
      const buf = await f.arrayBuffer();
      // base64 encode
      const bytes = new Uint8Array(buf);
      let binary = "";
      const chunk = 0x8000;
      for (let i = 0; i < bytes.length; i += chunk) {
        binary += String.fromCharCode(...bytes.subarray(i, i + chunk));
      }
      const b64 = btoa(binary);
      const res = await parseFn({ data: { filename: f.name, base64: b64 } });
      if (!res.questions.length) {
        toast.error("No questions extracted from PDF");
      } else {
        const draft: DraftQ[] = res.questions.map((q) => ({ id: uid(), prompt: q.prompt, category: q.category ?? "Technical", difficulty: q.difficulty ?? "medium", mandatory: q.mandatory ?? false, hints: q.hints ?? [] }));
        setItems((cur) => mode === "hybrid" ? [...cur.filter((c) => c.prompt.trim()), ...draft] : draft);
        toast.success(`Extracted ${res.questions.length} questions`);
      }
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "PDF parsing failed");
    } finally {
      setParsing(false);
    }
  }

  const canSave = bankName.trim().length >= 2 && competency.trim().length >= 2 && items.some((i) => i.prompt.trim().length >= 4);

  return (
    <Dialog open={open} onOpenChange={(o) => (o ? onOpenChange(true) : close())}>
      <DialogContent className="p-0 gap-0 bg-white border border-outline-variant shadow-2xl rounded-2xl overflow-hidden max-w-[1024px] w-[96vw] max-h-[90vh] flex flex-col [&>button]:hidden">
        <header className="px-6 py-3.5 border-b border-outline-variant flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <span className="w-9 h-9 rounded-lg bg-primary text-on-primary flex items-center justify-center"><Icon name="quiz" /></span>
            <div>
              <h2 className="text-[15px] font-semibold">Create Question Bank</h2>
              <p className="text-xs text-on-surface-variant">Manually, from PDF, or both.</p>
            </div>
          </div>
          <button onClick={close} className="p-1.5 text-on-surface-variant hover:bg-surface-container rounded-md" aria-label="Close"><Icon name="close" className="text-base" /></button>
        </header>

        <div className="px-6 pt-4 pb-3 border-b border-outline-variant bg-gradient-to-b from-surface-container-low/80 to-white shrink-0">
          <ol className="flex items-center">
            {STEPS.map((s, i) => {
              const active = i === step;
              const done = i < step;
              return (
                <li key={s} className="flex items-center flex-1 last:flex-none min-w-0">
                  <div className="flex items-center gap-2">
                    <span className={`w-7 h-7 rounded-full flex items-center justify-center text-[11px] font-semibold border ${active ? "bg-primary border-primary text-on-primary" : done ? "bg-secondary border-secondary text-on-primary" : "bg-white border-outline-variant text-outline"}`}>{done ? <Icon name="check" className="text-[15px]" /> : i + 1}</span>
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
            <div className="grid md:grid-cols-3 gap-4">
              {([
                { id: "manual" as Mode, icon: "edit_note", title: "Manual entry", hint: "Write each question yourself" },
                { id: "pdf" as Mode, icon: "picture_as_pdf", title: "PDF upload", hint: "Extract from an existing document" },
                { id: "hybrid" as Mode, icon: "merge_type", title: "Hybrid", hint: "Start from PDF, then refine manually" },
              ]).map((m) => {
                const selected = mode === m.id;
                return (
                  <button key={m.id} onClick={() => setMode(m.id)} className={`text-left p-4 rounded-xl border transition ${selected ? "border-primary bg-primary-fixed/60 ring-2 ring-primary-container/40" : "border-outline-variant hover:bg-surface-container-low"}`}>
                    <span className={`w-10 h-10 rounded-lg flex items-center justify-center mb-3 ${selected ? "bg-primary text-on-primary" : "bg-surface-container text-on-surface-variant"}`}><Icon name={m.icon} /></span>
                    <p className="font-semibold">{m.title}</p>
                    <p className="text-body-md text-on-surface-variant">{m.hint}</p>
                  </button>
                );
              })}
            </div>
          )}

          {step === 1 && (
            <div className="grid sm:grid-cols-2 gap-4 max-w-2xl">
              <label className="block">
                <span className="block text-xs font-semibold mb-1.5">Bank name *</span>
                <input className="w-full px-3 py-2 border border-outline-variant rounded-lg text-sm" placeholder="e.g. Senior Backend 2026" value={bankName} onChange={(e) => setBankName(e.target.value)} />
              </label>
              <label className="block">
                <span className="block text-xs font-semibold mb-1.5">Competency *</span>
                <input className="w-full px-3 py-2 border border-outline-variant rounded-lg text-sm" placeholder="e.g. System Design" value={competency} onChange={(e) => setCompetency(e.target.value)} />
              </label>
            </div>
          )}

          {step === 2 && (
            <div>
              {(mode === "pdf" || mode === "hybrid") && (
                <div className="mb-4 p-4 border border-dashed border-outline-variant rounded-xl bg-surface-container-lowest flex items-center justify-between flex-wrap gap-3">
                  <div>
                    <p className="font-semibold">Upload a PDF</p>
                    <p className="text-body-md text-on-surface-variant">We'll extract questions and let you edit them below.</p>
                  </div>
                  <div>
                    <input ref={fileRef} type="file" accept="application/pdf" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) onPdf(f); }} />
                    <button onClick={() => fileRef.current?.click()} disabled={parsing} className="px-4 py-2 bg-primary text-on-primary rounded-lg inline-flex items-center gap-2 disabled:opacity-60"><Icon name="upload_file" />{parsing ? "Parsing…" : "Choose PDF"}</button>
                  </div>
                </div>
              )}

              <div className="space-y-3">
                {items.map((q, idx) => (
                  <div key={q.id} className="border border-outline-variant rounded-xl p-3">
                    <div className="flex items-start gap-2">
                      <div className="flex flex-col">
                        <button onClick={() => move(q.id, -1)} disabled={idx === 0} className="p-1 text-on-surface-variant disabled:opacity-30"><Icon name="arrow_upward" className="text-sm" /></button>
                        <button onClick={() => move(q.id, 1)} disabled={idx === items.length - 1} className="p-1 text-on-surface-variant disabled:opacity-30"><Icon name="arrow_downward" className="text-sm" /></button>
                      </div>
                      <div className="flex-1 space-y-2">
                        <textarea className="w-full px-3 py-2 border border-outline-variant rounded-lg text-sm" rows={2} placeholder="Question prompt…" value={q.prompt} onChange={(e) => update(q.id, { prompt: e.target.value })} />
                        <div className="flex flex-wrap gap-2">
                          <select className="px-2 py-1 border border-outline-variant rounded text-sm" value={q.category} onChange={(e) => update(q.id, { category: e.target.value })}>
                            {CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
                          </select>
                          <select className="px-2 py-1 border border-outline-variant rounded text-sm" value={q.difficulty} onChange={(e) => update(q.id, { difficulty: e.target.value as "easy" | "medium" | "hard" })}>
                            <option value="easy">Easy</option><option value="medium">Medium</option><option value="hard">Hard</option>
                          </select>
                          <label className="flex items-center gap-1 text-sm">
                            <input type="checkbox" checked={q.mandatory} onChange={(e) => update(q.id, { mandatory: e.target.checked })} /> Mandatory
                          </label>
                          <input className="flex-1 min-w-[200px] px-2 py-1 border border-outline-variant rounded text-sm" placeholder="Expected hints (comma separated)" value={q.hints.join(", ")} onChange={(e) => update(q.id, { hints: e.target.value.split(",").map((s) => s.trim()).filter(Boolean) })} />
                        </div>
                      </div>
                      <button onClick={() => remove(q.id)} className="p-1 text-on-surface-variant hover:text-error" aria-label="Delete"><Icon name="delete" /></button>
                    </div>
                  </div>
                ))}
              </div>
              <button onClick={() => setItems((xs) => [...xs, blankQ()])} className="mt-3 px-3 py-2 border border-dashed border-outline-variant rounded-lg text-body-md inline-flex items-center gap-2 hover:bg-surface-container-low"><Icon name="add" />Add question</button>
            </div>
          )}

          {step === 3 && (
            <div className="max-w-xl mx-auto text-center py-6">
              <div className="w-16 h-16 mx-auto rounded-full bg-primary-container text-on-primary-container flex items-center justify-center mb-4"><Icon name="check_circle" /></div>
              <h3 className="text-headline-sm mb-2">Save bank "{bankName || "Untitled"}"</h3>
              <p className="text-body-md text-on-surface-variant mb-4">{items.filter((i) => i.prompt.trim().length >= 4).length} question{items.length === 1 ? "" : "s"} will be added to competency <strong>{competency || "—"}</strong>.</p>
              <button onClick={() => save.mutate()} disabled={!canSave || save.isPending} className="px-5 py-2.5 bg-primary text-on-primary rounded-lg font-semibold inline-flex items-center gap-2 disabled:opacity-60"><Icon name="save" />{save.isPending ? "Saving…" : "Save bank"}</button>
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
                  if (step === 1 && (bankName.trim().length < 2 || competency.trim().length < 2)) { toast.error("Bank name and competency required"); return; }
                  setStep((s) => Math.min(3, s + 1));
                }}
                className="px-4 py-1.5 text-sm font-semibold bg-primary text-on-primary rounded-md inline-flex items-center gap-1.5"
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
