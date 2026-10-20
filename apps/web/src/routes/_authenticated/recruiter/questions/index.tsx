import { createFileRoute, Link } from "@tanstack/react-router";

import { useState } from "react";
import {
  CardShadow,
  Icon,
  EmptyState,
  SkeletonCard,
  LoadingRow,
} from "@/components/recruiter/RecruiterShell";
import {
  useQuestionBanksQuery,
  useQuestionsQuery,
  useDeleteQuestion,
  type QuestionBankDTO,
  type QuestionDTO,
} from "@/components/recruiter/use-questions";
import { QuestionBankWizard } from "@/components/recruiter/QuestionBankWizard";

export const Route = createFileRoute("/_authenticated/recruiter/questions/")({
  component: QuestionBank,
});

function QuestionBank() {
  const banksQ = useQuestionBanksQuery();
  const banks = (banksQ.data ?? []) as QuestionBankDTO[];
  const [open, setOpen] = useState<string | null>(null);
  const [wizardOpen, setWizardOpen] = useState(false);
  const competency = open ?? banks[0]?.competency ?? undefined;
  const listQ = useQuestionsQuery(competency);
  const questions = (listQ.data ?? []) as QuestionDTO[];
  const remove = useDeleteQuestion();

  return (
    <>
      <div className="mb-lg grid grid-cols-[minmax(0,1fr)_auto] items-center gap-md sm:flex sm:flex-wrap sm:justify-between">
        <div className="min-w-0">
          <h2 className="text-headline-lg">Question Bank Builder</h2>
          <p className="text-body-lg text-on-surface-variant">
            Curate competency-tagged questions your personas draw from.
          </p>
        </div>
        <button
          type="button"
          onClick={() => setWizardOpen(true)}
          className="px-4 py-2 bg-primary text-on-primary rounded-lg flex items-center gap-2 hover:brightness-110"
        >
          <Icon name="add" />
          New Question
        </button>
      </div>
      <QuestionBankWizard
        open={wizardOpen}
        onOpenChange={setWizardOpen}
        defaultCompetency={competency ?? ""}
      />

      {banksQ.isLoading ? (
        <SkeletonCard />
      ) : banks.length === 0 ? (
        <CardShadow className="p-lg">
          <EmptyState
            title="No questions yet"
            hint="Add your first question to build a competency bank."
          />
        </CardShadow>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-lg">
          <CardShadow className="p-md">
            <ul className="divide-y divide-outline-variant">
              {banks.map((b) => (
                <li key={b.competency}>
                  <button
                    type="button"
                    onClick={() => setOpen(b.competency)}
                    className={`w-full text-left p-md rounded-lg transition ${competency === b.competency ? "bg-primary-container text-on-primary-container" : "hover:bg-surface-container-low"}`}
                  >
                    <p className="font-semibold">{b.competency}</p>
                    <p className="text-label-caps uppercase opacity-80">
                      {b.count} questions • {b.difficulties.join(", ") || "mixed"}
                    </p>
                  </button>
                </li>
              ))}
            </ul>
          </CardShadow>

          <CardShadow className="lg:col-span-2 p-lg">
            <div className="flex items-center justify-between mb-md">
              <h3 className="text-headline-sm">{competency ?? "—"}</h3>
              <Link
                to="/recruiter/scheduling"
                className="px-3 py-1.5 bg-primary text-on-primary rounded-lg text-body-md hover:brightness-110"
              >
                Use in interview
              </Link>
            </div>
            {listQ.isLoading ? (
              <LoadingRow />
            ) : questions.length === 0 ? (
              <EmptyState title="No questions in this bank" />
            ) : (
              <ul className="divide-y divide-outline-variant">
                {questions.map((q) => (
                  <li key={q.id} className="p-md flex items-start gap-3">
                    <Icon name="quiz" className="text-primary mt-1" />
                    <div className="flex-1 min-w-0">
                      <p className="text-body-md">{q.prompt}</p>
                      <p className="text-label-caps uppercase text-on-surface-variant mt-1">
                        {q.competency} • {q.difficulty} • {q.type}
                      </p>
                      {q.expectedSignals.length > 0 && (
                        <p className="text-label-caps text-on-surface-variant mt-1">
                          Signals: {q.expectedSignals.join(", ")}
                        </p>
                      )}
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        if (confirm("Delete this question?")) remove.mutate(q.id);
                      }}
                      className="text-on-surface-variant hover:text-error"
                      aria-label="Remove"
                    >
                      <Icon name="delete" />
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </CardShadow>
        </div>
      )}
    </>
  );
}
