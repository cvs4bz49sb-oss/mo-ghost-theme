# Search, Scripture and author volume ordering

This is a targeted UI and workflow audit of Search and the author/work research views. It does not certify the full site or MereO port. Source changes use the existing published catalogues and services; no API or corpus records were changed.

## Repairs

Search now uses the library's nine standard shelves. Continental Reformed retains the existing `Reformed` service value. Westminster Divines uses the same published Westminster Assembly membership list as Ask; Puritans and Anglicans use the existing party metadata. Confessions remains a collection filter. Technical namespace names no longer appear as shelf choices.

Works, Meaning and Scripture use ten work groups per page, organized by shelf, author and work, or author and work, with a relevance option. Long lists of locations inside a work have their own fixed pages. Exact-text search pages ten indexed sections, then groups that page by author/work. It cannot promise global author grouping without hydrating every matching index record. Next/Previous replaces the visible page; results do not accumulate on the document. Query, filters, order and page are represented in the URL.

The previous Meaning request asked for 40 library-only candidates and could discard patristic results that used a different response shape. Meaning now joins the existing cross-corpus search to canonical reader works. Search more passages explicitly requests a larger ranked pool. Rank fusion combines the response lists without comparing unrelated raw score scales. Changing display organization uses the loaded results instead of submitting another semantic request. Some legacy patristic matches only resolve to a work: the UI says that the exact reader location is unavailable, and does not invent a page anchor.

Scripture now searches the published verse-reference files. The previous chapter-opening map could put a generic Chapter VIII from a civil-law work under Romans 8 and claim that verse 1 would be on that page. The replacement validates book/chapter/verse and ranges, merges references to the same source location, groups them by work, and links the actual recorded source page. It describes records as indexed citations, including quotations and references, rather than asserting continuous commentary or agreement. Extracted mining summaries are not presented as direct quotations.

Author Works, topic work folds, work dropdowns, position work folds and Search now share canonical volume/edition ordering. The display-only workgroups registry wins where present; otherwise the shared comparator understands Roman and Arabic series, volumes and parts, plus Migne volume/print order. Every witness remains available. Evidence counts still determine which work opens initially, while volume order determines placement. A topic redraw also no longer adds another metadata listener on each redraw; repeated redraws previously multiplied callbacks and could freeze the page.

## Verification

The focused Node suite passed 55 checks, including the existing research/data helpers, opaque page identifiers, Scripture ranges and missing records, semantic response joins, rank fusion, scope membership, pagination, Leibniz Roman volumes, Luther subvolumes, explicit edition order, Trent split volumes and topic listener lifecycle. The canonical build passed its secret and inline-script gates.

Browser observations from the local source build:

- The shelf menu contains all nine standard shelves. Westminster Divines returned 546 catalogue works, on 55 fixed pages.
- Augustine with Latin Fathers selected returned 227 works, on 23 fixed pages. Next changed the URL to page 2, retained button focus, and reloading retained page 2.
- Exact-text `mercy`, Continental Reformed, returned 11,071 indexed sections. Its pager exposed 1,108 pages; source excerpts and opaque reader links rendered. This is the index's match count, which may include indexed word forms.
- Romans 8:1–4, All shelves, returned 3,465 distinct source locations in 1,003 works from the published selection. Roman Catholic returned 568 locations in 182 works. Romans 8:99 produced an invalid-verse message instead of guessed sources.
- At 390 × 844, Search had no horizontal overflow. Query text was 16px, the main query control was 52px high and the shelf control was 44px high. Group expansion/collapse worked. The collapsed-filter layout placed the results region at approximately 550px from the top.
- Ask opened the entered question as an unsent Humanism and Law draft. The legacy Tradition route opened an unsent Deep research draft. Neither test submitted a model request.
- Leibniz Works and Creation showed philosophical writings I–V, correspondence I–IV and political writings III–X in volume order. The preliminary fifth volume remained visible.

Production release: `dpl_8Kx8Fj5RY92JwBd6f6u1UuWoYnHR`, via `bash tools/deploy_site.sh`. All seven changed output files matched the exact deployed-tree snapshot byte-for-byte on `https://thefaithreceived.vercel.app`: Search, both helpers, Authors, Bible, Topics and Compare. `alias-proof.json` records the hashes. A subsequent local preview rebuild does not change that captured release proof.

Live browser checks confirmed Leibniz Creation work folds and all 17 Work-selector options in series/volume order. Search rendered at 390 × 844 and 1280 × 900 in light, sepia and explicit dark, without horizontal overflow. Changing Meaning from shelf grouping to relevance retained the broader results. The final initial request for “divine mercy” in Latin Fathers retained 21 distinct printed citations across 17 works; multiple citations in one work are no longer collapsed to one. Its explicit broader search returned 199 ranked passages in 98 works on 10 pages.

From mobile Scripture page 2, opening Walenburg Vol. 2 at the recorded page 315 loaded that work and displayed p. 315 in the reader header. Browser Back restored Romans 8:1–4, Roman Catholic, page 2 of 19, with 568 locations/182 works. `scripture-mobile-return-live.jpg` records the restored view.

## Practical limits

Meaning is ranked retrieval, not an exhaustive concordance. The existing services cap returned pools; a larger request does not prove all relevant passages were found. The broader API has no separate English Divines namespace, so its supplemental pool cannot independently expand that legacy namespace.

Published Scripture files can contain fewer rows than their recorded indexed totals. For example, the All-shelves Romans 8:1 file reports 2,645 indexed references but supplies 1,000 rows. Search makes that selection explicit and can search shelf-specific files, but complete verse-ledger pagination requires backend work. Source records whose work is unavailable are preserved without fabricated reader links.

The exact-text catalogue filters run before index hydration where native metadata permits. Page-local grouping preserves the index's pagination; this is not a full grouped author concordance. Failed manifest loading produces retry state, and failed optional buckets are visibly marked incomplete.

The full backend/frontend port audit remains incomplete and its automation remains paused. The MereO handoff is source and acceptance guidance, not native integration or a production Cloudflare deployment. The online Claude artifact has not been republished.
