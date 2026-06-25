# Lokality AI — Product & Technical Specification Document

---

## 1. PRODUCT EPICS, USER STORIES & ACCEPTANCE CRITERIA

This section lists the platform's development tasks, organized into epics, stories, and acceptance criteria using Gherkin (`Given-When-Then`) syntax.

---

### Epic 1: Candidate Sourcing & Profile Matching
*Goal: Automate profile parsing via AI document extraction and rank candidate suitability against job description requirements using vector similarity metrics.*

#### User Story 1.1: As a Recruiter, I want to upload a candidate's resume PDF so the platform automatically extracts their skills and experience.
*   **Acceptance Criteria:**
    *   **Scenario: Resume upload is processed successfully**
        *   *Given* the recruiter is authenticated and on the candidate list page
        *   *When* they select a valid PDF file (< 10MB) and drop it into the upload zone
        *   *Then* the file is processed asynchronously by the pipeline
        *   *And* a new candidate is registered in the "resume_parsed" state with extracted attributes (name, email, skills, summary) populated
    *   **Scenario: Gemini API Key is missing (Developer Fallback)**
        *   *Given* the platform is running without `GEMINI_API_KEY` configured
        *   *When* a resume is uploaded
        *   *Then* the system falls back to the in-memory mock text parser
        *   *And* successfully extracts attributes with predefined mockup lists (e.g., John Doe, React, Node) without crashing
*   **Development Tasks:**
    *   [x] Set up Express Multer interceptor in `CandidatesController`
    *   [x] Build `FileProcessingPipelineService` parsing buffers
    *   [x] Implement Gemini Mock heuristic fallback in `GeminiOrchestratorService`
    *   [x] Write unit tests in `gemini-orchestrator.service.spec.ts`

#### User Story 1.2: As a Recruiter, I want the system to calculate candidate compatibility against JD requirements so I can shortlist candidates.
*   **Acceptance Criteria:**
    *   **Scenario: Vector match score calculated**
        *   *Given* a candidate's profile is parsed and updated
        *   *When* compared against a job description's competencies
        *   *Then* the system updates the `jd_candidate_matches` entry with a score (0-100%) and a structured text fit analysis.
*   **Development Tasks:**
    *   [x] Implement matching methods in `VectorMatchingService`
    *   [x] Add `jd_candidate_matches` Prisma relational triggers

---

### Epic 2: Intelligent Interview Design & Persona Engine
*Goal: Allow recruiters to build customized AI interviewer persona versions and manage question banks.*

#### User Story 2.1: As a Recruiter, I want to configure an AI interviewer persona with distinct behavioral instructions so candidates undergo customized screenings.
*   **Acceptance Criteria:**
    *   **Scenario: Creating a Persona Version**
        *   *Given* the recruiter is in the Persona editor
        *   *When* they configure tone guidelines (e.g., "Aria: warm, probing, brief follow-ups")
        *   *Then* the system registers a new `persona_versions` entry
        *   *And* references this config during interview questions generation.
*   **Development Tasks:**
    *   [x] Build `PersonasController` and prisma queries
    *   [x] Implement template mappings in `InterviewEngineService`

---

### Epic 3: Proctoring & Self System Validation
*Goal: Ensure candidate device compatibility and enforce session integrity during active interviews.*

#### User Story 3.1: As a Candidate, I want to run a system compatibility check so I can ensure my webcam and microphone work before beginning the interview.
*   **Acceptance Criteria:**
    *   *Given* the candidate is on the system-check screen
    *   *When* camera/microphone permissions are granted
    *   *Then* the interface renders a live webcam stream and an audio frequency waveform visualizer
    *   *And* enables the "Enter Interview Room" transition button.
*   **Development Tasks:**
    *   [x] Map WebRTC camera feed constraints in React client
    *   [x] Wire WebSocket telemetry checks in `InterviewGateway`

#### User Story 3.2: As a Recruiter, I want the system to log a timeline event when a candidate leaves the tab or opens devtools so I can audit cheating signals.
*   **Acceptance Criteria:**
    *   *Given* the candidate is inside the active interview page
    *   *When* the browser fires a `visibilitychange` focus-loss listener or webcam detects multiple faces
    *   *Then* the client sends a `proctor-alert` WebSocket event to the server
    *   *And* the server logs an `integrity_violation` record on the candidate timeline database.
*   **Development Tasks:**
    *   [x] Implement `recordEvent` in `InterviewEngineService`
    *   [x] Add logic in `SupabaseAuthGuard` mapping candidate session roles
    *   [x] Implement `tab_switch` listener in candidate view screen

---

### Epic 4: Post-Interview Automated Grading & Scorecarding
*Goal: Grade transcripts, deduct cheating violations, and produce PDF reports.*

#### User Story 4.1: As a Recruiter, I want the system to automatically evaluate the interview once the session closes so I can inspect scored metrics.
*   **Acceptance Criteria:**
    *   *Given* an interview transitions to `completed`
    *   *When* the `finalize-evaluation` queue triggers evaluation grading
    *   *Then* the AI Orchestrator calculates scoring matrices (technical, communication, integrity) and writes scorecard highlights to `interview_reports`.
*   **Development Tasks:**
    *   [x] Write evaluation logic in `EvaluationService`
    *   [x] Implement automated integrity score deductions in grading
    *   [x] Add unit tests in `evaluation.service.spec.ts`

---

## 2. FRONTEND SCREEN DIRECTORY & UX SPECIFICATIONS

This section details every page route within the application, explaining layout dimensions, component composition, specific element attributes (IDs/selectors), React state hook schemas, and edge case error mitigations.

### 2.1. Candidate Portal Module

