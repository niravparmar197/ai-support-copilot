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