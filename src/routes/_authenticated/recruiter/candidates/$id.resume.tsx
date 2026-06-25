import { createFileRoute, Link } from "@tanstack/react-router";
import { useState, useEffect, useMemo } from "react";
import { toast } from "sonner";
import { CardShadow, Icon } from "@/components/recruiter/RecruiterShell";
import { scoreColor } from "@/components/recruiter/mock-data";
import { useCandidateQuery, useUpdateCandidateProfile } from "@/components/recruiter/use-candidates";
import { EmptyState } from "@/components/shared/EmptyState";
import { ErrorState } from "@/components/shared/ErrorState";

export const Route = createFileRoute("/_authenticated/recruiter/candidates/$id/resume")({
  component: ResumeIntelligence,
  errorComponent: ({ error, reset }) => <ErrorState error={error} reset={reset} />,
});

const inputCls =
  "w-full px-3 py-2 border border-outline-variant rounded-lg text-sm bg-white focus:ring-2 focus:ring-primary-container outline-none placeholder:text-outline";

function ResumeIntelligence() {
  const { id } = Route.useParams();
  const { data: c, isLoading } = useCandidateQuery(id);
  const updateMut = useUpdateCandidateProfile();

  const [editing, setEditing] = useState(false);
  const [activeTab, setActiveTab] = useState<"basics" | "history" | "skills" | "projects">("basics");
  const [analysisForm, setAnalysisForm] = useState<any>({});

  useEffect(() => {
    if (c?.resumeAnalysis) {
      setAnalysisForm(c.resumeAnalysis);
    }
  }, [c]);

  const setField = (key: string, val: any) => {
    setAnalysisForm((prev: any) => ({ ...prev, [key]: val }));
  };

  const handleSave = async () => {
    try {
      await updateMut.mutateAsync({
        id: c!.id,
        resumeAnalysis: analysisForm,
      });
      toast.success("Resume intelligence profile updated successfully.");
      setEditing(false);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to save updates.");
    }
  };

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

  // Fallbacks if resume hasn't been parsed yet
  const summaryText = analysisForm.resumeSummary || c.resumeSummary || "No summary parsed from resume.";
  const matchRec = analysisForm.jdMatchSuggestions || "Upload a resume on the candidate profile to run AI matching analysis.";

  // Render display or input field
  const renderField = (label: string, key: string, isTextArea = false) => {
    if (editing) {
      return (
        <label className="block mb-3">
          <span className="block text-xs font-semibold text-on-surface-variant mb-1">{label}</span>
          {isTextArea ? (
            <textarea
              className={`${inputCls} min-h-[80px]`}
              value={analysisForm[key] || ""}
              onChange={(e) => setField(key, e.target.value)}
            />
          ) : (
            <input
              className={inputCls}
              value={analysisForm[key] || ""}
              onChange={(e) => setField(key, e.target.value)}
            />
          )}
        </label>
      );
    }

    return (
      <div className="mb-4">
        <p className="text-xs font-semibold text-on-surface-variant">{label}</p>
        <p className="text-sm text-on-surface mt-1 whitespace-pre-line">{analysisForm[key] || <span className="text-outline">—</span>}</p>
      </div>
    );
  };

  const renderArrayField = (label: string, key: string) => {
    const arrVal = Array.isArray(analysisForm[key]) ? analysisForm[key] : [];
    if (editing) {
      return (
        <label className="block mb-3">
          <span className="block text-xs font-semibold text-on-surface-variant mb-1">{label} (comma-separated)</span>
          <input
            className={inputCls}
            value={arrVal.join(", ")}
            onChange={(e) => {
              const parsed = e.target.value.split(",").map(s => s.trim()).filter(Boolean);
              setField(key, parsed);
            }}
          />
        </label>
      );
    }

    return (
      <div className="mb-4">
        <p className="text-xs font-semibold text-on-surface-variant">{label}</p>
        <div className="flex flex-wrap gap-1 mt-1.5">
          {arrVal.length > 0 ? (
            arrVal.map((s: string) => (
              <span key={s} className="px-2 py-0.5 rounded bg-primary-fixed text-primary text-xs font-medium">
                {s}
              </span>
            ))
          ) : (
            <span className="text-outline text-xs">—</span>
          )}
        </div>
      </div>
    );
  };

  return (
    <>
      <div className="flex items-center justify-between gap-md mb-md">
        <Link
          to="/recruiter/candidates/$id"
          params={{ id: c.id }}
          className="text-primary text-body-md hover:underline inline-flex items-center gap-1"
        >
          <Icon name="arrow_back" />
          Back to profile
        </Link>

        <div className="flex items-center gap-2">
          {editing ? (
            <>
              <button
                type="button"
                onClick={() => {
                  setAnalysisForm(c.resumeAnalysis || {});
                  setEditing(false);
                }}
                className="px-3 py-1.5 border border-outline-variant text-sm font-semibold rounded-lg hover:bg-surface-container-low text-on-surface"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleSave}
                disabled={updateMut.isPending}
                className="px-4 py-1.5 bg-primary text-on-primary text-sm font-semibold rounded-lg hover:brightness-110 inline-flex items-center gap-1.5 shadow-sm"
              >
                <Icon name="save" />
                Save Profile
              </button>
            </>
          ) : (
            <button
              type="button"
              onClick={() => setEditing(true)}
              className="px-4 py-1.5 bg-secondary text-on-primary text-sm font-semibold rounded-lg hover:brightness-110 inline-flex items-center gap-1.5 shadow-sm"
            >
              <Icon name="edit" />
              Edit Profile Fields
            </button>
          )}
        </div>
      </div>

      <div className="mb-lg">
        <h2 className="text-headline-lg">Resume Intelligence — {c.name}</h2>
        <p className="text-body-lg text-on-surface-variant">
          Explore and manage AI-extracted resume properties and keywords.
        </p>
      </div>

      {/* Tab controls */}
      <div className="flex border-b border-outline-variant gap-6 mb-lg overflow-x-auto shrink-0">
        {(["basics", "history", "skills", "projects"] as const).map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`pb-2 text-sm font-semibold capitalize border-b-2 transition whitespace-nowrap ${
              activeTab === tab
                ? "border-primary text-primary"
                : "border-transparent text-on-surface-variant hover:text-on-surface"
            }`}
          >
            {tab === "basics" ? "Basics & Contact" : tab === "history" ? "Work History & Education" : tab === "skills" ? "Skills & Expertise" : "Highlights & Recommendations"}
          </button>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-lg">
        {/* Left Column: Parsed fields */}
        <CardShadow className="lg:col-span-2 p-lg bg-white">
          {activeTab === "basics" && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-x-md">
              <div className="col-span-2 mb-4 pb-2 border-b border-outline-variant">
                <h3 className="text-headline-sm">Basic Candidate Details</h3>
              </div>
              {renderField("Contact Name", "name")}
              {renderField("Contact Email", "email")}
              {renderField("Contact Phone", "phone")}
              {renderField("Current Role Title", "currentRole")}
              {renderField("Suggested Seniority Level", "suggestedSeniority")}
            </div>
          )}

          {activeTab === "history" && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-x-md">
              <div className="col-span-2 mb-4 pb-2 border-b border-outline-variant">
                <h3 className="text-headline-sm">Experience & Background</h3>
              </div>
              {editing ? (
                <label className="block mb-3">
                  <span className="block text-xs font-semibold text-on-surface-variant mb-1">Years of Experience</span>
                  <input
                    type="number"
                    className={inputCls}
                    value={analysisForm.experienceYears || 0}
                    onChange={(e) => setField("experienceYears", Number(e.target.value))}
                  />
                </label>
              ) : (
                <div className="mb-4">
                  <p className="text-xs font-semibold text-on-surface-variant">Years of Experience</p>
                  <p className="text-sm font-medium mt-1">{analysisForm.experienceYears ?? 0} Years</p>
                </div>
              )}
              {renderArrayField("Previous Companies", "previousCompanies")}
              {renderField("Highest Education Degree", "education")}
              {renderArrayField("Certifications", "certifications")}
              {renderArrayField("Languages", "languages")}
            </div>
          )}

          {activeTab === "skills" && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-x-md">
              <div className="col-span-2 mb-4 pb-2 border-b border-outline-variant">
                <h3 className="text-headline-sm">Core Capabilities</h3>
              </div>
              {renderArrayField("Technical Skills", "technicalSkills")}
              {renderArrayField("Soft Skills", "softSkills")}
              {renderArrayField("Tools & Technologies", "toolsTechnologies")}
              {renderArrayField("Domain / Industry Expertise", "domainExpertise")}
            </div>
          )}

          {activeTab === "projects" && (
            <div className="space-y-4">
              <div className="mb-2 pb-2 border-b border-outline-variant">
                <h3 className="text-headline-sm">Key Highlights</h3>
              </div>
              {renderArrayField("Resume Keywords", "resumeKeywords")}
              {renderArrayField("Projects", "projects")}
              {renderField("Executive Summary", "resumeSummary", true)}
              {renderField("JD Match Analysis & Suggestions", "jdMatchSuggestions", true)}
            </div>
          )}
        </CardShadow>

        {/* Right Column: AI Score Summary / Match Insights */}
        <div className="space-y-lg">
          <CardShadow className="p-lg bg-white">
            <h3 className="text-headline-sm mb-md">Screening Summary</h3>
            <div className="space-y-md text-body-md">
              <div>
                <p className="text-label-caps uppercase text-on-surface-variant">Extracted Role</p>
                <p className="font-semibold text-on-surface">{analysisForm.currentRole || c.role || "Not specified"}</p>
              </div>
              <div>
                <p className="text-label-caps uppercase text-on-surface-variant">Experience Match</p>
                <p className="font-medium text-on-surface">{analysisForm.experienceYears ?? c.experienceYears} Years</p>
              </div>
              <div>
                <p className="text-label-caps uppercase text-on-surface-variant">Profile Score</p>
                <div className="flex items-center gap-2 mt-1">
                  <span className={`text-headline-lg font-bold ${scoreColor(c.score)}`}>{c.score}%</span>
                  <span className="text-xs text-on-surface-variant">Based on role fit</span>
                </div>
              </div>
            </div>
          </CardShadow>

          <CardShadow className="p-lg bg-surface-container-low border border-outline-variant">
            <h3 className="text-headline-sm mb-2 flex items-center gap-2">
              <Icon name="auto_awesome" className="text-secondary" />
              AI Recommendation
            </h3>
            <p className="text-body-md text-on-surface-variant mb-md whitespace-pre-line">
              {matchRec}
            </p>
            <Link
              to="/recruiter/scheduling"
              className="inline-flex items-center gap-1 text-primary hover:underline font-semibold text-sm"
            >
              Schedule benchmark interview <Icon name="arrow_forward" />
            </Link>
          </CardShadow>
        </div>
      </div>
    </>
  );
}
