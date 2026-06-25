# Lokality AI — Platform Administration & Operations Guide

This guide details the operational procedures, environment configurations, Supabase cloud integrations, and troubleshooting steps required to administer the Lokality AI platform.

---

## 1. DETAILED ENVIRONMENT VARIABLES CONFIGURATION

The platform reads process configurations from environment files. Ensure the values are set in both the root [.env](file:///e:/logikaiinterview/.env) and [backend/.env](file:///e:/logikaiinterview/backend/.env):

| Variable | Required | Default | Description |
| :--- | :--- | :--- | :--- |
| `DATABASE_URL` | Yes | - | PostgreSQL connection URI string containing host, port, DB name, and credentials. |
| `JWT_SECRET` | Yes | - | Supabase private JWT Secret key used to verify Bearer signature claims. |
| `GEMINI_API_KEY` | Yes | - | Google Generative AI Developer key for Gemini Flash & Pro services. |
| `RESEND_API_KEY` | Yes | - | Resend Mail API authorization key for transactional emails. |
| `PORT` | No | `3000` | Port for the backend NestJS application. |
| `FRONTEND_URL` | No | `http://localhost:5173` | Target domain routing parameters for CORS clearance. |
| `APP_URL` | No | `http://localhost:5173` | Base link path prepended to candidate invitation entry emails. |
| `NODE_ENV` | No | `development` | Runtime environment toggle (`development`, `production`, `test`). |

---

## 2. SUPABASE INITIAL SETUP & PROVISIONING

To link a new Supabase project instance:

### 2.1. JWT Secret Configuration
1.  Navigate to **Supabase Dashboard** ➔ **Settings** ➔ **API**.
2.  Copy the **JWT Secret** string.
3.  Paste this value as `JWT_SECRET` in your environment keys to authorize access guards.

### 2.2. Storage Buckets Setup
The platform requires two storage buckets to exist:
1.  **resumes**: Stores uploaded candidate resume PDF/Word files.
2.  **recordings** (or **snapshots**): Stores proctoring webcam screenshots.
*Note: Buckets must be set to Private. Policies must allow reading/writing records only to authenticated profiles within the same organization.*

---

## 3. DATABASE MIGRATIONS & SEEDING

Prisma manages schema deployments and database seeding.

### 3.1. Generating Prisma Client
To compile the type-safe Prisma client matching the Supabase schema:
```bash
cd backend
npx prisma generate
```

### 3.2. Deploying Migrations
To push schema changes to the live PostgreSQL instance:
```bash
npx prisma db push
# or to apply migrations chronologically:
npx prisma migrate deploy
```

### 3.3. Seeding Default Prompts
Upon startup, the `PromptLibraryService` automatically checks if default templates are present in the `PromptLibrary` table. If not, it seeds the default templates (system instructions for the resume parser, JD match model, and grading rubric).

---

## 4. TENANT MANAGEMENT & AUDIT TRACKING

### 4.1. Creating a Tenant Organization
Organization creation is handled through onboarding portals. In production environments, administrators can register tenants directly:
```sql
INSERT INTO organizations (name, status) 
VALUES ('Enterprise Client Acme', 'active');
```

### 4.2. Suspending an Organization
To freeze a tenant's operations (blocking recruiter sign-ins and candidate rooms):
```sql
UPDATE organizations 
SET status = 'suspended' 
WHERE id = 'organization-uuid-here';
```

### 4.3. Reading Audit Logs
To review compliance changes and database updates, inspect the `audit_events` table:
```sql
SELECT actor_id, action, entity_type, payload, created_at 
FROM audit_events 
ORDER BY created_at DESC 
LIMIT 100;
```
