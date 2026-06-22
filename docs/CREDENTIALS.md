# Lokality AI Interview
## Default Application Credentials

### Overview
This document serves as the single source of truth for all default application credentials used during development, testing, demos, and local deployment for the **Lokality AI Interview** platform. 

> [!WARNING]
> These credentials are strictly for development, QA testing, and demonstration environments. **Never use or expose these credentials in production environments.** All production deployments must use unique, strong passwords, secret keys stored in environment variables, and secure identity provider configurations.

---

## Super Admin
Super Admin accounts have global access across the entire platform, including system settings, system-wide metrics, tenant/organization onboarding, global user management, and security audit logs.

- **Email**: `superadmin@lokality.ai`
- **Password**: `SuperAdmin@2026`
- **Role**: `admin` (System Super Admin)
- **Permissions**: Full read/write access to all database tables, organization setup, and global feature toggles.
- **Default Organization**: Lokality AI (System Tenant)
- **Login URL**: [http://localhost:5173/auth](http://localhost:5173/auth)

---

## Organization Admin
Organization Admins have administrative permissions scoped to their specific tenant organization. They manage recruiters, hiring managers, company settings, and custom branding.

- **Email**: `orgadmin@acme.com`
- **Password**: `OrgAdmin@2026`
- **Organization**: `Acme Corp`
- **Role**: `admin` (Tenant Admin)
- **Permissions**: Manage organization-level users, branding preferences, job templates, and billing settings.
- **Login URL**: [http://localhost:5173/auth](http://localhost:5173/auth)

---

## Recruiter Accounts
Recruiter accounts manage the day-to-day candidate screening process, build interview stages, assign AI personas, and review AI-generated reports.

### 1. Satya Recruiter (Primary Database Seeded Account)
*This account is pre-configured and updated automatically via the database migration schema.*
- **Name**: Satya Recruiter
- **Email**: `recruitersatya@logikality.demo`
- **Password**: `Recruiter@2026`
- **Organization**: `Logikality Demo Org`
- **Assigned Role**: `recruiter`
- **Department**: Talent Acquisition
- **Permissions**: Schedule candidate interviews, assign job descriptions (JDs), customize AI interviewer profiles, view comprehensive candidate analytics.

### 2. Sarah Recruiter (Tenant Recruiter)
- **Name**: Sarah Recruiter
- **Email**: `recruiter.sarah@acme.com`
- **Password**: `Recruiter@2026`
- **Organization**: `Acme Corp`
- **Assigned Role**: `recruiter`
- **Department**: Engineering Recruitment
- **Permissions**: Manage software engineering pipeline, create custom questions, and send email invitations.

---

## Hiring Manager Accounts
Hiring Managers review final candidate transcripts and AI evaluation reports, leaving notes/reviews for final hiring alignment.

- **Name**: Michael Manager
- **Email**: `manager.michael@acme.com`
- **Password**: `Manager@2026`
- **Organization**: `Acme Corp`
- **Department**: Product Engineering
- **Permissions**: Read-only view of candidate scorecards, transcripts, and proctoring logs. Read/write access to manager reviews and final hire/no-hire recommendations.

---

## Candidate Test Accounts
These accounts represent demo candidates with varying application statuses, roles, and evaluations.

### 1. Sarah Jenkins
- **Name**: Sarah Jenkins
- **Email**: `sarah.j@example.com`
- **Applied Role**: Senior Software Engineer
- **Interview Status**: `evaluated`
- **Assigned Recruiter**: Satya Recruiter
- **Assigned JD**: Senior Software Engineer (Vite/TypeScript)
- **Assigned AI Persona**: Principal Engineer (Ava)
- **Assigned Interview**: Completed (Score: 92)

### 2. Marcus Chen
- **Name**: Marcus Chen
- **Email**: `m.chen@example.com`
- **Applied Role**: Product Manager
- **Interview Status**: `interviewing`
- **Assigned Recruiter**: Sarah Recruiter
- **Assigned JD**: Technical Product Manager
- **Assigned AI Persona**: Product Director (Dan)
- **Assigned Interview**: Scheduled

### 3. Priya Patel
- **Name**: Priya Patel
- **Email**: `priya.p@example.com`
- **Applied Role**: Data Scientist
- **Interview Status**: `screening`
- **Assigned Recruiter**: Satya Recruiter
- **Assigned JD**: Senior Data Scientist
- **Assigned AI Persona**: ML Tech Lead (Mia)
- **Assigned Interview**: Scheduled

### 4. James O'Brien
- **Name**: James O'Brien
- **Email**: `j.obrien@example.com`
- **Applied Role**: DevOps Engineer
- **Interview Status**: `new`
- **Assigned Recruiter**: Sarah Recruiter
- **Assigned JD**: Cloud DevOps Engineer
- **Assigned AI Persona**: Cloud Architect (Cliff)
- **Assigned Interview**: Not Started

---

## Demo Interview Accounts
Use these dedicated profiles to demonstrate different phases and outcomes of the AI evaluation lifecycle.

### 1. Scheduled Interview Demo
- **Candidate**: Marcus Chen (`m.chen@example.com`)
- **Key Showcase**: How recruiters configure interview links, candidate system checks, and preparation cards.

### 2. In Progress / Live Interview Demo
- **Candidate**: Sarah Jenkins (`sarah.j@example.com` - active session mockup)
- **Key Showcase**: Real-time AI interviewer transcript playback, candidate speech-to-text, and browser focus logs.

### 3. Completed Interview Demo
- **Candidate**: Aisha Khan (`aisha.k@example.com`)
- **Key Showcase**: Audio playback of the interview room session, detailed timeline, and metrics breakdown.

### 4. Strong Hire Report Demo (Score: 95)
- **Candidate**: Aisha Khan (`aisha.k@example.com`)
- **Key Showcase**: Deep technical responses, consistent architectural insights, 100% video/audio verification.

### 5. Hire Report Demo (Score: 84)
- **Candidate**: Marcus Chen (`m.chen@example.com`)
- **Key Showcase**: Solid domain knowledge, balanced communication skills, minor gaps in system scaling depth.

### 6. Maybe Report Demo (Score: 78)
- **Candidate**: Priya Patel (`priya.p@example.com`)
- **Key Showcase**: Strong python scripting but struggled with theoretical statistics; border-line suitability.

### 7. Reject Report Demo (Score: 62)
- **Candidate**: Diego Ramirez (`d.ramirez@example.com`)
- **Key Showcase**: Insufficient project experience, skipped design queries, proctoring warnings (lost window focus).

---

## API Test Accounts
Service accounts utilized for automation testing, external integrations (ATS syncing), and CI/CD pipelines.

- **Account Name**: `automated-ats-sync`
- **Service Email**: `api-client@lokality.ai`
- **Auth Method**: Supabase Service Role JWT (Bypasses Row Level Security)
- **Environment Key**: `SUPABASE_SERVICE_ROLE_KEY`
- **Permissions**: Full read/write database scope.

---

## Local Development Credentials
To quickly login locally and inspect specific dashboards, use:

- **Local Admin Login**: `superadmin@lokality.ai` / `SuperAdmin@2026`
- **Test Recruiter Login**: `recruitersatya@logikality.demo` / `Recruiter@2026`
- **Test Candidate Login**: Signup on-demand via the candidate option in the `/auth?mode=signup` tab.

---

## Environment Notes
- **Local Sandbox**: All accounts except `recruitersatya@logikality.demo` can be self-signed up dynamically on a local instance using the `/auth` page.
- **Production Safety**: Never commit `.env` or `.env.local` files containing real production database keys or JWT secrets. 
- **Environment Variables**: Configure your variables in `.env` based on the `.env.example` file.
- **Password Enforcement**: All real-world staging/production credentials must be provisioned through standard Auth flow and enforce a minimum of 8 characters with complex character requirements.

---

## Login URLs

- **Admin Portal**: [http://localhost:5173/admin](http://localhost:5173/admin)
- **Recruiter Portal**: [http://localhost:5173/recruiter](http://localhost:5173/recruiter)
- **Candidate Portal**: [http://localhost:5173/candidate/prepare](http://localhost:5173/candidate/prepare)
- **Landing Page**: [http://localhost:5173/](http://localhost:5173/)
- **API Documentation**: [http://localhost:5173/api/public/health](http://localhost:5173/api/public/health)

---

## Quick Demo Accounts

| Role | Email | Password | Purpose |
|------|-------|----------|---------|
| Super Admin | `superadmin@lokality.ai` | `SuperAdmin@2026` | Global control panel, audit logs, system-wide admin dashboards |
| Org Admin | `orgadmin@acme.com` | `OrgAdmin@2026` | Organization/tenant customization, recruiter provisioning |
| Recruiter (Seeded) | `recruitersatya@logikality.demo` | `Recruiter@2026` | Managing candidate lists, editing JDs, reviewing AI reports |
| Candidate (Strong Hire) | `aisha.k@example.com` | `Candidate@2026` | Demonstrating score reports, audio transcribing, strong evaluations |
| Candidate (Scheduled) | `m.chen@example.com` | `Candidate@2026` | Testing scheduled candidates, system checkups, pre-interview layouts |

---

## Database Seeding & Regeneration

### Pre-existing User Migrations
The database user `recruitersatya@logikality.demo` is configured and attached to the `Logikality Demo Org` during migrations via:
- [20260606034600_6f4f18bc-c35b-4128-a2ef-36389906449a.sql](file:///e:/logikaiinterview/supabase/migrations/20260606034600_6f4f18bc-c35b-4128-a2ef-36389906449a.sql)

### How to Regenerate or Add New Seed Accounts
1. If running a local Supabase stack, you can create a `supabase/seed.sql` file to seed database entities.
2. Inside `seed.sql`, use Supabase-specific helper functions or SQL inserts to create auth accounts:
   ```sql
   -- Example of seeding a user in Supabase auth
   INSERT INTO auth.users (id, email, encrypted_password, email_confirmed_at, raw_app_meta_data, raw_user_meta_data, created_at, updated_at)
   VALUES (
     '00000000-0000-0000-0000-000000000001',
     'superadmin@lokality.ai',
     crypt('SuperAdmin@2026', gen_salt('bf')),
     now(),
     '{"provider":"email","providers":["email"]}',
     '{"full_name":"Super Admin","role":"admin"}',
     now(),
     now()
   );
   ```
3. Apply seeds to your local instance by running:
   ```bash
   supabase db reset
   ```
