# Lokality AI Interview Platform

An enterprise-grade, AI-powered recruitment and candidate interviewing platform. Lokality AI automates the screening pipeline by conducting realistic, interactive audio interviews using specialized AI personas, recording and transcribing responses, and evaluating candidates with deep analytical insights.

---

## 🚀 Key Features

* **AI-Powered Interview Room**: Real-time audio and speech-to-text integration with focus tracking and proctoring.
* **Recruiter Dashboard**: Complete control over job descriptions, candidate management, scheduling, and custom interview builder.
* **AI Evaluation Reports**: Detailed candidate scorecard, sentiment analysis, skill gap assessment, and timeline logs.
* **Multi-Tenant Architecture**: Robust organization and role-based permissions (Super Admin, Org Admin, Recruiter, Hiring Manager, Candidate).

---

## 🛠️ Tech Stack

* **Frontend Framework**: [React 19](https://react.dev/) & [Vite](https://vitejs.dev/)
* **Routing & Meta-Framework**: [TanStack Start](https://tanstack.com/router/v1/docs/start/overview) (file-based routing, server-side actions, and loaders)
* **Styling**: [Tailwind CSS](https://tailwindcss.com/)
* **Database & Auth**: [Supabase](https://supabase.com/) (PostgreSQL with Row-Level Security, Database Triggers, and Auth schemas)
* **Language**: [TypeScript](https://www.typescriptlang.org/)

---

## 🔑 Default Credentials

To simplify development, QA testing, and demos, a pre-configured suite of sandbox credentials has been documented.

> [!NOTE]
> Please refer to the dedicated **[Default Credentials Documentation](file:///e:/logikaiinterview/docs/CREDENTIALS.md)** for a complete list of accounts, candidate test profiles, proctoring scenarios, and api service configurations.

### Quick Demo Accounts

| Role | Email | Password | Primary Purpose |
| :--- | :--- | :--- | :--- |
| **Super Admin** | `superadmin@lokality.ai` | `SuperAdmin@2026` | Global control, tenant onboarding, system logs |
| **Org Admin** | `orgadmin@acme.com` | `OrgAdmin@2026` | Organization configuration, recruiter invites |
| **Seeded Recruiter** | `recruitersatya@logikality.demo` | `Recruiter@2026` | Live dashboard, JD editing, AI report analysis |
| **Candidate (Strong Hire)** | `aisha.k@example.com` | `Candidate@2026` | Reviewing high-score completed interview reports |
| **Candidate (Scheduled)** | `m.chen@example.com` | `Candidate@2026` | Testing pre-interview system checks and preparation |

For instructions on database seeding, migration structure, and credential customization, check out [docs/CREDENTIALS.md](file:///e:/logikaiinterview/docs/CREDENTIALS.md).

---

## ⚙️ Getting Started

### Prerequisites
Make sure you have [Node.js](https://nodejs.org/) (v18+) or [Bun](https://bun.sh/) installed.

### 1. Install Dependencies
```bash
npm install
# or
bun install
```

### 2. Configure Environment Variables
Copy `.env.example` to `.env` (or update existing `.env` in the project root) and fill in your Supabase configuration:
```env
VITE_SUPABASE_URL=your-supabase-url
VITE_SUPABASE_ANON_KEY=your-supabase-anon-key
```

### 3. Run Development Server
Start the local server with hot module reloading:
```bash
npm run dev
# or
bun dev
```
Open [http://localhost:5173](http://localhost:5173) in your browser to view the application.

### 4. Build for Production
To build and check the production bundle, run:
```bash
npm run build
npm run preview
```

---

## 🗄️ Database & Migrations

Lokality AI leverages Supabase local schemas and migrations. 

* The database structure, RLS policies, and functions are defined under the [supabase/migrations](file:///e:/logikaiinterview/supabase/migrations) directory.
* When registering new users via the `/auth` page, a PostgreSQL trigger automatically creates corresponding [profiles](file:///e:/logikaiinterview/supabase/migrations/20260605052635_3a33b43a-2121-4a51-99bf-04d670128ece.sql) and maps user metadata (such as names and roles) to their database session.
