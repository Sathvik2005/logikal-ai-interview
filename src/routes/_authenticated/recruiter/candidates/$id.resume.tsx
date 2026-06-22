import { createFileRoute, Link } from "@tanstack/react-router";
import { CardShadow, Icon } from "@/components/recruiter/RecruiterShell";
import { scoreColor } from "@/components/recruiter/mock-data";
import { useCandidateQuery } from "@/components/recruiter/use-candidates";
import { EmptyState } from "@/components/shared/EmptyState";
import { ErrorState } from "@/components/shared/ErrorState";

export const Route = createFileRoute("/_authenticated/recruiter/candidates/$id/resume")({
  component: ResumeIntelligence,
  errorComponent: ({ error, reset }) => <ErrorState error={error} reset={reset} />,
});

function ResumeIntelligence() {
  const { id } = Route.useParams();
  const { data: c, isLoading } = useCandidateQuery(id);

  if (isLoading) return <div className="p-lg text-on-surface-variant">Loading resume…</div>;
  if (!c) {
    return (
      <EmptyState
        icon="description"
        title="Resume not available"
        description="No resume data for this candidate yet."
        action={
          <Link to="/recruiter/candidates" className="text-primary hover:underline">
            ← Back to candidates
          </Link>
        }
      />
    );
  }

  const sections = [
    {
      label: "Skill Match",
      score: Math.min(100, Math.max(40, c.score + 3)),
      summary: `${c.skills.length} captured skill${c.skills.length === 1 ? "" : "s"} for ${c.role || "the role"}.`,
    },
    {
      label: "Experience",
      score: Math.min(100, 60 + c.experienceYears * 5),
      summary: `${c.experienceYears} years of professional experience.`,
    },
    {
      label: "Education",
      score: 88,
      summary: "Education details to be parsed from resume upload.",
    },
    {
      label: "Cultural Fit",
      score: 79,
      summary: "Signals collaboration and learning velocity based on profile.",
    },
  ];

  return (
    <>
      <Link
        to="/recruiter/candidates/$id"
        params={{ id: c.id }}
        className="text-primary text-body-md hover:underline mb-md inline-flex items-center gap-1"
      >
        <Icon name="arrow_back" />
        Back to profile
      </Link>
      <div className="mb-lg">
        <h2 className="text-headline-lg">Resume Intelligence — {c.name}</h2>
        <p className="text-body-lg text-on-surface-variant">
          AI-parsed profile, scored across four pillars.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-md mb-lg">
        {sections.map((s) => (
          <CardShadow key={s.label} className="p-lg">
            <p className="text-label-caps uppercase text-on-surface-variant mb-2">{s.label}</p>
            <p className={`text-headline-lg ${scoreColor(s.score)}`}>{s.score}</p>
            <p className="text-body-md text-on-surface-variant mt-2">{s.summary}</p>
          </CardShadow>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-lg">
        <CardShadow className="lg:col-span-2 p-lg">
          <h3 className="text-headline-sm mb-md">Resume summary</h3>
          {c.resumeSummary ? (
            <p className="text-body-md whitespace-pre-line">{c.resumeSummary}</p>
          ) : (
            <p className="text-body-md text-on-surface-variant">
              No resume summary captured yet. Upload a resume on the candidate profile to generate
              this section.
            </p>
          )}
        </CardShadow>

        <CardShadow className="p-lg ai-insight">
          <h3 className="text-headline-sm mb-2 flex items-center gap-2">
            <Icon name="auto_awesome" className="text-secondary" />
            AI Recommendation
          </h3>
          <p className="text-body-md mb-md">
            Strong technical baseline. Recommend deep-dive on system design and behavioral
            leadership questions in the next interview.
          </p>
          <Link
            to="/recruiter/scheduling"
            className="inline-flex items-center gap-1 text-primary hover:underline"
          >
            Schedule deep-dive interview <Icon name="arrow_forward" />
          </Link>
        </CardShadow>
      </div>
    </>
  );
}
