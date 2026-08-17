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