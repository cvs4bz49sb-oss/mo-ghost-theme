# Ask the Library — `/?find=ask`, the Ask workspace, and the API contract

Written 2026-09-11 for Ian. Live reference: https://thefaithreceived.vercel.app/?find=ask.
Every rule below is grounded in the code named beside it. Source of truth on the Vercel side:
`tools/visual_review/faith_received.py` (the home page), `tools/ask_workspace/*` (the
workspace: `ask-workspace.js`, `ask-workspace.css`, `ask-store.js`, `ask-stream.js`,
`ask-worker.js`, `ask-jobs.js`, `ask.html`), `api/ask.mjs` and `api/investigations.mjs`
(the brain), `tools/embed/ask.js` (the drop-in widget). On MereO the same files are ported
under `assets/js/port/ask-*.js` (branch `ask-port-ui`) and speak to the staging worker
`mo-tfr-ask-dev` (`/v1/ask`, `/v1/investigations`). Retrieval internals are in
SEARCH-SPEC.md §5; this document is the surface and the contract.

---

## 1. What `/?find=ask` is

The library home has three search modes on one input (`#heroQ`): **works**, **passages**,
**ask** (`setMode` in the home script). `?find=ask` boots the page in the ask mode; the mode
is written back to the URL by `url()` so the address is shareable. Nothing else on the
page changes: the shelves stay underneath, the omnibox suggestions still attach to the
same input.

### 1.1 Boot from the URL (`restore()`)

```
q     = ?q=  (or legacy #a=<author>)
scope = ?shelf=
mode  = ['passages','ask'].includes(?find=) ? ?find= : 'works'
```
`?shelf=` without `?q=` and without `find=passages|ask` opens the real shelf view instead
(`__openShelf`), so `find=ask` is one of the two values that keeps the home-search module
in charge. The shelf-from-URL door (`__shelfFromURL`) also yields when `find` is
`passages` or `ask`.

### 1.2 The mode toggle (`.home-modes`)

Two buttons, `data-home-mode="works"` ("Works & authors") and `data-home-mode="ask"`
("Ask the library"), `aria-pressed` reflects the mode. Clicking sets the mode and focuses
the input. `setMode` swaps the copy:

| mode | placeholder / aria-label | submit button | help line (`#homeSearchHelp`) | enterKeyHint |
|---|---|---|---|---|
| works | Search works or authors | Search | Find an author, a title, or a volume such as PL 32, PG 64, or PO 2. | search |
| passages | Find words within the texts | Search | Search exact words across the texts. Search by idea is also available on the results page. | search |
| ask | Ask anything | Ask | Get an answer grounded in the library, with cited passages. | send |

In ask mode the result list, the example chips and the "Paths" block are hidden
(`paint()`: `active` is false unless mode is works). Recent queries still paint.

### 1.3 Submit in ask mode (`form.onsubmit`)

```
remember(); url();
if (mode === 'ask') {
  const opts = { q: input.value.trim(), autoSend: !!q, fresh: true };
  if (window.FRAsk) window.FRAsk.open(opts); else window.__FR_ASK_PENDING__ = opts;
  return;
}
```
`fresh:true` always starts a **new conversation** from the home box. If the workspace
script has not finished loading, the request is parked in `__FR_ASK_PENDING__`; the
workspace's `bootstrap()` opens it as soon as it runs (§3.7). An empty question opens the
workspace on its welcome screen without sending.

### 1.4 Other doors into the same workspace

- Omnibox escape rows "✦ Ask: “q”" (`#ask=<q>`) and the `#ask=` hash handler (`runAsk` in the corpus palette):
  `FRAsk.open({q, autoSend:true, tradition})`, or `__FR_ASK_PENDING__` before load.
- Any element `#heroAsk, #rsAsk, #tabAsk, [data-m="ask"], .frthumb [data-t="ask"], #heroSearchAsk`
  and any same-origin link to `/ask`, `?m=ask` or `?ask=` is intercepted by the workspace's
  capture-phase click listener and opened in place (question taken from `#heroQ` for
  `#heroAsk`, else from `?ask=` / `?q=`; tradition from `?trad=`).
