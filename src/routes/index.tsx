import { createFileRoute, Link } from "@tanstack/react-router";
import { useState, useEffect, useRef, type ReactNode } from "react";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Lokality AI — Enterprise AI Recruitment Intelligence Platform" },
      {
        name: "description",
        content: "Automate the complete hiring lifecycle—from resume ingestion and matching to adaptive interviews, proctoring, explainable evaluations, and hiring decisions.",
      },
    ],
  }),
  component: Landing,
});

/* ─── Navigation Data ──────────────────────────────────────── */
type NavItemDetail = {
  label: string;
  desc: string;
  icon: string;
};

const NAV_MENU_DETAILS: Record<string, NavItemDetail[]> = {
  Platform: [
    { label: "Recruitment Dashboard", desc: "Your command center for active campaigns and applicant pipelines.", icon: "dashboard" },
    { label: "Candidate Intelligence", desc: "Deep profiles combining resumes, skills, and assessment histories.", icon: "person_search" },
    { label: "Interview Management", desc: "Configure interview parameters, duration, rubrics, and schedules.", icon: "video_chat" },
    { label: "Hiring Analytics", desc: "Track conversions, screening speed, consistency index, and time-to-hire.", icon: "analytics" },
  ],
  Products: [
    { label: "AI Resume Intelligence", desc: "Ingest, parse, and structure qualifications automatically.", icon: "description" },
    { label: "JD Matcher", desc: "Compare candidate skills against job descriptions semantically.", icon: "compare_arrows" },
    { label: "Adaptive Interview Engine", desc: "AI personas that conduct conversational, adaptive screening screens.", icon: "psychology" },
    { label: "Enterprise Proctoring", desc: "Integrity checks featuring facial monitoring, browser tab logs, and alerts.", icon: "security" },
    { label: "Explainable AI Reports", desc: "Scorecards with transcript-backed verbatim citations and weighting details.", icon: "summarize" },
  ],
  Workflows: [
    { label: "High Volume Screening", desc: "Filter thousands of incoming resumes instantly with zero bias.", icon: "bolt" },
    { label: "Technical Assessments", desc: "Evaluate complex system design, coding, or compliance with specialized personas.", icon: "code" },
    { label: "Behavioral STAR Screens", desc: "Structured situational questions probing soft skills and leadership values.", icon: "stars" },
    { label: "Campus & Graduate Hiring", desc: "Manage bulk assessment batches with live proctoring logs.", icon: "school" },
  ],
  "AI Intelligence": [
    { label: "Explainable AI (XAI)", desc: "Clear rating cards detailing how factors weight into the hiring recommendation.", icon: "account_tree" },
    { label: "Adaptive Persona Engine", desc: "Deploy domain-specific agents that probe details of candidate claims.", icon: "smart_toy" },
    { label: "Semantic JD Alignment", desc: "Beyond keywords—comprehend experience, seniority context, and fit.", icon: "hub" },
    { label: "Competency Mapping", desc: "Instantly translate resumes and profiles into standardized competency trees.", icon: "insights" },
  ],
  Enterprise: [
    { label: "Security & SOC 2 Compliance", desc: "Isolated multi-tenant architecture, data encryption, and compliance controls.", icon: "shield" },
    { label: "SSO & SAML", desc: "Integrate Okta, Azure AD, and custom single sign-on providers.", icon: "key" },
    { label: "Role-Based Access (RBAC)", desc: "Configure permissions for admins, recruiters, and hiring managers.", icon: "admin_panel_settings" },
    { label: "Audit Logs", desc: "Immutable trail of every evaluation access, parameter modification, and login.", icon: "receipt_long" },
  ],
  Resources: [
    { label: "Documentation", desc: "Developer API endpoints, configuration schemas, and quickstart guides.", icon: "menu_book" },
    { label: "Hiring Playbooks", desc: "Standard frameworks for building fair, persona-driven interview schedules.", icon: "library_books" },
    { label: "API Reference", desc: "Integrate Lokality AI directly into Greenhouse, Workday, Lever, or Ashby.", icon: "terminal" },
    { label: "Support Center", desc: "Access 24/7 dedicated support and customer success channels.", icon: "contact_support" },
  ],
};

/* ─── Hero Metrics ─────────────────────────────────────────── */
const HERO_METRICS = [
  { value: "100,000+", label: "Candidates Processed" },
  { value: "500+", label: "Concurrent AI Interviews" },
  { value: "10×", label: "Faster Candidate Screening" },
  { value: "85%", label: "Reduction in Time-to-Hire" },
  { value: "99.9%", label: "Platform Availability" },
  { value: "Enterprise", label: "Multi-Tenant Secure" },
];

/* ─── Hero Pipeline ────────────────────────────────────────── */
const PIPELINE_STAGES = [
  { id: "s1", label: "Candidate Applications", desc: "Candidates submit applications through branded portals, job boards, or direct scheduling links." },
  { id: "s2", label: "Resume Upload", desc: "Resumes are ingested, parsed, and converted to structured records immediately." },
  { id: "s3", label: "AI Resume Intelligence", desc: "AI extracts skills, experience years, key achievements, and certifications." },
  { id: "s4", label: "JD Match Score", desc: "Semantic analysis matches the candidate profile against job descriptions to compute alignment." },
  { id: "s5", label: "Candidate Ranking", desc: "Applicants are ranked by job fit, highlighting top talent instantly to recruiters." },
  { id: "s6", label: "Interview Assignment", desc: "Hiring workflows assign domain-specific AI interview personas and standard scoring rubrics." },
  { id: "s7", label: "AI Adaptive Interview", desc: "The assigned AI persona hosts a conversational screen, dynamically probing candidate answers." },
  { id: "s8", label: "Enterprise Proctoring", desc: "Webcam detection, audio alerts, and tab lock tracking maintain interview integrity." },
  { id: "s9", label: "Explainable AI Evaluation", desc: "AI generates a factor-weighted scorecard with candidate quotes citing verbatim transcript evidence." },
  { id: "s10", label: "Recruiter Review", desc: "Hiring managers review transcripts, recordings, and explainable recommendations in a structured dashboard." },
  { id: "s11", label: "Hiring Decision", desc: "Recruitment intelligence drives offer consensus, accelerating approval workflows." },
];

