import type { CandidateDTO } from "@/lib/candidates.functions";

export type MissingField = "phone" | "role" | "experienceYears" | "skills" | "resumeSummary";

export const FIELD_LABELS: Record<MissingField, string> = {
  phone: "Phone number",
  role: "Target role",
  experienceYears: "Years of experience",
  skills: "At least 3 skills",
  resumeSummary: "Resume summary (40+ chars)",
};

export function getMissingFields(
  c: Pick<CandidateDTO, "phone" | "role" | "experienceYears" | "skills" | "resumeSummary">,
): MissingField[] {
  const missing: MissingField[] = [];
  if (!c.phone || c.phone.trim().length < 5) missing.push("phone");
  if (!c.role || c.role.trim().length === 0) missing.push("role");
  if (!c.experienceYears || c.experienceYears <= 0) missing.push("experienceYears");
  if (!c.skills || c.skills.length < 3) missing.push("skills");
  if (!c.resumeSummary || c.resumeSummary.trim().length < 40) missing.push("resumeSummary");
  return missing;
}

export function isProfileComplete(c: Parameters<typeof getMissingFields>[0]): boolean {
  return getMissingFields(c).length === 0;
}

export function completenessPct(c: Parameters<typeof getMissingFields>[0]): number {
  const total = 5;
  const filled = total - getMissingFields(c).length;
  return Math.round((filled / total) * 100);
}