- Keyboard: **⌘/Ctrl+Shift+A** opens the workspace anywhere; **⌘/Ctrl+K** focuses the home
  search (only when the workspace is closed, `html.fra-open` absent).
- Standalone page `/ask` (`ask.html`): the workspace opens on load in `fra-standalone`
  layout with `?chat=<id>` (resume), `?q=` / `?ask=` (question), `?trad=` (shelf).
- Reader: the launcher button `#fra-launcher` (bottom "Ask" pill) and the research rail;
  on a reader page the workspace **docks** as a right rail (§3.6) and defaults the scope to
  the work being read.
- The search page Ask mode (`/search`, `MODE==='ask'`) and the author-room Search tab's
  "Ask" button call the same `FRAsk.open`, passing `authors`/`works` scope.

---

## 2. Page wiring (what a page must load)

`tools/build_dist.py` injects into **every** page head (`_inject_config`):

```
<script>window.__FR_BLOB_BASE__=…; window.__FR_VER=…; window.__FR_ASK_WORKSPACE__=true; …</script>
<link rel="stylesheet" href="/fr-reading-system.css?v=…">
<link rel="stylesheet" href="/ask-workspace.css?v=…">
<script defer src="/ask-store.js?v=…"></script>
<script defer src="/ask-workspace.js?v=…"></script>
<script src="/research-data.js?v=…"></script>
<script src="/research-notebook.js?v=…"></script>
<script defer src="/site-navigation.js?v=…"></script>
```
`ask-store.js` must load before `ask-workspace.js` (the workspace reads `FRChatStore`
at parse time). `ask-worker.js` (SharedWorker, `?v=4`, name `fr-ask-v4`) and
`ask-jobs.js` (dynamic `import()`) are fetched by the workspace itself. `__FR_ASK_WORKSPACE__`
tells older page scripts to park in `__FR_ASK_PENDING__` instead of opening a legacy panel.

MereO template `custom-faith-port-ask.hbs` (and `custom-faith-port-index.hbs`) load the same
set as theme assets: `port/ask.in01.js` (config), `css/port/fr-reading-system.css`,
`css/port/ask-workspace.css`, `port/ask-store.js`, `port/ask-workspace.js`,
`port/research-data.js`, `port/research-notebook.js`, `port/site-navigation.js`,
`port/cgpt-link.js`, plus `port/fr-noblob.js` first. The worker/jobs paths inside the
ported workspace are `/assets/js/port/ask-worker.js?v=7g` and `/assets/js/port/ask-jobs.js`.

---

## 3. The workspace (`ask-workspace.js`)

### 3.1 Public API