#### 2.1.1. Invitation Acceptance Portal (`/join/$token`)
*   **Layout Context:** Split flex column/row layout. Left column shows brand graphics, right column centers a glassmorphic authorization form with background blur (`backdrop-blur-lg bg-slate-900/40 border border-slate-700/50`).
*   **Component Hierarchy:**
    *   `JoinContainer` (Parent Flex Frame)
        *   `BrandSection` (Logo, Headline text)
        *   `InvitationCard` (Main UI Box)
            *   `JobDetailsSummary` (Position title, organization, estimated duration)
            *   `AcceptForm` (Name field, Email field)
            *   `SubmitButton` (Primary CTA)
*   **UI Elements, Selectors, and IDs:**
    | Element | Selector/ID | Type | Attributes / Behavior |
    | :--- | :--- | :--- | :--- |
    | Name Input | `#candidate-name-input` | `text` | required, placeholder="Jane Doe" |
    | Email Input | `#candidate-email-input` | `email` | required, validated email format |
    | Accept CTA | `#btn-accept-invitation` | `button` | indigo-600 background, dynamic spinner if loading |
*   **Client State Mapping (React Hooks):**
    *   `const [formData, setFormData] = useState({ name: '', email: '' });`
    *   `const { mutate: verifyToken, isLoading } = useMutation(joinAPI);`
*   **UX Edge Cases & Mitigations:**
    *   *Invalid Token*: If the token in the URL is malformed or not found in the database, lock fields, display a banner alert (`#banner-token-expired`) saying *"Invitation code invalid"*, and disable the Accept CTA.
    *   *Network Timeout*: If the accept request hangs, release the button loading spinner after 10 seconds and display a local toast alert: *"Unable to reach the server. Please verify your connection."*

#### 2.1.2. Pre-Interview Preparation (`/candidate/prepare`)
*   **Layout Context:** Dual column layout (60% Info Panel, 40% Proctoring checklist card). Features a dark aesthetic with gradient borders (`border-gradient-to-r from-indigo-500 to-purple-500`).
*   **Component Hierarchy:**
    *   `PrepareLayout`
        *   `SystemOverviewCard` (Job description, estimated questions count, timeline indicator)
        *   `IntegrityRulesCard` (Proctoring policy, warning alerts, screen monitoring guidelines)
        *   `NavigationActions` (Checklist confirmation toggle, next step button)
*   **UI Elements, Selectors, and IDs:**
    | Element | Selector/ID | Type | Attributes / Behavior |
    | :--- | :--- | :--- | :--- |
    | Acknowledge Checkbox | `#check-rules-consent` | `checkbox` | Must be ticked to enable CTA |
    | Proceed CTA | `#btn-start-check` | `button` | Transitions candidate to `/candidate/system-check` |
*   **Client State Mapping (React Hooks):**
    *   `const [hasConsented, setHasConsented] = useState(false);`
    *   `const { data: interviewData, isLoading } = useQuery(['self-interview'], fetchSelfInterview);`
*   **UX Edge Cases & Mitigations:**
    *   *No Interview Found*: If the candidate has no scheduled or active interview assigned to their identifier, render the `AccessDenied` card and hide the scheduler panels.

#### 2.1.3. Pre-Flight System Check (`/candidate/system-check`)
*   **Layout Context:** Row layout grouping the local WebRTC media streamer card (left) and the validation checklist panel (right).
*   **Component Hierarchy:**
    *   `SystemCheckLayout`
        *   `StreamPreviewContainer`
            *   `LocalVideoElement` (HTML5 `<video>`)
            *   `AudioWaveformCanvas` (Waveform visualization)
        *   `HardwareChecklist`
            *   `CameraCheckRow`
            *   `MicrophoneCheckRow`
            *   `FocusCheckRow`
        *   `LaunchControl` (CTA)
*   **UI Elements, Selectors, and IDs:**
    | Element | Selector/ID | Type | Attributes / Behavior |
    | :--- | :--- | :--- | :--- |
    | Live Webcam Stream | `#webcam-stream-preview` | `video` | playsinline, muted, rounded-xl borders |
    | Waveform Graphic | `#audio-mic-waveform` | `canvas` | 2D audio visualizer drawing line inputs |
    | Start Room CTA | `#btn-enter-interview` | `button` | Disabled until all check badges are green |
*   **Client State Mapping (React Hooks):**
    *   `const [stream, setStream] = useState<MediaStream | null>(null);`
    *   `const [checks, setChecks] = useState({ camera: false, mic: false, focus: false });`
*   **UX Edge Cases & Mitigations:**
    *   *Camera Access Denied*: If the browser throws a `NotAllowedError` during media constraints request, render a custom instruction dialog (`#dialog-media-help`) showing steps on how to reset camera access in Chrome, Firefox, and Safari.
    *   *No Microphone Signal*: If the average microphone input amplitude is below 1% for 3 seconds, mark the microphone badge as orange ("Low input") and prompt the candidate to check their physical volume levels.

#### 2.1.4. Live Proctoring Interview Room (`/candidate/interview`)
*   **Layout Context:** Screen-filling grid view. The top half renders the AI interviewer avatar breathing animation loops. The lower screen renders candidate camera feedback, live text transcripts, and audio monitors.
*   **Component Hierarchy:**
    *   `InterviewRoomLayout`
        *   `AIInterviewerScreen` (Persona state visuals, pulse wave loops)
        *   `LiveSubtitles` (Speech-to-text text lines)
        *   `ControlHUD`
            *   `MicIndicator`
            *   `WebcamBubble` (Floating candidate PIP)
            *   `RequestNextQuestionCTA`
*   **UI Elements, Selectors, and IDs:**
    | Element | Selector/ID | Type | Attributes / Behavior |
    | :--- | :--- | :--- | :--- |
    | AI Avatar Box | `#ai-avatar-canvas` | `div` | HSL breathing ring animation layers |
    | Subtitle Box | `#subtitle-text-container` | `div` | Streams question character-by-character |
    | Pip Camera | `#candidate-pip-webcam` | `video` | Small camera bubble fixed to the screen edge |
    | Warning overlay | `#alert-tab-switch-warning` | `div` | Renders red overlay alert during focus loss |
*   **Client State Mapping (React Hooks):**
    *   `const socket = useRef<Socket | null>(null);`
    *   `const [turns, setTurns] = useState<Turn[]>([]);`
    *   `const [interviewerState, setInterviewerState] = useState<'thinking' | 'speaking' | 'listening'>('listening');`
*   **UX Edge Cases & Mitigations:**
    *   *Webcam Disconnect*: If the WebRTC stream track throws an `ended` event during the interview, pause session execution, display a modal prompt (`#dialog-camera-lost`), emit an alert socket flag to the live recruiter monitor, and lock interview inputs until hardware reconnects.
    *   *Network Fluctuation*: If the WebSocket connection drops, immediately set a gray status badge saying "Reconnecting...", cache speech transcripts locally, and try to restore connection for 30s.

---

### 2.2. Recruiter Workspace Module

#### 2.2.1. Recruiter Dashboard (`/recruiter/`)
*   **Layout Context:** Standard grid template (3 columns for summary cards, split sidebar panels for live monitor feeds and recent uploads).
*   **Component Hierarchy:**
    *   `RecruiterDashboard`
        *   `MetricsRow` (Metric cards with counters)
        *   `LiveFeedPanel` (List of active interview sessions)
        *   `ActivitiesList` (Parses, evaluations, updates)
*   **UI Elements, Selectors, and IDs:**
    | Element | Selector/ID | Type | Attributes / Behavior |
    | :--- | :--- | :--- | :--- |
    | Summary Card: JDs | `#metric-jds-count` | `div` | Count of active job postings |
    | Summary Card: Cand | `#metric-candidates-count` | `div` | Count of evaluated candidates |
    | Quick Action Button | `#btn-quick-schedule` | `button` | Opens the scheduling drawer |

#### 2.2.2. Candidate Profiles Table (`/recruiter/candidates`)
*   **Layout Context:** Table view. Search toolbar at the top; paginated candidate lists in the main container; upload panels in a slide-out drawer.
*   **Component Hierarchy:**
    *   `CandidateManager`
        *   `SearchFilterBar`
        *   `CandidatesTable` (Data grid with column filters)
        *   `ResumeUploadDrawer` (Multer drag-and-drop zone)
*   **UI Elements, Selectors, and IDs:**
    | Element | Selector/ID | Type | Attributes / Behavior |
    | :--- | :--- | :--- | :--- |
    | Search Field | `#input-candidates-search` | `input` | text search (name, skills) |
    | Upload Area | `#dropzone-resume-upload` | `div` | Handles resume file drop, triggers upload loader |
    | Export CSV CTA | `#btn-export-candidates-csv` | `button` | Downloads tabular candidate metrics |
*   **Client State Mapping (React Hooks):**
    *   `const [filters, setFilters] = useState({ search: '', status: '' });`
    *   `const { data: candidates } = useQuery(['candidates', filters], fetchCandidates);`

#### 2.2.3. Job Description & Matching Agent (`/recruiter/jobs`)
*   **Layout Context:** Grid split layout. Left panel contains edit forms; right panel displays the AI copilot helper window.
*   **Component Hierarchy:**
    *   `JobManager`
        *   `JobEditForm` (Form inputs)
        *   `AICopilotPanel` (Markdown preview suggested prompts)
*   **UI Elements, Selectors, and IDs:**
    | Element | Selector/ID | Type | Attributes / Behavior |
    | :--- | :--- | :--- | :--- |
    | Job Title Input | `#input-job-title` | `text` | required |
    | AI Copilot Button | `#btn-generate-job-description`| `button` | Requests AI copilot suggestions |
    | Apply Suggestion | `#btn-apply-ai-jd` | `button` | Copies AI text into editor fields |
*   **Client State Mapping (React Hooks):**
    *   `const [title, setTitle] = useState('');`
    *   `const [suggestion, setSuggestion] = useState({ description: '', requirements: '' });`

#### 2.2.4. Interview Scheduler (`/recruiter/scheduling`)
*   **Layout Context:** Dual panel screen. Scheduling form inputs on the left; visual calendar grids showing candidate slots on the right.
*   **Component Hierarchy:**
    *   `SchedulerLayout`
        *   `SchedulingForm`
        *   `CalendarGrid`
*   **UI Elements, Selectors, and IDs:**
    | Element | Selector/ID | Type | Attributes / Behavior |
    | :--- | :--- | :--- | :--- |
    | Select Candidate | `#select-candidate-option` | `select` | Dropdown of registered candidates |
    | Date Time Picker | `#datepicker-scheduled-time` | `datetime-local` | Target date/time input |
    | Schedule Button | `#btn-submit-schedule` | `button` | Submits form, queues notification |
*   **Client State Mapping (React Hooks):**
    *   `const [formState, setFormState] = useState({ candidateId: '', scheduledAt: '' });`

#### 2.2.5. Live Proctoring Monitor (`/recruiter/monitor`)
*   **Layout Context:** Dashboard layout. Left grid displays active candidates; right logs active proctoring events.
*   **Component Hierarchy:**
    *   `LiveMonitor`
        *   `ActiveGrid` (Grid list of live sessions)
            *   `CandidateCard` ( वेबकैम preview thumbnail + status + current question details)
        *   `IntegrityFeed` (Chronological warning stream)
*   **UI Elements, Selectors, and IDs:**
    | Element | Selector/ID | Type | Attributes / Behavior |
    | :--- | :--- | :--- | :--- |
    | Candidate Status | `#candidate-card-status` | `badge` | Shows status (e.g. `speaking`, `focus_lost`) |
    | Warning Row | `#feed-event-alert` | `div` | Red flashing row alert for integrity violations |
    | Manual Flag CTA | `#btn-flag-event` | `button` | Logs notes manually |

