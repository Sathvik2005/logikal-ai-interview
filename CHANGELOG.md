# Changelog

All notable changes to the Lokality AI Interview Platform are documented in this file.

Format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/).

---

## [Unreleased]

---

## [0.3.0] — 2026-06-22

### Summary
Complete backend NestJS scaffolding, frontend-to-backend proxy migration, comprehensive documentation suite, and backend `.env` configuration.

### Added
- **Backend NestJS Application** (`backend/`)
  - Clean Architecture with 4 layers: Domain, Application, Infrastructure, Presentation
  - 9 HTTP Controllers with 56 REST API endpoints
  - WebSocket Gateway (Socket.IO) for real-time interview sessions
  - Prisma ORM schema with 30+ PostgreSQL models
  - Gemini 2.5 AI Orchestrator (resume parsing, JD suggestion, candidate matching, interview Q&A, evaluation, report generation) with mock fallback
  - In-memory queue service (Redis-free for development)
  - Event emitter bus for domain events
  - SupabaseAuthGuard (JWT Bearer token validation with dev fallback)
  - RolesGuard (RBAC endpoint protection)
  - Swagger/OpenAPI documentation at `/api/docs`
  - NotificationService with Resend email integration and outbox pattern
  - PromptLibraryService with default AI prompt seeding
  - Candidate state machine (14 states with transition validation)
  - Interview state machine (5 states: scheduled → completed)
  - EvaluationService (background AI grading pipeline)
  - InterviewEngineService (session management, curated → adaptive Q&A)
  - CandidateWorkflowService (lifecycle state machine driver)
  - FileProcessingPipelineService (resume processing pipeline)
  - VectorMatchingService (JD-Candidate AI matching)

- **Documentation Suite** (`docs/`)
  - `ARCHITECTURE.md` — System overview, architecture diagrams, tech stack, data flows, auth model, AI integration
  - `API_REFERENCE.md` — Complete REST & WebSocket API reference (56 endpoints, request/response examples)
  - `DATABASE_SCHEMA.md` — All 30 tables with ER diagram, column reference, types, constraints
  - `SETUP.md` — Installation, database config, troubleshooting, production deployment guide
  - `PROGRESS.md` — Module-by-module completion status, code statistics, blockers, roadmap

- **Backend Environment** (`backend/.env`)
  - Supabase URL, anon key, and project ID configured
  - DATABASE_URL template (awaiting password)
  - JWT_SECRET, GEMINI_API_KEY, RESEND_API_KEY placeholders

### Changed
- **README.md** — Updated with complete tech stack, documentation index, backend setup instructions, AI capabilities reference, updated project structure
- **Frontend Proxy Migration** — All 17 `src/lib/*.functions.ts` files updated to proxy HTTP requests to NestJS backend at `http://localhost:3000/api/...`:
  - `admin.functions.ts` → `/api/admin/*`
  - `analytics.functions.ts` → `/api/analytics/*`
  - `candidates.functions.ts` → `/api/candidates/*`
  - `candidate-self.functions.ts` → `/api/candidates/*`
  - `governance.functions.ts` → `/api/admin/gdpr/*`
  - `interview-runtime.functions.ts` → `/api/interviews/session/*`
  - `interviews.functions.ts` → `/api/interviews/*`
  - `jobs.functions.ts` → `/api/jobs/*`
  - `monitor.functions.ts` → `/api/interviews/monitor/*`
  - `observability.functions.ts` → `/api/admin/errors`
  - `personas.functions.ts` → `/api/personas/*`
  - `proctoring.functions.ts` → `/api/proctoring/*`
  - `question-bank.functions.ts` → `/api/questions/*`
  - `questions.functions.ts` → `/api/questions/*`
  - `recruiter-dashboard.functions.ts` → `/api/analytics/*`
  - `reports.functions.ts` → `/api/reports/*`
  - `reports-list.functions.ts` → `/api/reports/*`
- **Backend Controllers** — Updated `AnalyticsController` and `InterviewsController` with monitoring and lifecycle management endpoints

---

## [0.2.0] — 2026-06-20

### Summary
Complete frontend UI/UX overhaul with enterprise responsive design system, global layout refactoring, and visual polish across all platform screens.

### Changed
- Global layout system refactored for consistent enterprise responsive design
- All pages use responsive content containers with proper max-width, min-width, flex-1
- Card, dialog, empty state, and report layouts standardized across recruiter, candidate, and admin views
- Homepage redesign with modern animations and premium aesthetics
- Audit and standardization of all empty states

---

## [0.1.0] — 2026-06-20

### Summary
Initial project setup with TanStack Start, React 19, Supabase integration, and core frontend pages.

### Added
- Initial project scaffolding (TanStack Start + Vite + React 19)
- Supabase integration (Auth, Database, Storage)
- File-based routing with TanStack Router
- Recruiter dashboard with candidate management, JD builder, persona configuration
- Candidate interview portal with preparation flow and system checks
- Admin panel with organization management and security settings
- Interview scheduling, monitoring, and reporting pages
- Proctoring system with integrity tracking
- Question bank management
- Analytics and reporting dashboards
- Default credential suite for development and QA
