# CLAUDE.md

Guidance for Claude Code when working in this repository.

## Project

AI Support Copilot — a multi-tenant AI-assisted customer support platform.
This is a **learning project**: the point is to build things by hand and
understand them, not to ship the fastest way possible. See the rule below
before touching auth, tenancy, RAG, or agent orchestration.

## Repo layout

Single repo, one service per top-level directory (see D-001 in `DECISIONS.md`).

| Directory | Service | Stack | Status |
|---|---|---|---|
| `backend/` | API | NestJS + Prisma | active |
| `frontend/` | Web UI | React + TypeScript + Vite | active |
| `ai-service/` | AI/RAG service | Python + FastAPI + LangGraph | planned (~Day 25) |
| `mcp-server/` | Tool/context server | Python (MCP) | planned |
| `worker/` | Background jobs | Node.js + BullMQ | planned |

Database: PostgreSQL + pgvector.

## Environment & infrastructure

- **PostgreSQL runs natively on the Windows host — never in Docker.** Only
  Redis and Mailhog run in `docker-compose.yml`. This is deliberate (D-002),
  not a gap to "fix" by dockerizing Postgres.
- During dev, anything that talks to Postgres (backend, worker) runs on the
  host too, not in a container — `localhost` inside a container will not
  reach a host Postgres instance.
- There is a **single `.env` at the repo root**, not one per service. Don't
  create per-service `.env` files; add new variables to the root `.env` and
  `.env.example`.
- `docker-compose.yml` at the root should only ever contain infra Postgres
  intentionally excludes (currently Redis, Mailhog). Don't add Postgres to it.

## Commit convention

Conventional Commits, scoped by service:

```
feat(backend): add ticket ingestion endpoint
fix(frontend): correct pagination off-by-one
chore(worker): bump bullmq version
docs(mcp-server): document tool schema
test(backend): cover tenant isolation edge case
```

Types in use: `feat`, `fix`, `chore`, `docs`, `test`. Scope is the service
directory name (`backend`, `frontend`, `ai-service`, `mcp-server`, `worker`).
Use no scope only for changes that touch the repo as a whole (e.g. root
`README.md`, `docker-compose.yml`).

## Architectural decisions

**Every architectural decision gets an entry in `DECISIONS.md` before the
code is written.** Not after, not alongside — before. If you're about to
make a call that would be annoying or expensive to reverse (a new service
boundary, a storage choice, a cross-service contract, a library that shapes
the architecture), stop and add a `D-00N` entry first: date, context,
decision, why, trade-off. Small implementation-detail choices inside a
single function don't need an entry; anything that future-you would want
explained does.

## What NOT to build yet

This is a learning project specifically so that these pieces get built by
hand, deliberately, when we get to them — not scaffolded in early because
a framework or a helpful assistant defaults to including them. **Do not
implement any of the following unless explicitly asked in the current
request:**

- Authentication
- Multi-tenancy
- RBAC / authorization
- RAG (retrieval-augmented generation)
- Tool authorization (for the MCP server or agent tools)
- LangGraph / agent orchestration

If a task seems to require one of these as a prerequisite, say so and ask
rather than adding it silently.

## Backend Conventions

- API docs: every controller/endpoint should carry `@nestjs/swagger`
  decorators (`@ApiTags`, `@ApiOperation`, `@ApiResponse`, DTOs annotated
  with `@ApiProperty`, etc.) so the generated spec stays accurate. Swagger UI
  is served at `/api/docs` outside the `api/v1` prefix, and only mounted when
  `NODE_ENV !== 'production'`.

_(More to fill in as backend conventions solidify — module structure,
Prisma/migration workflow, testing approach, error handling, etc.)_

## Frontend Conventions

_(To be filled in as frontend conventions solidify — component structure,
state management, styling approach, testing approach, etc.)_