#### 2.2.6. Candidate Scorecard Report (`/recruiter/reports`)
*   **Layout Context:** Tabbed panels. Overview (Competency radar maps) ➔ Transcript (Searchable conversation records) ➔ Integrity (Logs and webcam snapshots) ➔ Export functions.
*   **Component Hierarchy:**
    *   `ScorecardReport`
        *   `AssessmentHeader` (Recommendation labels, matching score values)
        *   `ReportsTabs`
            *   `OverviewTab` (Radar charts, strengths, concerns)
            *   `TranscriptTab` (Conversation lines)
            *   `IntegrityTab` (Timeline logs, webcam snapshots grid)
*   **UI Elements, Selectors, and IDs:**
    | Element | Selector/ID | Type | Attributes / Behavior |
    | :--- | :--- | :--- | :--- |
    | Recommendation Label | `#label-scorecard-verdict` | `badge` | hire, strong_hire, no_hire, strong_no_hire |
    | Radar Chart Graphic | `#scorecard-radar-chart` | `svg` | Competency scores rendered as dynamic SVG polygons |
    | Export PDF Button | `#btn-export-pdf` | `button` | Renders report context as a print-friendly document |

---

### 2.3. Platform Administration Module

#### 2.3.1. System Settings Control (`/admin/settings`)
*   **Layout Context:** Left sidebar tabs structure updating configurations in form modules.
*   **Component Hierarchy:**
    *   `AdminSettings`
        *   `SettingsNav`
        *   `KeyConfigForm` (Gemini, Resend, JWT keys)
        *   `SystemAuditTable` (Audits checklist grid)
*   **UI Elements, Selectors, and IDs:**
    | Element | Selector/ID | Type | Attributes / Behavior |
    | :--- | :--- | :--- | :--- |
    | Gemini Input Key | `#input-gemini-key` | `password` | Sets `GEMINI_API_KEY` |
    | Resend Input Key | `#input-resend-key` | `password` | Sets `RESEND_API_KEY` |
    | Save Settings Button | `#btn-save-admin-keys` | `button` | Submits form, updates process configurations |

---

## 3. COMPREHENSIVE DATABASE SCHEMA MAPS

The following shows how frontend configurations map to specific columns and relations in the Prisma database layer:

```
[Candidate Workspace Upload]
    ➔ candidate.repository.ts
    ➔ candidates Table (id, full_name, email, skills, experience_years)

[Scheduling Interview Panel]
    ➔ interviews Table (candidate_id, template_id, scheduled_at, status)
    ➔ interview_templates Table (id, evaluation_criteria, proctoring_policy)

[Active Live Interview Room]
    ➔ interview_sessions Table (id, started_at, device_info)
    ➔ interview_turns Table (session_id, speaker, text, audio_path)
    ➔ interview_events Table (session_id, type, payload)

[Post-Interview AI Evaluator]
    ➔ interview_reports Table (interview_id, scores, strengths, weaknesses, executive_summary)
    ➔ notification_outbox Table (recipient_email, status, kind)
```

---

## 4. STEP-BY-STEP PLATFORM ALGORITHMS

Below are step-by-step algorithms governing core platform processes.

---

### 4.1. Resume Document Parsing Pipeline
Processes uploaded resume documents, parses text content, and extracts structured fields.

```
Input: OrgId, CandidateId, FileBuffer, MimeType
Output: Update Candidate status to "resume_parsed", populate skills/experience in Database

Step 1: Verify document extension matches pdf/doc. Return error if invalid.
Step 2: Extract raw text from FileBuffer.
Step 3: Check process.env.GEMINI_API_KEY status.
        IF key is unconfigured OR dummy:
            Run Mock Parser:
                1. Extract Email: Find regex pattern match /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}\b/
                2. Extract Phone: Find regex pattern match /\b(?:\+?\d{1,3}[- ]?)?\(?\d{3}\)?[- ]?\d{3}[- ]?\d{4}\b/
                3. Extract Exp Years: Parse text matches matching number preceding "years experience"
                4. Extract Skills: Match text against a default seed index ["React", "TypeScript", "Node"]
                5. Populate placeholder summary.
        ELSE:
            Run Gemini AI Parser:
                1. Fetch RESUME_PARSE_AGENT prompt from PromptLibrary database.
                2. Call Google Generative AI client using model "gemini-2.5-flash".
                3. Parse the output JSON content and extract values.
Step 4: Update Candidate entry in database table:
        SET full_name = parsed.name, email = parsed.email, skills = parsed.skills, 
            experience_years = parsed.experienceYears, resume_summary = parsed.resumeSummary,
            status = "resume_parsed".
Step 5: Write Timeline record:
        INSERT INTO candidate_timeline (candidate_id, event_type: "resume_parsed", description: "Profile extracted successfully.")
Step 6: Trigger Match Job calculations.
```

---

### 4.2. Vector Similarity Candidate-JD Matcher
Calculates compatibility metrics between candidate attributes and job requirements.

```
Input: Candidate Profile (Skills, Summary, Experience), Job Description (Title, Requirements)
Output: Match percentage score (0-100), detailed fit analysis paragraph

Step 1: Check process.env.GEMINI_API_KEY status.
        IF key is unconfigured OR dummy:
            Run Mock Similarity calculation:
                1. Split JD requirements text into lowercase word array.
                2. For each skill in candidate profile skills list:
                     IF JD text contains skill: increment MatchCount by 1.
                3. Score = (Candidate.skills.length > 0) 
                     ? Math.min(60 + (MatchCount / Candidate.skills.length) * 40, 100) 
                     : 75.
                4. Set Mock Analysis: "Technical alignment confirmed across matched skills."
        ELSE:
            Run Gemini AI Matcher:
                1. Load JD_MATCHING_AGENT prompt from PromptLibrary.
                2. Construct prompt user payload passing JD requirements and candidate profile JSON.
                3. Call Gemini model "gemini-2.5-flash".
                4. Parse response JSON containing: "matchScore" and "analysis".
Step 2: Save match results to database:
        INSERT INTO jd_candidate_matches (candidate_id, job_id, score, analysis)
Step 3: Update candidate status:
        SET candidate.status = "jd_matched"
Step 4: Write Candidate Timeline record indicating completed match calculations.
```

