/*
 * Constellations — the map workspace on
 * /the-faith-received/research/ (the "Constellations" tab).
 *
 * WHAT IT DRAWS. Every shelf in the library has been read for the
 * Scripture it quotes, and each author, work and doctrinal topic
 * carries the resulting fingerprint.
 *
 * TWO ARRANGEMENTS of the same points, and the default is the second:
 *
 *   By similarity — the worker's own x/y, a 0-1000 embedding in which
 *     two points sit near each other when their fingerprints agree.
 *     The layout is NOT computed here; running a force simulation in
 *     the browser over 2,600 nodes would draw a different picture on
 *     every load, which is the one thing a map may not do.
 *
 *   By Scripture — one region per category, laid out in the Bible's
 *     own order. The similarity embedding is real but it collapses:
 *     213 of the 287 English Divines quote Paul above everything else,
 *     so seven eighths of that shelf lands in one corner and the
 *     structure the map is meant to show is invisible. Sorting the
 *     same points into named sections spends the plane on the one
 *     distinction a reader can act on, and the edges (drawn under the
 *     points) become the interesting mark, because an edge now crosses
 *     from one region to another and says "these two quote alike in
 *     spite of leaning on different testaments".
 *
 *     The region ORDER is taken from the order `cats` arrives in, not
 *     from a table here. Measured 2026-09-04 across all 46 payloads the
 *     worker serves: there are exactly two vocabularies, both already
 *     canonical, and no node anywhere carries an `e` that `cats` does
 *     not declare. CANON_SCRIPTURE and CANON_DOCTRINE below are the
 *     documented fallback, used only to place a key `cats` omits and to
 *     re-sort a payload whose own order is NOT canonical. A category
 *     `cats` declares but no node uses still gets its region, so the
 *     seven sections are the same seven on every shelf.
 *
 * Both arrangements share everything else: the hover and focus label,
 * the dossier, pan/zoom/fit, the legend's per-category filter and the
 * keyboard index list all read one pair of position arrays (posX/posY)
 * rather than node.x/node.y, so neither of them knows which layout is
 * on screen.
 *
 * THE DATA. Three public GET routes on mo-tfr-library. No auth, no
 * cost, no LLM call:
 *
 *   /v1/mine/constellations/index.json
 *     -> { version, shelves: [ { shelf, slug, have: { authors, works,
 *          doctrines }, pages, authors, works } ] }
 *     `have` is the authority on which views a shelf has. A view a
 *     shelf lacks is a 404, not an empty map (measured 2026-09-04:
 *     augustinians/authors.json -> 404), so the picker offers only what
 *     `have` lists rather than letting the reader discover it by
 *     pressing a button that fails.
 *
 *   /v1/mine/constellations/{shelfSlug}/{authors|doctrines|works}.json
 *     -> { version, shelf, shelfWorks,
 *          nodes: [ { a, x, y, n, e, sub, pg, nr, w, t,
 *                     rows: [ { t, s, h, g } ] } ],
 *          edges: [ [fromIndex, toIndex, weight], … ],
 *          cats:  [ { k, l } ] }
 *
 *   /v1/mine/constellations/{shelfSlug}/{view}-fp.json   (OPTIONAL)
 *     -> { version, shelf, view,
 *          books: [ "psalms", "isaiah", … ],
 *          fp: { "<node.a verbatim>": { n, t: [ [bookIndex, count], … ] } } }
 *     The per-book citation profile behind a node, so a link can name
 *     the books its two ends both lean on. `t` is the node's TOP 15
 *     books descending, not a complete profile, and `n` is the node's
 *     total across every book including the ones `t` does not list.
 *     Read § THE SIDECAR below before using it for anything.
 *
 * Four things about that payload are load-bearing, none of them are
 * uniform across the three views, and all four were measured against
 * the live endpoint rather than assumed:
 *
 *   - `e` (the category key) can be ABSENT. 9 of the 37 nodes in
 *     augustinians/doctrines carry no category. They are drawn as an
 *     open ring rather than a filled dot, and the legend says
 *     "Unclassified", because colouring them as one of the seven would
 *     be a claim the data does not make.
 *   - `w` and `t` (a work slug and its full title) exist ONLY in the
 *     `works` view, where the node itself IS a work. That is the only
 *     view whose node has a reader link of its own.
 *   - `rows[].h` is often missing. Every row in both `works` payloads
 *     sampled has none (they are Scripture chapters, not works), and 55
 *     of 861 rows in english-divines/authors have none either. A row
 *     without an `h` renders as plain text, never as a dead link.
 *   - `rows[].g` (a gloss) appears in the `doctrines` view only.
 *
 * READER LINKS. `rows[].h` arrives in the SOURCE site's URL shape,
 * `/read?w=<id>`, which is not ours. Ours is
 * /the-faith-received/reader/?c=<corpus>&w=<id>, and the `c` is
 * mandatory for every non-native collection: `?c=pld&w=2741`, never
 * `?w=pld-2741`. Getting it wrong produces a link that silently loads
 * nothing. readerUrlFromSlug() mirrors collectionFor() and
 * readerUrlFor() in website/workers/tfr-library/lib/collections.js,
 * which is the authority; read that file before touching the prefix
 * table. No `p=` is emitted: most of this corpus has no printed page
 * numbers, and the section ordinal the rest carry is not something the
 * reader can land on. Any `#fragment` on the source href is dropped as
 * well, since it addresses the source site's own block ids.
 *
 * WHAT A LINE MEANS, AND HOW IT IS REACHED. The edge weight tracks the
 * cosine similarity of log-damped per-book citation counts (r=0.88
 * across 45 sampled pairs, measured 2026-09-04). The damping is the
 * whole of it: on RAW counts those same pairs average 0.878, because
 * every English divine quotes Psalms and Romans heavily, so undamped
 * the map would say everyone matches everyone. So a line claims "these
 * two reach for the same passages, not merely the same books", which is
 * what the captions already say, and 0.36 to 0.95 is the range the
 * worker emits.
 *
 * A line is inert until it is reached, and there are three ways in
 * because there is no one way that works everywhere:
 *
 *   POINTER. hitTestEdge() is a point-to-segment distance test with a
 *     7px tolerance, nearest-wins. Nodes are tested FIRST and always
 *     win: a line passing under a dot must never steal that dot's
 *     hover. Hovering paints the line, rings both ends and draws a
 *     plate naming both, their regions, the strength and whether it
 *     crosses. Clicking opens the same thing in the dossier.
 *
 *   TOUCH. There is no hover on a phone, so a tap does the selecting,
 *     with a 16px tolerance rather than 7. But a 1px diagonal is a poor
 *     touch target however generous the slop, so the reliable path on a
 *     phone is the same one the keyboard uses: tap a point, then tap a
 *     link in the "Strongest links" list its dossier now carries.
 *
 *   KEYBOARD. Through the two nodes an edge joins, NOT through a
 *     parallel list of every edge. The index list below the plate
 *     already exposes each point as a real button; a point's dossier
 *     now lists its strongest links as real buttons; and a link's
 *     dossier lists its two ends as real buttons, which is also how you
 *     get back. Every edge is therefore reachable in three keystrokes
 *     from a node that is already reachable. English Divines has 608
 *     edges over 287 authors, and a flat 608-button list would be a
 *     worse disclosure than the 200-button cap the index already needs.
 *     Focus moves the highlight on the map, exactly as the index list
 *     does, so "where is this link?" is answerable without a pointer.
 *
 * THE SIDECAR, and why it is optional. {view}-fp.json is generated
 * separately and does not exist for every shelf (measured 2026-09-04:
 * 404 on all nine shelf/view pairs sampled). It is fetched lazily, only
 * once edges are actually on screen, never awaited, and never allowed
 * to fail loudly. Everything above works without it; with it, a link
 * also names the books both ends lean on.
 *
 * Two honesty rules govern how it is read, and both are easy to break:
 *
 *   - `t` is a TOP-15 TRUNCATION. Two writers can share a book that is
 *     on neither of their top-15 lists, so the overlap shown is the
 *     overlap that is visible, never the whole of it, and the copy says
 *     so. A book missing from the list is not a book neither cites.
 *   - No score is computed from it. A cosine over two truncated vectors
 *     is not the payload's weight and would disagree with it; the
 *     weight the worker shipped is the only number quoted as the
 *     strength. The sidecar names books and proportions, nothing else.
 *
 *   A node absent from `fp` is UNKNOWN, not zero. It says the profile
 *   has not been published, which is a different sentence from "these
 *   two share nothing" (FRONTEND §6.33).
 *
 * "ALL SHELVES" is merged in the browser; the worker serves no such
 * payload. Read § mergeShelfPayloads for the three traps in doing that
 * and for why it covers authors and doctrines but not works.
 *
 * ══ THE CITATION GRAPH ═══════════════════════════════════════════════
 *
 * A SECOND DATASET behind the same panel, added 2026-09-04, answering a
 * different question with the same machinery. Everything above is about
 * which Scripture a writer quotes. This is about which WRITERS a writer
 * quotes, and it is the only place in the panel where an edge is
 * directed and carries a disagreement.
 *
 *   GET /v1/mine/citations/all.json   (one file, 190 KB gzipped)
 *     -> { version, scope: "all", floor: 5,
 *          cats:  [ { k, l } ],
 *          nodes: [ { a, fk, n, pos, ref, src, e } ],
 *          edges: [ [ fromIndex, toIndex, n, ref ] ] }
 *
 * 1,668 authors, 37,427 pairs, ten declared traditions. On a node, `n`
 * is inbound citations, `ref` how many of those were refutations, `pos`
 * is n minus ref, `src` is how many distinct authors cite this one, and
 * `e` is an INDEX into `cats` rather than a key string, which is the one
 * shape difference the adapter exists to absorb.
 *
 * On an edge, `from` cites `to`, `n` is the pair's total and `ref` how
 * many of them are refutations. Nothing arrives pre-classified. A pair
 * is an ARGUMENT when ref * 2 > n, which is 911 of the 37,427.
 *
 * THE FLOOR IS 5. A pair below five citations is not in `edges` at all,
 * while a node's own `n` and `ref` are unfloored totals. So anything
 * counted off the edge list, the number of authors refuting somebody
 * most of all, is a FLOOR rather than a total, and the copy says so
 * rather than presenting it as complete.
 *
 * TWO VIEWS over the one payload, and the difference between them is
 * which number puts a point at the centre:
 *
 *   Most cited      radius from `pos`.  Augustine 271,515, Aquinas
 *                   174,096, Jerome 84,244, Chrysostom 51,149.
 *   Most contested  radius from `ref`.  Bellarmine 24,899, Aquinas
 *                   5,126, Calvin 4,804, Scotus 4,660.
 *
 * WHAT THE CONTESTED VIEW IS NOT. It is not a list of heretics and it
 * must never be labelled as one. The figures are symmetric across the
 * confessional line (Calvin third, Aquinas second) and they measure who
 * the arguments were WITH. Two distortions follow from that and both
 * are defused in the drawing rather than in a footnote:
 *
 *   ONE POLEMIC CAN TOP THE LIST. Augustinus Reding is 84% refuted and
 *     every one of those 2,680 refutations is Johann Heinrich
 *     Heidegger, one man and one book. Bellarmine's 24,899 come from
 *     267 different authors. So the number of DISTINCT REFUTERS is
 *     computed off the edge list and carried everywhere the count is:
 *     in the dossier beside it, in the index list's second line, and on
 *     the map, where a point refuted by fewer than three authors is
 *     drawn as a hollow ring rather than a filled dot.
 *
 *   BEING CONTESTED IS NOT BEING MARGINAL. Bellarmine has 33,599
 *     positive citations as well as 24,899 refutations: he is at once
 *     among the most cited and by far the most argued with. So a dot's
 *     SIZE is total citations `n` in BOTH views, never the view's own
 *     metric. On the contested map he is therefore near the centre and
 *     one of the largest points on the plate, which is the true reading
 *     and is not available if size and position say the same thing.
 *
 * The same rule saves the case that would otherwise break the view.
 * Scotus cites Aquinas 8,829 times, 7,757 of them positively and 1,072
 * as refutations: the largest single debt in the library and its largest
 * single dispute, one pair. It is NOT an argument edge by the ref*2>n
 * test, so a contested map drawing only the 911 argument edges would be
 * missing it. Hence the contested view's edge budget ranks by
 * refutations rather than filtering to arguments, the pair is drawn
 * SOLID because it is mostly agreement, and its dossier gives both
 * numbers. Aquinas's own dossier lists Scotus first under "Most argued
 * with" and fifth under "Most cited by", in the same rail.
 *
 * THE ARRANGEMENT is concentric rings, and it is the answer to the
 * question that prompted this: who is at the centre and who is an
 * outlier. Read § layoutRings for the ring thresholds and the sector
 * angles, both of which were chosen against the measured distribution
 * rather than picked.
 *
 * THE EDGE BUDGET. 37,427 edges is roughly ten times what this map has
 * drawn before and the tiers above were tuned around 3,700. They are
 * not all drawn. Read § buildBudgets for the ladder and the defaults;
 * the count on screen is always stated and is always measured off the
 * payload rather than remembered.
 *
 * WHAT THIS PAYLOAD DOES NOT SAY, and the copy is held to it: these are
 * the most cited IN THE INDEXED CORPUS rather than in the world. The
 * graph is scoped to the reception index roster, which is what every
 * other reception surface uses; the 1,076 unindexed record sets would
 * add 313,614 rows and move Augustine's inbound by 14%. And a
 * tradition is where the library SHELVES an author. Thirty-three
 * authors are filed under contradictory traditions upstream and are
 * resolved by majority with an alphabetical tiebreak, so the grouping
 * is a filing decision rather than metadata about a person, and nothing
 * in the UI invites it to be read as more than that.
 *
 * THE TENTH CATEGORY. `cats` declares "unknown", and it is not empty:
 * four authors sit in it. The adapter drops that key and emits those
 * four with NO category at all, which routes them through the same
 * unclassified path the Scripture views already have (an open ring, an
 * "Unclassified" legend entry, a sector of their own). "We do not know"
 * gets a shape rather than a colour, here as everywhere else, because
 * painting it as a tenth tradition would say four people belonged to
 * one.
 *

 * ══ COMPARING TWO POINTS ═════════════════════════════════════════════
 *
 * Added 2026-09-04. A single click still opens one point's dossier and
 * always will; the second point is a SEPARATE, NAMED gesture, because a
 * plain click already means something and overloading it would make the
 * map's most common action ambiguous.
 *
 * THE GESTURE. A point's dossier carries a "Compare with another point"
 * button. Pressing it holds that point and puts the panel in an armed
 * state; the next point chosen ANYWHERE becomes the second of the pair.
 * "Anywhere" is the point of it: the arming lives inside select(), which
 * every path already funnels through (a dot on the map, a button in the
 * index list, either end of a link's dossier), so the pointer, the
 * keyboard and a fingertip all reach the same gesture without a second
 * mechanism being invented for any of them. Shift-clicking a second dot
 * does the same thing in one move for a reader who already knows that
 * idiom; it is an accelerator, never the discoverable path, and it
 * cannot fire on a touchscreen.
 *
 * NO MODE THE READER CANNOT LEAVE. The armed state is stated in the rail
 * (a banner with a Cancel button, above the point's own dossier, so
 * nothing is lost while it is up) AND on the map itself (a plate on the
 * held point reading "Now choose a second point"), because below 980px
 * the rail sits under the map and a reader who scrolls back up to tap
 * must be able to see what state they are in. Escape cancels, a tap on
 * empty ground cancels, and both give back the point that was held
 * rather than clearing the rail out from under it.
 *
 * THE PAIR MARK is two rings, and it is deliberately not the same as any
 * other mark on the plate. A selected point wears one accent ring; a
 * hovered point one ink ring; an edge's ends one ring apiece. A compared
 * point wears an accent ring AND a wider ink ring outside it, so the
 * difference is a count rather than a colour and survives any colour
 * vision (WCAG 1.4.1).
 *
 * THE TIE BETWEEN THEM, and this is the honesty-critical part. Where the
 * two ends have a published edge, that edge is drawn exactly as a marked
 * edge is: ink, 2px, keeping the argument dash and the direction
 * arrowhead. The tie is then the map's own line and says only what the
 * map already said. Where there is NO published edge, a hairline is
 * drawn in the ghost colour on a 1-and-6 dot pattern, which resembles no
 * edge tier in either dataset, and the plate over it says outright that
 * no pair was published. It exists so a reader can find their two points
 * on a crowded plate, and it is drawn so that it cannot be mistaken for
 * a measurement.
 *
 * WHAT THE EMPTY PAIR MEANS, which is the common case in both datasets
 * and is measured, not guessed:
 *
 *   CITATIONS. 37,120 of the 1,390,278 unordered pairs of the 1,668
 *     authors carry an edge, which is 2.7%. Among the hundred most cited
 *     it is 48.8%. So two prominent figures usually have something and
 *     two obscure ones usually have nothing, and the nothing is the
 *     ordinary result rather than the exception.
 *
 *     The floor is 5 (`floor: 5` in the payload). A missing pair
 *     therefore means FEWER THAN FIVE CITATIONS, POSSIBLY NONE. It does
 *     not mean the two never named each other, and no copy here is
 *     allowed to say that it does.
 *
 *     That distinction can actually be settled, per pair, on request.
 *     v1/reception/full/<fk>.json.gz carries every extracted citation
 *     record for one author, and `to[<other fk>]` is the whole of that
 *     author's outbound traffic to the other: present means a real
 *     count below five, absent means genuinely none anywhere in the
 *     indexed corpus. It is OPT-IN behind a button rather than fetched
 *     on selection, because the wire cost is 15 KB for Jerome and 1.1 MB
 *     for Francisco Suárez (measured 2026-09-04) and a reader comparing
 *     ten pairs should not pay that ten times for a question they did
 *     not ask. Coverage is about 92%; a 404 is reported as "not
 *     published", never as zero.
 *
 *   SCRIPTURE. 608 of the 41,041 pairs on English Divines carry an edge,
 *     which is 1.5%. A missing pair means the worker's similarity
 *     threshold was not cleared, not that the two share nothing, and the
 *     sidecar proves it: over 394 sampled NO-EDGE pairs on that shelf the
 *     median number of books both writers have in their visible top
 *     fifteen is ELEVEN, and not one pair had zero. So the empty state
 *     there is not an apology. It names the books both lean on, off the
 *     same sidecar the edge hover already uses, with the same top-15
 *     truncation caveat. Where the sidecar is empty (it ships
 *     contract-shaped and empty for `works` and `doctrines`) the pair is
 *     named with the fact that no line was published and nothing more.
 *
 * WHAT A COMPARISON SAYS, per family. Citations: BOTH DIRECTIONS, always
 * separately, never added together. Augustine cites Jerome 55 times with
 * 3 refuting while Jerome cites Augustine 13 times with none, and one
 * number in place of those two would be a different and false sentence.
 * Scripture: the worker's own weight, which is the authoritative score,
 * plus the books both lean on. Nothing here computes a score of its own;
 * the reasoning is the same as § THE SIDECAR above.
 *
 * ACCESS. Not gated, deliberately. These are static JSON files on a
 * public route; nothing here spends an embedding call or reaches an
 * LLM, which is what the standing both-sides gating rule is about, and
 * the panel is the same shape as Bookmarks in that respect. Adding
 * data-feature-gate would tell a free reader they cannot have something
 * the worker hands to anyone with curl. Note for whoever revisits this:
 * the page's own "For members" list does name Constellations, so if it
 * is meant to be paid-only the gate belongs on the worker route first
 * and here second.
 *
 * RENDERING. Everything below crossed the network. Built with
 * createElement + textContent throughout, so there is no escaping step
 * to forget and no path from a server string to markup at all; each
 * URL goes through MOSafeHref. Same shape as
 * assets/js/page/faith-power-search.js.
 *
 * Loaded as a page-template script (FRONTEND §6.18): runs before
 * site.min.js and touches no bundle global. window.MOSafeHref ships in
 * boot.min.js in <head> and is already present.
 */
