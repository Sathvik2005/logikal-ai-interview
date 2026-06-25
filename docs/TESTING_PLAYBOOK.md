# Lokality AI — Testing Playbook

This document details how to verify platform functionality using unit tests, API simulations, and proctoring event testing.

---

## 1. AUTOMATED UNIT TESTING

The backend features unit tests covering the domain lifecycle entities, application workflows, infrastructure queue runners, and API routing controllers.

### 1.1. Execution Command
Due to memory allocations during parallel Jest worker processes on some development environments, run the tests sequentially:
```bash
cd backend
npm run test -- --runInBand
```

### 1.2. Verification of Test Coverage
To generate a comprehensive test coverage report:
```bash
npm run test:cov
```
The output is saved inside `/coverage/index.html` detailing line and branch coverage rates.

### 1.3. Test Suite Specification Reference
For a granular, class-by-class breakdown of the 12 spec files, including their mock designs, scenario mappings, and event dispatch parameters, refer to the [TEST_SUITE_SPECIFICATION.md](file:///e:/logikaiinterview/docs/TEST_SUITE_SPECIFICATION.md).


---

## 2. MANUAL VERIFICATION & SIMULATION

### 2.1. Testing Heuristic AI Fallback Mode
You can test the full interview execution lifecycle without entering real Gemini API keys:
1.  Set `GEMINI_API_KEY="your-gemini-api-key-here"` (or keep it empty) in `backend/.env`.
2.  Start the NestJS backend: `npm run start:dev`.
3.  Upload a resume. The console should log: `[AI Mock] Parsing resume text mock fallback`.
4.  The system parses mock attributes and match compatibility values automatically.

### 2.2. Testing Proctoring & WebSocket Events
To test the real-time proctor alert system:
1.  Boot the application and start an interview session.
2.  Open the developer console in the candidate browser and change focus tabs.
3.  Ensure the client-side fires a `proctor-alert` WebSocket event payload.
4.  Open the candidate timeline page on the recruiter workspace (`/recruiter/candidates`) and verify that the `integrity_violation` log is appended with a timestamp.

### 2.3. Evaluating End-to-End Sessions
Verify grading score logic by closing the interview:
1.  Complete the conversation session in the live room.
2.  Click **Submit Interview**.
3.  Check the database timeline or query the `/api/interviews/:id/evaluation` endpoint.
4.  Confirm the background evaluation handler graded transcript entries and compiled rubric points.
