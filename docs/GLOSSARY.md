# Lokality AI — Platform Glossary of Terms

This document provides a single source of truth for all abbreviations, product concepts, entity structures, and terminology used across the Lokality AI Recruitment Intelligence Platform.

---

## 1. TECHNICAL ABBREVIATIONS & TECHNOLOGY STACK

*   **ATS (Applicant Tracking System)**: A software application that enables the electronic handling of recruitment needs (sourcing, filtering, screening). Lokality AI operates as a specialized AI screening agent integrated with or functioning alongside an ATS.
*   **WebRTC (Web Real-Time Communication)**: A free, open-source project providing web browsers and mobile applications with real-time communication via simple application programming interfaces (APIs). Used by Lokality to capture and stream camera and microphone feeds.
*   **JWT (JSON Web Token)**: An open standard (RFC 7519) that defines a compact and self-contained way for securely transmitting information between parties as a JSON object. Lokality decodes Supabase-issued JWTs to map recruiter or candidate roles.
*   **REST (Representational State Transfer)**: An architectural style for providing standards between computer systems on the web, making it easier for systems to communicate with one another.
*   **WS (WebSockets)**: A computer communications protocol, providing full-duplex communication channels over a single TCP connection. Used by Lokality to coordinate transcripts and webcam snapshots between candidate sessions and recruiter monitoring dashboards.
*   **ORM (Object-Relational Mapping)**: A programming technique for converting data between incompatible type systems in databases and object-oriented programming languages. Prisma serves as Lokality's ORM.
*   **HSL (Hue, Saturation, Lightness)**: A color representation model. Used in Lokality to map canvas animation styles (mic input volume levels and breathing visual rings for AI speaker states).
*   **PIP (Picture-in-Picture)**: A feature where a secondary video is displayed in a small floating window overlaying the main screen. Used for the candidate's camera preview in the interview room.

---

## 2. DOMAIN & BUSINESS CONCEPT DEFINITIONS

*   **Organization**: The top-level tenant container representing a hiring company or agency. All data (candidates, jobs, interviews, templates) is strictly isolated within the boundaries of an Organization.
*   **Profile**: A user account containing email, name, and title, linked to an organization record.
*   **Candidate**: An applicant registered for a screening lifecycle. A candidate flows through specific states (`applied`, `parsed`, `matched`, `shortlisted`, `interview_assigned`, `interview_scheduled`, `invitation_sent`, `interview_started`, `interview_running`, `evaluation_processing`, `recruiter_review`, `hiring_decision`, `archived`).
*   **Job Description (JD)**: The published job details containing criteria and competencies, linked to target personas.
*   **AI Persona**: The virtual interviewer agent character (e.g. Ava, Aria). Contains specific tone configurations, difficulty parameters, and system prompts defining the interviewer's behavior.
*   **Interview Template**: A reusable schema defining the rubric criteria, proctoring policies, email layouts, and scoring weights for a JD.
*   **Interview Session**: A single interactive interview attempt by a candidate. Contains logs, events, webcam snapshots, and voice turns.
*   **Interview Turn**: A single dialog line in the transcript, mapping the speaker (candidate, persona, or system), the text content, audio storage references, and scoring metrics.
*   **Proctoring Snapshot**: Canvas screenshots captured every 15 seconds from the candidate webcam and saved to storage.
*   **Interview Event**: A system log entry capturing user focus states, browser visibility indicators (`tab_switch`, `focus_loss`, `devtools_open`), and face recognition alerts.
*   **Interview Report**: The final AI-generated scorecard document detailing matched competencies, weaknesses, executive markdown summaries, integrity scores, and hire recommendations.
*   **Notification Outbox**: A database log table recording transactional emails queued for Resend delivery.
*   **Audit Event**: A security compliance log tracking administrator changes, role reassignments, and reports downloads.

---

## 3. STATE DEFINITION MATRIX

### Candidate States
1.  **applied**: Candidate profile registered. Resume file not uploaded.
2.  **resume_imported**: Resume document uploaded, awaiting parser processing.
3.  **resume_parsed**: Text content extracted by Gemini and parsed into structured database fields.
4.  **jd_matched**: Compatibility comparison between candidate skills and JD requirements completed.
5.  **shortlisted**: Marked by recruiter as eligible for screening invitation.
6.  **interview_assigned**: Assigned a specific interview template configuration.
7.  **interview_scheduled**: Date, duration, and time slot set.
8.  **invitation_sent**: Invitation email with Entry Link sent via Resend.
9.  **interview_started**: Candidate joined the session workspace and passed device checks.
10. **interview_running**: Candidate is actively speaking with the AI Persona.
11. **evaluation_processing**: Interview closed, post-interview AI grading running.
12. **recruiter_review**: Report generated, awaiting recruiter verdict.
13. **hiring_decision**: Recruiter saved hire/no-hire verdict.
14. **archived**: Removed from active queues.

### Interview States
1.  **scheduled**: Scheduled and awaiting candidate entry.
2.  **in_progress**: Candidate joined, WebSocket connection active.
3.  **evaluation_pending**: Interview closed, awaiting background worker evaluation.
4.  **completed**: Evaluation completed, report scorecard populated.
5.  **failed**: Session crashed or evaluation worker threw an exception.
