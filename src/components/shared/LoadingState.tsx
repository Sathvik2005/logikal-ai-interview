export function LoadingState({
  variant = "card",
  label = "Loading…",
}: {
  variant?: "card" | "table" | "detail" | "inline";
  label?: string;
}) {
  if (variant === "inline") {
    return (
      <div className="flex items-center gap-2 text-on-surface-variant text-body-md py-md" role="status" aria-live="polite">
        <span className="material-symbols-outlined animate-spin" aria-hidden>progress_activity</span>
        <span>{label}</span>
      </div>
    );
  }

  const rows = variant === "table" ? 6 : variant === "detail" ? 4 : 3;

  return (
    <div className="space-y-md" role="status" aria-live="polite" aria-label={label}>
      {variant === "card" && (
        <div className="grid gap-md sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: rows }).map((_, i) => (
            <div key={i} className="h-32 rounded-xl bg-surface-container animate-pulse" />
          ))}
        </div>
      )}
      {variant === "table" && (
        <div className="rounded-xl border border-outline-variant overflow-hidden">
          {Array.from({ length: rows }).map((_, i) => (
            <div key={i} className="h-12 bg-surface-container animate-pulse border-b border-outline-variant last:border-b-0" />
          ))}
        </div>
      )}
      {variant === "detail" && (
        <>
          <div className="h-8 w-1/3 rounded bg-surface-container animate-pulse" />
          <div className="h-40 rounded-xl bg-surface-container animate-pulse" />
          <div className="h-24 rounded-xl bg-surface-container animate-pulse" />
        </>
      )}
    </div>
  );
}
