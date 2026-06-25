# Lokality AI — Client Development & Frontend Architecture Guide

This guide covers the client-side architecture of the Lokality AI platform, built on React 19, Vite, TanStack Start, and TanStack Router.

---

## 1. FRONTEND TECHNOLOGY STACK

*   **Framework**: React 19.x (utilizing Concurrent Rendering, Server Functions, and Suspense).
*   **Meta-Framework**: TanStack Start (full-stack framework built on TanStack Router and Vite).
*   **Routing**: TanStack Router (strictly typed, file-based routing with automatic query param validation).
*   **State Management**: TanStack Query (managing server state caching, updates, and optimistic updates).
*   **Styling**: Tailwind CSS v4.0 (utility-first styling).
*   **UI Components**: shadcn/ui (primitives built on Radix UI).
*   **Realtime**: Socket.IO Client (handling WebSockets connections during active interview sessions).
*   **Media**: HTML5 AudioContext & WebRTC MediaDevices API (managing camera feeds and voice waveforms).

---

## 2. DIRECTORY STRUCTURE & ROUTING

The client workspace is structured inside the `src/` directory:

```
src/
├── components/          # Reusable React components
│   ├── ui/             # shadcn/ui base elements (Buttons, Inputs, Cards)
│   ├── recruiter/      # Recruiter dashboards cards and filters
│   └── candidate/      # Webcam visualizers, waveform meters, subtitle bubbles
├── hooks/              # Custom hooks (e.g. webcam controls, screen focus)
├── lib/                # TanStack Start Server Functions
│   ├── candidates.functions.ts
│   ├── interviews.functions.ts
│   └── ...             # Proxies HTTP requests to NestJS port 3000
├── routes/             # File-based routing tree
│   ├── _authenticated/ # Protected path group
│   │   ├── candidate/  # Candidate session entry & checkouts
│   │   └── recruiter/  # Recruiter dashboard metrics, monitors, JDs
│   ├── auth.tsx        # Login/Signup layout
│   └── __root.tsx      # Core wrap routing, sidebar togglers, authentication checks
```

---

## 3. FRONTEND ↔ BACKEND COMMUNICATION

### 3.1. TanStack Start Server Functions Proxy
Lokality uses TanStack Start's `createServerFn` to build a clean API proxy layer. This isolates the backend URL and JWT handling from client bundles.

Example pattern:
```typescript
// src/lib/candidates.functions.ts
import { createServerFn } from "@tanstack/start";

export const getCandidate = createServerFn({ method: "GET" })
  .validator((id: string) => id)
  .handler(async ({ data: id }) => {
    // 1. Fetch Supabase Token from request context
    const token = await getAuthToken();
    
    // 2. Fetch data from NestJS backend (port 3000)
    const response = await fetch(`http://localhost:3000/api/candidates/${id}`, {
      headers: {
        Authorization: `Bearer ${token}`
      }
    });
    
    if (!response.ok) throw new Error("Failed to fetch candidate details");
    return response.json();
  });
```

### 3.2. WebSocket connection
The interview room initializes a Socket.IO connection when loading `/candidate/interview`:
```typescript
import { io } from "socket.io-client";

const socket = io("http://localhost:3000/interview", {
  auth: {
    token: `Bearer ${userJwt}`
  },
  query: {
    sessionId: "session-uuid"
  }
});
```

---

## 4. WEBRTC MEDIA & WAVEFORM DRAWING

The candidate room captures audio and webcam input for proctoring and dialog transcription.

### 4.1. Accessing Streams
```typescript
const startMediaStream = async () => {
  const mediaStream = await navigator.mediaDevices.getUserMedia({
    video: { width: 640, height: 480 },
    audio: true
  });
  videoElement.srcObject = mediaStream;
};
```

### 4.2. Audio Visualizer Canvas
Lokality creates an `AudioContext` analyser node to render microphone inputs on an HTML5 `<canvas>` element:
```typescript
const audioContext = new AudioContext();
const source = audioContext.createMediaStreamSource(mediaStream);
const analyser = audioContext.createAnalyser();
source.connect(analyser);

const dataArray = new Uint8Array(analyser.frequencyBinCount);
const drawWaveform = () => {
  analyser.getByteTimeDomainData(dataArray);
  // Canvas 2D context drawing commands plotting lines
  requestAnimationFrame(drawWaveform);
};
```

---

## 5. CLIENT-SIDE PROCTORING ENGINE

The browser monitors cheating events using built-in Page Visibility and Focus APIs:

### 5.1. Tab Change Detection
```typescript
useEffect(() => {
  const handleVisibilityChange = () => {
    if (document.hidden) {
      // Emit socket warning
      socket.current.emit("proctor-alert", { type: "tab_switch" });
      // Trigger warning UI banner
      setWarningVisible(true);
    }
  };

  document.addEventListener("visibilitychange", handleVisibilityChange);
  return () => document.removeEventListener("visibilitychange", handleVisibilityChange);
}, []);
```

### 5.2. Screen Capture Snapshots (Canvas Image Buffers)
To capture webcam frames without third-party plugins:
1.  Draw the `<video>` frame onto a hidden `<canvas>` context.
2.  Extract the base64 data string: `const dataUrl = canvas.toDataURL("image/webp", 0.7);`
3.  Post the blob to `POST /api/proctoring/snapshot` every 15 seconds.
