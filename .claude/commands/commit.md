---
description: Stage changes, show a diff summary, propose a commit message, and wait for confirmation
---

1. Run `git status` and `git diff` (staged + unstaged) to see everything
   that's changed.
2. Stage the relevant files (ask before including anything that looks like
   it might not belong — build artifacts, `.env`, unrelated changes).
3. Show a concise diff summary: what changed and why, not a restated diff.
4. Propose a commit message following the convention in `CLAUDE.md`:
   Conventional Commits, scoped by service (`feat(backend): …`,
   `fix(frontend): …`, etc.; no scope only for repo-wide changes).
5. Wait for the user to confirm before running `git commit`. Never commit
   without that confirmation, and never push unless separately asked.
