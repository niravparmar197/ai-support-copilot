---
description: Print the scope of a given day/phase from the project plan document
argument-hint: <n>
---

Print the scope of phase/day **$ARGUMENTS** from the project plan document.

Look for `PLAN.md` or `docs/PLAN.md` at the repo root; if neither exists,
ask the user where the plan document lives instead of guessing.

Once found, extract and print just that phase's scope: what gets built,
what's explicitly out of scope, and any prerequisites. Don't summarize the
whole plan — the point of this command is keeping the current session
bounded to one phase.
