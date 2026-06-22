import { Link, Outlet, useRouterState, useNavigate } from "@tanstack/react-router";
import { useAuth } from "@/hooks/use-auth";
import { supabase } from "@/integrations/supabase/client";
import type { ReactNode } from "react";
import { MobileNav } from "@/components/shared/MobileNav";

type NavItem = { to: string; icon: string; label: string };

const NAV: NavItem[] = [
  { to: "/recruiter", icon: "dashboard", label: "Dashboard" },
  { to: "/recruiter/candidates", icon: "groups", label: "Candidates" },
  { to: "/recruiter/personas", icon: "psychology", label: "Persona Builder" },
  { to: "/recruiter/jobs", icon: "description", label: "JD Builder" },
  { to: "/recruiter/questions", icon: "quiz", label: "Question Bank" },
  { to: "/recruiter/scheduling", icon: "calendar_today", label: "Scheduling" },
  { to: "/recruiter/monitor", icon: "video_chat", label: "Interview Monitor" },
  { to: "/recruiter/reports", icon: "analytics", label: "AI Reports" },
  { to: "/recruiter/analytics", icon: "monitoring", label: "Analytics" },
];

export function Icon({ name, className = "", filled = false }: { name: string; className?: string; filled?: boolean }) {
  return (
    <span className={`material-symbols-outlined ${filled ? "icon-fill" : ""} ${className}`} aria-hidden>
      {name}
    </span>
  );
}

export function CardShadow({ children, className = "" }: { children: ReactNode; className?: string }) {
  return <div className={`bg-surface-container-lowest rounded-xl border border-outline-variant shadow-soft ${className}`}>{children}</div>;
}

export function PageHeader({
  title,
  subtitle,
  actions,
  className = "",
}: {
  title: ReactNode;
  subtitle?: ReactNode;
  actions?: ReactNode;
  className?: string;
}) {
  return (
    <header
      className={`mb-lg grid grid-cols-[minmax(0,1fr)_auto] items-start gap-md sm:flex sm:flex-wrap sm:items-center sm:justify-between ${className}`}
    >
      <div className="min-w-0">
        <h2 className="text-headline-lg text-on-background truncate">{title}</h2>
        {subtitle ? <p className="text-body-lg text-on-surface-variant mt-1">{subtitle}</p> : null}
      </div>
      {actions ? <div className="flex flex-wrap items-center gap-sm shrink-0">{actions}</div> : null}
    </header>
  );
}

export function EmptyState({
  icon = "inbox",
  title,
  hint,
  action,
  className = "",
}: {
  icon?: string;
  title: ReactNode;
  hint?: ReactNode;
  action?: ReactNode;
  className?: string;
}) {
  return (
    <div className={`flex flex-col items-center justify-center text-center px-lg py-xl gap-sm ${className}`}>
      <div className="w-12 h-12 rounded-full bg-surface-container flex items-center justify-center text-on-surface-variant">
        <Icon name={icon} />
      </div>
      <p className="text-headline-sm text-on-surface">{title}</p>
      {hint ? <p className="text-body-md text-on-surface-variant max-w-sm">{hint}</p> : null}
      {action ? <div className="mt-sm">{action}</div> : null}
    </div>
  );
}

export function SkeletonCard({ rows = 3, className = "" }: { rows?: number; className?: string }) {
  return (
    <div className={`p-lg space-y-3 ${className}`} aria-hidden>
      <div className="h-4 w-1/3 rounded bg-surface-container animate-pulse" />
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="h-3 w-full rounded bg-surface-container-low animate-pulse" />
      ))}
    </div>
  );
}

export function LoadingRow({ label = "Loading…" }: { label?: string }) {
  return (
    <div className="p-lg flex items-center gap-sm text-body-md text-on-surface-variant">
      <span className="w-3 h-3 rounded-full bg-primary/30 animate-pulse" />
      {label}
    </div>
  );
}

