import { Link, useNavigate } from "@tanstack/react-router";
import { useAuth, type AppRole } from "@/hooks/use-auth";
import { useOrgName } from "@/hooks/use-org";
import { supabase } from "@/integrations/supabase/client";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

const ROLE_LABEL: Record<AppRole, string> = {
  admin: "Administrator",
  recruiter: "Recruiter",
  candidate: "Candidate",
};

const CONSOLES: Array<{ to: string; label: string; icon: string; roles: AppRole[] }> = [
  { to: "/admin", label: "Admin console", icon: "shield_person", roles: ["admin"] },
  { to: "/recruiter", label: "Recruiter workspace", icon: "work", roles: ["admin", "recruiter"] },
  { to: "/candidate/prepare", label: "Candidate portal", icon: "person", roles: ["candidate"] },
];

/**
 * Account menu shared by every console: who is signed in, their role and tenant,
 * quick switching between the consoles their role may open, and sign-out.
 */
export function UserMenu() {
  const { user, role } = useAuth();
  const orgName = useOrgName(user?.id);
  const navigate = useNavigate();
  const email = user?.email ?? "account";
  const consoles = CONSOLES.filter((c) => role && c.roles.includes(role));

  const signOut = async () => {
    await supabase.auth.signOut();
    navigate({ to: "/" });
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        className="ml-2 flex items-center gap-2 px-3 py-1.5 rounded-full bg-surface-container-low hover:bg-surface-container focus:outline-none focus:ring-2 focus:ring-primary-container"
        aria-label="Account menu"
      >
        <span className="w-7 h-7 rounded-full bg-primary text-on-primary flex items-center justify-center text-label-caps font-semibold">
          {email.charAt(0).toUpperCase()}
        </span>
        <span className="hidden sm:flex flex-col items-start leading-tight text-left">
          <span className="text-body-md text-on-surface max-w-[180px] truncate">{email}</span>
          <span className="text-label-caps text-on-surface-variant">
            {role ? ROLE_LABEL[role] : "…"}
            {orgName ? ` · ${orgName}` : ""}
          </span>
        </span>
        <span className="material-symbols-outlined text-on-surface-variant" aria-hidden>
          expand_more
        </span>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-64">
        <DropdownMenuLabel className="font-normal">
          <p className="text-body-md font-semibold truncate">{email}</p>
          <p className="text-label-caps text-on-surface-variant">{role ? ROLE_LABEL[role] : ""}</p>
          {orgName ? (
            <p className="text-body-md text-on-surface-variant flex items-center gap-1 mt-1">
              <span className="material-symbols-outlined text-[16px]" aria-hidden>
                domain
              </span>
              {orgName}
            </p>
          ) : null}
        </DropdownMenuLabel>
        {consoles.length > 1 ? (
          <>
            <DropdownMenuSeparator />
            <DropdownMenuLabel className="text-label-caps text-on-surface-variant">
              Switch workspace
            </DropdownMenuLabel>
            {consoles.map((c) => (
              <DropdownMenuItem key={c.to} asChild>
                <Link to={c.to} className="flex items-center gap-2 cursor-pointer">
                  <span className="material-symbols-outlined text-[18px]" aria-hidden>
                    {c.icon}
                  </span>
                  {c.label}
                </Link>
              </DropdownMenuItem>
            ))}
          </>
        ) : null}
        <DropdownMenuSeparator />
        <DropdownMenuItem onSelect={signOut} className="flex items-center gap-2 cursor-pointer">
          <span className="material-symbols-outlined text-[18px]" aria-hidden>
            logout
          </span>
          Sign out
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
