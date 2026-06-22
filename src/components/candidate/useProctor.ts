import { useEffect, useRef } from "react";
import { useServerFn } from "@tanstack/react-start";
import { uploadProctoringSnapshot } from "@/lib/proctoring.functions";
import { recordInterviewEvent } from "@/lib/interview-runtime.functions";

type ProctorOptions = {
  sessionId: string;
  webcamStream: MediaStream | null;
  screenStream: MediaStream | null;
  enabled: boolean;
};

/**
 * Background proctoring engine:
 *  - Captures webcam snapshot every 15s
 *  - Captures screen snapshot every 30s
 *  - Records integrity events for tab/focus/copy/paste/fullscreen/network/screen-share end
 */
export function useProctor({ sessionId, webcamStream, screenStream, enabled }: ProctorOptions) {
  const uploadSnap = useServerFn(uploadProctoringSnapshot);
  const recordEvent = useServerFn(recordInterviewEvent);

  // Refs so handlers always see latest values
  const sessionRef = useRef(sessionId);
  sessionRef.current = sessionId;
  const enabledRef = useRef(enabled);
  enabledRef.current = enabled;

  // Integrity event listeners
  useEffect(() => {
    if (!enabled || !sessionId) return;
    const fire = (type: string, payload?: Record<string, unknown>) =>
      recordEvent({ data: { sessionId, type, payload } as never }).catch(() => undefined);

    const onVis = () => document.hidden && fire("tab_switch");
    const onBlur = () => fire("focus_loss");
    const onPaste = () => fire("paste");
    const onCopy = () => fire("copy");
    const onFs = () => !document.fullscreenElement && fire("fullscreen_exit");
    const onOff = () => fire("network_drop");
    const onOn = () => fire("network_recover");

    document.addEventListener("visibilitychange", onVis);
    window.addEventListener("blur", onBlur);
    window.addEventListener("paste", onPaste);
    window.addEventListener("copy", onCopy);
    document.addEventListener("fullscreenchange", onFs);
    window.addEventListener("offline", onOff);
    window.addEventListener("online", onOn);

    fire("session_start", { ua: navigator.userAgent, tz: Intl.DateTimeFormat().resolvedOptions().timeZone });

    return () => {
      document.removeEventListener("visibilitychange", onVis);
      window.removeEventListener("blur", onBlur);
      window.removeEventListener("paste", onPaste);
      window.removeEventListener("copy", onCopy);
      document.removeEventListener("fullscreenchange", onFs);
      window.removeEventListener("offline", onOff);
      window.removeEventListener("online", onOn);
    };
  }, [enabled, sessionId, recordEvent]);

  // Screen-share end detection
  useEffect(() => {
    if (!enabled || !screenStream || !sessionId) return;
    const track = screenStream.getVideoTracks()[0];
    if (!track) return;
    const onEnd = () =>
      recordEvent({ data: { sessionId, type: "screen_share_stopped" } as never }).catch(() => undefined);
    track.addEventListener("ended", onEnd);
    return () => track.removeEventListener("ended", onEnd);
  }, [enabled, screenStream, sessionId, recordEvent]);

  // Camera/mic loss detection
  useEffect(() => {
    if (!enabled || !webcamStream || !sessionId) return;
    const handlers: Array<{ track: MediaStreamTrack; fn: () => void }> = [];
    webcamStream.getTracks().forEach((track) => {
      const fn = () =>
        recordEvent({
          data: { sessionId, type: track.kind === "audio" ? "mic_lost" : "cam_lost" } as never,
        }).catch(() => undefined);
      track.addEventListener("ended", fn);
      handlers.push({ track, fn });
    });
    return () => handlers.forEach((h) => h.track.removeEventListener("ended", h.fn));
  }, [enabled, webcamStream, sessionId, recordEvent]);

  // Snapshot loops
  useEffect(() => {
    if (!enabled || !sessionId) return;

    async function snap(stream: MediaStream | null, kind: "webcam" | "screen") {
      if (!stream) return;
      const track = stream.getVideoTracks()[0];
      if (!track || track.readyState !== "live") return;
      try {
        const video = document.createElement("video");
        video.srcObject = stream;
        video.muted = true;
        await video.play().catch(() => undefined);
        await new Promise((r) => setTimeout(r, 200));
        const w = video.videoWidth || 640;
        const h = video.videoHeight || 360;
        const canvas = document.createElement("canvas");
        canvas.width = Math.min(w, 800);
        canvas.height = Math.round(canvas.width * (h / w));
        const ctx = canvas.getContext("2d");
        if (!ctx) return;
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
        const dataUrl = canvas.toDataURL("image/jpeg", 0.6);
        await uploadSnap({ data: { sessionId: sessionRef.current, kind, dataUrl } as never });
        video.srcObject = null;
      } catch {
        /* silent — proctoring must not crash the interview */
      }
    }

    const camTimer = window.setInterval(() => void snap(webcamStream, "webcam"), 15000);
    const scrTimer = window.setInterval(() => void snap(screenStream, "screen"), 30000);

    // initial captures
    void snap(webcamStream, "webcam");
    void snap(screenStream, "screen");

    return () => {
      window.clearInterval(camTimer);
      window.clearInterval(scrTimer);
    };
  }, [enabled, sessionId, webcamStream, screenStream, uploadSnap]);
}