```
window.FRAsk = { open(opts), close(), isOpen(), markdown(text, sources), readURL(slug,page),
                 sourceHref(s), sourceCard(s), turnModeLabel(t), offersDeep(t), shownAnswer(t),
                 shownError(t), deliveryIncomplete(t) }
```
`open(opts)` fields: `id` (resume a saved conversation), `fresh` (force a new one), `q`
(prefill), `autoSend` (send `q` immediately), `mode` (`ask`|`deep`; legacy `agent`/`scan` map
to `deep`), `tradition` (one shelf), `shelves[]`, `authors[]`, `groups[]`, `works[]`,
`passage {text, cite, url, slug, page, row}` (a selected passage to quote), `contextWork`
(the reader's slug). Rules in `open()`: an `id` switches to that conversation; otherwise
`fresh`, or no current conversation, or a reader page whose work changed → a new
conversation; with none of `fresh/q/works` the most recent conversation is resumed. Scope
options overwrite the conversation's scope; `q` becomes the draft; `autoSend && q` sends.

An iframe opened inside the workspace (the source pane, `#fra-source-frame`) does not build
its own workspace: it proxies `FRAsk.open` to the parent with `contextWork` set.

### 3.2 Layout (`build()`), DOM order = tab order

`<section id="fra-workspace" class="fra [fra-standalone] [fra-docked]" role="dialog" aria-modal>`

1. `.fra-history-scrim` + `aside.fra-sidebar` — brand link, **New conversation**, "Search
   conversations" input, Conversations / **Archived** toggle, `nav#fra-history-list`, footer
   links (Collections `/pins`, Open Desk `/desk`, the ChatGPT link slot, **Completion
   notifications** toggle) and the note "Conversations are saved in this browser. Deep
   research also saves progress on the server."
2. `main.fra-main`
   - `header.fra-header`: history toggle (mobile), `#fra-title` + `#fra-context` (the scope
     text, "Whole library" by default), theme button (light/dark/sepia, stored `fr_theme`),
     `•••` menu (`Rename conversation`, `Download conversation`, `Archive conversation`),
     `#fra-home` "Library" link (standalone only), `#fra-close` "Return to reading".
   - `nav#fra-reader-bar` (docked in the reader only): **Saved research**, **Expand Ask**.
   - `.fra-mobile-tabs`: **Conversation** / **Read source** (phone, when a source is open).
   - `.fra-body` → `section.fra-chat` → `#fra-feed` with `#fra-welcome` (mark, `h1`
     "Ask the Library", "Explore an idea, understand a passage, or follow a question through
     the texts.", `.fra-suggestions`) and `#fra-thread`; `#fra-jump` "Latest answer ↓".
   - `footer.fra-compose-area`: `#fra-passage` (the selected passage being quoted, with
     cite and a clear button), `.fra-composer` = `textarea#fra-input` (placeholder "Ask
     anything", grows to min(scrollHeight, 170px, 26vh)), `#fra-mode-toggle` (**Ask** /
     **Deep research**), `#fra-scope-toggle` (**Scope**), `#fra-send`. Popovers
     `#fra-modes` and `#fra-scope`.
   - `div#fra-split.fra-split` — the **divider** between the conversation and the source pane (`role="separator"`, `aria-orientation="vertical"`, `aria-valuenow` = the pane's share in percent). Shown only while a source is open on desktop (`.fra-show-reader`), never on phones (≤800px) or in the docked rail. Drag sets `--fra-source-w` on the workspace (28–76% of `.fra-body`, default 53%), remembered in `localStorage fra_source_w`; double-click (or Enter/Space on the handle) resets; ←/→ move 3%, Home/End jump to the limits (`setSplit`, `resetSplit`, `initSplit`; owner 2026-09-11 "allow to shift how much space it takes up on screen"). While dragging the workspace carries `.fra-resizing` (text selection off, the iframe ignores pointer events so the drag is not swallowed).
   - `section.fra-reader` — the **source pane** (width `var(--fra-source-w,53%)`): back button, `#fra-source-title` +
     `#fra-source-location`, "Open reader" (new tab), close, `#fra-source-status`, and the
     `iframe#fra-source-frame` that shows the cited page of the reader with `?hl=`.

Modes copy (`modes`): Ask — "A concise answer from the texts. Choose Deep for a longer
investigation."; Deep research — "Gathers across the relevant texts, then quotes and
explains them in depth. Saves progress after you close the browser. Up to 10 minutes per run;
continue saved research if needed."

### 3.3 Welcome suggestions (`renderSuggestions`)

Grouped question chips, groups shuffled on each new conversation. In a book (reader page
scoped to the work being read) the heading becomes "Ask about this book" with three fixed
groups: *Follow the argument*, *Understand its terms*, *Study its sources* (two questions
each). Elsewhere the library-wide `suggestionGroups`. Clicking a chip sends it.

### 3.4 Scope ("Search within", `openScope`)

- **Search the whole library** (reset).
- **Shelves** — checkboxes over the nine shelf names (`Continental Reformed` is shown for
  the API value `Reformed`): Latin Fathers, Greek Fathers, Eastern Fathers, Medieval, Roman
  Catholic, Continental Reformed, English Divines, Lutheran, Humanism and Law.
- **English groups** — Westminster Divines (the Assembly register `schools.json`), Puritans
  (`party: Puritan`), Anglicans (`party: Anglican`); a hint appears when English Divines and
  a group are both checked.
- **Add works or authors** — search box over the catalogue (`loadCatalog()` = works-index +
  `/data/embcat.json` sister works); rows "All works by <author> · N works" and work rows
  with author/volume; selected items render as chips in `#fra-selected-works`.
- **Use the work I am reading** (reader only).
- **Include my notebook in Ask and Deep research** (`scope.notebook`).
- Help: "Search any selected shelf, group, author or work. Changes apply to the next
  question."; status line "Next question: …".

`compileScope()` turns the selection into the API scope: exactly one shelf and nothing else →
`filters.tradition`; otherwise every shelf/author/group is expanded against the catalogue
into a work list (`scope.tfr`), sister works `@pld:…`/`@pg:…`/`@po:…`/`@aq:…`/`@eebo:…` go to
their own scope keys. Validation errors are surfaced as toasts ("A selected shelf is
unavailable…", "The catalogue could not load…"). `scopeText()` writes the header context:
one item → its name ("Works by Owen", a shelf, a title), several → joined with " · ",
none → "Whole library".

### 3.5 Sending (`send`)

```
body = { messages: [...prior complete turns as user/assistant pairs (last 16)…, {role:'user', content: prompt}],
         progress: true, deep: mode === 'deep' }
+ corpus_access: true          when the scope needed the catalogue
+ scope: { tfr:[slugs], pld:[…], pg:[…], po:[…], aq:[…], eebo:[…] }   when works resolved
  else filters: { tradition }  when exactly one shelf
+ hint_w: <contextWork>        reader page, no explicit works
+ filters.nb: { name, memo, notes[≤12], items[≤40] }   when scope.notebook (from localStorage fr_notes / fr_collections_v1 / fr_hl)
+ corpus_context: last 3 turns' corpusState
```
`prompt` = the question, prefixed by the selected passage when one is attached
(`passagePrompt`). A running turn's Send button becomes **Stop** (`rpc('stop')`, or cancel
the server job for deep). Ask requests go to `POST /api/ask` (format `ask`); Deep requests go
to `POST /api/investigations` (format `job`, body adds `question`, a 6-turn `messages`
history, and `minutes: 10`).

The turn record: `{id, q, a:'', src:[], mode, scope, works, ts, status:'running',
stage:'Preparing the answer', steps:[], passage?}`; the conversation title becomes the first
question (90 chars) and the draft is cleared.

### 3.6 Presentation states (`ask-workspace.css`)

- **Overlay** (default): full-viewport dialog, `html.fra-open` locks page scroll; sidebar
  column + main; the source pane takes 53% width beside the chat when open
  (`.fra-show-reader`), resizable by the divider (28–76%, remembered per browser).
- **Standalone** (`/ask`): same, with the "Library" back link.
- **Docked** (reader pages, `.fra-docked`): a right rail `width: var(--fr-rail-width, 460px)`
  under the reader header (`--phh`), no sidebar, no shadow; citations navigate the reader
  behind it (`FRReaderResearch.navigate`) instead of opening the source pane; **Expand
  Ask** switches to the overlay.
- Breakpoints: `≤1150px` narrower grid; `≤880px` and `≤800px` phone layout — sidebar becomes
  a drawer (`.fra-history-open`), the source pane becomes the **Read source** tab, the
  composer is pinned above the keyboard using `visualViewport` (`fitViewport`);
  `max-height:550px` compact; `prefers-reduced-motion` and `print` rules; dark theme via
  `prefers-color-scheme` and `data-theme`.

### 3.7 Boot (`bootstrap`)

Creates `#fra-launcher` (the "Ask" pill; on the desk it moves into the toolbar), `#fra-notices`
(completion toasts with an "Open" button) and the `aria-live` announcer; `init()` migrates
legacy `fr_chats` localStorage into IndexedDB, then `researchJobs()` recovers server jobs. It
installs the click interceptor (§1.4), the keyboard shortcut, `pagehide` draft flush, a
`storage` listener (theme sync, cross-tab migration), then opens `__FR_ASK_PENDING__` if
set, else opens for `/ask`, `?m=ask` or `?ask=`. A 1 s timer refreshes elapsed counters.

---

## 4. A turn on screen (`renderThread`)

```
<article class="fra-turn" data-turn=…>
  <h2 class="fra-question">…</h2>
  <details class="fra-quoted">Selected passage · <cite> <blockquote>…</blockquote> Read passage</details>   (when a passage was attached)
  <div class="fra-turn-meta">Ask | Deep research</div>
  <div class="fra-progress" role="status">  ⋯ <stage> <elapsed>   (running)
  <div class="fra-answer">  markdown(answer, sources)
  <div class="fra-turn-extra">
      Research context · <loci>                      (t.graph.loci)
      <div class="fra-error" role="alert">           (t.error, via shownError)
      <details class="fra-activity">Research activity · N steps <ol>…</ol></details>
      <details class="fra-activity">Gaps in the evidence <p>…</p></details>   (deep)
      <p class="fra-coverage">N passages found · M pages loaded | Scan capped…</p>
      <details class="fra-sources">N source passages <div>sourceCard…</div></details>
  <div class="fra-actions">Copy answer · Save to notebook · Insert in Desk · Research in Deep · Retry question · [Pause/Continue research]
```

- **Stage line**: `humanStage()` maps tool names to English (`search_meaning` → "Searching by
  meaning", `read_pages` → "Reading source pages", `reception_of` → "Tracing reception" …);
  `data-kind` = writing / reading / checking / searching drives the motion dots.
- **Answer markdown** (`markdown` + `inline`): paragraphs, lists, code, `**bold**`, `*em*`,
  `` `code` ``, `[label](url)` (external and `/api/corpus` open in a new tab). Citation
  forms the model may emit, all turned into `<a class="fra-cite">`:
  - `[slug/pN]` and `[W slug:N]` → reader link `readURL(slug, page)` (`/read?w=<slug>#b<N>-0`,
    first page of a range), text = the source's `cite` or "p. N";
  - a comma/semicolon group `[a/p3, b/p9]` is split into separate cites;
  - `[label]` matching a source's `cit` (sister corpora "PL 32 …", "Aquinas · …") → that
    source's `link`.
  Streaming updates reconcile the DOM (`reconcileAnswer`) rather than re-render, so text
  selection survives.
- **Source card** (`sourceCard`): title (`titleOf` = catalogue title, or the source `t`),
  optional `<q>` quote, and the cite (`cit`/`cite`, else "p. N", else "Read passage"); links to
  `sourceHref` = `link` or `readURL(slug, page)`.
- **Clicking a citation or source** inside the workspace opens the **source pane**
  (`openSource`): same-origin `/read…` links load in `#fra-source-frame` with the page and
  `?hl=` (READER-SPEC §8); history gets a `frAskSource` state so Back returns to the
  conversation; in the docked rail the reader behind navigates instead; other origins open
  in a new tab.
- **Actions**: Copy answer (plain text); Save to notebook (`FRResearchNotebook`, saves the
  answer with its sources); Insert in Desk (`FRDesk.insertAnswer`, or `sessionStorage
  fr_desk_insert` then `/desk`); Research in Deep (`offersDeep`: complete Ask turn, not
  out-of-scope) re-asks with the same scope in Deep; Retry question after `error`,
  `interrupted`, `stopped`; server-job controls Pause / Continue research / Research further
  for 10 minutes / Reconnect Deep research.
- The feed auto-scrolls while near the bottom; otherwise **Latest answer ↓** appears.

---

## 5. Persistence and the background worker

### 5.1 Store (`ask-store.js`, `FRChatStore`)

IndexedDB `fr-conversations` v1, stores `conversations` (keyPath `id`) and `meta`. API:
`all, get, put, meta, setMeta, update(id, change)` (atomic read-modify-write inside one
transaction so another tab cannot overwrite a streaming turn), `id()` (UUID).
Conversation: `{id, t, ts, mode, scope:{works,shelves,authors,groups,tradition,notebook},
contextWork, turns[], draft, draftPassage, archived, unread}`. Legacy `localStorage fr_chats`
is migrated on boot and kept readable for the Desk.

### 5.2 Stream owner (`ask-worker.js`)

One `SharedWorker` per origin (fallback: dedicated `Worker`) owns every in-flight request,
so closing the panel or navigating between pages does not drop the stream. `start` → POST
`request.url` with `request.body` (`credentials: same-origin`), 330 s client timeout, then
reads the body through `FRChatStream.parser(format)` and saves the turn to IndexedDB at most
every 180 ms (serialized writes), broadcasting `updated` / `finished` on a `BroadcastChannel`
`fr-ask-updates`. HTTP errors map to copy: 401/403 "Your preview session has expired…",
429 "The library is busy…", else "Research is unavailable (N)…". A turn whose stream ended
without the completion receipt is marked `error` "The response ended before completion was
confirmed…" (`deliveryIncomplete`). On boot the worker marks turns still `running` after 6
minutes as `interrupted`. Turn status vocabulary: `running, complete, error, stopped,
interrupted, paused`.

### 5.3 Stream parser (`ask-stream.js`, format `ask`)

The Vercel `/api/ask` body is `text/plain` lines:
1. zero or more control lines `{"t":"p","m":"Searching the library…"}` (progress) before the
   preamble; `{"t":"p","delta":"…"}` / `{"t":"p","reset":true}` may carry text; `{"t":"k",…}`
   carries approach/relevance/protocol keys;
2. exactly one **preamble** line `{"sources":[…],"graph":{loci,traditions,works}|null,"deep":"<gaps>"?,"cached":true?}`;
3. then the answer as raw markdown text (streamed tokens), possibly interleaved with more
   `{"t":"p"}` lines at line starts.
Emitted events: `sources`, `progress` (with `approach`, `completion`, `relevance`,
`protocol` when present), `text`, `replace`. An error before the preamble throws; the API
signals a failure after the preamble by appending "The library hit an error answering
this — please try again. (…)", which the worker strips and turns into an error state that
keeps the retrieved sources.

Formats `job` (investigations) and `follow` are NDJSON objects: `plan`, `step`, `progress`,
`report {md, sources|evidence, stats}`, `error`.

### 5.4 Deep research (`ask-jobs.js`, `/api/investigations`)

`FRResearchJobs.init(store, onChange)` recovers the member's jobs (`GET
/api/investigations?list=1`, cursor-paged) and watches running ones (`GET ?id=`). `start`
checks availability, `POST` `{op:'create', question, messages, scope…, minutes:10}`, stores
`turn.serverJob {id, status, revision, canResume}` and `turn.jobRequest` for retry.
Statuses: `queued, running, complete, cancelled→stopped, failed→error,
paused|limit_reached|needs_input→paused`. `control(op)` = `pause`, `resume`, `cancel`,
`retry`. The report (`job.report`, else artifact links) becomes the turn's answer. Optional
browser **Notification** on completion (`#fra-notify`).

---

## 6. `POST /api/ask` — request and response contract (`api/ask.mjs`)

Request (JSON):
```
messages        [{role:'user'|'assistant', content}]  last 20 kept; last user message = the question (≤ 2000 chars)
progress        true → progress control lines are sent
deep            true → the two-round deep pass (critic names the gaps, second retrieval)
scope           {tfr:[slugs], pld:[ids], pg:[ids], po:[slugs], aq:[slugs], eebo:[slugs]}  hard filters
filters         {tradition:'Reformed'|…, nb:{name,memo,notes,items}, scopeLabel, scopeAuthors, fathers}
hint_w          slug of the work being read (soft hint)
corpus_access   true when the scope was catalogue-expanded
corpus_context  prior turns' corpusState (tool memory)
byo             false to refuse "Use my ChatGPT" routing
```
Behaviour: relevance gate (an unrelated question returns a short "Ask is for this library's
texts…" answer flagged `relevance:'unrelated'`); answer cache (`ASK_CACHE=1`, single-turn,
not deep, no notebook, 14 days, key = site+normalised question+scope); crosswalk of
Sentences / Summa / Scripture references in the question (up to **24** landings per reference from
`v1/sentences.json` / `v1/summa.json` / `v1/scripture.json`; raised from 14 on 2026-09-11 so a chapter
with 17 real commentaries keeps them all — same cap in the worker's `miner.js`); the retrieval stack of
SEARCH-SPEC §5 (planner, channels, RRF, editions collapse, 22-page round-robin, rerank);
`ENUM_RE` ("all the times…", "every place…", "list every…") or a work scope switches to
**enumerate** mode (exhaustive, no rerank); the generation model `ASK_GEN_MODEL`
(default `anthropic/claude-sonnet-5`) streams through the AI Gateway; the "CITE-OR-DIE"
system prompt requires every claim to carry a `[slug/pN]` citation drawn from the supplied
passages. Response: `text/plain; charset=utf-8`, `Cache-Control: no-store`, the line
protocol of §5.3. Source item shape: `{slug, page, title, author}` for library pages;
`{cit, link, sister:'pld'|'pg'|'po'|'aq'}` for sister-corpus and patristic background rows.
Stage messages: search "Searching the library…", read "Reading passages…" / "Reading passages
from N works…", evidence "Combing full texts for exact wording…", deepen "Deep pass — naming
the gaps, searching again…", rank "Weighing the passages…", write "Writing the answer…".
Runtime: Node function, `maxDuration 300`, `supportsResponseStreaming`. Cross-origin: echoes
`Origin`, answers `OPTIONS`, accepts the `x-fr-embed` header for the Ghost widget (gate
change in `runs/ghost_ask_embed.md`).

---

## 7. MereO: what exists and what to do

| Piece | Vercel | MereO today | Action |
|---|---|---|---|
| Home `?find=ask` | `/` (`faith_received.py`) | Ported landing `custom-faith-port-index.hbs` + `port/index.in10.js` carries the same `restore()` (`find=ask` handled) and loads the ported workspace; the route `/the-faith-received/library/` is on the fork only (live site 404s today) | Publish the ported landing route; keep `?find=ask` and the `.home-modes` toggle |
| Workspace | `tools/ask_workspace/*` | `assets/js/port/ask-*.js` — same code with: `BASE` = library worker, `readURL` → `/the-faith-received/read/?w=…`, catalogue from `<worker>/v1/data/embcat.json`, worker script `/assets/js/port/ask-worker.js?v=7g`, brand link `/the-faith-received/library/` | Keep these as the only diffs (exact-substring hunks); re-port never |
| Ask API | `POST /api/ask` (§6) | `POST https://mo-tfr-ask-dev…/v1/ask` (`~/mo-workers/tfr-library/ask-dev/ask.js`): same pipeline ported (planner, GraphRAG route, RRF, miner, rerank, cache on R2 `v1/cache/ask/`), accepts `messages`/`question`, `deep`, `filters`; **streams a different dialect**: `{"type":"progress","message"}*`, `{"type":"delta","text"}*`, `{"type":"result","sources":[…],"cached"?,"relevance"?}` or `{"type":"error"}` | `port/ask-stream.js` already translates the worker dialect into the workspace events (`delta` → first `sources:[]` then `text`; `result` → `sources` + `completion:'complete'`). Keep the translator in step with `lib/ask.js` if the worker's frames change |
| Deep research | `POST /api/investigations` | `POST https://mo-tfr-ask-dev…/v1/investigations` (RESEARCH_RAIL_INSTRUCTIONS §5–6: the op-based protocol the theme's `ask-jobs.js` speaks) | Follow §6 of the rail sheet exactly (it is what broke earlier PRs) |
| Auth and spend cap | preview gate cookie (`fr_gate`), `x-fr-embed` for the widget | the editorial `/the-faith-received/ask/` (`page/faith-ask.js`, `_ask-panel.hbs`) uses `window.MOAuth.fetch` → paid-member bearer token, `GET /v1/ask/usage` meter, 429 cooldown `{ok:false,cooldown:true,reason,error,resetsAt}` | The ported workspace must send the same bearer token from `ask-worker.js` (add the `Authorization` header via `MOAuth` before the fetch) and surface the usage meter or the cooldown copy; anonymous → 401 copy "sign in" |
| Editorial Ask page | none | `custom-faith-ask.hbs` + `page/faith-ask.js`: one question, one answer, footnote citations `[n]`, scope `traditions[]`/`author` | Route `/the-faith-received/ask/` now maps to the ported workspace (`custom-faith-port-ask`); the editorial page stays available on `/search` Ask tab until the workspace replaces it |
| Ghost widget | `/embed/ask.js` | not used on MereO | Optional: drop-in for article pages (`<div id="tfr-ask">` + the script), needs the gate change |

Data the workspace reads besides the API: `works-index.json` and `titles_en.json` (titles for
source cards, `titleOf`), `schools.json` (Westminster register), `embcat.json` (sister
catalogue for scope search), the notebook stores in `localStorage` (`fr_notes`,
`fr_collections_v1`, `fr_pincol`, `fr_hl`, `fr_highlight_passages_v1`), `fr_theme`.

---

## 8. Verification checklist

1. `/?find=ask` → the input reads "Ask anything", the button "Ask", help "Get an answer
   grounded in the library, with cited passages."; the Works & authors / Ask the library
   toggle shows Ask pressed; shelves below unchanged; no result list.
2. Type "What is the covenant of works?" + Enter → the workspace opens (overlay), a new
   conversation titled with the question, the stage line runs (Searching → Reading → Weighing
   → Writing), the answer streams as markdown with `[slug/pN]` rendered as cite links,
   "N source passages" fold lists source cards; actions show Copy / Save to notebook / Insert
   in Desk / Research in Deep.
3. Click a cite → the source pane opens beside the chat on the cited page with the phrase
   highlighted; Back returns to the conversation; "Open reader" opens a new tab.
   Drag the divider left → the source pane widens (stays between 28% and 76%); reload and
   reopen a source → the same width; double-click the divider → back to 53%; at phone
   width the divider is absent and the pane is the Read source tab.
4. Scope → check "Continental Reformed" only → header context "Continental Reformed"; ask
   again → request carries `filters.tradition:'Reformed'`. Add "All works by John Owen" →
   request carries `scope.tfr` with Owen's slugs. Tick the notebook → `filters.nb` present.
5. Mode → Deep research → send → `POST /api/investigations`, Pause / Continue controls
   appear, progress survives reload and panel close; completion toast.
6. Reload mid-answer: the answer continues (SharedWorker); close the tab and reopen: the
   turn is `interrupted` or `error` with Retry, never a fake "complete".
7. Reader page → Ask → the panel docks as the right rail, scope = "Use the work I am
   reading", suggestions say "Ask about this book"; a citation navigates the reader behind.
8. Phone (≤800px): sidebar is a drawer, Read source tab appears when a source is open, the
   composer stays above the keyboard.
9. `?find=ask` on MereO's ported landing behaves as 1–2 with the worker; a signed-out
   member gets the sign-in copy, not a raw network error; a 429 shows the cooldown text.
