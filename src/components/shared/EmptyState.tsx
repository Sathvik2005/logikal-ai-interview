import type { ReactNode } from "react";

export function EmptyState({
  icon = "inbox",
  title,
  description,
  action,
  className = "",
}: {
  icon?: string;
  title: string;
  description?: string;
  action?: ReactNode;
  className?: string;
}) {
  return (
    <div className={`flex flex-col items-center justify-center text-center py-xl px-md ${className}`}>
      <div className="w-14 h-14 rounded-full bg-surface-container flex items-center justify-center mb-md">
        <span className="material-symbols-outlined text-on-surface-variant" aria-hidden>
          {icon}
        </span>
      </div>
      <h3 className="text-headline-sm font-headline-sm text-on-surface">{title}</h3>
      {description && (
        <p className="text-body-md text-on-surface-variant mt-1 max-w-sm">{description}</p>
      )}
      {action && <div className="mt-md">{action}</div>}
    </div>
  );
}
