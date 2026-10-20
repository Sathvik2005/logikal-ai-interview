import { useEffect, useState } from "react";
import type { Session, User } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";

export type AppRole = "admin" | "recruiter" | "candidate";

const ROLE_PRIORITY: AppRole[] = ["admin", "recruiter", "candidate"];

/** A user can hold several role rows; use the most privileged one (never fail on multiple rows). */
async function fetchRole(userId: string): Promise<AppRole> {
  const { data } = await supabase.from("user_roles").select("role").eq("user_id", userId);
  const held = new Set((data ?? []).map((r) => r.role as AppRole));
  return ROLE_PRIORITY.find((r) => held.has(r)) ?? "candidate";
}

export function useAuth() {
  const [session, setSession] = useState<Session | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [role, setRole] = useState<AppRole | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, s) => {
      setSession(s);
      setUser(s?.user ?? null);
      if (s?.user) {
        setTimeout(async () => {
          setRole(await fetchRole(s.user.id));
        }, 0);
      } else {
        setRole(null);
      }
    });
    supabase.auth.getSession().then(async ({ data: { session: s } }) => {
      setSession(s);
      setUser(s?.user ?? null);
      if (s?.user) {
        setRole(await fetchRole(s.user.id));
      }
      setLoading(false);
    });
    return () => subscription.unsubscribe();
  }, []);

  return { session, user, role, loading };
}

export function roleHome(role: AppRole | null): string {
  if (role === "admin") return "/admin";
  if (role === "recruiter") return "/recruiter";
  return "/candidate/prepare";
}
