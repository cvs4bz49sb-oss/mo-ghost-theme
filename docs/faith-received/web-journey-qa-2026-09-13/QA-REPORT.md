# Following sources and reception: workflow audit

This pass followed actual branches in the citation Web. It checks navigation and reading continuity, not every graph attribution or the full site.

## Reproduced failures

From Jansen’s Sources view, filtering to Augustine, reading reference page 2, following Augustine’s sources and using browser Back cleared the author filter, returned the references to page 1, and set the panel scroll to zero. A deeper reception path also lost the open state of earlier evidence steps even though a selected passage remained selected.

## Repairs

The current path is visible as linked author names. Sources and Reception are direct controls, and the context sentence explains the direction in terms of recorded works and references. It does not infer that every reference reflects the named author’s own reading or agreement.

Up to twelve recent journey views retain their author filter, connection page, open connection, open history/evidence steps, per-work reference pages, citation filters, preview openness and panel scroll position. These are session-local view snapshots; they are not durable server jobs and do not promise survival after a full page reload. Source and reception branches have separate identities. Directed paths normalize redundant edge keys so browser Back can find the same view after a URL round trip. Both-direction paths retain the actual directed edges.

The citation component exposes a scoped view snapshot. State from one citing/cited pair is never applied to its reverse or another connection. Old listeners and detached citation controllers are released when leaving or replacing a view. Restoration waits for the required open evidence views to render. A repeated-author route returns to the original occurrence instead of an unrelated later prefix.

## Browser workflows

- **Jansen → Augustine:** reference page 2 retained its first record (3987), the Augustine author filter and the open connection after returning. Previously record 3982/page 1 appeared and the filter was empty.
- **Sources ↔ Reception:** Sources restored Augustine/page 2. Reception separately restored Voetius and the recorded relation filter “refutes,” returning 412 available records. The displayed evidence correctly said “Gisbertus Voetius cites Cornelius Jansen.”
- **Jansen → Voetius → Calov:** in Reception, the next connection correctly said “Abraham Calov cites Gisbertus Voetius.” The path trail showed the user’s traversal order. Returning from Calov restored the open history, the earlier Voetius/Jansen evidence on reference page 2 (first record 20), one selected source passage, the open Calov connection and a nonzero panel scroll (3038px in the final test).
- Mobile width 390 and desktop width 1280 were inspected. The restored branch had no horizontal overflow, and theme switching kept the open evidence state. Selection tests did not save new Notebook items.

The focused suite passed 30 checks across journey state, citation evidence and directed path behavior. The canonical build passed its secret and page gates. `deep-reception-proof.json` and the screenshots record the deeper workflow. The branch snapshots preserve provided source identifiers and citation direction; no corpus, API or auth files were edited.

Deployed as `dpl_5tSibx6tvcRXCQpg76Zzq77Ypoif` via the protected deployment script. All three changed output files matched the production alias byte-for-byte; see `alias-proof.json`. The complete mobile/site audit and native MereO integration remain separate, unfinished work. No paid model investigation or online Claude artifact publication occurred in this pass.

Live acceptance at 390px reproduced the source workflow on the production alias: Back retained the Augustine filter, open connection, reference page 2, first record 3987 and the panel’s 56.5px departure scroll position. See `live-proof.json`.
