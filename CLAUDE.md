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

- Authentication (and auth internals generally — session handling, token
  refresh, password hashing)
- Multi-tenancy isolation
- RBAC / authorization logic
- RAG (retrieval-augmented generation) retrieval
- Tool authorization (for the MCP server or agent tools)
- LangGraph / agent orchestration
- Prompt injection defenses

If a task seems to require one of these as a prerequisite, say so and ask
rather than adding it silently. This applies to agents and slash commands
under `.claude/` too, not just direct requests.

## Backend Conventions

- API docs: every controller/endpoint should carry `@nestjs/swagger`
  decorators (`@ApiTags`, `@ApiOperation`, `@ApiResponse`, DTOs annotated
  with `@ApiProperty`, etc.) so the generated spec stays accurate. Swagger UI
  is served at `/api/docs` outside the `api/v1` prefix, and only mounted when
  `NODE_ENV !== 'production'`.
- Module structure: one Nest module per domain (`tickets/`, `users/`, …),
  each with its own `*.controller.ts`, `*.service.ts`, `dto/`, and
  `entities/` (only the pieces that domain actually needs — don't scaffold
  empty ones). Controllers stay thin: request/response shape and delegating
  to the service, no business logic.
- Validation lives in DTOs, not in controller bodies or services. Every
  request payload gets a `class-validator`-annotated DTO; the global
  `ValidationPipe` (`whitelist`, `forbidNonWhitelisted`, `transform` — see
  D-004) enforces it. If a controller method takes a body/query/params
  object that isn't a validated DTO, that's a bug.
- Errors: throw Nest's built-in `HttpException` subclasses
  (`BadRequestException`, `NotFoundException`, etc.) from services; don't
  hand-construct error response bodies. The global exception filter turns
  every thrown error into the standard shape from D-003
  (`{ statusCode, message, errors?, path, timestamp, requestId }`) — that
  shape is fixed, don't add ad-hoc fields to it per-endpoint.

## Frontend Conventions

- Feature-folder structure: domain-specific code lives under
  `src/features/<domain>/` (`tickets/`, `auth/`, `customers/`, …), not
  scattered across generic top-level folders. Shared, domain-agnostic UI
  goes in `src/components/{ui,layout,common}`; route-level pages that
  compose feature code go in `src/pages`.
- Server state vs. client state: React Query owns anything that comes from
  the backend (fetched, cached, invalidated data). Redux (`src/app/store`)
  owns client-only UI state that has no server representation — sidebar
  open/collapsed, modal visibility, wizard step, etc. If you're tempted to
  put fetched data in a Redux slice, it belongs in a React Query hook
  instead.
- API calls: each feature gets its own `api.ts` (e.g.
  `src/features/tickets/api.ts`) exporting functions that call the shared
  `src/lib/api.ts` Axios instance and wrap the calls React Query cares
  about (`useQuery`/`useMutation` hooks can live alongside or in a sibling
  `hooks.ts`). Nothing outside `src/lib/api.ts` talks to Axios directly.
- Component naming: PascalCase component files matching the exported
  component name (`TicketList.tsx` exports `TicketList`). Non-component
  modules (`api.ts`, `hooks.ts`, `types.ts`) stay lowercase.

## Testing Conventions

- Backend: Jest + Supertest. Unit tests are co-located next to the file
  they test as `*.spec.ts` (e.g. `tickets.service.spec.ts` beside
  `tickets.service.ts`). End-to-end tests live in `backend/test/` as
  `*.e2e-spec.ts` and hit the app through HTTP via Supertest, not by
  calling services directly.
- Frontend: React Testing Library for component tests, co-located as
  `*.test.tsx` next to the component under test. Prefer testing behavior
  (what the user sees/does) over implementation detail.
- End-to-end: Playwright, in a root-level `e2e/` directory (cross-service —
  drives the real frontend against the real backend, so it doesn't belong
  inside either service folder).
