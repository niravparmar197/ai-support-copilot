## D-001: Single repository for all services
Date: 2026-08-18
Context: Four services (backend, frontend, ai-service, mcp-server) plus a worker.
Decision: One repo.
Why: Shared Docker Compose, cross-service E2E tests, single CI pipeline.
Trade-off: Larger repo; no independent service versioning. Acceptable for a portfolio project.

## D-002: Postgres runs natively, not in Docker
Date: 2026-08-18
Decision: Local Postgres install with pgvector; only Redis and Mailhog in Compose.
Why: Matches existing RAG project setup; avoids volume and permission friction on Windows.
Trade-off: Dev environment not reproducible from Compose alone — setup documented in README.
Worker must run on host, not in a container, during dev, since `localhost` inside a
container does not reach the host Postgres.

## D-003: Uniform error response shape
Date: 2026-08-18
Context: A global exception filter needs one consistent JSON shape for every error the
API returns, whether it's a validation failure, a thrown `HttpException`, or an
unhandled exception.
Decision: `{ statusCode, message, errors?, path, timestamp, requestId }` for every
error response. `HttpException`s use their own status/message (validation array goes
in the optional `errors` field). Unknown/unhandled errors are logged in full
server-side but only ever return a generic 500 message to the client — never a stack
trace or internal error detail.
Why: A fixed shape lets the frontend normalize every failure into one typed `ApiError`
without special-casing per endpoint. Hiding internal detail on unknown errors avoids
leaking implementation details to clients.
Trade-off: Validation error detail has to live in the optional `errors` array instead
of being the primary `message`.

## D-004: Global ValidationPipe — whitelist + forbidNonWhitelisted
Date: 2026-08-18
Decision: The global `ValidationPipe` runs with `whitelist: true`,
`forbidNonWhitelisted: true`, `transform: true`.
Why: `whitelist` strips properties not declared on the DTO; `forbidNonWhitelisted`
rejects the request outright instead of silently stripping them. Without this, a
client sending extra fields (e.g. `role`, `tenantId`, `isAdmin`) on a payload could
have them silently dropped now and silently *accepted* later if a DTO is ever loosened
— a mass-assignment bug waiting to happen. Rejecting the request is the safer failure
mode: it fails loudly at the boundary instead of quietly at some future date.
Trade-off: Every DTO must explicitly declare every field a client is allowed to send;
a forgotten field turns into a 400 rather than a silent pass-through.

## D-005: Request ID propagation
Date: 2026-08-18
Decision: Middleware reads `x-request-id` off the incoming request (or generates a
UUID if absent), attaches it to `req`, echoes it back on the response header, and
includes it in every error body.
Why: Lets a specific failed request be correlated end-to-end — client log, response
body, server log — without needing distributed tracing infrastructure yet.
Trade-off: A client-supplied `x-request-id` is trusted as-is with no format
validation; fine for correlation, would need hardening if it were ever used for
anything security-sensitive.

## D-006: Tailwind CSS v4 with CSS-first config
Date: 2026-08-18
Context: Frontend scaffold called for the classic `tailwindcss` + `postcss` +
`autoprefixer` setup (`tailwind.config.js` content globs, `postcss.config.js` running
`tailwindcss` + `autoprefixer` as plugins). `npm install tailwindcss` pulled Tailwind
v4 (current latest), which no longer accepts `tailwindcss` as a direct PostCSS plugin
and drops `tailwind.config.js` in favor of CSS-first configuration.
Decision: Use Tailwind v4 as installed rather than pinning to v3. PostCSS pipeline is
`@tailwindcss/postcss` (installed in addition to the originally-listed packages);
`src/index.css` uses `@import "tailwindcss";`; no `tailwind.config.js` content globs
(v4 auto-scans the project). `autoprefixer` stays installed but unused — v4 handles
vendor prefixing internally.
Why: Confirmed with the user rather than silently pinning to an older major version.
Trade-off: Future theme customization (colors, spacing, tokens) uses v4's `@theme`
CSS-based syntax instead of the more commonly-documented `tailwind.config.js` JS API.

