# Lokality AI Interview Platform

An enterprise-grade, AI-powered recruitment intelligence platform. Lokality AI automates the full interview lifecycle — from candidate import and AI resume parsing, through interactive AI persona interviews with real-time proctoring, to comprehensive competency evaluation reports.

---

## 🚀 Key Features

- **AI-Powered Interview Room**: Real-time audio and speech-to-text integration with focus tracking and proctoring.
- **AI Resume Intelligence**: Gemini 2.5-powered resume parsing, skill extraction, and JD-candidate matching.
- **Recruiter Dashboard**: Complete control over job descriptions, candidate management, scheduling, and custom interview builder.
- **AI Evaluation Reports**: Detailed candidate scorecard, competency analysis, integrity assessment, and hire/no-hire recommendations.
- **Live Interview Monitoring**: Real-time WebSocket-based monitoring of active interviews with proctoring alerts.
- **Multi-Tenant Architecture**: Robust organization and role-based permissions (Super Admin, Org Admin, Recruiter, Candidate).
- **Production NestJS Backend**: Clean Architecture backend with 56 API endpoints, domain-driven design, and Swagger documentation.

---

## 🛠️ Tech Stack

### Frontend
| Technology | Purpose |
|---|---|
| **React 19** + **TanStack Start** | UI Framework + Full-stack meta-framework |
| **TanStack Router** | File-based routing with type-safe params |
| **TanStack Query** | Server state management |
| **Tailwind CSS** | Styling framework |
| **shadcn/ui** + **Radix UI** | Component library |
| **Recharts** | Data visualization |
| **Socket.IO Client** | Real-time WebSocket communication |

### Backend
| Technology | Purpose |
|---|---|
| **NestJS 11** | Enterprise Node.js framework |
| **Prisma 6** | Type-safe PostgreSQL ORM |
| **Google Gemini 2.5** | AI resume parsing, evaluation, interviews |
| **Socket.IO** | WebSocket server for live interviews |
| **Resend** | Transactional email delivery |
| **Swagger/OpenAPI** | API documentation |

### Infrastructure
| Technology | Purpose |
|---|---|
| **Supabase** | PostgreSQL, Auth (GoTrue), Storage |
| **TypeScript** | Full-stack type safety |

---

## 📚 Documentation

| Document | Description |
|----------|-------------|
| [**Architecture Guide**](docs/ARCHITECTURE.md) | System overview, tech stack, architecture diagrams, data flows |
| [**API Reference**](docs/API_REFERENCE.md) | Complete REST & WebSocket API documentation (56 endpoints) |
| [**Database Schema**](docs/DATABASE_SCHEMA.md) | All 30 tables with column reference and ER diagram |
| [**Setup Guide**](docs/SETUP.md) | Installation, configuration, deployment instructions |
| [**Progress Report**](docs/PROGRESS.md) | Development status, completion matrix, remaining work |
| [**Credentials**](docs/CREDENTIALS.md) | Demo accounts and test credential management |

---

## 🔑 Default Credentials

> [!NOTE]
> Please refer to the dedicated **[Default Credentials Documentation](docs/CREDENTIALS.md)** for a complete list of accounts, candidate test profiles, proctoring scenarios, and API service configurations.

### Quick Demo Accounts

| Role | Email | Password | Purpose |
|---|---|---|---|
| **Super Admin** | `superadmin@lokality.ai` | `SuperAdmin@2026` | Global control, tenant onboarding |
| **Org Admin** | `orgadmin@acme.com` | `OrgAdmin@2026` | Organization configuration |
| **Recruiter** | `recruitersatya@logikality.demo` | `Recruiter@2026` | Dashboard, JD editing, AI reports |
| **Candidate (Strong Hire)** | `aisha.k@example.com` | `Candidate@2026` | Completed interview reports |
| **Candidate (Scheduled)** | `m.chen@example.com` | `Candidate@2026` | Pre-interview testing |

---

## ⚙️ Getting Started

### Prerequisites

- **Node.js** ≥ 20.x
- **npm** ≥ 10.x
- **Supabase** account with project configured

### 1. Install Frontend Dependencies

```bash
npm install
```

### 2. Configure Environment Variables

Copy `.env.example` to `.env` and fill in your Supabase credentials:

```env
VITE_SUPABASE_URL=https://giwxdcjqoymqxuprjuix.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=your-supabase-anon-key
```

### 3. Install Backend Dependencies

```bash
cd backend
npm install
```

### 4. Configure Backend Environment

Create `backend/.env` — see [Setup Guide](docs/SETUP.md#step-3-configure-backend-environment) for all required variables.

### 5. Start Development Servers

**Terminal 1 — Frontend:**
```bash
npm run dev
```

**Terminal 2 — Backend:**
```bash
cd backend
npm run start:dev
```

### 6. Access the Platform

| Service | URL |
|---------|-----|
| **Frontend** | http://localhost:5173 |
| **Backend API** | http://localhost:3000/api |
| **Swagger Docs** | http://localhost:3000/api/docs |

---

## 🏗️ Project Structure

```
logikaiinterview/
├── src/                        # Frontend (TanStack Start + React)
│   ├── routes/                # File-based route pages
│   │   ├── _authenticated/    # Protected routes
│   │   │   ├── recruiter/    # Recruiter dashboard & tools
│   │   │   ├── candidate/    # Candidate interview portal
│   │   │   └── admin/        # Platform administration
│   │   └── index.tsx         # Public landing page
│   ├── components/            # Reusable UI components
│   ├── lib/                   # Server functions (API proxy)
│   └── hooks/                 # Custom React hooks
├── backend/                    # Backend (NestJS)
│   ├── src/
│   │   ├── domain/           # Domain entities & events
│   │   ├── application/      # Business logic services
│   │   ├── infrastructure/   # Database, AI, queues
│   │   └── presentation/     # Controllers, guards, gateways
│   └── prisma/               # Database schema
├── docs/                       # Documentation
└── supabase/                   # Supabase migrations & config
```

---

## 🗄️ Database & Migrations

Lokality AI uses Supabase PostgreSQL with 30+ tables. The database structure, RLS policies, and functions are defined under the [supabase/migrations](supabase/migrations) directory.

The complete schema is documented in [Database Schema Reference](docs/DATABASE_SCHEMA.md).

---

## 🤖 AI Capabilities

All AI features use Google's Gemini 2.5 models and include automatic mock fallback for development without API keys:

| Feature | Model | Description |
|---------|-------|-------------|
| Resume Parsing | Gemini 2.5 Flash | Extract skills, experience, contact info |
| JD Suggestion | Gemini 2.5 Flash | Generate job descriptions from title/department |
| Candidate Matching | Gemini 2.5 Flash | Score candidate-JD compatibility |
| Interview Questions | Gemini 2.5 Flash | Curated → adaptive question generation |
| Interview Evaluation | Gemini 2.5 Pro | Competency scoring, integrity analysis |
| Report Generation | Gemini 2.5 Flash | Structured assessment report markdown |
