import type { ReactNode } from "react";

export function EmptyState({
  icon = "inbox",
  title,
  description,
  hint,
  action,
  secondaryAction,
  className = "",
}: {
  icon?: string | ReactNode;
  title: ReactNode;
  description?: ReactNode;
  hint?: ReactNode;
  action?: ReactNode;
  secondaryAction?: ReactNode;
  className?: string;
}) {
  const contentDescription = description ?? hint;

  return (
    <div
      className={`flex flex-col items-center justify-center text-center py-10 px-4 sm:py-16 sm:px-6 w-full max-w-[620px] mx-auto select-none ${className}`}
    >
      {/* Icon Container */}
      {icon && (
        <div className="w-16 h-16 rounded-2xl bg-surface-container-low border border-outline-variant/60 flex items-center justify-center text-on-surface-variant shadow-soft mb-6 hover:scale-[1.03] hover:border-primary/25 hover:bg-surface-container transition-all duration-300 shrink-0">
          {typeof icon === "string" ? (
            <span
              className="material-symbols-outlined text-[32px] text-on-surface-variant/80"
              aria-hidden
            >
              {icon}
            </span>
          ) : (
            icon
          )}
        </div>
      )}

      {/* Title */}
      <h3 className="text-headline-sm sm:text-headline-md font-bold text-on-surface tracking-tight leading-snug w-full">
        {title}
      </h3>

      {/* Description */}
      {contentDescription && (
        <div className="text-body-md text-on-surface-variant leading-relaxed max-w-[460px] mx-auto mt-2 w-full">
          {contentDescription}
        </div>
      )}

      {/* Actions */}
      {(action || secondaryAction) && (
        <div className="flex flex-col sm:flex-row items-center justify-center gap-3 mt-6 w-full sm:w-auto">
          {action}
          {secondaryAction}
        </div>
      )}
    </div>
  );
}
