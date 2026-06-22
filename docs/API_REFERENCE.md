# Lokality AI — API Reference

> **Base URL:** `http://localhost:3000/api`  
> **Swagger Docs:** `http://localhost:3000/api/docs`  
> **Authentication:** All endpoints require `Authorization: Bearer <jwt>` unless noted.

---

## Table of Contents

1. [Candidates API](#candidates-api)
2. [Jobs API](#jobs-api)
3. [Personas API](#personas-api)
4. [Interviews API](#interviews-api)
5. [Questions API](#questions-api)
6. [Reports API](#reports-api)
7. [Analytics API](#analytics-api)
8. [Proctoring API](#proctoring-api)
9. [Admin API](#admin-api)

---

## Candidates API

**Controller:** `CandidatesController`  
**Base Path:** `/api/candidates`

### Endpoints

| Method | Path | Description | Auth | Role |
|--------|------|-------------|------|------|
| `GET` | `/api/candidates` | List all candidates (org-scoped) | ✅ | recruiter, admin |
| `GET` | `/api/candidates/:id` | Get candidate by ID | ✅ | recruiter, admin |
| `POST` | `/api/candidates` | Create new candidate | ✅ | recruiter, admin |
| `PATCH` | `/api/candidates/:id` | Update candidate record | ✅ | recruiter, admin |
| `DELETE` | `/api/candidates/:id` | Soft-delete candidate | ✅ | recruiter, admin |
| `POST` | `/api/candidates/bulk-import` | Bulk import candidates (CSV/resume files) | ✅ | recruiter, admin |
| `POST` | `/api/candidates/:id/parse-resume` | Trigger AI resume parsing | ✅ | recruiter, admin |
| `GET` | `/api/candidates/:id/timeline` | Get candidate lifecycle timeline | ✅ | recruiter, admin |

### Request/Response Examples

#### Create Candidate
```json
POST /api/candidates
Content-Type: application/json

{
  "full_name": "Jane Smith",
  "email": "jane.smith@example.com",
  "phone": "+1-555-0142",
  "role_applied": "Senior Frontend Engineer",
  "skills": ["React", "TypeScript", "Node.js"]
}
```

#### Response
```json
{
  "id": "550e8400-e29b-41d4-a716-446655440000",
  "full_name": "Jane Smith",
  "email": "jane.smith@example.com",
  "status": "applied",
  "created_at": "2026-06-22T13:00:00Z"
}
```

---

## Jobs API

**Controller:** `JobsController`  
**Base Path:** `/api/jobs`

### Endpoints

| Method | Path | Description | Auth | Role |
|--------|------|-------------|------|------|
| `GET` | `/api/jobs` | List all job descriptions (org-scoped) | ✅ | recruiter, admin |
| `GET` | `/api/jobs/:id` | Get job description by ID | ✅ | recruiter, admin |
| `POST` | `/api/jobs` | Create new job description | ✅ | recruiter, admin |
| `POST` | `/api/jobs/suggest` | AI-generate JD content from title | ✅ | recruiter, admin |

### AI Suggest Job Description
```json
POST /api/jobs/suggest
Content-Type: application/json

{
  "title": "Machine Learning Engineer",
  "department": "AI Research"
}
```

#### Response
```json
{
  "description": "We are seeking an experienced Machine Learning Engineer...",
  "requirements": "- 5+ years experience in ML/DL\n- Expert in PyTorch/TensorFlow..."
}
```

---

## Personas API

**Controller:** `PersonasController`  
**Base Path:** `/api/personas`

### Endpoints

| Method | Path | Description | Auth | Role |
|--------|------|-------------|------|------|
| `GET` | `/api/personas` | List all AI personas (org-scoped) | ✅ | recruiter, admin |
| `GET` | `/api/personas/:id` | Get persona by ID | ✅ | recruiter, admin |
| `POST` | `/api/personas` | Create new AI persona | ✅ | recruiter, admin |

### Create Persona
```json
POST /api/personas
Content-Type: application/json

{
  "name": "Technical Ava",
  "persona_type": "technical",
  "tone": "professional",
  "difficulty": "senior",
  "prompt": "You are Ava, a senior technical interviewer specializing in system design..."
}
```

---

## Interviews API

**Controller:** `InterviewsController`  
**Base Path:** `/api/interviews`

### Scheduling & Management

| Method | Path | Description | Auth | Role |
|--------|------|-------------|------|------|
| `GET` | `/api/interviews` | List all interviews (org-scoped) | ✅ | recruiter, admin |
| `POST` | `/api/interviews` | Schedule a new interview | ✅ | recruiter, admin |
| `GET` | `/api/interviews/:id` | Get interview details | ✅ | recruiter, admin, candidate |
| `PATCH` | `/api/interviews/:id/reschedule` | Reschedule interview | ✅ | recruiter, admin |
| `PATCH` | `/api/interviews/:id/cancel` | Cancel interview | ✅ | recruiter, admin |

### Live Interview Session

| Method | Path | Description | Auth | Role |
|--------|------|-------------|------|------|
| `POST` | `/api/interviews/session/start` | Start interview session | ✅ | candidate |
| `POST` | `/api/interviews/session/end` | End interview session | ✅ | candidate |
| `GET` | `/api/interviews/session/:sessionId/turns` | Get session transcript | ✅ | recruiter, candidate |
| `POST` | `/api/interviews/session/:sessionId/turn` | Append conversation turn | ✅ | candidate |
| `POST` | `/api/interviews/session/:sessionId/next-question` | Generate next AI question | ✅ | candidate |
| `POST` | `/api/interviews/session/:sessionId/event` | Record proctoring event | ✅ | candidate |
| `POST` | `/api/interviews/session/:sessionId/flag` | Flag integrity violation | ✅ | recruiter |

### Monitoring

| Method | Path | Description | Auth | Role |
|--------|------|-------------|------|------|
| `GET` | `/api/interviews/live` | Get currently active interviews | ✅ | recruiter, admin |
| `GET` | `/api/interviews/recorded` | Get completed interview history | ✅ | recruiter, admin |
| `GET` | `/api/interviews/monitor/:interviewId` | Get detailed monitoring data | ✅ | recruiter, admin |

### AI Evaluation

| Method | Path | Description | Auth | Role |
|--------|------|-------------|------|------|
| `POST` | `/api/interviews/:id/finalize-evaluation` | Trigger AI evaluation | ✅ | recruiter, admin |
| `GET` | `/api/interviews/:id/evaluation` | Get evaluation result | ✅ | recruiter, admin |

### Schedule Interview
```json
POST /api/interviews
Content-Type: application/json

{
  "candidate_id": "550e8400-e29b-41d4-a716-446655440000",
  "job_id": "660e8400-e29b-41d4-a716-446655440001",
  "persona_id": "770e8400-e29b-41d4-a716-446655440002",
  "scheduled_at": "2026-06-25T10:00:00Z",
  "duration_minutes": 45
}
```

---

## Questions API

**Controller:** `QuestionsController`  
**Base Path:** `/api/questions`

### Endpoints

| Method | Path | Description | Auth | Role |
|--------|------|-------------|------|------|
| `GET` | `/api/questions` | List question bank (org-scoped) | ✅ | recruiter, admin |
| `GET` | `/api/questions/:id` | Get question by ID | ✅ | recruiter, admin |
| `POST` | `/api/questions` | Create new question | ✅ | recruiter, admin |
| `POST` | `/api/questions/bulk` | Bulk create questions | ✅ | recruiter, admin |
| `DELETE` | `/api/questions/:id` | Delete question | ✅ | recruiter, admin |

---

## Reports API

**Controller:** `ReportsController`  
**Base Path:** `/api/reports`

### Endpoints

| Method | Path | Description | Auth | Role |
|--------|------|-------------|------|------|
| `GET` | `/api/reports` | List all reports (org-scoped) | ✅ | recruiter, admin |
| `GET` | `/api/reports/:interviewId` | Get report by interview ID | ✅ | recruiter, admin |
| `GET` | `/api/reports/compare/list` | Get comparison data for multiple candidates | ✅ | recruiter, admin |

### Report Response Structure
```json
{
  "id": "880e8400-e29b-41d4-a716-446655440003",
  "interview_id": "550e8400-e29b-41d4-a716-446655440000",
  "executive_summary": "## Candidate Assessment Report...",
  "scores": {
    "Technical Skills": 85,
    "Communication": 80,
    "Problem Solving": 82
  },
  "strengths": ["Strong modular design principles", "Clear communication"],
  "weaknesses": ["Hesitation on async patterns"],
  "integrity_score": 95,
  "recommendation": "hire"
}
```

---

## Analytics API

**Controller:** `AnalyticsController`  
**Base Path:** `/api/analytics`

### Endpoints

| Method | Path | Description | Auth | Role |
|--------|------|-------------|------|------|
| `GET` | `/api/analytics/recruiter-funnel` | Recruitment funnel metrics | ✅ | recruiter, admin |
| `GET` | `/api/analytics/time-to-hire` | Time-to-hire analytics | ✅ | recruiter, admin |
| `GET` | `/api/analytics/integrity` | Integrity/proctoring analytics | ✅ | recruiter, admin |
| `GET` | `/api/analytics/recruiter-dashboard` | Aggregated dashboard data | ✅ | recruiter, admin |

---

## Proctoring API

**Controller:** `ProctoringController`  
**Base Path:** `/api/proctoring`

### Endpoints

| Method | Path | Description | Auth | Role |
|--------|------|-------------|------|------|
| `POST` | `/api/proctoring/identity` | Submit identity verification (selfie + ID doc) | ✅ | candidate |
| `POST` | `/api/proctoring/snapshot` | Upload periodic screenshot | ✅ | candidate |
| `POST` | `/api/proctoring/generate-report` | Generate proctoring integrity report | ✅ | recruiter, admin |
| `GET` | `/api/proctoring/report-bundle/:interviewId` | Get full proctoring bundle | ✅ | recruiter, admin |

---

## Admin API

**Controller:** `AdminController`  
**Base Path:** `/api/admin`

### Endpoints

| Method | Path | Description | Auth | Role |
|--------|------|-------------|------|------|
| `GET` | `/api/admin/organizations` | List all organizations | ✅ | admin |
| `GET` | `/api/admin/organizations/:id` | Get organization details | ✅ | admin |
| `PATCH` | `/api/admin/organizations/:id` | Update organization | ✅ | admin |
| `GET` | `/api/admin/dashboard` | Admin dashboard metrics | ✅ | admin |
| `GET` | `/api/admin/audit-events` | Compliance audit log | ✅ | admin |
| `GET` | `/api/admin/errors` | Platform error events | ✅ | admin |
| `POST` | `/api/admin/gdpr/export` | GDPR data export request | ✅ | admin |
| `POST` | `/api/admin/gdpr/delete` | GDPR data deletion request | ✅ | admin |

---

## Error Response Format

All API errors follow a consistent structure:

```json
{
  "statusCode": 401,
  "message": "Authorization failed: jwt expired",
  "error": "Unauthorized"
}
```

### Common HTTP Status Codes

| Code | Meaning |
|------|---------|
| `200` | Success |
| `201` | Created |
| `400` | Bad Request (validation errors) |
| `401` | Unauthorized (missing/invalid JWT) |
| `403` | Forbidden (insufficient role) |
| `404` | Not Found |
| `500` | Internal Server Error |

---

## WebSocket API

**Namespace:** `/interview`  
**Transport:** Socket.IO

### Connection
```javascript
const socket = io('http://localhost:3000/interview', {
  transports: ['websocket'],
  auth: { token: 'Bearer <jwt>' }
});
```

### Events Reference

| Direction | Event | Payload |
|-----------|-------|---------|
| Client → Server | `join-session` | `{ sessionId: string, role: 'candidate' \| 'recruiter' }` |
| Client → Server | `candidate-speech` | `{ sessionId: string, text: string }` |
| Client → Server | `proctor-alert` | `{ sessionId: string, type: string, payload?: any }` |
| Client → Server | `waveform-data` | `{ sessionId: string, values: number[] }` |
| Server → Client | `joined` | `{ status: 'success', room: string }` |
| Server → Client | `turn-appended` | `{ id: string, speaker: string, text: string, startedAt: Date }` |
| Server → Client | `status-update` | `{ status: 'thinking' \| 'speaking' \| 'idle' }` |
| Server → Client | `proctor-warning` | `{ type: string, payload: any, timestamp: string }` |
| Server → Client | `live-waveform` | `{ values: number[] }` |
