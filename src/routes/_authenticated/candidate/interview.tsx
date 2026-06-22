import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { toast } from "sonner";
import { Card, Icon } from "@/components/candidate/CandidateShell";
import {
  useAppendInterviewTurn,
  useEndSession,
  useFinalizeEvaluation,
  useNextPersonaQuestion,
  useSessionTurns,
  useStartSession,
} from "@/components/recruiter/use-interview-runtime";
import { getMyCandidateInterview } from "@/lib/candidate-self.functions";
import { startIdentityVerification, generateInterviewReport } from "@/lib/proctoring.functions";
import { useProctor } from "@/components/candidate/useProctor";

export const Route = createFileRoute("/_authenticated/candidate/interview")({
  validateSearch: z.object({ interviewId: z.string().uuid().optional() }),
  component: InterviewOrchestrator,
});

type Phase = "boot" | "waiting" | "briefing" | "device" | "identity" | "proctor" | "room" | "completed" | "no-interview";

type InterviewMeta = {
  id: string;
  status: string | null;
  scheduled_at: string | null;
  duration_minutes: number | null;
  candidate: { full_name: string | null; role_applied: string | null };
  personaName?: string | null;
  jobTitle?: string | null;
  curatedQuestionCount?: number;
} | null;


function withinWindow(scheduledAt: string | null, durationMinutes: number | null): boolean {
  if (!scheduledAt) return true;
  const start = new Date(scheduledAt).getTime();
  const end = start + (durationMinutes ?? 45) * 60_000;
  const now = Date.now();
  return now >= start - 10 * 60_000 && now <= end + 30 * 60_000;
}

