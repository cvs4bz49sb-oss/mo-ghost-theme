# Web connection investigation · 14 September 2026

Scope: the Athanasius of Alexandria → Thomas Aquinas research path in Both directions, opening Gabriel Vásquez’s references. This is a focused Web/evidence audit, not completion of the paused full-site backend/frontend audit.

## Findings and repairs

- At 1024×1044, long work headings broke away from their disclosure marker. Four of the six Vásquez headers measured 126 px high. Shared grid headers keep the marker beside the title and place the reference count below. The same four headers now measure 87 px; the two shorter headers dropped from 72 to 64 px. Full titles and all six separate volumes remain available.
- Both directions had no selected quick control. It now has an explicit button alongside Sources and Reception. A visible latest-step sentence names the actual citing author. On this route Thomas Aquinas cites Athanasius; on continuing, Gabriel Vásquez cites Thomas Aquinas. Traversal order is not attribution or proof of doctrinal agreement.
- Fresh path-finder results cached mixed paths before resolving their edge directions. The URL included those directions, so returning could miss the cache. Cache identities and prefix links now use the resolved citation steps.
- A live Vásquez record at source p. 9 states `1.2.q.81.art.3` but its resolver target is labelled `Summa Theologica I-II, q. 1-70`. A narrow display guard flags explicit contradictions between a single Summa question and a held volume’s stated part/range. The conflicting target link is withheld; Open source remains. No replacement link or citation is inferred. Corpus and resolver records remain unchanged. This guard is not a comprehensive validation of all target links.

## Browser verification

Used the in-app browser with live published data, then the rebuilt local preview at localhost:8916. Verified desktop 1024×1044 and phone 390×844, both light and dark. Temporary QA tabs were separate from the user’s tab.

- Submitted Athanasius of Alexandria → Thomas Aquinas in the actual path finder. It found the recorded Aquinas → Athanasius citation.
- Filtered `Vasquez` without the accent: exactly one connected-author match. A deliberately unmatched query displayed zero connections and an intelligible empty state.
- Opened the Third Part, Tomus II: 395 records, 79 pages of five. All six work groups remained, totaling 3,681 indexed records. Those are records, not a claim of 3,681 unique passages; repeated references can appear on the same source page.
- Advanced to reference page 2 (6–10), followed Vásquez, and used browser Back. The Vasquez query, selected connection, open work and page 2 were restored. Note: activating Continue moves focus/scroll to that button before capturing the leaving view; restoration uses that leaving position.
- Opened the actual source URL `/read?w=vasquez-in-tertiam-partem-s-thomae-tomus-ii#b6-0` on production. The reader displayed Tomus II, p. 6 and the matching paragraph beginning “I have attentively examined and willingly read the illustrious Commentaries…”.
- On phone, opened the p. 9 inline preview. It displayed the English reader at Question XXVII. The preview’s recorded URL retained `#b9-0`. The tool could not inspect the iframe’s document directly; the rendered preview and URL were observed, not represented as a DOM anchor assertion.
- Confirmed the three p. 9 question-81 records visibly flag the volume-range conflict and contain no target link. Their citing-source links remain.
- Switched Sources and returned with browser Back. Both directions and the original mixed path were restored.
- No document horizontal overflow at either width. The panel is the vertical scroller; nested author and evidence lists use visible overflow with bounded pagination. No browser error logs in the final mobile check.

## Automated verification

`node --test tools/prdl_reader_prototype/connection-evidence.test.cjs tools/prdl_reader_prototype/journey-state.test.cjs tools/prdl_reader_prototype/constellations.test.cjs`: 34 tests passed. Includes explicit conflicting/valid/ambiguous question ranges, opaque citation anchors, bidirectional edges, bounded pages and actual path-finder cache/URL equivalence. Build secrets and page parsing gates passed.

## Changed sources

`tools/prdl_reader_prototype/web_shell.html`, `connection-evidence.js`, `connection-evidence.css`, `constellations.css`; regression tests in `connection-evidence.test.cjs` and `journey-state.test.cjs`. No API, corpus, resolver, or reader-pairing changes.

## Limitations

The published graph contains indexed citations, including mentions, commentary front matter and other voices. It does not independently verify authorship, quotations, historical transmission, or doctrinal agreement. This work does not repair the underlying resolver’s question-81 mismatch or deduplicate corpus records. Native MereO integration and online artifact publication remain separate from the Vercel release. See release-proof.json for production byte verification.

## Release

Production deployment `dpl_HBreTcfSvNczsGqDNUfs4Dmes891` completed through `bash tools/deploy_site.sh`. Redirect-following, cache-busted reads of the alias matched MD5 for web.html, connection-evidence.js, connection-evidence.css and constellations.css. The new phone-width production tab confirmed Both directions selected, correct latest citation direction, grid work headings and the target-conflict messages.