/* ─── Key Capabilities ─────────────────────────────────────── */
const CAPABILITIES = [
  {
    title: "AI Resume Intelligence",
    desc: "Automatically parse resumes, extract skills, experience, certifications, and project achievements, converting unstructured files into rich candidate data models.",
    icon: "description",
  },
  {
    title: "JD Intelligence",
    desc: "Perform deep semantic analysis matching candidate profiles against job requirements to evaluate contextual fit beyond simple keyword matches.",
    icon: "compare_arrows",
  },
  {
    title: "Candidate Ranking",
    desc: "Automatically rank incoming applicants based on job fit, surface top-tier matches instantly, and skip hours of manual screen sorting.",
    icon: "leaderboard",
  },
  {
    title: "Adaptive AI Interviews",
    desc: "Conduct natural, conversational screening interviews using domain-focused AI Personas that adapt in real time to explore candidate answers.",
    icon: "psychology",
  },
  {
    title: "Enterprise Proctoring",
    desc: "Live integrity monitoring including face verification, tab-switching tracking, and AI-based behavior anomaly logs to guarantee test fairness.",
    icon: "security",
  },
  {
    title: "Explainable AI",
    desc: "Receive transparent candidate evaluations showing clear competency scorecards, parameter weighting, and direct candidate quotes as evidence.",
    icon: "summarize",
  },
  {
    title: "Recruitment Analytics",
    desc: "Monitor recruitment metrics such as campaign volume, funnel conversion rates, time-to-hire trends, and recruiter productivity indicators.",
    icon: "analytics",
  },
  {
    title: "Enterprise Security",
    desc: "Enterprise-grade safety featuring multi-tenant isolation, data encryption at rest, Okta SSO, custom role permissions (RBAC), and full audit logs.",
    icon: "admin_panel_settings",
  },
];

/* ─── How It Works (Steps 1 to 10) ────────────────────────── */
const WORKFLOW_STEPS = [
  { step: "Step 1", title: "Collect Candidates", desc: "Ingest candidates automatically via ATS sync, job board integrations, or custom landing pages." },
  { step: "Step 2", title: "AI Resume Parsing", desc: "AI extracts skills, past job milestones, and qualifications into clean, searchable profiles." },
  { step: "Step 3", title: "JD Matching", desc: "Semantic intelligence processes job specifications to compare applicant backgrounds contextually." },
  { step: "Step 4", title: "Candidate Ranking", desc: "Applicants are stacked by suitability score, instantly revealing the top matches." },
  { step: "Step 5", title: "Interview Assignment", desc: "Workflows select the ideal AI persona, difficulty parameters, and duration metrics." },
  { step: "Step 6", title: "AI Interview", desc: "The candidate enters the interview room where a conversational persona conducts a natural, adaptive session." },
  { step: "Step 7", title: "Enterprise Proctoring", desc: "Integrity monitors run browser audits, webcam presence validation, and audio analysis." },
  { step: "Step 8", title: "AI Evaluation", desc: "XAI scores candidate competencies, generating explainable recommendations with cited proof." },
  { step: "Step 9", title: "Recruiter Decision", desc: "Hiring managers compare scorecards, view transcripts, and align feedback on one central board." },
  { step: "Step 10", title: "Hiring", desc: "Confirm the best-fit talent, trigger onboarding, and push status updates to your ATS database." },
];

/* ─── Enterprise Integrations ──────────────────────────────── */
const ENTERPRISE_CARDS = [
  { label: "Microsoft Teams", icon: "groups", type: "Integration" },
  { label: "Outlook Calendar", icon: "calendar_today", type: "Integration" },
  { label: "Google Calendar", icon: "today", type: "Integration" },
  { label: "Google Workspace", icon: "work", type: "Integration" },
  { label: "Supabase", icon: "database", type: "Infrastructure" },
  { label: "Gemini AI", icon: "smart_toy", type: "AI Engine" },
  { label: "Resend", icon: "mail", type: "Notifications" },
  { label: "Single Sign-On (SSO)", icon: "key", type: "Security" },
  { label: "Audit Logs", icon: "receipt_long", type: "Security" },
  { label: "Role-Based Access (RBAC)", icon: "admin_panel_settings", type: "Security" },
];

/* ─── Comparison Data ──────────────────────────────────────── */
const COMPARISON_ROWS = [
  { stage: "Resume Screening", traditional: "Manual Resume Screening (hours or days per role)", lokality: "AI Resume Intelligence — scored and parsed in seconds" },
  { stage: "Interview Scheduling", traditional: "Back-and-forth emails, coordination delays", lokality: "Automated Scheduling — instant invites upon candidate match" },
  { stage: "Interviews", traditional: "Subjective initial screens, varying standards, bias", lokality: "Standardized Adaptive AI Interviews — uniform questions tailored to JD" },
  { stage: "Evaluation & Grading", traditional: "Gut decisions, scribble notes, slow feedback loop", lokality: "Explainable AI Reports — transcript-cited competency cardboards" },
  { stage: "Integrity Tracking", traditional: "No proctoring or validation on remote calls", lokality: "Live Proctoring — facial logs, audio monitoring, tab locks" },
  { stage: "Hiring Decisions", traditional: "Disjointed team syncs, hiring delays", lokality: "Hiring Recommendations — recruiter decision-support dashboard" },
];

/* ─── Customer Benefits ────────────────────────────────────── */
const BUSINESS_OUTCOMES = [
  { title: "Reduce hiring time", val: "85%", desc: "Shorten your recruitment lifecycle from 42 days to under a week using fully automated screening pipelines." },
  { title: "Improve recruiter productivity", val: "10×", desc: "Enable talent acquisition teams to manage 10x more candidate flows without compromising vetting quality." },
  { title: "Increase interview consistency", val: "100%", desc: "Guarantee every candidate is evaluated against uniform rubrics and role competencies." },
  { title: "Reduce manual screening effort", val: "90%", desc: "Let AI handle resume parsing, parsing validation, alignment grading, and initial phone screens." },
  { title: "Improve hiring quality", val: "95%", desc: "Make decisions backed by explainable AI scoring, transcripts, and proctored records." },
  { title: "Enterprise-grade compliance", val: "SOC2", desc: "Data isolation, SAML SSO, and complete audit tracking aligning with corporate security policies." },
];