function InterviewOrchestrator() {
  const { interviewId } = Route.useSearch();
  const [phase, setPhase] = useState<Phase>("boot");
  const [interview, setInterview] = useState<InterviewMeta>(null);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [webcamStream, setWebcamStream] = useState<MediaStream | null>(null);
  const [screenStream, setScreenStream] = useState<MediaStream | null>(null);

  const resolveInterview = useServerFn(getMyCandidateInterview);
  const startSession = useStartSession();

  useEffect(() => {
    (async () => {
      const found = await resolveInterview({ data: { interviewId } as never }).catch(() => null);
      if (!found) {
        setPhase("no-interview");
        return;
      }
      setInterview(found as unknown as InterviewMeta);
      const meta = found as unknown as NonNullable<InterviewMeta>;

      if (!withinWindow(meta.scheduled_at, meta.duration_minutes)) {
        setPhase("waiting");
        return;
      }
      setPhase("briefing");
    })();
  }, [resolveInterview, interviewId]);


  // Cleanup all media streams on unmount
  useEffect(() => {
    return () => {
      webcamStream?.getTracks().forEach((t) => t.stop());
      screenStream?.getTracks().forEach((t) => t.stop());
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (phase === "boot") {
    return <CenterMsg icon="hourglass_top" title="Preparing your interview…" />;
  }
  if (phase === "no-interview") {
    return (
      <CenterMsg
        icon="event_busy"
        title="No interview scheduled"
        body="We could not find an interview linked to your account. Please contact your recruiter."
      />
    );
  }
  if (phase === "waiting" && interview) {
    return (
      <WaitingScreen
        interview={interview}
        onReady={() => setPhase("briefing")}
      />
    );
  }
  if (phase === "briefing") {
    return <BriefingScreen interview={interview} onStart={() => setPhase("device")} />;
  }
  if (phase === "device") {
    return (
      <DeviceCheckScreen
        onPass={(stream) => {
          setWebcamStream(stream);
          setPhase("identity");
        }}
      />
    );
  }
  if (phase === "identity" && interview) {
    return (
      <IdentityScreen
        interviewId={interview.id}
        webcamStream={webcamStream}
        onDone={() => setPhase("proctor")}
      />
    );
  }
  if (phase === "proctor" && interview) {
    return (
      <ProctorScreen
        onReady={async (scr) => {
          setScreenStream(scr);
          const sess = await startSession.mutateAsync({
            interviewId: interview.id,
            deviceInfo: {
              ua: navigator.userAgent,
              tz: Intl.DateTimeFormat().resolvedOptions().timeZone,
              screen: { w: screen.width, h: screen.height },
              language: navigator.language,
            },
          });
          setSessionId(sess.id);
          setPhase("room");
        }}
      />
    );
  }
  if (phase === "room" && sessionId && interview) {
    return (
      <InterviewRoom
        interview={interview}
        sessionId={sessionId}
        webcamStream={webcamStream}
        screenStream={screenStream}
        onCompleted={() => {
          webcamStream?.getTracks().forEach((t) => t.stop());
          screenStream?.getTracks().forEach((t) => t.stop());
          if (document.fullscreenElement) document.exitFullscreen().catch(() => undefined);
          setPhase("completed");
        }}
      />
    );
  }
  if (phase === "completed") {
    return <CompletionScreen />;
  }
  return null;
}

/* ----------------------------- helpers ----------------------------- */

function CenterMsg({ icon, title, body }: { icon: string; title: string; body?: string }) {
  return (
    <Card className="max-w-xl mx-auto p-lg text-center space-y-md">
      <div className="w-16 h-16 rounded-full bg-primary-container text-on-primary-container mx-auto flex items-center justify-center">
        <Icon name={icon} className="text-3xl" />
      </div>
      <h2 className="text-headline-md font-headline-md text-on-surface">{title}</h2>
      {body && <p className="text-body-md text-on-surface-variant">{body}</p>}
    </Card>
  );
}

/* ----------------------------- 0. Waiting room ----------------------------- */

function WaitingScreen({ interview, onReady }: { interview: NonNullable<InterviewMeta>; onReady: () => void }) {
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    const id = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(id);
  }, []);

  const role = interview.candidate?.role_applied ?? "your interview";
  const scheduled = interview.scheduled_at ? new Date(interview.scheduled_at).getTime() : null;
  const duration = interview.duration_minutes ?? 45;
  const opensAt = scheduled ? scheduled - 10 * 60_000 : null;
  const closedAt = scheduled ? scheduled + duration * 60_000 + 30 * 60_000 : null;

  // Auto-advance the moment the window opens
  useEffect(() => {
    if (!opensAt) {
      onReady();
      return;
    }
    if (now >= opensAt && (!closedAt || now <= closedAt)) onReady();
  }, [now, opensAt, closedAt, onReady]);

  if (!scheduled) return <CenterMsg icon="hourglass_top" title="Preparing your interview…" />;

  if (closedAt && now > closedAt) {
    return (
      <CenterMsg
        icon="event_busy"
        title="This interview window has closed"
        body="Please contact your recruiter to reschedule."
      />
    );
  }

  const target = opensAt ?? scheduled;
  const remaining = Math.max(0, target - now);
  const d = Math.floor(remaining / 86_400_000);
  const h = Math.floor((remaining % 86_400_000) / 3_600_000);
  const m = Math.floor((remaining % 3_600_000) / 60_000);
  const s = Math.floor((remaining % 60_000) / 1000);
  const pad = (n: number) => String(n).padStart(2, "0");

  return (
    <Card className="max-w-2xl mx-auto p-lg text-center space-y-md">
      <div className="w-16 h-16 rounded-full bg-primary-container text-on-primary-container mx-auto flex items-center justify-center">
        <Icon name="schedule" className="text-3xl" />
      </div>
      <h1 className="text-headline-lg font-headline-lg text-on-surface">You're early — hang tight</h1>
      <p className="text-body-md text-on-surface-variant">
        Your interview for <span className="font-semibold">{role}</span> is scheduled for{" "}
        <span className="font-semibold">
          {new Date(scheduled).toLocaleString(undefined, { dateStyle: "full", timeStyle: "short" })}
        </span>
        . You'll be let into the room automatically 10 minutes before it starts.
      </p>

      <div className="grid grid-cols-4 gap-2 max-w-md mx-auto pt-2" aria-label="Countdown">
        {[{ l: "Days", v: d }, { l: "Hours", v: h }, { l: "Min", v: m }, { l: "Sec", v: s }].map((x) => (
          <div key={x.l} className="bg-surface-container-low rounded-lg p-3">
            <p className="text-display-sm font-bold tabular-nums text-on-surface">{pad(x.v)}</p>
            <p className="text-label-sm uppercase text-on-surface-variant">{x.l}</p>
          </div>
        ))}
      </div>

      <p className="text-body-sm text-on-surface-variant">
        Keep this tab open. The interview will auto-start when the room opens.
      </p>
      <div className="flex justify-center gap-2 pt-2">
        <button
          type="button"
          onClick={() => (window.location.href = "/candidate")}
          className="px-4 py-2 rounded-lg border border-outline-variant text-on-surface text-body-md"
        >
          Back to dashboard
        </button>
      </div>
    </Card>
  );
}

/* ----------------------------- 1. Briefing ----------------------------- */

function BriefingScreen({ interview, onStart }: { interview: InterviewMeta; onStart: () => void }) {
  const role = interview?.candidate?.role_applied ?? "the role";
  const personaName = interview?.personaName ?? "AI Interviewer";
  const jobTitle = interview?.jobTitle ?? null;
  const curated = interview?.curatedQuestionCount ?? 0;
  return (
    <div className="max-w-3xl mx-auto space-y-md">
      <Card className="p-lg space-y-sm">
        <h1 className="text-headline-lg font-headline-lg text-on-surface">AI Interview Briefing</h1>
        <p className="text-body-md text-on-surface-variant">
          You are about to begin your interview for {jobTitle ?? role}.
        </p>
        <div className="grid grid-cols-2 gap-sm pt-2 text-body-sm">
          <Meta label="Duration" value={`${interview?.duration_minutes ?? 45} minutes`} />
          <Meta label="Status" value={interview?.status ?? "scheduled"} />
          <Meta label="Interviewer" value={personaName} />
          <Meta label="Curated questions" value={curated > 0 ? `${curated} prepared` : "Adaptive"} />
        </div>
      </Card>


      <Card className="p-lg">
        <h2 className="text-title-md font-semibold mb-sm text-on-surface">Before you begin</h2>
        <ul className="space-y-2 text-body-md text-on-surface">
          {[
            "Stable internet connection",
            "Working webcam (required)",
            "Working microphone (required)",
            "Fullscreen mode (required)",
            "Entire-screen sharing (required)",
          ].map((t) => (
            <li key={t} className="flex items-center gap-2">
              <Icon name="check_circle" className="text-success" /> {t}
            </li>
          ))}
        </ul>
      </Card>

      <div className="flex justify-end">
        <button
          type="button"
          onClick={onStart}
          className="px-6 py-3 rounded-lg bg-primary text-on-primary font-semibold flex items-center gap-2 hover:brightness-110"
        >
          Start Interview <Icon name="arrow_forward" />
        </button>
      </div>
    </div>
  );
}

function Meta({ label, value }: { label: string; value: string }) {
  return (
    <div className="bg-surface-container-low rounded-lg p-3">
      <p className="text-label-sm text-on-surface-variant uppercase">{label}</p>
      <p className="text-body-md text-on-surface font-semibold">{value}</p>
    </div>
  );
}

/* ----------------------------- 2. Device check ----------------------------- */

type CheckState = "idle" | "ok" | "fail";

function DeviceCheckScreen({ onPass }: { onPass: (s: MediaStream) => void }) {
  const [cam, setCam] = useState<CheckState>("idle");
  const [mic, setMic] = useState<CheckState>("idle");
  const [net, setNet] = useState<CheckState>("idle");
  const [browser, setBrowser] = useState<CheckState>("idle");
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);

  useEffect(() => {
    setBrowser(navigator.mediaDevices && window.MediaRecorder ? "ok" : "fail");
    setNet(navigator.onLine ? "ok" : "fail");
  }, []);

  async function runChecks() {
    setBusy(true);
    setErr(null);
    try {
      const s = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
      setStream(s);
      setCam(s.getVideoTracks().length ? "ok" : "fail");
      setMic(s.getAudioTracks().length ? "ok" : "fail");
      if (videoRef.current) {
        videoRef.current.srcObject = s;
        await videoRef.current.play().catch(() => undefined);
      }
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e));
      setCam("fail");
      setMic("fail");
    } finally {
      setBusy(false);
    }
  }

  const allPass = cam === "ok" && mic === "ok" && net === "ok" && browser === "ok";

  return (
    <div className="max-w-4xl mx-auto space-y-md">
      <Card className="p-lg">
        <h1 className="text-headline-md font-headline-md text-on-surface mb-sm">Device Check</h1>
        <p className="text-body-md text-on-surface-variant mb-md">
          We need to verify your camera, microphone, and network before the interview begins.
        </p>
        <div className="grid md:grid-cols-2 gap-md">
          <div className="space-y-2">
            <CheckRow label="Camera access" state={cam} />
            <CheckRow label="Microphone access" state={mic} />
            <CheckRow label="Speaker availability" state={mic === "ok" ? "ok" : "idle"} />
            <CheckRow label="Browser compatibility" state={browser} />
            <CheckRow label="Network online" state={net} />
            {err && <p className="text-body-sm text-error">{err}</p>}
            <button
              type="button"
              onClick={runChecks}
              disabled={busy}
              className="mt-2 px-4 py-2 rounded-lg bg-primary text-on-primary font-semibold disabled:opacity-50"
            >
              {busy ? "Checking…" : stream ? "Re-run checks" : "Run device check"}
            </button>
          </div>
          <div className="aspect-video bg-black rounded-lg overflow-hidden">
            <video ref={videoRef} className="w-full h-full object-cover" playsInline muted />
          </div>
        </div>
      </Card>
      <div className="flex justify-end">
        <button
          type="button"
          disabled={!allPass || !stream}
          onClick={() => stream && onPass(stream)}
          className="px-6 py-3 rounded-lg bg-primary text-on-primary font-semibold disabled:opacity-50 flex items-center gap-2"
        >
          Continue <Icon name="arrow_forward" />
        </button>
      </div>
    </div>
  );
}