---

### 4.3. Adaptive Question Prompting State Machine
Governs conversation flow and dynamic question generation during live interview sessions.

```
Input: SessionId
Output: Next question text

Step 1: Load Session, Interview, Persona, and JD details from Database.
Step 2: Load Candidate Details (Name, Skills list, Resume summary).
Step 3: Query all previous turns matching the SessionId ordered by date.
Step 4: Filter candidate turns and count them (CandidateTurnsCount).
Step 5: Query template question bank list for configured curated questions:
        IF CandidateTurnsCount < CuratedQuestions.length:
            Select next curated question prompt:
               Set NextCuratedQuestion = CuratedQuestions[CandidateTurnsCount].question.prompt
        ELSE:
            Set NextCuratedQuestion = undefined (switch to adaptive follow-up mode)
Step 6: Construct AI model payload containing:
        - Persona prompt guidelines (Ava/Aria tone controls)
        - Candidate profile context summary
        - Job Description title/requirements context
        - Sequential Conversation history lines
        - NextCuratedQuestion directive (if present)
Step 7: Check process.env.GEMINI_API_KEY status.
        IF key is unconfigured:
             IF CandidateTurnsCount == 0:
                 Return default opening question: "Hello! Welcome today. Could you tell me about your background?"
             ELSE IF NextCuratedQuestion is present:
                 Return NextCuratedQuestion
             ELSE:
                 Return default follow-up question: "Could you elaborate on how you handled scalability in that project?"
        ELSE:
             1. Call Gemini client model "gemini-2.5-flash".
             2. Extract generated output text block.
Step 8: Save turn record in Database:
        INSERT INTO interview_turns (session_id, speaker: "persona", text: questionText)
Step 9: Write Candidate Timeline log:
        INSERT INTO candidate_timeline (candidate_id, event_type: "turn_persona", description: questionTextSnippet)
Step 10: Return question text payload.
```

---

### 4.4. AI Transcript Grading & Integrity Penalization
Grades the candidate's responses and adjusts the final score based on proctoring warnings.

```
Input: InterviewId, SessionId
Output: Save completed scores and scorecard report to Database

Step 1: Update interview record: Set evaluation_status = "running".
Step 2: Fetch all interview turns matching the SessionId ordered by date.
Step 3: Query all proctoring events matching the SessionId:
        - Count events matching type "tab_switch" (TabSwitchCount)
        - Count events matching type "devtools" (DevToolsCount)
        - Count events matching type "focus_loss" (FocusLossCount)
Step 4: Load Rubric constraints from Interview Template configuration.
Step 5: Check process.env.GEMINI_API_KEY status.
        IF key is unconfigured:
            Run Mock Evaluation:
                1. Set overallScore = 82
                2. Set competencyScores = { "Technical": 85, "Communication": 80 }
                3. Calculate IntegrityScore:
                     Set IntegrityScore = Max(100 - (TabSwitchCount * 10) - (DevToolsCount * 30), 50)
                4. Set recommendation = "hire"
                5. Populate strengths, concerns, and summaries list.
        ELSE:
            Run Gemini AI Evaluation:
                1. Fetch EVALUATION_AGENT prompt from PromptLibrary.
                2. Format payload containing: Transcript turns list, Rubric details, and Integrity events count.
                3. Call Gemini Pro model "gemini-2.5-pro".
                4. Parse response JSON extracting scores, recommendations, strengths, concerns.
                5. Integrity Score calculation check:
                     Ensure AI grading reflects recorded proctor violations. If not, deduct score using standard rules:
                       FinalIntegrityScore = Math.max(parsed.integrityScore - (TabSwitchCount * 10), 0).
Step 6: Update Interview Database record:
        SET status = "completed", evaluation_status = "done", overall_score = evaluation.overallScore,
            integrity_score = evaluation.integrityScore, recommendation = evaluation.recommendation,
            evaluation = evaluationJSON.
Step 7: Generate markdown formatted report using prompt template "REPORT_AGENT":
        IF key is unconfigured:
             Set ReportMarkdown = "# Candidate Report... (Mock contents)"
        ELSE:
             Call Gemini "gemini-2.5-flash" passing candidate details, JD details, and evaluation results.
Step 8: Save report details:
        INSERT INTO interview_reports (interview_id, org_id, executive_summary: ReportMarkdown, 
                                      scores: competencyScores, strengths, weaknesses)
Step 9: Transition Candidate status:
        SET candidate.status = "recruiter_review"
Step 10: Dispatch EvaluationCompletedEvent onto EventBus.
Step 11: Queue notification worker email: "interview_report_ready" (Via Resend Client).
```

---

## 5. END-TO-END WORKFLOW SPECIFICATIONS

This section outlines the 11 key workflows of the Lokality AI platform, detailing the UI/UX user interactions, underlying backend functionalities, and acceptance criteria in Gherkin format.

---

### 5.1. Recruiter Onboarding & Organization Setup Workflow

#### A. UI/UX Flow
1.  **Sign-Up Page**: The recruiter lands on `/auth?mode=signup` and inputs their email, password, and full name.
2.  **Organization Configuration Form**: Upon successful email registration, they are redirected to a profile creation screen (`/recruiter/setup`) featuring a glassmorphic Card. The form inputs ask for:
    *   Organization Name (`#input-setup-org-name`)
    *   Industry type dropdown (`#select-setup-industry`)
    *   Company size selections (`#select-setup-size`)
