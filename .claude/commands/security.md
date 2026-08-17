---
description: Invoke the security-reviewer agent against the current diff
---

Invoke the `security-reviewer` agent (see
`.claude/agents/security-reviewer.md`) against the current diff (uncommitted
changes if any exist, otherwise the last commit). Report its findings back
to the user; don't apply any fixes yourself unless asked.