function CheckRow({ label, state }: { label: string; state: CheckState }) {
  const icon = state === "ok" ? "check_circle" : state === "fail" ? "cancel" : "radio_button_unchecked";
  const color = state === "ok" ? "text-success" : state === "fail" ? "text-error" : "text-on-surface-variant";
  return (
    <div className="flex items-center justify-between p-3 bg-surface-container-low rounded-lg">
      <span className="text-body-md text-on-surface">{label}</span>
      <Icon name={icon} className={color} />
    </div>
  );
}

/* ----------------------------- 3. Identity ----------------------------- */

function IdentityScreen({
  interviewId,
  webcamStream,
  onDone,
}: {
  interviewId: string;
  webcamStream: MediaStream | null;
  onDone: () => void;
}) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const [selfie, setSelfie] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const submit = useServerFn(startIdentityVerification);

  useEffect(() => {
    if (webcamStream && videoRef.current) {
      videoRef.current.srcObject = webcamStream;
      videoRef.current.play().catch(() => undefined);
    }
  }, [webcamStream]);

  function capture() {
    if (!videoRef.current) return;
    const v = videoRef.current;
    const c = document.createElement("canvas");
    c.width = 480;
    c.height = Math.round(480 * ((v.videoHeight || 360) / (v.videoWidth || 640)));
    const ctx = c.getContext("2d");
    if (!ctx) return;
    ctx.drawImage(v, 0, 0, c.width, c.height);
    setSelfie(c.toDataURL("image/jpeg", 0.8));
  }

  async function confirm() {
    if (!selfie) return;
    setBusy(true);
    setErr(null);
    try {
      await submit({
        data: {
          interviewId,
          selfieDataUrl: selfie,
          deviceFingerprint: {
            ua: navigator.userAgent,
            tz: Intl.DateTimeFormat().resolvedOptions().timeZone,
            screen: { w: screen.width, h: screen.height },
          },
        } as never,
      });
      onDone();
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="max-w-3xl mx-auto space-y-md">
      <Card className="p-lg">
        <h1 className="text-headline-md font-headline-md text-on-surface mb-sm">Identity Verification</h1>
        <p className="text-body-md text-on-surface-variant mb-md">
          Please look directly at the camera and capture a clear selfie.
        </p>
        <div className="grid md:grid-cols-2 gap-md">
          <div className="aspect-video bg-black rounded-lg overflow-hidden">
            <video ref={videoRef} className="w-full h-full object-cover" playsInline muted />
          </div>
          <div className="aspect-video bg-surface-container-low rounded-lg overflow-hidden flex items-center justify-center">
            {selfie ? (
              <img src={selfie} alt="captured selfie" className="w-full h-full object-cover" />
            ) : (
              <span className="text-on-surface-variant">No capture yet</span>
            )}
          </div>
        </div>
        {err && <p className="text-body-sm text-error mt-2">{err}</p>}
        <div className="flex justify-end gap-2 mt-md">
          <button
            type="button"
            onClick={capture}
            className="px-4 py-2 rounded-lg border border-outline-variant text-on-surface"
          >
            <Icon name="camera" /> Capture
          </button>
          <button
            type="button"
            onClick={confirm}
            disabled={!selfie || busy}
            className="px-4 py-2 rounded-lg bg-primary text-on-primary font-semibold disabled:opacity-50"
          >
            {busy ? "Verifying…" : "Confirm identity"}
          </button>
        </div>
      </Card>
    </div>
  );
}

