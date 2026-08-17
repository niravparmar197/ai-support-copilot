---
description: Implement a feature end-to-end (backend -> frontend -> tests), plan-first
argument-hint: <feature-name>
---

Implement the feature: **$ARGUMENTS**

Read `CLAUDE.md` and `DECISIONS.md` first — they define conventions and the
"do not implement without explicit instruction" boundaries (auth internals,
multi-tenancy isolation, RBAC logic, RAG retrieval, tool authorization,
LangGraph orchestration, prompt injection defenses). If this feature requires
any of those as a prerequisite, stop and say so instead of building it.

1. Find the relevant phase/day for "$ARGUMENTS" in the project plan document.
   Look for `PLAN.md` or `docs/PLAN.md` at the repo root; if neither exists,
   ask the user where the plan document lives before continuing.
2. Propose a short implementation plan: what changes in `backend/`, what
   changes in `frontend/`, what tests get added, and any `DECISIONS.md`
   entries the plan requires (per CLAUDE.md, architectural decisions get
   documented before the code is written). Keep it short — a punch list, not
   an essay.
3. Wait for the user to confirm the plan before writing any code.
4. Once confirmed, implement in this order: backend, then frontend, then
   tests. Follow the Backend/Frontend/Testing Conventions sections in
   `CLAUDE.md`.
5. Show a diff summary and do not commit unless explicitly asked to.
