import type { ReactNode } from "react";

interface StatCardProps {
  label: string;
  value: ReactNode;
  hint?: ReactNode;
  icon?: string;
  tone?: "primary" | "success" | "warning" | "error" | "secondary" | "default";
  trend?: { value: number; label?: string };
  className?: string;
}

const toneClasses: Record<NonNullable<StatCardProps["tone"]>, string> = {
  primary: "text-primary bg-primary-container",
  success: "text-[#166534] bg-[#dcfce7]",
  warning: "text-[#854d0e] bg-[#fef9c3]",
  error: "text-error bg-error-container",
  secondary: "text-secondary bg-secondary-container",
  default: "text-on-surface-variant bg-surface-container",
};

export function StatCard({ label, value, hint, icon, tone = "default", trend, className = "" }: StatCardProps) {
  return (
    <div className={`stat-card flex flex-col justify-between min-h-[120px] ${className}`}>
      <div>
        <div className="flex items-start justify-between mb-2">
          <p className="text-label-caps uppercase text-on-surface-variant tracking-wider leading-none">{label}</p>
          {icon && (
            <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${toneClasses[tone]}`}>
              <span className="material-symbols-outlined text-[18px]">{icon}</span>
            </div>
          )}
        </div>
        <div className="text-headline-lg font-bold text-on-background leading-none mt-1">{value}</div>
      </div>
      {(hint || trend) && (
        <div className="flex items-center justify-between mt-3 pt-2 border-t border-outline-variant/30">
          {hint && <p className="text-data-mono text-on-surface-variant text-[12px]">{hint}</p>}
          {trend && (
            <span className={`text-label-caps font-semibold ${trend.value >= 0 ? "text-[#166534]" : "text-error"}`}>
              {trend.value >= 0 ? "↑" : "↓"} {Math.abs(trend.value)}%{trend.label ? ` ${trend.label}` : ""}
            </span>
          )}
        </div>
      )}
    </div>
  );
}