3.  **Visual Indicators**: Clicking "Create Workspace" shows an inline spinner inside the button (`#btn-setup-submit`). Upon completion, a fade-in animation transitions the user to the recruiter dashboard.

#### B. Functionality
1.  **Auth Triggers**: Supabase GoTrue registers the recruiter credentials and returns a JWT token.
2.  **API Integration**: The client makes a `POST /api/admin/organizations` request carrying the JWT claims.
3.  **Prisma Transactions**:
    *   Creates an `Organization` record in the database.
    *   Creates a `Profile` record linked to the Supabase User UID.
    *   Assigns the `admin` or `recruiter` role inside the `user_roles` mapping table.

#### C. Acceptance Criteria
*   **Scenario: Successful Organization and Recruiter Setup**
    *   *Given* a new user is registering credentials on the signup form
    *   *When* they submit the form and complete organization configurations
    *   *Then* the database creates a corresponding `organizations` entry
    *   *And* creates a `profiles` entry linking the recruiter's organization reference
    *   *And* redirects the recruiter to `/recruiter/` with an active authorization session
*   **Scenario: Organization Name Blank**
    *   *Given* the recruiter is on the organization configuration form
    *   *When* they leave the Organization Name input blank and click submit
    *   *Then* the form prevents submission and highlights the input box in red with validation text: *"Organization name is required"*

---

### 5.2. Job Description Generation & Selection Workflow

#### A. UI/UX Flow
1.  **Entry Point**: Recruiter navigates to `/recruiter/jobs` and clicks the "Create Job Description" button (`#btn-create-jd`).
2.  **Copilot Assistant Panel**: A split layout slides in. The recruiter inputs a basic title (e.g., "Senior Node.js Engineer") and clicks the "Suggest with Gemini" icon (`#btn-suggest-ai-jd`).
3.  **AI Progress Loader**: A glowing progress bar sweeps across the panel.
4.  **Markdown Compilation**: Once the AI returns suggestions, the description and requirements textarea fields are populated with typing simulation effects. Recruiter reviews, edits, and clicks "Publish JD".

#### B. Functionality
1.  **API Call**: Client hits `POST /api/jobs/suggest` passing parameters `{ title, department }`.
2.  **AI Orchestration**: Backend invokes `GeminiOrchestratorService.suggestJd()`.
    *   If keys are present, calls Gemini Flash.
    *   If keys are missing, triggers local mock fallback suggesting default requirements.
3.  **Database Write**: Clicking "Publish" makes a `POST /api/jobs` request, creating a `JobDescription` row in Prisma in a `"published"` status state.

#### C. Acceptance Criteria
*   **Scenario: Recruiter uses AI Copilot to draft and publish a Job Description**
    *   *Given* the recruiter has selected the Job Builder dashboard
    *   *When* they enter a title and trigger the AI suggestion action
    *   *Then* the copilot populates the specifications and requirements textareas
    *   *And* clicking publish registers a new `job_descriptions` database record in the published state
*   **Scenario: AI Engine fails during suggestions**
    *   *Given* the Gemini API triggers a rate limit or timeout exception
    *   *When* the recruiter initiates the suggest JD copilot action
    *   *Then* the UI hides the loading bar and displays an inline alert: *"AI Suggestion currently unavailable. Please write requirements manually."*
    *   *And* unblocks the input textareas for manual drafting.

---

### 5.3. Candidate Bulk Importing & Parsing Workflow

#### A. UI/UX Flow
1.  **Drop Zone Interaction**: Recruiter navigates to `/recruiter/candidates` and opens the "Import Candidates" drawer (`#drawer-candidates-import`). They drag and drop a folder or files containing multiple PDF resumes.
2.  **Upload Queue Progress**: The UI renders a list of items showing filename, file size, and upload progress badges.
3.  **Status Transitions**: When upload completes, the candidate status badge updates from `Uploading` ➔ `Parsing` ➔ `Parsed`. A success toast alerts the user.

#### B. Functionality
1.  **Multipart Upload**: React forms post files to `POST /api/candidates/:id/upload-resume` using Multer file buffers.
2.  **Storage Pipeline**: Files are written to the `resumes` Supabase storage bucket.
3.  **Asynchronous Parsing Task**: The pipeline enqueues the processing job onto `InMemoryQueue`. The worker:
    *   Extracts text content from the PDF.
    *   Invokes `aiOrchestrator.parseResume()`.
    *   Calculates candidate-JD match score for matching JDs.
    *   Updates the `candidates` status state and registers `jd_candidate_matches` records.

#### C. Acceptance Criteria
*   **Scenario: Successful Bulk Upload and Extraction**
    *   *Given* the recruiter drops three valid resume PDFs into the import drawer
    *   *When* the upload action completes
    *   *Then* the backend registers three candidate profiles in the database
    *   *And* executes the parsing worker asynchronously, updating their statuses to `resume_parsed`
*   **Scenario: Uploaded File Malformed or Unsupported Mime-Type**
    *   *Given* the recruiter drops an unsupported file type (e.g. `.png` or `.exe`)
    *   *When* the drag-and-drop validation fires
    *   *Then* the upload queue rejects the file and marks the item with a red error badge: *"Unsupported file format. Only PDF and Word docs allowed."*

---

### 5.4. Interview Template Configuration Workflow

#### A. UI/UX Flow
1.  **Aesthetics**: Recruiter navigates to `/recruiter/scheduling` and opens "Manage Templates".
2.  **Configuration Form**: The recruiter selects a published Job Description and pairs it with an active AI Persona (e.g., Ava, Logan). They customize:
    *   Grading Rubric criteria weight sliders (`#slider-weight-technical`, `#slider-weight-communication`).
    *   Proctoring Policy checklist checks (Enable screenshot capture, enable tab switch locks).
