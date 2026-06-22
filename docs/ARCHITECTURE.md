# Lokality AI Recruitment Intelligence Platform — Architecture Guide

> **Version:** 1.0.0  
> **Last Updated:** June 22, 2026  
> **Status:** Development

---

## Table of Contents

1. [System Overview](#system-overview)
2. [Architecture Diagram](#architecture-diagram)
3. [Technology Stack](#technology-stack)
4. [Frontend Architecture](#frontend-architecture)
5. [Backend Architecture](#backend-architecture)
6. [Database Schema](#database-schema)
7. [Authentication & Authorization](#authentication--authorization)
8. [AI Engine Integration](#ai-engine-integration)
9. [Real-time Communication](#real-time-communication)
10. [Data Flow Diagrams](#data-flow-diagrams)

---

## System Overview

Lokality AI is an enterprise-grade AI-powered recruitment intelligence platform. It automates the interview lifecycle from candidate import through AI-driven evaluation, producing structured competency reports for hiring decisions.

### Core Capabilities

| Capability | Description |
|---|---|
| **AI Resume Parsing** | Automated extraction of skills, experience, and profile data from uploaded resumes using Gemini 2.5 |
| **JD Intelligence** | AI-generated job descriptions with automated candidate-JD matching scores |
| **AI Interview Engine** | State-machine-driven interview sessions with AI persona interviewers |
| **Proctoring & Integrity** | Real-time screenshot capture, tab-switch detection, face monitoring |
| **AI Evaluation** | Post-interview grading with competency scoring, integrity analysis |
| **Report Generation** | Structured assessment reports with strengths, concerns, and hire/no-hire recommendations |
| **Multi-tenant Architecture** | Organization-scoped data isolation with role-based access control |

---

## Architecture Diagram

```
┌─────────────────────────────────────────────────────────────────┐
│                        CLIENT BROWSER                          │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │              TanStack Start (React SPA)                  │  │
│  │  • TanStack Router (file-based routes)                   │  │
│  │  • TanStack Query (server state management)              │  │
│  │  • shadcn/ui + Radix UI (component library)              │  │
│  │  • Socket.IO Client (realtime interview data)            │  │
│  └────────────────┬────────────────────┬────────────────────┘  │
│                   │ HTTP               │ WebSocket              │
└───────────────────┼────────────────────┼────────────────────────┘
                    │                    │
         ┌──────────▼──────────┐  ┌──────▼──────────┐
         │  TanStack Start     │  │                  │
         │  Server Functions   │  │  Socket.IO       │
         │  (API Proxy Layer)  │  │  Connection      │
         │  /src/lib/*.fns.ts  │  │                  │
         └──────────┬──────────┘  └──────┬───────────┘
                    │ HTTP/REST          │ WS
         ┌──────────▼────────────────────▼───────────┐
         │          NestJS Backend (port 3000)        │
         │  ┌──────────────────────────────────────┐  │
         │  │  Presentation Layer                  │  │
         │  │  • 9 HTTP Controllers                │  │
         │  │  • 1 WebSocket Gateway               │  │
         │  │  • SupabaseAuthGuard                 │  │
         │  │  • RolesGuard                        │  │
         │  ├──────────────────────────────────────┤  │
         │  │  Application Layer                   │  │
         │  │  • CandidateWorkflowService          │  │
         │  │  • InterviewEngineService             │  │
         │  │  • EvaluationService                  │  │
         │  │  • FileProcessingPipelineService      │  │
         │  │  • VectorMatchingService              │  │
         │  │  • NotificationService                │  │
         │  │  • PromptLibraryService               │  │
         │  ├──────────────────────────────────────┤  │
         │  │  Domain Layer                        │  │
         │  │  • Candidate Entity (State Machine)  │  │
         │  │  • Interview Entity (State Machine)  │  │
         │  │  • Domain Events                     │  │
         │  ├──────────────────────────────────────┤  │
         │  │  Infrastructure Layer                │  │
         │  │  • PrismaService (PostgreSQL ORM)    │  │
         │  │  • GeminiOrchestratorService (AI)    │  │
         │  │  • InMemoryQueueService              │  │
         │  │  • EventEmitterBusService            │  │
         │  └──────────────────────────────────────┘  │
         └──────────────────┬─────────────────────────┘
                            │
              ┌─────────────▼─────────────┐
              │   Supabase Cloud Platform  │
              │  ┌──────────────────────┐  │
              │  │  PostgreSQL Database  │  │
              │  │  (30+ tables)        │  │
              │  ├──────────────────────┤  │
              │  │  Auth (GoTrue)       │  │
              │  │  JWT token issuer    │  │
              │  ├──────────────────────┤  │
              │  │  Storage Buckets     │  │
              │  │  (Resumes, Snaps)    │  │
              │  └──────────────────────┘  │
              └───────────────────────────┘
```

---

## Technology Stack

### Frontend

| Technology | Purpose | Version |
|---|---|---|
| **React** | UI Component Framework | 19.x |
| **TanStack Start** | Full-stack meta framework | Latest |
| **TanStack Router** | File-based routing with type-safe params | Latest |
| **TanStack Query** | Server state, caching, mutations | Latest |
| **Vite** | Build tooling and dev server | 6.x |
| **shadcn/ui** | UI component library (Radix-based) | Latest |
| **Tailwind CSS** | Utility-first CSS framework | 4.x |
| **Recharts** | Data visualization (charts/graphs) | Latest |
| **Socket.IO Client** | WebSocket communication | 4.x |
| **Supabase JS** | Auth client, storage client | 2.x |

### Backend

| Technology | Purpose | Version |
|---|---|---|
| **NestJS** | Enterprise Node.js framework | 11.x |
| **Prisma ORM** | Type-safe database client | 6.x |
| **Google Generative AI** | Gemini 2.5 API client | 0.21.x |
| **Socket.IO** | WebSocket server | 4.x |
| **Resend** | Transactional email delivery | 4.x |
| **Swagger/OpenAPI** | API documentation | 11.x |
| **class-validator** | DTO validation | 0.14.x |
| **class-transformer** | DTO transformation | 0.5.x |
| **jsonwebtoken** | JWT token verification | 9.x |

### Infrastructure

| Technology | Purpose |
|---|---|
| **Supabase** | Managed PostgreSQL, Auth (GoTrue), Storage |
| **Node.js** | Runtime environment (v26.x) |
| **TypeScript** | Type safety across full stack |

---

## Frontend Architecture

### Directory Structure

```
src/
├── components/          # Reusable UI components (shadcn/ui based)
│   ├── ui/             # Base UI primitives (Button, Card, Dialog, etc.)
│   ├── interview/      # Interview-specific components
│   └── ...             # Feature-specific component groups
├── hooks/              # Custom React hooks
├── integrations/       # Third-party service integrations
│   └── supabase/       # Supabase client configuration
├── lib/                # Server functions (TanStack Start createServerFn)
│   ├── candidates.functions.ts     # Candidate CRUD operations
│   ├── jobs.functions.ts           # Job description management
│   ├── personas.functions.ts       # AI persona configuration
│   ├── interviews.functions.ts     # Interview scheduling & management
│   ├── interview-runtime.functions.ts  # Live interview session control
│   ├── questions.functions.ts      # Question bank management
│   ├── proctoring.functions.ts     # Proctoring/integrity services
│   ├── reports.functions.ts        # Evaluation report retrieval
│   ├── analytics.functions.ts      # Dashboard analytics data
│   ├── admin.functions.ts          # Organization administration
│   ├── monitor.functions.ts        # Live interview monitoring
│   ├── governance.functions.ts     # GDPR/compliance operations
│   └── ...                         # Additional service functions
├── routes/             # File-based route definitions
│   ├── __root.tsx      # Root layout (AppSidebar, Navbar, Auth)
│   ├── index.tsx       # Public landing page
│   ├── auth.tsx        # Login/Signup page
│   ├── _authenticated/ # Protected route group
│   │   ├── recruiter/  # Recruiter dashboard & management
│   │   │   ├── index.tsx           # Recruiter dashboard
│   │   │   ├── candidates/         # Candidate management
│   │   │   ├── jobs/               # Job description builder
│   │   │   ├── personas/           # AI persona configuration
│   │   │   ├── scheduling/         # Interview scheduling
│   │   │   ├── questions/          # Question bank
│   │   │   ├── monitor/            # Live interview monitoring
│   │   │   ├── reports/            # Evaluation reports
│   │   │   └── analytics/          # Analytics dashboards
│   │   ├── candidate/  # Candidate-facing interview portal
│   │   │   ├── index.tsx           # Candidate dashboard
│   │   │   ├── prepare.tsx         # Pre-interview preparation
│   │   │   ├── system-check.tsx    # System compatibility check
│   │   │   └── interview.tsx       # Live interview room
│   │   └── admin/      # Platform administration
│   │       ├── index.tsx           # Admin dashboard
│   │       ├── organizations/      # Organization management
│   │       ├── security.tsx        # Security settings
│   │       └── settings.tsx        # Platform settings
│   ├── join.$token.tsx # Candidate invitation acceptance
│   └── access-denied.tsx # Unauthorized access page
├── styles.css          # Global CSS (Tailwind + custom styles)
├── router.tsx          # TanStack Router configuration
└── server.ts           # Server entry point
```

### Frontend ↔ Backend Communication

All `src/lib/*.functions.ts` files use TanStack Start's `createServerFn` pattern. These server functions proxy HTTP requests to the NestJS backend at `http://localhost:3000/api/...`.

**Example Pattern:**
```typescript
// src/lib/candidates.functions.ts
export const listCandidates = createServerFn({ method: 'GET' })
  .handler(async () => {
    const response = await fetch('http://localhost:3000/api/candidates', {
      headers: { Authorization: `Bearer ${token}` }
    });
    return response.json();
  });
```

---

## Backend Architecture

### Clean Architecture (DDD-Inspired)

The backend follows **Clean Architecture** principles with four distinct layers:

```
backend/src/
├── domain/                      # Domain Layer (innermost)
│   ├── candidate/
│   │   ├── candidate.entity.ts          # Candidate aggregate root
│   │   ├── candidate.repository.interface.ts  # Repository contract
│   │   └── events/                      # Domain events
│   ├── interview/
│   │   ├── interview.entity.ts          # Interview aggregate root
│   │   ├── interview.repository.interface.ts  # Repository contract
│   │   └── events/                      # Domain events
│   └── common/
│       └── domain-event.base.ts         # Base domain event class
│
├── application/                 # Application Layer
│   ├── candidate/
│   │   ├── candidate-workflow.service.ts    # Candidate state machine driver
│   │   ├── file-processing-pipeline.service.ts  # Resume processing
│   │   └── vector-matching.service.ts       # JD-Candidate matching
│   ├── interview/
│   │   ├── interview-engine.service.ts      # Interview state machine driver
│   │   └── evaluation.service.ts            # AI evaluation pipeline
│   ├── services/
│   │   ├── config.service.ts                # Environment configuration
│   │   ├── feature-flags.service.ts         # Feature toggle management
│   │   ├── notification.service.ts          # Email dispatch (Resend)
│   │   ├── prompt-library.service.ts        # AI prompt management
│   │   └── storage.service.ts               # File storage abstraction
│   └── common/
│       ├── ai/ai-orchestrator.interface.ts  # AI interface contract
│       ├── event-bus/event-bus.interface.ts  # Event bus contract
│       └── queue/queue.service.ts           # Queue interface contract
│
├── infrastructure/              # Infrastructure Layer
│   ├── database/
│   │   ├── prisma.service.ts               # Prisma client lifecycle
│   │   └── repositories/
│   │       ├── candidate.repository.ts     # Prisma candidate repo
│   │       └── interview.repository.ts     # Prisma interview repo
│   ├── ai/
│   │   └── gemini-orchestrator.service.ts  # Google Gemini 2.5 implementation
│   ├── event-bus/
│   │   └── event-emitter-bus.service.ts    # In-process event bus
│   └── queue/
│       └── in-memory-queue.service.ts      # In-process job queue
│
├── presentation/                # Presentation Layer (outermost)
│   ├── guards/
│   │   ├── supabase-auth.guard.ts          # JWT Bearer token validation
│   │   └── roles.guard.ts                  # Role-based access control
│   ├── http/
│   │   ├── admin.controller.ts             # /api/admin/*
│   │   ├── analytics.controller.ts         # /api/analytics/*
│   │   ├── candidates.controller.ts        # /api/candidates/*
│   │   ├── interviews.controller.ts        # /api/interviews/*
│   │   ├── jobs.controller.ts              # /api/jobs/*
│   │   ├── personas.controller.ts          # /api/personas/*
│   │   ├── proctoring.controller.ts        # /api/proctoring/*
│   │   ├── questions.controller.ts         # /api/questions/*
│   │   └── reports.controller.ts           # /api/reports/*
│   └── ws/
│       └── interview.gateway.ts            # Socket.IO interview gateway
│
├── app.module.ts                # Root NestJS module (DI container)
└── main.ts                      # Application bootstrap
```

### Dependency Injection Tokens

The backend uses NestJS's DI system with interface tokens for clean dependency inversion:

| Token | Interface | Implementation |
|---|---|---|
| `ICandidateRepositoryToken` | `ICandidateRepository` | `PrismaCandidateRepository` |
| `IInterviewRepositoryToken` | `IInterviewRepository` | `PrismaInterviewRepository` |
| `IEventBusToken` | `IEventBus` | `EventEmitterBusService` |
| `IQueueServiceToken` | `IQueueService` | `InMemoryQueueService` |
| `IAIOrchestratorToken` | `IAIOrchestrator` | `GeminiOrchestratorService` |

---

## Database Schema

### Entity Relationship Overview

The platform uses **30+ PostgreSQL tables** managed by Supabase. Key entities:

```
organizations ──┬── profiles
                ├── job_descriptions ──── jd_candidate_matches
                ├── personas ──── persona_versions ──── persona_questions
                ├── questions
                ├── candidates ──── candidate_timeline
                ├── interviews ──┬── interview_sessions ──┬── interview_turns
                │                │                        ├── interview_events
                │                │                        └── proctoring_snapshots
                │                ├── interview_questions
                │                ├── interview_invitations
                │                └── interview_reschedules
                ├── interview_reports
                ├── interview_templates
                ├── interview_slots
                ├── ai_jobs
                ├── notification_outbox
                └── audit_events
```

### Key Tables

| Table | Purpose | Key Fields |
|---|---|---|
| `organizations` | Multi-tenant org container | id, name, industry, status |
| `profiles` | User accounts (linked to Supabase Auth) | id, full_name, email, org_id |
| `user_roles` | RBAC role assignments | user_id, role (admin/recruiter/candidate) |
| `candidates` | Candidate profiles | full_name, email, skills[], ai_score, status |
| `job_descriptions` | Job postings | title, requirements, competencies, persona_id |
| `personas` | AI interviewer personas | name, persona_type, tone, difficulty, prompt |
| `interviews` | Interview instances | candidate_id, job_id, status, overall_score |
| `interview_sessions` | Active interview sessions | interview_id, started_at, device_info |
| `interview_turns` | Conversation transcript | session_id, speaker, text, turn_score |
| `interview_events` | Proctoring/integrity events | session_id, type, payload |
| `interview_reports` | AI-generated assessment reports | scores, strengths, weaknesses, recommendation |
| `interview_templates` | Reusable interview configurations | evaluation_criteria, proctoring_policy |
| `ai_jobs` | Background AI task queue | kind, entity_type, status, payload |
| `notification_outbox` | Email delivery queue | kind, recipient_email, status |
| `audit_events` | Compliance audit trail | actor_id, entity_type, action, diff |

---

## Authentication & Authorization

### Authentication Flow

```
1. User logs in via Supabase Auth (email/password or OAuth)
2. Supabase issues JWT with user_metadata (role, orgId)
3. Frontend stores JWT in Supabase session
4. Every API call includes: Authorization: Bearer <jwt>
5. SupabaseAuthGuard decodes/verifies JWT on each request
6. Request is enriched with user context (userId, email, role, orgId)
```

### Role-Based Access Control

| Role | Access Level | Permitted Routes |
|---|---|---|
| `admin` | Platform-wide | `/api/admin/*`, all recruiter routes |
| `recruiter` | Organization-scoped | `/api/candidates/*`, `/api/interviews/*`, `/api/jobs/*`, etc. |
| `candidate` | Self-only | `/api/interviews/session/*`, candidate-facing endpoints |

### Guard Implementation

- **SupabaseAuthGuard**: Validates JWT Bearer tokens. In production, verifies signature with `JWT_SECRET`. In development, falls back to `jwt.decode()` (no signature verification).
- **RolesGuard**: Checks `request.user.role` against allowed roles per endpoint.

---

## AI Engine Integration

### Gemini 2.5 Integration

The `GeminiOrchestratorService` provides 5 core AI capabilities:

| Method | Model | Purpose |
|---|---|---|
| `parseResume()` | Gemini 2.5 Flash | Extract structured data from resume text |
| `suggestJd()` | Gemini 2.5 Flash | Generate job description from title/department |
| `matchJdCandidate()` | Gemini 2.5 Flash | Score candidate-JD compatibility |
| `generateInterviewQuestion()` | Gemini 2.5 Flash | Produce next interview question (curated → adaptive) |
| `evaluateInterview()` | Gemini 2.5 Pro | Grade interview transcript with competency scores |
| `generateReportMarkdown()` | Gemini 2.5 Flash | Create structured assessment report |

### Mock Fallback Mode

When `GEMINI_API_KEY` is not configured, the orchestrator gracefully falls back to deterministic mock responses. This enables full platform development and testing without API costs.

---

## Real-time Communication

### WebSocket Gateway

The `InterviewGateway` (Socket.IO) handles real-time interview interactions:

| Event (Client → Server) | Handler | Description |
|---|---|---|
| `join-session` | `handleJoinSession` | Join a specific interview session room |
| `candidate-speech` | `handleCandidateSpeech` | Process candidate speech, generate AI response |
| `proctor-alert` | `handleProctorAlert` | Record proctoring violations |
| `waveform-data` | `handleWaveformData` | Relay audio waveform to monitoring clients |

| Event (Server → Client) | Description |
|---|---|
| `joined` | Confirmation of room join |
| `turn-appended` | New conversation turn (candidate or persona) |
| `status-update` | Interview state change (thinking, speaking, idle) |
| `proctor-warning` | Integrity violation alert to recruiters |
| `live-waveform` | Audio visualization data |

---

## Data Flow Diagrams

### Interview Lifecycle

```
Candidate Created → Resume Uploaded → Resume Parsed (AI)
       ↓
JD Matched (AI scoring) → Shortlisted → Interview Assigned
       ↓
Interview Scheduled → Invitation Sent (Email) → Candidate Joins
       ↓
Interview In Progress (WebSocket real-time):
  - AI Persona asks questions (curated → adaptive)
  - Candidate responds (speech-to-text)
  - Proctoring captures screenshots every 15s
  - Integrity events logged (tab switches, face detection)
       ↓
Interview Ended → Evaluation Queued (Background Job):
  - AI grades transcript against rubric
  - Competency scores calculated
  - Integrity score computed
  - Report generated
       ↓
Recruiter Review → Hiring Decision → Archived
```

### Candidate State Machine

```
applied → resume_imported → resume_parsed → jd_matched → shortlisted
    ↓          ↓                ↓              ↓             ↓
 archived   archived        archived       archived      archived
                                                            ↓
shortlisted → interview_assigned → interview_scheduled → invitation_sent
                                                            ↓
invitation_sent → interview_started → interview_running → evaluation_processing
                                                            ↓
evaluation_processing → recruiter_review → hiring_decision → archived
```

### Interview State Machine

```
scheduled → in_progress → evaluation_pending → completed
    ↓           ↓              ↓
  failed      failed         failed
    ↓
  scheduled (retry)
```
