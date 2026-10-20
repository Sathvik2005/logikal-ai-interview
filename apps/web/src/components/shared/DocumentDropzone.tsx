import { useRef, useState } from "react";

const MAX_BYTES = 8 * 1024 * 1024;
const OK_EXT = [".pdf", ".docx", ".txt"];

export function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result).split(",")[1] ?? "");
    reader.onerror = () => reject(reader.error ?? new Error("Could not read the file"));
    reader.readAsDataURL(file);
  });
}

export function validateDocument(file: File): string | null {
  const name = file.name.toLowerCase();
  if (name.endsWith(".doc")) return "Old .doc files are not supported. Save it as .docx or PDF.";
  if (!OK_EXT.some((e) => name.endsWith(e))) return "Upload a PDF, DOCX or TXT file.";
  if (file.size > MAX_BYTES) return "That file is larger than 8 MB.";
  if (file.size === 0) return "That file is empty.";
  return null;
}

/**
 * Click-or-drop file picker for resumes / job descriptions.
 * Validates type and size, then hands the File to `onFile`. Shows a busy state while the parent works.
 */
export function DocumentDropzone({
  title,
  hint,
  busy = false,
  doneLabel,
  onFile,
  onError,
}: {
  title: string;
  hint: string;
  busy?: boolean;
  /** When set, shows a success state (e.g. the name of the file that was read). */
  doneLabel?: string | null;
  onFile: (file: File) => void;
  onError: (message: string) => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [over, setOver] = useState(false);

  const take = (file: File | undefined) => {
    if (!file) return;
    const problem = validateDocument(file);
    if (problem) return onError(problem);
    onFile(file);
  };

  return (
    <div
      onDragOver={(e) => {
        e.preventDefault();
        setOver(true);
      }}
      onDragLeave={() => setOver(false)}
      onDrop={(e) => {
        e.preventDefault();
        setOver(false);
        if (!busy) take(e.dataTransfer.files?.[0]);
      }}
      className={`rounded-xl border-2 border-dashed p-md transition ${
        over
          ? "border-primary bg-primary-container/10"
          : doneLabel
            ? "border-[#86efac] bg-[#f0fdf4]"
            : "border-outline-variant bg-surface-container-low"
      }`}
    >
      <input
        ref={inputRef}
        type="file"
        accept=".pdf,.docx,.txt,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document,text/plain"
        className="sr-only"
        aria-label={title}
        onChange={(e) => {
          take(e.target.files?.[0]);
          e.target.value = ""; // allow choosing the same file again
        }}
      />
      <div className="flex items-center gap-md">
        <span className="material-symbols-outlined text-primary text-[28px]" aria-hidden>
          {busy ? "hourglass_top" : doneLabel ? "task_alt" : "upload_file"}
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-body-md font-semibold text-on-background">{title}</p>
          <p className="text-body-md text-on-surface-variant" aria-live="polite">
            {busy
              ? "Reading the document…"
              : doneLabel
                ? `Filled from ${doneLabel} — please review.`
                : hint}
          </p>
        </div>
        <button
          type="button"
          disabled={busy}
          onClick={() => inputRef.current?.click()}
          className="shrink-0 rounded-lg border border-outline-variant bg-surface-container-lowest px-3 py-2 text-body-md font-semibold hover:bg-surface-container-low disabled:opacity-50"
        >
          {doneLabel ? "Replace file" : "Choose file"}
        </button>
      </div>
    </div>
  );
}