export function RecruiterShell() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const pathname = useRouterState({ select: (s) => s.location.pathname });

  const isActive = (to: string) => (to === "/recruiter" ? pathname === "/recruiter" : pathname.startsWith(to));

  const signOut = async () => {
    await supabase.auth.signOut();
    navigate({ to: "/" });
  };

  return (
    <div className="bg-background text-on-background min-h-screen flex">
      <aside className="hidden md:flex flex-col h-screen sticky left-0 top-0 w-64 bg-surface border-r border-outline-variant p-md">
        <div className="mb-lg">
          <Link to="/recruiter" className="font-headline-md text-headline-md font-bold text-primary block">Logikality AI</Link>
          <p className="text-body-md text-on-surface-variant mt-1">Enterprise Plan</p>
        </div>
        <Link
          to="/recruiter/scheduling"
          className="w-full bg-primary text-on-primary py-2 px-4 rounded-lg text-headline-sm font-semibold mb-lg hover:brightness-110 transition text-center"
        >
          New Interview
        </Link>
        <nav className="flex-1 space-y-1 overflow-y-auto">
          {NAV.map((item) => (
            <Link
              key={item.to}
              to={item.to}
              className={`flex items-center gap-3 px-4 py-3 rounded-lg transition ${
                isActive(item.to)
                  ? "bg-primary-container text-on-primary-container font-semibold"
                  : "text-on-surface-variant hover:bg-surface-container-high"
              }`}
            >
              <Icon name={item.icon} filled={isActive(item.to)} />
              <span className="text-body-md">{item.label}</span>
            </Link>
          ))}
        </nav>
        <div className="mt-auto pt-4 border-t border-outline-variant space-y-1">
          <button
            type="button"
            onClick={signOut}
            className="w-full flex items-center gap-3 px-4 py-3 text-on-surface-variant hover:bg-surface-container-highest rounded-lg transition"
          >
            <Icon name="logout" />
            <span className="text-body-md">Sign out</span>
          </button>
        </div>
      </aside>

      <div className="flex-1 flex flex-col min-w-0">
        <header className="flex justify-between items-center h-16 px-lg w-full sticky top-0 z-40 bg-surface/80 backdrop-blur-md border-b border-outline-variant">
          <div className="flex items-center gap-2 md:hidden">
            <MobileNav items={NAV} rootPath="/recruiter" brand="Logikality AI" subtitle="Enterprise Plan" />
            <Link to="/recruiter" className="text-headline-sm font-black text-on-surface">Logikality AI</Link>
          </div>
          <div className="flex-1 flex justify-start px-4 md:px-8">
            <div className="relative w-full max-w-md hidden md:block">
              <Icon name="search" className="absolute left-3 top-1/2 -translate-y-1/2 text-outline" />
              <input
                className="w-full pl-10 pr-4 py-2 bg-surface-container-lowest border border-outline-variant rounded-full focus:ring-2 focus:ring-primary-container outline-none text-body-md"
                placeholder="Search candidates, reports..."
                type="search"
              />
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Link to="/recruiter/reports" className="p-2 rounded-full text-on-surface-variant hover:bg-surface-container-low" aria-label="Reports">
              <Icon name="notifications" />
            </Link>
            <Link to="/recruiter/analytics" className="p-2 rounded-full text-on-surface-variant hover:bg-surface-container-low" aria-label="History">
              <Icon name="history" />
            </Link>
            <div className="ml-2 flex items-center gap-2 px-3 py-1.5 rounded-full bg-surface-container-low">
              <div className="w-7 h-7 rounded-full bg-primary text-on-primary flex items-center justify-center text-label-caps font-semibold">
                {(user?.email ?? "S").charAt(0).toUpperCase()}
              </div>
              <span className="text-body-md text-on-surface hidden sm:block">{user?.email ?? "recruiter"}</span>
            </div>
          </div>
        </header>

        <main className="flex-1 overflow-y-auto p-4 md:p-lg lg:p-xl max-w-[1920px] mx-auto w-full">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