3.  **Feedback**: Clicking "Save Configuration" triggers a success checkmark animation.

#### B. Functionality
1.  **API Call**: Triggers a `POST /api/interviews/templates` call passing the configured rubric JSON and proctoring parameters.
2.  **Database Write**: Prisma registers an `InterviewTemplate` row with the JSON fields mapping evaluation settings and security criteria.

#### C. Acceptance Criteria
*   **Scenario: Successful template publication**
    *   *Given* the recruiter has configured weights and selected JDs/personas
    *   *When* they submit the template form
    *   *Then* the database records an `interview_templates` entry storing parameters
*   **Scenario: Sum of weights exceeds limits**
    *   *Given* the rubric weight sliders sum exceeds 1.0 (100%)
    *   *When* the recruiter tries to click save template
    *   *Then* the dashboard displays a warning banner: *"Total rubric weights must sum up to exactly 100%"* and blocks the API request.

---

### 5.5. Interview Scheduling & Invitation Dispatch Workflow

#### A. UI/UX Flow
1.  **Form Completion**: In `/recruiter/scheduling`, recruiter selects the target candidate, dates, durations, and templates, then clicks "Schedule Interview" (`#btn-submit-schedule`).
2.  **Email Preview Dialog**: A confirmation modal displays the generated invitation template, including a button preview showing the entry URL link. Recruiter confirms and clicks "Send invitation".

#### B. Functionality
1.  **Schedule Transaction**:
    *   Client posts metadata to `POST /api/interviews`.
    *   Database writes an `Interview` record in the `scheduled` status state.
    *   Calls `candidateWorkflow.transition(candidateId, "interview_scheduled")` and logs events.
2.  **Outbox Queue**:
    *   Writes record to `notification_outbox` table with `kind: "interview_invitation"`.
    *   Enqueues task to `InMemoryQueueService`.
    *   Worker sends email containing single-use JWT link via Resend.

#### C. Acceptance Criteria
*   **Scenario: Scheduling triggers invitation outbox**
    *   *Given* the recruiter completes calendar scheduling parameters
    *   *When* they confirm and send the invitation
    *   *Then* the system records an `interviews` entry in `scheduled` status
    *   *And* enqueues an invitation notification email to the candidate email address
*   **Scenario: Candidate Email Address Missing or Malformed**
    *   *Given* the candidate profile has an invalid email format (e.g., "jane-doe")
    *   *When* the scheduling scheduler initiates the dispatch transaction
    *   *Then* the controller throws a bad request exception
    *   *And* the page prompts: *"Cannot schedule: Candidate profile has a malformed email address."*

---

### 5.6. Candidate Pre-flight Device Verification Workflow

#### A. UI/UX Flow
1.  **Acceptance**: Candidate opens their email link, clicks "Accept Invitation", and lands on `/candidate/prepare`.
2.  **Rules Consent**: Candidate checks the proctoring authorization checks, clicks "Acknowledge", and transitions to `/candidate/system-check`.
3.  **Media Authorizations**: Browser prompts for camera/mic access. The screen shows a live video box and audio waveform monitor. The candidate tests audio and clicks "Enter Interview".

#### B. Functionality
1.  **Verification**: Route checks authorization claims using JWT parameters decoded in `SupabaseAuthGuard`.
2.  **System Validation**: Client-side JavaScript binds webcam and audio signals to confirm access.

#### C. Acceptance Criteria
*   **Scenario: Successful pre-flight check**
    *   *Given* the candidate consents to screen and camera monitoring policies
    *   *When* camera and microphone hardware are detected and authorized
    *   *Then* check status badges turn green
    *   *And* enables the "Enter Interview Room" transition button
*   **Scenario: Hardware Blocked by Candidate**
    *   *Given* the browser media requests are denied or blocked by the candidate
    *   *When* the system-check screen completes hardware inspection
    *   *Then* the Check badges remain red and show warnings: *"Camera permission is required"*
    *   *And* blocks navigation to the interview room.

---

### 5.7. Live Proctored Conversational Interview Session Workflow

#### A. UI/UX Flow
1.  **Opening Dialogue**: Candidate enters the room. The AI avatar starts in the `Thinking` state, shifts to `Speaking`, and asks the opening question.
2.  **Speech Response Loop**: Candidate speaks. Audio input level registers on the waveform canvas. They click "Submit Response".
3.  **Focus Warnings**: If the candidate opens another tab, the screen flashes red warnings: *"Cheating event logged."*

#### B. Functionality
1.  **WebSocket Gateway**: Client connects to `InterviewGateway` room using session IDs.
2.  **Real-Time Interactions**:
    *   Webcam captures canvas snapshots every 15s, saving them to `proctoring_snapshots` in Supabase Storage.
    *   Focus loss triggers client listeners and calls `POST /api/interviews/session/:sessionId/event` logging `tab_switch` records.
    *   Speech submissions call `getNextQuestion(sessionId)`, triggering Gemini prompts to compile next adaptive follow-ups based on turns history and schemas.

#### C. Acceptance Criteria
*   **Scenario: Session runs successfully with adaptive follow-ups**
    *   *Given* the candidate is in the live interview room
    *   *When* they submit answers to questions
    *   *Then* the WebSocket Gateway appends turns to database `interview_turns`
    *   *And* retrieves consecutive adaptive questions from the AI engine
*   **Scenario: Tab Switch cheating trigger**
    *   *Given* the candidate leaves the interview tab during active execution
    *   *When* the client visibility change event fires
    *   *Then* the backend logs a `tab_switch` event in the `interview_events` table
    *   *And* triggers a proctor warn alert to the active recruiter monitor

---

### 5.8. Live Recruiter Monitoring & Flagging Workflow