(function () {
  const root = document.querySelector("[data-cn-root]");
  if (!root) return;
  // Idempotent: this partial ships its own <script>, so a host page
  // that also loads the file must not bind twice.
  if (root.getAttribute("data-cn-bound") === "1") return;
  root.setAttribute("data-cn-bound", "1");

  const WORKER = "https://mo-tfr-library.mo-podcast-feed.workers.dev";
  const BASE = `${WORKER}/v1/mine/constellations`;
  const READER = "/the-faith-received/reader/";
  const AUTHOR_PAGE = "/the-faith-received/author/";
  // Every extracted citation record for one author, keyed by the
  // reception index's own slug (a node's `fk`). Read only on request;
  // see § COMPARING TWO POINTS and loadFullReception below.
  const FULL_BASE = `${WORKER}/v1/reception/full/`;

  /* ── DOM contract ─────────────────────────────────────────────────
   * Every querySelector in this file, in one place. The partial's
   * header lists the same set; keep the two together. */
  const shelfSel = root.querySelector("[data-cn-shelf]");
  const viewBtns = Array.from(root.querySelectorAll("[data-cn-view]"));
  const layoutBtns = Array.from(root.querySelectorAll("[data-cn-layout]"));
  const linksBtn = root.querySelector("[data-cn-links]");
  const linksGroup = root.querySelector("[data-cn-links-group]");
  const budgetSel = root.querySelector("[data-cn-edge-budget]");
  const viewsNote = root.querySelector("[data-cn-views-note]");
  const arrangeNote = root.querySelector("[data-cn-arrange-note]");
  const statusEl = root.querySelector("[data-cn-status]");
  const errorEl = root.querySelector("[data-cn-error]");
  const stageEl = root.querySelector("[data-cn-stage]");
  const canvas = root.querySelector("[data-cn-canvas]");
  const zoomInBtn = root.querySelector("[data-cn-zoom-in]");
  const zoomOutBtn = root.querySelector("[data-cn-zoom-out]");
  const resetBtn = root.querySelector("[data-cn-reset]");
  const legendEl = root.querySelector("[data-cn-legend]");
  const captionEl = root.querySelector("[data-cn-caption]");
  const dossierEl = root.querySelector("[data-cn-dossier]");
  const indexEl = root.querySelector("[data-cn-index]");
  const indexFilter = root.querySelector("[data-cn-index-filter]");
  const indexListEl = root.querySelector("[data-cn-index-list]");
  const indexNoteEl = root.querySelector("[data-cn-index-note]");
  const liveEl = root.querySelector("[data-cn-live]");

  if (!canvas || !stageEl || !shelfSel) return;
  const ctx = canvas.getContext ? canvas.getContext("2d") : null;
  if (!ctx) return;

  /* ── Palette ──────────────────────────────────────────────────────
   *
   * Nine category swatches, read from the custom properties the
   * stylesheet defines on [data-cn-root] rather than written here, so
   * the colours sit in one auditable place with the rest of the theme's
   * tokens (DESIGN §3a M1). Custom properties resolve as authored text,
   * which is why they are plain hex there and why canvas can take them
   * directly. The literals below are a fallback for a stylesheet that
   * failed to load, never a second source of truth.
   *
   * NINE, not seven, since 2026-09-04. The Scripture payloads declare
   * seven categories and the citation payload declares nine traditions,
   * and BOTH node passes in draw() iterate catColors.length: a slot the
   * ramp does not reach is drawn by neither the fill pass nor the
   * open-ring pass and is simply not on the map. At seven swatches that
   * silently lost 219 authors, Bellarmine and Calvin among them. The
   * stylesheet carries the measurements for the two additions; the
   * Scripture views are unaffected, because their two extra passes find
   * no members.
   *
   * The accent (--color-primary) is deliberately NOT in the ramp: it
   * means "this is the one you chose" and nothing else. It is also
   * 2.38:1 on the cream plot ground and would fail WCAG 1.4.11 as a
   * 3px dot; every one of the nine clears 3:1 there.
   *
   * The ramp walks hue AND lightness. The stylesheet carries the
   * measurements and the reasoning; the short version is that the
   * first seven-warm-swatch ramp held three near-identical orange-reds
   * and three near-identical olive-greys, and its closest pair was
   * 3.7 ΔE2000 apart, which is a difference you cannot see on a 3px
   * dot. The set below is 21.1 apart at its closest.
   */
  const CAT_FALLBACK = [
    "#2d2927", "#9c4126", "#a77e3c", "#5a7848", "#1a5b63",
    "#677e99", "#602d4e", "#0c3568", "#8054a0",
  ];
  let catColors = CAT_FALLBACK.slice();
  let edgeColor = "#6b6660";
  let ghostColor = "#d9c6a7";
  let accentColor = "#ee7d51";
  let inkColor = "#2d2927";
  let paperColor = "#f5efe1";

  function readPalette() {
    let cs;
    try {
      cs = window.getComputedStyle(root);
    } catch (_) {
      return;
    }
    const pick = (name, fallback) => {
      const v = (cs.getPropertyValue(name) || "").trim();
      return v || fallback;
    };
    catColors = CAT_FALLBACK.map((f, i) => pick(`--cn-cat-${i + 1}`, f));
    edgeColor = pick("--cn-edge", edgeColor);
    ghostColor = pick("--cn-ghost", ghostColor);
    accentColor = pick("--cn-accent", accentColor);
    inkColor = pick("--cn-ink", inkColor);
    paperColor = pick("--cn-paper", paperColor);
  }

  /* ── Reader links ─────────────────────────────────────────────────
   *
   * Mirrors collectionFor() in tfr-library/lib/collections.js. `cut` is
   * the length of the prefix INCLUDING its hyphen, because the reader
   * addresses these collections by their own bare id. Anything without
   * a known prefix is the native collection and takes no `c=` at all.
   */
  const PREFIXES = [
    { re: /^pld-/, corpus: "pld", cut: 4 },
    { re: /^eebo-/, corpus: "eebo", cut: 5 },
    { re: /^pg-/, corpus: "pg", cut: 3 },
    { re: /^po-/, corpus: "po", cut: 3 },
    { re: /^mo-/, corpus: "mo", cut: 3 },
  ];

  function readerUrlFromSlug(slug) {
    const s = typeof slug === "string" ? slug.trim() : "";
    if (!s) return "";
    for (let i = 0; i < PREFIXES.length; i++) {
      const p = PREFIXES[i];
      if (p.re.test(s)) {
        return `${READER}?c=${p.corpus}&w=${encodeURIComponent(s.slice(p.cut))}`;
      }
    }
    return `${READER}?w=${encodeURIComponent(s)}`;
  }

  // The source href is "/read?w=<id>", sometimes with a "#b1-0" block
  // anchor that means nothing on our side. Pulled out by hand rather
  // than through new URL(): the value is data, its shape is fixed, and
  // a regex cannot be talked into resolving against the current origin.
  function slugFromSourceHref(h) {
    if (typeof h !== "string" || !h) return "";
    const m = /[?&]w=([^&#]+)/.exec(h);
    if (!m) return "";
    try {
      return decodeURIComponent(m[1]);
    } catch (_) {
      return m[1];
    }
  }

  function readerUrlFromSourceHref(h) {
    const slug = slugFromSourceHref(h);
    return slug ? readerUrlFromSlug(slug) : "";
  }

  /* ── Author pages ─────────────────────────────────────────────────
   *
   * /the-faith-received/author/?a=<folded name>. The fold is the whole
   * of the addressing scheme: accents stripped, everything outside
   * a-z0-9 dropped, so "Theodore Beza" is `theodorebeza` and the URL
   * survives the three ways the catalogues spell the same person.
   *
   * A FOURTH COPY of this function, and that is a known cost rather
   * than an oversight. It already lives in assets/js/faith-author.js
   * (which is the authority, since it is the page doing the matching),
   * assets/js/faith-author-reception.js and
   * assets/js/faith-browse-search.js. None of the four has a load-order
   * guarantee against the others, and this file is a page-template
   * script that runs before site.min.js and may not read a bundle
   * global (FRONTEND §6.18), so sharing it would mean shipping a fifth
   * file into <head> to serve one regular expression. THE FOUR MUST
   * CHANGE TOGETHER: if the author page ever changes how it folds a
   * name, every link built here goes to a page that cannot find
   * anybody, and nothing fails loudly.
   *
   * NOT the same string as the citation payload's `fk`, which is the
   * reception index's own file key ("augustine-of-hippo") and keeps a
   * hyphen where a diacritic was. They differ on 75 of the 1,668
   * authors: "Francisco Suárez" folds to `franciscosuarez` here and is
   * `francisco-su-rez` there. Use fold() for a page link and `fk` for a
   * worker file, never one for the other.
   */
  function fold(s) {
    return String(s || "")
      .normalize("NFD")
      .replace(/\p{M}/gu, "")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "");
  }

  function authorPageUrl(name) {
    const key = fold(name);
    return key ? `${AUTHOR_PAGE}?a=${encodeURIComponent(key)}` : "";
  }

  /* Which views have an author behind every point, and therefore an
   * author page to link to. Read off NODE_NOUN rather than listed
   * again: `authors`, `cited` and `contested` all say "author" there
   * and a work or a doctrinal topic is not a person, so the one table
   * that already answers "what is a point here" answers this too. A new
   * view gets the link by declaring its noun, which is the only place
   * it could be got wrong.
   *
   * The link is never a promise that the page has an entry. The author
   * page is built at read time from the library catalogue and the
   * citation roster is the reception index's, and the two are not the
   * same list; there is no cheap local way to know, and finding out per
   * point would be a request per selection. It degrades where it has to:
   * an unknown name renders "No author by that name in the library" on
   * a real page rather than a 404. */
  function viewHasAuthors() {
    return NODE_NOUN[view] === "author";
  }

  /* ── Copy that depends on the view ───────────────────────────── */

  const VIEW_LABEL = {
    authors: "Authors",
    doctrines: "Doctrines",
    works: "Works",
    cited: "Most cited",
    contested: "Most contested",
  };
  const VIEW_BLURB = {
    authors:
      "Each point is an author on this shelf, placed by which parts of Scripture they quote. Two authors sit close together when they reach for the same passages, not merely the same books.",
    works:
      "Each point is a work on this shelf, placed by which parts of Scripture it quotes. Two works sit close together when they reach for the same passages, not merely the same books.",
    doctrines:
      "Each point is a doctrinal topic on this shelf, placed by the passages that carry it. Two topics sit close together when they rest on the same texts.",
  };
  // The same sentence for the regional arrangement, where "close
  // together" is no longer what the plane means. Leaving VIEW_BLURB up
  // while the regions are on screen would be a caption that describes a
  // different picture.
  const REGION_BLURB = {
    authors:
      "Each point is an author on this shelf, filed under the part of Scripture they quote most. The sections run in the Bible's own order, and a line marks a pair who reach for the same passages, even when they lean on different books.",
    works:
      "Each point is a work on this shelf, filed under the part of Scripture it quotes most. The sections run in the Bible's own order, and a line marks a pair that reach for the same passages, even when they lean on different books.",
    doctrines:
      "Each point is a doctrinal topic on this shelf, filed under the head of doctrine it belongs to. A line crossing between two sections marks a pair of topics resting on the same texts.",
  };
  // What the regional arrangement is called depends on what the regions
  // are. The authors and works views are filed by Scripture; the
  // doctrines view is filed by head of doctrine, and calling that "By
  // Scripture" would be a label that lies.
  const REGION_BTN_LABEL = {
    authors: "By Scripture",
    works: "By Scripture",
    doctrines: "By doctrine",
    cited: "By tradition",
    contested: "By tradition",
  };
  const ROWS_HEADING = {
    authors: "Principal works",
    works: "Most cited chapters",
    doctrines: "Passages",
  };
  const NODE_NOUN = {
    authors: "author",
    works: "work",
    doctrines: "topic",
    cited: "author",
    contested: "author",
  };

  /* ── Copy for a link ──────────────────────────────────────────────
   *
   * What a section IS depends on the view, so the sentence about
   * crossing one has to as well: the authors and works views file by
   * Scripture, the doctrines view by head of doctrine.
   */
  const SECTION_NOUN = {
    authors: "part of Scripture",
    works: "part of Scripture",
    doctrines: "head of doctrine",
    cited: "tradition",
    contested: "tradition",
  };
  const LINK_GLOSS = {
    authors:
      "A line joins two authors who reach for the same passages, not merely the same books.",
    works: "A line joins two works that reach for the same passages, not merely the same books.",
    doctrines: "A line joins two topics that rest on the same texts.",
    cited:
      "A line runs from an author to someone they cite. It counts every citation the reception index holds for that pair.",
    contested:
      "A line runs from an author to someone they cite. It counts every citation the reception index holds for that pair. A refutation is a citation the index reads as an argument against.",
  };

  /* ── Copy for a comparison ────────────────────────────────────────
   *
   * The empty pair is the ordinary case in both datasets (2.7% of
   * citation pairs and 1.5% of Scripture pairs carry an edge), so these
   * sentences are the ones a reader will meet most often and they are
   * the ones most easily got wrong. Every one of them says what the
   * absence of a line IS: a threshold that was not cleared, or a floor
   * that was not reached. None of them says the two are unconnected,
   * because the data does not know that and has not been asked.
   */
  const COMPARE_INVITE = "Compare with another point";
  const COMPARE_ARM_NOTE =
    "Choose a second point, on the map or in the list under it, to see what joins the two.";

  // The citation floor, said as a fact about this pair rather than as a
  // fact about the dataset. CITE_FLOOR_NOTE covers the general case
  // elsewhere; this one has to be unmistakable about what it does and
  // does not rule out.
  const COMPARE_CITE_NONE =
    "Neither of these two cites the other five times or more, and five is the floor for this graph. A pair under it is not published at all, so this means fewer than five in each direction, possibly none. It is not a finding that they never named each other.";
  const COMPARE_CITE_ONE_WAY =
    "The other direction is not in the graph, which puts it under five citations rather than at none.";

  /* The opt-in exact count, and the cost is stated before it is spent.
   * Measured on the wire 2026-09-04: 15 KB for Jerome, 19 KB for
   * Augustine, 459 KB for Gisbertus Voetius, 1.1 MB for Francisco
   * Suárez. A reader on a phone is entitled to know that before
   * pressing. */
  const COMPARE_COUNT_INVITE = "Count this pair exactly";
  const COMPARE_COUNT_NOTE =
    "This reads the complete citation record for both authors. For a heavily cited figure that file runs to about a megabyte.";
  const COMPARE_COUNT_WORKING = "Reading the complete records…";
  const COMPARE_COUNT_FAILED =
    "Could not read the complete records just now, so this cannot be settled either way. The counts above are unchanged.";

  // The Scripture threshold. Same shape as the citation floor and the
  // same rule: name the mechanism, never claim the absence.
  const COMPARE_SIM_NONE =
    "No line was published for this pair, which means it did not clear the similarity threshold the worker used. That is a threshold rather than a measurement of nothing in common.";
  const COMPARE_SIM_NO_SIDECAR =
    "The per-book profiles have not been published for this view, so there is nothing further the map can say about this pair.";

  /* ── The citation graph ───────────────────────────────────────────
   *
   * A second endpoint behind the same panel, offered as a synthetic
   * shelf beside "All shelves" because it is corpus-wide rather than
   * per-shelf. Read the header's § THE CITATION GRAPH before touching
   * anything below; the short version is that a node is an author, an
   * edge is directed, and an edge carries a disagreement.
   *
   * The slug is a sentinel, checked against the real ones the same way
   * ALL_SLUG is (citeSlugFree below). */
  const CITE_SLUG = "citations";
  const CITE_LABEL = "Citations between authors";
  const CITE_VIEWS = ["cited", "contested"];
  const CITE_URL = `${WORKER}/v1/mine/citations/all.json`;
  const CITE_FLOOR_NOTE =
    "Pairs below five citations are not in this graph, so any count of how many authors cite or refute somebody is a floor rather than a total.";

  /* The blurb for each ring map. Said in the geometry's own terms,
   * because the plane means something here that it does not mean
   * anywhere else in this panel: distance from the centre IS the
   * measurement, and the rings are decades of it. */
  const CITE_BLURB = {
    cited:
      "Every point is an author the indexed library has been read for, placed by how often the rest of that library cites them. The most cited sit at the centre and the least cited at the rim. Each ring inward is ten times as many citations. The wedges group authors by the tradition the library shelves them in. A line runs from an author to somebody they cite.",
    contested:
      "Every point is an author the indexed library has been read for, placed by how often the rest of that library argues with them. The most refuted sit at the centre and the never refuted at the rim. Each ring inward is ten times as many refutations. The wedges group authors by the tradition the library shelves them in. This measures who the arguments were with, not who was wrong.",
  };
  const CITE_REGION_BLURB = {
    cited:
      "Every point is an author the indexed library has been read for, filed under the tradition the library shelves them in. A point's size is how much the rest of the library cites them. A line runs from an author to somebody they cite.",
    contested:
      "Every point is an author the indexed library has been read for, filed under the tradition the library shelves them in. A point's size is how much the rest of the library cites them at all, so a large point in this view is somebody both cited and argued with. A line runs from an author to somebody they cite.",
  };

  /* Three corrections, kept apart because they correct different
   * things. The first is about what the numbers count. The second is
   * about what the wedges are. The third exists only on the contested
   * map, where a count read on its own says something the data does
   * not, and it is the one that must never be dropped. */
  const CITE_SCOPE_CAVEAT =
    "Every figure here is counted inside the indexed corpus rather than being an absolute ranking. This library is heavily Protestant and scholastic, so the totals partly measure who it happens to hold.";
  const CITE_TRADITION_CAVEAT =
    "A wedge is where the library shelves an author, not a claim about the person. A few authors are shelved in more than one place and are drawn under the one that holds most of them.";
  const CITE_CONTESTED_CAVEAT =
    "Being argued with is not a verdict. It is not the same as being ignored either. Several of the figures nearest this centre are also among the most cited in the library, which is why size here is total citations rather than refutations. A large count can also come from a single opponent, so every figure below is given with the number of authors behind it. A point refuted by fewer than three authors is drawn as a hollow ring.";

  const CITE_LINE_KEY = {
    cited:
      "Solid lines are citations. The heavier the line, the more of them. Dashed lines are the pairs where refutations outnumber agreements.",
    contested:
      "Dashed lines are the pairs where refutations outnumber agreements. Solid lines are pairs that are mostly agreement with an argument inside them, which is what the heaviest disputes in this library turn out to be.",
  };

  const CITE_VIEWS_NOTE =
    "Citations between authors covers the whole indexed library at once, so the shelf list does not apply to it and neither do the three Scripture views.";
  const CITE_ARRANGE_NOTE =
    "By similarity is unavailable here. The citation graph carries no coordinates of its own, so there is no embedding to lay these authors out in.";

  /* ── Copy for the merged shelf ────────────────────────────────────
   *
   * Three separate claims, kept apart on purpose. The blurb says what
   * the picture IS. The caveat says the one thing it cannot show, and
   * is the reason the lines start hidden there. The arrange note says
   * why an arrangement that works everywhere else is unavailable.
   * Folding any of them into another would bury it.
   */
  const ALL_BLURB = {
    authors:
      "Every author the library has been read for, on one plate, each filed under the part of Scripture they quote most. A name found on more than one shelf is drawn once.",
    doctrines:
      "Every doctrinal topic the library has been read for, on one plate, each filed under the head of doctrine it belongs to. A topic found on more than one shelf is drawn once.",
  };

  /* The honest sentence about the edges, and the reason for it. Every
   * edge in every payload was computed WITHIN one shelf; no cross-shelf
   * pair was ever measured upstream. Drawing them merged would look
   * corpus-wide and would be missing precisely the cross-tradition
   * links this view exists to look for. */
  const ALL_LINKS_CAVEAT =
    "Links are hidden here because none of them cross a shelf. Every pair was measured inside a single shelf, so the map can only join two writers who already share one. The cross-tradition links this view exists to look for were never computed.";

  const ALL_ARRANGE_NOTE =
    "By similarity is unavailable on all shelves. Each shelf was placed in a coordinate space of its own, so laying fifteen of them over each other would claim a closeness that was never measured.";

  const ALL_VIEWS_NOTE =
    "All shelves covers authors and doctrines. Works is left out: hundreds of works in the library share a title with another work, so there is no safe way to merge them into single points.";

  /* The four bands are the SAME partition the drawing uses (EDGE_TIERS
   * below), so the word a reader is given for a line and the weight of
   * ink it was drawn with cannot disagree. */
  function strengthWord(w) {
    if (w <= 0.5) return "faint";
    if (w <= 0.65) return "moderate";
    if (w <= 0.8) return "strong";
    return "very strong";
  }

  /* ── The canonical fallback orders ────────────────────────────────
   *
   * NOT the primary source of the region order: `cats` is, and it has
   * been canonical on every payload measured. These exist so that a key
   * `cats` omits still lands in the right place, and so that a payload
   * whose own order is scrambled is re-sorted rather than drawn in the
   * order it happened to arrive in.
   *
   * The two vocabularies never mix and their keys do not collide, so
   * one rank table covers both. */
  const CANON_SCRIPTURE = ["T", "H", "W", "P", "G", "A", "C"];
  const CANON_DOCTRINE = ["S", "D", "X", "J", "E", "L", "M"];
  const CANON_RANK = {};
  CANON_SCRIPTURE.forEach((k, i) => { CANON_RANK[k] = i; });
  CANON_DOCTRINE.forEach((k, i) => { CANON_RANK[k] = i; });

  const LAYOUT_REGIONS = "regions";
  const LAYOUT_SIMILARITY = "similarity";
  const LAYOUT_RINGS = "rings";

  /* ── "All shelves" ────────────────────────────────────────────────
   *
   * A synthetic shelf. The worker serves no merged payload, so this one
   * is built in the browser out of every shelf that has the view, and
   * the slug is a sentinel that can never collide with a real one
   * (every real slug is a lowercase word, measured across all sixteen).
   *
   * TWO of the three views only, and the missing one is `works`.
   * Measured 2026-09-04 against the live worker:
   *
   *   authors     0.18 MB on the wire, 0.74 MB parsed, 1,690 node rows
   *   doctrines   0.50 MB on the wire, 2.09 MB parsed, 1,898 node rows
   *   works       0.62 MB on the wire, 3.35 MB parsed, 9,552 node rows
   *
   * so weight is not what rules works out. IDENTITY is. The merge key
   * has to be the node's `a` string, and in the authors and doctrines
   * views that string IS the identity: a person is their name, a topic
   * is its name. In the works view `a` is a truncated title, and titles
   * are not identities. Those 9,552 rows carry only 6,494 distinct `a`
   * strings, and 477 of those names stand for more than one distinct
   * work slug: "Letters" covers 114 different works, "Opera" 64,
   * "Sermons" 50. Merging on `a` there would fuse 114 unrelated books
   * into one point and add their citation counts together. Merging on
   * `w` instead avoids that and still leaves 7,845 points, about
   * two-thirds of them in the Acts & Paul region, which is a grey field
   * rather than a map. Neither is worth shipping, so works keeps its
   * fifteen separate shelves and the note under the picker says so.
   */
  const ALL_SLUG = "all";
  const ALL_LABEL = "All shelves";
  const ALL_VIEWS = ["authors", "doctrines"];

  // "all" reads well as a shareable ?shelf= value and no shelf the
  // worker serves uses it (checked against all sixteen). If one ever
  // does, the real shelf wins and the merged option is simply not
  // offered, rather than two entries answering to one slug.
  function allSlugFree() {
    return !shelves.some((s) => s && s.slug === ALL_SLUG);
  }

  /* ── State ────────────────────────────────────────────────────── */

  let shelves = [];
  let shelfSlug = "";
  let view = "";
  let nodes = [];
  let edges = [];
  let cats = [];
  let catIndex = {}; // category key -> ramp slot
  let hiddenCats = {}; // category key ("" for unclassified) -> true
  let selected = -1;
  let hovered = -1;
  let loadToken = 0;
  let indexBuilt = false;

  /* The link half of the same pair. A node selection and a link
   * selection are mutually exclusive: both own the dossier, and two
   * things in one rail is two things claiming to be what you chose.
   *
   * `adj` is node index -> the indices of its edges, sorted strongest
   * first. Built once per payload rather than scanned per render: the
   * dossier asks for one node's links on every selection, and rescanning
   * 17,715 edges to answer that is work done over and over for an answer
   * that cannot change until the payload does. */
  let selectedEdge = -1;
  let hoveredEdge = -1;
  let adj = [];

  /* The compared pair, and it is a THIRD thing that can own the
   * dossier, mutually exclusive with the other two for the same reason
   * they are exclusive with each other.
   *
   * Two fields rather than one array, because the half-state is real
   * and is most of the interaction: compareA alone is "armed and
   * waiting for a second point", which is a state the reader has to be
   * able to see and to leave. compareB is set only when a pair exists.
   * Both are -1 at rest. */
  let compareA = -1;
  let compareB = -1;

  /* The optional per-book profile. `fp` is null until a sidecar has
   * been read; `fpKey` is the shelf/view it belongs to, so a stale
   * response cannot be adopted onto a map it does not describe. */
  let fp = null;
  let fpKey = "";
  let fpToken = 0;
  const fpCache = new Map(); // url -> payload, or null for "asked, not there"

  // The merged shelf, and the reader's arrangement from before they
  // opened it. Similarity is not offered there (see similarityOK), and
  // silently keeping them on regions afterwards would lose a choice
  // they made.
  let isAll = false;
  let preAllLayout = "";
  let allMissed = 0;

  /* ── The citation graph's state ───────────────────────────────────
   *
   * `citeMode` is the one flag everything downstream branches on, and
   * it is set from the payload rather than from the shelf slug, so a
   * half-loaded switch cannot leave the drawing reading citation fields
   * off a Scripture payload.
   *
   * inAdj / outAdj are the DIRECTED halves of the adjacency, which the
   * undirected `adj` above cannot answer: "who cites this author" and
   * "who does this author cite" are different lists and the dossier
   * shows both. `refuters[i]` is how many distinct authors refute node
   * i, counted off the edge list and therefore floored at pairs of five
   * citations (see CITE_FLOOR_NOTE). `topRefuter[i]` is the edge
   * carrying most of them, which is what makes a single-source spike
   * legible in one line. `reverseAt` finds the return traffic for a
   * pair, since 614 of the 37,427 edges have their opposite in the set
   * and drawing one without naming the other would be half a sentence. */
  let citeMode = false;
  let inAdj = [];
  let outAdj = [];
  let refuters = new Int32Array(0);
  let topRefuter = new Int32Array(0);
  let reverseAt = null;
  let preCiteLayout = "";

  /* The edge budget: which of the 37,427 pairs are on screen. `budgets`
   * is the ladder for the current view with the true count beside each
   * rung, measured off the payload rather than written down here, and
   * `inBudget` is that decision cached per edge so the draw loop and the
   * hit test are both O(1) on it and cannot disagree. */
  let budgets = [];
  let budgetKey = "";
  let inBudget = new Uint8Array(0);
  let budgetCount = 0;

  /* The arrangement, and the positions it produced.
   *
   * posX/posY are the ONLY coordinates anything downstream reads.
   * node.x and node.y are touched in exactly one place (layoutSimilarity)
   * and are never written, so switching arrangement and switching back
   * is lossless.
   *
   * cellSpan is the world-space width of the grid cell a point was given
   * inside its region, and it is what stops a crowded region drawing as
   * one solid mass: a dot is never allowed to be wider than its own
   * cell. In the similarity arrangement it is Infinity, so the radius is
   * whatever radiusFor() says, exactly as before. */
  let layout = LAYOUT_REGIONS;
  let edgesOn = true;
  let posX = new Float64Array(0);
  let posY = new Float64Array(0);
  let cellSpan = new Float64Array(0);
  let regions = [];
  // The ring arrangement's radial axis: one entry per decade band, with
  // the world radii it occupies. Empty in every other arrangement, and
  // `regions` carries the wedges there rather than the grid cells, so
  // the two sets of furniture are drawn by different functions and
  // neither can be handed the other's shape.
  let ringBands = [];
  let bounds = null;

  const cache = new Map();

  // The view transform, in screen pixels. `scale()` is the fitted base
  // scale times the reader's zoom; panX/panY move the fitted centre.
  let zoom = 1;
  let panX = 0;
  let panY = 0;
  let baseScale = 1;
  let cx = 500;
  let cy = 500;
  let spanX = 1000;
  let spanY = 1000;
  let cssW = 0;
  let cssH = 0;

  const MIN_ZOOM = 1;
  const MAX_ZOOM = 12;

  /* ── Status, error, and the rule that an empty state is a claim ──
   *
   * FRONTEND §6.33: a failed fetch is never allowed to paint "nothing
   * here". showError() clears the map and says which failure it was. */
  function setStatus(message) {
    if (!statusEl) return;
    if (!message) {
      statusEl.hidden = true;
      statusEl.textContent = "";
      return;
    }
    statusEl.hidden = false;
    statusEl.textContent = message;
  }

  function showError(message) {
    setStatus("");
    if (!errorEl) return;
    errorEl.hidden = false;
    errorEl.textContent = message;
  }

  function clearError() {
    if (!errorEl) return;
    errorEl.hidden = true;
    errorEl.textContent = "";
  }

  function announce(message) {
    if (liveEl) liveEl.textContent = message;
  }

  function fmt(n) {
    return Number(n || 0).toLocaleString("en-US");
  }

  /* ── Geometry ─────────────────────────────────────────────────── */

  /*
   * Reads the stage's box and sizes the canvas to it.
   *
   * The two guarded assignments are load-bearing and were not always
   * guarded. Writing to canvas.width or canvas.height CLEARS the whole
   * canvas, and it does so even when the value written is the value
   * already there. This function runs on every ResizeObserver and
   * window-resize delivery, and almost all of those report the same box
   * as last time; onResize() then returns early precisely because
   * nothing changed, so nothing redraws. An unguarded assignment here
   * therefore wipes a fully drawn map and leaves it wiped.
   *
   * Measured 2026-09-04 in the harness: an observer delivery arrived
   * 1.8s after load, long after the last paint, and blanked a map that
   * had drawn correctly twice. It reads exactly like a failed fetch and
   * is not one.
   */
  function measure() {
    const rect = stageEl.getBoundingClientRect();
    cssW = Math.max(0, Math.round(rect.width));
    cssH = Math.max(0, Math.round(rect.height));
    if (!cssW || !cssH) return false;
    const dpr = Math.min(3, Math.max(1, window.devicePixelRatio || 1));
    const bw = Math.round(cssW * dpr);
    const bh = Math.round(cssH * dpr);
    if (canvas.width !== bw) canvas.width = bw;
    if (canvas.height !== bh) canvas.height = bh;
    canvas.style.width = `${cssW}px`;
    canvas.style.height = `${cssH}px`;
    // setTransform, not scale(): this runs on every resize and a
    // cumulative scale() would compound. Idempotent, so it is safe to
    // re-apply on the passes that changed nothing, and necessary on the
    // ones that did.
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    return true;
  }

  const PAD = 26;

  /*
   * The box being fitted is the LAYOUT's, not the points'. In the
   * similarity arrangement the two are the same thing. In the regional
   * one they are not: each region reserves a strip above its points for
   * its name, and fitting the points alone would push the top row's
   * labels off the plate.
   */
  function fit() {
    if (!bounds || !cssW || !cssH) return;
    // One node, or every node stacked on one coordinate, gives a zero
    // span and a scale of Infinity.
    spanX = Math.max(1, bounds.maxX - bounds.minX);
    spanY = Math.max(1, bounds.maxY - bounds.minY);
    cx = (bounds.minX + bounds.maxX) / 2;
    cy = (bounds.minY + bounds.maxY) / 2;
    baseScale = Math.min((cssW - PAD * 2) / spanX, (cssH - PAD * 2) / spanY);
    if (!isFinite(baseScale) || baseScale <= 0) baseScale = 1;
  }

  function scale() {
    return baseScale * zoom;
  }

  /* ── Node radius ──────────────────────────────────────────────────
   *
   * Log, not linear and not sqrt. `n` spans 12 to 62,039 across the
   * shelves measured and is heavily bottom-weighted, so a linear or
   * sqrt map leaves nine points in ten at the floor radius and the map
   * reads as uniform. Radius is in SCREEN pixels and does not scale
   * with zoom: zooming is for separating crowded points, and dots that
   * grow with it turn a dense region into one blob at every
   * magnification.
   */
  let logMin = 0;
  let logSpan = 1;

  function computeWeights() {
    let lo = Infinity;
    let hi = -Infinity;
    for (let i = 0; i < nodes.length; i++) {
      const v = Math.log(Math.max(1, nodes[i].n || 1));
      if (v < lo) lo = v;
      if (v > hi) hi = v;
    }
    logMin = isFinite(lo) ? lo : 0;
    logSpan = Math.max(0.0001, (isFinite(hi) ? hi : 1) - logMin);
  }

  function radiusFor(n) {
    const small = cssW < 520;
    const rMin = small ? 2.2 : 2.6;
    const rMax = small ? 7 : 9.5;
    const t = (Math.log(Math.max(1, n || 1)) - logMin) / logSpan;
    return rMin + (rMax - rMin) * Math.max(0, Math.min(1, t));
  }

  /*
   * The radius a point is actually drawn at, capped by the cell it was
   * given. 936 of the 1,486 English Divines works are Pauline, so that
   * one region holds a 36 x 26 grid whose cells are about 4.6 screen
   * pixels across at the fitted scale; nine-pixel dots there would draw
   * a single mass and hide the very thing the arrangement exists to
   * show. Capping to the cell means the crowded region reads as a fine
   * dense field at rest and separates into distinct, correctly-sized
   * points as the reader zooms, which is what the zoom is for.
   *
   * The cap does not bind in a sparse region: Torah's 54 works get cells
   * far wider than any dot, so the log size ramp shows in full there.
   * In the similarity arrangement cellSpan is Infinity and this is
   * exactly radiusFor().
   */
  function radiusAt(i) {
    const r = radiusFor(nodes[i] ? nodes[i].n : 1);
    const span = cellSpan.length > i ? cellSpan[i] : Infinity;
    if (!isFinite(span)) return r;
    return Math.max(1.6, Math.min(r, span * scale() * 0.46));
  }

  /* ── Categories ───────────────────────────────────────────────── */

  function catKeyOf(node) {
    return typeof node.e === "string" && node.e ? node.e : "";
  }

  /*
   * The number this view ranks by. On the Scripture maps there is only
   * one, `n`, and this is what it has always been. On the citation maps
   * the two views are the SAME points ranked by different columns, and
   * everything that orders points reads through here so none of them
   * can be left ranking by the other view's number: the rings, the
   * centre of each tradition cell, and the index list beneath the map.
   *
   * The dot's SIZE is deliberately not this. Size stays total citations
   * in both views (see radiusFor), so that an author who is heavily
   * refuted AND heavily cited is drawn large near the contested
   * centre rather than being forced into one camp.
   */
  function sortMetric(node) {
    if (!node) return 0;
    if (citeMode) return (view === "contested" ? node.ref : node.pos) || 0;
    return node.n || 0;
  }

  function slotOf(node) {
    const slot = catIndex[catKeyOf(node)];
    return typeof slot === "number" ? slot : -1;
  }

  function isVisible(node) {
    return !hiddenCats[catKeyOf(node)];
  }

  function catLabel(key) {
    const c = cats.find((x) => x && x.k === key);
    if (c && c.l) return c.l;
    return key || "Unclassified";
  }

  function rankOf(key) {
    const r = CANON_RANK[key];
    // A key neither canonical list knows goes after everything that is
    // known, in a stable order, rather than being dropped.
    return typeof r === "number" ? r : 900;
  }

  function byCanonRank(a, b) {
    const d = rankOf(a) - rankOf(b);
    if (d !== 0) return d;
    if (a < b) return -1;
    return a > b ? 1 : 0;
  }

  // "Canonical" here means only: the keys this payload declares appear
  // in an order consistent with the documented list. Keys the list does
  // not know are skipped rather than counted as a violation.
  function isCanonicalOrder(keys) {
    let last = -1;
    for (let i = 0; i < keys.length; i++) {
      const r = CANON_RANK[keys[i]];
      if (typeof r !== "number") continue;
      if (r < last) return false;
      last = r;
    }
    return true;
  }

  function orderedCatKeys() {
    const seen = {};
    const declared = [];
    cats.forEach((c) => {
      if (!c || typeof c.k !== "string" || !c.k || seen[c.k]) return;
      seen[c.k] = true;
      declared.push(c.k);
    });
    if (!isCanonicalOrder(declared)) declared.sort(byCanonRank);
    // A key a node claims that `cats` never declared. None exist on any
    // payload the worker serves today; handled so that a vocabulary
    // change cannot silently drop a whole region on the floor.
    const orphans = [];
    for (let i = 0; i < nodes.length; i++) {
      const k = catKeyOf(nodes[i]);
      if (!k || seen[k]) continue;
      seen[k] = true;
      orphans.push(k);
    }
    orphans.sort(byCanonRank);
    return declared.concat(orphans);
  }

  /* ── Arrangement: one region per category ─────────────────────────
   *
   * Geometry, all of it in the same world units the similarity
   * embedding uses so that fit(), scale(), the pan clamp and hit
   * testing need to know nothing about which arrangement is on screen.
   *
   * A region is one grid cell: a strip at the top carrying its name, a
   * count and a hairline, and a plot box under that holding its points.
   * The number of columns comes from the stage's width, never from the
   * number of regions: seven side by side is unreadable on a phone and
   * a single column of seven is worse, because fitting a 3.5:1 board
   * into a 340px stage leaves each region 29px tall. Two columns is the
   * narrow answer and it is verified at 375, not assumed.
   */
  const REGION_GAP = 90; // world units between neighbouring regions
  const REGION_CELL_W = 1000; // world width of one region
  const REGION_INSET = 26; // world padding inside a region's plot box
  const REGION_LABEL_PX = 26; // screen pixels reserved for a region's name

  /*
   * Measured in the research workspace, 2026-09-04: the stage is 792px
   * wide at a 1280px window (three columns), 844px once the dossier
   * rail drops under the map below 980 (still three), and 335px at 375
   * (two). The four-column tier is not reachable there and is kept
   * because the partial documents being dropped on a page of its own,
   * where the stage takes the full 1124px inner width.
   */
  function columnsFor(width) {
    if (width >= 1000) return 4;
    if (width >= 700) return 3;
    return 2;
  }

  function layoutSimilarity() {
    let minX = Infinity;
    let maxX = -Infinity;
    let minY = Infinity;
    let maxY = -Infinity;
    for (let i = 0; i < nodes.length; i++) {
      const n = nodes[i];
      posX[i] = n.x;
      posY[i] = n.y;
      cellSpan[i] = Infinity;
      if (n.x < minX) minX = n.x;
      if (n.x > maxX) maxX = n.x;
      if (n.y < minY) minY = n.y;
      if (n.y > maxY) maxY = n.y;
    }
    regions = [];
    bounds = { minX, minY, maxX, maxY };
  }

  function layoutRegions() {
    const keys = orderedCatKeys();
    const buckets = {};
    keys.forEach((k) => { buckets[k] = []; });
    const loose = [];
    for (let i = 0; i < nodes.length; i++) {
      const k = catKeyOf(nodes[i]);
      if (k && buckets[k]) buckets[k].push(i);
      else loose.push(i);
    }

    // A declared category with no members still gets its region. The
    // seven sections are then the same seven on every shelf, which is
    // the whole point of arranging by them, and "Prophets · 0" is a true
    // sentence about the shelf rather than a gap the reader has to
    // explain to themselves.
    const cells = keys.map((k) => ({ key: k, label: catLabel(k), members: buckets[k] }));
    if (loose.length) cells.push({ key: "", label: "Unclassified", members: loose });
    if (!cells.length) {
      layoutSimilarity();
      return;
    }

    const cols = Math.max(1, Math.min(cells.length, columnsFor(cssW)));
    const rows = Math.ceil(cells.length / cols);
    const boardW = cols * REGION_CELL_W + (cols - 1) * REGION_GAP;
    // The board is shaped to the stage so that fitting it uses the whole
    // plate instead of leaving a band of cream down one side.
    const aspect = cssW > 0 && cssH > 0 ? cssH / cssW : 0.66;
    let cellH = (boardW * aspect - (rows - 1) * REGION_GAP) / rows;
    cellH = Math.max(320, Math.min(1800, cellH));
    const boardH = rows * cellH + (rows - 1) * REGION_GAP;

    // The name strip is a fixed number of SCREEN pixels, so its size in
    // world units depends on the scale fit() is about to choose. That
    // scale is computable here because the board's box is already known.
    const approx = Math.min((cssW - PAD * 2) / boardW, (cssH - PAD * 2) / boardH);
    const strip = Math.max(24, Math.min(cellH * 0.42, REGION_LABEL_PX / (approx > 0 ? approx : 1)));

    regions = [];
    cells.forEach((cell, i) => {
      const c = i % cols;
      const r = Math.floor(i / cols);
      const x = c * (REGION_CELL_W + REGION_GAP);
      const y = r * (cellH + REGION_GAP);
      const reg = {
        key: cell.key,
        label: cell.label,
        count: cell.members.length,
        x,
        y,
        w: REGION_CELL_W,
        h: cellH,
        plotX: x + REGION_INSET,
        plotY: y + strip,
        plotW: REGION_CELL_W - REGION_INSET * 2,
        plotH: Math.max(1, cellH - strip - REGION_INSET),
      };
      regions.push(reg);
      placeInRegion(reg, cell.members);
    });

    bounds = { minX: 0, minY: 0, maxX: boardW, maxY: boardH };
  }

  /*
   * Placement inside one region: a grid whose aspect matches the plot
   * box, filled from the middle outwards with the members sorted
   * largest first. Two things follow, and both are the point.
   *
   * Nothing overlaps, because every point owns a cell. And the largest
   * points sit in the centre of their section, so "who is the big one
   * here" is answered by looking at the middle rather than by hunting
   * for the biggest dot. Where a grid is not exactly full, the empty
   * cells are the outermost ones, so a part-filled region reads as a
   * centred cluster rather than as a rectangle with a bite out of it.
   *
   * Ties on `n` break on the node's own index, so the picture is
   * identical on every load. Nothing here is random.
   */
  function placeInRegion(reg, members) {
    const m = members.length;
    if (!m) return;
    const order = members.slice().sort((a, b) => {
      const d = sortMetric(nodes[b]) - sortMetric(nodes[a]);
      return d !== 0 ? d : a - b;
    });
    if (m === 1) {
      posX[order[0]] = reg.plotX + reg.plotW / 2;
      posY[order[0]] = reg.plotY + reg.plotH / 2;
      cellSpan[order[0]] = Math.min(reg.plotW, reg.plotH);
      return;
    }

    const ratio = reg.plotW / Math.max(1, reg.plotH);
    let icols = Math.max(1, Math.min(m, Math.round(Math.sqrt(m * ratio))));
    let irows = Math.ceil(m / icols);
    // sqrt rounding can leave a whole empty row; pull the columns in
    // until the grid is no taller than it needs to be.
    while (icols > 1 && (icols - 1) * irows >= m) {
      icols -= 1;
      irows = Math.ceil(m / icols);
    }
    const cw = reg.plotW / icols;
    const chh = reg.plotH / irows;
    const midX = reg.plotX + reg.plotW / 2;
    const midY = reg.plotY + reg.plotH / 2;

    const slots = [];
    for (let r = 0; r < irows; r++) {
      for (let c = 0; c < icols; c++) {
        const x = reg.plotX + (c + 0.5) * cw;
        const y = reg.plotY + (r + 0.5) * chh;
        // Distance measured in units of the plot box, not in world
        // units: a wide flat region would otherwise fill left-to-right
        // rather than outwards from its middle.
        const dx = (x - midX) / reg.plotW;
        const dy = (y - midY) / reg.plotH;
        slots.push({ x, y, d: dx * dx + dy * dy, r, c });
      }
    }
    slots.sort((a, b) => a.d - b.d || a.r - b.r || a.c - b.c);

    const span = Math.min(cw, chh);
    for (let k = 0; k < order.length; k++) {
      const i = order[k];
      const slot = slots[k];
      posX[i] = slot.x;
      posY[i] = slot.y;
      cellSpan[i] = span;
    }
  }

  /* ── Arrangement: concentric rings ────────────────────────────────
   *
   * The citation graph's own arrangement, and the one that answers the
   * question the two views were built for: who is at the centre and who
   * is an outlier. Distance from the centre IS the measurement here,
   * which is not true of either other arrangement, so the geometry is
   * doing the work a legend would otherwise have to.
   *
   * RADIUS: DECADE BANDS, not a continuous log ramp. The metric runs
   * from 0 to 271,515 and is heavily bottom-weighted (measured over the
   * live payload: by positive citations, 221 authors at zero, 119 in
   * the ones, 546 in the tens, 556 in the hundreds, 185 in the
   * thousands, 39 in the ten thousands and 2 above a hundred thousand).
   * A linear radius would put nine authors in ten inside the outermost
   * few per cent of the plate. A continuous log ramp fixes that but
   * leaves the radial axis unreadable: a reader can see that a point is
   * further out without being able to say further out by how much.
   * Decades can be DRAWN and LABELLED, so the axis reads like the log
   * axis it is, and each circle is a round number rather than a
   * position in a gradient. It also gives the contested map its
   * strongest true sentence: Bellarmine is alone inside the ten
   * thousand ring.
   *
   * ANGLE: ONE EQUAL WEDGE PER TRADITION, and equal is a deliberate
   * choice against the obvious alternative. The traditions are wildly
   * uneven (Latin Fathers 798 of 1,668, Eastern Fathers 14, four
   * unclassified), so a wedge sized in proportion to its roster would
   * give the Latin Fathers 172 degrees and leave five traditions as
   * slivers. Worse, it would put roster size on the loudest channel
   * left, and roster size is a fact about what has been indexed rather
   * than a fact about the tradition. Equal wedges keep the difference
   * visible AS DENSITY, which is what it is: the Latin wedge reads as a
   * packed field and the Eastern one as a handful of points, and no
   * wedge is too thin to find or to label. The four unclassified
   * authors get a readable wedge for the same reason.
   *
   * A gutter is left empty at twelve o'clock so the ring labels have
   * somewhere to sit that is not on top of the data.
   */
  const RING_CENTRE = 1000;
  const RING_MIN = 90;
  const RING_MAX = 900;
  /* World units reserved OUTSIDE the rim for the wedge names. It has
   * to be a real band rather than a hairline of air: all furniture is
   * drawn before the points, so a name drawn just inside the rim is
   * drawn under whatever sits there, and the wedges that most need
   * naming are exactly the ones whose outermost band is full. Measured
   * in the harness at 1280: Latin Fathers, 798 authors, had its own
   * label completely buried under its own points.
   *
   * The cost is 8% off the circle's fitted diameter, which buys a 33px
   * annulus at that width. Height is not the constraint on a tangential
   * label; arc length is, and outside the rim there is more of it. */
  const RING_PAD = 150;
  const RING_LABEL_OUT = 30; // world units from the rim to the name's baseline
  const RING_GUTTER = 16; // degrees left empty at the top for the radial axis labels

  function bandOf(v) {
    return v <= 0 ? 0 : Math.floor(Math.log10(v)) + 1;
  }

  function layoutRings() {
    const keys = orderedCatKeys();
    const buckets = {};
    keys.forEach((k) => { buckets[k] = []; });
    const loose = [];
    for (let i = 0; i < nodes.length; i++) {
      const k = catKeyOf(nodes[i]);
      if (k && buckets[k]) buckets[k].push(i);
      else loose.push(i);
    }
    const cells = keys.map((k) => ({ key: k, label: catLabel(k), members: buckets[k] }));
    if (loose.length) cells.push({ key: "", label: "Unclassified", members: loose });
    if (!cells.length) {
      layoutSimilarity();
      return;
    }

    let maxBand = 0;
    for (let i = 0; i < nodes.length; i++) {
      const b = bandOf(sortMetric(nodes[i]));
      if (b > maxBand) maxBand = b;
    }
    const bandCount = maxBand + 1;
    const thick = (RING_MAX - RING_MIN) / bandCount;
    ringBands = [];
    for (let b = 0; b < bandCount; b++) {
      ringBands.push({
        // rIn is the edge nearer the centre. Band 0 is the rim and holds
        // the zeroes; band `maxBand` is innermost and holds the giants.
        rIn: RING_MAX - (b + 1) * thick,
        rOut: RING_MAX - b * thick,
        // The value the circle on this band's INNER edge stands for.
        mark: 10 ** b,
      });
    }

    const gut = (RING_GUTTER * Math.PI) / 180;
    const span = (Math.PI * 2 - gut) / cells.length;
    const start = -Math.PI / 2 + gut / 2;
    regions = [];
    cells.forEach((cell, i) => {
      const a0 = start + i * span;
      const reg = {
        key: cell.key,
        label: cell.label,
        count: cell.members.length,
        a0,
        a1: a0 + span,
      };
      regions.push(reg);
      placeInSector(reg, cell.members);
    });

    const half = RING_MAX + RING_PAD;
    bounds = {
      minX: RING_CENTRE - half,
      minY: RING_CENTRE - half,
      maxX: RING_CENTRE + half,
      maxY: RING_CENTRE + half,
    };
  }

  /*
   * Placement inside one wedge: a polar grid, one cell per point, filled
   * from the inside of each band outwards with the members sorted
   * largest first, and each part-filled row centred in its wedge.
   *
   * The same three properties placeInRegion has, for the same reasons.
   * Nothing overlaps, because every point owns a cell. The order is
   * total, so the picture is identical on every load and nothing here is
   * random. And cellSpan is written, so radiusAt() can cap a dot to its
   * own cell and the packed Latin wedge reads as a fine dense field at
   * rest instead of one solid mass, separating as the reader zooms.
   *
   * The number of sub-rings inside a band is chosen to make the cells
   * roughly square, which is what keeps a crowded band from becoming a
   * single hairline arc of 400 points.
   */
  function placeInSector(reg, members) {
    if (!members.length || !ringBands.length) return;
    const byBand = {};
    for (let k = 0; k < members.length; k++) {
      const i = members[k];
      const b = Math.min(ringBands.length - 1, bandOf(sortMetric(nodes[i])));
      if (!byBand[b]) byBand[b] = [];
      byBand[b].push(i);
    }
    const aSpan = reg.a1 - reg.a0;

    Object.keys(byBand).forEach((bk) => {
      const band = ringBands[Number(bk)];
      if (!band) return;
      const list = byBand[bk].slice().sort((p, q) => {
        const d = sortMetric(nodes[q]) - sortMetric(nodes[p]);
        return d !== 0 ? d : p - q;
      });
      const m = list.length;
      const thick = band.rOut - band.rIn;
      const arc = aSpan * ((band.rIn + band.rOut) / 2);
      let sub = Math.max(1, Math.round(Math.sqrt((m * thick) / Math.max(1, arc))));
      if (sub > m) sub = m;
      let per = Math.ceil(m / sub);
      // Rounding can leave a whole empty sub-ring; pull them in until
      // the grid is no deeper than it needs to be.
      while (sub > 1 && (sub - 1) * per >= m) {
        sub -= 1;
        per = Math.ceil(m / sub);
      }
      const rowH = thick / sub;
      const aStep = aSpan / per;

      for (let k = 0; k < m; k++) {
        const i = list[k];
        const row = Math.floor(k / per);
        const col = k % per;
        const inRow = Math.min(per, m - row * per);
        // Centred in the wedge, so a part-filled row reads as a centred
        // group rather than as a row shoved against one edge.
        const offset = (per - inRow) / 2;
        const r = band.rIn + (row + 0.5) * rowH;
        const a = reg.a0 + (offset + col + 0.5) * aStep;
        posX[i] = RING_CENTRE + r * Math.cos(a);
        posY[i] = RING_CENTRE + r * Math.sin(a);
        cellSpan[i] = Math.min(rowH, aStep * r);
      }
    });
  }

  function positionNodes() {
    if (posX.length !== nodes.length) {
      posX = new Float64Array(nodes.length);
      posY = new Float64Array(nodes.length);
      cellSpan = new Float64Array(nodes.length);
    }
    if (!nodes.length) {
      regions = [];
      ringBands = [];
      bounds = null;
      return;
    }
    ringBands = [];
    // The rings arrangement is the only one that needs no stage box at
    // all: its geometry is world units throughout, so it is the same
    // board before and after the first measure. The regional one does
    // need the box, to choose its column count, so before the first
    // measure there is nothing to choose from and the embedding is the
    // only honest answer.
    if (layout === LAYOUT_RINGS && citeMode) layoutRings();
    else if (layout === LAYOUT_REGIONS && cssW > 0 && cssH > 0) layoutRegions();
    else layoutSimilarity();
  }

  /* ── Drawing ──────────────────────────────────────────────────────
   *
   * Synchronous, not deferred through requestAnimationFrame. rAF does
   * not fire in a hidden tab (FRONTEND §6.30) and a map that has to be
   * verifiable in a harness cannot afford a draw path that never runs
   * there. The cost does not need it: edges go out as four batched
   * paths, one per alpha tier, rather than 3,753 separate strokes, and
   * the nodes are grouped by colour so fillStyle changes eight times
   * rather than 2,600.
   */
  const EDGE_TIERS = [
    { max: 0.5, alpha: 0.07 },
    { max: 0.65, alpha: 0.11 },
    { max: 0.8, alpha: 0.17 },
    { max: Infinity, alpha: 0.26 },
  ];

  /* The citation graph's two line kinds, and the tiers are on COUNTS
   * rather than on a 0-to-1 similarity, so they cannot share a table
   * with the four above.
   *
   * Two channels carry the difference between a debt and an argument,
   * and neither of them is colour alone (WCAG 1.4.1). An argument is
   * DASHED, which survives at one pixel and survives any colour vision;
   * and it is drawn in ink rather than in the muted edge grey, at three
   * to four times the alpha, which it can afford because arguments are
   * rare. No new colour token was invented for it: the palette is
   * closed (DESIGN §6.5) and ink against muted grey is already a real
   * difference in value.
   */
  const CITE_EDGE_TIERS = [
    { max: 24, alpha: 0.07 },
    { max: 99, alpha: 0.11 },
    { max: 499, alpha: 0.17 },
    { max: Infinity, alpha: 0.26 },
  ];
  const ARG_EDGE_TIERS = [
    { max: 24, alpha: 0.22 },
    { max: 99, alpha: 0.34 },
    { max: Infinity, alpha: 0.5 },
  ];
  const ARG_DASH = [3, 3];

  // A pair the citation index reads as an argument: refutations
  // outnumber agreements. Nothing arrives pre-classified, so this test
  // is the only definition and every surface that uses the word reads
  // it from here.
  function isArgument(e) {
    return !!e && e[3] * 2 > e[2];
  }

  /*
   * A point whose refutations come from almost nobody. Augustinus
   * Reding is 84% refuted and every one of those 2,680 refutations is
   * Johann Heinrich Heidegger; Bellarmine's 24,899 come from 267
   * different authors. Drawn as a hollow ring rather than a filled dot,
   * so a single-source spike near the contested centre does not read as
   * a consensus verdict at a glance.
   *
   * Contested view only. In the cited view it would be a mark about a
   * number the map is not drawing.
   */
  const LONE_REFUTERS = 3;

  function isLoneSpike(i) {
    if (!citeMode || view !== "contested") return false;
    if (!nodes[i] || !nodes[i].ref) return false;
    return refuters.length > i && refuters[i] > 0 && refuters[i] < LONE_REFUTERS;
  }

  function draw() {
    if (!cssW || !cssH) return;
    ctx.clearRect(0, 0, cssW, cssH);
    if (!nodes.length) return;

    const s = scale();
    const margin = 40;

    // The section names and their hairlines go down FIRST, under the
    // edges and under the points, so the furniture never sits on top of
    // the data. Nothing is drawn there but a rule and a caption above
    // the plot box, so there is nothing for a point to collide with.
    drawRegionFurniture(s);
    drawRingFurniture(s);

    // Screen positions once per frame; the edge pass and the node pass
    // both need them.
    const px = new Float64Array(nodes.length);
    const py = new Float64Array(nodes.length);
    const onScreen = new Uint8Array(nodes.length);
    for (let i = 0; i < nodes.length; i++) {
      const x = (posX[i] - cx) * s + cssW / 2 + panX;
      const y = (posY[i] - cy) * s + cssH / 2 + panY;
      px[i] = x;
      py[i] = y;
      onScreen[i] = x >= -margin && x <= cssW + margin && y >= -margin && y <= cssH + margin ? 1 : 0;
    }

    // Edges. An edge is drawn only when both of its ends are showing:
    // if either end's category is switched off the edge goes with it,
    // so the legend filter cannot leave a line hanging off a point that
    // is no longer there.
    //
    // Held back in the regional arrangement. There, an edge no longer
    // reinforces a cluster the eye already sees; it crosses the plate
    // from one section to another, and 3,753 of them at the alphas the
    // embedding wants would be a grey wash over the regions. The reader
    // can also switch them off outright.
    const edgeFade = layout === LAYOUT_REGIONS || layout === LAYOUT_RINGS ? 0.55 : 1;
    if (edgesOn) {
      if (citeMode) drawCiteEdges(px, py, onScreen, edgeFade);
      else {
        ctx.lineWidth = 1;
        ctx.strokeStyle = edgeColor;
        for (let t = 0; t < EDGE_TIERS.length; t++) {
          const tier = EDGE_TIERS[t];
          const lo = t === 0 ? -Infinity : EDGE_TIERS[t - 1].max;
          ctx.globalAlpha = tier.alpha * edgeFade;
          ctx.beginPath();
          let any = false;
          for (let i = 0; i < edges.length; i++) {
            const e = edges[i];
            const w = e[2];
            if (!(w > lo && w <= tier.max)) continue;
            const a = e[0];
            const b = e[1];
            if (!onScreen[a] && !onScreen[b]) continue;
            if (!isVisible(nodes[a]) || !isVisible(nodes[b])) continue;
            ctx.moveTo(px[a], py[a]);
            ctx.lineTo(px[b], py[b]);
            any = true;
          }
          if (any) ctx.stroke();
        }
        ctx.globalAlpha = 1;
      }
    }

    // Filtered-out points stay on the map as faint marks. Removing them
    // outright would make the shelf appear to lose half its contents
    // whenever the legend is used.
    ctx.globalAlpha = 0.25;
    ctx.fillStyle = ghostColor;
    ctx.beginPath();
    let anyGhost = false;
    for (let i = 0; i < nodes.length; i++) {
      if (!onScreen[i] || isVisible(nodes[i])) continue;
      ctx.moveTo(px[i] + 2, py[i]);
      ctx.arc(px[i], py[i], 2, 0, Math.PI * 2);
      anyGhost = true;
    }
    if (anyGhost) ctx.fill();
    ctx.globalAlpha = 1;

    // Each moveTo before an arc is load-bearing: without it, canvas
    // joins consecutive arcs in one path with a straight line.
    for (let c = 0; c < catColors.length; c++) {
      ctx.fillStyle = catColors[c];
      ctx.beginPath();
      let any = false;
      for (let i = 0; i < nodes.length; i++) {
        if (!onScreen[i]) continue;
        const node = nodes[i];
        if (!isVisible(node) || slotOf(node) !== c) continue;
        // Drawn hollow in the pass below instead, so the mark reads at
        // a glance rather than only in the rail.
        if (isLoneSpike(i)) continue;
        const r = radiusAt(i);
        ctx.moveTo(px[i] + r, py[i]);
        ctx.arc(px[i], py[i], r, 0, Math.PI * 2);
        any = true;
      }
      if (any) ctx.fill();
    }

    /* The single-refuter mark, on the contested map only. Hollow, in
     * the tradition's own colour, so the point keeps saying which
     * tradition it belongs to while also saying that the count behind
     * its position came from one or two people rather than from a room.
     *
     * Floored at 3.2px whatever the size ramp asks for. A hole smaller
     * than that is not a hole, and a mark that disappears on exactly
     * the small points it most needs to qualify would be worse than no
     * mark at all. The cost is under two pixels of size fidelity on the
     * smallest dots, and the rail carries the exact figures anyway. */
    if (citeMode && view === "contested") {
      ctx.lineWidth = 1.6;
      for (let c = 0; c < catColors.length; c++) {
        ctx.strokeStyle = catColors[c];
        ctx.beginPath();
        let any = false;
        for (let i = 0; i < nodes.length; i++) {
          if (!onScreen[i] || !isLoneSpike(i)) continue;
          const node = nodes[i];
          if (!isVisible(node) || slotOf(node) !== c) continue;
          const r = Math.max(radiusAt(i), 3.2);
          ctx.moveTo(px[i] + r, py[i]);
          ctx.arc(px[i], py[i], r, 0, Math.PI * 2);
          any = true;
        }
        if (any) ctx.stroke();
      }
    }

    // Unclassified: an open ring. "We do not know" is not one of the
    // seven answers and must not be painted as though it were.
    ctx.strokeStyle = edgeColor;
    ctx.lineWidth = 1.4;
    ctx.beginPath();
    let anyRing = false;
    for (let i = 0; i < nodes.length; i++) {
      if (!onScreen[i]) continue;
      const node = nodes[i];
      if (!isVisible(node) || slotOf(node) >= 0) continue;
      const r = radiusAt(i);
      ctx.moveTo(px[i] + r, py[i]);
      ctx.arc(px[i], py[i], r, 0, Math.PI * 2);
      anyRing = true;
    }
    if (anyRing) ctx.stroke();

    /* The marked link, drawn ON TOP of the points rather than under
     * them with the rest of the field. A line the reader is pointing at
     * has stopped being background and has to be followable across a
     * crowded region.
     *
     * In INK at 2px, not in the accent. The accent is 2.38:1 on this
     * cream and fails WCAG 1.4.11 as a graphical object, which is why
     * it was kept out of the category ramp; ink is 12.56:1 and is
     * unmistakable against a field drawn at 0.07 to 0.26 alpha. The
     * accent still does its one job, marking the ends of the link the
     * reader CHOSE as opposed to the one they are merely over.
     *
     * Drawn whether or not the field is switched on. On the merged
     * shelf the lines start hidden, and being able to pull up one link
     * at a time without the wash is the good way to read that map. */
    const markEdge = hoveredEdge >= 0 ? hoveredEdge : selectedEdge;
    if (markEdge >= 0 && markEdge < edges.length) {
      const me = edges[markEdge];
      const ma = me[0];
      const mb = me[1];
      if (isVisible(nodes[ma]) && isVisible(nodes[mb])) {
        ctx.strokeStyle = inkColor;
        ctx.lineWidth = 2;
        // The marked line keeps the dash when it is an argument, so the
        // thing the reader picked out of the field is still the thing
        // they saw in it.
        if (citeMode && isArgument(me)) ctx.setLineDash([5, 4]);
        ctx.beginPath();
        ctx.moveTo(px[ma], py[ma]);
        ctx.lineTo(px[mb], py[mb]);
        ctx.stroke();
        ctx.setLineDash([]);
        // Direction, which nothing in the resting field can carry: an
        // arrowhead at one pixel is not an arrowhead. On the marked
        // line it is legible, and this is the one place the map itself
        // can say "this one cites that one" rather than leaving it to
        // the plate.
        if (citeMode) arrowHead(px[ma], py[ma], px[mb], py[mb], radiusAt(mb) + 5);
        const endColor = markEdge === selectedEdge ? accentColor : inkColor;
        ring(px[ma], py[ma], radiusAt(ma) + 4, endColor, 2);
        ring(px[mb], py[mb], radiusAt(mb) + 4, endColor, 2);
      }
    }

    /* The compared pair, drawn ON TOP of everything the field put down,
     * for the same reason the marked link is: two points chosen out of
     * 1,668 have to be findable without hunting.
     *
     * THE TIE IS TWO DIFFERENT MARKS and the difference is the honest
     * part. Where the two ends have a published edge, that edge is
     * redrawn exactly as a marked edge is (ink, 2px, the argument dash
     * kept, the direction arrow kept), so the tie says only what the
     * map already said. Where there is none, a round-capped DOT every
     * six pixels at half alpha: it resembles no edge tier in either
     * dataset, it is half the weight of the tie that means something,
     * and it carries no arrowhead, because a direction is precisely
     * what is not known here. It is a guide between two points the
     * reader picked and it must never be read as a measurement; the
     * plate over it says so in words and the rail says it again.
     *
     * While the pair is only half chosen, the held point still wears
     * the mark alone. That is the on-map half of the armed state, and
     * below 980px the rail is under the map, so it is the half a reader
     * scrolling back up to tap actually sees. */
    if (compareA >= 0 && compareA < nodes.length && isVisible(nodes[compareA])) {
      const paired =
        compareB >= 0 && compareB < nodes.length && isVisible(nodes[compareB]);
      if (paired) {
        const f = compareFacts(compareA, compareB);
        const tie = f ? f.edge : -1;
        if (tie >= 0) {
          const te = edges[tie];
          ctx.strokeStyle = inkColor;
          ctx.lineWidth = 2;
          if (citeMode && isArgument(te)) ctx.setLineDash([5, 4]);
          ctx.beginPath();
          ctx.moveTo(px[te[0]], py[te[0]]);
          ctx.lineTo(px[te[1]], py[te[1]]);
          ctx.stroke();
          ctx.setLineDash([]);
          if (citeMode) {
            arrowHead(px[te[0]], py[te[0]], px[te[1]], py[te[1]], radiusAt(te[1]) + 5);
          }
        } else {
          /* DOTTED, not dashed, and the difference is the whole signal.
           * Measured against the field it sits in: the Scripture tiers
           * are solid grey at 0.07 to 0.26 alpha, the citation tiers
           * the same, and an argument is a [3,3] dash. A 1px dot every
           * six pixels matches none of those at any weight. Ink rather
           * than the ghost tan, which is 1.3:1 on this cream and
           * disappears entirely over a busy wedge, which would fail the
           * one thing this mark is for. */
          ctx.strokeStyle = inkColor;
          ctx.lineWidth = 1.5;
          ctx.globalAlpha = 0.5;
          ctx.setLineDash([1, 5]);
          ctx.lineCap = "round";
          ctx.beginPath();
          ctx.moveTo(px[compareA], py[compareA]);
          ctx.lineTo(px[compareB], py[compareB]);
          ctx.stroke();
          ctx.setLineDash([]);
          ctx.lineCap = "butt";
          ctx.globalAlpha = 1;
        }
        pairRing(px[compareB], py[compareB], radiusAt(compareB));
      }
      pairRing(px[compareA], py[compareA], radiusAt(compareA));
    }

    // Selection, then hover. Rings rather than a colour change, so the
    // category colour is never overwritten by interaction state.
    if (selected >= 0 && selected < nodes.length && isVisible(nodes[selected])) {
      ring(px[selected], py[selected], radiusAt(selected) + 4, accentColor, 2);
    }
    if (hovered >= 0 && hovered < nodes.length && hovered !== selected && isVisible(nodes[hovered])) {
      ring(px[hovered], py[hovered], radiusAt(hovered) + 4, inkColor, 1.5);
    }

    /* One plate at a time. A link's plate carries four lines and a
     * point's carries one, and stacking both would cover the very
     * corner of the map they are describing. A point being pointed at
     * wins, since that is the more immediate of the two.
     *
     * A comparison outranks a SELECTED link (the two are mutually
     * exclusive in any case) but not a HOVERED one: a line under the
     * pointer right now is the more immediate thing, exactly as a dot
     * under the pointer is. With no comparison open this branch is
     * inert and the order below is what it has always been. */
    if (hovered < 0 && hoveredEdge < 0 && compareA >= 0 && compareA < nodes.length) {
      if (drawComparePlate(px, py)) return;
    }
    if (hovered < 0 && markEdge >= 0 && markEdge < edges.length) {
      const me = edges[markEdge];
      if (isVisible(nodes[me[0]]) && isVisible(nodes[me[1]])) {
        drawEdgePlate(markEdge, px[me[0]], py[me[0]], px[me[1]], py[me[1]]);
        return;
      }
    }

    const labelFor = hovered >= 0 ? hovered : selected;
    if (labelFor >= 0 && labelFor < nodes.length && isVisible(nodes[labelFor])) {
      drawLabel(nodePlateLines(labelFor), px[labelFor], py[labelFor], radiusAt(labelFor));
    }
  }

  /* What a point's plate says. One line on the Scripture maps, which is
   * what it has always been. Two on the citation maps, because the
   * count a point is placed by is the whole of what the reader is
   * pointing at, and on the contested map that count is not safe to
   * show without the number of authors behind it. */
  function nodePlateLines(i) {
    const node = nodes[i];
    if (!node) return [];
    const name = node.a || "Untitled";
    if (!citeMode) return [name];
    if (view === "contested") {
      if (!node.ref) return [name, "Never refuted"];
      const by = refuters.length > i ? refuters[i] : 0;
      return [
        name,
        `${fmt(node.ref)} ${node.ref === 1 ? "refutation" : "refutations"} from ${fmt(by)} ${by === 1 ? "author" : "authors"}`,
      ];
    }
    if (!node.pos) return [name, "Never cited"];
    return [
      name,
      `${fmt(node.pos)} ${node.pos === 1 ? "citation" : "citations"} from ${fmt(node.src)} ${node.src === 1 ? "author" : "authors"}`,
    ];
  }

  /*
   * A small filled triangle on the segment, set back from the cited end
   * by that point's own radius so it sits against the dot rather than
   * on it. Nothing is drawn for a zero-length segment: two points on
   * one coordinate have no direction to point in and normalising there
   * divides by zero.
   */
  function arrowHead(ax, ay, bx, by, back) {
    const vx = bx - ax;
    const vy = by - ay;
    const len = Math.sqrt(vx * vx + vy * vy);
    if (!(len > back + 6)) return;
    const ux = vx / len;
    const uy = vy / len;
    const tipX = bx - ux * back;
    const tipY = by - uy * back;
    const size = 7;
    const wing = 3.4;
    ctx.fillStyle = inkColor;
    ctx.beginPath();
    ctx.moveTo(tipX, tipY);
    ctx.lineTo(tipX - ux * size - uy * wing, tipY - uy * size + ux * wing);
    ctx.lineTo(tipX - ux * size + uy * wing, tipY - uy * size - ux * wing);
    ctx.closePath();
    ctx.fill();
  }

  /* ── The rings' own furniture ─────────────────────────────────────
   *
   * A radial log axis and one wedge label per tradition, both drawn
   * UNDER the edges and the points like the regional furniture above,
   * so nothing structural ever sits on top of the data.
   *
   * The axis is a circle at each decade boundary with the round number
   * it stands for, drawn straight up from the centre in the gutter
   * layoutRings leaves empty at twelve o'clock. That gutter is why the
   * numbers are readable at all: a label in a wedge would be sitting on
   * whatever points are behind it, and a paper-coloured plate under it
   * would be erasing them.
   *
   * The wedge names run ALONG the arc just inside the rim rather than
   * horizontally outside it. Horizontal labels need a reserved margin
   * in world units, and world units are scaled: at 1280 there is room
   * for one and at 375 the same reservation would eat a third of the
   * plate. Text on the arc costs no margin at all, and it is clipped to
   * the arc it has, exactly as a region's name is clipped to its
   * column. Where nothing fits, the swatch alone is drawn and the
   * legend below the map carries every name in full.
   */
  function drawRingFurniture(s) {
    if (layout !== LAYOUT_RINGS || !ringBands.length || !regions.length) return;
    const ox = (RING_CENTRE - cx) * s + cssW / 2 + panX;
    const oy = (RING_CENTRE - cy) * s + cssH / 2 + panY;
    ctx.font = '12px "Source Serif Pro", Georgia, serif';

    // The rim, then each decade boundary inside it.
    ctx.strokeStyle = edgeColor;
    ctx.lineWidth = 1;
    ctx.globalAlpha = 0.22;
    ctx.beginPath();
    ctx.moveTo(ox + RING_MAX * s, oy);
    ctx.arc(ox, oy, RING_MAX * s, 0, Math.PI * 2);
    for (let b = 0; b < ringBands.length; b++) {
      const r = ringBands[b].rIn * s;
      if (r <= 1) continue;
      ctx.moveTo(ox + r, oy);
      ctx.arc(ox, oy, r, 0, Math.PI * 2);
    }
    ctx.stroke();

    // The wedge boundaries, quieter still: they separate rather than
    // measure, and at ten of them a full-strength spoke would read as a
    // wheel drawn over the data.
    ctx.globalAlpha = 0.14;
    ctx.beginPath();
    for (let i = 0; i < regions.length; i++) {
      const a = regions[i].a0;
      ctx.moveTo(ox + Math.cos(a) * RING_MIN * s, oy + Math.sin(a) * RING_MIN * s);
      ctx.lineTo(ox + Math.cos(a) * RING_MAX * s, oy + Math.sin(a) * RING_MAX * s);
    }
    ctx.stroke();
    ctx.globalAlpha = 1;

    // The axis numbers, in the gutter. Each sits just above the circle
    // it labels, which is the boundary rather than the band, so "1,000"
    // means the thousand mark and everything inside it has more.
    ctx.textAlign = "center";
    ctx.textBaseline = "bottom";
    ctx.fillStyle = edgeColor;
    for (let b = 0; b < ringBands.length - 1; b++) {
      const r = ringBands[b].rIn * s;
      if (r <= 14) continue;
      const y = oy - r;
      if (y < 12 || y > cssH - 2) continue;
      ctx.fillText(fmt(ringBands[b].mark), ox, y - 3);
    }

    // The wedge names, on the arc.
    ctx.textBaseline = "middle";
    for (let i = 0; i < regions.length; i++) {
      const reg = regions[i];
      const off = !!hiddenCats[reg.key];
      const mid = (reg.a0 + reg.a1) / 2;
      const rLabel = (RING_MAX + RING_LABEL_OUT) * s;
      if (rLabel <= 8) continue;
      const lx = ox + Math.cos(mid) * rLabel;
      const ly = oy + Math.sin(mid) * rLabel;
      if (lx < -40 || lx > cssW + 40 || ly < -40 || ly > cssH + 40) continue;

      const room = (reg.a1 - reg.a0) * rLabel - 16;
      const full = `${reg.label} · ${fmt(reg.count)}`;
      const text =
        ctx.measureText(full).width <= room ? full : clipToWidth(reg.label, room);
      ctx.save();
      ctx.translate(lx, ly);
      // Upright rather than upside down on the bottom half. The tangent
      // is the angle plus a quarter turn; past the horizontal it has to
      // be the angle minus one, or half the wheel reads inverted.
      ctx.rotate(Math.sin(mid) > 0 ? mid - Math.PI / 2 : mid + Math.PI / 2);
      ctx.globalAlpha = off ? 0.4 : 1;
      if (text) {
        ctx.fillStyle = inkColor;
        ctx.fillText(text, 0, 0);
      } else {
        // No room for the name at this scale. The swatch still says
        // which wedge this is, and zooming brings the name back.
        const slot = catIndex[reg.key];
        if (typeof slot === "number") {
          ctx.fillStyle = catColors[slot % catColors.length];
          ctx.beginPath();
          ctx.arc(0, 0, 3.5, 0, Math.PI * 2);
          ctx.fill();
        } else {
          ctx.strokeStyle = edgeColor;
          ctx.lineWidth = 1.4;
          ctx.beginPath();
          ctx.arc(0, 0, 3.2, 0, Math.PI * 2);
          ctx.stroke();
        }
      }
      ctx.restore();
    }
    ctx.globalAlpha = 1;
    ctx.textAlign = "left";
    ctx.textBaseline = "alphabetic";
  }

  /*
   * The citation field. Two passes rather than one, because the two
   * line kinds mean different things and are tiered on different
   * numbers: a citation line is weighted by how many citations the pair
   * carries, an argument line by how many refutations. Arguments go
   * down SECOND so they sit on top of the field they are the exception
   * to, which is 911 of 37,427 pairs.
   *
   * Both respect the same three gates the Scripture field does, plus
   * the budget: an edge is drawn only when it is in the reader's chosen
   * set, when at least one end is on screen, and when neither end's
   * tradition is switched off in the legend.
   */
  function drawCiteEdges(px, py, onScreen, edgeFade) {
    ctx.lineWidth = 1;

    ctx.strokeStyle = edgeColor;
    for (let t = 0; t < CITE_EDGE_TIERS.length; t++) {
      const tier = CITE_EDGE_TIERS[t];
      const lo = t === 0 ? -Infinity : CITE_EDGE_TIERS[t - 1].max;
      ctx.globalAlpha = tier.alpha * edgeFade;
      ctx.beginPath();
      let any = false;
      for (let i = 0; i < edges.length; i++) {
        if (!edgeShown(i)) continue;
        const e = edges[i];
        if (isArgument(e)) continue;
        const w = e[2];
        if (!(w > lo && w <= tier.max)) continue;
        const a = e[0];
        const b = e[1];
        if (!onScreen[a] && !onScreen[b]) continue;
        if (!isVisible(nodes[a]) || !isVisible(nodes[b])) continue;
        ctx.moveTo(px[a], py[a]);
        ctx.lineTo(px[b], py[b]);
        any = true;
      }
      if (any) ctx.stroke();
    }

    ctx.strokeStyle = inkColor;
    ctx.setLineDash(ARG_DASH);
    for (let t = 0; t < ARG_EDGE_TIERS.length; t++) {
      const tier = ARG_EDGE_TIERS[t];
      const lo = t === 0 ? -Infinity : ARG_EDGE_TIERS[t - 1].max;
      ctx.globalAlpha = tier.alpha * edgeFade;
      ctx.beginPath();
      let any = false;
      for (let i = 0; i < edges.length; i++) {
        if (!edgeShown(i)) continue;
        const e = edges[i];
        if (!isArgument(e)) continue;
        const w = e[3];
        if (!(w > lo && w <= tier.max)) continue;
        const a = e[0];
        const b = e[1];
        if (!onScreen[a] && !onScreen[b]) continue;
        if (!isVisible(nodes[a]) || !isVisible(nodes[b])) continue;
        ctx.moveTo(px[a], py[a]);
        ctx.lineTo(px[b], py[b]);
        any = true;
      }
      if (any) ctx.stroke();
    }
    // Left set, every later stroke in the frame inherits it.
    ctx.setLineDash([]);
    ctx.globalAlpha = 1;
  }

  /* ── The regions' own furniture ───────────────────────────────────
   *
   * A hairline across the top of each plot box with the section's name
   * and its count above it. A rule and a caption, which is the theme's
   * editorial row, rather than a bordered box around each section: a box
   * per category would be seven cards on a plate, and cards are not the
   * house language.
   *
   * The name is drawn at a fixed 12px and clipped to the width the
   * region actually occupies on screen, so a section too narrow to hold
   * "Catholic Epistles & Revelation" at the fitted scale shows as much
   * of it as fits and the whole name as the reader zooms in. The count
   * is measured first and never clipped: it is the shorter fact and the
   * more useful one when there is no room for both.
   */
  function clipToWidth(text, maxW) {
    if (maxW <= 4) return "";
    if (ctx.measureText(text).width <= maxW) return text;
    let s = text;
    while (s.length > 1 && ctx.measureText(`${s}…`).width > maxW) s = s.slice(0, -1);
    const out = `${s}…`;
    return ctx.measureText(out).width <= maxW ? out : "";
  }

  function drawRegionFurniture(s) {
    if (layout !== LAYOUT_REGIONS || !regions.length) return;
    ctx.font = '12px "Source Serif Pro", Georgia, serif';
    ctx.textBaseline = "alphabetic";

    for (let i = 0; i < regions.length; i++) {
      const reg = regions[i];
      const x0 = (reg.x - cx) * s + cssW / 2 + panX;
      const w = reg.w * s;
      const yTop = (reg.y - cy) * s + cssH / 2 + panY;
      const h = reg.h * s;
      if (x0 > cssW + 8 || x0 + w < -8 || yTop > cssH + 8 || yTop + h < -8) continue;

      // The hairline sits on the top edge of the plot box, which is
      // where the points start; the name sits above it, in the strip.
      const ruleY = Math.round((reg.plotY - cy) * s + cssH / 2 + panY) - 0.5;
      const off = !!hiddenCats[reg.key];

      ctx.strokeStyle = edgeColor;
      ctx.lineWidth = 1;
      ctx.globalAlpha = off ? 0.12 : 0.3;
      ctx.beginPath();
      ctx.moveTo(x0, ruleY);
      ctx.lineTo(x0 + w, ruleY);
      ctx.stroke();
      ctx.globalAlpha = 1;

      const baseline = ruleY - 7;
      if (baseline < 10 || baseline > cssH) continue;

      // The same swatch the legend shows, so a section, its legend row
      // and its dots are one thing. Unclassified keeps its open ring
      // here too: "we do not know" is not one of the colours.
      const slot = catIndex[reg.key];
      const dotX = x0 + 4.5;
      const dotY = baseline - 4;
      ctx.globalAlpha = off ? 0.4 : 1;
      if (typeof slot === "number") {
        ctx.fillStyle = catColors[slot % catColors.length];
        ctx.beginPath();
        ctx.arc(dotX, dotY, 3.5, 0, Math.PI * 2);
        ctx.fill();
      } else {
        ctx.strokeStyle = edgeColor;
        ctx.lineWidth = 1.4;
        ctx.beginPath();
        ctx.arc(dotX, dotY, 3.2, 0, Math.PI * 2);
        ctx.stroke();
      }

      const textX = dotX + 8;
      const room = x0 + w - textX;
      const countText = ` · ${fmt(reg.count)}`;
      const countW = ctx.measureText(countText).width;
      const name = clipToWidth(reg.label, room - countW);
      ctx.fillStyle = inkColor;
      if (name) {
        ctx.fillText(name, textX, baseline);
        ctx.fillStyle = edgeColor;
        ctx.fillText(countText, textX + ctx.measureText(name).width, baseline);
      } else if (room >= countW) {
        // No room for the name. The count and the swatch still say
        // which section this is and how much is in it; the legend below
        // the map carries every name in full.
        ctx.fillStyle = edgeColor;
        ctx.fillText(fmt(reg.count), textX, baseline);
      }
      ctx.globalAlpha = 1;
    }
  }

  function ring(x, y, r, color, width) {
    ctx.beginPath();
    ctx.strokeStyle = color;
    ctx.lineWidth = width;
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.stroke();
  }

  /* The pair mark: TWO rings, and the second one is the whole of the
   * signal. A selected point already wears one accent ring and a
   * hovered point one ink ring, so a third colour would have been the
   * obvious move and the wrong one. The palette is closed (DESIGN §6.5)
   * and, more to the point, a mark that differs from its neighbours
   * only in hue is a mark some readers do not have (WCAG 1.4.1). A
   * COUNT of rings is legible to everyone.
   *
   * The inner ring keeps the accent at exactly the radius and weight a
   * plain selection uses, so a compared point still reads as chosen;
   * the outer one is ink, which is 12.56:1 on this cream against the
   * accent's 2.38:1, so the mark holds up on the smallest dots where
   * the accent alone would not.
   */
  function pairRing(x, y, r) {
    ring(x, y, r + 4, accentColor, 2);
    ring(x, y, r + 9, inkColor, 1.2);
  }

  /*
   * The hover label is painted on the canvas rather than positioned as
   * a DOM tooltip: it cannot then be clipped by the stage's overflow,
   * cannot force a layout on every pointer move, and cannot sit under
   * the pointer and swallow the click. The screen-reader path is the
   * index list further down, not this.
   *
   * Drawn from the top of the line box (textBaseline "top") so the
   * plate is exactly the height of the text and the two cannot drift
   * apart (FRONTEND §6.34).
   */
  function drawLabel(text, x, y, r) {
    const fontSize = 12;
    const lead = 16;
    ctx.font = `${fontSize}px "Source Serif Pro", Georgia, serif`;
    ctx.textBaseline = "top";
    const padX = 7;
    const padY = 5;
    // One line on the Scripture maps and two on the citation maps, so
    // the plate is measured rather than assumed. Clipped to the STAGE
    // for the same reason the link plate is: at 375px the stage is
    // 335px wide and an early-modern name is not.
    const room = Math.max(60, cssW - 40 - padX * 2);
    const raw = Array.isArray(text) ? text : [text];
    const lines = [];
    let widest = 0;
    for (let i = 0; i < raw.length; i++) {
      const s = clipToWidth(String(raw[i] == null ? "" : raw[i]).slice(0, 120), room);
      if (!s) continue;
      const wl = ctx.measureText(s).width;
      if (wl > widest) widest = wl;
      lines.push(s);
    }
    if (!lines.length) return;
    const w = widest + padX * 2;
    // Unchanged at 24px for one line, which is what it has always been.
    const h = padY * 2 + (lines.length - 1) * lead + fontSize + 2;

    let lx = x + r + 8;
    let ly = y - h / 2;
    // Flip and clamp rather than letting the plate run off the stage.
    if (lx + w > cssW - 4) lx = x - r - 8 - w;
    if (lx < 4) lx = 4;
    if (ly < 4) ly = 4;
    if (ly + h > cssH - 4) ly = Math.max(4, cssH - 4 - h);

    ctx.globalAlpha = 0.94;
    ctx.fillStyle = inkColor;
    ctx.fillRect(lx, ly, w, h);
    ctx.globalAlpha = 1;
    ctx.fillStyle = paperColor;
    for (let i = 0; i < lines.length; i++) {
      ctx.fillText(lines[i], lx + padX, ly + padY + i * lead);
    }
  }

  /* ── The plate for a link ─────────────────────────────────────────
   *
   * The same plate as a point's, taller. Painted on the canvas for the
   * same three reasons: the stage's overflow cannot clip it, it forces
   * no layout on a pointer move, and it cannot sit under the pointer
   * and swallow the click that was about to select the thing it
   * describes. The dossier in the rail is the accessible copy of all of
   * this, and the persistent one.
   *
   * Anchored at the segment's MIDPOINT rather than at the pointer.
   * Following the pointer along a line makes the plate jitter over the
   * whole plate; anchoring it to the thing it is about holds it still
   * while the reader traces the line, and the ends are ringed anyway.
   */
  function edgePlateLines(j) {
    const f = edgeFacts(j);
    if (!f) return [];

    /* The citation plate. Direction is on its own line and in the verb,
     * because "A and B" is the one thing this edge does not say; and
     * both halves of the total are given, because a pair that is mostly
     * agreement with a large argument inside it is the shape of the
     * heaviest disputes in this library and a single number hides it.
     * Scotus on Aquinas reads here as 8,829 citations, 7,757 positive
     * and 1,072 refutations, which is the whole point. */
    if (f.cite) {
      const c = f.cite;
      const lines = [
        f.nameA,
        `cites ${f.nameB}`,
        `${fmt(c.total)} ${c.total === 1 ? "citation" : "citations"}`,
      ];
      if (c.ref) {
        lines.push(`${fmt(c.pos)} positive, ${fmt(c.ref)} refutations (${pct(c.share)})`);
        if (c.argument) lines.push("Refutations outnumber agreements");
      } else {
        lines.push("No refutations in this pair");
      }
      return lines;
    }

    const out = [f.nameA, f.nameB];
    out.push(
      f.bothKnown && !f.crosses
        ? `Both in ${f.regionA}`
        : `${f.regionA} to ${f.regionB}`
    );
    out.push(
      `${f.weight.toFixed(2)}, ${f.word}${f.bothKnown && f.crosses ? ", crosses sections" : ""}`
    );
    // Only when the sidecar is there and has both of them. Without it
    // the plate is three facts rather than four, which is the whole of
    // the degradation.
    const res = sharedBooks(f.nameA, f.nameB);
    if (res && res.rows && res.rows.length) {
      const names = res.rows.slice(0, 3).map((r) => bookLabel(r.book)).filter(Boolean);
      if (names.length) out.push(`Both lean on ${names.join(", ")}`);
    }
    return out;
  }

  function drawEdgePlate(j, ax, ay, bx, by) {
    paintPlate(edgePlateLines(j), ax, ay, bx, by);
  }

  /* ── What a comparison says on the plate ──────────────────────────
   *
   * The rail carries the full reading; this is the part that has to fit
   * over the map, so it is the facts a reader is looking at the two
   * dots to check.
   *
   * Both directions are given SEPARATELY on the citation maps and are
   * never added. Augustine cites Jerome 55 times with 3 refuting and
   * Jerome cites Augustine 13 times with none; "68 citations between
   * them" would be a different claim and a false one. Where a direction
   * is missing it is named as under the floor rather than left off,
   * because a line that is simply absent reads as a zero.
   */
  function comparePlateLines(f) {
    if (!f) return [];
    const lines = [`${f.nameA} and ${f.nameB}`];
    if (f.cite) {
      const say = (from, to, ei) => {
        if (ei < 0) return `${from} cites ${to}: under five, not in the graph`;
        const e = edges[ei];
        const ref = e[3]
          ? `, ${fmt(e[3])} refuting`
          : ", none refuting";
        return `${from} cites ${to}: ${fmt(e[2])}${ref}`;
      };
      lines.push(say(f.nameA, f.nameB, f.ab));
      lines.push(say(f.nameB, f.nameA, f.ba));
      if (!f.any) lines.push("Fewer than five citations either way, possibly none");
      return lines;
    }
    if (f.edge >= 0) {
      lines.push(
        `${f.weight.toFixed(2)}, ${f.word}${f.bothKnown && f.crosses ? ", crosses sections" : ""}`
      );
    } else {
      lines.push("No line published for this pair");
    }
    lines.push(
      f.bothKnown && !f.crosses ? `Both in ${f.regionA}` : `${f.regionA} and ${f.regionB}`
    );
    // Named whether or not there is a line: the sidecar answers "what do
    // these two share" on its own, and on a pair with no line it is the
    // only thing that does.
    const res = sharedBooks(f.nameA, f.nameB);
    if (res && res.rows && res.rows.length) {
      const names = res.rows.slice(0, 3).map((r) => bookLabel(r.book)).filter(Boolean);
      if (names.length) lines.push(`Both lean on ${names.join(", ")}`);
    }
    return lines;
  }

  /* Returns whether it painted anything, so draw()'s plate ladder can
   * fall through to the link and point plates when the pair is not
   * currently on the map (a legend filter can take an end away). */
  function drawComparePlate(px, py) {
    if (compareA < 0 || !nodes[compareA] || !isVisible(nodes[compareA])) return false;
    const paired =
      compareB >= 0 && compareB < nodes.length && nodes[compareB] && isVisible(nodes[compareB]);
    if (!paired) {
      // The armed half. Said on the map as well as in the rail, because
      // the rail is under the map on a phone and a reader who has
      // scrolled up to tap can see only this.
      drawLabel(
        [nodes[compareA].a || "Untitled", "Now choose a second point"],
        px[compareA],
        py[compareA],
        radiusAt(compareA)
      );
      return true;
    }
    const lines = comparePlateLines(compareFacts(compareA, compareB));
    if (!lines.length) return false;
    paintPlate(lines, px[compareA], py[compareA], px[compareB], py[compareB], true);
    return true;
  }

  /* `clear` moves the plate OFF the segment instead of centring it on
   * the midpoint. A link's plate can sit on its own line, because that
   * line is 2px of ink and reads clearly on both sides of the plate. A
   * comparison's tie may be a hairline of dots, which is exactly the
   * case where a plate centred on the midpoint hides the mark it is
   * describing, so the comparison asks for the offset and everything
   * else keeps the placement it has always had. */
  function paintPlate(lines, ax, ay, bx, by, clear) {
    if (!lines.length) return;
    const fontSize = 12;
    const lead = 16;
    ctx.font = `${fontSize}px "Source Serif Pro", Georgia, serif`;
    ctx.textBaseline = "top";
    const padX = 8;
    const padY = 7;

    // Clipped to the STAGE, not to a character count. Early-modern
    // titles run to eighty words and a plate wider than the plate it is
    // drawn on cannot be clamped back onto it (MOBILE M2: at 375px the
    // stage is 335px wide and two full titles would be four times
    // that).
    const room = Math.max(60, cssW - 40 - padX * 2);
    let widest = 0;
    const clipped = lines.map((line) => {
      const s = clipToWidth(String(line == null ? "" : line), room);
      const wl = ctx.measureText(s).width;
      if (wl > widest) widest = wl;
      return s;
    });
    const w = widest + padX * 2;
    const h = clipped.length * lead + padY * 2;

    // Off the midpoint, then clamped. A plate that ran off the stage
    // would be cropped by the overflow, and one that overhung the top
    // would take its first line with it.
    const midX = (ax + bx) / 2;
    const midY = (ay + by) / 2;
    let lx = midX + 12;
    let ly = clear ? midY + 16 : midY - h / 2;
    if (lx + w > cssW - 4) lx = midX - 12 - w;
    if (lx < 4) lx = 4;
    // Below the segment where there is room, above it where there is
    // not, and only then clamped. Clamping first would put the plate
    // straight back on top of the mark.
    if (clear && ly + h > cssH - 4) ly = midY - 16 - h;
    if (ly < 4) ly = 4;
    if (ly + h > cssH - 4) ly = Math.max(4, cssH - 4 - h);

    ctx.globalAlpha = 0.94;
    ctx.fillStyle = inkColor;
    ctx.fillRect(lx, ly, w, h);
    ctx.globalAlpha = 1;
    ctx.fillStyle = paperColor;
    for (let i = 0; i < clipped.length; i++) {
      ctx.fillText(clipped[i], lx + padX, ly + padY + i * lead);
    }
  }

  /* ── Hit testing ──────────────────────────────────────────────────
   *
   * A linear scan. At 2,600 nodes that is a few thousand comparisons
   * per pointer move, cheaper than maintaining a quadtree that would
   * have to be rebuilt on every shelf change. Filtered-out points are
   * skipped, so a ghosted mark cannot be clicked.
   */
  function hitTest(mx, my) {
    const s = scale();
    let best = -1;
    let bestDist = Infinity;
    for (let i = 0; i < nodes.length; i++) {
      const node = nodes[i];
      if (!isVisible(node)) continue;
      const dx = mx - ((posX[i] - cx) * s + cssW / 2 + panX);
      const dy = my - ((posY[i] - cy) * s + cssH / 2 + panY);
      const d2 = dx * dx + dy * dy;
      // The drawn radius plus enough slack for a fingertip on the
      // smallest dots. The 11px floor is what keeps a capped dot in a
      // crowded region reachable: the cap shrinks what is drawn, never
      // what can be pressed, and the nearest-wins tiebreak below is
      // what stops a tap in a dense grid picking an arbitrary one.
      const reach = Math.max(radiusAt(i) + 4, 11);
      if (d2 <= reach * reach && d2 < bestDist) {
        bestDist = d2;
        best = i;
      }
    }
    return best;
  }

  /* ── Hit testing a line ───────────────────────────────────────────
   *
   * The hard half. A node is a disc and a hit is one distance; an edge
   * is a thin diagonal and a hit is the distance from the pointer to
   * the nearest point ON THE SEGMENT, which is the projection clamped
   * to the segment's ends. Clamping is what stops the infinite line
   * through two dots in one corner from being "hovered" from the
   * opposite corner.
   *
   * Two rules that are not negotiable and are enforced at the CALL
   * SITES rather than here, so they cannot be forgotten in one of them:
   * a node is tested first and always wins, and where several lines are
   * within tolerance the NEAREST is taken rather than the first found.
   *
   * The tolerance is passed in because a hover and a tap are not the
   * same gesture. 7px for a mouse is generous enough to catch a line
   * without the pointer feeling sticky in a dense region; a tap is
   * deliberate and imprecise, so it gets 16.
   *
   * Cost. The scan is linear, like the node one, but the constant is
   * bigger: 3,753 edges on English Divines works and 17,715 on a merged
   * doctrines map. The bounding-box reject before the projection is
   * what keeps that cheap. Almost every edge fails one of the four
   * comparisons and never reaches the arithmetic, because a segment's
   * box is nowhere near the pointer for all but a handful of them.
   */
  const EDGE_TOL_HOVER = 7;
  const EDGE_TOL_TAP = 16;
  const EDGE_TOL_CLICK = 9;

  function segDist2(px, py, ax, ay, bx, by) {
    const vx = bx - ax;
    const vy = by - ay;
    const wx = px - ax;
    const wy = py - ay;
    const vv = vx * vx + vy * vy;
    // A zero-length segment (two points stacked on one coordinate) is
    // the distance to that point, not a division by zero.
    let t = vv > 0 ? (wx * vx + wy * vy) / vv : 0;
    if (t < 0) t = 0;
    else if (t > 1) t = 1;
    const dx = wx - t * vx;
    const dy = wy - t * vy;
    return dx * dx + dy * dy;
  }

  function hitTestEdge(mx, my, tol) {
    // A line that is not on screen cannot be pointed at. The reader can
    // switch the whole field off, and a hover that still fired there
    // would report something invisible.
    if (!edgesOn || !edges.length || !nodes.length) return -1;
    const s = scale();
    const ox = cssW / 2 + panX;
    const oy = cssH / 2 + panY;
    const tol2 = tol * tol;
    let best = -1;
    let bestDist = Infinity;
    for (let i = 0; i < edges.length; i++) {
      // Same rules the drawing uses, in the same order. A line outside
      // the reader's chosen budget is not on the plate, so it must not
      // be hoverable either; the alternative is a map that reports
      // something invisible when the pointer happens to cross it.
      if (!edgeShown(i)) continue;
      const e = edges[i];
      const a = e[0];
      const b = e[1];
      // An edge is gone when either end's category is switched off, so
      // the legend cannot leave a line hoverable that is not painted.
      if (!isVisible(nodes[a]) || !isVisible(nodes[b])) continue;
      const ax = (posX[a] - cx) * s + ox;
      const ay = (posY[a] - cy) * s + oy;
      const bx = (posX[b] - cx) * s + ox;
      const by = (posY[b] - cy) * s + oy;
      if (mx < (ax < bx ? ax : bx) - tol || mx > (ax > bx ? ax : bx) + tol) continue;
      if (my < (ay < by ? ay : by) - tol || my > (ay > by ? ay : by) + tol) continue;
      const d2 = segDist2(mx, my, ax, ay, bx, by);
      if (d2 <= tol2 && d2 < bestDist) {
        bestDist = d2;
        best = i;
      }
    }
    return best;
  }

  // A tap and a click are different tolerances, and a stylus is a tap.
  function tapTolerance(e) {
    const t = e && e.pointerType;
    return t === "touch" || t === "pen" ? EDGE_TOL_TAP : EDGE_TOL_CLICK;
  }

  /* ── What a link says ─────────────────────────────────────────────
   *
   * One reader for both surfaces. The plate painted on the canvas and
   * the dossier in the rail must never be able to disagree about a
   * strength or a region, so neither of them reads the edge array. */
  function edgeFacts(i) {
    if (i < 0 || i >= edges.length) return null;
    const e = edges[i];
    const ia = e[0];
    const ib = e[1];
    const a = nodes[ia];
    const b = nodes[ib];
    if (!a || !b) return null;
    const ka = catKeyOf(a);
    const kb = catKeyOf(b);
    const w = Number(e[2]);
    const out = {
      ia,
      ib,
      a,
      b,
      nameA: a.a || "Untitled",
      nameB: b.a || "Untitled",
      regionA: catLabel(ka),
      regionB: catLabel(kb),
      // Two points with no category at all are not "in the same
      // section": neither of them is in one. Unclassified is the
      // absence of an answer, not a seventh answer (see the drawing).
      crosses: ka !== kb || !ka || !kb,
      bothKnown: !!ka && !!kb,
      weight: isFinite(w) ? w : 0,
      word: strengthWord(isFinite(w) ? w : 0),
    };
    if (!citeMode) return out;

    /* The citation graph's edge is a different sentence: directed,
     * counted rather than scored, and carrying a disagreement inside a
     * total. `weight` above is a similarity between 0 and 1 everywhere
     * else and is meaningless here, so `word` is dropped and `cite` is
     * what every citation surface reads instead. Nothing branches on
     * the ARRAY's length to work out which shape it has; it branches on
     * citeMode, which is set from the payload. */
    const ref = Number(e[3]) || 0;
    const total = out.weight;
    out.word = "";
    out.cite = {
      total,
      ref,
      pos: Math.max(0, total - ref),
      share: total > 0 ? ref / total : 0,
      argument: isArgument(e),
      back: reverseEdge(i),
    };
    return out;
  }

  /* ── What joins two points the reader picked ──────────────────────
   *
   * The comparison's one reader, in the same spirit as edgeFacts above:
   * the plate on the canvas and the dossier in the rail both call this
   * and neither of them touches `edges`, so they cannot come apart on a
   * count, a direction or a region.
   *
   * The lookup is different in the two families, and deliberately reuses
   * an index that already exists in each rather than building a third.
   * On the citation graph `reverseAt` is already keyed "from:to", so
   * both directions are two map reads. On a Scripture map the pair is
   * undirected and `adj[ia]` already holds every edge touching that
   * node; those lists run to a few dozen entries, so a scan is cheaper
   * than the pair index it would replace and cannot fall out of date
   * with the payload.
   */
  function directedEdge(a, b) {
    if (!reverseAt) return -1;
    const at = reverseAt.get(`${a}:${b}`);
    return typeof at === "number" ? at : -1;
  }

  function undirectedEdge(a, b) {
    const list = adj[a];
    if (!list) return -1;
    for (let k = 0; k < list.length; k++) {
      const e = edges[list[k]];
      if (!e) continue;
      if ((e[0] === a && e[1] === b) || (e[0] === b && e[1] === a)) return list[k];
    }
    return -1;
  }

  function compareFacts(ia, ib) {
    const a = nodes[ia];
    const b = nodes[ib];
    if (!a || !b || ia === ib) return null;
    const ka = catKeyOf(a);
    const kb = catKeyOf(b);
    const out = {
      ia,
      ib,
      a,
      b,
      nameA: a.a || "Untitled",
      nameB: b.a || "Untitled",
      regionA: catLabel(ka),
      regionB: catLabel(kb),
      // Same rule as a link's: two points with no category are not "in
      // the same section", because neither of them is in one.
      crosses: ka !== kb || !ka || !kb,
      bothKnown: !!ka && !!kb,
      cite: citeMode,
      ab: -1,
      ba: -1,
      edge: -1,
    };
    if (citeMode) {
      out.ab = directedEdge(ia, ib);
      out.ba = directedEdge(ib, ia);
      // The tie drawn on the plate is whichever direction exists. Where
      // both do, the outbound one from the point the reader held first,
      // so the arrowhead agrees with the order the rail lists them in.
      out.edge = out.ab >= 0 ? out.ab : out.ba;
      out.any = out.ab >= 0 || out.ba >= 0;
      return out;
    }
    out.edge = undirectedEdge(ia, ib);
    out.any = out.edge >= 0;
    if (out.edge >= 0) {
      const w = Number(edges[out.edge][2]);
      out.weight = isFinite(w) ? w : 0;
      out.word = strengthWord(out.weight);
    }
    return out;
  }

  function buildAdjacency() {
    adj = new Array(nodes.length);
    for (let i = 0; i < edges.length; i++) {
      const e = edges[i];
      const a = e[0];
      const b = e[1];
      if (!adj[a]) adj[a] = [];
      if (!adj[b]) adj[b] = [];
      adj[a].push(i);
      adj[b].push(i);
    }
    for (let i = 0; i < adj.length; i++) {
      if (!adj[i]) continue;
      // Strongest first, ties broken on the edge index so the list is
      // the same on every load.
      adj[i].sort((p, q) => (edges[q][2] || 0) - (edges[p][2] || 0) || p - q);
    }
  }

  // The links off one node that are still on the map. A category
  // switched off in the legend takes its lines with it, here as well as
  // in the drawing, or the dossier would offer a link to a point the
  // reader has just hidden.
  function visibleLinksFor(i) {
    const list = adj[i];
    if (!list) return [];
    const out = [];
    for (let k = 0; k < list.length; k++) {
      const e = edges[list[k]];
      if (!isVisible(nodes[e[0]]) || !isVisible(nodes[e[1]])) continue;
      out.push(list[k]);
    }
    return out;
  }

  /* ── The book profiles, if there are any ──────────────────────────
   *
   * Progressive enhancement, and it has to be real progressive
   * enhancement rather than the kind that only degrades in theory: the
   * sidecar 404s on every shelf as this is written, so the path with no
   * sidecar is the ONLY path that runs today and it has to be the good
   * one. Nothing below is awaited by the map, nothing surfaces an
   * error, and a link's dossier is complete without any of it.
   *
   * The vocabulary is per-file. A merged map reads fifteen of these and
   * their `books` arrays are not promised to agree, so the merge remaps
   * every index into one shared vocabulary rather than trusting slot 0
   * to mean the same book in all of them.
   */
  function normaliseFingerprint(payload, books, out) {
    if (!payload || typeof payload !== "object") return;
    const vocab = Array.isArray(payload.books) ? payload.books : null;
    const table = payload.fp;
    if (!vocab || !table || typeof table !== "object") return;
    // Local slot -> shared slot, computed once per file.
    const remap = new Array(vocab.length);
    for (let i = 0; i < vocab.length; i++) {
      const slug = typeof vocab[i] === "string" ? vocab[i] : "";
      if (!slug) {
        remap[i] = -1;
        continue;
      }
      let at = books.index[slug];
      if (typeof at !== "number") {
        at = books.list.length;
        books.list.push(slug);
        books.index[slug] = at;
      }
      remap[i] = at;
    }
    const names = Object.keys(table);
    for (let k = 0; k < names.length; k++) {
      const name = names[k];
      const entry = table[name];
      if (!entry || typeof entry !== "object") continue;
      const total = Number(entry.n);
      const pairs = Array.isArray(entry.t) ? entry.t : [];
      if (!isFinite(total) || total <= 0) continue;
      // Where a name arrives from more than one shelf, keep the reading
      // with the most citations behind it, mirroring exactly how the
      // node itself was merged. Two halves of one writer must not be
      // described by one shelf's profile and sized by another's.
      const held = out[name];
      if (held && held.n >= total) continue;
      const counts = {};
      for (let p = 0; p < pairs.length; p++) {
        const pair = pairs[p];
        if (!Array.isArray(pair)) continue;
        const slot = remap[pair[0]];
        const c = Number(pair[1]);
        if (typeof slot !== "number" || slot < 0 || !isFinite(c) || c <= 0) continue;
        counts[slot] = c;
      }
      out[name] = { n: total, counts };
    }
  }

  function fpUrlFor(slug, v) {
    return `${BASE}/${encodeURIComponent(slug)}/${encodeURIComponent(v)}-fp.json`;
  }

  // Cached BOTH ways. A 404 is an answer, and re-asking for it on every
  // shelf switch is fifteen requests for a file that is not there.
  function getFingerprint(url) {
    if (fpCache.has(url)) return Promise.resolve(fpCache.get(url));
    return getJSON(url).then(
      (json) => {
        fpCache.set(url, json);
        return json;
      },
      () => {
        fpCache.set(url, null);
        return null;
      }
    );
  }

  /*
   * Called when edges become relevant, not when the map loads. On a
   * single shelf that is immediately after the payload lands, because
   * links are shown by default there. On the merged shelf links start
   * hidden, so nothing is fetched until the reader turns them on or
   * opens one, and a reader who never touches a line never pays for
   * fifteen requests.
   */
  function ensureFingerprints() {
    // The sidecar is a per-book Scripture profile and the citation
    // graph has no such thing. Asking for it here would spend a request
    // on /constellations/citations/cited-fp.json, which is not a route.
    if (citeMode) return;
    if (!shelfSlug || !view) return;
    const key = `${shelfSlug}/${view}`;
    if (fpKey === key) return;
    fpKey = key;
    fp = null;
    const token = ++fpToken;
    const slugs = isAll ? allShelvesFor(view).map((s) => s.slug) : [shelfSlug];
    if (!slugs.length) return;
    Promise.all(slugs.map((s) => getFingerprint(fpUrlFor(s, view))))
      .then((results) => {
        if (token !== fpToken) return;
        const books = { list: [], index: Object.create(null) };
        const out = Object.create(null);
        results.forEach((r) => normaliseFingerprint(r, books, out));
        if (!books.list.length) return;
        fp = { books: books.list, byName: out };
        // Whatever is on screen was rendered without this and is now
        // out of date by one section. Only the dossier and the plate
        // read it, and a comparison reads it whether or not the pair
        // has a line: naming the books is the whole of what the empty
        // state has to say.
        if (selectedEdge >= 0 || compareB >= 0) refreshDossier();
        if (hoveredEdge >= 0 || compareB >= 0) draw();
      })
      .catch(() => {
        /* Every branch above already swallowed its own failure; this is
           the belt for a throw inside the merge itself. The map is
           unaffected and the dossier stays on its no-sidecar copy. */
      });
  }

  /* ── Settling an empty pair ───────────────────────────────────────
   *
   * The citation graph floors a pair at five, so a pair that is not in
   * `edges` is somewhere between one and four citations, or zero, and
   * the graph cannot tell those apart. v1/reception/full/<fk>.json.gz
   * can: it is one author's COMPLETE outbound record, unfloored, and
   * `to[<other fk>]` either exists with a count or does not exist at
   * all. That is the difference between "four citations, under the
   * floor" and "never names them anywhere in this corpus", which is
   * exactly the distinction the empty state has to avoid asserting for
   * free.
   *
   * OPT-IN, and the reason is weight. Measured on the wire 2026-09-04:
   * jerome 15 KB, augustine-of-hippo 19 KB, gisbertus-voetius 459 KB,
   * francisco-su-rez 1.1 MB. Fetching this on every comparison would
   * spend a megabyte to answer a question most readers are not asking,
   * on a map where the empty pair is the ordinary case. So it sits
   * behind a button whose copy states the cost.
   *
   * OUTBOUND ONLY. "A cites B" lives in A's file, so a pair needs both
   * files to be answered in both directions and they are fetched
   * together.
   *
   * A 404 is a RESOLUTION rather than a failure: coverage is about 92%
   * and the gap is permanent, so the sentinel is cached and never
   * retried. A network failure deletes its entry, so pressing again
   * really does try again. Same shape as loadFull() in
   * assets/js/faith-author-reception.js, which is the file this pattern
   * comes from; the gzip sniff below is that file's lesson and must not
   * be replaced with an assumption.
   */
  const FULL_PATIENCE = 20000;
  const FULL_CACHE_MAX = 2;
  const NOT_PUBLISHED = "cn-not-published";
  const fullCache = new Map();

  /* ".json.gz" is a file name, not a promise about the bytes.
   * Cloudflare re-encodes at the edge and answers `content-type:
   * application/json`, so what reaches fetch() is usually plain JSON
   * the browser has already decoded; handing that to
   * DecompressionStream throws. 1f 8b is the gzip magic. Both paths
   * survive the worker changing its mind about which one it serves. */
  async function gunzipJSON(response) {
    const bytes = new Uint8Array(await response.arrayBuffer());
    const gzipped = bytes.length > 1 && bytes[0] === 0x1f && bytes[1] === 0x8b;
    if (gzipped && typeof window.DecompressionStream === "function") {
      const stream = new Blob([bytes]).stream()
        .pipeThrough(new window.DecompressionStream("gzip"));
      return JSON.parse(await new Response(stream).text());
    }
    return JSON.parse(new TextDecoder().decode(bytes));
  }

  function loadFullReception(fk) {
    if (!fk) return Promise.resolve(NOT_PUBLISHED);
    if (fullCache.has(fk)) return fullCache.get(fk);

    const controller = typeof window.AbortController === "function"
      ? new window.AbortController()
      : null;
    const timer = window.setTimeout(() => {
      if (controller) controller.abort();
    }, FULL_PATIENCE);

    const url = `${FULL_BASE}${encodeURIComponent(fk)}.json.gz`;
    const p = fetch(url, controller ? { signal: controller.signal } : undefined)
      .then((r) => {
        if (r.status === 404) return NOT_PUBLISHED;
        if (!r.ok) throw new Error(`reception/full ${r.status}`);
        return gunzipJSON(r);
      })
      .then((data) => {
        window.clearTimeout(timer);
        return data;
      })
      .catch((err) => {
        window.clearTimeout(timer);
        fullCache.delete(fk);
        throw err;
      });

    fullCache.set(fk, p);
    // Oldest first. The entry just set is by definition the newest, so
    // it can never be the one dropped; two whole files is enough to
    // answer one pair and not enough to hold a megabyte per comparison.
    while (fullCache.size > FULL_CACHE_MAX) {
      const oldest = fullCache.keys().next().value;
      if (oldest === fk) break;
      fullCache.delete(oldest);
    }
    return p;
  }

  /* One direction, resolved. Four outcomes and they are four different
   * sentences, never collapsed into a number (FRONTEND §6.33):
   *
   *   found        a real count, with the refutations inside it
   *   none         the record exists and does not mention them at all
   *   unpublished  this author's record was never published
   *   failed       the fetch did not come back
   *
   * `h` is the extractor's verb and "refutes" is the only one that
   * counts as a refutation, which is the same reading the graph's own
   * `ref` uses: measured on Augustine's file, to.jerome carries 3 rows
   * with h="refutes" against the graph edge's ref of 3.
   */
  function countDirection(fromFk, toFk) {
    if (!fromFk || !toFk) return Promise.resolve({ state: "unpublished" });
    return loadFullReception(fromFk).then(
      (data) => {
        if (data === NOT_PUBLISHED) return { state: "unpublished" };
        const table = data && data.to;
        const entry = table && typeof table === "object" ? table[toFk] : null;
        if (!entry) return { state: "none" };
        const rows = Array.isArray(entry.rows) ? entry.rows : [];
        const total = Number(entry.n);
        let ref = 0;
        for (let i = 0; i < rows.length; i++) {
          if (rows[i] && rows[i].h === "refutes") ref += 1;
        }
        return {
          state: "found",
          n: isFinite(total) && total > 0 ? total : rows.length,
          ref,
        };
      },
      () => ({ state: "failed" })
    );
  }

  /* ── The books two points both lean on ────────────────────────────
   *
   * Proportions, not counts, because `n` runs from a single treatise to
   * a lifetime of annotation and "412 citations of Romans" says nothing
   * without knowing whether that is most of a writer or a rounding
   * error. Each side is given as its own share of its own total.
   *
   * Ranked on the SMALLER of the two shares. That is the one number
   * that means "both of them lean on this at least this much"; ranking
   * on the sum would let a book that is 40% of one and 1% of the other
   * outrank one that is 15% of each, which is the opposite of shared.
   *
   * What this deliberately does NOT do is score the pair. A cosine over
   * two fifteen-element truncations is not the weight the worker
   * computed over the whole profile and would quietly disagree with the
   * number beside it. The weight is the score; this names books.
   */
  function sharedBooks(nameA, nameB) {
    if (!fp) return null;
    const A = fp.byName[nameA];
    const B = fp.byName[nameB];
    // Absent is UNKNOWN, never zero, and the caller has to be able to
    // tell the two apart to say the right sentence.
    if (!A || !B) {
      const missing = [];
      if (!A) missing.push(nameA);
      if (!B) missing.push(nameB);
      return { missing };
    }
    const rows = [];
    const slots = Object.keys(A.counts);
    for (let i = 0; i < slots.length; i++) {
      const slot = slots[i];
      const cb = B.counts[slot];
      if (!cb) continue;
      const ca = A.counts[slot];
      const shareA = ca / A.n;
      const shareB = cb / B.n;
      rows.push({
        book: fp.books[slot] || "",
        shareA,
        shareB,
        floor: shareA < shareB ? shareA : shareB,
      });
    }
    rows.sort((p, q) => q.floor - p.floor || (p.book < q.book ? -1 : 1));
    return { rows, missing: [] };
  }

  const SHARED_CAP = 6;

  /* Book slugs arrive as the sidecar's own vocabulary and this file has
   * never seen one (the route 404s everywhere as this is written), so
   * the label is derived rather than looked up in a table that would be
   * a guess. "1-corinthians" -> "1 Corinthians", "song-of-songs" ->
   * "Song of Songs". Small words stay lowercase inside a title but
   * never at the start of one. */
  const BOOK_SMALL = { of: 1, the: 1, and: 1, to: 1 };

  function bookLabel(slug) {
    const s = String(slug == null ? "" : slug).trim();
    if (!s) return "";
    return s
      .split("-")
      .map((part, i) => {
        if (!part) return "";
        if (/^\d+$/.test(part)) return part;
        if (i > 0 && BOOK_SMALL[part]) return part;
        return part.charAt(0).toUpperCase() + part.slice(1);
      })
      .filter(Boolean)
      .join(" ");
  }

  // Rounded to whole points, with anything that rounds to nothing shown
  // as "under 1%" rather than as "0%", which would read as none.
  function pct(v) {
    const p = v * 100;
    if (!isFinite(p) || p <= 0) return "0%";
    if (p < 1) return "under 1%";
    return `${Math.round(p)}%`;
  }

  /* ── The dossier ──────────────────────────────────────────────── */

  function textEl(tag, className, text) {
    const el = document.createElement(tag);
    if (className) el.className = className;
    if (text != null) el.textContent = text;
    return el;
  }

  function renderDossierEmpty() {
    if (!dossierEl) return;
    dossierEl.textContent = "";
    dossierEl.appendChild(
      textEl("p", "cn-dossier-empty", "Choose a point to see what stands behind it.")
    );
  }

  /* ── The dossier's title, and when it is a link ───────────────────
   *
   * A point that IS an author gets its name linked to that author's own
   * page, which is where the reception panel already renders every
   * citation record behind the figures in this rail. Only where the
   * point is an author: a work or a doctrinal topic has no author page
   * and linking every title would send a reader to a name that is
   * really a book title (viewHasAuthors above is the whole test, and it
   * reads the noun table rather than a second list).
   *
   * Guarded on the displayed text being the node's own `a` as well. The
   * works view titles itself from `t`, the full title, and a link built
   * from a name the reader is not looking at would be a link that lies
   * about where it goes.
   *
   * A NEW TAB, unlike the same-site author links elsewhere in the
   * library. This panel is a workspace: a shelf, a view, an
   * arrangement, a zoom, a pan and a selection, none of which survives
   * a navigation, and only two of which are in the query string. Same
   * reasoning as the reader links in this file.
   */
  function dossierTitle(node, text) {
    const h3 = document.createElement("h3");
    h3.className = "cn-dossier-title";
    const name = node && node.a ? node.a : "";
    const url = viewHasAuthors() && name && text === name ? authorPageUrl(name) : "";
    if (!url) {
      h3.textContent = text;
      return h3;
    }
    const a = document.createElement("a");
    a.className = "cn-dossier-title-link";
    window.MOSafeHref.set(a, url, "#");
    a.target = "_blank";
    a.rel = "noopener";
    a.textContent = text;
    // The visible text is a name; the accessible name says where it
    // goes, which is what a heading that is also a link has to do.
    a.setAttribute("aria-label", `${name}: open their page in the library`);
    h3.appendChild(a);
    return h3;
  }

  /* ── Arming a comparison ──────────────────────────────────────────
   *
   * The discoverable half of the whole gesture, and it is a button
   * rather than an overloaded click for two reasons. A plain click
   * already means "open this point", so a second click cannot also mean
   * "add this point" without one of them becoming a guess. And a
   * labelled control in the rail the reader is already reading after
   * their first click needs no instructions, no modifier key and no
   * hover, which is what makes it the same gesture on a desktop, a
   * tablet and a phone.
   *
   * It lives directly under the title on both dossiers, above the
   * figures, because on a doctrines point the figures run to hundreds
   * of rows and a control buried under those on a phone is a control
   * nobody finds.
   */
  function compareButton(i) {
    const p = document.createElement("p");
    p.className = "cn-compare-invite";
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "cn-compare-btn";
    btn.textContent = COMPARE_INVITE;
    btn.addEventListener("click", () => armCompare(i));
    p.appendChild(btn);
    return p;
  }

  function renderDossier(i) {
    if (!dossierEl) return;
    const node = nodes[i];
    if (!node) {
      renderDossierEmpty();
      return;
    }
    if (citeMode) {
      renderCiteDossier(i);
      return;
    }
    dossierEl.textContent = "";

    const key = catKeyOf(node);
    const cat = cats.find((c) => c && c.k === key);
    dossierEl.appendChild(textEl("p", "cn-dossier-kicker", cat && cat.l ? cat.l : "Unclassified"));
    dossierEl.appendChild(dossierTitle(node, node.t || node.a || "Untitled"));
    if (node.sub) dossierEl.appendChild(textEl("p", "cn-dossier-sub", node.sub));

    // Only on the merged shelf, where one point can stand for the same
    // name found on four different shelves. Said plainly, along with
    // which shelf the figures above actually came from, because they
    // are one shelf's reading rather than a total (see
    // mergeShelfPayloads for why a total is not available).
    if (Array.isArray(node._shelves) && node._shelves.length > 1) {
      dossierEl.appendChild(
        textEl("p", "cn-dossier-shelves", `On ${node._shelves.length} shelves: ${node._shelves.join(", ")}.`)
      );
      dossierEl.appendChild(
        textEl(
          "p",
          "cn-dossier-shelves-note",
          `The figures above are from ${node._shelfOf || "one shelf"}, which holds the most of this ${NODE_NOUN[view] || "point"}. The shelves overlap, so adding them together would count the same books twice.`
        )
      );
    }

    /* Under the identity block and above everything else, so the rail
     * reads as who this is, then what you can do, then what stands
     * behind it. A doctrines point can carry hundreds of rows and this
     * is the only way onto the gesture without a pointer, so it must
     * not end up below them on a phone.
     *
     * Withheld on a one-point map, where there is nothing to compare
     * to and the button would be a control that cannot work. */
    if (nodes.length > 1) dossierEl.appendChild(compareButton(i));

    // The `works` view is the only one whose node is itself a work, and
    // so the only one with a reader link of its own.
    if (node.w) {
      const url = readerUrlFromSlug(node.w);
      if (url) {
        const p = document.createElement("p");
        p.className = "cn-dossier-open";
        const a = document.createElement("a");
        a.className = "cn-open-link";
        window.MOSafeHref.set(a, url, "#");
        a.target = "_blank";
        a.rel = "noopener";
        a.textContent = "Open in the reader";
        p.appendChild(a);
        dossierEl.appendChild(p);
      }
    }

    // Before the works list, not after it. This is the one part of the
    // dossier that is a control rather than a reference, it is the only
    // way to reach a line without a pointer, and a doctrines node can
    // carry hundreds of rows underneath. Buried under those on a phone
    // it would never be found.
    renderNodeLinks(i);

    const rows = Array.isArray(node.rows) ? node.rows : [];
    if (!rows.length) return;

    dossierEl.appendChild(
      textEl("p", "cn-dossier-heading", ROWS_HEADING[view] || "Behind this point")
    );
    const ul = document.createElement("ul");
    ul.className = "cn-rows";
    rows.forEach((r) => {
      const li = document.createElement("li");
      li.className = "cn-row";
      const url = readerUrlFromSourceHref(r && r.h);
      const title = (r && r.t) || "Untitled";
      if (url) {
        const a = document.createElement("a");
        a.className = "cn-row-title cn-row-link";
        window.MOSafeHref.set(a, url, "#");
        a.target = "_blank";
        a.rel = "noopener";
        a.textContent = title;
        li.appendChild(a);
      } else {
        // No href on the row. A span, never an <a href="#">: a link
        // that goes nowhere is worse than a line of text that never
        // claimed to.
        li.appendChild(textEl("span", "cn-row-title", title));
      }
      if (r && r.s) li.appendChild(textEl("span", "cn-row-meta", r.s));
      if (r && r.g) li.appendChild(textEl("span", "cn-row-gloss", r.g));
      ul.appendChild(li);
    });
    dossierEl.appendChild(ul);
  }

  /* ── An author in the citation graph ──────────────────────────────
   *
   * The rail is where the two distortions in a raw refutation count are
   * actually defused, because it is the only surface with room to put
   * the correction NEXT TO the number rather than in a footnote:
   *
   *   The figures are always given in pairs. Citations received sit
   *   beside refutations received, so an author who is heavily cited
   *   and heavily refuted reads as both rather than as one. Bellarmine
   *   is the case: 58,498 citations, 33,599 of them positive, 24,899
   *   refutations, and every one of those numbers is on screen at once.
   *
   *   The refutation count is always given with the number of authors
   *   behind it. Reding's 2,680 refutations from one author and
   *   Bellarmine's 24,899 from 267 are the same column and would read
   *   the same way without it.
   *
   * Three link lists, not one, and they are three different questions.
   * "Most cited by" and "Cites most" are the two directions of the same
   * edge set and answer who builds on whom. "Most argued with" is the
   * same inbound list re-sorted by refutations rather than a filter of
   * the first, which is what lets Scotus be Aquinas's largest opponent
   * and his fifth largest source in one rail.
   */
  const CITE_LIST_CAP = 6;

  function statRow(label, value, lead) {
    const li = document.createElement("li");
    li.className = lead ? "cn-stat cn-stat--lead" : "cn-stat";
    li.appendChild(textEl("span", "cn-stat-label", label));
    li.appendChild(textEl("span", "cn-stat-value", value));
    return li;
  }

  /*
   * One row in a link list, and the whole of the keyboard and touch
   * path onto an edge. Focus lights the line on the map exactly as the
   * index list lights a point, which is the only way somebody who
   * cannot point gets "which line is this?" answered.
   */
  function linkRow(ei, name, meta) {
    const li = document.createElement("li");
    li.className = "cn-link";
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "cn-link-btn";
    btn.appendChild(textEl("span", "cn-link-name", name));
    btn.appendChild(textEl("span", "cn-link-meta", meta));
    btn.addEventListener("click", () => selectEdge(ei, { centre: true }));
    btn.addEventListener("focus", () => {
      hoveredEdge = ei;
      draw();
    });
    btn.addEventListener("blur", () => {
      if (hoveredEdge !== ei) return;
      hoveredEdge = -1;
      draw();
    });
    btn.addEventListener("mouseenter", () => {
      hoveredEdge = ei;
      draw();
    });
    btn.addEventListener("mouseleave", () => {
      if (hoveredEdge !== ei) return;
      hoveredEdge = -1;
      draw();
    });
    li.appendChild(btn);
    return li;
  }

  // The links off one author that are still on the map. Only the legend
  // filter is applied, never the edge budget: the budget is a decision
  // about the resting picture, and an author's citation record is the
  // most useful thing in the rail. Choosing one paints it whatever the
  // field is doing.
  function citeLinks(list) {
    const out = [];
    if (!list) return out;
    for (let k = 0; k < list.length; k++) {
      const e = edges[list[k]];
      if (!e || !isVisible(nodes[e[0]]) || !isVisible(nodes[e[1]])) continue;
      out.push(list[k]);
    }
    return out;
  }

  function citeLinkList(heading, order, farEnd, metaOf) {
    if (!order.length) return;
    dossierEl.appendChild(textEl("p", "cn-dossier-heading", heading));
    const ul = document.createElement("ul");
    ul.className = "cn-links";
    const shown = order.slice(0, CITE_LIST_CAP);
    shown.forEach((ei) => {
      const e = edges[ei];
      if (!e) return;
      const far = nodes[farEnd(e)];
      ul.appendChild(linkRow(ei, (far && far.a) || "Untitled", metaOf(e)));
    });
    dossierEl.appendChild(ul);
    dossierEl.appendChild(
      textEl(
        "p",
        "cn-links-note",
        order.length > shown.length
          ? `The ${shown.length} largest of ${fmt(order.length)}.`
          : `${fmt(order.length)} in all.`
      )
    );
  }

  function renderCiteDossier(i) {
    const node = nodes[i];
    if (!node) return;
    dossierEl.textContent = "";

    const key = catKeyOf(node);
    dossierEl.appendChild(
      textEl("p", "cn-dossier-kicker", key ? catLabel(key) : "Unclassified")
    );
    dossierEl.appendChild(dossierTitle(node, node.a || "Untitled"));
    if (nodes.length > 1) dossierEl.appendChild(compareButton(i));

    const by = refuters.length > i ? refuters[i] : 0;
    const contested = view === "contested";
    const stats = document.createElement("ul");
    stats.className = "cn-stats";
    // The view's own number first and largest, then the rest of the
    // picture under it. Which one leads changes with the view; which
    // ones are present does not, because the correction has to be
    // there whichever way round the reader came at it.
    stats.appendChild(
      statRow(
        contested ? "Refutations received" : "Citations received",
        fmt(contested ? node.ref : node.pos),
        true
      )
    );
    stats.appendChild(
      statRow(
        contested ? "Citations received" : "Refutations received",
        fmt(contested ? node.pos : node.ref)
      )
    );
    stats.appendChild(statRow("Of everything citing them", pct(node.n ? node.ref / node.n : 0)));
    stats.appendChild(statRow("Authors citing them", fmt(node.src)));
    stats.appendChild(
      statRow("Authors refuting them", node.ref ? `${fmt(by)} of ${fmt(node.src)}` : "None")
    );
    dossierEl.appendChild(stats);

    /* The single-refuter sentence, said outright rather than left to be
     * inferred from two numbers in a list. This is the line that stops
     * Reding's 84% reading as a verdict, and it names who. */
    if (node.ref && by > 0 && by < LONE_REFUTERS) {
      const top = topRefuter.length > i ? topRefuter[i] : -1;
      const e = top >= 0 ? edges[top] : null;
      const one = e ? nodes[e[0]] : null;
      dossierEl.appendChild(
        textEl(
          "p",
          "cn-stat-note",
          one && by === 1
            ? `Every one of these refutations is ${one.a}. That is one opponent rather than a reputation, which is why this point is drawn as a hollow ring.`
            : "These refutations come from one or two opponents rather than from the library at large, which is why this point is drawn as a hollow ring."
        )
      );
    }
    dossierEl.appendChild(textEl("p", "cn-stat-note", CITE_FLOOR_NOTE));

    const inbound = citeLinks(inAdj[i]);
    const outbound = citeLinks(outAdj[i]);
    const argued = inbound
      .filter((ei) => edges[ei][3] > 0)
      .sort((p, q) => edges[q][3] - edges[p][3] || p - q);

    // Ordered so the contested view opens on the argument. Same three
    // lists either way, since an author's record does not change with
    // the view the reader arrived through.
    const citedBy = () =>
      citeLinkList(
        "Most cited by",
        inbound,
        (e) => e[0],
        (e) =>
          `${fmt(e[2])} ${e[2] === 1 ? "citation" : "citations"}${e[3] ? `, ${fmt(e[3])} refuting` : ""}`
      );
    const arguedWith = () =>
      citeLinkList(
        "Most argued with by",
        argued,
        (e) => e[0],
        (e) => `${fmt(e[3])} of ${fmt(e[2])} refuting${isArgument(e) ? ", mostly argument" : ""}`
      );
    if (contested) {
      arguedWith();
      citedBy();
    } else {
      citedBy();
      arguedWith();
    }

    citeLinkList(
      "Cites most",
      outbound,
      (e) => e[1],
      (e) =>
        `${fmt(e[2])} ${e[2] === 1 ? "citation" : "citations"}${e[3] ? `, ${fmt(e[3])} refuting` : ""}`
    );

    if (!inbound.length && !outbound.length && edges.length) {
      dossierEl.appendChild(textEl("p", "cn-dossier-heading", "Links"));
      dossierEl.appendChild(
        textEl(
          "p",
          "cn-links-none",
          "No pair involving this author reaches five citations, so none of them is in the graph."
        )
      );
    }
  }

  /* A citation, in the rail. The plate's four lines in full, plus the
   * two things a plate has no room for: the traffic in the other
   * direction, which exists for 614 of the 37,427 pairs and is half the
   * sentence when it does, and the two ends as real buttons. */
  function renderCiteLink(j) {
    const f = edgeFacts(j);
    if (!f || !f.cite) {
      renderDossierEmpty();
      return;
    }
    const c = f.cite;
    dossierEl.textContent = "";
    dossierEl.appendChild(
      textEl("p", "cn-dossier-kicker", c.argument ? "Argument" : "Citation")
    );
    dossierEl.appendChild(
      textEl("h3", "cn-dossier-title", `${f.nameA} cites ${f.nameB}`)
    );

    const strength = document.createElement("p");
    strength.className = "cn-link-strength";
    strength.appendChild(textEl("span", "cn-link-figure", fmt(c.total)));
    strength.appendChild(
      textEl("span", "cn-link-word", c.total === 1 ? "citation" : "citations")
    );
    dossierEl.appendChild(strength);

    dossierEl.appendChild(
      textEl(
        "p",
        "cn-dossier-sub",
        c.ref
          ? `${fmt(c.pos)} of them positive and ${fmt(c.ref)} refutations, which is ${pct(c.share)} of the pair.`
          : "None of them is a refutation."
      )
    );
    if (c.argument) {
      dossierEl.appendChild(
        textEl(
          "p",
          "cn-link-gloss",
          "Refutations outnumber agreements here, which is what the dashed line on the map marks."
        )
      );
    } else if (c.ref) {
      // The Scotus and Aquinas case, and it is the reading that a
      // single number would lose: the largest debt in the library is
      // also its largest dispute.
      dossierEl.appendChild(
        textEl(
          "p",
          "cn-link-gloss",
          "Mostly agreement with an argument inside it, so the line is drawn solid. A pair can be both a debt and a dispute. The heaviest ones in this library are."
        )
      );
    }
    dossierEl.appendChild(
      textEl(
        "p",
        "cn-dossier-sub",
        f.bothKnown && !f.crosses
          ? `Both are shelved under ${f.regionA}.`
          : `${f.regionA} citing ${f.regionB}.`
      )
    );
    dossierEl.appendChild(textEl("p", "cn-link-gloss", LINK_GLOSS[view] || LINK_GLOSS.cited));

    if (c.back >= 0) {
      const b = edges[c.back];
      dossierEl.appendChild(textEl("p", "cn-dossier-heading", "The other direction"));
      const ul = document.createElement("ul");
      ul.className = "cn-links";
      ul.appendChild(
        linkRow(
          c.back,
          `${f.nameB} cites ${f.nameA}`,
          `${fmt(b[2])} ${b[2] === 1 ? "citation" : "citations"}${b[3] ? `, ${fmt(b[3])} refuting` : ", none refuting"}`
        )
      );
      dossierEl.appendChild(ul);
    }

    dossierEl.appendChild(textEl("p", "cn-dossier-heading", "The two ends"));
    const ul = document.createElement("ul");
    ul.className = "cn-links";
    ul.appendChild(nodeRow(f.ia, f.nameA, `Citing · ${f.regionA}`));
    ul.appendChild(nodeRow(f.ib, f.nameB, `Cited · ${f.regionB}`));
    dossierEl.appendChild(ul);
  }

  /* ── A point's links ──────────────────────────────────────────────
   *
   * The touch and keyboard path onto the edges. Every one of these is a
   * real button, so an edge is reachable by tabbing rather than by
   * landing a fingertip on a 1px diagonal, and focusing one moves the
   * highlight on the map exactly as focusing an index entry does.
   *
   * Capped at eight with the true total stated. A point in the Acts &
   * Paul crowd can carry fifty links and a rail of fifty buttons is a
   * list, not a dossier; the strongest eight are the ones that carry
   * the claim, and the count says outright that they are not all of
   * them.
   */
  const NODE_LINKS_CAP = 8;

  function renderNodeLinks(i) {
    if (!dossierEl) return;
    const all = visibleLinksFor(i);
    if (!all.length) {
      // Only worth a line when there could have been links. On a
      // payload with no edges at all this would be a fact about the
      // whole map masquerading as a fact about this point.
      if (edges.length) {
        dossierEl.appendChild(textEl("p", "cn-dossier-heading", "Links"));
        dossierEl.appendChild(
          textEl("p", "cn-links-none", "Nothing on this map is linked to this point.")
        );
      }
      return;
    }

    dossierEl.appendChild(textEl("p", "cn-dossier-heading", "Strongest links"));
    const ul = document.createElement("ul");
    ul.className = "cn-links";
    const shown = all.slice(0, NODE_LINKS_CAP);
    shown.forEach((ei) => {
      const f = edgeFacts(ei);
      if (!f) return;
      // The other end, whichever end this node is.
      const farName = f.ia === i ? f.nameB : f.nameA;
      const farRegion = f.ia === i ? f.regionB : f.regionA;
      const li = document.createElement("li");
      li.className = "cn-link";
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "cn-link-btn";
      btn.appendChild(textEl("span", "cn-link-name", farName));
      const meta = `${farRegion} · ${f.weight.toFixed(2)} ${f.word}${f.crosses ? " · crosses sections" : ""}`;
      btn.appendChild(textEl("span", "cn-link-meta", meta));
      btn.addEventListener("click", () => selectEdge(ei, { centre: true }));
      // Focus is the keyboard's hover here too: arrowing down this list
      // lights each line on the map in turn, which is the only way
      // somebody who cannot point gets "which line is this?".
      btn.addEventListener("focus", () => {
        hoveredEdge = ei;
        draw();
      });
      btn.addEventListener("blur", () => {
        if (hoveredEdge !== ei) return;
        hoveredEdge = -1;
        draw();
      });
      btn.addEventListener("mouseenter", () => {
        hoveredEdge = ei;
        draw();
      });
      btn.addEventListener("mouseleave", () => {
        if (hoveredEdge !== ei) return;
        hoveredEdge = -1;
        draw();
      });
      li.appendChild(btn);
      ul.appendChild(li);
    });
    dossierEl.appendChild(ul);
    dossierEl.appendChild(
      textEl(
        "p",
        "cn-links-note",
        all.length > shown.length
          ? `The ${shown.length} strongest of ${fmt(all.length)} links.`
          : `${fmt(all.length)} ${all.length === 1 ? "link" : "links"}, strongest first.`
      )
    );
  }

  /* ── A link's dossier ─────────────────────────────────────────────
   *
   * What the hover plate says, in full, in real DOM: readable by a
   * screen reader, persistent rather than lost the moment the pointer
   * moves, and carrying the two buttons that are both the way onward
   * and the way back.
   */
  function renderLinkDossier(j) {
    if (!dossierEl) return;
    if (citeMode) {
      renderCiteLink(j);
      return;
    }
    const f = edgeFacts(j);
    if (!f) {
      renderDossierEmpty();
      return;
    }
    dossierEl.textContent = "";
    dossierEl.appendChild(textEl("p", "cn-dossier-kicker", "Link"));
    dossierEl.appendChild(textEl("h3", "cn-dossier-title", `${f.nameA} and ${f.nameB}`));

    const strength = document.createElement("p");
    strength.className = "cn-link-strength";
    strength.appendChild(textEl("span", "cn-link-figure", f.weight.toFixed(2)));
    strength.appendChild(textEl("span", "cn-link-word", `of 1, ${f.word}`));
    dossierEl.appendChild(strength);

    const noun = SECTION_NOUN[view] || "section";
    let where;
    if (!f.bothKnown) {
      where = `${f.regionA} and ${f.regionB}. One of these two has no ${noun} on record, so the map cannot say whether the line crosses.`;
    } else if (f.crosses) {
      where = `${f.regionA} and ${f.regionB}. This line crosses from one ${noun} to another, which is the kind worth looking at.`;
    } else {
      where = `Both sit under ${f.regionA}.`;
    }
    dossierEl.appendChild(textEl("p", "cn-dossier-sub", where));
    dossierEl.appendChild(textEl("p", "cn-link-gloss", LINK_GLOSS[view] || LINK_GLOSS.authors));

    renderShared(f);

    dossierEl.appendChild(textEl("p", "cn-dossier-heading", "The two ends"));
    const ul = document.createElement("ul");
    ul.className = "cn-links";
    ul.appendChild(nodeRow(f.ia, f.nameA, f.regionA));
    ul.appendChild(nodeRow(f.ib, f.nameB, f.regionB));
    dossierEl.appendChild(ul);
  }

  /* The books both ends lean on. Four states, and three of them are the
   * ones that only exist on a bad day, so all four are written out
   * rather than collapsed into "no data" (FRONTEND §6.33):
   *
   *   no sidecar at all      say nothing, the dossier is complete
   *   sidecar, name missing  say the profile is not published
   *   sidecar, no overlap    say neither top fifteen reaches the other
   *   sidecar, overlap       name the books, both proportions each
   */
  /* `scored` says whether a strength was published for this pair, and
   * it is false exactly when a comparison found no line. Two sentences
   * below refer to "the strength above" and would be pointing at
   * nothing; the books themselves are unaffected, since the sidecar
   * knows nothing about edges and answers the same way either way. */
  function renderShared(f, opts) {
    const scored = !opts || opts.scored !== false;
    const res = sharedBooks(f.nameA, f.nameB);
    if (!res) {
      // Only worth saying where the reader was told to expect it. On a
      // link's dossier the four-state ladder below covers everything;
      // on a comparison with no line, "no sidecar" is the difference
      // between a short answer and an unexplained gap.
      if (opts && opts.sayWhenAbsent) {
        dossierEl.appendChild(textEl("p", "cn-share-note", COMPARE_SIM_NO_SIDECAR));
      }
      return;
    }
    dossierEl.appendChild(textEl("p", "cn-dossier-heading", "Books they both lean on"));

    if (res.missing && res.missing.length) {
      dossierEl.appendChild(
        textEl(
          "p",
          "cn-share-note",
          res.missing.length > 1
            ? "The book profiles for these two have not been published yet, so this cannot be said either way."
            : `The book profile for ${res.missing[0]} has not been published yet, so this cannot be said either way.`
        )
      );
      return;
    }

    if (!res.rows.length) {
      dossierEl.appendChild(
        textEl(
          "p",
          "cn-share-note",
          scored
            ? "Neither one's fifteen most-cited books appears on the other's list. They may still share books further down, which is where the strength above is measured."
            : "Neither one's fifteen most-cited books appears on the other's list. Only those fifteen were published, so they may still share books further down."
        )
      );
      return;
    }

    const ul = document.createElement("ul");
    ul.className = "cn-share";
    res.rows.slice(0, SHARED_CAP).forEach((r) => {
      const li = document.createElement("li");
      li.className = "cn-share-row";
      li.appendChild(textEl("span", "cn-share-book", bookLabel(r.book) || "Unnamed book"));
      li.appendChild(
        textEl(
          "span",
          "cn-share-meta",
          `${pct(r.shareA)} of ${f.nameA}, ${pct(r.shareB)} of ${f.nameB}`
        )
      );
      ul.appendChild(li);
    });
    dossierEl.appendChild(ul);

    // The truncation, said outright. Fifteen books each is not a
    // profile, and an overlap drawn from two truncated lists is a floor
    // rather than a total.
    const extra =
      res.rows.length > SHARED_CAP
        ? `The ${SHARED_CAP} most shared of ${res.rows.length} books in common. `
        : "";
    dossierEl.appendChild(
      textEl(
        "p",
        "cn-share-note",
        `${extra}Each share is that book's part of everything the writer cites. Only the fifteen books each one cites most were published, so this is the overlap that can be seen rather than all of it.${
          scored ? " The strength above was measured across the whole profile." : ""
        }`
      )
    );
  }

  /* ── A comparison, in the rail ────────────────────────────────────
   *
   * The persistent, screen-readable half of everything the plate says,
   * and the only surface with room for the corrections that make the
   * numbers safe to read.
   *
   * The empty pair is the common case in both families and it gets the
   * most care, because it is the one a careless sentence turns into a
   * false claim. 2.7% of citation pairs and 1.5% of Scripture pairs
   * carry an edge, so most of the time this rail is explaining an
   * absence, and an absence here is a floor or a threshold rather than
   * a zero. Nothing below says two writers are unconnected.
   */

  /* One end of a pair, as a button. The same row renderLinkDossier and
   * renderCiteLink already build for "The two ends", lifted out so
   * three callers cannot drift apart on the focus behaviour, which is
   * the part that matters: focusing a row moves the highlight on the
   * map exactly as focusing an index entry does, and that is the only
   * way somebody who cannot point is told which dot this is. */
  function nodeRow(i, name, meta) {
    const li = document.createElement("li");
    li.className = "cn-link";
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "cn-link-btn";
    btn.appendChild(textEl("span", "cn-link-name", name));
    if (meta) btn.appendChild(textEl("span", "cn-link-meta", meta));
    btn.addEventListener("click", () => {
      select(i, { centre: true });
      syncIndexSelection();
    });
    btn.addEventListener("focus", () => {
      hovered = i;
      draw();
    });
    btn.addEventListener("blur", () => {
      if (hovered !== i) return;
      hovered = -1;
      draw();
    });
    li.appendChild(btn);
    return li;
  }

  // The pair's two ends, and the way back to reading one of them alone.
  function renderCompareEnds(f) {
    dossierEl.appendChild(textEl("p", "cn-dossier-heading", "The two points"));
    const ul = document.createElement("ul");
    ul.className = "cn-links";
    ul.appendChild(nodeRow(f.ia, f.nameA, f.regionA));
    ul.appendChild(nodeRow(f.ib, f.nameB, f.regionB));
    dossierEl.appendChild(ul);
  }

  /* One direction of a citation pair. A direction that HAS an edge is a
   * real button, so choosing it opens that edge's own dossier with the
   * works behind it; a direction that does not is a line of text, never
   * a dead button, and it says what the absence is.
   *
   * The two are always rendered together and never summed. Augustine
   * cites Jerome 55 times with 3 refuting; Jerome cites Augustine 13
   * times with none. One number in place of those two would lose the
   * asymmetry, which is the whole of what makes a citation pair
   * interesting. */
  function citeDirectionRow(ul, from, to, ei) {
    if (ei < 0) {
      const li = document.createElement("li");
      li.className = "cn-link cn-link--flat";
      li.appendChild(textEl("span", "cn-link-name", `${from} cites ${to}`));
      li.appendChild(
        textEl("span", "cn-link-meta", "Under five citations, so not in this graph")
      );
      ul.appendChild(li);
      return;
    }
    const e = edges[ei];
    const meta = e[3]
      ? `${fmt(e[2])} ${e[2] === 1 ? "citation" : "citations"}, ${fmt(e[3])} refuting${
        isArgument(e) ? ", mostly argument" : ""
      }`
      : `${fmt(e[2])} ${e[2] === 1 ? "citation" : "citations"}, none refuting`;
    ul.appendChild(linkRow(ei, `${from} cites ${to}`, meta));
  }

  /* The reading a single figure cannot give. A pair can be at once the
   * largest debt in the library and its largest dispute: Scotus cites
   * Aquinas 8,829 times, 7,757 of them positively and 1,072 as
   * refutations, which is not an argument by the ref*2>n test and is
   * still the biggest argument there is. So both halves of every total
   * are stated, and the sentence under them names which shape this
   * particular pair has. */
  function citeBalanceNote(f) {
    const parts = [];
    [[f.ab, f.nameA, f.nameB], [f.ba, f.nameB, f.nameA]].forEach((d) => {
      if (d[0] < 0) return;
      const e = edges[d[0]];
      if (!e[3]) return;
      const pos = Math.max(0, e[2] - e[3]);
      parts.push(
        isArgument(e)
          ? `${d[1]} on ${d[2]} is mostly argument: ${fmt(pos)} agreements against ${fmt(e[3])} refutations.`
          : `${d[1]} on ${d[2]} is mostly agreement with an argument inside it: ${fmt(pos)} positive against ${fmt(e[3])} refutations, which is ${pct(e[3] / e[2])} of the pair.`
      );
    });
    if (!parts.length) return;
    parts.push("A pair can be both a debt and a dispute. The heaviest ones in this library are.");
    dossierEl.appendChild(textEl("p", "cn-link-gloss", parts.join(" ")));
  }

  /* The opt-in exact count, and the only place in this panel that can
   * tell "four citations, under the floor" from "none anywhere". It is
   * a button rather than a fetch on selection because the file behind
   * it runs to a megabyte for a heavily cited figure, and because most
   * readers comparing two names are not asking this question.
   *
   * Every outcome is a different sentence and a failure is never a
   * zero (FRONTEND §6.33). The button disables itself while it works
   * and is replaced by its answer, so it cannot be pressed twice into
   * two megabytes.
   */
  function renderExactCount(f) {
    const fkA = f.a && f.a.fk;
    const fkB = f.b && f.b.fk;
    if (!fkA || !fkB) return;

    const box = document.createElement("div");
    box.className = "cn-compare-count";
    const p = document.createElement("p");
    p.className = "cn-compare-invite";
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "cn-compare-btn";
    btn.textContent = COMPARE_COUNT_INVITE;
    p.appendChild(btn);
    box.appendChild(p);
    const note = textEl("p", "cn-share-note", COMPARE_COUNT_NOTE);
    box.appendChild(note);
    dossierEl.appendChild(box);

    const sentence = (from, to, r) => {
      if (r.state === "unpublished") {
        return `The complete record for ${from} has not been published, so this direction cannot be checked.`;
      }
      if (r.state === "failed") return "";
      if (r.state === "none") {
        return `${from} never names ${to} anywhere in the indexed corpus.`;
      }
      return r.ref
        ? `${from} names ${to} ${fmt(r.n)} ${r.n === 1 ? "time" : "times"}, ${fmt(r.ref)} of them refutations.`
        : `${from} names ${to} ${fmt(r.n)} ${r.n === 1 ? "time" : "times"}, none of them refutations.`;
    };

    btn.addEventListener("click", () => {
      btn.disabled = true;
      note.textContent = COMPARE_COUNT_WORKING;
      // The pair this was pressed for. A reader who moves on before the
      // fetch lands must not have a stale answer painted into whatever
      // is in the rail by then.
      const forA = f.ia;
      const forB = f.ib;
      Promise.all([countDirection(fkA, fkB), countDirection(fkB, fkA)]).then((res) => {
        if (compareA !== forA || compareB !== forB) return;
        if (!box.isConnected) return;
        box.textContent = "";
        box.appendChild(textEl("p", "cn-dossier-heading", "The complete record"));
        const said = [sentence(f.nameA, f.nameB, res[0]), sentence(f.nameB, f.nameA, res[1])];
        if (!said[0] && !said[1]) {
          box.appendChild(textEl("p", "cn-share-note", COMPARE_COUNT_FAILED));
          return;
        }
        said.forEach((s) => {
          if (s) box.appendChild(textEl("p", "cn-dossier-sub", s));
        });
        if (!said[0] || !said[1]) {
          box.appendChild(textEl("p", "cn-share-note", COMPARE_COUNT_FAILED));
        }
        box.appendChild(
          textEl(
            "p",
            "cn-share-note",
            "Counted over the reception index rather than over everything ever written. It is the same corpus the map is drawn from."
          )
        );
        announce("The complete record has been read for this pair.");
      });
    });
  }

  function renderCompareCite(f) {
    dossierEl.appendChild(
      textEl("p", "cn-dossier-kicker", f.any ? "Two authors" : "Two authors, no pair")
    );
    dossierEl.appendChild(textEl("h3", "cn-dossier-title", `${f.nameA} and ${f.nameB}`));

    if (f.any) {
      dossierEl.appendChild(textEl("p", "cn-dossier-heading", "Each direction"));
      const ul = document.createElement("ul");
      ul.className = "cn-links";
      citeDirectionRow(ul, f.nameA, f.nameB, f.ab);
      citeDirectionRow(ul, f.nameB, f.nameA, f.ba);
      dossierEl.appendChild(ul);
      citeBalanceNote(f);
      if (f.ab < 0 || f.ba < 0) {
        dossierEl.appendChild(textEl("p", "cn-stat-note", COMPARE_CITE_ONE_WAY));
      }
    } else {
      dossierEl.appendChild(textEl("p", "cn-dossier-sub", COMPARE_CITE_NONE));
    }

    dossierEl.appendChild(
      textEl(
        "p",
        "cn-dossier-sub",
        f.bothKnown && !f.crosses
          ? `Both are shelved under ${f.regionA}.`
          : `${f.regionA} and ${f.regionB}.`
      )
    );
    dossierEl.appendChild(textEl("p", "cn-link-gloss", CITE_SCOPE_CAVEAT));
    renderExactCount(f);
    renderCompareEnds(f);
  }

  function renderCompareScripture(f) {
    const scored = f.edge >= 0;
    dossierEl.appendChild(
      textEl("p", "cn-dossier-kicker", scored ? "Two points, joined" : "Two points, no line")
    );
    dossierEl.appendChild(textEl("h3", "cn-dossier-title", `${f.nameA} and ${f.nameB}`));

    if (scored) {
      const strength = document.createElement("p");
      strength.className = "cn-link-strength";
      strength.appendChild(textEl("span", "cn-link-figure", f.weight.toFixed(2)));
      strength.appendChild(textEl("span", "cn-link-word", `of 1, ${f.word}`));
      dossierEl.appendChild(strength);
    } else {
      dossierEl.appendChild(textEl("p", "cn-dossier-sub", COMPARE_SIM_NONE));
    }

    const noun = SECTION_NOUN[view] || "section";
    let where;
    if (!f.bothKnown) {
      where = `${f.regionA} and ${f.regionB}. One of these two has no ${noun} on record.`;
    } else if (f.crosses) {
      where = scored
        ? `${f.regionA} and ${f.regionB}. This pair crosses from one ${noun} to another, which is the kind worth looking at.`
        : `${f.regionA} and ${f.regionB}. They are filed under different sections.`;
    } else {
      where = `Both sit under ${f.regionA}.`;
    }
    dossierEl.appendChild(textEl("p", "cn-dossier-sub", where));
    dossierEl.appendChild(textEl("p", "cn-link-gloss", LINK_GLOSS[view] || LINK_GLOSS.authors));

    // The substantive half of the empty state. The sidecar answers "what
    // do these two share" whether or not a line was published, and on
    // English Divines the median no-line pair still has eleven books in
    // both visible top fifteens, so this is usually a real answer rather
    // than an apology.
    renderShared(f, { scored, sayWhenAbsent: !scored });

    if (scored) {
      dossierEl.appendChild(textEl("p", "cn-dossier-heading", "This link"));
      const ul = document.createElement("ul");
      ul.className = "cn-links";
      ul.appendChild(
        linkRow(
          f.edge,
          `${f.nameA} and ${f.nameB}`,
          `${f.weight.toFixed(2)} ${f.word}${f.crosses ? " · crosses sections" : ""}`
        )
      );
      dossierEl.appendChild(ul);
    }
    renderCompareEnds(f);
  }

  function renderCompare(ia, ib) {
    if (!dossierEl) return;
    const f = compareFacts(ia, ib);
    if (!f) {
      renderDossierEmpty();
      return;
    }
    dossierEl.textContent = "";
    // A comparison is a state, not a reading, so the way out of it is
    // the first control in the rail rather than the last.
    const bar = document.createElement("p");
    bar.className = "cn-compare-invite";
    const clear = document.createElement("button");
    clear.type = "button";
    clear.className = "cn-compare-btn";
    clear.textContent = "Clear this pair";
    clear.addEventListener("click", () => {
      const back = compareA;
      clearCompare();
      select(back);
      syncIndexSelection();
    });
    bar.appendChild(clear);
    dossierEl.appendChild(bar);

    if (f.cite) renderCompareCite(f);
    else renderCompareScripture(f);
  }

  /* The half-chosen state. The point's own dossier is left intact under
   * the banner rather than replaced, so arming a comparison costs the
   * reader nothing they were reading; the banner on top is what makes
   * the state impossible to be in by accident. */
  function renderCompareArmed(i, opts) {
    if (!dossierEl) return;
    renderDossier(i);
    const box = document.createElement("div");
    box.className = "cn-compare-arm";
    box.appendChild(textEl("p", "cn-compare-arm-kicker", "Choosing a pair"));
    box.appendChild(
      textEl(
        "p",
        "cn-compare-arm-note",
        `${nodes[i] && nodes[i].a ? nodes[i].a : "This point"} is held. ${COMPARE_ARM_NOTE}`
      )
    );
    const cancel = document.createElement("button");
    cancel.type = "button";
    cancel.className = "cn-compare-btn";
    cancel.textContent = "Cancel";
    cancel.addEventListener("click", () => {
      clearCompare();
      select(i);
      syncIndexSelection();
    });
    box.appendChild(cancel);
    dossierEl.insertBefore(box, dossierEl.firstChild);
    /* Focus is MOVED only when the reader's own press caused this
     * render. Arming replaces the button that was just pressed, so
     * without this a keyboard user is left on <body> with no way back
     * into the panel, which is the trap the legend and the index list
     * are both written to avoid. A repaint from somewhere else (a
     * legend toggle, a late sidecar) must not steal focus from
     * whatever the reader is actually using, which is the same trap
     * from the other side. */
    if (opts && opts.focus) cancel.focus();
  }

  /* ── The three states of a comparison ─────────────────────────── */

  function clearCompare() {
    compareA = -1;
    compareB = -1;
  }

  /* Repaint whatever the rail is currently showing, without knowing
   * which of the four things that is. Called where something under the
   * dossier has changed rather than the selection itself: a legend
   * filter that hid a point one of these lists names, or the book
   * profiles arriving after the rail was already drawn. Four states and
   * a dispatch, rather than four call sites each remembering all four.
   */
  function refreshDossier() {
    if (compareA >= 0 && compareB >= 0) renderCompare(compareA, compareB);
    else if (compareA >= 0) renderCompareArmed(compareA);
    else if (selectedEdge >= 0) renderLinkDossier(selectedEdge);
    else if (selected >= 0) renderDossier(selected);
  }

  function armCompare(i) {
    if (i < 0 || !nodes[i]) return;
    compareA = i;
    compareB = -1;
    selected = i;
    selectedEdge = -1;
    hoveredEdge = -1;
    renderCompareArmed(i, { focus: true });
    syncIndexSelection();
    draw();
    announce(`${nodes[i].a || "Point"} held. ${COMPARE_ARM_NOTE}`);
  }

  function setPair(ia, ib, opts) {
    const f = compareFacts(ia, ib);
    if (!f) return;
    compareA = ia;
    compareB = ib;
    // A comparison owns the rail, so neither of the other two things
    // that can own it is left claiming to.
    selected = -1;
    selectedEdge = -1;
    hoveredEdge = -1;
    // A chosen pair is worth the profiles even on the merged shelf,
    // where nothing was fetched on load. Same bargain selectEdge makes.
    ensureFingerprints();
    renderCompare(ia, ib);
    syncIndexSelection();
    if (!opts || opts.centre !== false) centrePair(ia, ib);
    draw();
    announce(compareAnnouncement(f));
  }

  /* Said in full, because a screen reader gets no plate and no rings.
   * Both directions, separately, for the same reason the rail gives
   * them separately. */
  function compareAnnouncement(f) {
    if (f.cite) {
      if (!f.any) {
        return `${f.nameA} and ${f.nameB} compared. Neither cites the other five times or more, so this pair is not in the graph.`;
      }
      const say = (from, to, ei) => {
        if (ei < 0) return `${from} cites ${to} fewer than five times.`;
        const e = edges[ei];
        return `${from} cites ${to} ${fmt(e[2])} times, ${e[3] ? `${fmt(e[3])} of them refutations` : "none of them refutations"}.`;
      };
      return `${f.nameA} and ${f.nameB} compared. ${say(f.nameA, f.nameB, f.ab)} ${say(f.nameB, f.nameA, f.ba)}`;
    }
    return f.edge >= 0
      ? `${f.nameA} and ${f.nameB} compared. Strength ${f.weight.toFixed(2)}, ${f.word}.`
      : `${f.nameA} and ${f.nameB} compared. No line was published for this pair.`;
  }

  /* Both points on screen at once, which is the one thing a comparison
   * needs the view to do and neither centreOn nor centreOnEdge does.
   * centreOn zooms IN, which can leave the other half of a pair off the
   * plate; this centres the midpoint and pulls the zoom back until the
   * span between the two fits inside the stage with room for their
   * rings. It never zooms further in than the reader already was. */
  function centrePair(ia, ib) {
    if (!nodes[ia] || !nodes[ib] || !cssW || !cssH) return;
    const dx = Math.abs(posX[ia] - posX[ib]);
    const dy = Math.abs(posY[ia] - posY[ib]);
    const room = Math.max(80, Math.min(cssW, cssH) - 120);
    const span = Math.max(dx, dy);
    if (span > 0) {
      const fits = room / (span * baseScale);
      if (fits < zoom) zoom = Math.max(MIN_ZOOM, fits);
    }
    const s = scale();
    panX = -((posX[ia] + posX[ib]) / 2 - cx) * s;
    panY = -((posY[ia] + posY[ib]) / 2 - cy) * s;
    clampPan();
    syncTouchAction();
  }

  function select(i, opts) {
    /* Completing a comparison, and this is why the arming lives here
     * rather than in the pointer handler. Every way of choosing a point
     * already funnels through select(): a dot on the map, a button in
     * the index list, either end of a link's dossier or of another
     * comparison. Putting the second half of the gesture at the funnel
     * gives the pointer, the keyboard and a fingertip the same gesture
     * without a parallel mechanism for any of them.
     *
     * Choosing the held point AGAIN falls through to the ordinary
     * branch below, which cancels: un-picking is the same gesture as
     * picking, which is what a reader expects of a held selection. */
    if (compareA >= 0 && compareB < 0 && i >= 0 && i !== compareA && nodes[i]) {
      setPair(compareA, i, opts);
      return;
    }
    clearCompare();
    selected = i;
    selectedEdge = -1;
    hoveredEdge = -1;
    renderDossier(i);
    if (i >= 0 && nodes[i]) {
      announce(`${nodes[i].a || "Point"} selected.`);
      if (opts && opts.centre) centreOn(i);
    }
    draw();
  }

  function selectEdge(j, opts) {
    const f = edgeFacts(j);
    if (!f) return;
    // A link and a comparison are two answers to the same question and
    // one rail. Choosing a link ends the comparison rather than sitting
    // beside it.
    clearCompare();
    selectedEdge = j;
    selected = -1;
    hoveredEdge = -1;
    // A link the reader chose is worth fetching the books for even on
    // the merged shelf, where nothing was fetched on load.
    ensureFingerprints();
    renderLinkDossier(j);
    syncIndexSelection();
    announce(
      f.cite
        ? `Link selected. ${f.nameA} cites ${f.nameB}, ${fmt(f.cite.total)} citations, ${fmt(f.cite.ref)} of them refutations.`
        : `Link selected. ${f.nameA} and ${f.nameB}, strength ${f.weight.toFixed(2)}, ${f.word}.`
    );
    if (opts && opts.centre) centreOnEdge(j);
    draw();
  }

  function clearSelection() {
    clearCompare();
    selected = -1;
    selectedEdge = -1;
    renderDossierEmpty();
  }

  function centreOn(i) {
    if (!nodes[i] || !cssW) return;
    if (zoom < 2) zoom = 2;
    panX = -(posX[i] - cx) * scale();
    panY = -(posY[i] - cy) * scale();
    clampPan();
    syncTouchAction();
  }

  /*
   * A link is centred on its MIDDLE and, unlike a point, it is not
   * zoomed in on. A line reached from the keyboard often runs right
   * across the plate, and magnifying its midpoint puts both of the
   * things it is about off screen. Centring alone is what "show me
   * where this is" means for something that has length.
   */
  function centreOnEdge(j) {
    const e = edges[j];
    if (!e || !cssW) return;
    const a = e[0];
    const b = e[1];
    if (!nodes[a] || !nodes[b]) return;
    panX = -((posX[a] + posX[b]) / 2 - cx) * scale();
    panY = -((posY[a] + posY[b]) / 2 - cy) * scale();
    clampPan();
    syncTouchAction();
  }

  /* ── Pan and zoom ─────────────────────────────────────────────────
   *
   * Deliberately conservative on the wheel. A plain two-finger scroll
   * over the map SCROLLS THE PAGE, as it does everywhere else; only a
   * pinch (which a trackpad reports as a wheel event with ctrlKey set)
   * or a held modifier zooms. Hijacking page scroll is the usual way a
   * map like this comes to feel broken, and the buttons mean nothing
   * depends on the gesture being discovered.
   */
  function clampPan() {
    // At zoom 1 the fitted layout already fills the stage, so there is
    // nowhere to pan and drifting off-centre only loses the map. Past
    // that, half a stage of overscroll in each direction.
    if (zoom <= MIN_ZOOM) {
      panX = 0;
      panY = 0;
      return;
    }
    const s = scale();
    const limX = (spanX * s) / 2 + cssW / 2;
    const limY = (spanY * s) / 2 + cssH / 2;
    panX = Math.max(-limX, Math.min(limX, panX));
    panY = Math.max(-limY, Math.min(limY, panY));
  }

  function zoomAt(factor, sx, sy) {
    const next = Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, zoom * factor));
    if (next === zoom) return;
    const before = scale();
    const wx = (sx - cssW / 2 - panX) / before + cx;
    const wy = (sy - cssH / 2 - panY) / before + cy;
    zoom = next;
    const after = scale();
    panX = sx - cssW / 2 - (wx - cx) * after;
    panY = sy - cssH / 2 - (wy - cy) * after;
    clampPan();
    syncTouchAction();
    draw();
  }

  function resetView() {
    zoom = 1;
    panX = 0;
    panY = 0;
    syncTouchAction();
    draw();
  }

  /*
   * touch-action is switched rather than fixed. At zoom 1 the whole map
   * is on screen and there is nothing to pan to, so the canvas keeps
   * `pan-y` and a finger dragged down the page scrolls the page as it
   * should. Once zoomed in, panning is the point, so it becomes `none`.
   * A canvas that is permanently `touch-action: none` is a trap on a
   * phone; one that is permanently `pan-y` can never be panned.
   */
  function syncTouchAction() {
    canvas.style.touchAction = zoom > MIN_ZOOM ? "none" : "pan-y";
  }

  let dragging = false;
  let dragMoved = false;
  let dragId = null;
  let dragX = 0;
  let dragY = 0;

  function localPoint(e) {
    const rect = canvas.getBoundingClientRect();
    return { x: e.clientX - rect.left, y: e.clientY - rect.top };
  }

  canvas.addEventListener("pointerdown", (e) => {
    if (e.button != null && e.button !== 0) return;
    const p = localPoint(e);
    dragging = true;
    dragMoved = false;
    dragId = e.pointerId;
    dragX = p.x;
    dragY = p.y;
    // setPointerCapture throws on a pointer id it does not consider
    // active, and the throw would take the rest of this handler with it
    // (FRONTEND §6.34). Capture is a convenience, not a precondition.
    try {
      canvas.setPointerCapture(e.pointerId);
    } catch (_) { /* capture unavailable; the move handler still works */ }
  });

  canvas.addEventListener("pointermove", (e) => {
    const p = localPoint(e);
    if (dragging && e.pointerId === dragId) {
      const dx = p.x - dragX;
      const dy = p.y - dragY;
      if (!dragMoved && (Math.abs(dx) > 3 || Math.abs(dy) > 3)) dragMoved = true;
      if (dragMoved) {
        if (zoom > MIN_ZOOM) {
          panX += dx;
          panY += dy;
          clampPan();
        }
        dragX = p.x;
        dragY = p.y;
        draw();
      }
      return;
    }
    /* Nodes first, and a node always wins. A line passing under a dot
     * must never take that dot's hover: the dot is the thing with a
     * dossier behind it, and a map where pointing at a person sometimes
     * selects a line through them is a map that feels broken.
     *
     * The edge test only runs where the node test found nothing, which
     * is also what keeps it off the hot path in a crowded region. */
    const hit = hitTest(p.x, p.y);
    const edgeHit = hit >= 0 ? -1 : hitTestEdge(p.x, p.y, EDGE_TOL_HOVER);
    if (hit !== hovered || edgeHit !== hoveredEdge) {
      hovered = hit;
      hoveredEdge = edgeHit;
      canvas.style.cursor = hit >= 0 || edgeHit >= 0 ? "pointer" : "default";
      draw();
    }
  });

  function endDrag(e) {
    if (!dragging) return;
    if (e && e.pointerId !== dragId) return;
    dragging = false;
    dragId = null;
    try {
      if (e) canvas.releasePointerCapture(e.pointerId);
    } catch (_) { /* nothing was captured */ }
  }

  canvas.addEventListener("pointerup", (e) => {
    const wasDrag = dragMoved;
    endDrag(e);
    if (wasDrag) return;
    const p = localPoint(e);
    /* The same order as the hover, for the same reason, and this is the
     * whole of the touch story for edges: there is no hover on a phone,
     * so the tap that selects a point also selects a line when it lands
     * on one and on nothing else. The tolerance is 16px rather than the
     * hover's 7 because a fingertip is not a cursor.
     *
     * A 1px diagonal is still a poor target at any tolerance, so this
     * is the convenience path rather than the guaranteed one. The
     * guaranteed one on a phone is the same as the keyboard's: tap a
     * point, then tap a row in the "Strongest links" list its dossier
     * carries. */
    const hit = hitTest(p.x, p.y);
    if (hit >= 0) {
      /* Shift-click is the ACCELERATOR, never the discoverable path:
       * it is the universal "and this one as well", it cannot exist on
       * a touchscreen, and a reader who does not know it loses nothing
       * because the rail's Compare button is the real gesture. The
       * anchor is whichever point is already in hand, so shift-clicking
       * a third dot swaps the far end of an open pair rather than
       * starting over. */
      const anchor = compareA >= 0 ? compareA : selected;
      if (e.shiftKey && anchor >= 0 && anchor !== hit && nodes[anchor]) {
        setPair(anchor, hit);
      } else {
        select(hit);
      }
    } else {
      const edgeHit = hitTestEdge(p.x, p.y, tapTolerance(e));
      if (edgeHit >= 0) {
        selectEdge(edgeHit);
      } else if (compareA >= 0 && compareB < 0) {
        /* Escaping a half-chosen pair. Tapping empty ground cancels the
         * arm and gives back the point that was held, rather than
         * clearing the rail out from under a reader who has just been
         * told to choose a second point and has mis-tapped. A second
         * tap on nothing then clears as it always did. */
        const back = compareA;
        clearCompare();
        select(back);
      } else {
        clearSelection();
        draw();
      }
    }
    syncIndexSelection();
  });

  canvas.addEventListener("pointercancel", endDrag);
  canvas.addEventListener("pointerleave", (e) => {
    endDrag(e);
    if (hovered !== -1 || hoveredEdge !== -1) {
      hovered = -1;
      hoveredEdge = -1;
      draw();
    }
  });

  canvas.addEventListener(
    "wheel",
    (e) => {
      if (!e.ctrlKey && !e.metaKey) return; // let the page scroll
      e.preventDefault();
      const p = localPoint(e);
      zoomAt(e.deltaY < 0 ? 1.16 : 1 / 1.16, p.x, p.y);
    },
    { passive: false }
  );

  // The canvas is focusable so the map is not an island in the tab
  // order for someone who reads it visually but drives with a keyboard.
  // The path for anyone who cannot see it is the index list.
  canvas.addEventListener("keydown", (e) => {
    const step = 40;
    let handled = true;
    if (e.key === "ArrowLeft") panX += step;
    else if (e.key === "ArrowRight") panX -= step;
    else if (e.key === "ArrowUp") panY += step;
    else if (e.key === "ArrowDown") panY -= step;
    else if (e.key === "+" || e.key === "=") zoomAt(1.25, cssW / 2, cssH / 2);
    else if (e.key === "-" || e.key === "_") zoomAt(1 / 1.25, cssW / 2, cssH / 2);
    else if (e.key === "0") resetView();
    else handled = false;
    if (!handled) return;
    e.preventDefault();
    clampPan();
    draw();
  });

  /* Escape leaves a comparison from anywhere in the panel, which is the
   * one keystroke a reader will try without being told. Bound on the
   * root rather than on the canvas because the gesture is armed from a
   * button in the rail and the keyboard path never touches the canvas
   * at all.
   *
   * No preventDefault and no stopPropagation: the handler does nothing
   * unless a comparison is actually open, so it can never swallow an
   * Escape that belonged to the tab shell around it or to the index
   * filter's own search field. */
  root.addEventListener("keydown", (e) => {
    if (e.key !== "Escape" || compareA < 0) return;
    const back = compareA;
    clearCompare();
    select(back);
    syncIndexSelection();
    announce("Comparison cleared.");
  });

  if (zoomInBtn) zoomInBtn.addEventListener("click", () => zoomAt(1.35, cssW / 2, cssH / 2));
  if (zoomOutBtn) zoomOutBtn.addEventListener("click", () => zoomAt(1 / 1.35, cssW / 2, cssH / 2));
  if (resetBtn) resetBtn.addEventListener("click", resetView);

  /* ── Legend ───────────────────────────────────────────────────────
   *
   * Also the filter. Seven warm swatches from a closed palette cannot
   * be told apart reliably at a 3px dot, so colour is never the only
   * channel: pressing a legend entry isolates its category, the dossier
   * names the category in words, and unclassified points differ in
   * shape as well as colour. WCAG 1.4.1 in practice rather than on
   * paper.
   */
  function renderLegend() {
    if (!legendEl) return;
    legendEl.textContent = "";
    if (!cats.length && !nodes.length) return;

    const entries = cats.filter((c) => c && typeof c.k === "string");
    if (nodes.some((n) => !catKeyOf(n))) entries.push({ k: "", l: "Unclassified" });

    entries.forEach((c) => {
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "cn-legend-item";
      const on = !hiddenCats[c.k];
      btn.setAttribute("aria-pressed", on ? "true" : "false");
      if (!on) btn.classList.add("is-off");

      const dot = document.createElement("span");
      dot.className = "cn-legend-dot";
      dot.setAttribute("aria-hidden", "true");
      const slot = catIndex[c.k];
      if (typeof slot === "number") dot.style.background = catColors[slot % catColors.length];
      else dot.classList.add("cn-legend-dot--ring");
      btn.appendChild(dot);
      btn.appendChild(textEl("span", "cn-legend-label", c.l || "Unclassified"));

      btn.addEventListener("click", () => {
        const off = !hiddenCats[c.k];
        if (off) hiddenCats[c.k] = true;
        else delete hiddenCats[c.k];
        // Updated in place rather than by re-rendering the legend.
        // Rebuilding replaces the button that was just pressed, and a
        // keyboard user who activates a toggle then finds focus on
        // <body> has lost their place in the page with no way back but
        // to start tabbing again. Measured 2026-09-04: the rebuild sent
        // document.activeElement to body every time.
        btn.setAttribute("aria-pressed", off ? "false" : "true");
        btn.classList.toggle("is-off", off);
        // A selection that has just been filtered off the map must not
        // stay in the dossier claiming to be on it. A LINK goes when
        // either of its ends goes, which is the same rule the drawing
        // and the hit test both use.
        if (selected >= 0 && nodes[selected] && !isVisible(nodes[selected])) clearSelection();
        if (selectedEdge >= 0) {
          const se = edges[selectedEdge];
          if (!se || !isVisible(nodes[se[0]]) || !isVisible(nodes[se[1]])) clearSelection();
        }
        /* A comparison goes when EITHER of its ends goes, the same rule
         * a link follows, and for the same reason: half a pair on the
         * map and a whole pair in the rail is the rail describing
         * something that is not there. Where the far end went the near
         * one is given back on its own, rather than the reader losing
         * both to a filter they used on neither. */
        if (compareA >= 0) {
          const goneA = !nodes[compareA] || !isVisible(nodes[compareA]);
          const goneB = compareB >= 0 && (!nodes[compareB] || !isVisible(nodes[compareB]));
          if (goneA) clearSelection();
          else if (goneB) {
            const back = compareA;
            clearCompare();
            select(back);
          }
        }
        hoveredEdge = -1;
        // The links list inside an open dossier names points that may
        // have just been hidden, so it is rebuilt rather than left.
        refreshDossier();
        renderIndex();
        renderCaption();
        draw();
      });

      legendEl.appendChild(btn);
    });
  }

  /* ── The index: the keyboard and screen-reader path ───────────────
   *
   * A canvas is opaque to assistive technology, so every point is also
   * a real focusable button here and pressing one does exactly what
   * clicking the dot does. Capped and paired with a filter box rather
   * than rendering all 2,600 at once: 2,600 buttons is a slow
   * disclosure and an unusable one to arrow through, and the filter
   * searches the WHOLE set, so nothing is unreachable. The cap is
   * stated on screen rather than left to be discovered.
   */
  const INDEX_CAP = 200;

  // Held so the selected state can be repainted WITHOUT rebuilding the
  // list. Same reason as the legend: the button a keyboard user just
  // pressed must still be there, and still be focused, afterwards.
  let indexButtons = [];

  /* Both halves of a comparison are marked here, not just `selected`.
   * The index list is the whole of the keyboard path onto this map, so
   * a reader who armed a comparison and is now arrowing the list for
   * the second point has to be able to see which entry is already in
   * hand. Without it the list would show nothing pressed at all while a
   * pair was open, which reads as the selection having been lost. */
  function syncIndexSelection() {
    for (let k = 0; k < indexButtons.length; k++) {
      const entry = indexButtons[k];
      const on = entry.i === selected || entry.i === compareA || entry.i === compareB;
      entry.el.classList.toggle("is-selected", on);
      entry.el.setAttribute("aria-pressed", on ? "true" : "false");
    }
  }

  function visibleOrder() {
    const out = [];
    for (let i = 0; i < nodes.length; i++) {
      if (isVisible(nodes[i])) out.push(i);
    }
    out.sort((a, b) => sortMetric(nodes[b]) - sortMetric(nodes[a]) || a - b);
    return out;
  }

  function renderIndex() {
    if (!indexListEl || !indexBuilt) return;
    indexListEl.textContent = "";
    indexButtons = [];

    const q = indexFilter ? (indexFilter.value || "").trim().toLowerCase() : "";
    let order = visibleOrder();
    if (q) {
      order = order.filter((i) => {
        const n = nodes[i];
        return (
          String(n.a || "").toLowerCase().indexOf(q) >= 0 ||
          String(n.sub || "").toLowerCase().indexOf(q) >= 0
        );
      });
    }

    const total = order.length;
    const shown = order.slice(0, INDEX_CAP);

    shown.forEach((i) => {
      const li = document.createElement("li");
      li.className = "cn-index-row";
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "cn-index-btn";
      // Same rule as syncIndexSelection: a compared point is in hand
      // even though `selected` is -1 while a pair is open.
      const marked = i === selected || i === compareA || i === compareB;
      if (marked) btn.classList.add("is-selected");
      btn.setAttribute("aria-pressed", marked ? "true" : "false");
      btn.appendChild(textEl("span", "cn-index-name", nodes[i].a || "Untitled"));
      if (nodes[i].sub) btn.appendChild(textEl("span", "cn-index-sub", nodes[i].sub));
      btn.addEventListener("click", () => {
        select(i, { centre: true });
        syncIndexSelection();
      });
      // Focus is the keyboard's hover: arrowing down the list moves the
      // label around the map, which is the only way someone who cannot
      // use a pointer gets the "where is this one?" answer at all.
      btn.addEventListener("focus", () => {
        hovered = i;
        draw();
      });
      btn.addEventListener("blur", () => {
        if (hovered !== i) return;
        hovered = -1;
        draw();
      });
      li.appendChild(btn);
      indexListEl.appendChild(li);
      indexButtons.push({ i, el: btn });
    });

    if (!indexNoteEl) return;
    if (!total) {
      // Three different reasons for an empty list, and they are not
      // interchangeable (FRONTEND §6.33). With no nodes at all the view
      // failed to load or was never mined, and [data-cn-error] above is
      // already saying which; this line stays silent rather than
      // blaming a legend the reader never touched. Measured 2026-09-04:
      // it did exactly that on a 404 before this branch existed.
      if (!nodes.length) indexNoteEl.textContent = "";
      else if (q) indexNoteEl.textContent = `Nothing on this shelf matches “${q}”.`;
      else indexNoteEl.textContent = "Every category is switched off in the legend.";
    } else if (total > shown.length) {
      indexNoteEl.textContent = `Showing the ${shown.length} largest of ${fmt(total)}. Filter to reach the rest.`;
    } else {
      indexNoteEl.textContent = `${fmt(total)} ${total === 1 ? "point" : "points"}.`;
    }
  }

  if (indexEl) {
    // Built on first disclosure, not on load: a shelf change while the
    // list is closed should not pay for 200 buttons nobody asked for.
    indexEl.addEventListener("toggle", () => {
      if (!indexEl.open || indexBuilt) return;
      indexBuilt = true;
      renderIndex();
    });
  }
  if (indexFilter) indexFilter.addEventListener("input", renderIndex);

  /* ── Caption ──────────────────────────────────────────────────── */

  function renderCaption() {
    if (!captionEl) return;
    captionEl.textContent = "";
    if (!nodes.length) return;
    const noun = NODE_NOUN[view] || "point";
    let visible = 0;
    for (let i = 0; i < nodes.length; i++) {
      if (isVisible(nodes[i])) visible++;
    }
    const count =
      visible === nodes.length
        ? `${fmt(nodes.length)} ${noun}${nodes.length === 1 ? "" : "s"}`
        : `${fmt(visible)} of ${fmt(nodes.length)} ${noun}s`;
    /* What is on screen, always, and on the citation maps always as N
     * of M. 37,427 pairs is ten times what this map has drawn before,
     * so a default that showed some of them and said "37,427 links"
     * would be a silent truncation of the loudest kind: the reader
     * would be counting a picture that is not the one in front of them.
     * The number here is budgetCount, which is what the draw loop
     * itself gates on, so the two cannot come apart. */
    const links = citeMode
      ? edgesOn
        ? `${fmt(budgetCount)} of ${fmt(edges.length)} citation pairs drawn`
        : `${fmt(edges.length)} citation pairs, hidden`
      : edgesOn
        ? `${fmt(edges.length)} links`
        : `${fmt(edges.length)} links, hidden`;
    const from = isAll ? ` from ${fmt(allShelvesFor(view).length - allMissed)} shelves` : "";
    captionEl.appendChild(textEl("span", "cn-caption-count", `${count}${from}, ${links}`));
    const blurb = citeMode
      ? layout === LAYOUT_RINGS
        ? CITE_BLURB[view] || CITE_BLURB.cited
        : CITE_REGION_BLURB[view] || CITE_REGION_BLURB.cited
      : isAll
        ? ALL_BLURB[view] || ALL_BLURB.authors
        : layout === LAYOUT_REGIONS
          ? REGION_BLURB[view]
          : VIEW_BLURB[view];
    captionEl.appendChild(textEl("span", "cn-caption-blurb", blurb || ""));

    /* What the citation maps measure and what they do not. Three
     * separate corrections in three separate spans, because folding any
     * of them into the sentence above would bury it. The contested one
     * is the one that must never be dropped: a refutation count read on
     * its own says something the data does not say. */
    if (citeMode) {
      captionEl.appendChild(
        textEl("span", "cn-caption-key", CITE_LINE_KEY[view] || CITE_LINE_KEY.cited)
      );
      captionEl.appendChild(textEl("span", "cn-caption-caveat", CITE_SCOPE_CAVEAT));
      captionEl.appendChild(textEl("span", "cn-caption-caveat", CITE_TRADITION_CAVEAT));
      if (view === "contested") {
        captionEl.appendChild(textEl("span", "cn-caption-caveat", CITE_CONTESTED_CAVEAT));
      }
    }

    /* The one thing this view cannot do, in its own span rather than
     * folded into the sentence above, because it is a caveat about the
     * picture rather than a description of it. EVERY edge in the data
     * was computed inside a single shelf: the worker never compared a
     * pair from two different shelves, so a merged map that drew its
     * lines the usual way would look corpus-wide while showing fifteen
     * separate neighbourhoods, and would be silently missing exactly
     * the cross-tradition links a reader opens this for. Hence the
     * lines start hidden here (see setShelf) and hence this line. */
    if (isAll) {
      captionEl.appendChild(textEl("span", "cn-caption-caveat", ALL_LINKS_CAVEAT));
    }

    if (canvas) {
      const where = citeMode
        ? "in the library's citation graph"
        : isAll
          ? "across all shelves"
          : `on the ${(shelves.find((s) => s.slug === shelfSlug) || {}).shelf || "this"} shelf`;
      canvas.setAttribute("aria-label", `Map of ${count} ${where}.`);
    }
  }

  /* ── Loading ──────────────────────────────────────────────────── */

  async function getJSON(url) {
    if (cache.has(url)) return cache.get(url);
    const resp = await fetch(url, { credentials: "omit" });
    if (!resp.ok) {
      const err = new Error(`HTTP ${resp.status}`);
      err.status = resp.status;
      throw err;
    }
    const json = await resp.json();
    cache.set(url, json);
    return json;
  }

  function availableViews(slug) {
    // The citation graph's two views are never offered beside the three
    // Scripture ones and the three are never offered beside them. They
    // are different measurements over different payloads, and a picker
    // that mixed them would offer combinations with nothing behind
    // them.
    if (slug === CITE_SLUG) return CITE_VIEWS.slice();
    if (slug === ALL_SLUG) return ALL_VIEWS.filter((v) => allShelvesFor(v).length > 0);
    const s = shelves.find((x) => x.slug === slug);
    const have = (s && s.have) || {};
    return ["authors", "works", "doctrines"].filter((v) => Number(have[v]) > 0);
  }

  // Same rule as allSlugFree: a real shelf answering to this slug wins,
  // and the synthetic entry is simply not offered rather than two
  // things sharing one ?shelf= value.
  function citeSlugFree() {
    return !shelves.some((s) => s && s.slug === CITE_SLUG);
  }

  // The real shelves that carry a view, in the index's own order. The
  // synthetic one is excluded, or it would try to merge itself.
  function allShelvesFor(v) {
    return shelves.filter((s) => s && s.slug !== ALL_SLUG && Number((s.have || {})[v]) > 0);
  }

  // Similarity reads node.x/node.y, and those coordinates are ONE
  // shelf's embedding. Fifteen of them are fifteen unrelated coordinate
  // spaces that happen to share a 0-1000 range, so overlaying them
  // would put position, the map's loudest channel, to work saying
  // something nobody computed. The regional arrangement is safe because
  // the panel places those points itself from the category key.
  /* Which SHELF the reader is on, as against whether citation data has
   * actually landed. The controls read this one, so they are correct
   * the instant the shelf changes rather than one network round trip
   * later; the drawing and the dossier read citeMode, which is set from
   * the payload, so they can never read citation fields off a map that
   * has none. */
  function onCiteShelf() {
    return shelfSlug === CITE_SLUG;
  }

  function similarityOK() {
    // The citation payload carries no x/y at all, so there is nothing
    // to lay out by. Same answer as the merged shelf, different reason,
    // and the note under the control says which.
    return !isAll && !onCiteShelf();
  }

  function renderViewButtons() {
    const avail = availableViews(shelfSlug);
    viewBtns.forEach((b) => {
      const v = b.getAttribute("data-cn-view");
      const ok = avail.indexOf(v) >= 0;
      b.hidden = !ok;
      const on = ok && v === view;
      b.classList.toggle("is-active", on);
      b.setAttribute("aria-pressed", on ? "true" : "false");
    });
    // Said out loud rather than left as an unexplained gap: a shelf with
    // one view reads as a broken picker otherwise.
    if (!viewsNote) return;

    // The citation graph is not a shelf and does not have a `have`
    // block, so the "has been mined for" sentence below would be a
    // claim about a shelf that does not exist.
    if (onCiteShelf()) {
      viewsNote.hidden = false;
      viewsNote.textContent = `${CITE_VIEWS_NOTE} ${CITE_FLOOR_NOTE}`;
      return;
    }

    // The merged shelf is missing a view for a reason of its own, and
    // the "has been mined for" sentence below would be a lie about it:
    // works IS mined on all fifteen shelves, it just cannot be merged.
    if (isAll) {
      const lines = [ALL_VIEWS_NOTE];
      if (allMissed > 0) {
        lines.push(
          allMissed === 1
            ? "One shelf could not be read just now, so it is not in this picture."
            : `${fmt(allMissed)} shelves could not be read just now, so they are not in this picture.`
        );
      }
      viewsNote.hidden = false;
      viewsNote.textContent = lines.join(" ");
      return;
    }

    if (avail.length >= 3) {
      viewsNote.hidden = true;
      viewsNote.textContent = "";
      return;
    }
    const names = avail.map((v) => (VIEW_LABEL[v] || v).toLowerCase());
    const shelfName = (shelves.find((x) => x.slug === shelfSlug) || {}).shelf || "This shelf";
    viewsNote.hidden = false;
    viewsNote.textContent = names.length
      ? `${shelfName} has been mined for ${names.length === 1 ? names[0] : names.join(" and ")} only.`
      : `${shelfName} has not been mined yet.`;
  }

  function clearMap() {
    nodes = [];
    edges = [];
    cats = [];
    catIndex = {};
    hiddenCats = {};
    adj = [];
    posX = new Float64Array(0);
    posY = new Float64Array(0);
    cellSpan = new Float64Array(0);
    regions = [];
    ringBands = [];
    bounds = null;
    inAdj = [];
    outAdj = [];
    refuters = new Int32Array(0);
    topRefuter = new Int32Array(0);
    reverseAt = null;
    inBudget = new Uint8Array(0);
    budgetCount = 0;
    // An empty map is not a citation map. Leaving the flag up would
    // leave the caption promising citation pairs and the links control
    // showing a budget over an edge list that no longer exists.
    citeMode = false;
    budgets = [];
    renderBudgetSelect();
    clearSelection();
    hovered = -1;
    hoveredEdge = -1;
    renderLegend();
    renderCaption();
    if (indexBuilt) renderIndex();
    draw();
  }

  function adopt(payload) {
    nodes = Array.isArray(payload.nodes) ? payload.nodes : [];
    cats = Array.isArray(payload.cats) ? payload.cats : [];
    // Drop any edge whose endpoints are not both real node indices, so
    // a malformed pair cannot throw inside the draw loop.
    edges = (Array.isArray(payload.edges) ? payload.edges : []).filter(
      (e) =>
        Array.isArray(e) &&
        Number.isInteger(e[0]) &&
        Number.isInteger(e[1]) &&
        e[0] >= 0 &&
        e[1] >= 0 &&
        e[0] < nodes.length &&
        e[1] < nodes.length
    );

    catIndex = {};
    cats.forEach((c, i) => {
      if (c && typeof c.k === "string") catIndex[c.k] = i;
    });
    hiddenCats = {};
    hovered = -1;
    hoveredEdge = -1;
    clearSelection();
    buildAdjacency();
    // Set from the PAYLOAD rather than from the shelf slug, so a switch
    // caught half way through cannot leave the drawing reading citation
    // fields off a Scripture map or the other way round.
    citeMode = !!payload.cite;
    buildCiteStats();
    buildBudgets();
    if (citeMode) {
      // Kept across a view switch where the ladder still offers it, so
      // a reader who widened the field does not have it narrowed again
      // underneath them.
      const want = budgetAt(budgetKey) ? budgetKey : CITE_BUDGET_DEFAULT[view] || "all";
      applyBudget(want);
      edgesOn = want !== "none";
    } else {
      inBudget = new Uint8Array(0);
      budgetCount = 0;
    }
    renderBudgetSelect();
    computeWeights();
    positionNodes();
    fit();
    resetView();
    renderLegend();
    renderCaption();
    if (indexBuilt) {
      if (indexFilter) indexFilter.value = "";
      renderIndex();
    }
    draw();
  }

  /*
   * One file, both views. The payload is cached like every other, so
   * switching between "Most cited" and "Most contested" costs nothing
   * on the wire; what it does cost is a re-adapt, because the index
   * list's second line and the ring metric are both written per view.
   */
  async function loadCitations() {
    const token = ++loadToken;
    clearError();
    setStatus("Reading the citation graph…");
    let payload;
    try {
      payload = await getJSON(CITE_URL);
    } catch (err) {
      console.error("[faith-constellations] could not load the citation graph", err);
      if (token !== loadToken) return;
      setStatus("");
      // Never a blank plate. A 404 here means the graph has not been
      // published, which is a different sentence from a network
      // failure, and both are different from "nobody cites anybody"
      // (FRONTEND 6.33).
      showError(
        err && err.status === 404
          ? "The citation graph has not been published yet."
          : "Could not reach the library. Please check your connection and try again."
      );
      clearMap();
      return;
    }
    if (token !== loadToken) return;
    setStatus("");
    adopt(adaptCitations(payload, view));
    renderViewButtons();
    renderLayoutButtons();
  }

  async function load() {
    if (!shelfSlug || !view) return;
    if (shelfSlug === CITE_SLUG) {
      loadCitations();
      return;
    }
    const token = ++loadToken;
    clearError();
    setStatus("Drawing the map…");
    const url = `${BASE}/${encodeURIComponent(shelfSlug)}/${encodeURIComponent(view)}.json`;

    let payload;
    try {
      payload = await getJSON(url);
    } catch (err) {
      console.error("[faith-constellations] could not load", url, err);
      if (token !== loadToken) return;
      setStatus("");
      // Never "this shelf is empty": a 404 means the view was not
      // mined, which is a different sentence from a network failure,
      // and both are different from "there is nothing to show".
      showError(
        err && err.status === 404
          ? "That view has not been mined for this shelf yet."
          : "Could not reach the library. Please check your connection and try again."
      );
      clearMap();
      return;
    }

    if (token !== loadToken) return;
    setStatus("");
    adopt(payload);
    // Links are shown by default on a single shelf, so the profiles
    // behind them are wanted straight away. Not awaited, and a failure
    // never reaches the map.
    if (edgesOn) ensureFingerprints();
  }

  /* ── Merging the shelves ──────────────────────────────────────────
   *
   * The worker serves no merged payload, so this is the only place it
   * exists. Three traps, all of them measured against the live
   * endpoints on 2026-09-04 rather than reasoned about.
   *
   * ONE: the same name is on several shelves. 1,690 author rows across
   * the fifteen shelves that have the view carry only 1,314 distinct
   * names; one in four authors is on more than one shelf and James
   * Ussher is on four (anglican, english-divines, puritan, reformed).
   * Drawn as they arrive, he is four dots.
   *
   * TWO, and this is the one that looks like arithmetic and is not: the
   * shelves OVERLAP rather than partition, so the figures cannot be
   * added. 290 of the 326 repeated authors carry an IDENTICAL `n` on
   * every shelf they appear on, which is the same works counted twice
   * rather than two halves of a corpus. Where the figures do differ
   * they nest: Ussher's english-divines row is 5,181 mined pages over
   * 54 works, and his puritan (1,268 / 14) and anglican (3,913 / 40)
   * rows add up to exactly that. So does Lancelot Andrewes's, and so
   * does John Pearson's. Summing would have inflated 325 of the 326 by
   * up to three times (Jeremiah Burroughs), which on a log radius ramp
   * changes how big a writer is drawn and where they sit in the index.
   *
   * Taking the MAX is not the true union either: Ussher's reformed row
   * adds a work that his english-divines row does not contain. But the
   * union is not computable from what the payload carries, since
   * nothing here says which works two shelves have in common, and the
   * max is a floor rather than a fiction. So the representative is the
   * single richest reading, its own figures are shown unaltered, and
   * the dossier names the shelf they came from and says the shelves
   * overlap. A number that is one shelf's honest total beats a sum that
   * is nobody's.
   *
   * THREE: edges are indices INTO one payload's node array, so every
   * one of them has to be remapped or they point at whoever now
   * occupies that slot. Merging also makes duplicates of the edges
   * themselves, since a pair on two shelves was measured twice: 3,435
   * author edges collapse to 2,938 distinct pairs. The stronger reading
   * is kept.
   *
   * The category vocabulary needs no remapping at all: all sixteen
   * shelves declare the same seven keys in the same order in each
   * vocabulary, verified across every payload the worker serves.
   */
  function bigger(a, b) {
    const na = Number(a.n) || 0;
    const nb = Number(b.n) || 0;
    if (na !== nb) return na > nb;
    const pa = Number(a.pg) || 0;
    const pb = Number(b.pg) || 0;
    return pa > pb;
  }

  function mergeCats(items) {
    const seen = {};
    const out = [];
    items.forEach(({ payload }) => {
      (Array.isArray(payload.cats) ? payload.cats : []).forEach((c) => {
        if (!c || typeof c.k !== "string" || !c.k || seen[c.k]) return;
        seen[c.k] = true;
        out.push({ k: c.k, l: c.l });
      });
    });
    // Sorted canonically rather than left in first-seen order, so the
    // merged map hands out the same colour slots as every single shelf
    // does and a reader switching between them keeps their bearings.
    out.sort((a, b) => byCanonRank(a.k, b.k));
    return out;
  }

  function mergeShelfPayloads(items) {
    const order = [];
    const byName = Object.create(null);
    // shelf position -> (local node index -> merged node index)
    const maps = items.map(() => Object.create(null));

    items.forEach(({ shelf, payload }, si) => {
      const list = Array.isArray(payload.nodes) ? payload.nodes : [];
      const label = shelf.shelf || shelf.slug;
      for (let i = 0; i < list.length; i++) {
        const n = list[i];
        if (!n || typeof n.a !== "string" || !n.a) continue;
        let slot = byName[n.a];
        if (!slot) {
          slot = { at: order.length, node: n, from: label, shelves: [label] };
          byName[n.a] = slot;
          order.push(slot);
        } else {
          if (slot.shelves.indexOf(label) < 0) slot.shelves.push(label);
          if (bigger(n, slot.node)) {
            slot.node = n;
            slot.from = label;
          }
        }
        maps[si][i] = slot.at;
      }
    });

    // Copies, never the cached payload's own objects: `cache` hands the
    // same object back to a single-shelf load, and a merged-only field
    // left on it would then show up on a shelf that was never merged.
    const merged = order.map((slot) => {
      const out = { ...slot.node };
      out._shelves = slot.shelves;
      out._shelfOf = slot.from;
      return out;
    });

    const pairs = Object.create(null);
    items.forEach(({ payload }, si) => {
      const list = Array.isArray(payload.edges) ? payload.edges : [];
      const map = maps[si];
      for (let i = 0; i < list.length; i++) {
        const e = list[i];
        if (!Array.isArray(e)) continue;
        const a = map[e[0]];
        const b = map[e[1]];
        // A pair that merged onto ONE point is a name linked to itself,
        // which is not a line and cannot be drawn.
        if (typeof a !== "number" || typeof b !== "number" || a === b) continue;
        const w = Number(e[2]);
        if (!isFinite(w)) continue;
        const key = a < b ? `${a}:${b}` : `${b}:${a}`;
        const held = pairs[key];
        if (!held) pairs[key] = [Math.min(a, b), Math.max(a, b), w];
        else if (w > held[2]) held[2] = w;
      }
    });

    return { nodes: merged, edges: Object.keys(pairs).map((k) => pairs[k]), cats: mergeCats(items) };
  }

  async function loadAll() {
    const token = ++loadToken;
    clearError();
    const list = allShelvesFor(view);
    if (!list.length) {
      setStatus("");
      showError("No shelf carries that view.");
      clearMap();
      return;
    }

    // A real loading state, and one that moves. Fifteen requests on a
    // slow connection is long enough that a message which never changes
    // reads as a page that has stopped.
    let done = 0;
    const total = list.length;
    setStatus(`Reading ${total} shelves…`);
    const settled = await Promise.all(
      list.map((s) =>
        getJSON(`${BASE}/${encodeURIComponent(s.slug)}/${encodeURIComponent(view)}.json`)
          .then(
            (payload) => ({ shelf: s, payload }),
            (err) => {
              console.error("[faith-constellations] shelf failed inside all", s.slug, err);
              return null;
            }
          )
          .then((r) => {
            done += 1;
            if (token === loadToken) setStatus(`Reading the shelves, ${done} of ${total}…`);
            return r;
          })
      )
    );

    if (token !== loadToken) return;
    const ok = settled.filter(Boolean);
    setStatus("");

    // A merged view is not allowed to quietly stand in for the whole
    // library when part of it did not arrive (FRONTEND §6.33). All
    // fifteen failing is a network failure and says so; some of them
    // failing draws what there is and names the shortfall.
    if (!ok.length) {
      showError("Could not reach the library. Please check your connection and try again.");
      clearMap();
      return;
    }
    allMissed = total - ok.length;
    adopt(mergeShelfPayloads(ok));
    renderViewButtons();
    if (edgesOn) ensureFingerprints();
  }

  /* ── Reading the citation graph ───────────────────────────────────
   *
   * The adapter. Everything downstream of adopt() reads the
   * constellations shape, so the citation payload is translated into it
   * once, here, rather than being branched on in twenty places. Three
   * things are actually different and all three are absorbed:
   *
   *   `e` is an INDEX into cats, not a key string. catKeyOf() tests for
   *     a string, so an index left as a number would make every author
   *     unclassified and the map one colour.
   *
   *   The tenth category is "unknown" and it holds four authors. It is
   *     dropped from `cats` and those four are emitted with no `e` at
   *     all, which is the same absence the Scripture views already know
   *     how to draw: an open ring, an "Unclassified" legend entry, a
   *     wedge of their own. A tradition nobody was in should not be
   *     painted as a tradition somebody was in.
   *
   *   There is no `sub`, and the index list is the only place an author
   *     can be compared to the next one as text. So the second line is
   *     synthesised per view, and on the contested view it carries the
   *     number of authors refuting alongside the count, which is the
   *     whole defence against reading Reding's 2,680 as a consensus.
   *
   * Copies are made rather than the payload's own objects being marked
   * up, because `cache` hands the same object back on a view switch and
   * a `sub` written for one view would then be read by the other.
   */
  function numOf(v) {
    const n = Number(v);
    return isFinite(n) && n > 0 ? n : 0;
  }

  function adaptCitations(payload, which) {
    const declared = Array.isArray(payload && payload.cats) ? payload.cats : [];
    const cats = [];
    // payload cat index -> our cat index, or -1 for "no category"
    const catMap = declared.map((c) => {
      if (!c || typeof c.k !== "string" || !c.k || c.k === "unknown") return -1;
      cats.push({ k: c.k, l: c.l || c.k });
      return cats.length - 1;
    });

    const src = Array.isArray(payload && payload.nodes) ? payload.nodes : [];
    const nodes = src.map((n) => {
      const out = {
        a: n && typeof n.a === "string" && n.a ? n.a : "Untitled",
        fk: n && typeof n.fk === "string" ? n.fk : "",
        n: numOf(n && n.n),
        pos: numOf(n && n.pos),
        ref: numOf(n && n.ref),
        src: numOf(n && n.src),
      };
      const at = n && typeof n.e === "number" ? catMap[n.e] : -1;
      if (typeof at === "number" && at >= 0) out.e = cats[at].k;
      return out;
    });

    const edges = (Array.isArray(payload && payload.edges) ? payload.edges : [])
      .filter(
        (e) =>
          Array.isArray(e) &&
          Number.isInteger(e[0]) &&
          Number.isInteger(e[1]) &&
          e[0] >= 0 &&
          e[1] >= 0 &&
          e[0] < nodes.length &&
          e[1] < nodes.length &&
          e[0] !== e[1]
      )
      .map((e) => [e[0], e[1], numOf(e[2]), numOf(e[3])]);

    // The second line in the index list, and it is written AFTER the
    // edges exist because the contested one needs them.
    const refBy = new Int32Array(nodes.length);
    for (let i = 0; i < edges.length; i++) {
      if (edges[i][3] > 0) refBy[edges[i][1]] += 1;
    }
    nodes.forEach((n, i) => {
      if (which === "contested") {
        n.sub = n.ref
          ? `${fmt(n.ref)} ${n.ref === 1 ? "refutation" : "refutations"} from ${fmt(refBy[i])} ${refBy[i] === 1 ? "author" : "authors"}`
          : "Never refuted";
      } else {
        n.sub = n.pos
          ? `${fmt(n.pos)} ${n.pos === 1 ? "citation" : "citations"} from ${fmt(n.src)} ${n.src === 1 ? "author" : "authors"}`
          : "Never cited";
      }
    });

    return { nodes, edges, cats, cite: true };
  }

  /*
   * The directed halves of the adjacency, plus the two figures that
   * stop a refutation count being read as a verdict.
   *
   * Both lists are sorted by the pair's TOTAL citations rather than by
   * refutations, and the dossier re-sorts the argument list itself.
   * That is deliberate: "who cites this author most" and "who argues
   * with them most" are different questions with different answers, and
   * Aquinas is the case that proves it. Scotus is his fifth largest
   * source and his largest opponent, and the rail has to be able to say
   * both without either list being the other one filtered.
   */
  function buildCiteStats() {
    const nn = nodes.length;
    inAdj = new Array(nn);
    outAdj = new Array(nn);
    refuters = new Int32Array(nn);
    topRefuter = new Int32Array(nn).fill(-1);
    reverseAt = new Map();
    if (!citeMode) return;

    for (let i = 0; i < edges.length; i++) {
      const e = edges[i];
      const a = e[0];
      const b = e[1];
      if (!outAdj[a]) outAdj[a] = [];
      if (!inAdj[b]) inAdj[b] = [];
      outAdj[a].push(i);
      inAdj[b].push(i);
      reverseAt.set(`${a}:${b}`, i);
      if (e[3] > 0) {
        refuters[b] += 1;
        const held = topRefuter[b];
        if (held < 0 || e[3] > edges[held][3]) topRefuter[b] = i;
      }
    }
    const heavy = (p, q) => (edges[q][2] || 0) - (edges[p][2] || 0) || p - q;
    for (let i = 0; i < nn; i++) {
      if (inAdj[i]) inAdj[i].sort(heavy);
      if (outAdj[i]) outAdj[i].sort(heavy);
    }
  }

  function reverseEdge(j) {
    const e = edges[j];
    if (!e) return -1;
    return directedEdge(e[1], e[0]);
  }

  /* ── How many lines, and why that many ────────────────────────────
   *
   * 37,427 edges is roughly ten times what this map has drawn before
   * and the alpha tiers were tuned around 3,700, so the whole set is
   * not the default anywhere. What IS the default was chosen off the
   * measured distribution rather than picked:
   *
   *   MOST CITED defaults to pairs of 250 citations or more, which is
   *     1,348 of them. The threshold is a round number a reader can
   *     hold, it is well inside the ink budget the existing map already
   *     proves at 3,753, and it leaves the shape of the thing intact:
   *     almost every one of those lines runs inward, which is the
   *     picture the view exists to show.
   *
   *   MOST CONTESTED defaults to pairs carrying ten refutations or
   *     more, which is 2,066. It deliberately does NOT default to the
   *     911 argument edges, tempting as that is, because the ref*2>n
   *     test excludes Scotus on Aquinas: 8,829 citations, 1,072 of them
   *     refutations, the largest dispute in the library and only 12% of
   *     its own pair. A contested map without the largest dispute on it
   *     is the wrong map. Arguments-only is offered as a rung rather
   *     than used as the floor.
   *
   * Every count here is measured off the payload on the spot. Nothing
   * about the ladder is remembered from a previous version of the
   * worker, and the number the caption prints is the number the draw
   * loop will actually put on screen.
   */
  const CITE_BUDGETS = {
    cited: [
      { key: "n500", label: "500 citations or more", test: (e) => e[2] >= 500 },
      { key: "n250", label: "250 citations or more", test: (e) => e[2] >= 250 },
      { key: "n100", label: "100 citations or more", test: (e) => e[2] >= 100 },
      { key: "n25", label: "25 citations or more", test: (e) => e[2] >= 25 },
      { key: "all", label: "Every pair", test: () => true },
    ],
    contested: [
      { key: "arg", label: "Arguments only", test: (e) => e[3] * 2 > e[2] },
      { key: "ref100", label: "100 refutations or more", test: (e) => e[3] >= 100 },
      { key: "ref25", label: "25 refutations or more", test: (e) => e[3] >= 25 },
      { key: "ref10", label: "10 refutations or more", test: (e) => e[3] >= 10 },
      { key: "ref1", label: "Every pair with a refutation", test: (e) => e[3] >= 1 },
      { key: "all", label: "Every pair", test: () => true },
    ],
  };
  const CITE_BUDGET_DEFAULT = { cited: "n250", contested: "ref10" };

  function buildBudgets() {
    budgets = [];
    if (!citeMode) return;
    const rungs = CITE_BUDGETS[view] || CITE_BUDGETS.cited;
    rungs.forEach((rung) => {
      let count = 0;
      for (let i = 0; i < edges.length; i++) {
        if (rung.test(edges[i])) count += 1;
      }
      // A rung nothing satisfies is not offered. It would read as a
      // control that does nothing rather than as a fact about the data,
      // and the caption is where a zero belongs.
      if (count > 0) budgets.push({ key: rung.key, label: rung.label, test: rung.test, count });
    });
    budgets.push({ key: "none", label: "Hidden", test: () => false, count: 0 });
  }

  function budgetAt(key) {
    for (let i = 0; i < budgets.length; i++) {
      if (budgets[i].key === key) return budgets[i];
    }
    return null;
  }

  function applyBudget(key) {
    inBudget = new Uint8Array(edges.length);
    budgetCount = 0;
    const rung = budgetAt(key);
    if (!rung || rung.key === "none") {
      budgetKey = rung ? rung.key : "none";
      return;
    }
    budgetKey = rung.key;
    for (let i = 0; i < edges.length; i++) {
      if (rung.test(edges[i])) {
        inBudget[i] = 1;
        budgetCount += 1;
      }
    }
  }

  // The one predicate the drawing, the hit test and the caption all
  // read, so a line that is countable is hoverable and a line that is
  // hoverable is on screen.
  function edgeShown(i) {
    if (!citeMode) return true;
    return inBudget.length > i ? inBudget[i] === 1 : false;
  }

  function renderBudgetSelect() {
    if (!budgetSel) return;
    if (!citeMode) {
      budgetSel.hidden = true;
      budgetSel.textContent = "";
      if (linksGroup) linksGroup.hidden = false;
      return;
    }
    if (linksGroup) linksGroup.hidden = true;
    budgetSel.hidden = false;
    budgetSel.textContent = "";
    budgets.forEach((rung) => {
      const opt = document.createElement("option");
      opt.value = rung.key;
      // The count sits in the option itself, so the cost of widening is
      // known before the reader commits to it rather than after.
      opt.textContent =
        rung.key === "none" ? rung.label : `${rung.label} (${fmt(rung.count)})`;
      budgetSel.appendChild(opt);
    });
    budgetSel.value = edgesOn ? budgetKey : "none";
  }

  function setBudget(key) {
    if (!citeMode) return;
    if (key === "none") {
      edgesOn = false;
    } else {
      edgesOn = true;
      applyBudget(key);
    }
    renderCaption();
    // A hover or a selection on a line that has just left the budget
    // would keep describing something no longer on the plate. A hover
    // is dropped; a SELECTION is kept, because a chosen link is drawn
    // whatever the field is doing and reading one at a time with the
    // field off is a real way to use this map.
    hoveredEdge = -1;
    draw();
    announce(
      edgesOn
        ? `Drawing ${fmt(budgetCount)} of ${fmt(edges.length)} pairs.`
        : "Links hidden."
    );
  }

  /* ── Arrangement and links: the two display toggles ─────────────── */

  function renderLayoutButtons() {
    const simOK = similarityOK();
    layoutBtns.forEach((b) => {
      const which = b.getAttribute("data-cn-layout");
      // The regional button is named after what its regions are, so a
      // reader on the doctrines view is not told it files by Scripture.
      if (which === LAYOUT_REGIONS) {
        b.textContent = REGION_BTN_LABEL[view] || "By section";
      }
      // Rings is HIDDEN off the citation graph rather than disabled.
      // The two disabled controls in this panel are both cases where a
      // reader might reasonably expect the arrangement to work and has
      // to be told why it does not. Nobody expects a Scripture shelf to
      // offer an arrangement by citation count, and a permanently
      // struck-through third option would be furniture.
      if (which === LAYOUT_RINGS) {
        b.hidden = !onCiteShelf();
      }
      // Disabled and still there, rather than removed. A control that
      // vanishes on one shelf and returns on the next reads as the
      // panel breaking; a greyed one with a sentence under it reads as
      // an answer. The sentence is the load-bearing half.
      if (which === LAYOUT_SIMILARITY) {
        b.disabled = !simOK;
        b.setAttribute("aria-disabled", simOK ? "false" : "true");
      }
      const on = which === layout;
      b.classList.toggle("is-active", on);
      b.setAttribute("aria-pressed", on ? "true" : "false");
    });
    if (!arrangeNote) return;
    arrangeNote.hidden = simOK;
    arrangeNote.textContent = simOK ? "" : onCiteShelf() ? CITE_ARRANGE_NOTE : ALL_ARRANGE_NOTE;
  }

  function renderLinksButton() {
    if (!linksBtn) return;
    linksBtn.textContent = edgesOn ? "Shown" : "Hidden";
    linksBtn.classList.toggle("is-active", edgesOn);
    linksBtn.setAttribute("aria-pressed", edgesOn ? "true" : "false");
  }

  function setLayout(next) {
    if (next !== LAYOUT_REGIONS && next !== LAYOUT_SIMILARITY && next !== LAYOUT_RINGS) return;
    if (next === LAYOUT_SIMILARITY && !similarityOK()) return;
    if (next === LAYOUT_RINGS && !onCiteShelf()) return;
    if (next === layout) return;
    layout = next;
    renderLayoutButtons();
    // The selection is kept across the switch on purpose: watching the
    // point you chose move from the blob to its section, or back, is the
    // one thing that explains what the two arrangements are to each
    // other. The dossier is already correct and is not rebuilt.
    positionNodes();
    fit();
    resetView();
    renderCaption();
    announce(
      layout === LAYOUT_RINGS
        ? `Arranged in ${ringBands.length} rings, grouped into ${regions.length} wedges by tradition.`
        : layout === LAYOUT_REGIONS
          ? `Arranged in sections, ${regions.length} of them.`
          : "Arranged by similarity."
    );
  }

  function setEdges(on) {
    edgesOn = !!on;
    // A hover on a line that has just been switched off would keep
    // painting a plate for something no longer on the plate. A
    // SELECTED link is kept: it stays drawn, and reading one link at a
    // time with the field off is the good way to use the merged map.
    hoveredEdge = -1;
    renderLinksButton();
    renderCaption();
    draw();
    // Where the profiles were skipped on load because nothing was
    // linked on screen, this is the moment they became worth having.
    if (edgesOn) ensureFingerprints();
    announce(edgesOn ? "Links shown." : "Links hidden.");
  }

  function setView(next) {
    if (!next || next === view) return;
    view = next;
    allMissed = 0;
    renderViewButtons();
    renderLayoutButtons();
    if (isAll) {
      loadAll();
      return;
    }
    load();
  }

  function setShelf(slug) {
    const wasAll = isAll;
    const wasCite = shelfSlug === CITE_SLUG;
    const isCite = slug === CITE_SLUG;
    shelfSlug = slug;
    isAll = slug === ALL_SLUG;
    allMissed = 0;

    /* Entering the citation graph forces the ring arrangement and
     * leaving it gives the reader back whatever they had, the same
     * bargain the merged shelf strikes below. Rings is not a preference
     * here: the two views exist to say who is at the centre and who is
     * at the rim, and neither of the other two arrangements can say it.
     *
     * The edge budget is dropped on the way in and on the way out. It
     * is a decision about a 37,427-edge graph and it means nothing over
     * a Scripture payload, so carrying it across would be carrying a
     * number that no longer refers to anything. */
    if (isCite && !wasCite) {
      preCiteLayout = layout;
      layout = LAYOUT_RINGS;
      budgetKey = "";
    } else if (!isCite && wasCite) {
      layout = preCiteLayout || LAYOUT_REGIONS;
      preCiteLayout = "";
      budgetKey = "";
      edgesOn = true;
    }

    /* Entering the merged shelf turns the links OFF and forces the
     * regional arrangement, and both of those are corrections rather
     * than preferences: no edge in the data crosses a shelf, and no two
     * shelves share a coordinate space. Leaving it gives the reader
     * back whatever they had, since neither of those is a choice they
     * made. */
    if (isAll && !wasAll) {
      preAllLayout = layout;
      if (layout === LAYOUT_SIMILARITY) layout = LAYOUT_REGIONS;
      edgesOn = false;
    } else if (!isAll && wasAll) {
      if (preAllLayout) layout = preAllLayout;
      preAllLayout = "";
      edgesOn = true;
    }
    renderLinksButton();

    const avail = availableViews(slug);
    // Keep the reader's chosen view across a shelf change when the new
    // shelf has it; otherwise fall back to the first it does have,
    // rather than requesting a 404.
    if (avail.indexOf(view) < 0) view = avail[0] || "";
    renderViewButtons();
    renderLayoutButtons();
    if (!view) {
      showError("This shelf has not been mined yet.");
      clearMap();
      return;
    }
    if (isAll) {
      loadAll();
      return;
    }
    load();
  }

  viewBtns.forEach((b) => {
    b.addEventListener("click", () => setView(b.getAttribute("data-cn-view")));
  });
  layoutBtns.forEach((b) => {
    b.addEventListener("click", () => setLayout(b.getAttribute("data-cn-layout")));
  });
  if (linksBtn) linksBtn.addEventListener("click", () => setEdges(!edgesOn));
  if (budgetSel) budgetSel.addEventListener("change", () => setBudget(budgetSel.value));
  shelfSel.addEventListener("change", () => setShelf(shelfSel.value));

  async function boot() {
    readPalette();
    renderLayoutButtons();
    renderLinksButton();
    setStatus("Reading the shelves…");
    let index;
    try {
      index = await getJSON(`${BASE}/index.json`);
    } catch (err) {
      console.error("[faith-constellations] could not load the shelf index", err);
      setStatus("");
      showError("Could not reach the library. Please check your connection and try again.");
      return;
    }

    shelves = Array.isArray(index && index.shelves) ? index.shelves : [];
    if (!shelves.length) {
      setStatus("");
      showError("The library returned no shelves.");
      return;
    }

    shelfSel.textContent = "";
    // The merged shelf first, and only where there is something to
    // merge. It is not a shelf the worker knows about, so it is added
    // here rather than expected in the index.
    const allViews = allSlugFree() ? ALL_VIEWS.filter((v) => allShelvesFor(v).length > 0) : [];
    if (allViews.length) {
      const opt = document.createElement("option");
      opt.value = ALL_SLUG;
      opt.textContent = ALL_LABEL;
      shelfSel.appendChild(opt);
    }
    // The citation graph, next to the merged shelf and above the
    // sixteen real ones, because both of them are corpus-wide and the
    // list below is per-shelf. It is a different endpoint rather than a
    // shelf, so it is added here rather than expected in the index.
    const citeOK = citeSlugFree();
    if (citeOK) {
      const opt = document.createElement("option");
      opt.value = CITE_SLUG;
      opt.textContent = CITE_LABEL;
      shelfSel.appendChild(opt);
    }
    shelves.forEach((s) => {
      const opt = document.createElement("option");
      opt.value = s.slug;
      opt.textContent = s.shelf || s.slug;
      shelfSel.appendChild(opt);
    });
    shelfSel.disabled = false;

    // A shareable starting point. Read, never written: the tab shell
    // already owns the URL through replaceState and two writers would
    // rewrite each other.
    let wantShelf = "";
    let wantView = "";
    let wantLayout = "";
    try {
      const q = new URLSearchParams(window.location.search);
      wantShelf = q.get("shelf") || "";
      wantView = q.get("view") || "";
      wantLayout = q.get("arrange") || "";
    } catch (_) { /* malformed query string; fall through to the defaults */ }

    if (wantLayout === LAYOUT_SIMILARITY || wantLayout === LAYOUT_REGIONS) layout = wantLayout;
    // ?shelf=all and ?shelf=citations are real, shareable starting
    // points, but only where those options were actually offered above.
    // ?arrange=rings is deliberately NOT honoured: setShelf forces the
    // ring arrangement on the citation graph and refuses it everywhere
    // else, so a query string could only ever ask for a state the panel
    // would immediately correct.
    const known =
      shelves.some((s) => s.slug === wantShelf) ||
      (wantShelf === ALL_SLUG && allViews.length > 0) ||
      (wantShelf === CITE_SLUG && citeOK);
    const first = known ? wantShelf : shelves[0].slug;
    shelfSel.value = first;
    if (wantView && availableViews(first).indexOf(wantView) >= 0) view = wantView;
    setShelf(first);
  }

  /* ── Waking up ────────────────────────────────────────────────────
   *
   * The panel ships `hidden` (it is one of five tabs), so at parse time
   * the stage has zero width. A canvas measured then would be sized 0
   * and stay that way, and half a megabyte of JSON fetched then would
   * be spent on a reader who never opened the tab. So the panel waits
   * for its first real size and treats that as "the tab was opened".
   *
   * THREE triggers, not one, and the MutationObserver is the load-
   * bearing one. ResizeObserver delivery happens in the "update the
   * rendering" steps, which a browser does not run for a tab it is not
   * painting — the same throttle that makes requestAnimationFrame
   * useless there (FRONTEND §6.30). Measured 2026-09-04: in the browser
   * pane a ResizeObserver on this stage fires NOT ONCE, not even its
   * initial observation, so a panel that woke on RO alone would sit
   * blank forever in any environment that throttles it. A
   * MutationObserver is delivered as a microtask and does not care
   * whether anything is being painted, and `hidden` flipping on the
   * panel is precisely the signal, so that is what the boot hangs on.
   * RO and the window resize event are kept for what they are actually
   * good at: re-fitting the map after a rotation or a window drag.
   *
   * Nothing here has to know how faith-research.js switches tabs; the
   * only thing it reads is the `hidden` attribute the shell already
   * toggles.
   */
  let booted = false;
  let lastW = 0;
  let lastH = 0;

  function onResize() {
    if (!measure()) return;
    if (cssW === lastW && cssH === lastH) return;
    lastW = cssW;
    lastH = cssH;
    if (!booted) {
      booted = true;
      syncTouchAction();
      boot();
      return;
    }
    // A resize is a RE-LAYOUT, not just a re-fit, when the regions are
    // on screen: the column count and each region's aspect are both
    // chosen from the stage's box, so a rotation from portrait to
    // landscape is a different board. The pan goes back to nothing
    // because the coordinates it was measured against no longer exist;
    // the reader's zoom is kept, since that is a choice about how close
    // they wanted to be and it survives the reshuffle.
    if (layout === LAYOUT_REGIONS && nodes.length) {
      positionNodes();
      fit();
      panX = 0;
      panY = 0;
      clampPan();
      syncTouchAction();
      draw();
      return;
    }
    fit();
    clampPan();
    draw();
  }

  // The tab being opened. getBoundingClientRect inside the callback
  // forces the layout it needs, so the stage reports its real size on
  // the same turn the attribute changed.
  const hostPanel = root.closest ? root.closest("[data-research-panel]") : null;
  if (hostPanel && typeof MutationObserver === "function") {
    new MutationObserver(() => {
      if (!hostPanel.hidden) onResize();
    }).observe(hostPanel, { attributes: true, attributeFilter: ["hidden"] });
  }

  // Re-fitting after a rotation or a window drag. onResize returns
  // early when the box has not actually changed, so having both of
  // these plus the observer above costs nothing.
  if (typeof ResizeObserver === "function") new ResizeObserver(onResize).observe(stageEl);
  window.addEventListener("resize", onResize);

  // And immediately, for the case where this partial is dropped on a
  // page of its own rather than behind a tab.
  onResize();

  // measureText is wrong until the body face has actually loaded, which
  // would leave the first hover label's plate mis-sized. One repaint
  // when the fonts settle costs nothing and fixes it.
  if (document.fonts && document.fonts.ready && typeof document.fonts.ready.then === "function") {
    document.fonts.ready.then(() => draw()).catch(() => {});
  }
})();
