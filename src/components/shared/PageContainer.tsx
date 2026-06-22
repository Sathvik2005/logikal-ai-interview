import type { ReactNode } from "react";

interface PageContainerProps {
  children: ReactNode;
  className?: string;
}

export function PageContainer({ children, className = "" }: PageContainerProps) {
  return <div className={`page-container py-lg ${className}`}>{children}</div>;
}

interface SectionHeaderProps {
  title: ReactNode;
  subtitle?: ReactNode;
  actions?: ReactNode;
  className?: string;
}

export function SectionHeader({ title, subtitle, actions, className = "" }: SectionHeaderProps) {
  return (
    <div className={`flex flex-wrap items-start justify-between gap-md mb-lg ${className}`}>
      <div className="min-w-0">
        <h2 className="text-headline-lg text-on-background">{title}</h2>
        {subtitle && <p className="text-body-lg text-on-surface-variant mt-1">{subtitle}</p>}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-sm shrink-0">{actions}</div>}
    </div>
  );
}
