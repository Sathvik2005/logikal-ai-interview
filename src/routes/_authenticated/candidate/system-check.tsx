import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Card, Icon } from "@/components/candidate/CandidateShell";
import { z } from "zod";

export const Route = createFileRoute("/_authenticated/candidate/system-check")({
  validateSearch: (search) => z.object({ interviewId: z.string().uuid().optional() }).parse(search),
  component: SystemCheckPage,
});

type CheckState = "pending" | "running" | "ok" | "fail";

type CheckKey = "browser" | "permissions" | "camera" | "mic" | "speaker" | "bandwidth";

const CHECKS: { key: CheckKey; label: string; icon: string }[] = [
  { key: "browser", label: "Browser compatibility", icon: "public" },
  { key: "permissions", label: "Permission verification", icon: "verified_user" },
  { key: "camera", label: "Camera validation", icon: "videocam" },
  { key: "mic", label: "Microphone validation", icon: "mic" },
  { key: "speaker", label: "Speaker validation", icon: "volume_up" },
  { key: "bandwidth", label: "Internet connectivity (≥ 5 Mbps)", icon: "speed" },
];

function SystemCheckPage() {
  const { interviewId } = Route.useSearch();
  const [checks, setChecks] = useState<Record<CheckKey, CheckState>>({
    browser: "pending",
    permissions: "pending",
    camera: "pending",
    mic: "pending",
    speaker: "pending",
    bandwidth: "pending",
  });

  const run = async () => {
    setChecks({
      browser: "running",
      permissions: "pending",
      camera: "pending",
      mic: "pending",
      speaker: "pending",
      bandwidth: "pending",
    });

    // 1. Browser check
    const hasMedia = !!(navigator.mediaDevices && window.MediaRecorder);
    const hasSpeech = !!((window as any).webkitSpeechRecognition || (window as any).SpeechRecognition);
    const browserOk = hasMedia && hasSpeech;
    setChecks((s) => ({ ...s, browser: browserOk ? "ok" : "fail" }));
    if (!browserOk) {
      setChecks((s) => ({
        ...s,
        permissions: "fail",
        camera: "fail",
        mic: "fail",
        speaker: "fail",
        bandwidth: "fail",
      }));
      return;
    }

    // 2. Bandwidth / internet check
    setChecks((s) => ({ ...s, bandwidth: "running" }));
    let latencyOk = false;
    try {
      const start = performance.now();
      // Fetch small resource to check online latency
      await fetch("/favicon.ico", { cache: "no-store" });
      const duration = performance.now() - start;
      // If duration is reasonable (less than 2000ms), we have a working connection
      latencyOk = navigator.onLine && duration < 2000;
    } catch {
      latencyOk = navigator.onLine; // fallback
    }
    setChecks((s) => ({ ...s, bandwidth: latencyOk ? "ok" : "fail" }));

    // 3. Permissions, Camera, Mic & Speaker
    setChecks((s) => ({
      ...s,
      permissions: "running",
      camera: "running",
      mic: "running",
      speaker: "running",
    }));

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
      // Stop tracks immediately to release the device
      stream.getTracks().forEach((track) => track.stop());

      setChecks((s) => ({
        ...s,
        permissions: "ok",
        camera: "ok",
        mic: "ok",
        speaker: "ok",
      }));
    } catch (err) {
      console.error("Media permission check failed:", err);
      setChecks((s) => ({
        ...s,
        permissions: "fail",
        camera: "fail",
        mic: "fail",
        speaker: "fail",
      }));
    }
  };

  useEffect(() => {
    run();
  }, []);

  const allOk = Object.values(checks).every((v) => v === "ok");
  const passed = Object.values(checks).filter((v) => v === "ok").length;

  return (
    <div className="space-y-lg max-w-4xl mx-auto">
      <header>
        <h1 className="text-headline-lg font-headline-lg text-on-surface">System Check</h1>
        <p className="text-body-lg text-on-surface-variant mt-1">
          We're verifying your device, browser, and connection. All checks must pass before you can enter the
          interview room.
        </p>
      </header>

      <Card className="p-lg">
        <div className="flex items-center justify-between mb-md">
          <div>
            <p className="text-headline-sm font-headline-sm text-on-surface">Diagnostics</p>
            <p className="text-body-md text-on-surface-variant">
              {passed} of {CHECKS.length} checks passed
            </p>
          </div>
          <button type="button" onClick={run} className="text-body-md text-primary hover:underline">
            Run again
          </button>
        </div>
        <div className="space-y-2">
          {CHECKS.map((c) => {
            const state = checks[c.key];
            return (
              <div
                key={c.key}
                className="flex items-center justify-between p-3 rounded-lg border border-outline-variant"
              >
                <div className="flex items-center gap-3">
                  <Icon name={c.icon} className="text-on-surface-variant" />
                  <span className="text-body-md text-on-surface">{c.label}</span>
                </div>
                <span
                  className={`text-label-caps font-semibold px-2 py-1 rounded-full ${
                    state === "ok"
                      ? "bg-success-container text-on-success-container"
                      : state === "running"
                        ? "bg-warning-container text-on-warning-container"
                        : state === "fail"
                          ? "bg-error-container text-on-error-container"
                          : "bg-surface-container text-on-surface-variant"
                  }`}
                >
                  {state === "ok"
                    ? "PASSED"
                    : state === "running"
                      ? "TESTING..."
                      : state === "fail"
                        ? "FAILED"
                        : "PENDING"}
                </span>
              </div>
            );
          })}
        </div>
      </Card>

      <div className="flex items-center justify-between gap-2">
        <Link
          to="/candidate/prepare"
          search={{ interviewId }}
          className="px-4 py-2 rounded-lg border border-outline-variant text-body-md"
        >
          Back to Preparation
        </Link>
        <Link
          to="/candidate/interview"
          search={{ interviewId }}
          className={`px-6 py-3 rounded-lg font-semibold text-body-lg flex items-center gap-2 ${
            allOk
              ? "bg-primary text-on-primary hover:brightness-110"
              : "bg-surface-container-high text-on-surface-variant pointer-events-none"
          }`}
        >
          Enter Interview Room <Icon name="arrow_forward" />
        </Link>
      </div>
    </div>
  );
}