/* ----------------------------- 4. Proctoring init ----------------------------- */

function ProctorScreen({ onReady }: { onReady: (s: MediaStream) => void | Promise<void> }) {
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function go() {
    setBusy(true);
    setErr(null);
    try {
      await document.documentElement.requestFullscreen();
      const display = await navigator.mediaDevices.getDisplayMedia({
        video: { displaySurface: "monitor" } as MediaTrackConstraints,
        audio: false,
      });
      const settings = display.getVideoTracks()[0]?.getSettings() as { displaySurface?: string };
      if (settings?.displaySurface && settings.displaySurface !== "monitor") {
        display.getTracks().forEach((t) => t.stop());
        setErr("Please share your ENTIRE screen, not a window or tab.");
        setBusy(false);
        return;
      }
      await onReady(display);
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="max-w-2xl mx-auto space-y-md">
      <Card className="p-lg space-y-sm">
        <h1 className="text-headline-md font-headline-md text-on-surface">Proctoring Setup</h1>
        <p className="text-body-md text-on-surface-variant">
          This interview is monitored for integrity purposes. We will enable fullscreen and require you to share
          your entire screen. Webcam snapshots, transcript, and integrity signals will be recorded.
        </p>
        <ul className="space-y-1 text-body-sm text-on-surface mt-2">
          <li className="flex items-center gap-2"><Icon name="fullscreen" /> Fullscreen mode</li>
          <li className="flex items-center gap-2"><Icon name="screen_share" /> Entire screen sharing</li>
          <li className="flex items-center gap-2"><Icon name="videocam" /> Webcam monitoring</li>
          <li className="flex items-center gap-2"><Icon name="mic" /> Microphone monitoring</li>
        </ul>
        {err && <p className="text-body-sm text-error mt-2">{err}</p>}
        <div className="flex justify-end">
          <button
            type="button"
            onClick={go}
            disabled={busy}
            className="px-6 py-3 rounded-lg bg-primary text-on-primary font-semibold disabled:opacity-50"
          >
            {busy ? "Starting…" : "Enable proctoring & begin"}
          </button>
        </div>
      </Card>
    </div>
  );
}

/* ----------------------------- 5. Interview Room ----------------------------- */

function InterviewRoom({
  interview,
  sessionId,
  webcamStream,
  screenStream,
  onCompleted,
}: {
  interview: NonNullable<InterviewMeta>;
  sessionId: string;
  webcamStream: MediaStream | null;
  screenStream: MediaStream | null;
  onCompleted: () => void;
}) {
  const camRef = useRef<HTMLVideoElement | null>(null);
  const [answer, setAnswer] = useState("");
  const [elapsed, setElapsed] = useState(0);
  const [confirming, setConfirming] = useState(false);
  const [finalizing, setFinalizing] = useState(false);
  const [muted, setMuted] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const recognitionRef = useRef<any>(null);
  const personaInitRef = useRef(false);

  const endSession = useEndSession();
  const finalize = useFinalizeEvaluation();
  const appendTurn = useAppendInterviewTurn();
  const nextPersona = useNextPersonaQuestion();
  const generateReport = useServerFn(generateInterviewReport);
  const turnsQuery = useSessionTurns(sessionId);

  useProctor({ sessionId, webcamStream, screenStream, enabled: true });

  // Attach webcam video
  useEffect(() => {
    if (camRef.current && webcamStream) {
      camRef.current.srcObject = webcamStream;
      camRef.current.play().catch(() => undefined);
    }
  }, [webcamStream]);

  // Timer
  useEffect(() => {
    if (isPaused) return;
    const id = window.setInterval(() => setElapsed((e) => e + 1), 1000);
    return () => window.clearInterval(id);
  }, [isPaused]);

  // First question
  useEffect(() => {
    if (personaInitRef.current) return;
    personaInitRef.current = true;
    nextPersona.mutateAsync({ sessionId }).then(() => turnsQuery.refetch());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sessionId]);

  const turns = turnsQuery.data ?? [];
  const lastPersona = [...turns].reverse().find((t) => t.speaker === "persona");
  const awaiting = nextPersona.isPending || appendTurn.isPending;

  // Speak persona via Web Speech API
  const spokenRef = useRef<string | null>(null);
  useEffect(() => {
    if (!lastPersona || spokenRef.current === lastPersona.id) return;
    spokenRef.current = lastPersona.id;
    if (muted) return;
    if (typeof window !== "undefined" && "speechSynthesis" in window) {
      const u = new SpeechSynthesisUtterance(lastPersona.text);
      u.rate = 1;
      u.pitch = 1;
      window.speechSynthesis.cancel();
      window.speechSynthesis.speak(u);
    }
  }, [lastPersona, muted]);

  // Internet Disconnect Auto-Pause / Auto-Resume
  useEffect(() => {
    const handleOffline = () => {
      setIsPaused(true);
      toast.warning("Internet connection lost. Interview paused.");
    };
    const handleOnline = () => {
      setIsPaused(false);
      toast.success("Internet reconnected. Resuming interview.");
    };
    window.addEventListener("offline", handleOffline);
    window.addEventListener("online", handleOnline);
    return () => {
      window.removeEventListener("offline", handleOffline);
      window.removeEventListener("online", handleOnline);
    };
  }, []);

  // Devices Disconnect Monitoring
  useEffect(() => {
    if (!webcamStream) return;
    const handlers: Array<{ track: MediaStreamTrack; fn: () => void }> = [];
    webcamStream.getTracks().forEach((track) => {
      const fn = () => {
        setIsPaused(true);
        toast.error(`${track.kind === "audio" ? "Microphone" : "Camera"} disconnected. Interview paused.`);
      };
      track.addEventListener("ended", fn);
      handlers.push({ track, fn });
    });
    return () => handlers.forEach((h) => h.track.removeEventListener("ended", h.fn));
  }, [webcamStream]);

  async function reconnectDevices() {
    try {
      const s = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
      if (camRef.current) {
        camRef.current.srcObject = s;
        await camRef.current.play().catch(() => undefined);
      }
      toast.success("Devices reconnected successfully.");
      setIsPaused(false);
    } catch {
      toast.error("Could not reconnect devices. Please check permission.");
    }
  }

  function toggleSpeech() {
    if (isListening) {
      recognitionRef.current?.stop();
      setIsListening(false);
      return;
    }

    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRecognition) {
      toast.error("Speech recognition is not supported in this browser.");
      return;
    }

    const rec = new SpeechRecognition();
    rec.continuous = true;
    rec.interimResults = false;
    rec.lang = "en-US";

    rec.onresult = (event: any) => {
      const result = event.results[event.results.length - 1];
      if (result.isFinal) {
        const text = result[0].transcript;
        setAnswer((prev) => (prev ? prev + " " + text : text));
      }
    };

    rec.onerror = () => {
      setIsListening(false);
    };

    rec.onend = () => {
      setIsListening(false);
    };

    recognitionRef.current = rec;
    rec.start();
    setIsListening(true);
  }

  function toggleMute() {
    if (!muted) {
      if (typeof window !== "undefined" && "speechSynthesis" in window) {
        window.speechSynthesis.cancel();
      }
    } else if (lastPersona) {
      if (typeof window !== "undefined" && "speechSynthesis" in window) {
        const u = new SpeechSynthesisUtterance(lastPersona.text);
        window.speechSynthesis.speak(u);
      }
    }
    setMuted(!muted);
  }

  async function submit() {
    if (!answer.trim()) return;
    const txt = answer.trim();
    setAnswer("");
    const now = new Date().toISOString();
    await appendTurn.mutateAsync({ sessionId, speaker: "candidate", text: txt, startedAt: now, endedAt: now });
    await nextPersona.mutateAsync({ sessionId });
    turnsQuery.refetch();
  }

  async function endInterview() {
    setConfirming(false);
    setFinalizing(true);
    try {
      await endSession.mutateAsync({ sessionId });
      await finalize.mutateAsync({ interviewId: interview.id }).catch(() => undefined);
      await generateReport({ data: { interviewId: interview.id } as never }).catch(() => undefined);
    } finally {
      setFinalizing(false);
      onCompleted();
    }
  }

  const mm = String(Math.floor(elapsed / 60)).padStart(2, "0");
  const ss = String(elapsed % 60).padStart(2, "0");

  return (
    <div className="grid lg:grid-cols-[300px_1fr_360px] gap-md max-w-7xl mx-auto relative">
      {/* Paused Overlay */}
      {isPaused && (
        <div className="absolute inset-0 bg-slate-900/80 backdrop-blur-sm z-40 flex items-center justify-center p-md rounded-2xl">
          <div className="bg-white rounded-xl shadow-2xl p-lg text-center max-w-md space-y-md border border-outline-variant">
            <div className="w-16 h-16 bg-error-container text-on-error-container rounded-full flex items-center justify-center mx-auto">
              <Icon name="pause" className="text-3xl" />
            </div>
            <h3 className="text-headline-md font-bold text-on-surface">Interview Paused</h3>
            <p className="text-body-md text-on-surface-variant">
              The interview is paused due to network connection loss or a device disconnection. Please check your camera, microphone, and internet connection.
            </p>
            <div className="flex gap-2 justify-center pt-2">
              <button
                type="button"
                onClick={reconnectDevices}
                className="px-5 py-2.5 bg-primary text-on-primary rounded-lg font-semibold flex items-center gap-1.5"
              >
                <Icon name="refresh" /> Reconnect & Resume
              </button>
            </div>
          </div>
        </div>
      )}

      {/* LEFT: AI persona */}
      <Card className="p-md flex flex-col items-center text-center justify-between">
        <div className="flex flex-col items-center">
          <div className={`w-24 h-24 rounded-full bg-gradient-to-br from-primary to-primary/60 text-on-primary flex items-center justify-center text-headline-lg font-bold transition-transform ${
            typeof window !== "undefined" && window.speechSynthesis?.speaking ? "animate-pulse scale-105" : ""
          }`}>
            AI
          </div>
          <p className="mt-3 text-title-md font-semibold text-on-surface">{interview.personaName ?? "Aria"}</p>
          <p className="text-body-sm text-on-surface-variant">AI Interviewer</p>
          <div className="mt-3 px-3 py-1 rounded-full bg-surface-container-low text-label-sm text-on-surface-variant">
            {awaiting ? "Thinking…" : "Listening"}
          </div>
        </div>

        {/* AI voice and interview controls */}
        <div className="w-full space-y-2 pt-md border-t border-outline-variant mt-md">
          <button
            type="button"
            onClick={toggleMute}
            className={`w-full px-4 py-2 rounded-lg border text-sm font-semibold flex items-center justify-center gap-2 transition ${
              muted ? "bg-error-container text-on-error-container border-error" : "bg-white text-on-surface border-outline-variant hover:bg-surface-container-low"
            }`}
          >
            <Icon name={muted ? "volume_off" : "volume_up"} /> {muted ? "Unmute AI Voice" : "Mute AI Voice"}
          </button>
          <button
            type="button"
            onClick={() => setIsPaused(!isPaused)}
            className="w-full px-4 py-2 rounded-lg border border-outline-variant bg-white text-on-surface text-sm font-semibold flex items-center justify-center gap-2 hover:bg-surface-container-low transition"
          >
            <Icon name={isPaused ? "play_arrow" : "pause"} /> {isPaused ? "Resume Interview" : "Pause Interview"}
          </button>
        </div>
      </Card>

      {/* CENTER: candidate */}
      <Card className="overflow-hidden flex flex-col justify-between">
        <div className="aspect-video bg-black relative">
          <video ref={camRef} className="w-full h-full object-cover" playsInline muted />
          <div className="absolute top-3 left-3 flex items-center gap-2 px-3 py-1.5 rounded-full bg-error/90 text-on-error text-label-caps font-semibold">
            <span className="w-2 h-2 rounded-full bg-on-error animate-pulse" /> REC · {mm}:{ss}
          </div>
          <div className="absolute top-3 right-3 flex gap-2">
            <span className="px-2 py-1 rounded-full bg-black/50 text-white text-label-sm flex items-center gap-1"><Icon name="mic" /> on</span>
            <span className="px-2 py-1 rounded-full bg-black/50 text-white text-label-sm flex items-center gap-1"><Icon name="videocam" /> on</span>
          </div>
        </div>
        <div className="p-md space-y-sm flex-1 flex flex-col justify-between">
          <div className="p-3 bg-primary-container/40 rounded-lg min-h-[3rem] text-body-md text-on-primary-container">
            {lastPersona?.text ?? "Welcome — your interviewer will speak shortly."}
          </div>
          <div className="relative mt-2">
            <textarea
              value={answer}
              onChange={(e) => setAnswer(e.target.value)}
              placeholder="Type your answer or use the microphone button to speak verbally…"
              disabled={awaiting || finalizing || isPaused}
              rows={3}
              className="w-full rounded-lg border border-outline-variant bg-surface-container-lowest p-3 pr-12 text-body-md focus:outline-none focus:ring-2 focus:ring-primary"
            />
            {/* Mic button inside textarea */}
            <button
              type="button"
              onClick={toggleSpeech}
              disabled={awaiting || finalizing || isPaused}
              className={`absolute right-3 bottom-4 p-2 rounded-full transition ${
                isListening ? "bg-error text-on-error animate-pulse" : "bg-surface-container text-on-surface-variant hover:bg-surface-container-high"
              }`}
              title={isListening ? "Listening - Click to stop" : "Speak verbally"}
            >
              <Icon name={isListening ? "mic" : "mic_off"} className="text-lg" />
            </button>
          </div>
          <div className="flex justify-between items-center mt-2">
            <p className="text-label-sm text-on-surface-variant">{awaiting ? "Aria is thinking…" : isListening ? "Listening to your voice..." : "Press Send when ready."}</p>
            <div className="flex gap-2">
              <button
                type="button"
                disabled={!answer.trim() || awaiting || finalizing || isPaused}
                onClick={submit}
                className="px-4 py-2 rounded-full bg-primary text-on-primary font-semibold disabled:opacity-50 inline-flex items-center gap-1.5 hover:brightness-110"
              >
                <Icon name="send" /> Send
              </button>
              <button
                type="button"
                disabled={finalizing}
                onClick={() => setConfirming(true)}
                className="px-4 py-2 rounded-full bg-error text-on-error font-semibold disabled:opacity-50 inline-flex items-center gap-1.5 hover:brightness-110"
              >
                <Icon name="call_end" /> End
              </button>
            </div>
          </div>
        </div>
      </Card>

      {/* RIGHT: transcript */}
      <Card className="p-md flex flex-col">
        <h3 className="text-title-md font-semibold text-on-surface mb-2">Transcript</h3>
        <div className="flex-1 overflow-y-auto space-y-2 max-h-[70vh] pr-1">
          {turns.length === 0 && <p className="text-body-sm text-on-surface-variant">Awaiting first question…</p>}
          {turns.map((t) => (
            <div
              key={t.id}
              className={`p-2 rounded-lg text-body-sm ${
                t.speaker === "persona"
                  ? "bg-primary-container text-on-primary-container"
                  : t.speaker === "candidate"
                    ? "bg-surface-container text-on-surface"
                    : "bg-surface-container-low text-on-surface-variant italic"
              }`}
            >
              <p className="text-label-caps uppercase opacity-70">{t.speaker === "persona" ? (interview.personaName ?? "Interviewer") : t.speaker}</p>
              <p>{t.text}</p>
            </div>
          ))}
        </div>
      </Card>

      {confirming && (
        <Modal onClose={() => setConfirming(false)}>
          <div className="text-center space-y-md">
            <h2 className="text-headline-md font-headline-md text-on-surface">End the interview?</h2>
            <p className="text-body-md text-on-surface-variant">
              Once ended you cannot resume. Your responses will be evaluated automatically.
            </p>
            <div className="flex justify-center gap-2 pt-2">
              <button type="button" onClick={() => setConfirming(false)} className="px-4 py-2 rounded-lg border border-outline-variant">Continue</button>
              <button type="button" onClick={endInterview} className="px-4 py-2 rounded-lg bg-error text-on-error font-semibold">End Interview</button>
            </div>
          </div>
        </Modal>
      )}

      {finalizing && (
        <Modal>
          <div className="text-center space-y-md">
            <Icon name="hourglass_top" className="text-5xl text-primary animate-spin" />
            <h2 className="text-headline-md text-on-surface">Submitting your interview…</h2>
            <p className="text-body-md text-on-surface-variant">Please do not close this window.</p>
          </div>
        </Modal>
      )}
    </div>
  );
}

