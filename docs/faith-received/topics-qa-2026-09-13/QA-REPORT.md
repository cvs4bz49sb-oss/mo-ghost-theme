# God topic: scrolling and evidence QA

The report covers `/topics#god` and the shared topic-page UI. It is not a full-site audit or a corpus correction.

## Findings

The shelf author list and each author’s statement list both owned vertical scroll areas. Nested work/section frames further narrowed the phone reading measure. Loading indexed passages fetched every remaining author record and repeatedly replaced the result DOM. Open work folds and reading position could be lost. Counts mixed the initially sampled excerpts with the full indexed totals.

The dated God evidence manifest records 279,722 positions on 103,746 indexed pages. Baxter has 3,912 positions in 123 works; Method of Christian Theology has 622. A direct, scoped evidence request returned 50 records and the correct total of 622. The first two source locations are pages 9 and 10.

The first displayed sentence was checked against the published page 9 text. It is a faithful condensation of the Creator/order passage, not a verbatim quotation. `data-proof.json` records the source and extracted statement separately. No corpus record was edited.

## Changes

Each expanded shelf has one bounded scroll region. Authors are shown on fixed pages of eight; statement pages contain at most twenty records. Topic evidence no longer creates a second scrolling region within the author or a further section-fold hierarchy within each statement page. The shared work/statement renderer is retained, and work/edition order is preserved.

The Work selector is populated from the snapshot’s actual author/work ledger, so an indexed work can be selected before loading unrelated works. Requests load fifty positions by default. Loading all positions is an explicit action with Stop loading; comparisons initially request only a bounded page. A stopped request may finish the one page already in flight. Repeated/nonadvancing cursors, source/scope changes and inconsistent totals stop the walk while preserving earlier records.

Open author/work state and scroll position are captured before asynchronous redraws. Late outline metadata no longer triggers topic-wide redraws. More records do not automatically advance the current statement page. Counts distinguish the loaded or preview selection from the indexed total. Each statement is visibly labelled Extracted statement; source links and previews use the recorded page rather than asking the reader to highlight summary wording as a quote.

## Verification

The focused suite passed 44 checks across topic evidence, shared research helpers, folds, comparison and volume order. The canonical build passed the page and secret gates.

A local browser preview served the built sources and forwarded only public `/api/evidence` GET requests to the existing live endpoint. It used real data, not stubbed answers. Selecting Baxter’s Method of Christian Theology loaded 50 of 622 records and rendered 20 statements. After moving to page 2, loading the next fifty retained the same first statement ID and page 2; the total grew to 100 loaded. The author remained open. Explicitly loading all 622 then retained the same first statement on page 2, exposed 32 statement pages, and still rendered only 20 records. At phone width, the shelf had one scrolling pane and its descendant evidence pane had `overflow: visible`.

Desktop and mobile layouts were inspected in light and dark. Emulation checks do not certify touch physics on a physical iPhone; the user’s screenshots are the device evidence for the original defect. Source data, test output, screenshots and release hashes are stored beside this report.

## Limits and handoff

The topic ledger contains extracted positions, including summaries, translations and reported views. The labels do not establish authorship of every proposition or turn extracted wording into a verified quotation. Search within the topic applies to currently loaded evidence; selecting a work exposes its own complete index through the existing endpoint. Network errors retain the current selection and offer retry.

The full backend/frontend MereO audit remains incomplete. A complete source package and artifact-update instructions are prepared for the existing Ian PR. Following explicit owner approval, production release `dpl_4KuTW4MNw6q8xV19xsTWCVBgqcfW` completed through `bash tools/deploy_site.sh`. Six research output files matched the production alias byte-for-byte. The earlier approval block is resolved. Native Ghost/Cloudflare integration and online Claude artifact publication are separate actions and are not claimed here.

## Live release acceptance

On the production alias at 390px width, selecting Method of Christian Theology loaded 50 of 622 positions and rendered 20 statements. Its first source link targeted recorded page 9 without a quotation highlight. Moving to page 2 and loading the next 50 retained the open author, page 2, and first statement ID `ef652a7538d9b6f00bd1e689`; the loaded count became 100. The shelf was the only scrolling area, the descendant evidence container used visible overflow, and the page had no horizontal overflow or logged browser errors. `live-browser-proof.json` and `live-mobile.jpg` record this acceptance.
