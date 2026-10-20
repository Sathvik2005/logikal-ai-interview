export type Org = {
  id: string;
  name: string;
  industry: string;
  size: string;
  plan: "Starter" | "Growth" | "Enterprise";
  status: "active" | "trial" | "suspended";
  seatsUsed: number;
  seatsTotal: number;
  mrr: number;
  recruiters: number;
  interviewsThisMonth: number;
};

export const orgs: Org[] = [
  {
    id: "org-1",
    name: "Acme Corp",
    industry: "SaaS",
    size: "501-1000",
    plan: "Enterprise",
    status: "active",
    seatsUsed: 87,
    seatsTotal: 100,
    mrr: 8400,
    recruiters: 12,
    interviewsThisMonth: 142,
  },
  {
    id: "org-2",
    name: "Globex",
    industry: "Finance",
    size: "1000+",
    plan: "Enterprise",
    status: "active",
    seatsUsed: 245,
    seatsTotal: 300,
    mrr: 24000,
    recruiters: 28,
    interviewsThisMonth: 412,
  },
  {
    id: "org-3",
    name: "Initech",
    industry: "Enterprise IT",
    size: "201-500",
    plan: "Growth",
    status: "active",
    seatsUsed: 45,
    seatsTotal: 50,
    mrr: 2100,
    recruiters: 6,
    interviewsThisMonth: 88,
  },
  {
    id: "org-4",
    name: "Umbrella",
    industry: "Healthcare",
    size: "501-1000",
    plan: "Growth",
    status: "trial",
    seatsUsed: 8,
    seatsTotal: 25,
    mrr: 0,
    recruiters: 2,
    interviewsThisMonth: 14,
  },
  {
    id: "org-5",
    name: "Soylent",
    industry: "Consumer",
    size: "51-200",
    plan: "Starter",
    status: "active",
    seatsUsed: 12,
    seatsTotal: 15,
    mrr: 450,
    recruiters: 3,
    interviewsThisMonth: 28,
  },
  {
    id: "org-6",
    name: "Wonka Industries",
    industry: "Manufacturing",
    size: "201-500",
    plan: "Growth",
    status: "suspended",
    seatsUsed: 0,
    seatsTotal: 40,
    mrr: 0,
    recruiters: 0,
    interviewsThisMonth: 0,
  },
];

export type SecurityEvent = {
  id: string;
  time: string;
  severity: "low" | "medium" | "high" | "critical";
  type: string;
  actor: string;
  ip: string;
  location: string;
};

export const securityEvents: SecurityEvent[] = [
  {
    id: "se-1",
    time: "2 min ago",
    severity: "high",
    type: "Failed login (×5)",
    actor: "unknown@acme.com",
    ip: "84.21.18.4",
    location: "Moscow, RU",
  },
  {
    id: "se-2",
    time: "12 min ago",
    severity: "medium",
    type: "MFA disabled",
    actor: "robert@globex.com",
    ip: "73.55.18.10",
    location: "Austin, US",
  },
  {
    id: "se-3",
    time: "1 hr ago",
    severity: "low",
    type: "Password changed",
    actor: "amanda@initech.com",
    ip: "192.0.2.55",
    location: "Seattle, US",
  },
  {
    id: "se-4",
    time: "3 hr ago",
    severity: "critical",
    type: "Service key access",
    actor: "system",
    ip: "10.0.0.4",
    location: "Edge",
  },
  {
    id: "se-5",
    time: "Yesterday",
    severity: "low",
    type: "New device sign-in",
    actor: "sarah@acme.com",
    ip: "98.43.18.4",
    location: "SF, US",
  },
];

export const auditLog = [
  {
    id: "al-1",
    actor: "you@logikality.ai",
    action: "Updated workspace settings",
    target: "branding",
    time: "10:31 AM",
  },
  {
    id: "al-2",
    actor: "you@logikality.ai",
    action: "Suspended organization",
    target: "Wonka Industries",
    time: "Yesterday",
  },
  {
    id: "al-3",
    actor: "admin@logikality.ai",
    action: "Promoted user",
    target: "sarah@acme.com → recruiter",
    time: "2d ago",
  },
  {
    id: "al-4",
    actor: "you@logikality.ai",
    action: "Created organization",
    target: "Umbrella (trial)",
    time: "5d ago",
  },
];

export const interviewTrend = [
  { d: "Mon", v: 412 },
  { d: "Tue", v: 489 },
  { d: "Wed", v: 532 },
  { d: "Thu", v: 478 },
  { d: "Fri", v: 601 },
  { d: "Sat", v: 144 },
  { d: "Sun", v: 98 },
];

export const personaUsageByIndustry = [
  { industry: "SaaS", technical: 68, behavioral: 22, cultural: 10 },
  { industry: "Finance", technical: 41, behavioral: 38, cultural: 21 },
  { industry: "Healthcare", technical: 28, behavioral: 49, cultural: 23 },
  { industry: "Consumer", technical: 22, behavioral: 41, cultural: 37 },
];

export const churnRisk = [
  { org: "Wonka Industries", reason: "0 logins / 14d", risk: "Critical" },
  { org: "Umbrella", reason: "Trial ends in 3d", risk: "High" },
  { org: "Soylent", reason: "Plan downgrade requested", risk: "Medium" },
];
