import { Link, Outlet, useRouterState, useNavigate } from "@tanstack/react-router";
import { useAuth } from "@/hooks/use-auth";
import { supabase } from "@/integrations/supabase/client";
import type { ReactNode } from "react";
import { MobileNav } from "@/components/shared/MobileNav";
import { UserMenu } from "@/components/shared/UserMenu";

const NAV = [
  { to: "/admin", icon: "shield_person", label: "Control Center" },
  { to: "/admin/organizations", icon: "domain", label: "Organizations" },
  { to: "/admin/organizations/intelligence", icon: "insights", label: "Org Intelligence" },
  { to: "/admin/security", icon: "verified_user", label: "Security" },
  { to: "/admin/settings", icon: "settings", label: "Workspace" },
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

export function AdminShell() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const isActive = (to: string) => {
    if (to === "/admin") return pathname === "/admin";
    if (to === "/admin/organizations")
      return (
        pathname === "/admin/organizations" ||
        (pathname.startsWith("/admin/organizations/") && !pathname.includes("/intelligence"))
      );
    return pathname.startsWith(to);
  };

  const signOut = async () => {
    await supabase.auth.signOut();
    navigate({ to: "/" });
  };

  return (
    <div className="bg-background text-on-background min-h-screen flex">
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:absolute focus:z-50 focus:m-2 focus:rounded-lg focus:bg-primary focus:px-4 focus:py-2 focus:text-on-primary"
      >
        Skip to content
      </a>
      <aside className="hidden md:flex flex-col h-screen sticky left-0 top-0 w-64 bg-surface border-r border-outline-variant p-md">
        <div className="mb-lg">
          <Link
            to="/admin"
            className="font-headline-md text-headline-md font-bold text-primary block"
          >
            Logikality AI
          </Link>
          <p className="text-body-md text-on-surface-variant mt-1">Admin Console</p>
        </div>
        <Link
          to="/admin/organizations"
          className="w-full bg-primary text-on-primary py-2 px-4 rounded-lg text-headline-sm font-semibold mb-lg hover:brightness-110 transition text-center"
        >
          New Organization
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
              rootPath="/admin"
              brand="Logikality AI"
              subtitle="Admin Console"
            />
            <Link to="/admin" className="text-headline-sm font-black text-on-surface">
              Logikality AI
            </Link>
          </div>
          <div className="flex-1 flex justify-start px-4 md:px-8"></div>
          <div className="flex items-center gap-2">
            <Link
              to="/admin/security"
              className="p-2 rounded-full text-on-surface-variant hover:bg-surface-container-low"
              aria-label="Security"
            >
              <Icon name="security" />
            </Link>
            <Link
              to="/admin/settings"
              className="p-2 rounded-full text-on-surface-variant hover:bg-surface-container-low"
              aria-label="Settings"
            >
              <Icon name="settings" />
            </Link>

            <UserMenu />
          </div>
        </header>

        <main
          id="main-content"
          tabIndex={-1}
          className="flex-1 overflow-y-auto p-4 md:p-lg lg:p-xl max-w-container-max mx-auto w-full"
        >
          <Outlet />
        </main>
      </div>
    </div>
  );
}
