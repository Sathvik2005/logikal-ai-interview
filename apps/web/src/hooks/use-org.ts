import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

/** Name of the tenant (organization) the signed-in user belongs to, or null if none/unreadable. */
export function useOrgName(userId: string | undefined) {
  const [orgName, setOrgName] = useState<string | null>(null);

  useEffect(() => {
    if (!userId) {
      setOrgName(null);
      return;
    }
    let cancelled = false;
    (async () => {
      const { data: profile } = await supabase
        .from("profiles")
        .select("org_id")
        .eq("id", userId)
        .maybeSingle();
      if (!profile?.org_id) return;
      const { data: org } = await supabase
        .from("organizations")
        .select("name")
        .eq("id", profile.org_id)
        .maybeSingle();
      if (!cancelled) setOrgName(org?.name ?? null);
    })().catch(() => {
      /* org name is cosmetic; ignore lookup failures */
    });
    return () => {
      cancelled = true;
    };
  }, [userId]);

  return orgName;
}
