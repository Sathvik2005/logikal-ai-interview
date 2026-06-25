# Lokality AI — Compliance & Security Guide

This document outlines the security controls, data isolation schemas, RBAC constraints, GDPR policies, and audit trails implemented on the Lokality AI Recruitment Intelligence Platform.

---

## 1. MULTI-TENANCY & ROW-LEVEL DATA ISOLATION

Lokality AI is designed as a secure multi-tenant SaaS application. Data isolation is strictly enforced across the following layers:

1.  **Database Level Scoping**: Every record representing a business entity (Candidate, Interview, JobDescription, Template, Session, Report) contains a mandatory `org_id` UUID field.
2.  **API Filtering**: Controllers extract the verified `orgId` from the caller's JWT payload and inject it directly into the where-clause of all database queries:
    ```typescript
    const orgId = req.user.orgId;
    const candidates = await this.prisma.candidate.findMany({
      where: { org_id: orgId, deleted_at: null }
    });
    ```
3.  **Cross-Tenant Verification**: If an endpoint accesses a record directly using a specific ID (e.g. `/api/candidates/:id`), the backend validates that the target record's `org_id` matches the caller's JWT `orgId` before returning data or processing state changes.

---

## 2. TOKEN AUTHENTICATION & ACCESS GUARDS

Lokality relies on Supabase Auth (GoTrue API) to manage identity verification and issue JWT tokens.

*   **Header Authorization**: Clients must provide a valid authorization header with each request: `Authorization: Bearer <jwt>`.
*   **Token Verification Guard (`SupabaseAuthGuard`)**:
    *   Extracts the token from the header.
    *   If `JWT_SECRET` is configured, verifies the token's cryptographic signature against the secret.
    *   Enriches the request payload scope with the decoded user claims:
        *   `userId` (maps to `decoded.sub`)
        *   `email` (maps to `decoded.email`)
        *   `role` (extracted from `decoded.user_metadata.role` - defaults to `"candidate"`)
        *   `orgId` (extracted from `decoded.user_metadata.orgId`)
*   **Role-Based Access Control (`RolesGuard`)**:
    *   Restricts routes using the `@Roles()` decorator.
    *   Endpoints are checked against the candidate, recruiter, or admin role specifications.

---

## 3. DATA PRIVACY & GDPR COMPLIANCE

### 3.1. Webcam Snapshot Privacy
*   **Storage Access Scoping**: Webcam snapshots captured during proctoring sessions are uploaded to private buckets (`recordings` or `snapshots`) inside Supabase Storage.
*   **Access Control**: SNAP URLs are temporary, generated programmatically using Supabase client private credentials, and expire after 15 minutes. No public access link is ever exposed.

### 3.2. Candidate "Right to be Forgotten" (GDPR Deletion)
Candidates can request profile and data purges. When a purge is initiated by an authorized administrator:
1.  **File Cleanup**: The backend deletes all resume files and webcam snapshots associated with the candidate's ID from storage buckets.
2.  **Soft / Hard Deletion**:
    *   Prisma transactions update the candidate row setting `deleted_at = now()`.
    *   Cascade triggers purge related matches, transcripts, turns, events, and reports from the database.

---

## 4. COMPLIANCE AUDIT LOGS

All crucial administrative actions, status updates, and reports downloads are logged to the `audit_events` compliance ledger.

### Audit Event Schema
Each audit log entry captures:
*   `id`: UUID key.
*   `org_id`: Tenant context indicator.
*   `actor_id`: User UID executing the operation.
*   `action`: String code (e.g. `CANDIDATE_DELETE`, `REPORT_DOWNLOAD`, `ROLE_UPDATE`).
*   `entity_type` & `entity_id`: Target of the action.
*   `payload`: JSON diff mapping changed fields.
*   `created_at`: Timestamp.

Compliance audit logs cannot be edited or deleted through normal recruiter API endpoints.
