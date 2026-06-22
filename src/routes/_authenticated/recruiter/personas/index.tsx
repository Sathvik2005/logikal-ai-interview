import { createFileRoute, Link } from "@tanstack/react-router";
import { CardShadow, Icon, EmptyState, SkeletonCard } from "@/components/recruiter/RecruiterShell";
import { usePersonasQuery, type PersonaDTO } from "@/components/recruiter/use-personas";

export const Route = createFileRoute("/_authenticated/recruiter/personas/")({
  component: PersonasList,
});

function PersonasList() {
  const { data, isLoading, error } = usePersonasQuery();
  const personas = (data ?? []) as PersonaDTO[];

  return (
    <>
      <div className="mb-lg grid grid-cols-[minmax(0,1fr)_auto] items-center gap-md sm:flex sm:flex-wrap sm:justify-between">
        <div className="min-w-0">
          <h2 className="text-headline-lg">AI Persona Builder</h2>
          <p className="text-body-lg text-on-surface-variant">
            Design AI interviewers tuned for your roles, tone, and difficulty.
          </p>
        </div>
        <div className="flex gap-sm">
          <Link
            to="/recruiter/personas/prompt"
            className="px-4 py-2 border border-outline-variant rounded-lg flex items-center gap-2 hover:bg-surface-container-low"
          >
            <Icon name="terminal" />
            Prompt Editor
          </Link>
          <Link
            to="/recruiter/personas/new"
            className="px-4 py-2 bg-primary text-on-primary rounded-lg flex items-center gap-2 hover:brightness-110"
          >
            <Icon name="add" />
            New Persona
          </Link>
        </div>
      </div>

      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-lg">
          <SkeletonCard />
          <SkeletonCard />
          <SkeletonCard />
        </div>
      ) : error ? (
        <CardShadow className="p-lg">
          <EmptyState title="Couldn't load personas" hint={(error as Error).message} />
        </CardShadow>
      ) : personas.length === 0 ? (
        <CardShadow className="p-lg">
          <EmptyState
            title="No personas yet"
            hint="Create your first AI interviewer persona."
            action={
              <Link
                to="/recruiter/personas/new"
                className="px-4 py-2 bg-primary text-on-primary rounded-lg inline-flex items-center gap-2"
              >
                <Icon name="add" />
                New Persona
              </Link>
            }
          />
        </CardShadow>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-lg">
          {personas.map((p) => (
            <CardShadow key={p.id} className="p-lg">
              <div className="flex items-center gap-3 mb-md">
                <div className="w-12 h-12 rounded-full bg-primary-container text-on-primary-container flex items-center justify-center">
                  <Icon name="psychology" />
                </div>
                <div className="min-w-0">
                  <h3 className="text-headline-sm truncate">{p.name}</h3>
                  <p className="text-label-caps uppercase text-on-surface-variant">
                    {p.personaType ?? "general"}
                  </p>
                </div>
              </div>
              <div className="space-y-1 text-body-md text-on-surface-variant">
                <p>
                  Tone: <span className="text-on-surface">{p.tone ?? "—"}</span>
                </p>
                <p>
                  Difficulty: <span className="text-on-surface">{p.difficulty ?? "—"}</span>
                </p>
                <p>{p.interviewCount} interviews conducted</p>
              </div>
              <div className="mt-md flex gap-sm">
                <Link
                  to="/recruiter/personas/new"
                  className="flex-1 text-center px-3 py-2 border border-outline-variant rounded-lg hover:bg-surface-container-low"
                >
                  Edit
                </Link>
                <Link
                  to="/recruiter/scheduling"
                  className="flex-1 text-center px-3 py-2 bg-primary text-on-primary rounded-lg hover:brightness-110"
                >
                  Use in interview
                </Link>
              </div>
            </CardShadow>
          ))}
        </div>
      )}
    </>
  );
}
