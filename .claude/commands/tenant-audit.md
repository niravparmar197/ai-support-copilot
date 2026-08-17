---
description: Invoke the tenant-auditor agent to check every new Prisma query filters by tenant
---

Invoke the `tenant-auditor` agent (see `.claude/agents/tenant-auditor.md`)
to check every new or changed Prisma query in the current diff (uncommitted
changes if any exist, otherwise the last commit) for a `tenant_id` /
`tenantId` filter. Report its findings back to the user; don't apply any
fixes yourself unless asked.

Note: this only matters once multi-tenancy isolation actually exists in the
schema/queries (see CLAUDE.md — multi-tenancy isolation is explicitly not
implemented yet). Until then this command should just report that there's
nothing tenant-scoped to audit.
