# Lokality AI — Backend Test Suite Specification

This document provides a detailed specification and execution reference for the Lokality AI backend test suites. The platform uses **NestJS (TypeScript)**, **Jest**, and **Prisma** to run a decoupled, test-driven backend.

The backend test architecture consists of **12 test suites (73 test cases)** covering domain state machines, application workflows, background queue runners, security guards, and HTTP REST controllers. By mocking database and external network boundaries, the test suite guarantees execution speed, reliability, and isolation.

---

## 1. MOCKING & ISOLATION STRATEGY

To prevent external network dependency, database mutations, and LLM token usage during testing, the backend mocks the following boundary points:
1.  **Prisma database client**: Mocked via a spy-enabled fake ORM object (`mockPrismaService`) mimicking Prisma model actions (`findUnique`, `create`, `update`, `findMany`).
2.  **AI Engine**: Mapped to a heuristic parser (`mockAIOrchestrator`) that evaluates resume text matches and grades interview transcripts without calling the Gemini API.
3.  **Queue Service**: A process-local in-memory runner (`mockQueueService` / `InMemoryQueueService`) replacing production Redis/BullMQ brokers.
4.  **Supabase Auth**: Auth token validation and decodes are checked against mock JWT signing processes, bypassing Supabase API calls.
5.  **Event Bus**: Core event dispatching is handled through local pub/sub mocks.

---

## 2. COMPREHENSIVE TEST SUITE CATALOG

The backend test suite is divided into four distinct layers:

```
                  ┌──────────────────────────────┐
                  │      Presentation Layer      │
                  │   - HTTP Controllers & Auth  │
                  └──────────────┬───────────────┘
                                 │
                  ┌──────────────▼──────────────┐
                  │      Application Layer       │
                  │   - Services & Workflow     │
                  └──────────────┬───────────────┘
                                 │
                  ┌──────────────▼──────────────┐
                  │     Infrastructure Layer     │
                  │   - AI Engine & Queues       │
                  └──────────────┬───────────────┘
                                 │
                  ┌──────────────▼──────────────┐
                  │         Domain Layer         │
                  │   - Entities & States        │
                  └──────────────────────────────┘
```

---

### 2.1. Domain Layer (Entity State Machines)