/* ----------------------------- 6. Completion ----------------------------- */

function CompletionScreen() {
  const navigate = useNavigate();
  return (
    <Card className="max-w-xl mx-auto p-lg text-center space-y-md">
      <div className="w-20 h-20 rounded-full bg-success-container text-on-success-container mx-auto flex items-center justify-center">
        <Icon name="task_alt" className="text-4xl" />
      </div>
      <h2 className="text-headline-md font-headline-md text-on-surface">Thank you for completing the interview.</h2>
      <p className="text-body-md text-on-surface-variant">
        Your responses have been recorded successfully. Our recruitment team will review your interview and contact
        you regarding the next steps.
      </p>
      <p className="text-body-sm text-on-surface-variant">You may now close this window.</p>
      <button
        type="button"
        onClick={() => navigate({ to: "/candidate/prepare" })}
        className="px-4 py-2 rounded-lg bg-primary text-on-primary font-semibold"
      >
        Back to dashboard
      </button>
    </Card>
  );
}

function Modal({ children, onClose }: { children: React.ReactNode; onClose?: () => void }) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
    >
      <div
        className="bg-surface-container-lowest rounded-xl border border-outline-variant shadow-soft max-w-md w-full p-lg"
        onClick={(e) => e.stopPropagation()}
      >
        {children}
      </div>
    </div>
  );
}
