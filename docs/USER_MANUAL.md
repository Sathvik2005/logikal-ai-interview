# Lokality AI — Platform User Manual

This manual provides detailed guidelines and instructions for recruiters and candidates using the Lokality AI Recruitment Intelligence Platform.

---

## 1. RECRUITER OPERATION MANUAL

### 1.1. Organization Workspace Setup
1.  **Creation**: Navigate to `/auth?mode=signup` to register. Upon signup, complete the Setup Form indicating your company name, industry, and sizing metrics.
2.  **Access**: Dashboard access is restricted until the profile details form is submitted. Your organization is automatically assigned a unique UUID to isolate all candidate data.

### 1.2. Building Job Descriptions with AI Copilot
1.  Navigate to the **Job Builder** panel (`/recruiter/jobs`).
2.  Click **Create Job Description** (`#btn-create-jd`).
3.  In the AI Suggestion Copilot input:
    *   Enter the target Job Title (e.g. "Senior Frontend Architect").
    *   Click **Suggest with Gemini** (`#btn-suggest-ai-jd`).
4.  The system suggests candidate qualifications, core requirements, and technical competencies.
5.  Edit these values inside the form fields and click **Publish**.

### 1.3. Importing Candidates in Bulk
1.  Open the **Candidate Directory** dashboard (`/recruiter/candidates`).
2.  Open the **Import Candidates** drawer panel on the right.
3.  Drag and drop your candidate resume PDFs into the drop area (`#dropzone-resume-upload`).
4.  The system:
    *   Uploads files to Supabase Storage.
    *   Triggers background parsing.
    *   Computes matching compatibility scores against active JDs.
5.  Extracted candidates appear in your table view with their parsed attributes (experience, skills, email).

### 1.4. Template & Persona Configuration
1.  Navigate to **AI Personas** page (`/recruiter/personas`) to create or inspect interviewer avatars (e.g. *Ava*, *Aria*, *Logan*).
2.  Input specific prompt guidelines controlling the interviewer's behavior (e.g. *Ask concise technical coding questions, keep comments polite, probe on backend answers*).
3.  Navigate to the **Scheduler** and link the Job Description to the custom AI Persona. Configure weighting parameters (Sliders) for skills, communication, and problem-solving rubrics.

### 1.5. Live Interview Monitoring Room
1.  During scheduled interview blocks, recruiters can inspect live feeds via `/recruiter/monitor`.
2.  The **Live Grid** displays active candidate session blocks. Red flash highlights indicate cheating alerts:
    *   **Tab Switch Warning**: Candidate left the interview window.
    *   **DevTools Alert**: Candidate opened console inspectors.
    *   **Focus Loss Warning**: Candidate clicked outside browser window bounds.
3.  Use the **Manual Flag** controls (`#btn-flag-event`) to append comments to the interview timeline database.

### 1.6. Evaluation & Scoring Reports
1.  Once candidate sessions end, status transitions to `recruiter_review`.
2.  Open `/recruiter/reports` and select a candidate card to view the **Scorecard**:
    *   Inspect **AI overall recommendations** (hire, strong_hire, no_hire, strong_no_hire).
    *   View **Competencies Radar Charts** mapping strengths.
    *   Check **Integrity Timeline Logs** displaying tab switch events and webcam snapshots.
    *   Click **Export PDF** (`#btn-export-pdf`) to compile a report for hiring decisions.

---

## 2. CANDIDATE WORKSPACE MANUAL

### 2.1. Invitation Acceptance
1.  Locate the invitation email sent by the platform.
2.  Click the **Enter Interview Room** action button. This redirects you to the acceptance portal.
3.  Validate your name and email parameters, and tick the proctoring consent agreements.

### 2.2. Pre-Flight Device Checks
1.  Grant the browser permissions to access your webcam and microphone when prompted.
2.  View your video stream in the box to ensure your face is fully visible and centered.
3.  Speak aloud. Verify that the voice levels register as active lines on the canvas waveform.
4.  Ensure no background audio apps or dev inspectors are open, and click **Enter Interview**.

### 2.3. Live Room Guidelines
1.  **AI Voice Conversation**: The AI Persona avatar breathes to indicate speaker status:
    *   *Breathing Orange*: AI is thinking / generating response.
    *   *Breathing Indigo*: AI is speaking / asking a question.
    *   *Breathing Green*: AI is listening / awaiting your audio response.
2.  **Speaking**: Click the microphone icon to begin speaking, and click submit when finished. Subtitles stream text character-by-character.
3.  **Proctor Rules**:
    *   Keep your face visible and centered.
    *   **Do not change browser tabs**. Tab switches log integrity warnings automatically.
    *   **Do not resize or minimize the browser window**.
4.  **Submission**: Click **Submit Interview** at the end of final turns. You can then exit the portal.
