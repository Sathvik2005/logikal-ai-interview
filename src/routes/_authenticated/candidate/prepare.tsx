import { createFileRoute, Link } from "@tanstack/react-router";
import { Card, Icon } from "@/components/candidate/CandidateShell";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { getMyCandidateInterview } from "@/lib/candidate-self.functions";
import { z } from "zod";

export const Route = createFileRoute("/_authenticated/candidate/prepare")({
  validateSearch: (search) => z.object({ interviewId: z.string().uuid().optional() }).parse(search),
  component: PreparePage,
});

function PreparePage() {
  const { interviewId } = Route.useSearch();
  const fetchInterview = useServerFn(getMyCandidateInterview);

  const query = useQuery({
    queryKey: ["candidate-prepare", interviewId],
    queryFn: () => fetchInterview({ data: { interviewId } as any }),
  });

  const interview = query.data;
  const durationMinutes = interview?.duration_minutes ?? 45;
  const personaName = interview?.personaName ?? "AI Interviewer";
  const jobTitle = interview?.jobTitle ?? "your position";

  return (
    <div className="space-y-lg max-w-4xl mx-auto">
      <header>
        <h1 className="text-headline-lg font-headline-lg text-on-surface">
          Prepare for {jobTitle}
        </h1>
        <p className="text-body-lg text-on-surface-variant mt-1">
          Please review the instructions below for your upcoming session with {personaName}.
        </p>
      </header>

      <Card className="p-lg">
        <h2 className="text-headline-sm font-headline-sm text-on-surface mb-md flex items-center gap-2">
          <Icon name="info" className="text-primary" /> Interview Instructions
        </h2>
        <ul className="space-y-2 text-body-md text-on-surface-variant list-disc pl-5">
          <li>The interview is conducted by our AI interviewer, {personaName}, in real time.</li>
          <li>Answer each question clearly and at your own pace.</li>
          <li>Speak naturally — there is no need to memorize answers.</li>
          <li>You may take a brief moment to think before responding.</li>
          <li>The interview duration is approximately {durationMinutes} minutes.</li>
        </ul>
      </Card>

      <div className="grid md:grid-cols-2 gap-lg">
        <Card className="p-lg">
          <h2 className="text-headline-sm font-headline-sm text-on-surface mb-md flex items-center gap-2">
            <Icon name="rule" className="text-primary" /> Guidelines & Rules
          </h2>
          <ul className="space-y-2 text-body-md text-on-surface-variant list-disc pl-5">
            <li>Do not use external help, notes, or other people.</li>
            <li>Keep your face visible to the camera at all times.</li>
            <li>Do not leave the interview tab or switch windows.</li>
            <li>Avoid background noise and interruptions.</li>
            <li>The session will be recorded for evaluation purposes.</li>
          </ul>
        </Card>

        <Card className="p-lg">
          <h2 className="text-headline-sm font-headline-sm text-on-surface mb-md flex items-center gap-2">
            <Icon name="devices" className="text-primary" /> Device Requirements
          </h2>
          <ul className="space-y-2 text-body-md text-on-surface-variant list-disc pl-5">
            <li>Desktop or laptop (mobile not recommended).</li>
            <li>Working webcam with clear video.</li>
            <li>Working microphone and speakers (headphones preferred).</li>
            <li>Stable internet connection (≥ 5 Mbps).</li>
            <li>Quiet, well-lit room.</li>
          </ul>
        </Card>

        <Card className="p-lg">
          <h2 className="text-headline-sm font-headline-sm text-on-surface mb-md flex items-center gap-2">
            <Icon name="public" className="text-primary" /> Browser Requirements
          </h2>
          <ul className="space-y-2 text-body-md text-on-surface-variant list-disc pl-5">
            <li>Latest Chrome, Edge, Firefox, or Safari.</li>
            <li>Pop-ups and JavaScript enabled.</li>
            <li>Camera and microphone permissions allowed.</li>
            <li>Close unnecessary tabs and applications.</li>
          </ul>
        </Card>

        <Card className="p-lg">
          <h2 className="text-headline-sm font-headline-sm text-on-surface mb-md flex items-center gap-2">
            <Icon name="videocam" className="text-primary" /> Camera & Microphone
          </h2>
          <ul className="space-y-2 text-body-md text-on-surface-variant list-disc pl-5">
            <li>Grant camera and microphone access when prompted.</li>
            <li>Position the camera at eye level.</li>
            <li>Test your audio output before proceeding.</li>
            <li>Use headphones to avoid echo.</li>
          </ul>
        </Card>
      </div>

      <Card className="p-lg bg-primary-container/30 border-primary/30">
        <h2 className="text-headline-sm font-headline-sm text-on-primary-container mb-2 flex items-center gap-2">
          <Icon name="warning" /> Expectations
        </h2>
        <p className="text-body-md text-on-primary-container">
          Be honest and authentic. The AI evaluates communication, technical knowledge, and
          problem-solving. Any attempt to circumvent the interview process may disqualify your
          application.
        </p>
      </Card>

      <div className="flex justify-end">
        <Link
          to="/candidate/system-check"
          search={{ interviewId }}
          className="px-6 py-3 rounded-lg bg-primary text-on-primary font-semibold text-body-lg hover:brightness-110 flex items-center gap-2"
        >
          Start Diagnostics <Icon name="arrow_forward" />
        </Link>
      </div>
    </div>
  );
}