#### A. UI/UX Flow
1.  **Watch Room**: Recruiter enters `/recruiter/monitor` and views active grids of live interviews.
2.  **Visual Highlights**: Cards flash red if candidates switch tabs or lose screen focus. Real-time transcripts update as candidates respond.
3.  **Log Entries**: Recruiter clicks "Manual Flag" (`#btn-flag-event`), inputs comments in the modal textarea, and clicks save.

#### B. Functionality
1.  **WebSocket Subscriptions**: The recruiter's client subscribes to active session rooms on Socket.IO.
2.  **Manual Flag Entries**: Submitting comments calls `POST /api/interviews/session/:sessionId/flag`, inserting events in the database:
    *   Type set to `"manual_flag"`.
    *   Payload stores the comment and the recruiter's user ID.

#### C. Acceptance Criteria
*   **Scenario: Recruiter receives real-time warnings and flags an event**
    *   *Given* a candidate tab switch event is recorded in active session
    *   *When* the Socket.IO broadcast updates the recruiter dashboard
    *   *Then* the candidate card flashes red highlights and appends warnings to the logs feed
    *   *And* submitting manual comments writes an event entry to the database
*   **Scenario: WebSocket Connection Lost on Recruiter Monitor**
    *   *Given* a network interruption disconnects the recruiter socket client
    *   *When* connection status drops
    *   *Then* the page displays a gray banner stating: *"Live monitoring paused. Attempting to reconnect..."* and blocks flagging comments.

---

### 5.9. Asynchronous Post-Interview Evaluation Grading Workflow

#### A. UI/UX Flow
1.  **Submit Session**: Candidate finishes their final turn and clicks "Submit Interview".
2.  **Exit Portal**: The screen transitions to a thank-you exit page.
3.  **Status Sync**: On the recruiter dashboards, candidate's status transitions from `interview_running` ➔ `evaluation_processing` ➔ `recruiter_review`.

#### B. Functionality
1.  **Close Session**:
    *   Client posts request to `POST /api/interviews/session/end`.
    *   Prisma updates session ended times and interview status to `evaluation_pending`.
2.  **Grading Process**:
    *   Enqueues grading job to `InMemoryQueueService`.
    *   Background worker fetches transcript turns and proctoring event logs.
    *   Backend invokes `aiOrchestrator.evaluateInterview()`, calculating rubric scores and deducting points for tab switches.
    *   Saves final scores, recommendation verdicts, and generated reports to the `interview_reports` database.
    *   Transitions candidate status to `recruiter_review` and sends a report ready notification email.

#### C. Acceptance Criteria
*   **Scenario: Evaluation completes successfully with integrity deductions**
    *   *Given* an interview session has ended with 3 recorded tab switches
    *   *When* the grading worker processes evaluation algorithms
    *   *Then* the database records overall scores and recommendation verdicts in `interview_reports`
    *   *And* subtracts 30 points (3 * 10) from the candidate's integrity score
    *   *And* transitions the candidate status to `recruiter_review`
*   **Scenario: Background evaluation fails**
    *   *Given* the grading worker fails to parse AI transcript payloads
    *   *When* the evaluate task throws an error
    *   *Then* the system sets the interview's evaluation status to `failed`
    *   *And* retains candidate status in `evaluation_processing` for manual review/retry

---

### 5.10. Recruiter Review & Hiring Verdict Decision Workflow

#### A. UI/UX Flow
1.  **Review Dashboard**: Recruiter logs in, opens `/recruiter/reports`, and clicks on a candidate scorecard.
2.  **Insights Exploration**: Recruiter views matched skills highlights, inspects the AI summary markdown, reviews competency radar charts, and scrolls webcam proctor snapshots.
3.  **Verdict Selection**: Recruiter clicks "Set Decision" and selects a verdict (Hired, Rejected, or Archive). They enter notes and click confirm.

#### B. Functionality
1.  **Status Update**:
    *   Client posts payload to `PATCH /api/candidates/:id/status`.
    *   Prisma updates candidate status fields (e.g. `hiring_decision`, `archived`).
    *   Saves timeline changes and logs action details to the `audit_events` compliance table.

#### C. Acceptance Criteria
*   **Scenario: Recruiter submits hiring decision and archives profile**
    *   *Given* the recruiter is reviewing candidate scorecards
    *   *When* they set the verdict to Hired
    *   *Then* the database candidate status field updates to `hiring_decision`
    *   *And* writes compliance log records to the `audit_events` table
*   **Scenario: Submitting decision without active permissions**
    *   *Given* the user is signed in with a candidate role
    *   *When* they post updates to candidate status endpoints
    *   *Then* the `RolesGuard` blocks the transaction and returns a 403 Forbidden exception.

---

### 5.11. Platform Settings & Prompt Customization Admin Workflow

#### A. UI/UX Flow
1.  **Admin Panel**: Admin user enters `/admin/settings` and selects "Manage AI Prompts".
2.  **Prompt Editor**: The page loads textareas displaying instructions for each AI agent (Resume parser, JD Matcher, Evaluation Grader).
3.  **Save Changes**: The admin modifies the instructions text and clicks "Update Prompt Template". A success banner displays.

#### B. Functionality
1.  **Database Updates**:
    *   Client posts content to `PATCH /api/admin/prompts`.
    *   Prisma updates the prompt instruction string in the `PromptLibrary` database.
2.  **Cache Reload**: AI agents retrieve the new prompt strings during next session executions.

#### C. Acceptance Criteria
*   **Scenario: Admin updates parser prompt**
    *   *Given* the admin is on the Prompt Settings panel
    *   *When* they save changes to the resume parser system prompt
    *   *Then* the database update is successfully written to the `PromptLibrary` table
    *   *And* the parser uses the new instructions on subsequent resume uploads
*   **Scenario: Empty prompt content saved**
    *   *Given* the admin clears the instructions field and clicks update
    *   *When* the form validation runs
    *   *Then* the editor blocks the API request and outputs a warning: *"Instructions template cannot be empty"*
