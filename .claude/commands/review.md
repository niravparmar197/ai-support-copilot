---
description: Invoke the code-reviewer agent against the current diff
---

Invoke the `code-reviewer` agent (see `.claude/agents/code-reviewer.md`)
against the current diff (uncommitted changes if any exist, otherwise the
last commit). Pass it enough context to know what changed and why — don't
just hand it a raw diff with no framing. Report its findings back to the
user; don't apply any fixes yourself unless asked.
