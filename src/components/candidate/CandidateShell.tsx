import { Link, Outlet, useRouterState, useNavigate } from "@tanstack/react-router";
import { useAuth } from "@/hooks/use-auth";
import { supabase } from "@/integrations/supabase/client";
import type { ReactNode } from "react";
import { MobileNav } from "@/components/shared/MobileNav";

type NavItem = { to: string; icon: string; label: string };

const NAV: NavItem[] = [
  { to: "/candidate/prepare", icon: "checklist", label: "Prepare Interview" },
  { to: "/candidate/system-check", icon: "tune", label: "System Check" },
  { to: "/candidate/interview", icon: "videocam", label: "Interview Room" },
];

export function Icon({
  name,
  className = "",
  filled = false,
}: {
  name: string;
  className?: string;
  filled?: boolean;
}) {
  return (
    <span
      className={`material-symbols-outlined ${filled ? "icon-fill" : ""} ${className}`}
      aria-hidden
    >
      {name}
    </span>
  );
}

export function Card({ children, className = "" }: { children: ReactNode; className?: string }) {
  return (
    <div
      className={`bg-surface-container-lowest rounded-xl border border-outline-variant shadow-soft ${className}`}
    >
      {children}
    </div>
  );
}

export function CandidateShell() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const isActive = (to: string) => pathname.startsWith(to);

  const signOut = async () => {
    await supabase.auth.signOut();
    navigate({ to: "/" });
  };

  return (
    <div className="bg-background text-on-background min-h-screen flex">
      <aside className="hidden md:flex flex-col h-screen sticky left-0 top-0 w-64 bg-surface border-r border-outline-variant p-md">
        <div className="mb-lg">
          <Link
            to="/candidate/prepare"
            className="font-headline-md text-headline-md font-bold text-primary block"
          >
            Logikality AI
          </Link>
          <p className="text-body-md text-on-surface-variant mt-1">Candidate Portal</p>
        </div>
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
        <div className="mt-auto pt-4 border-t border-outline-variant">
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
            <MobileNav
              items={NAV}
              rootPath="/candidate/prepare"
              brand="Logikality AI"
              subtitle="Candidate Portal"
            />
            <Link to="/candidate/prepare" className="text-headline-sm font-black text-on-surface">
              Logikality AI
            </Link>
          </div>
          <div className="flex-1" />
          <div className="flex items-center gap-2">
            <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-surface-container-low">
              <div className="w-7 h-7 rounded-full bg-primary text-on-primary flex items-center justify-center text-label-caps font-semibold">
                {(user?.email ?? "C").charAt(0).toUpperCase()}
              </div>
              <span className="text-body-md text-on-surface hidden sm:block">
                {user?.email ?? "candidate"}
              </span>
            </div>
            <button
              type="button"
              onClick={signOut}
              className="md:hidden p-2 rounded-full text-on-surface-variant hover:bg-surface-container-low"
              aria-label="Sign out"
            >
              <Icon name="logout" />
            </button>
          </div>
        </header>

        <main className="flex-1 overflow-y-auto p-4 md:p-lg lg:p-xl max-w-[1920px] mx-auto w-full">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
