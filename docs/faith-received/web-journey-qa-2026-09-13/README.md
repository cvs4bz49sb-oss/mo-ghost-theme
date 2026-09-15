# Sources and reception journey continuity

This package extends the mobile workflow repairs with actual multi-step journey verification. It contains complete changed sources, a patch, focused tests, screenshots and the QA report. Use release proof to distinguish the Vercel reference from pending native MereO integration.

## Integration

Merge the Web journey state/capture changes from `web_shell.html.txt`, scoped citation view snapshots and path helpers from `connection-evidence.js.txt`, and the compact path/direction controls from `constellations.css.txt`. Preserve the existing common citation renderer, source identifiers, saves and pagination.

The component snapshot must preserve citation filters, work/reference pages, open work groups and preview state. Match snapshots to the exact citing/cited pair. The journey snapshot additionally preserves the author filter, connection page, current open connection, earlier open evidence steps, selection and panel scroll. Source/reception modes and work scopes are distinct views. Normalize redundant edge keys for directed routes; preserve edge direction for mixed routes.

Capture before replacing a view and restore after the required open evidence mounts. Abort old listeners and release detached controllers. Retain at most twelve recent view snapshots. This is browser-session continuity, not durable server work or a promise to restore after a full reload.

Use native Ghost route prefixes and the existing Cloudflare adapters. Do not introduce a Vercel dependency, change corpus data, or use an ungated staging worker. Build and commit native theme assets through the existing runbook after adapting the code.

## Acceptance

1. Open Jansen’s Sources, filter Augustine, go to reference page 2, follow Augustine’s sources and press Back. Keep the query, open connection, page and reading position.
2. Switch to Reception, filter Voetius and select the recorded “refutes” relation. Switch away and back. Keep these filters separately from the Sources branch. The evidence must read Voetius cites Jansen.
3. Follow reception onward to Calov. Open and select a passage from the earlier Voetius/Jansen step, then continue and return. Keep that evidence step open on its reference page with the selection intact. Calov cites Voetius; do not reverse this attribution because of the user’s traversal direction.
4. Check phone and desktop widths, both themes, browser Back, breadcrumbs, recent branches and an empty filter. Run the supplied journey-state tests plus the existing citation/path suites.

## Existing artifact

Add the dated workflow proof to the existing Web/path sections and change log. Preserve the artifact address, IDs and numbering. Follow the existing HANDOFF_PACK workflow: edit `hub-skeleton.html`, add chosen figures, run `python3 rebuild.py`, and publish `hub.html` to the established address only. Describe reference deployment only when release proof exists. Keep native integration, online artifact publication and complete-site audit status distinct.