/* ─── Top Navigation Component ─────────────────────────────── */
function TopNav() {
  const [activeMenu, setActiveMenu] = useState<string | null>(null);
  const [mobileOpen, setMobileOpen] = useState(false);
  const navRef = useRef<HTMLElement>(null);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (navRef.current && !navRef.current.contains(e.target as Node)) {
        setActiveMenu(null);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  return (
    <nav
      ref={navRef}
      className="fixed top-0 inset-x-0 z-50 w-full bg-white/80 backdrop-blur-md border-b border-slate-200/60"
    >
      <div className="max-w-[1440px] mx-auto px-6 h-16 flex items-center justify-between">
        {/* Brand */}
        <div className="flex items-center gap-2">
          <Link to="/" className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-indigo-600 flex items-center justify-center">
              <span className="material-symbols-outlined text-white text-[18px] icon-fill">psychology</span>
            </div>
            <span className="text-lg font-bold text-slate-900 tracking-tight">Lokality AI</span>
          </Link>
          <span className="text-[10px] tracking-widest font-semibold px-2 py-0.5 rounded bg-slate-100 text-slate-500 border border-slate-200/50 uppercase">RECRUITMENT</span>
        </div>

        {/* Center menu buttons */}
        <div className="hidden lg:flex items-center gap-1">
          {Object.keys(NAV_MENU_DETAILS).map((key) => (
            <div key={key} className="relative">
              <button
                type="button"
                onMouseEnter={() => setActiveMenu(key)}
                onClick={() => setActiveMenu(activeMenu === key ? null : key)}
                className={`flex items-center gap-0.5 px-3.5 py-1.5 rounded-lg text-sm font-medium transition ${
                  activeMenu === key ? "bg-slate-100 text-slate-900" : "text-slate-600 hover:text-slate-900 hover:bg-slate-50"
                }`}
              >
                {key}
                <span className={`material-symbols-outlined text-[16px] transition-transform duration-200 ${activeMenu === key ? "rotate-180" : ""}`}>
                  expand_more
                </span>
              </button>

              {/* Megamenu dropdown */}
              {activeMenu === key && (
                <div
                  onMouseLeave={() => setActiveMenu(null)}
                  className="absolute left-1/2 -translate-x-1/2 top-full mt-2 w-[480px] bg-white rounded-xl border border-slate-200 shadow-xl p-4 animate-fade-in z-50"
                >
                  <div className="grid grid-cols-1 gap-2">
                    {NAV_MENU_DETAILS[key].map((item) => (
                      <div
                        key={item.label}
                        className="flex items-start gap-3 p-2.5 rounded-lg hover:bg-slate-50 transition text-left cursor-pointer"
                      >
                        <span className="material-symbols-outlined text-indigo-600 text-[20px] mt-0.5">
                          {item.icon}
                        </span>
                        <div>
                          <p className="text-sm font-semibold text-slate-900 leading-tight">{item.label}</p>
                          <p className="text-xs text-slate-500 mt-0.5 leading-normal">{item.desc}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          ))}
          <a href="#pricing" className="px-3.5 py-1.5 rounded-lg text-sm font-medium text-slate-600 hover:text-slate-900 hover:bg-slate-50">
            Pricing
          </a>
        </div>

        {/* Right CTA */}
        <div className="hidden lg:flex items-center gap-2">
          <Link to="/auth" className="px-4 py-2 text-sm font-medium text-slate-600 hover:text-slate-900 transition">
            Sign In
          </Link>
          <a
            href="mailto:sales@lokality.ai"
            className="px-4 py-2 border border-slate-200 rounded-lg text-sm font-medium text-slate-700 hover:bg-slate-50 transition"
          >
            Contact Sales
          </a>
          <Link
            to="/auth"
            search={{ mode: "signup" }}
            className="px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm font-semibold hover:bg-indigo-700 transition shadow-sm"
          >
            Request Demo
          </Link>
        </div>

        {/* Mobile menu toggle */}
        <button
          type="button"
          onClick={() => setMobileOpen(!mobileOpen)}
          className="lg:hidden p-2 text-slate-600 hover:bg-slate-50 rounded-lg"
          aria-label="Toggle Menu"
        >
          <span className="material-symbols-outlined">{mobileOpen ? "close" : "menu"}</span>
        </button>
      </div>

      {/* Mobile Drawer */}
      {mobileOpen && (
        <div className="lg:hidden border-t border-slate-200 bg-white px-6 py-4 space-y-4 animate-fade-in">
          {Object.keys(NAV_MENU_DETAILS).map((key) => (
            <div key={key} className="space-y-1">
              <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider">{key}</p>
              <div className="grid grid-cols-2 gap-2 pl-2">
                {NAV_MENU_DETAILS[key].map((item) => (
                  <div key={item.label} className="py-1 text-sm font-medium text-slate-700 hover:text-indigo-600">
                    {item.label}
                  </div>
                ))}
              </div>
            </div>
          ))}
          <div className="border-t border-slate-200 pt-4 flex flex-col gap-2">
            <Link to="/auth" className="w-full text-center py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 rounded-lg border border-slate-200">
              Sign In
            </Link>
            <Link
              to="/auth"
              search={{ mode: "signup" }}
              className="w-full text-center py-2 text-sm font-semibold text-white bg-indigo-600 hover:bg-indigo-700 rounded-lg"
            >
              Request Demo
            </Link>
          </div>
        </div>
      )}
    </nav>
  );
}

/* ─── Hero Section Component ───────────────────────────────── */
function HeroSection() {
  const [activeStage, setActiveStage] = useState<string>("s1");
  const activeDetail = PIPELINE_STAGES.find((s) => s.id === activeStage);

  return (
    <section className="pt-32 pb-20 px-6 bg-slate-50/50 overflow-hidden relative border-b border-slate-200/40">
      {/* Subtle grid background */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          backgroundImage: "linear-gradient(rgba(226, 232, 240, 0.4) 1px, transparent 1px), linear-gradient(90deg, rgba(226, 232, 240, 0.4) 1px, transparent 1px)",
          backgroundSize: "48px 48px",
        }}
      />

      <div className="max-w-[1280px] mx-auto relative z-10">
        <div className="text-center max-w-4xl mx-auto mb-16 animate-fade-in-up flex flex-col items-center">
          {/* Badge */}
          <div className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full bg-indigo-50 border border-indigo-100 text-xs font-semibold text-indigo-700 mb-6 transition-all hover:bg-indigo-100/80">
            <span className="w-2 h-2 rounded-full bg-indigo-600 animate-pulse" />
            <span>Logikality Engine v2.0 · Now Live</span>
          </div>

          {/* Heading */}
          <h1 className="text-4xl sm:text-5xl lg:text-6xl font-extrabold text-slate-900 tracking-tight leading-[1.1] mb-6 font-sans">
            AI Recruitment Intelligence Platform <br className="hidden sm:inline" />
            <span className="bg-clip-text text-transparent bg-gradient-to-r from-indigo-600 to-violet-600">
              for Enterprise Hiring
            </span>
          </h1>

          {/* Subheading */}
          <p className="text-base sm:text-lg text-slate-600 leading-relaxed max-w-2xl mx-auto mb-8 px-4 sm:px-0">
            From resume collection to hiring decisions, automate the entire recruitment lifecycle using AI-powered screening, adaptive interviews, explainable evaluations, and enterprise-grade analytics.
          </p>

          {/* CTAs */}
          <div className="flex flex-col sm:flex-row items-center justify-center gap-3.5 mb-10 w-full sm:w-auto">
            <Link
              to="/auth"
              search={{ mode: "signup" }}
              className="w-full sm:w-auto inline-flex items-center justify-center gap-2 bg-indigo-600 text-white px-7 py-3.5 rounded-xl shadow-md hover:bg-indigo-700 transition-all font-semibold text-base transform hover:-translate-y-0.5 active:translate-y-0"
            >
              Request Demo
              <span className="material-symbols-outlined text-[20px]">arrow_forward</span>
            </Link>
            <button
              type="button"
              className="w-full sm:w-auto inline-flex items-center justify-center gap-2 bg-white text-slate-800 border border-slate-200 px-7 py-3.5 rounded-xl hover:bg-slate-50 transition-all text-base font-semibold shadow-sm transform hover:-translate-y-0.5 active:translate-y-0"
            >
              <span className="material-symbols-outlined text-indigo-600 text-[20px] icon-fill">play_circle</span>
              Watch Platform Tour
            </button>
          </div>

          {/* Trust Badges */}
          <div className="flex flex-wrap items-center justify-center gap-x-8 gap-y-3 pt-5 border-t border-slate-200/60 w-full max-w-xl text-slate-500 font-medium text-xs sm:text-sm">
            <div className="flex items-center gap-1.5">
              <span className="material-symbols-outlined text-emerald-500 text-[18px] icon-fill">verified</span>
              <span>SOC 2 Compliant</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="material-symbols-outlined text-emerald-500 text-[18px] icon-fill">verified</span>
              <span>GDPR Ready</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="material-symbols-outlined text-emerald-500 text-[18px] icon-fill">verified</span>
              <span>Enterprise SSO</span>
            </div>
          </div>
        </div>

        {/* Interactive Pipeline Visual */}
        <div className="bg-white rounded-2xl border border-slate-200 shadow-xl p-6 sm:p-8 animate-fade-in">
          <div className="flex items-center justify-between border-b border-slate-100 pb-4 mb-6">
            <div>
              <p className="text-xs font-semibold text-slate-400 uppercase tracking-widest">Interactive Recruitment Flow</p>
              <h3 className="text-lg font-bold text-slate-900 mt-1">Ingestion to Hire Pipeline</h3>
            </div>
            <span className="text-xs bg-indigo-50 text-indigo-700 font-semibold px-2.5 py-1 rounded-full flex items-center gap-1">
              <span className="w-1.5 h-1.5 rounded-full bg-indigo-600 animate-pulse" />
              Hover steps to explore
            </span>
          </div>

          {/* Workflow nodes */}
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3 mb-6 relative">
            {PIPELINE_STAGES.map((stage, idx) => {
              const active = stage.id === activeStage;
              return (
                <div
                  key={stage.id}
                  onMouseEnter={() => setActiveStage(stage.id)}
                  className={`p-3.5 rounded-xl border-2 text-left cursor-pointer transition-all duration-200 relative ${
                    active
                      ? "border-indigo-600 bg-indigo-50/40 shadow-sm"
                      : "border-slate-100 bg-slate-50/50 hover:bg-slate-50 hover:border-slate-300"
                  }`}
                >
                  <div className="flex items-center gap-2 mb-1.5">
                    <span className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold ${
                      active ? "bg-indigo-600 text-white" : "bg-slate-200 text-slate-600"
                    }`}>
                      {idx + 1}
                    </span>
                    <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider">Stage {idx + 1}</span>
                  </div>
                  <p className={`text-xs font-bold ${active ? "text-indigo-900" : "text-slate-800"} line-clamp-1`}>
                    {stage.label}
                  </p>
                  {/* Subtle link arrows for visual connection */}
                  {idx < PIPELINE_STAGES.length - 1 && (
                    <div className="hidden lg:block absolute -right-2 top-1/2 -translate-y-1/2 z-10 text-slate-300 pointer-events-none">
                      <span className="material-symbols-outlined text-[16px] animate-pulse">chevron_right</span>
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          {/* Active step summary */}
          {activeDetail && (
            <div className="bg-slate-50 border border-slate-200 rounded-xl p-5 flex items-start gap-4 transition-all duration-300 animate-fade-in">
              <div className="w-10 h-10 rounded-lg bg-indigo-600 text-white flex items-center justify-center shrink-0">
                <span className="material-symbols-outlined text-[22px]">hub</span>
              </div>
              <div>
                <p className="text-xs font-bold text-indigo-600 uppercase tracking-widest">Active Stage Info</p>
                <h4 className="text-base font-bold text-slate-900 mt-0.5">{activeDetail.label}</h4>
                <p className="text-sm text-slate-600 mt-1 leading-relaxed">{activeDetail.desc}</p>
              </div>
            </div>
          )}
        </div>
      </div>
    </section>
  );
}

/* ─── Hero Metrics Component ────────────────────────────────── */
function HeroMetrics() {
  return (
    <section className="bg-white py-10 border-b border-slate-200/50">
      <div className="max-w-[1280px] mx-auto px-6">
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-6 text-center">
          {HERO_METRICS.map((metric) => (
            <div key={metric.label} className="p-4 border-r border-slate-100 last:border-0">
              <p className="text-3xl font-extrabold text-indigo-600 tracking-tight">{metric.value}</p>
              <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mt-1">{metric.label}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ─── Key Capabilities Component ────────────────────────────── */
function KeyCapabilities() {
  return (
    <section className="py-24 bg-white border-b border-slate-200/50">
      <div className="max-w-[1280px] mx-auto px-6">
        <div className="max-w-2xl mb-16">
          <p className="text-xs font-bold text-indigo-600 uppercase tracking-widest mb-3">Core Engine</p>
          <h2 className="text-3xl sm:text-4xl font-extrabold text-slate-900 tracking-tight">
            Key Capabilities Built for Scale
          </h2>
          <p className="text-base text-slate-500 mt-3">
            Every feature is production-ready, security-first, and designed to streamline complex enterprise talent screening.
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
          {CAPABILITIES.map((cap) => (
            <div
              key={cap.title}
              className="p-6 rounded-2xl border border-slate-200 hover:border-slate-300 hover:shadow-lg transition-all duration-200 bg-white text-left group cursor-default"
            >
              <div className="w-10 h-10 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center mb-5 group-hover:bg-indigo-600 group-hover:text-white transition-all duration-200">
                <span className="material-symbols-outlined text-[20px]">{cap.icon}</span>
              </div>
              <h3 className="text-base font-bold text-slate-900 mb-2">{cap.title}</h3>
              <p className="text-sm text-slate-600 leading-relaxed">{cap.desc}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ─── How It Works Component ────────────────────────────────── */
function HowItWorks() {
  return (
    <section className="py-24 bg-slate-50/50 border-b border-slate-200/50">
      <div className="max-w-[1280px] mx-auto px-6">
        <div className="text-center max-w-2xl mx-auto mb-16">
          <p className="text-xs font-bold text-indigo-600 uppercase tracking-widest mb-3">Timeline Guide</p>
          <h2 className="text-3xl sm:text-4xl font-extrabold text-slate-900 tracking-tight">
            How Lokality AI Works
          </h2>
          <p className="text-base text-slate-500 mt-3">
            Go from candidate ingestion to final hiring decision in a ten-step structured intelligence flow.
          </p>
        </div>

        {/* Step Timeline Grid */}
        <div className="max-w-4xl mx-auto relative pl-6 sm:pl-8 border-l-2 border-indigo-100 space-y-10">
          {WORKFLOW_STEPS.map((item, idx) => (
            <div key={item.step} className="relative flex items-start gap-4 sm:gap-6">
              {/* Step counter dot */}
              <div className="absolute -left-[41px] top-0 w-8 h-8 rounded-full bg-white border-2 border-indigo-600 text-indigo-600 font-bold text-xs flex items-center justify-center shadow-sm">
                {idx + 1}
              </div>
              <div>
                <span className="text-xs font-bold text-indigo-600 uppercase tracking-wider">{item.step}</span>
                <h4 className="text-lg font-bold text-slate-900 mt-0.5">{item.title}</h4>
                <p className="text-sm text-slate-600 mt-1.5 leading-relaxed">{item.desc}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ─── Platform Preview Component ────────────────────────────── */
function PlatformPreview() {
  const [activeTab, setActiveTab] = useState<string>("dashboard");

  const tabContent: Record<string, { title: string; desc: string; layout: () => ReactNode }> = {
    dashboard: {
      title: "Recruiter Dashboard",
      desc: "Overview of your active job campaigns, scheduling statistics, and candidate status aggregates.",
      layout: () => (
        <div className="p-6 bg-slate-900 text-slate-100 rounded-xl font-mono text-xs space-y-4">
          <div className="flex justify-between items-center border-b border-slate-800 pb-3">
            <span className="font-bold text-indigo-400">LOKALITY_AI // CAMPAIGNS</span>
            <span className="bg-emerald-500/20 text-emerald-400 px-2 py-0.5 rounded text-[10px]">LIVE STATUS</span>
          </div>
          <div className="grid grid-cols-3 gap-3 text-center">
            <div className="bg-slate-800/60 p-3 rounded border border-slate-700/50">
              <p className="text-[10px] text-slate-400 uppercase font-semibold">Active Jobs</p>
              <p className="text-lg font-extrabold text-white mt-1">12</p>
            </div>
            <div className="bg-slate-800/60 p-3 rounded border border-slate-700/50">
              <p className="text-[10px] text-slate-400 uppercase font-semibold">Interviews Run</p>
              <p className="text-lg font-extrabold text-white mt-1">384</p>
            </div>
            <div className="bg-slate-800/60 p-3 rounded border border-slate-700/50">
              <p className="text-[10px] text-slate-400 uppercase font-semibold">Consistency Index</p>
              <p className="text-lg font-extrabold text-white mt-1">99.8%</p>
            </div>
          </div>
          <div className="space-y-2 pt-2">
            <p className="text-[10px] font-semibold text-slate-400 uppercase">Recent Candidates</p>
            <div className="bg-slate-800/40 p-2.5 rounded flex justify-between items-center border border-slate-800">
              <span>Sarah Jenkins (Senior Frontend Dev)</span>
              <span className="text-indigo-400 font-bold">Match: 95%</span>
            </div>
            <div className="bg-slate-800/40 p-2.5 rounded flex justify-between items-center border border-slate-800">
              <span>Marcus Chen (Technical PM)</span>
              <span className="text-indigo-400 font-bold">Match: 82%</span>
            </div>
          </div>
        </div>
      ),
    },
    candidates: {
      title: "Candidate Management",
      desc: "Manage candidate profiles, review match scores, filter statuses, and view audit schedules.",
      layout: () => (
        <div className="p-6 bg-white border border-slate-200 rounded-xl space-y-4 text-slate-700 text-xs">
          <div className="flex justify-between items-center border-b border-slate-100 pb-3">
            <span className="font-bold text-slate-900">Applicants - Engineering Pool</span>
            <input type="text" placeholder="Filter candidates..." className="px-3 py-1 border border-slate-200 rounded bg-slate-50 text-[10px] outline-none" disabled />
          </div>
          <div className="space-y-2">
            <div className="p-3 border border-slate-100 rounded-lg flex items-center justify-between hover:bg-slate-50">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-full bg-indigo-100 text-indigo-700 flex items-center justify-center font-bold text-xs">SJ</div>
                <div>
                  <p className="font-bold text-slate-800 text-sm">Sarah Jenkins</p>
                  <p className="text-[10px] text-slate-500">sarah.j@example.com · 7 yrs exp</p>
                </div>
              </div>
              <div className="text-right">
                <span className="bg-emerald-100 text-emerald-800 font-bold px-2 py-0.5 rounded text-[10px]">MATCH 95%</span>
                <p className="text-[10px] text-slate-400 mt-1">Screen Scheduled</p>
              </div>
            </div>
            <div className="p-3 border border-slate-100 rounded-lg flex items-center justify-between hover:bg-slate-50">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-full bg-slate-100 text-slate-700 flex items-center justify-center font-bold text-xs">MC</div>
                <div>
                  <p className="font-bold text-slate-800 text-sm">Marcus Chen</p>
                  <p className="text-[10px] text-slate-500">m.chen@example.com · 5 yrs exp</p>
                </div>
              </div>
              <div className="text-right">
                <span className="bg-indigo-100 text-indigo-800 font-bold px-2 py-0.5 rounded text-[10px]">MATCH 82%</span>
                <p className="text-[10px] text-slate-400 mt-1">Completed</p>
              </div>
            </div>
          </div>
        </div>
      ),
    },
    jdbuilder: {
      title: "Job Description Builder",
      desc: "Upload or write job specifications to automatically generate competency scoring parameters.",
      layout: () => (
        <div className="p-6 bg-white border border-slate-200 rounded-xl space-y-4 text-slate-700 text-xs">
          <div>
            <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">Role Title</label>
            <input type="text" value="Senior Backend Engineer - Distributed Systems" className="w-full px-3 py-2 border border-slate-200 rounded bg-slate-50 font-medium" disabled />
          </div>
          <div>
            <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">Key Competencies Required</label>
            <div className="flex flex-wrap gap-1.5 mt-1">
              {["Golang", "PostgreSQL", "Kafka", "System Design", "Kubernetes"].map((skill) => (
                <span key={skill} className="px-2.5 py-1 rounded bg-indigo-50 text-indigo-700 border border-indigo-100 font-semibold text-[10px]">{skill}</span>
              ))}
            </div>
          </div>
          <button className="w-full py-2 bg-indigo-600 text-white font-bold rounded-lg text-[11px] hover:bg-indigo-700 transition">
            ✨ Generate AI Competency Rubric
          </button>
        </div>
      ),
    },
    persona: {
      title: "AI Persona Builder",
      desc: "Customize interview styles, communication styles, strictness, and specific testing domains.",
      layout: () => (
        <div className="p-6 bg-white border border-slate-200 rounded-xl space-y-4 text-slate-700 text-xs">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-purple-50 text-purple-600 flex items-center justify-center">
              <span className="material-symbols-outlined text-[24px]">psychology</span>
            </div>
            <div>
              <p className="font-bold text-slate-900 text-sm">Principal Architect Persona</p>
              <p className="text-[10px] text-slate-500">Domain: Engineering / Tech Stack Audit</p>
            </div>
          </div>
          <div className="space-y-3">
            <div>
              <div className="flex justify-between text-[10px] font-bold text-slate-400 uppercase mb-1">
                <span>Strictness Level</span>
                <span className="text-purple-600 font-bold">Strict</span>
              </div>
              <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden">
                <div className="h-full bg-purple-600 w-4/5" />
              </div>
            </div>
            <div>
              <span className="text-[10px] font-bold text-slate-400 uppercase block mb-1">Interviewer Prompt Parameters</span>
              <div className="bg-slate-50 p-2.5 rounded border border-slate-200 text-[10px] font-mono text-slate-500 italic">
                \"Probe system tradeoffs. Do not accept high-level claims. Ask candidate to detail database lock handling in distributed systems...\"
              </div>
            </div>
          </div>
        </div>
      ),
    },
    questions: {
      title: "Question Bank Management",
      desc: "Maintain sets of standardized coding problems, STAR behavioral prompts, and compliance checklists.",
      layout: () => (
        <div className="p-6 bg-white border border-slate-200 rounded-xl space-y-3 text-slate-700 text-xs">
          <div className="flex justify-between items-center border-b border-slate-100 pb-2">
            <span className="font-bold text-slate-900">Active Question Bank</span>
            <span className="text-[10px] text-slate-400">Total: 42 Questions</span>
          </div>
          <div className="space-y-2">
            <div className="p-2 border border-slate-100 rounded bg-slate-50/50">
              <span className="text-[9px] bg-indigo-50 border border-indigo-100 text-indigo-700 px-1.5 py-0.5 rounded font-bold uppercase">System Design</span>
              <p className="font-bold text-slate-800 mt-1">Describe exactly-once consumption logic across distributed Kafka partitions.</p>
            </div>
            <div className="p-2 border border-slate-100 rounded bg-slate-50/50">
              <span className="text-[9px] bg-purple-50 border border-purple-100 text-purple-700 px-1.5 py-0.5 rounded font-bold uppercase">STAR Behavioral</span>
              <p className="font-bold text-slate-800 mt-1">Tell me about a time you had a deadlock in production and how you handled team consensus.</p>
            </div>
          </div>
        </div>
      ),
    },
    room: {
      title: "AI Interview Room",
      desc: "Simulate candidate interview views, complete with speech-to-text transcript streaming and proctoring locks.",
      layout: () => (
        <div className="p-6 bg-slate-950 text-slate-100 rounded-xl space-y-4 text-xs relative overflow-hidden">
          {/* Active meeting viewport */}
          <div className="grid grid-cols-2 gap-3">
            <div className="aspect-video bg-slate-900 border border-slate-800 rounded-lg flex flex-col items-center justify-center text-center p-3 relative">
              <span className="material-symbols-outlined text-[32px] text-indigo-400">smart_toy</span>
              <p className="text-[10px] font-bold text-white mt-2">Principal Architect Bot</p>
              <p className="text-[8px] text-slate-400">\"How do you ensure consistency on database write partitions?\"</p>
            </div>
            <div className="aspect-video bg-slate-900 border border-slate-800 rounded-lg flex flex-col items-center justify-center text-center p-3 relative">
              <div className="w-8 h-8 rounded-full bg-slate-800 text-white flex items-center justify-center font-bold text-[10px]">C</div>
              <p className="text-[10px] font-bold text-white mt-2">Candidate Feed</p>
              <span className="absolute bottom-1 right-1 text-[8px] bg-emerald-500/20 text-emerald-400 px-1 rounded uppercase">Webcam OK</span>
            </div>
          </div>
          {/* Speech-to-text simulator */}
          <div className="bg-slate-900 border border-slate-800 p-2.5 rounded font-mono text-[9px] text-slate-400">
            <span className="text-indigo-400">Transcript Stream:</span> \"We implement transactional outboxes combined with transactional consumer polling to prevent write desync...\"
          </div>
        </div>
      ),
    },
    reports: {
      title: "AI Evaluation Reports",
      desc: "Explainable AI scorecards detailing competency ratings, proctoring details, and highlighted response citations.",
      layout: () => (
        <div className="p-6 bg-white border border-slate-200 rounded-xl space-y-4 text-slate-700 text-xs">
          <div className="flex justify-between items-center border-b border-slate-100 pb-2">
            <div>
              <p className="font-bold text-slate-900 text-sm">Evaluation: Sarah Jenkins</p>
              <p className="text-[9px] text-slate-500">Position: Senior Software Engineer</p>
            </div>
            <span className="text-xl font-extrabold text-indigo-600 bg-indigo-50 border border-indigo-100 px-3 py-1 rounded-lg">95/100</span>
          </div>
          <div className="space-y-2">
            <div>
              <div className="flex justify-between text-[10px] font-semibold text-slate-600 mb-1">
                <span>Distributed Systems Vetting</span>
                <span className="font-bold text-indigo-600">98%</span>
              </div>
              <div className="h-1 bg-slate-100 rounded-full overflow-hidden">
                <div className="h-full bg-indigo-600 w-[98%]" />
              </div>
            </div>
            <div className="bg-indigo-50/50 p-2.5 rounded border border-indigo-100/50 text-[10px] text-indigo-900 leading-normal">
              <span className="font-bold text-indigo-800">Explainable AI Insight:</span> \"Candidate demonstrated thorough comprehension of partition semantics and cited practical edge case logs from previous deployments.\"
            </div>
          </div>
        </div>
      ),
    },
    analytics: {
      title: "Hiring Analytics",
      desc: "Track hiring efficiency, average campaign days, candidate conversion ratios, and recruiter speed statistics.",
      layout: () => (
        <div className="p-6 bg-slate-900 text-slate-100 rounded-xl font-mono text-xs space-y-4">
          <div className="flex justify-between items-center border-b border-slate-800 pb-2">
            <span className="font-bold text-indigo-400">ORGANIZATION // ANALYTICS</span>
            <span className="text-[9px] text-slate-400">Q2 REPORT</span>
          </div>
          <div className="space-y-3">
            <div>
              <div className="flex justify-between text-[9px] text-slate-400 mb-1">
                <span>Average Time-to-Hire</span>
                <span className="text-white font-bold">12 Days (-71% saving)</span>
              </div>
              <div className="h-1.5 bg-slate-800 rounded-full overflow-hidden">
                <div className="h-full bg-indigo-500 w-1/3" />
              </div>
            </div>
            <div>
              <div className="flex justify-between text-[9px] text-slate-400 mb-1">
                <span>Vetting Consistency Score</span>
                <span className="text-white font-bold">99.8%</span>
              </div>
              <div className="h-1.5 bg-slate-800 rounded-full overflow-hidden">
                <div className="h-full bg-indigo-500 w-[99%]" />
              </div>
            </div>
          </div>
        </div>
      ),
    },
  };

  return (
    <section id="platform-preview" className="py-24 bg-white border-b border-slate-200/50">
      <div className="max-w-[1280px] mx-auto px-6">
        <div className="text-center max-w-2xl mx-auto mb-16">
          <p className="text-xs font-bold text-indigo-600 uppercase tracking-widest mb-3">Product Showcase</p>
          <h2 className="text-3xl sm:text-4xl font-extrabold text-slate-900 tracking-tight">
            Interactive Platform Preview
          </h2>
          <p className="text-base text-slate-500 mt-3">
            Explore the different workspace environments inside Lokality AI without leaving the page.
          </p>
        </div>

        {/* Dynamic Showcase View */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 items-start">
          {/* Tab selector menu */}
          <div className="lg:col-span-1 space-y-2">
            {Object.keys(tabContent).map((tabKey) => {
              const active = activeTab === tabKey;
              return (
                <button
                  key={tabKey}
                  type="button"
                  onClick={() => setActiveTab(tabKey)}
                  className={`w-full p-4 rounded-xl border-2 text-left transition-all duration-200 flex items-center gap-3 ${
                    active
                      ? "border-indigo-600 bg-indigo-50/40 text-slate-900"
                      : "border-slate-100 bg-slate-50/50 hover:bg-slate-50 text-slate-600"
                  }`}
                >
                  <span className={`material-symbols-outlined text-[20px] ${active ? "text-indigo-600" : "text-slate-400"}`}>
                    {tabKey === "dashboard" ? "dashboard" :
                     tabKey === "candidates" ? "groups" :
                     tabKey === "jdbuilder" ? "description" :
                     tabKey === "persona" ? "psychology" :
                     tabKey === "questions" ? "quiz" :
                     tabKey === "room" ? "videocam" :
                     tabKey === "reports" ? "summarize" : "monitoring"}
                  </span>
                  <div>
                    <p className="text-sm font-bold leading-none">{tabContent[tabKey].title}</p>
                  </div>
                </button>
              );
            })}
          </div>

          {/* Active tab mockup viewport */}
          <div className="lg:col-span-2 bg-slate-50 border border-slate-200 rounded-2xl p-6 shadow-sm min-h-[320px] flex flex-col justify-between">
            <div>
              <h3 className="text-xl font-extrabold text-slate-900">{tabContent[activeTab].title}</h3>
              <p className="text-sm text-slate-500 mt-1 mb-6 leading-relaxed">{tabContent[activeTab].desc}</p>
            </div>
            {/* Render selected layout */}
            <div className="w-full transition-all duration-300">
              {tabContent[activeTab].layout()}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

/* ─── Enterprise Integrations Component ────────────────────── */
function EnterpriseSection() {
  return (
    <section className="py-24 bg-slate-50/50 border-b border-slate-200/50">
      <div className="max-w-[1280px] mx-auto px-6">
        <div className="max-w-2xl mb-16">
          <p className="text-xs font-bold text-indigo-600 uppercase tracking-widest mb-3">Enterprise Core</p>
          <h2 className="text-3xl sm:text-4xl font-extrabold text-slate-900 tracking-tight">
            Built for Enterprise Scale and Trust
          </h2>
          <p className="text-base text-slate-500 mt-3">
            Secure integrations and compliance options to meet rigorous IT and security requirements.
          </p>
        </div>

        {/* Integration Cards Grid */}
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-5">
          {ENTERPRISE_CARDS.map((card) => (
            <div
              key={card.label}
              className="p-5 bg-white border border-slate-200 rounded-2xl hover:border-slate-300 hover:shadow-md transition-all duration-200 text-left"
            >
              <div className="w-9 h-9 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center mb-4">
                <span className="material-symbols-outlined text-[18px]">{card.icon}</span>
              </div>
              <p className="text-sm font-bold text-slate-900">{card.label}</p>
              <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-widest mt-1">{card.type}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ─── Why Lokality AI (Comparison Table) ───────────────────── */
function ComparisonSection() {
  return (
    <section className="py-24 bg-white border-b border-slate-200/50">
      <div className="max-w-[1280px] mx-auto px-6">
        <div className="text-center max-w-2xl mx-auto mb-16">
          <p className="text-xs font-bold text-indigo-600 uppercase tracking-widest mb-3"> Lokality Comparison</p>
          <h2 className="text-3xl sm:text-4xl font-extrabold text-slate-900 tracking-tight">
            Traditional Recruitment vs. Lokality AI
          </h2>
          <p className="text-base text-slate-500 mt-3">
            Compare manual recruitment processes against an automated, intelligence-first platform.
          </p>
        </div>

        {/* Comparison grid */}
        <div className="max-w-4xl mx-auto border border-slate-200 rounded-2xl overflow-hidden shadow-sm">
          <div className="grid grid-cols-3 bg-slate-50 border-b border-slate-200 font-bold text-xs text-slate-500 uppercase tracking-wider text-left p-4">
            <div>Recruitment Stage</div>
            <div>Traditional Recruitment</div>
            <div className="text-indigo-600">Lokality AI Platform</div>
          </div>
          {COMPARISON_ROWS.map((row) => (
            <div key={row.stage} className="grid grid-cols-3 border-b border-slate-100 last:border-0 p-4 text-xs text-slate-700 items-center">
              <div className="font-bold text-slate-900">{row.stage}</div>
              <div className="pr-4 leading-normal flex items-start gap-1 text-slate-500">
                <span className="material-symbols-outlined text-red-500 text-[16px] shrink-0 mt-0.5">cancel</span>
                {row.traditional}
              </div>
              <div className="leading-normal flex items-start gap-1 font-semibold text-slate-900">
                <span className="material-symbols-outlined text-emerald-500 text-[16px] shrink-0 mt-0.5">check_circle</span>
                {row.lokality}
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ─── Customer Benefits Component ───────────────────────────── */
function CustomerBenefits() {
  return (
    <section className="py-24 bg-slate-50/50 border-b border-slate-200/50">
      <div className="max-w-[1280px] mx-auto px-6">
        <div className="max-w-2xl mb-16">
          <p className="text-xs font-bold text-indigo-600 uppercase tracking-widest mb-3">Outcome Metrics</p>
          <h2 className="text-3xl sm:text-4xl font-extrabold text-slate-900 tracking-tight">
            Measurable Business Outcomes
          </h2>
          <p className="text-base text-slate-500 mt-3">
            Implement standardized screening algorithms to achieve immediate hiring ROI.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {BUSINESS_OUTCOMES.map((item) => (
            <div key={item.title} className="p-6 bg-white border border-slate-200 rounded-2xl shadow-sm text-left">
              <span className="text-4xl font-extrabold text-indigo-600 tracking-tight block">{item.val}</span>
              <h4 className="text-base font-bold text-slate-900 mt-2">{item.title}</h4>
              <p className="text-xs text-slate-500 mt-1 leading-relaxed">{item.desc}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ─── CTA Banner Component ─────────────────────────────────── */
function CTABanner() {
  return (
    <section className="py-24 bg-indigo-600 text-white relative overflow-hidden text-center">
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          backgroundImage: "radial-gradient(circle at 50% 50%, rgba(255, 255, 255, 0.1) 0%, transparent 60%)",
        }}
      />
      <div className="max-w-[1280px] mx-auto px-6 relative z-10">
        <h2 className="text-3xl sm:text-4xl font-extrabold tracking-tight mb-4">
          Ready to Automate Your Screening Infrastructure?
        </h2>
        <p className="text-base sm:text-lg text-indigo-100 max-w-2xl mx-auto mb-8 leading-relaxed">
          Join modern HR and talent teams who use Lokality AI to eliminate bias, enforce compliance, and reduce time-to-hire by 85%.
        </p>
        <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
          <Link
            to="/auth"
            search={{ mode: "signup" }}
            className="px-6 py-3.5 bg-white text-indigo-600 font-bold rounded-xl hover:bg-slate-50 transition shadow-md"
          >
            Request Enterprise Demo
          </Link>
          <a
            href="mailto:sales@lokality.ai"
            className="px-6 py-3.5 bg-indigo-700/60 border border-indigo-400 text-white font-semibold rounded-xl hover:bg-indigo-700 transition"
          >
            Contact Sales
          </a>
        </div>
      </div>
    </section>
  );
}

/* ─── Footer Component ─────────────────────────────────────── */
function Footer() {
  return (
    <footer className="bg-white border-t border-slate-200">
      <div className="max-w-[1280px] mx-auto px-6 py-16">
        <div className="grid grid-cols-2 md:grid-cols-6 gap-8 mb-12">
          {/* Brand */}
          <div className="col-span-2">
            <div className="flex items-center gap-2 mb-4">
              <div className="w-8 h-8 rounded-lg bg-indigo-600 flex items-center justify-center">
                <span className="material-symbols-outlined text-white text-[18px] icon-fill">psychology</span>
              </div>
              <span className="text-base font-bold text-slate-900 tracking-tight">Lokality AI</span>
            </div>
            <p className="text-xs text-slate-500 leading-relaxed max-w-xs">
              Automating hiring pipelines with explainable assessments, domain personas, and secure proctoring logs.
            </p>
            <div className="flex gap-2 mt-4">
              <a
                href="https://linkedin.com"
                target="_blank"
                rel="noreferrer"
                className="w-8 h-8 border border-slate-200 rounded-lg flex items-center justify-center hover:bg-slate-50 transition"
                aria-label="LinkedIn"
              >
                <svg viewBox="0 0 24 24" width="14" height="14" fill="var(--slate-600)">
                  <path d="M16 8a6 6 0 0 1 6 6v7h-4v-7a2 2 0 0 0-2-2 2 2 0 0 0-2 2v7h-4v-7a6 6 0 0 1 6-6zM2 9h4v12H2z" />
                  <circle cx="4" cy="4" r="2" />
                </svg>
              </a>
            </div>
          </div>

          {/* Links columns */}
          <div>
            <h4 className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-4">Platform</h4>
            <ul className="space-y-2 text-xs font-medium text-slate-500">
              <li><a href="#" className="hover:text-indigo-600">Candidate Portal</a></li>
              <li><a href="#" className="hover:text-indigo-600">Hiring Dashboard</a></li>
              <li><a href="#" className="hover:text-indigo-600">Proctoring Logs</a></li>
              <li><a href="#" className="hover:text-indigo-600">Audits</a></li>
            </ul>
          </div>
          <div>
            <h4 className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-4">Products</h4>
            <ul className="space-y-2 text-xs font-medium text-slate-500">
              <li><a href="#" className="hover:text-indigo-600">Resume Parser</a></li>
              <li><a href="#" className="hover:text-indigo-600">Semantic Matching</a></li>
              <li><a href="#" className="hover:text-indigo-600">AI Adaptive Screens</a></li>
              <li><a href="#" className="hover:text-indigo-600">Reports</a></li>
            </ul>
          </div>
          <div>
            <h4 className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-4">Workflows</h4>
            <ul className="space-y-2 text-xs font-medium text-slate-500">
              <li><a href="#" className="hover:text-indigo-600">High-Volume Vetting</a></li>
              <li><a href="#" className="hover:text-indigo-600">Technical Tests</a></li>
              <li><a href="#" className="hover:text-indigo-600">STAR Behavioral</a></li>
              <li><a href="#" className="hover:text-indigo-600">Graduates</a></li>
            </ul>
          </div>
          <div>
            <h4 className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-4">Enterprise</h4>
            <ul className="space-y-2 text-xs font-medium text-slate-500">
              <li><a href="#" className="hover:text-indigo-600">SSO & SAML</a></li>
              <li><a href="#" className="hover:text-indigo-600">Audit Trail</a></li>
              <li><a href="#" className="hover:text-indigo-600">Data Security</a></li>
              <li><a href="#" className="hover:text-indigo-600">RBAC Rules</a></li>
            </ul>
          </div>
        </div>

        <div className="border-t border-slate-100 pt-6 flex flex-col sm:flex-row justify-between items-center gap-4 text-xs text-slate-500 font-medium">
          <p>© {new Date().getFullYear()} Lokality AI. All rights reserved.</p>
          <div className="flex gap-4">
            <a href="#" className="hover:text-indigo-600">Privacy Policy</a>
            <a href="#" className="hover:text-indigo-600">Terms of Service</a>
            <a href="#" className="hover:text-indigo-600">Security Documents</a>
            <a href="#" className="hover:text-indigo-600">API Documentation</a>
          </div>
        </div>
      </div>
    </footer>
  );
}

/* ─── Main Redesigned Homepage ─────────────────────────────── */
function Landing() {
  return (
    <div className="bg-slate-50/20 text-slate-800 min-h-screen antialiased flex flex-col">
      <TopNav />
      <main className="flex-1">
        <HeroSection />
        <HeroMetrics />
        <KeyCapabilities />
        <HowItWorks />
        <PlatformPreview />
        <EnterpriseSection />
        <ComparisonSection />
        <CustomerBenefits />
        <CTABanner />
      </main>
      <Footer />
    </div>
  );
}
