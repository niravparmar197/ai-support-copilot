# AI Support Copilot

Multi-tenant AI-assisted customer support platform.

**Stack:** React + TypeScript + Vite · NestJS + Prisma · FastAPI + LangGraph · PostgreSQL + pgvector · Redis + BullMQ

---

## Prerequisites

| Tool | Version | Notes |
|---|---|---|
| Node.js | 20 or 22 | |
| Docker Desktop | latest | WSL 2 backend enabled |
| PostgreSQL | [your version] | Installed natively, **not** in Docker |
| pgvector | 0.7+ | Extension for your Postgres major version |
| Python | 3.11+ | Needed from Day 25 onward |

---

## Setup

### 1. PostgreSQL

Postgres runs natively on the host, not in Docker (see D-002 in `DECISIONS.md`).

Confirm pgvector is available:

```powershell
psql -U postgres -c "SELECT * FROM pg_available_extensions WHERE name = 'vector';"
```

No rows means pgvector is not installed — install it before continuing.

Create the database and enable the extension:

```powershell
psql -U postgres -c "CREATE DATABASE support_copilot;"
psql -U postgres -d support_copilot -c "CREATE EXTENSION IF NOT EXISTS vector;"
psql -U postgres -d support_copilot -c "\dx"
```

`vector` should appear in the final output.

### 2. Environment

```powershell
Copy-Item .env.example .env
```

Fill in `.env`. `DATABASE_URL` points at your local Postgres: