---
description: Run the test suite for whichever service was last touched and summarize failures
---

Determine which service was most recently touched (check `git status` and
`git diff` for uncommitted changes first; fall back to the most recent
commit's changed paths if the working tree is clean).

Run that service's test suite:
- `backend/`: `npm test` (unit) — mention `npm run test:e2e` separately if
  backend routes/controllers changed
- `frontend/`: `npm test` (or the configured RTL test script)
- `ai-service/` / `mcp-server/` / `worker/`: use that service's own test
  command once it exists; note if it doesn't exist yet

Summarize results concisely: pass/fail counts, and for each failure the
test name, the assertion that failed, and the file/line. Don't dump full
raw test output — extract what's actionable. If everything passes, say so
in one line.