#### 1. Candidate Entity State Machine
*   **File Path**: [candidate.entity.spec.ts](file:///e:/logikaiinterview/backend/src/domain/candidate/candidate.entity.spec.ts)
*   **Target Class**: `Candidate`
*   **Focus**: Verifies domain model construction, event recording, and workflow state invariants.
*   **Verified Scenarios**:
    *   **Construction**: Assures attributes (id, orgId, name, email, phone, skills, experienceYears, resumeUrl, resumeSummary) populate correctly and events list defaults to empty.
    *   **Event Handling**: Verifies domain events can be recorded, retrieved, and cleared.
    *   **State Machine Transitions**: Validates candidate transitions across the sequential lifecycle:
        `applied -> resume_imported -> resume_parsed -> jd_matched -> shortlisted -> interview_assigned -> interview_scheduled -> invitation_sent -> interview_started -> interview_running -> evaluation_processing -> recruiter_review -> hiring_decision -> archived`.
    *   **Archived Recovery**: Confirms that candidates in the `archived` state can be successfully recovered back to `applied`, `resume_imported`, or `resume_parsed`.
    *   **Invariants Control**: Throws a descriptive error when trying to skip states or perform illegal transitions (e.g. transitioning directly from `applied` to `hiring_decision`).

#### 2. Interview Entity State Machine
*   **File Path**: [interview.entity.spec.ts](file:///e:/logikaiinterview/backend/src/domain/interview/interview.entity.spec.ts)
*   **Target Class**: `Interview`
*   **Focus**: Verifies interview scheduling parameters, proctor scores mapping, and lifecycle states.
*   **Verified Scenarios**:
    *   **Construction**: Asserts constructor binds metadata (scheduled time, duration, scores, recommendations) and initial state.
    *   **Event Handling**: Ensures domain events stack and wipe cleanly.
    *   **Happy Path Workflow**: Validates the sequential flow: `scheduled -> in_progress -> evaluation_pending -> completed`.
    *   **Failure and Rescheduling Paths**: Assures failed or crashed sessions can transition to `failed` and back to `scheduled` for retry.
    *   **Guard Invariants**: Prevents transitioning a scheduled interview directly to `completed` without undergoing active execution or evaluation stages.

---

### 2.2. Application Layer (Workflow & Business Logic)

#### 3. Candidate Workflow Service
*   **File Path**: [candidate-workflow.service.spec.ts](file:///e:/logikaiinterview/backend/src/application/candidate/candidate-workflow.service.spec.ts)
*   **Target Class**: `CandidateWorkflowService`
*   **Focus**: Police database persistence of candidate state transitions and timelines logs.
*   **Verified Scenarios**:
    *   `apply`: Registers a candidate profile, pushes an "Application Submitted" event to the database timeline, and publishes `CandidateAppliedEvent` to the event bus.
    *   `transition`: Fetches candidate, applies status transitions, logs a timeline detail entry (e.g., W2 / resume imported), and persists changes. Throws error if candidate not found.
    *   `logTimeline`: Directly appends system and administrator events to the database timeline with metadata payloads.

#### 4. Interview Engine Service
*   **File Path**: [interview-engine.service.spec.ts](file:///e:/logikaiinterview/backend/src/application/interview/interview-engine.service.spec.ts)
*   **Target Class**: `InterviewEngineService`
*   **Focus**: Directs real-time session execution, proctor event handling, and turn appending.
*   **Verified Scenarios**:
    *   `startSession`: Bumps interview status to `in_progress`, creates the `InterviewSession` record with device info (e.g. browser context), and transitions the candidate status to `interview_started`.
    *   `appendTurn`: Records dialogue exchanges (transcript text and audio paths) in the database and updates candidate timeline.
    *   `recordEvent`: Intercepts candidate proctor events (such as `tab_switch`), creates an `InterviewEvent` entry, and logs an `integrity_violation` timeline alarm for suspicious behavior.
    *   `getNextQuestion`: Generates adaptive questions via `AIOrchestrator` using the candidate's profile, resume summary, job description, and dialogue history.
    *   `endSession`: Saves the session `ended_at` timestamp, changes interview state to `evaluation_pending`, sets queue status to `queued`, and registers the finalized task in the processing queue.

#### 5. Evaluation Service
*   **File Path**: [evaluation.service.spec.ts](file:///e:/logikaiinterview/backend/src/application/interview/evaluation.service.spec.ts)
*   **Target Class**: `EvaluationService`
*   **Focus**: Orchestrates post-interview conversation analysis, grading, and report delivery.
*   **Verified Scenarios**:
    *   `onModuleInit`: Registers the `"finalize-evaluation"` handler on the background queue runner.
    *   `finalizeEvaluation`: Coordinates the grading pipeline:
        1. Sets evaluation status to `running`.
        2. Queries transcript turns and proctoring event counts.
        3. Calls `AIOrchestrator` to generate competencies scores, strengths, weaknesses, overall score, and integrity rating (deducting points for tab switches).
        4. Saves report details to `InterviewReport` model.
        5. Transitions candidate state to `recruiter_review`.
        6. Fires `EvaluationCompletedEvent`.
        7. Enqueues a `send-notification` email task containing the score and recruiter link.
    *   **Failure Recovery**: Changes evaluation status to `failed` and rethrows exceptions if database operations or AI calls fail.

#### 6. Notification Outbox Service
*   **File Path**: [notification.service.spec.ts](file:///e:/logikaiinterview/backend/src/application/services/notification.service.spec.ts)
*   **Target Class**: `NotificationService`
*   **Focus**: Manages transaction email delivery via Resend and handles offline mock fallbacks.
*   **Verified Scenarios**:
    *   `onModuleInit`: Connects the `"send-notification"` consumer.
    *   **Heuristic Mock Log Mode**: When `RESEND_API_KEY` is absent, writes a transaction log in `NotificationOutbox` table and outputs a mock logger string: `[Email Output Mock LOG] To: ...`.
    *   **Resend Client Integration**: When `RESEND_API_KEY` is present, formats HTML email templates (invitations, welcomes, summaries) and dispatches via Resend SDK. Sets outbox status to `sent` or `failed` with error text on SMTP failure.

#### 7. Prompt Library Service
*   **File Path**: [prompt-library.service.spec.ts](file:///e:/logikaiinterview/backend/src/application/services/prompt-library.service.spec.ts)
*   **Target Class**: `PromptLibraryService`
*   **Focus**: Seeds and manages AI system instructions and templates.
*   **Verified Scenarios**:
    *   `onModuleInit`: Seeds 5 default core prompt templates (`RESUME_PARSE_AGENT`, `JD_MATCHING_AGENT`, `INTERVIEW_AGENT`, `EVALUATION_AGENT`, `REPORT_AGENT`) into database if not present.
    *   `getPrompt`: Retrieves prompt from database, falls back to default hardcoded string on database miss, and throws a NotFound error for invalid names.
    *   `updatePrompt`: Allows updating prompts to modify AI persona behavior on-the-fly.

---

### 2.3. Infrastructure Layer (AI Orchestrator & Queues)

#### 8. Gemini Orchestrator Service (Mock Fallback Mode)
*   **File Path**: [gemini-orchestrator.service.spec.ts](file:///e:/logikaiinterview/backend/src/infrastructure/ai/gemini-orchestrator.service.spec.ts)
*   **Target Class**: `GeminiOrchestratorService`
*   **Focus**: Assures heuristic mock parsing logic is functional when running offline.
*   **Verified Scenarios**:
    *   `parseResume`: Extracts candidate email, phone, and experience years using string regex matches and returns a preset skills list.
    *   `suggestJd`: Suggests typical requirements based on title inputs.
    *   `matchJdCandidate`: Calculates match scores by checking intersection sizes between candidate skills and job requirements.
    *   `generateInterviewQuestion`: Synthesizes adaptive interview prompts. If history is empty, starts with a generic icebreaker; if a curated question list is present, yields it; otherwise, dynamically references scalability or error-handling topics.
    *   `evaluateInterview`: Generates mock scorecards and integrity scores (reducing score by 10 points per tab switch).
    *   `generateReportMarkdown`: Outputs clean, structured candidate evaluation reports formatted in markdown.

#### 9. In-Memory Queue Service
*   **File Path**: [in-memory-queue.service.spec.ts](file:///e:/logikaiinterview/backend/src/infrastructure/queue/in-memory-queue.service.spec.ts)
*   **Target Class**: `InMemoryQueueService`
*   **Focus**: Tests process-local, timer-driven task execution.
*   **Verified Scenarios**:
    *   **Asynchronous Processing**: Checks that enqueued tasks are executed asynchronously via `setImmediate` using fake timers.
    *   **Delayed Execution**: Validates that delayed tasks (e.g. email reminders) execute only after `setTimeout` timer fires.
    *   **Missing Handler Warnings**: Logs warnings if a task runs without a registered processor.
    *   **Error Isolation**: Prevents handler exceptions from crashing the queue, logging the stack trace and proceeding with subsequent tasks.

---

### 2.4. Presentation Layer (Controllers & Security)

#### 10. Candidates HTTP REST Controller
*   **File Path**: [candidates.controller.spec.ts](file:///e:/logikaiinterview/backend/src/presentation/http/candidates.controller.spec.ts)
*   **Target Class**: `CandidatesController`
*   **Focus**: Routes candidate operations and handles file ingestion requests.
*   **Verified Scenarios**:
    *   `list`: Fetches paginated lists, sorting candidates by creation date and filtering by name, email, or status.
    *   `getOne`: Queries a specific candidate, including timeline logs and job matching tables.
    *   `create`: Extracts the processors' tenant ID (`orgId`) from Supabase claims and runs the candidate registration pipeline.
    *   `updateStatus`: Validates states and transitions candidate status (e.g. to `shortlisted`).
    *   `uploadResume`: Accepts multi-part file uploads and triggers the resume processing pipeline.
    *   `getTimeline`: Returns sorted timeline activity events for a candidate.

#### 11. Interviews HTTP REST Controller
*   **File Path**: [interviews.controller.spec.ts](file:///e:/logikaiinterview/backend/src/presentation/http/interviews.controller.spec.ts)
*   **Target Class**: `InterviewsController`
*   **Focus**: Directs REST paths for scheduling, real-time WebSocket signals, and evaluation status lookups.
*   **Verified Scenarios**:
    *   `list`: Retreives scheduled interviews filtered by date ranges and limits.
    *   `schedule`: Automates template setup, schedules the interview slot, transitions candidate status to `invitation_sent`, and enqueues invitation email delivery.
    *   `start`/`end`: Delegates session life controls to the engine.
    *   `getTurns`: Fetches conversational turns.
    *   `appendTurn`: Delegates speech logs appending to the interview engine.
    *   `logEvent`: Pushes proctoring alerts to the engine.
    *   `finalizeEvaluation`: Triggers the background grading worker.
    *   `getEvaluation`: Exposes live scorecard status for recruiter review.

#### 12. Supabase Authentication Guard
*   **File Path**: [supabase-auth.guard.spec.ts](file:///e:/logikaiinterview/backend/src/presentation/guards/supabase-auth.guard.spec.ts)
*   **Target Class**: `SupabaseAuthGuard`
*   **Focus**: Security gate policing REST routes access.
*   **Verified Scenarios**:
    *   **Missing Header check**: Rejects calls with `401 Unauthorized` if the `Authorization` header is missing.
    *   **Header Format check**: Rejects calls if the header format is not `Bearer <token>`.
    *   **Mock Token Decode**: Decodes JWT sub, email, role, and orgId payload claims without signature check when `JWT_SECRET` is unset.
    *   **Strict Verification**: Performs full cryptographic validation against `JWT_SECRET` when configured, rejecting modified payloads.
