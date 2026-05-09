---
description: Run the security agent against the currently staged changes. Returns PASS, PATCH, or FLAG. Required before every commit per SECURITY-AGENT.md.
---

Invoke the `security-agent` subagent with the prompt:

> Review the currently staged diff in this repo against SECURITY-AGENT.md (in the MOCA root). Run mechanical checks first (`node scripts/security-precommit.mjs` if present, plus `npm run lint` and `npm run build:digest:check`). Then walk §3b LLM judgment questions and §6 knowledge-base entries against the diff. Output PASS, PATCH (with the patches applied), or FLAG using the §5 shape. If you encounter a new pattern §6 doesn't cover, append a 6.X entry following §7 before passing.

The agent reads its constitution from `/Users/ianharber/Dropbox/Mac (2)/Documents/Mere Orthodoxy Claude Agent/SECURITY-AGENT.md` and runs through:

1. Mechanical checks via `scripts/security-precommit.mjs`
2. LLM-driven review against §3b questions
3. Pattern match against §6 lessons

Result is one of:
- **PASS**: commit proceeds.
- **PATCH**: agent applied auto-patches; review them then commit.
- **FLAG**: commit should NOT proceed without addressing the flag (or adding `SECURITY-OVERRIDE: <reason>` to the commit message).
