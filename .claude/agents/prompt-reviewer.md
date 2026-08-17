---
name: prompt-reviewer
description: STUB - reviews prompts/system messages used by the AI service and agents for quality and injection resistance. Real logic lands Day 51+. Do not implement prompt injection defenses to make this work.
tools: Read, Grep, Glob, Bash
---

**Stub agent.** Prompt injection defenses and the broader prompt-review
workflow are explicitly deferred in this repo (see CLAUDE.md) until
Day 51+, once there's enough of the AI service/agent layer to review.

If invoked before then, say so plainly and stop — don't fabricate a review,
and don't implement injection-defense logic just to have something to
review. Point to `.claude/experiments/` as where real notes will land once
this is built.
