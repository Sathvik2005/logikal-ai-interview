# Lokality AI — Integration Guide

This guide details how to connect the Lokality AI platform to external systems, including Applicant Tracking Systems (ATS), transactional communication tools, and meeting calendar providers.

---

## 1. ATS INTEGRATION PATTERNS (WEBHOOKS & API KEYS)

Lokality can function alongside or directly integrate with corporate Applicant Tracking Systems (e.g. Greenhouse, Lever, Workday).

### 1.1. Inbound Sync (Importing Candidates)
External ATS systems can automatically push candidates to Lokality when they reach specific pipeline stages (e.g. "Screening").
*   **Endpoint**: `POST /api/candidates`
*   **Payload Schema**:
    ```json
    {
      "name": "Jane Doe",
      "email": "jane.doe@example.com",
      "phone": "+1-555-0199",
      "roleApplied": "Senior DevOps Engineer"
    }
    ```
*   **Authentication**: Requests must carry a tenant API key inside the headers: `x-api-key: your-organization-api-key`.

### 1.2. Outbound Sync (Forwarding Scorecards)
Upon completion of post-interview AI evaluations, Lokality dispatches webhook notifications to the configured ATS callback endpoint.
*   **Webhook Payload**:
    ```json
    {
      "event": "evaluation.completed",
      "candidateId": "cand-uuid-1234",
      "interviewId": "iv-uuid-5678",
      "overallScore": 88,
      "integrityScore": 95,
      "recommendation": "strong_hire",
      "reportUrl": "https://recruitment.lokality.ai/recruiter/reports/iv-uuid-5678"
    }
    ```

---

## 2. EMAIL INTEGRATIONS (RESEND)

Lokality utilizes Resend to dispatch transactional emails (e.g. candidate invitation entry links, scheduling notifications, report updates).

### 2.1. Domain Configuration
To prevent emails from landing in spam folders:
1.  Add your custom domain in the [Resend Dashboard](https://resend.com/domains).
2.  Configure the generated DNS records (SPF, DKIM, DMARC) on your hosting registrar (e.g. Cloudflare, Route 53).
3.  Set process environment keys inside `.env`:
    `RESEND_API_KEY="re_yourApiKey"`

### 2.2. Customizing Templates
Email templates are defined inside [notification.service.ts](file:///e:/logikaiinterview/backend/src/application/services/notification.service.ts#L92-L134). You can modify HTML layout parameters to update corporate typography, color palettes, and header assets.

---

## 3. CALENDAR & MEETING SYSTEM SPECIFICATIONS

While the candidate video/audio stream runs natively inside the proctored Lokality workspace, recruiters can sync meeting markers to Microsoft Teams and Google Calendar.

*   **OAuth Credentials**: Define Client IDs and Client Secrets inside your `.env` parameters.
*   **Meeting Provider Options**:
    *   **teams**: Writes scheduled events with Microsoft Graph API, generating invitations inside Outlook calendars.
    *   **google**: Connects to Google Calendar API, generating meeting blocks and Meet video link markers.
    *   **zoom**: Creates meeting rooms via Zoom OAuth token sets.
