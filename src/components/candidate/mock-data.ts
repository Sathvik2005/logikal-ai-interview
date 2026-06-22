export type UpcomingInterview = {
  id: string;
  role: string;
  company: string;
  persona: string;
  scheduledAt: string;
  duration: number;
  status: "scheduled" | "ready" | "in_progress" | "completed";
};

export type PastInterview = {
  id: string;
  role: string;
  company: string;
  date: string;
  score: number;
  recommendation: "Strong Hire" | "Hire" | "No Hire" | "Maybe";
};

export type TranscriptTurn = {
  t: string;
  speaker: "AI" | "You";
  text: string;
};

export const upcoming: UpcomingInterview[] = [
  {
    id: "iv-101",
    role: "Senior Frontend Engineer",
    company: "Acme Corp",
    persona: "Technical Deep-Dive",
    scheduledAt: "Tomorrow · 2:30 PM",
    duration: 45,
    status: "ready",
  },
  {
    id: "iv-102",
    role: "Product Manager",
    company: "Globex",
    persona: "Behavioral Interviewer",
    scheduledAt: "Jun 12 · 10:00 AM",
    duration: 30,
    status: "scheduled",
  },
];

export const past: PastInterview[] = [
  { id: "iv-090", role: "Full-Stack Engineer", company: "Initech", date: "May 28, 2026", score: 86, recommendation: "Strong Hire" },
  { id: "iv-088", role: "Backend Engineer", company: "Soylent", date: "May 12, 2026", score: 72, recommendation: "Hire" },
  { id: "iv-077", role: "Data Engineer", company: "Umbrella", date: "Apr 30, 2026", score: 64, recommendation: "Maybe" },
];

export const sampleTranscript: TranscriptTurn[] = [
  { t: "00:00", speaker: "AI", text: "Welcome Sarah! Let's start with a quick introduction. Tell me about your most recent role." },
  { t: "00:12", speaker: "You", text: "Sure — I led the frontend platform team at Initech, owning the design system and React performance." },
  { t: "00:48", speaker: "AI", text: "Great. Can you walk me through a recent technical challenge you solved?" },
  { t: "01:02", speaker: "You", text: "We migrated 200+ components to React Server Components and cut TTI by 40%." },
  { t: "01:55", speaker: "AI", text: "Impressive. How did you handle the team's learning curve?" },
  { t: "02:08", speaker: "You", text: "Pair programming, brown-bag sessions, and a phased rollout per surface area." },
  { t: "03:01", speaker: "AI", text: "Let's switch to system design. Design a real-time collaborative editor." },
];

export const notifications = [
  { id: "n1", icon: "event_available", title: "Interview confirmed", body: "Acme Corp · Senior Frontend Engineer — Tomorrow 2:30 PM", time: "2h ago", unread: true },
  { id: "n2", icon: "task_alt", title: "Report ready", body: "Your evaluation for Initech is now available.", time: "1d ago", unread: true },
  { id: "n3", icon: "campaign", title: "New persona assigned", body: "Recruiter added 'Technical Deep-Dive' to your upcoming session.", time: "2d ago", unread: false },
  { id: "n4", icon: "verified", title: "System check complete", body: "Camera, mic and bandwidth all passed.", time: "3d ago", unread: false },
];

export const kbArticles = [
  { id: "kb1", category: "Getting Started", title: "What to expect in an AI interview", read: "4 min" },
  { id: "kb2", category: "Getting Started", title: "Setting up your camera and microphone", read: "3 min" },
  { id: "kb3", category: "Best Practices", title: "Top 10 tips for behavioral questions", read: "7 min" },
  { id: "kb4", category: "Best Practices", title: "Whiteboarding remotely: a survival guide", read: "6 min" },
  { id: "kb5", category: "Technical", title: "Bandwidth and browser requirements", read: "2 min" },
  { id: "kb6", category: "Privacy", title: "How your interview data is used", read: "5 min" },
];
