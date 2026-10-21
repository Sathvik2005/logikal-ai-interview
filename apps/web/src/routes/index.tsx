import { createFileRoute, Link } from "@tanstack/react-router";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Lokality AI — AI Interviews for Hiring Teams" },
      {
        name: "description",
        content:
          "Run structured AI interviews, review explainable scorecards and make the hiring decision, all in one place.",
      },
    ],
  }),
  component: Landing,
});

const STEPS = [
  {
    title: "Add the role and candidates",
    desc: "Create a job, then add candidates or upload resumes.",
  },
  {
    title: "Schedule an AI interview",
    desc: "Pick an AI interviewer, a time and a duration. The invitation goes out by email.",
  },
  {
    title: "The candidate interviews online",
    desc: "A voice interview in the browser, with identity check and integrity monitoring.",
  },
  {
    title: "Review the report",
    desc: "Scorecard, transcript, recording and a recommendation for each candidate.",
  },
  { title: "Decide", desc: "Record hire, hold or reject, and let the candidate know." },
];

const FEATURES = [
  {
    icon: "description",
    title: "Resume reading",
    desc: "Skills, experience and a summary pulled from each resume.",
  },
  {
    icon: "compare_arrows",
    title: "Job matching",
    desc: "See how closely each candidate fits the role.",
  },
  {
    icon: "psychology",
    title: "Adaptive AI interviews",
    desc: "A conversational interviewer with a style and difficulty you choose.",
  },
  {
    icon: "security",
    title: "Integrity monitoring",
    desc: "Tab switches, missing or extra faces and other signals, logged for review.",
  },
  {
    icon: "summarize",
    title: "Explainable scorecards",
    desc: "Scores per competency with reasons and a hire recommendation.",
  },
  {
    icon: "analytics",
    title: "Hiring analytics",
    desc: "Funnel, time to hire and completion rate at a glance.",
  },
];

function Landing() {
  return (
    <div className="bg-white text-slate-800 min-h-screen antialiased flex flex-col">
      <header className="fixed top-0 inset-x-0 z-50 bg-white/90 backdrop-blur border-b border-slate-200">
        <div className="max-w-5xl mx-auto px-6 h-16 flex items-center justify-between">
          <Link to="/" className="flex items-center gap-2 font-bold text-slate-900">
            <span className="w-8 h-8 rounded-lg bg-indigo-600 flex items-center justify-center">
              <span className="material-symbols-outlined text-white text-[18px]">psychology</span>
            </span>
            Lokality AI
          </Link>
          <nav className="flex items-center gap-6 text-sm">
            <a href="#how" className="hidden sm:inline text-slate-600 hover:text-indigo-600">
              How it works
            </a>
            <a href="#features" className="hidden sm:inline text-slate-600 hover:text-indigo-600">
              Features
            </a>
            <Link
              to="/auth"
              className="px-4 py-2 rounded-lg bg-indigo-600 text-white font-medium hover:bg-indigo-700"
            >
              Sign in
            </Link>
          </nav>
        </div>
      </header>

      <main className="flex-1">
        <section className="pt-36 pb-20 px-6 bg-slate-50 border-b border-slate-200">
          <div className="max-w-3xl mx-auto text-center">
            <h1 className="text-4xl sm:text-5xl font-extrabold tracking-tight text-slate-900 text-balance">
              Run structured AI interviews and decide with confidence
            </h1>
            <p className="mt-5 text-lg text-slate-600">
              From the job and the candidate list to the interview, the scorecard and the final
              decision, in one place.
            </p>
            <div className="mt-8 flex flex-wrap justify-center gap-3">
              <Link
                to="/auth"
                className="px-6 py-3 rounded-lg bg-indigo-600 text-white font-medium hover:bg-indigo-700"
              >
                Sign in
              </Link>
              <a
                href="#how"
                className="px-6 py-3 rounded-lg border border-slate-300 text-slate-700 font-medium hover:bg-white"
              >
                See how it works
              </a>
            </div>
          </div>
        </section>

        <section id="how" className="py-20 px-6 border-b border-slate-200">
          <div className="max-w-3xl mx-auto">
            <h2 className="text-3xl font-bold text-slate-900">How it works</h2>
            <ol className="mt-8 flex flex-col gap-5">
              {STEPS.map((s, i) => (
                <li key={s.title} className="flex gap-4">
                  <span className="shrink-0 w-9 h-9 rounded-full bg-indigo-600 text-white font-semibold flex items-center justify-center">
                    {i + 1}
                  </span>
                  <div>
                    <h3 className="font-semibold text-slate-900">{s.title}</h3>
                    <p className="text-slate-600">{s.desc}</p>
                  </div>
                </li>
              ))}
            </ol>
          </div>
        </section>

        <section id="features" className="py-20 px-6 bg-slate-50 border-b border-slate-200">
          <div className="max-w-5xl mx-auto">
            <h2 className="text-3xl font-bold text-slate-900">What you get</h2>
            <div className="mt-8 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
              {FEATURES.map((f) => (
                <div key={f.title} className="p-5 rounded-xl bg-white border border-slate-200">
                  <span className="material-symbols-outlined text-indigo-600">{f.icon}</span>
                  <h3 className="mt-3 font-semibold text-slate-900">{f.title}</h3>
                  <p className="mt-1 text-slate-600 text-sm">{f.desc}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section className="py-20 px-6 bg-indigo-600 text-white text-center">
          <h2 className="text-3xl font-bold">Ready to try it?</h2>
          <p className="mt-3 text-indigo-100">Sign in to your workspace to get started.</p>
          <Link
            to="/auth"
            className="inline-block mt-6 px-6 py-3 rounded-lg bg-white text-indigo-700 font-medium hover:bg-indigo-50"
          >
            Sign in
          </Link>
        </section>
      </main>

      <footer className="py-6 px-6 text-center text-sm text-slate-500">
        © {new Date().getFullYear()} Lokality AI
      </footer>
    </div>
  );
}
