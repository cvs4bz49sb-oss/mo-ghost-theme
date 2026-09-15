# Audit status

The full end-to-end backend and frontend audit is not complete. The delivered backend work is a source/contract review, supported by synthetic probes and limited public HTTP checks. The delivered frontend work is a source inventory and selected browser workflow checks, followed by targeted mobile fixes. These are useful checkpoints, not complete port certification.

## Delivered

- `BACKEND-AUDIT.md`: 13 source-backed gaps, a per-surface backend/data contract map, and clearly marked limits.
- Private worker PR 4: `audits/public-port-2026-09-13/`, including full 42-file Vercel reference closure, Cloudflare adaptation instructions, source hashes and five diagnostic probes. Runtime deployment/version, full data reconciliation and authenticated acceptance are still open.
- Theme PR 11: source references, mobile repair patches, before/after screenshots, artifact-update instructions and Vercel release evidence. MereO runtime integration is not implied.
- Theme PR 12: native legacy Ask question persistence code, awaiting maintainer path approval/integration.
- Current reader scrolling repair: `.impeccable/review/toc-scroll-20260913/`. Browser-tested on eebo-33684 and pld-212 at phone/desktop/landscape sizes. Deployment dpl_5AFmTF8qyoeMwniyJwrUXMGK9co1, four reader assets hash-verified. Live scroll moved the TOC without moving underlying text and kept the opaque header against the work header.
- Fresh MereO public landing inspection and desktop screenshot started with the restored in-app browser. This is not the full frontend pass.

## Still outstanding

The complete Vercel/MereO comparison must cover landing, every shelf and its work protocol, all reader variants, search modes, Ask/Deep and linked-provider fallback, authors/work rooms, Scripture ranges and quotes, Topics, Web/Constellations, Compare, Desk, Notebook/import/export/share, Dictionary, legacy routes, errors and access states. It needs mobile and desktop interaction evidence, not only screenshots of initial shells. Gated/member and durable-job tests must use an authorized account; no private-user job enumeration or ungated paid service is allowed.

The online Claude artifact was not inspected or republished because the parked tab was blocked by browser URL policy. The supplied HANDOFF_PACK is the dated artifact reference; existing-address update instructions were supplied. Do not claim its online contents are current.

The earlier hourly automation is paused following automatic approval review. No unattended auditing or future deployments are running under it.

## Locations

Backend: https://github.com/cvs4bz49sb-oss/mo-workers/pull/4
Theme handoff: https://github.com/cvs4bz49sb-oss/mo-ghost-theme/pull/11
Native Ask repair: https://github.com/cvs4bz49sb-oss/mo-ghost-theme/pull/12
