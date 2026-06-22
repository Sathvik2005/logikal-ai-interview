# Lokality AI — Setup & Deployment Guide

> **Version:** 1.0.0  
> **Last Updated:** June 22, 2026

---

## Table of Contents

1. [Prerequisites](#prerequisites)
2. [Project Structure](#project-structure)
3. [Environment Setup](#environment-setup)
4. [Database Configuration](#database-configuration)
5. [Frontend Setup](#frontend-setup)
6. [Backend Setup](#backend-setup)
7. [Running the Platform](#running-the-platform)
8. [Verifying the Setup](#verifying-the-setup)
9. [Troubleshooting](#troubleshooting)
10. [Production Deployment](#production-deployment)

---

## Prerequisites

| Software | Required Version | Purpose |
|----------|-----------------|---------|
| **Node.js** | ≥ 20.x | JavaScript runtime |
| **npm** | ≥ 10.x | Package manager |
| **Git** | Latest | Version control |
| **Supabase Account** | — | Database, Auth, Storage |

### Optional (for production features)

| Software | Purpose |
|----------|---------|
| **Gemini API Key** | AI resume parsing, evaluation, JD generation |
| **Resend API Key** | Transactional email delivery |

---

## Project Structure

```
logikaiinterview/
├── .env                    # Frontend environment variables
├── .env.example            # Environment template
├── package.json            # Frontend dependencies
├── vite.config.ts          # Vite build configuration
├── tsconfig.json           # TypeScript configuration
├── src/                    # Frontend source code
│   ├── routes/            # TanStack Router pages
│   ├── components/        # React UI components
│   ├── lib/               # Server functions (API proxy layer)
│   ├── hooks/             # Custom React hooks
│   └── integrations/      # Third-party integrations
├── backend/                # NestJS backend
│   ├── .env               # Backend environment variables
│   ├── package.json       # Backend dependencies
│   ├── prisma/            # Database schema & migrations
│   │   └── schema.prisma  # Prisma schema (30+ models)
│   └── src/               # Backend source code
│       ├── domain/        # Domain entities & events
│       ├── application/   # Business logic services
│       ├── infrastructure/# Database, AI, queues
│       └── presentation/  # Controllers, guards, gateways
├── docs/                   # Project documentation
│   ├── ARCHITECTURE.md    # Architecture guide
│   ├── API_REFERENCE.md   # API endpoint reference
│   ├── SETUP.md           # This file
│   ├── CREDENTIALS.md     # Credential management
│   └── PROGRESS.md        # Development progress tracker
└── supabase/              # Supabase configuration
```

---

## Environment Setup

### Step 1: Clone the Repository

```bash
git clone <repository-url> logikaiinterview
cd logikaiinterview
```

### Step 2: Configure Frontend Environment

Create `.env` in the project root:

```env
# Supabase Configuration
SUPABASE_PROJECT_ID="giwxdcjqoymqxuprjuix"
SUPABASE_PUBLISHABLE_KEY="<your-supabase-anon-key>"
SUPABASE_URL="https://giwxdcjqoymqxuprjuix.supabase.co"
VITE_SUPABASE_PROJECT_ID="giwxdcjqoymqxuprjuix"
VITE_SUPABASE_PUBLISHABLE_KEY="<your-supabase-anon-key>"
VITE_SUPABASE_URL="https://giwxdcjqoymqxuprjuix.supabase.co"
```

### Step 3: Configure Backend Environment

Create `backend/.env`:

```env
# Supabase
SUPABASE_URL="https://giwxdcjqoymqxuprjuix.supabase.co"
SUPABASE_ANON_KEY="<your-supabase-anon-key>"
SUPABASE_PROJECT_ID="giwxdcjqoymqxuprjuix"

# Database (REQUIRED for Prisma)
DATABASE_URL="postgresql://postgres.giwxdcjqoymqxuprjuix:<PASSWORD>@aws-0-us-east-1.pooler.supabase.com:6543/postgres?pgbouncer=true"

# JWT Verification (optional in dev)
JWT_SECRET="your-supabase-jwt-secret"

# AI Features (optional - mock mode if not set)
GEMINI_API_KEY="your-gemini-api-key"

# Email (optional - log mode if not set)
RESEND_API_KEY="re_yourResendApiKey"

# Application
PORT=3000
FRONTEND_URL="http://localhost:5173"
APP_URL="http://localhost:5173"
NODE_ENV="development"
```

---

## Database Configuration

### Finding Your Database Password

1. Go to [Supabase Dashboard](https://supabase.com/dashboard)
2. Select your project (`giwxdcjqoymqxuprjuix`)
3. Navigate to **Settings → Database**
4. Under **Connection string**, select **URI**
5. Copy the connection string (it contains your database password)

### Database Connection String Format

```
postgresql://postgres.[project-ref]:[PASSWORD]@aws-0-[region].pooler.supabase.com:6543/postgres?pgbouncer=true
```

### Syncing the Prisma Schema

Once `DATABASE_URL` is configured:

```bash
cd backend

# Pull the live database schema into Prisma
npx prisma db pull

# Generate the typed Prisma client
npx prisma generate
```

---

## Frontend Setup

### Install Dependencies

```bash
# From project root
npm install
```

### Start Development Server

```bash
npm run dev
```

The frontend will be available at: `http://localhost:5173`

---

## Backend Setup

### Install Dependencies

```bash
cd backend
npm install
```

### Generate Prisma Client

```bash
npx prisma generate
```

### Start Development Server

```bash
npm run start:dev
```

The backend will be available at:
- **API:** `http://localhost:3000/api`
- **Swagger Docs:** `http://localhost:3000/api/docs`
- **WebSocket:** `http://localhost:3000/interview` (Socket.IO)

---

## Running the Platform

### Development Mode (Two Terminals)

**Terminal 1 — Frontend:**
```bash
cd logikaiinterview
npm run dev
```

**Terminal 2 — Backend:**
```bash
cd logikaiinterview/backend
npm run start:dev
```

### Verification Checklist

| Check | Expected Result |
|-------|----------------|
| Frontend boots | `http://localhost:5173` shows landing page |
| Backend boots | Console shows `Lokality API backend is running on: http://localhost:3000/api` |
| Swagger loads | `http://localhost:3000/api/docs` shows API documentation |
| Auth works | Login at `/auth` redirects to recruiter dashboard |
| API responds | `curl http://localhost:3000/api/candidates` returns data |

---

## Verifying the Setup

### Backend Health Check

```bash
# Test API is responding
curl http://localhost:3000/api/candidates

# Check Swagger documentation
curl http://localhost:3000/api/docs
```

### Frontend-Backend Integration

1. Log in at `http://localhost:5173/auth`
2. Navigate to the Recruiter Dashboard
3. Open browser DevTools → Network tab
4. Verify requests go to `http://localhost:3000/api/...`
5. Check responses return valid JSON data

---

## Troubleshooting

### Common Issues

#### `PrismaClientInitializationError: Environment variable not found: DATABASE_URL`

**Cause:** The `backend/.env` file is missing or `DATABASE_URL` is not set.

**Fix:** Create `backend/.env` with a valid PostgreSQL connection string from your Supabase dashboard.

#### `Error P1012: Prisma schema validation error`

**Cause:** Prisma 6+ requires explicit configuration for environment variables.

**Fix:** Ensure `DATABASE_URL` is set in `backend/.env` and run:
```bash
npx prisma generate
```

#### Frontend shows "Failed to fetch" errors

**Cause:** Backend is not running or CORS is misconfigured.

**Fix:**
1. Ensure the backend is running on port 3000
2. Check `FRONTEND_URL` in `backend/.env` matches the frontend port

#### JWT verification fails

**Cause:** `JWT_SECRET` doesn't match Supabase's JWT secret.

**Fix:** In development, the auth guard falls back to `jwt.decode()` (no verification). For production, set the correct `JWT_SECRET` from Supabase Dashboard → Settings → API → JWT Secret.

#### AI features return mock data

**Cause:** `GEMINI_API_KEY` is not configured or is set to the template value.

**Fix:** Get a real API key from [Google AI Studio](https://aistudio.google.com/apikey) and set it in `backend/.env`.

---

## Production Deployment

### Build Steps

**Frontend:**
```bash
npm run build
```

**Backend:**
```bash
cd backend
npm run build
npm run start:prod
```

### Production Environment Variables

Ensure all template values are replaced with real credentials:

| Variable | Required | Source |
|----------|----------|--------|
| `DATABASE_URL` | ✅ | Supabase Dashboard → Settings → Database |
| `JWT_SECRET` | ✅ | Supabase Dashboard → Settings → API → JWT Secret |
| `GEMINI_API_KEY` | ✅ | Google AI Studio |
| `RESEND_API_KEY` | ✅ | Resend Dashboard |
| `SUPABASE_URL` | ✅ | Supabase Dashboard |
| `SUPABASE_ANON_KEY` | ✅ | Supabase Dashboard → Settings → API |

### Deployment Checklist

- [ ] All environment variables are production values
- [ ] `NODE_ENV=production`
- [ ] CORS `origin` is set to production domain (not `*`)
- [ ] JWT verification is using real `JWT_SECRET` (not decode fallback)
- [ ] Database connection uses connection pooling (`?pgbouncer=true`)
- [ ] SSL enabled for all connections
- [ ] Rate limiting configured
- [ ] Error logging to persistent storage