## D-007: Prisma 7 — no schema-level datasource URL, driver adapter required at runtime
Date: 2026-08-18
Context: Prisma tooling setup called for the classic `datasource db { url =
env("DATABASE_URL") }` pattern. `npm install prisma` pulled Prisma 7.9.1 (current
latest), which hard-rejects `url` in the schema's `datasource` block entirely
(`P1012: The datasource property 'url' is no longer supported in schema files`) —
this is a validation error, not a warning. Prisma 7 also scaffolds a `prisma.config.ts`
file (superseding the old `"prisma": { "schema": ... }` key in `package.json`) and
defaults `generator client` to a new `provider = "prisma-client"` (ESM, outputs to
`src/generated/prisma`) instead of the classic `prisma-client-js`.
Decision: `schema.prisma`'s `datasource db` block has no `url` — only `provider =
"postgresql"`. The connection URL lives solely in `prisma.config.ts`
(`datasource.url: process.env["DATABASE_URL"]`), used by the CLI (`migrate`,
`studio`, `db pull`). `generator client` stays on `provider = "prisma-client-js"` (the
classic generator, still supported in v7, just no longer the default) rather than
switching to the new `prisma-client` provider, since the task asked for it explicitly
and it keeps the familiar `import { PrismaClient } from '@prisma/client'` import
style. The legacy `"prisma"` key was still added to `backend/package.json` as asked —
Prisma 7 doesn't warn about it coexisting with `prisma.config.ts`.
**Consequence for Day 2 (when models + `PrismaService` get written by hand):**
`new PrismaClient()` can no longer implicitly read a schema-embedded connection URL.
The service will need to construct `PrismaClient` with a driver adapter (e.g.
`@prisma/adapter-pg` wrapping `pg`, reading `DATABASE_URL` itself) — install that
adapter and its underlying driver package at that point; it's out of scope for this
tooling-only pass.
Why: Following the literal old-style instruction (`url = env(...)` in the schema)
is not a style choice here — it fails schema validation outright on the installed
version. Kept `prisma-client-js` where the task was explicit and where doing so
doesn't conflict with anything the installed version actually requires.
Trade-off: `prisma.config.ts` and the eventual `PrismaService`'s driver adapter both
end up reading `DATABASE_URL` independently (CLI vs. runtime), rather than the schema
being the single source of truth the way it was pre-v7.

## D-008: User.tenantId is nullable
Date: 2026-08-18
Context: Drafting Tenant/User/UserSession models. SUPER_ADMIN manages tenants but
doesn't belong to one; COMPANY_ADMIN, SUPPORT_USER, and CUSTOMER each belong to
exactly one tenant.
Decision: `User.tenantId` is nullable (`String?`), with `tenant Tenant? @relation(...)`.
Null means platform-level (SUPER_ADMIN only).
Why: Forcing `tenantId` to be non-null would require either a fake "platform" tenant
row or attaching SUPER_ADMIN to an arbitrary real tenant — both are modeling lies for
a role that operates across tenants, not within one.
Trade-off: The schema can't enforce "non-null unless SUPER_ADMIN" — that invariant
lives in the service layer (or a future `CHECK` constraint), not the column type. A
bug in user-creation logic could produce a tenant-less COMPANY_ADMIN with nothing at
the DB level to stop it.

## D-009: User uniqueness scoped to (tenantId, email), not email alone
Date: 2026-08-18
Context: Two tenants could each have their own `support@` alias; the same person
could be a CUSTOMER in one tenant and staff in another. A global unique constraint on
`email` would incorrectly reject both.
Decision: `@@unique([tenantId, email])` on User — uniqueness scoped per tenant, not
global.
Why: Matches how login/lookup actually works (within a tenant context), and doesn't
force a single global identity across tenants for people who legitimately have
separate accounts in each.
Trade-off: Postgres treats `NULL` as distinct from itself in unique constraints, so
this does not prevent two different SUPER_ADMIN rows (`tenantId = NULL`) from sharing
an email — accepted as a low-risk gap given there are only ever a handful of super
admins. Closing it cleanly would need a partial unique index (`WHERE tenant_id IS
NULL`), which isn't expressible in `schema.prisma` directly and would require
hand-editing a migration.

## D-010: Role as a coarse enum, fine-grained permissions layered on top later
Date: 2026-08-18
Context: Need to classify users (SUPER_ADMIN, COMPANY_ADMIN, SUPPORT_USER, CUSTOMER)
now, without building the full RBAC/authorization system yet (deferred per
CLAUDE.md). The plan's Day 12 introduces a data-driven permission system.
Decision: `role` is a small, stable Prisma enum on User — an identity/tier
classification, not a permissions system. Fine-grained permissions (e.g. "can this
SUPPORT_USER close tickets") get layered on top via separate `Permission`/
`RolePermission` tables, built in the next session (Day 12), not encoded in the enum
itself.
Why: A pure enum-only approach would force every permission change into a code
change/deploy. Keeping the enum coarse and moving granular authorization into
data-driven tables avoids that, while still keeping a cheap, indexable classification
for broad gating. This is schema-only — no guards or permission-checking logic exist
yet, consistent with CLAUDE.md's RBAC deferral.
Trade-off: Until the Permission/RolePermission tables exist, the enum has no
enforcement mechanism behind it beyond whatever ad-hoc checks get written — it's a
placeholder for identity, not yet a working authorization system.

## D-011: RolePermission references the User.role enum directly, no separate Role table
Date: 2026-08-18
Context: Drafting `Permission`/`RolePermission` for data-driven RBAC (Day 12
permission system) on top of the existing `User.role` enum (SUPER_ADMIN,
COMPANY_ADMIN, SUPPORT_USER, CUSTOMER).
Decision: `RolePermission.role` reuses the same `UserRole` enum as `User.role`. No
separate `Role` table.
Why: Roles are fixed by the product, not tenant-defined — there are exactly four,
and adding a fifth is a deploy, not a tenant action. A `Role` table earns its keep
when roles need to be created/renamed at runtime or need their own metadata
(display name, ordering); neither applies here. Reusing the same enum on both
`User.role` and `RolePermission.role` constrains both columns to an identical fixed
domain, which is effectively equivalent to an FK-backed `Role` table for a closed,
code-controlled set — without the extra join on every permission check.
Trade-off: If roles ever need to become dynamic/tenant-defined, this requires an
enum-to-table migration later. That's a well-understood, deferred cost, not a
one-way door being avoided carelessly now — consistent with not building for
hypothetical future requirements.

## D-012: Permission/RolePermission are global, not tenant-scoped
Date: 2026-08-18
Context: `Permission` describes product capabilities (`ticket.assign`), not tenant
data. Roles themselves aren't tenant-scoped either — a COMPANY_ADMIN is the same
enum value in every tenant.
Decision: Neither `Permission` nor `RolePermission` carries a `tenantId`. Every
tenant shares one global permission catalog and one global role→permission mapping.
Why: Matches what the data actually represents — capabilities of the product, not
per-tenant state. Also keeps the runtime check cheap and cacheable: `PermissionGuard`
(Day 12) resolves `user.role` → `RolePermission` (via the `(role, permissionId)`
unique index) → `Permission`, a lookup that's identical for every tenant and a
natural candidate for an in-memory/Redis role→permission-keys cache later, since the
whole catalog is small and global rather than fragmented per tenant.
Trade-off: No tenant can have a customized permission set — a COMPANY_ADMIN has
identical permissions in every tenant. If per-tenant permission overrides are ever
needed, that's a separate feature (e.g. a tenant-level allow/deny override table),
not something this schema supports.

## D-013: Customer is its own model, not a User with role=CUSTOMER
Date: 2026-08-18
Context: Drafting `Customer`/`Ticket`/`TicketMessage`. Customers don't authenticate
the same way staff do (separate `/customer` routes and `/api/v1/customer/*` API
namespace already decided), and are a different relationship to a tenant — served
by it, not employed by it.
Decision: `Customer` is its own tenant-scoped model (`tenantId` required, unique on
`(tenantId, email)`), entirely separate from `User`. `Ticket.assignedUserId`
references `User` (nullable — unassigned/pre-triage tickets exist), never
`Customer` — a customer is a ticket's subject via `customerId`, not a valid
assignee.
Why: One `User` table trying to serve two incompatible auth/identity models
(staff login vs. customer access) would be worse than two separate tables. Keeping
`Customer` separate also keeps `Ticket`'s two person-references (`customerId`,
`assignedUserId`) unambiguous — each points at exactly one table, no shared
identity space to disambiguate.
Trade-off: `UserRole` already has a `CUSTOMER` enum value (from the earlier identity
draft) that is now dead — nothing will ever create a `User` row with
`role = CUSTOMER`. Left in place rather than touching the already-reviewed `User`
model as a side effect of this task; worth cleaning up later. Also, nothing at the
schema level restricts `assignedUserId` to staff roles (`SUPPORT_USER`/
`COMPANY_ADMIN`) — that check lives in the assignment service, same pattern as
D-008.

## D-014: TicketMessage — polymorphic authorId, denormalized tenantId
Date: 2026-08-18
Context: A message's author is a Customer, a User, or nothing (AI-authored).
Also, a message always belongs to a tenant-owned Ticket, so its tenant is
technically derivable via `ticket.tenantId`.
Decision: Single nullable `authorId` + `authorType` enum (`CUSTOMER`/`SUPPORT`/
`AI`) rather than separate `customerAuthorId`/`userAuthorId` columns.
`TicketMessage` also carries its own `tenantId`, denormalized from
`ticket.tenantId`, as a real `@relation` to `Tenant` (per the "every model gets a
required tenantId" rule stated for this batch of models).
Why: One author field tagged by kind is the simpler, standard shape, and avoids
spreading the same "which column is actually set" invariant across two columns
instead of one.
Trade-off: `authorId` cannot be a real `@relation` — it targets `Customer.id` or
`User.id` depending on `authorType`, and Postgres has no way to express an FK that
targets one of two different tables based on a sibling column. So there's zero
DB-level referential integrity on `authorId`; a dangling or wrong-table value is
only caught by service-layer validation at write time, not by the schema. Separately,
`tenantId` on `TicketMessage` is redundant with `ticket.tenantId` — the only index
requested for this model is `@@index([ticketId])`, not a tenant-scoped one — so the
column exists for the "always tenant-owned" invariant rather than a query pattern,
and nothing stops it from drifting out of sync with its ticket's actual tenant if a
future write path sets it independently.

## D-015: DocumentChunk.tenantId denormalized — justified by a named hot path
Date: 2026-08-18
Context: `DocumentChunk.tenantId` is technically derivable via `documentId` ->
`Document.tenantId`. Day 27's dense retrieval runs `WHERE tenant_id = X ORDER BY
embedding <-> query_embedding` directly against `document_chunks` — the most
latency-sensitive query path in the app.
Decision: Denormalize `tenantId` onto `DocumentChunk` as a real `@relation` to
`Tenant`, with `@@index([tenantId])` for the tenant-filtered vector search.
Why: Unlike D-014's `TicketMessage.tenantId` (added mechanically per a blanket
"every model gets tenantId" rule, with no query to justify it), this one has a
concrete, named hot path. Forcing every similarity search through a join to
`documents` just to filter by tenant adds cost to the single most expensive query
shape in the app, and a direct column filter combines with an `ivfflat`/`hnsw` ANN
index far more predictably than a join would.
Trade-off: Same drift risk as D-014 in principle — `tenantId` must stay in sync
with `document.tenantId` at write time, nothing in the schema enforces that — but
here the cost of *not* denormalizing (join on every vector search) is concrete and
named, not speculative, which is why this one was an easy call and D-014 wasn't.

## D-016: pgvector via Unsupported("vector(768)"), raw queries from Day 26
Date: 2026-08-18
Context: Prisma has no native vector column type. Two options: (a)
`Unsupported("vector(768)")`, invisible to Prisma Client's normal query API,
requiring `$queryRaw`/`$executeRaw` for all embedding reads/writes; (b) `Float[]`/
bytes with vector math done in application code.
Decision: `DocumentChunk.embedding` is `Unsupported("vector(768)")?`, nullable
until Day 26 ingestion populates it. All embedding writes and similarity queries
go through `$queryRaw`/`$executeRaw` starting Day 26-27. The actual `ivfflat`/
`hnsw` ANN index on `embedding` is a Day 26 TODO, added via a hand-edited raw SQL
migration — not expressible through Prisma's schema DSL, so `prisma migrate dev`
will need `--create-only` at that point so the raw SQL can be edited before it
applies.
Why: Option (b) means brute-force distance computation in Node across every chunk
row with no ANN index possible — it defeats the entire reason to use pgvector.
`Unsupported(...)` is the only option that keeps the real Postgres `vector` type
and its indexing.
Trade-off: The `768` dimension is taken from the task's stated default (Gemini
text-embedding), not independently verified against whatever model actually gets
wired up on Day 26. `vector(N)`'s dimension is fixed per-column — if it's wrong,
fixing it later means a real migration *and* re-embedding every existing chunk, not
a schema tweak. Needs re-confirming before Day 26, not treated as settled by this
draft.

## D-017: AuditLog.tenantId is nullable; actorId has no relation
Date: 2026-08-18
Context: Every domain model in this group requires `tenantId` except `AuditLog`.
Platform-level actions (SUPER_ADMIN creating/suspending a company) have no tenant
context; tenant-scoped actions (approval granted, ticket reassigned) do.
Decision: `AuditLog.tenantId` is nullable, with an optional `@relation` to
`Tenant`. `AuditLog.actorId` is a bare, unconstrained `String?` — no `@relation` to
`User`, unlike `Approval.resolvedById`.
Why: This is the same reasoning as `User.tenantId` in D-008, applied to a new
model — not a new kind of exception, the second instance of the same one.
`actorId` is left unconstrained deliberately: an audit trail should survive even if
the referenced user is later deleted, and some entries are system-generated with no
real `User` row to point at (cron jobs, service actions).
Trade-off: No DB-level referential integrity on `actorId` — a stale or invalid
value is only caught by whatever writes audit entries, not by the schema. This is
consistent with the polymorphic-field pattern already accepted in D-014
(`TicketMessage.authorId`), just for a different reason (durability of the log vs.
"points at one of two tables").

## D-018: Approval.requestedById — polymorphic, no FK, nullable
Date: 2026-08-18
Context: An approval can be requested by an AI run or a human user. Both cases have
a concrete row to reference (a specific `AiRun` or `User`), unlike
`TicketMessage.authorId` (D-014) where the AI case has no row at all.
Decision: `requestedByType` (`AI`/`USER`) + nullable `requestedById`, no `@relation`
enforced — same shape as `TicketMessage.authorId`.
Why: Consistent with the polymorphic-association pattern already established, and
avoids two nullable FK columns that would still need the same "which one matches
requestedByType" invariant enforced at the service layer, just spread across two
columns instead of one.
Trade-off: Same referential-integrity gap as D-014 — `requestedById` isn't checked
against `User`/`AiRun` by the schema. Worth being precise that nullability here
isn't structurally forced the way it was in D-014 (both requester types *do* have a
row to point at) — it was kept nullable as a pragmatic allowance for an
unconstrained field, not because one case has nothing to reference.

## D-019: Decimal, never Float, for money-adjacent fields
Date: 2026-08-18
Context: `AiRun.cost`, `Payment.amount`, `Order.totalAmount`, and `Approval.amount`
all store money-adjacent values.
Decision: All four are `Decimal`, mapping to Postgres `numeric`.
Why: `Float` is binary floating point and cannot represent most decimal fractions
exactly; repeated arithmetic (summing payments, computing totals) accumulates
rounding error. `Decimal`/`numeric` is exact.
Trade-off: Prisma's `Decimal` is backed by `decimal.js` at runtime
(`Prisma.Decimal`), not a native JS `number` — application code must use `Decimal`'s
own arithmetic methods, not cast to `number` first, or the exactness gained here is
thrown away at the first calculation. This is a discipline requirement on every
future service that touches these fields, not something the schema can enforce by
itself.

## D-020: ivfflat chosen over hnsw for the embedding index
Date: 2026-08-18
Context: Applying the initial migration, including the `document_chunks.embedding`
ANN index (added by hand, per D-016 — not expressible via Prisma's schema DSL).
Decision: `CREATE INDEX document_chunks_embedding_idx ON document_chunks USING
ivfflat (embedding vector_cosine_ops) WITH (lists = 100);`
Why: ivfflat is simpler to reason about at this stage and cheaper to build than
hnsw. The real caveat: ivfflat's index quality depends on the data present *at
build time* — it clusters vectors into `lists` partitions based on whatever rows
exist when the index is created. Built now, against an empty table, it will be
low-quality (effectively meaningless clustering) once real embeddings start
landing Day 26.
Trade-off: This index **must be `REINDEX`ed after the first real ingestion batch**
(or dropped and recreated) once there's actual data to cluster on — otherwise
retrieval quality/recall silently degrades without any error. This isn't optional
maintenance, it's a required step in the Day 26 ingestion work, not something this
migration can do for you since there's no data yet.

## D-021: vector_cosine_ops as the operator class
Date: 2026-08-18
Context: pgvector supports multiple distance operators/operator classes
(`vector_l2_ops` for Euclidean `<->`, `vector_cosine_ops` for cosine `<=>`,
`vector_ip_ops` for inner product `<#>`), and an ANN index is built against
exactly one of them.
Decision: `vector_cosine_ops`, matching the `<=>` (cosine distance) operator.
Why: Cosine distance is the standard choice for text-embedding similarity search,
where vector magnitude is generally not meaningful — only direction/orientation is.
Trade-off, stated as plainly as possible because getting this wrong is silent, not
loud: **Day 27's retrieval query MUST use the `<=>` operator to match this index.**
If a query uses `<->` (L2) or `<#>` (inner product) instead, Postgres will not
raise an error — it will simply not use this index at all and fall back to a full
sequential scan, computing the (wrong) distance metric on every row. There is no
warning, no exception, just a silently slow and semantically-mismatched query. This
is the single most likely way Day 27's retrieval implementation could quietly
underperform without anyone noticing until data volume makes the full scan
painfully slow.

## D-022: Category as a self-referencing tree, not fixed Category/Type/Item tables
Date: 2026-08-18
Context: Drafting CTI (Category/Type/Item) ticket-classification tables. Two shapes
considered: one self-referencing `Category` model with a nullable `parentId`, or
three explicit tables (`Category` → `Type` → `Item`) each FK'd to the level above.
Decision: Single self-referencing `Category` model (`tenantId`, `parentId`, `name`).
"3 levels" is a naming convention, not a schema constraint — nothing stops a
4-level or 2-level branch.
Why: Chosen over three explicit tables for flexibility — one model handles any
depth without a schema change, and avoids three near-identical tables differing
only in which parent FK they carry.
Trade-off: The exact-3-levels expectation implied by "CTI" isn't enforced anywhere
— a bug or bad data entry could produce a 5-level-deep branch or a category with no
tenant-consistent depth, and the schema won't catch it. Also left unresolved: no
uniqueness constraint on `Category.name` (unique per tenant? per sibling? not
enforced at all?), and no link yet from `Ticket` to this model — `Ticket.category`
stays a free-text field for now, since deciding how the two relate means touching
an already-migrated model, not something to do silently as part of adding a new
one.

## D-023: KnowledgeArticle is a standalone model, not built on Document/DocumentChunk
Date: 2026-08-18
Context: Drafting knowledge-base article storage. Two shapes considered: a
standalone `KnowledgeArticle` model (title/body/status), or reusing the existing
`Document`/`DocumentChunk` RAG pipeline (D-015/D-016) with a field distinguishing
KB-authored content from uploads.
Decision: Standalone `KnowledgeArticle` (tenant-scoped, `categoryId` → `Category`,
`authorId` → `User`, `title`, `body`, `status`).
Why: `Document`'s current shape (`filename`, `mimeType`, `sizeBytes`,
`uploadedById`) is upload-shaped, not article-shaped — reusing it would mean either
faking those fields for hand-authored content or reworking `Document` itself.
Standalone keeps KB authoring simple and separate from the file-upload path.
Trade-off, the significant one: this creates **no RAG-indexing path** for KB
content. `DocumentChunk.embedding` (D-016) only exists for `Document`-sourced
content — if KB articles are meant to power AI Copilot answers via retrieval,
something will eventually need to make `KnowledgeArticle` content
vector-searchable (a parallel `embedding` column, chunking into
`DocumentChunk`-shaped rows, or another approach), which means re-deriving some or
all of D-016's pgvector setup for a second table. Not solved here — flagged as a
known gap, not an oversight.

## D-024: TenantSettings — one row per tenant, starter field set
Date: 2026-08-18
Context: Drafting tenant-level configuration. Considered tenant-level config vs.
per-user notification preferences vs. both; tenant-level config only was chosen.
Decision: `TenantSettings` — one row per tenant (`tenantId` unique), holding
`businessHours`, `branding`, `featureFlags` (all `Json?`) and `defaultSlaHours`
(`Int?`).
Why: A single settings row per tenant is the simplest shape for org-wide config,
and `Json?` columns avoid a schema migration for every new setting while still
naming the obvious, known categories explicitly rather than burying everything in
one opaque blob.
Trade-off: This field list is a best guess at what a support platform needs first,
not confirmed against a spec — no plan document exists in this repo to check
against. Expect this table to grow (new columns, or fields moving out of the `Json`
blobs into real typed columns) as actual settings requirements show up. Per-user
notification preferences were explicitly not built here — if that's needed later,
it's a separate model, not something this table covers.

## D-025: Notification — polymorphic target, User-only, data-driven type
Date: 2026-08-18
Context: Drafting in-app notifications. Needed a way to reference what a
notification is about (a ticket, an approval, etc.) without a new relation for
every notification-worthy entity.
Decision: `targetType`/`targetId` are a bare, unconstrained, nullable pair — same
pattern as `AuditLog` (D-017). `userId` is a real, required `@relation` to `User`
only (no `Customer` recipients). `type` is a `String`, not an enum. `readAt` is a
nullable `DateTime`, not a `read: Boolean`, and there is no `updatedAt`.
Why: The polymorphic target avoids a new nullable FK column every time a new
notification-worthy entity is added, consistent with the trade-off already accepted
for `AuditLog`. `type` as a `String` follows `Permission.key`'s precedent
(D-010/D-012) — a data-driven catalog that grows without a schema migration per
trigger. `readAt` follows the same nullable-timestamp-as-state idiom already used
for `UserSession.revokedAt`/`Approval.resolvedAt`, and skipping `updatedAt` follows
the same reasoning as `UserSession` (D-014) — `readAt` is the one mutation that
matters.
Trade-off: No DB-level referential integrity on `targetType`/`targetId`, same gap
as `AuditLog`. More significant: this model only covers staff-facing, in-app
notifications. Customer-facing notifications ("your ticket was resolved") aren't
modeled at all — not asked for, deliberately scoped out rather than guessed at, so
that's still open if/when it's needed.

## D-026: Impersonation is a stateless token claim, not a stacked/DB-tracked session
Date: 2026-08-18
Context: SUPER_ADMIN needs to "become" a company's admin to see the product from
their point of view. Two shapes considered: (a) a new DB-tracked concept — an
`ImpersonationSession` row (or new `UserSession` columns) linking an active
impersonation back to the initiating SUPER_ADMIN, letting the server look up "is
this session an impersonation, and by whom" independent of the token; (b) carry the
originating SUPER_ADMIN's id as an optional claim (`impersonatorId`) directly on the
access/refresh token payloads, alongside a completely ordinary `UserSession` row for
the impersonated user — no new columns, no link back to the SUPER_ADMIN's original
session at the DB level.
Decision: (b). `AccessTokenPayload`/`RefreshTokenPayload` both gain an optional
`impersonatorId`. Starting impersonation revokes the SUPER_ADMIN's *current* session
(same rotate-on-use idiom `AuthService.refresh()` already uses) and mints a brand
new `UserSession` + token pair for the target company admin, with `impersonatorId`
set to the SUPER_ADMIN's user id. Stopping impersonation revokes that session and
mints the SUPER_ADMIN a *brand new* session — it does not attempt to resurrect the
one that was revoked when impersonation started. `JwtStrategy.validate()` surfaces
this as `impersonatedBy: { userId, companyId, companyName } | null` on
`AuthenticatedUser`, computed fresh from the token claim plus the (already-fetched)
target user's tenant relation — never persisted as its own column.
Why: The token already is the source of truth for "who is this request authenticated
as" (see `AccessTokenPayload`'s existing "no permissions in the token" note) —
adding one more optional claim to that same self-contained payload is a small,
symmetric extension. A DB-tracked stacked-session model would let a SUPER_ADMIN
resume their *exact* prior session on exit and would give session-management UI a
way to show "impersonation in progress" independent of which token happens to be in
hand, but neither is asked for here, and both add real schema/session-lifecycle
surface area for a feature whose actual requirement is narrower: start, act as,
stop, land back on the company page.
Trade-off: The SUPER_ADMIN's pre-impersonation session is gone (revoked), not
paused — exiting impersonation is indistinguishable, session-wise, from a fresh
login as that SUPER_ADMIN. Their existing session-list UI (already built) will show
it as a new entry, not a resumed one. There is also no DB-level way to answer "list
every session that is currently an impersonation" or "force-end all impersonation
sessions right now" without decoding live tokens — only per-user session
revocation (already built) reaches an impersonation session, same as any other.
Acceptable for a single-admin-in-practice learning project; would need revisiting
(probably option (a)) if impersonation ever needed platform-wide visibility or
audit beyond the `AuditLog` rows written on start/stop.
Also decided in the same pass: impersonation targets are always a company's
existing primary `COMPANY_ADMIN` (the same lookup `CompaniesService.getCompany()`
already uses for its `admin` field) — there is no per-user impersonation target
picker — and a `SUSPENDED` company's admin cannot be impersonated, enforced
server-side (`ConflictException`) independent of the frontend's disabled button,
since a suspended tenant's users are supposed to be locked out entirely
(`CompaniesService.suspendCompany()` already revokes their sessions and blocks
their login).

## D-027: Company Admin can create/manage Support Users only
Date: 2026-08-18
Context: Day 14 user management lets a `COMPANY_ADMIN` provision staff within
their own tenant. `CreateCompanyDto`'s admin-creation path (D-006-era, Day 6)
already covers how a *company's first* `COMPANY_ADMIN` gets created — by a
`SUPER_ADMIN`, not by another `COMPANY_ADMIN`. Without a deliberate boundary, a
generic "create a user" endpoint would let a `COMPANY_ADMIN` mint another
`COMPANY_ADMIN` in their own tenant, or (worse, if tenant scoping were ever
loosened) in someone else's.
Decision: `UsersModule` (`backend/src/company/users/`) only ever creates, lists,
deactivates, and reactivates `SUPPORT_USER` rows. The role isn't a field on
`CreateUserDto` at all — `UsersService.createUser` hardcodes `role: 'SUPPORT_USER'`
server-side, so there's no payload shape that could request anything else. Every
other endpoint (list/deactivate/activate) filters by `{ tenantId, role:
'SUPPORT_USER' }` too, not just create, so the boundary holds even for operations
on existing rows, not only new ones. `COMPANY_ADMIN` provisioning stays exclusive
to `CompaniesService.createCompany()`'s `SUPER_ADMIN`-only path.
Why: Closing this off by construction (no role field to validate) is stronger than
closing it by validation (reject `role: 'COMPANY_ADMIN'` if sent) — there's no
value to reject in the first place, so a future refactor can't accidentally loosen
a check and reopen the privilege-escalation path.
Trade-off: If a tenant ever legitimately needs a second `COMPANY_ADMIN` (co-admins),
this module can't create one — that would need a deliberate new endpoint (probably
`SUPER_ADMIN`-only, mirroring company creation) rather than a relaxed role field
here.

## D-028: User deactivation revokes sessions, same as company suspension
Date: 2026-08-18
Context: Day 14's deactivate action needed to decide whether "deactivated" means
"can't log in again" or "is locked out right now." Day 7's `suspendCompany()`
already answered this question at the tenant level: it revokes every active
`UserSession` for the tenant so a suspended company's staff are locked out
immediately, not just on their next login attempt.
Decision: `UsersService.deactivateUser()` follows the identical pattern at the
single-user level — sets `status: INACTIVE` and revokes every active session for
that one user, in the same transaction, idempotent (deactivating an
already-inactive user is a no-op 200). `activateUser()` is the symmetric
reactivation and does not restore sessions (a fresh login is required either way).
Why: Consistency — a Company Admin reading "deactivate" should get the same
lockout guarantee a Super Admin's "suspend" already provides, not a weaker
next-login-only version. Reusing the established pattern also means no new
decision about *how* to revoke was needed here.
Trade-off: None beyond what D-007 already accepted — unlike the tenant-suspension
case, there's no separate "still-valid access token" gap to trade off here, because
`JwtStrategy.validate()` already re-fetches the user and checks `status !==
'ACTIVE'` live on *every* authenticated request (not just on refresh), for any
user, tenant-suspended or not. Deactivation is therefore effective on the very
next request, not just the next refresh; revoking sessions on top of that is about
closing the refresh-token path and keeping the sessions list honest, the same
scope `revokeAllOtherSessions` already has, not about closing a token-TTL window
that doesn't exist here.