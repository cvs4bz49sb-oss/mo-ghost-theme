/*
 * The Faith Received: guided tours.
 *
 * Ian, 2026-09-25: a first-time reader should see the real page, with
 * each feature lit in turn while the rest dims, a sentence or two on what
 * it does, and Next and Back. Five tours, one per page, each ending with
 * a door to the next: reader, Scripture, Topics, Search, Research.
 *
 * START. `?tour=<name>` on any page that loads this file (it rides in
 * the TFR rail partial, so every rail page has it). The address is read
 * the moment this file runs, before reader-core.js rewrites the reader's
 * address away, which is why this is a plain script and not deferred.
 * The tour then waits for its `ready` selector (the reader builds its UI
 * late) and begins.
 *
 * STEPS. Each tour is a list of
 *   { sel: [fallback selectors], title, body, open?, only?, pad? }
 * `sel` is tried in order and the first VISIBLE match is lit; a step
 * whose target is missing or hidden is skipped, never fatal. No `sel`
 * means an intro card over the dimmed page. `open` names a toggle (Tools,
 * Aa) to press first, by its aria-expanded, so the step can point inside
 * the panel; it is pressed again on leaving unless the next step wants
 * the same panel; `shut` names a close button pressed on leaving. `only`
 * is "phone" or "desktop". `at` puts a step on another page: the tour
 * goes there with ?tour=<name>&tstep=<index> and carries on (Topics goes
 * from the index to one topic). Steps without `at` live on the tour's url.
 *
 * MEMBER TOOLS (Ian, 2026-09-25: show them open, to everyone). A step
 * with `member: "<feature>"` carries a Members pill and ends "Available
 * to members." While a tour runs, window.MOTour.active is true and
 * html.fr-touring is set, in memory only; feature-gate.js's hasAccess()
 * lets the panels open for as long as that holds, so no subscribe modal
 * interrupts the tour, and the modal returns the moment the tour ends.
 * The workers keep their own member checks, so a panel whose content
 * comes from a member API is shown with an `example` from the step data,
 * labelled Example, and `fill` can put an example question in its box
 * (`prefill` does the same before the step's panels are opened). `only`
 * also takes "signed-in" or "signed-out", for pages the server renders
 * differently for the two (Search and Research send signed-out readers
 * a sign-up panel instead of the tool).
 *
 * DONE. localStorage tfr_tours_done = ["reader", ...], wrapped, since
 * storage can throw. The hub page reads it through
 * the [data-frt-card] hooks at the end of this file.
 *
 * CSP: no inline script anywhere; the sheet is injected as a <link> from
 * this script's own data-css attribute. Page script: it runs before
 * site.min.js and uses no bundle globals.
 */
(function () {
  "use strict";

  if (window.FRTour) return;

  const me = document.currentScript;
  const CSS = me && me.getAttribute("data-css");
  const DONE_KEY = "tfr_tours_done";
  const PHONE = 640;
  const TOOLS = "#rdTools, [aria-controls=\"frMToolsDrawer\"]";
  const MEMBERS_LINE = "Available to members.";
  // The Research panel and the Ask workspace: their buttons are toggles,
  // so they are pressed only while the panel is shut.
  const NB_OPEN = "#notebook.open";
  const NB = [{ press: TOOLS, unless: NB_OPEN }, { press: "#nbCount, #frMToolsDrawer [data-t=\"nb\"]", unless: NB_OPEN }];
  const ASK_OPEN = "#fra-workspace";
  // The Topics tour moves from the index to one topic's page.
  const TRIN = "/the-faith-received/topics/?t=de-trinitate";
  // The Scripture tour ends on the Verse Desk for the verse it opened.
  const DESK = "/the-faith-received/scripture/desk/?ref=genesis.1.26";
  const ASK = [{ press: TOOLS, unless: ASK_OPEN }, { press: ".fr-td-ask, #frMToolsDrawer [data-t=\"x-ask\"]", unless: ASK_OPEN }];

  // ── The tours ───────────────────────────────────────────────────
  // Copy rules (Ian): plain, warm, brief; one or two sentences; no em
  // dashes; no comma splices or ", and" joins; no hype.
  const TOURS = {
    reader: {
      name: "Reading a work",
      blurb: "Headings, contents, pages, reading settings, the tools tray and the research panel.",
      url: "/the-faith-received/read/?w=pld-433&p=1",
      ready: ["#reading .row", "#rdTools, nav.frthumb"],
      steps: [
        { title: "Reading a work",
          body: "This tour walks through the reader, one feature at a time. Use Next and Back, or the arrow keys on your keyboard." },
        { sel: ["#app .reader-identity", "#h1"],
          title: "The work in front of you",
          body: "The title and author of the work you are reading sit at the top of the page." },
        { sel: ["#reading .fr-hd-card", "#reading .fr-sec-headrow", "#reading .fr-sec-head"],
          title: "Section headings",
          body: "Each book, chapter or article opens with a heading card. Where a work numbers its parts, a small line above the title gives your place." },
        { sel: ["#reading .fr-sec-toggle"],
          title: "Fold a section",
          body: "Press the arrow beside a heading to fold that section away. Press it again to open it." },
        { sel: ["#reading .fr-fold-head", "#reading section.pld-editorial"],
          title: "The editor's notes",
          body: "Notes from the printed edition's editor start folded, so you meet the author first. Open them whenever you want them." },
        { sel: ["#reading .xref"], near: true,
          title: "Scripture references",
          body: "References to Scripture are marked in the text. Point at one to read the verses without leaving the page." },
        { sel: ["#reading .row .en"], member: "tfr-notebook",
          title: "Highlight, note and share",
          body: "Select any words to highlight them, add a note, copy them with a citation or make a quote image." },
        { sel: ["#app > .sidebar"], only: "desktop",
          title: "Contents",
          body: "The contents list every part of the work. Choose one to go straight there." },
        { sel: ["#sbT"], only: "desktop",
          title: "Show or hide the contents",
          body: "This button folds the contents column away to give the text more room. Press it again to bring the column back." },
        { sel: ["nav.frthumb [data-t=\"toc\"]"], only: "phone",
          title: "Contents",
          body: "Contents lists every part of the work. Choose one to go straight there." },
        { sel: [".ph .ctr .pnav", "#pPrev"],
          title: "Turn the page",
          body: "These arrows move one printed page back or forward. The arrow keys on your keyboard do the same." },
        { sel: [".ph .ctr .pgjump", "#pgJump"],
          title: "Go to a page",
          body: "This shows the page you are on. Type a page number and press Enter to jump there." },
        { sel: ["#rsBtn", "nav.frthumb [data-t=\"find\"]"],
          title: "Search this work",
          body: "Search finds every page of this work that contains your words." },
        { sel: ["#aaBtn"],
          title: "Reading settings",
          body: "Aa holds the settings for how the text looks and reads. Here is what is inside." },
        { sel: ["#frAaTools .fr-tb-paras"], open: ["#aaBtn"],
          title: "Split paragraphs",
          body: "Some old books run a single paragraph for pages. Split paragraphs breaks long ones at the ends of sentences without changing a word." },
        { sel: ["#frAaTools #m-modern"], open: ["#aaBtn"], member: "tfr-modernize",
          title: "Modernize",
          body: "Works written in older English also have Modernize here. It updates old spelling and grammar as you read without changing the original." },
        { sel: ["#aaPop"], open: ["#aaBtn"],
          title: "Theme, font and size",
          body: "Choose a light, sepia or dark page, a font, the line spacing and the size of the text. Your choices are remembered on this device." },
        { sel: ["#rdTools", "[aria-controls=\"frMToolsDrawer\"]"],
          title: "Tools",
          body: "Tools opens a tray with everything else the reader can do. Here is what is inside." },
        { sel: [".fr-tools-drawer.is-settled .fr-td-lang", "#frMToolsDrawer [data-t=\"x-lang\"]", "#m-par"], open: [TOOLS],
          title: "Languages",
          body: "Many works come with the original Latin or Greek beside the English. Choose English only, the original only, or both side by side." },
        { sel: [".fr-tools-drawer.is-settled .fr-td-src", "#frMToolsDrawer [data-t=\"x-src\"]"], open: [TOOLS],
          title: "Source",
          body: "Some works come from more than one source text. For those, Source in Tools switches between them." },
        { sel: [".fr-tools-drawer.is-settled .fr-td-scan", ".fr-tools-drawer.is-settled #m-study", "#frMToolsDrawer [data-t=\"study\"]"], open: [TOOLS],
          title: "Page scans",
          body: "Many works include photographs of the printed pages. Where they do, Scan in Tools opens the page beside the text and follows along as you scroll." },
        { sel: [".fr-tools-drawer.is-settled #rdFlow", "#frMToolsDrawer [data-t=\"x-flow\"]"], open: [TOOLS],
          title: "Flow or pages",
          body: "Flow reads as one continuous text. Switch to Pages to read the work page by page, as it was printed." },
        { sel: [".fr-tools-drawer.is-settled .fr-tb-folds", "#frMToolsDrawer [data-t=\"x-folds\"]"], open: [TOOLS],
          title: "Collapse all",
          body: "Fold every section at once to see the shape of the work. Press it again to open them all." },
        { sel: [".fr-tools-drawer.is-settled .fr-tb-ednotes", "#frMToolsDrawer [data-t=\"x-ednotes\"]"], open: [TOOLS],
          title: "Hide editorial notes",
          body: "This removes the editor's notes from every page of every work. The author's own footnotes stay." },
        { sel: [".fr-tools-drawer.is-settled #rdKeep", "#frMToolsDrawer [data-t=\"x-keep\"]"], open: [TOOLS], member: "tfr-bookmarks",
          title: "Bookmark and copy link",
          body: "Bookmark keeps your place in this work for later. Copy link gives you an address that opens this exact page." },
        { sel: [".fr-tools-drawer.is-settled .fr-tb-focus"], open: [TOOLS], only: "desktop",
          title: "Hide the toolbar",
          body: "Give the text the whole screen. A small Show toolbar button brings everything back." },
        { sel: [".fr-tools-drawer.is-settled .fr-tb-report", "#frMToolsDrawer [data-t=\"x-report\"]"], open: [TOOLS], member: "tfr-report",
          title: "Report a problem",
          body: "Found a bad scan, a wrong word or a broken link? Tell us here and we will look into it." },
        { sel: [".fr-tools-drawer.is-settled #nbCount", "#frMToolsDrawer [data-t=\"nb\"]"], open: [TOOLS], member: "tfr-research",
          title: "Research",
          body: "Research opens a panel beside the text for studying this work. The next few steps open it." },
        { sel: ["#notebook.open .nb-tabs", "#notebook .nb-tabs"], open: NB, shut: "#nbClose", member: "tfr-research",
          title: "The Research panel",
          body: "Work describes the edition and its sources. Search looks through the whole work. Passage holds the tools for words you select." },
        { sel: ["#notebook.open #nbWorkSearch", "#nbWorkSearchTab"], open: NB.concat("#nbWorkSearchTab"), shut: "#nbClose", member: "tfr-research",
          fill: { sel: "#nbWorkSearchQuery", value: "satisfaction" },
          title: "Search inside the work",
          body: "Type a word or phrase to list every page where it appears. Choose a result to go to that page." },
        { sel: ["#notebook.open #nbSaved", "#nbSavedTab"], open: NB.concat("#nbSavedTab"), shut: "#nbClose", member: "tfr-notebook",
          example: [
            "“For God to forgive sin without payment would be unfitting.” Anselm, <em>Why God Became Man</em> I.12",
            "Note: compare Calvin, <em>Institutes</em> II.16"
          ],
          title: "Your saved passages",
          body: "Everything you highlight, clip or annotate collects here with its citation, ready to search and to use on the Desk." },
        { sel: [".fr-tools-drawer.is-settled .fr-td-ask", "#frMToolsDrawer [data-t=\"x-ask\"]", "#frMToolsDrawer [data-t=\"ask\"]"], open: [TOOLS], member: "ask",
          title: "Ask",
          body: "Ask opens a conversation about this work beside the text. The next step opens it." },
        { sel: ["#fra-workspace"], open: ASK, shut: "#fra-close", member: "ask",
          fill: { sel: "#fra-input", value: "Why must the one who makes satisfaction be both God and man?" },
          example: [
            "Q. Why must the one who makes satisfaction be both God and man?",
            "A. Anselm answers in Book II, chapters 6 and 7. Only God can pay a debt so great, yet only man owes it. Each claim links to the page it comes from."
          ],
          title: "A conversation beside the book",
          body: "Answers are drawn from the library with citations you can open and check. You can keep asking follow-up questions." },
        { sel: [".ph .ctr .fr-tb-tt", "#frMToolsDrawer [data-t=\"x-tt\"]"],
          title: "How this text was made",
          body: "Transparency explains where this text and its translation came from, including any use of machine translation." },
        { sel: [".tfr-rail"],
          title: "The rest of the library",
          body: "This bar goes everywhere in <em>The Faith Received</em>: reading lists, Scripture, Topics, Search and the research tools." },
        { title: "You are ready to read",
          body: "That is the whole reader. The next tour shows how to read Scripture with the tradition beside it." }
      ]
    },
    scripture: {
      name: "Scripture",
      blurb: "Read any chapter with the writers of the tradition who cited it beside each verse.",
      url: "/the-faith-received/scripture/",
      ready: [".sd-chapter-content .bible-verse", ".sd-overview, .sd-side"],
      steps: [
        { title: "Scripture with the tradition",
          body: "Every chapter of the Bible is here with the writers in the library who cited it. This tour shows how to find them." },
        { sel: [".sd-canon-tabs"],
          title: "Testaments",
          body: "Choose the Old Testament, the New Testament or the Apocrypha. The book list below follows your choice." },
        { sel: ["#sd-book-panel"],
          title: "Book",
          body: "Pick the book you want to read." },
        { sel: [".bible-control--chapter"],
          title: "Chapter",
          body: "Then pick the chapter. The text and its citations load together." },
        { sel: [".sd-bar-inner > label.bible-control:not(.bible-control--chapter)"],
          title: "Translation",
          body: "Read in the translation you prefer. The citations stay the same whichever you choose." },
        { sel: [".bible-controls-nav"],
          title: "Previous and next",
          body: "These arrows move to the chapter before or after this one." },
        { sel: [".sd-chapter-h1"],
          title: "The chapter",
          body: "The text of the chapter reads down the page, verse by verse." },
        { sel: [".sd-overview .sd-ov-stats", ".sd-overview"],
          title: "This chapter in the library",
          body: "Before you choose a verse, the side panel shows how often the library cites this chapter and how many of its verses are cited." },
        { sel: [".sd-ov-top"],
          title: "Most-cited verses",
          body: "The verses the tradition returned to most often, with a bar for each. Choose one to open it." },
        { sel: ["#v26", ".sd-chapter-content .bible-verse"],
          title: "Choose a verse",
          body: "Select any verse to see where the tradition cites it. The next step opens this one." },
        { sel: [".sd-panel .sd-panel-head"], open: [{ press: "#v26", unless: ".sd-panel .sd-panel-head" }],
          title: "A verse and its readers",
          body: "The panel now belongs to the verse you chose. Close returns it to the whole chapter." },
        { sel: [".sd-panel .sd-count"], open: [{ press: "#v26", unless: ".sd-panel .sd-panel-head" }],
          title: "How often it is cited",
          body: "This counts every citation of the verse across the library." },
        { sel: [".sd-panel .sd-filters"], open: [{ press: "#v26", unless: ".sd-panel .sd-panel-head" }],
          title: "Narrow the citations",
          body: "Filter them by tradition, author or century. You can also search the citations for a word." },
        { sel: [".sd-panel .sd-sources"], open: [{ press: "#v26", unless: ".sd-panel .sd-panel-head" }],
          title: "Most-cited sources",
          body: "The works that cite this verse most often. Preview shows the passage itself without leaving the page." },
        { sel: [".sd-comm-toggle"],
          title: "Commentaries",
          body: "Commentaries lists the commentaries in the library on this chapter." },
        { sel: ["#sdCommPanel"], open: [".sd-comm-toggle"],
          title: "Find a commentary",
          body: "Filter the commentaries by tradition or author, then open the chapter or whole-Bible list. Preview reads a commentary here, at its comment on your verse when the library has one." },
        { sel: [".sd-panel .sd-desk-link"], open: [{ press: "#v26", unless: ".sd-panel .sd-panel-head" }],
          title: "The Verse Desk",
          body: "Open the Verse Desk to study every citation of this verse at once, grouped and in full. The next step opens it." },
        { sel: [".sd-desk-head"], at: DESK,
          title: "One verse, everything",
          body: "The Verse Desk gathers everything the library holds on a single verse." },
        { sel: [".sd-desk-nav"], at: DESK,
          title: "Verse by verse",
          body: "Step to the verse before or after this one, or go back to the whole chapter." },
        { sel: [".sd-parallel"], at: DESK,
          title: "In five translations",
          body: "The verse in five translations, side by side." },
        { sel: [".sd-charts"], at: DESK,
          title: "Citations at a glance",
          body: "See who cited the verse by century and by tradition. Select a bar to show only those citations." },
        { sel: [".sd-desk-sec > .sd-filters"], at: DESK,
          title: "Narrow the citations",
          body: "Filter by tradition, author or century. You can also search the citations for a word." },
        { sel: [".sd-sources.sd-top"], at: DESK,
          title: "Most-cited sources",
          body: "The works that cite this verse most often. Preview shows the passage without leaving the desk." },
        { sel: [".sd-desk-sec:has(#sd-h-comm)"], at: DESK,
          title: "Commentaries",
          body: "Commentaries on the chapter, then whole-Bible commentaries. Open a list and select Preview to read one without leaving the desk." },
        { sel: [".sd-desk-sec:has(#sd-h-ask)"], at: DESK, member: "ask",
          title: "Ask about this verse",
          body: "Ask a question about the verse. Answers come from the library with citations you can check." },
        { sel: ["#sd-h-all"], at: DESK,
          title: "Every citation",
          body: "Below that, every citation of the verse in the library, each with its passage." },
        { title: "Scripture, done",
          body: "Any chapter works the same way. The next tour shows the library arranged by topic." }
      ]
    },
    topics: {
      name: "Topics",
      blurb: "The library arranged by doctrine, from theological method to the last things.",
      url: "/the-faith-received/topics/",
      ready: [".td-parts .td-locus, .td-head .td-title"],
      steps: [
        { title: "Topics",
          body: "Topics gathers what the tradition taught on each doctrine, from the creeds and confessions to the great treatises." },
        { sel: [".td-find"],
          title: "Find a topic",
          body: "Type a word to find a topic by name." },
        { sel: [".td-parts .td-part"],
          title: "The outline",
          body: "The topics follow the order of a classic systematic theology in numbered parts. It begins with theological method and ends with the last things." },
        { sel: [".td-parts .td-locus"],
          title: "A topic",
          body: "Each line is one topic. The next step opens the Trinity." },
        { sel: [".td-head"], at: TRIN,
          title: "A topic page",
          body: "The heading names the topic and its part of the outline. The figures show how much of the library treats it." },
        { sel: [".td-head .td-kids"], at: TRIN,
          title: "Narrower topics",
          body: "Some topics divide into narrower ones. Follow these links to go deeper." },
        { sel: [".td-toc"], at: TRIN, only: "desktop",
          title: "Contents",
          body: "The whole outline stays at hand. Use it to move to any other topic." },
        { sel: [".td-toc-drawer > summary"], at: TRIN, only: "phone",
          title: "Contents",
          body: "The whole outline stays at hand. Open Contents to move to any other topic." },
        { sel: [".td-block .td-fold-sum"], at: TRIN,
          title: "Creeds and confessions",
          body: "What the creeds, confessions and catechisms say on this topic. Press a section's heading to fold it away." },
        { sel: [".td-block .td-tabs"], at: TRIN,
          title: "Four ways to read",
          body: "Read the texts, compare them side by side, trace the teaching through the centuries or gather the Scripture they cite." },
        { sel: [".td-articles > li"], at: TRIN,
          title: "The texts themselves",
          body: "Each article is quoted with its source. Open one to read it in the work it comes from." },
        { sel: ["#td-h-teach"], at: TRIN,
          title: "Works",
          body: "Below the confessions come the classic treatments of the topic in the library's works." },
        { title: "Topics, done",
          body: "Every topic is laid out the same way. The next tour shows how to search the whole library." }
      ]
    },
    search: {
      name: "Search",
      blurb: "Find a work, a passage, a verse or an idea across the whole library.",
      url: "/the-faith-received/search/",
      // Signed in, the search tool; signed out, the page's sign-up
      // panel. The page is gated on the server ({{#if @member}}), so a
      // signed-out reader gets examples instead of the live tool.
      ready: [".smodes, .blist--tools, .tfr-gate-form"],
      steps: [
        { title: "Search",
          body: "Search looks across every work in the library at once. Here is how it works." },
        { sel: [".smodes"], only: "signed-in", member: "tfr-search",
          title: "Four kinds of search",
          body: "Choose Works to find a title or author, Passages for words in the texts, Scripture for a verse, or Ask for a question." },
        { sel: [".search-query"], only: "signed-in", prefill: { sel: "#q", value: "justification" },
          title: "The search box",
          body: "Type here and press Enter. This example looks for works about justification." },
        { sel: [".shelf-controls #fTrad", ".shelf-controls"], only: "signed-in",
          title: "Shelf",
          body: "Limit the search to one shelf of the library." },
        { sel: ["#scopeWrap"], open: ["#scopeToggle"], only: "signed-in",
          title: "Filters and order",
          body: "Narrow the results by author, work, collection or group. You can also choose how they are organized." },
        { sel: ["#results"], only: "signed-in", prefill: { sel: "#q", value: "justification" },
          open: [{ press: "#runSearch", unless: "#results > *" }],
          title: "Results",
          body: "Each result names the work and its author. Open one to read it at that place." },
        { sel: ["#densityBtn"], only: "signed-in",
          title: "Compact",
          body: "Compact fits more results on the screen at once." },
        { sel: ["#passageMethod"], open: [".smodes [data-m=\"full\"]"], only: "signed-in", member: "tfr-search",
          title: "Exact words or ideas",
          body: "Passages searches the texts themselves. Exact words matches your wording, and By idea finds passages that say the same thing in other words." },
        { sel: [".blist--tools li:nth-child(2)", ".blist--tools"], only: "signed-out", member: "tfr-search",
          example: [
            "Passages: \u201cjustified by faith alone\u201d",
            "Every page in the library with those words, each linked to its place in the work."
          ],
          title: "Search the texts",
          body: "Search finds a work, a passage, a Scripture reference or an idea across the whole library. By idea finds passages that say the same thing in other words." },
        { sel: [".blist--tools"], only: "signed-out",
          title: "The research tools",
          body: "Search comes with Ask, Compare, Connections, the notebook and the Desk. The last tour shows each of them." },
        { sel: [".tfr-gate-form"], only: "signed-out",
          title: "Open the tools",
          body: "The research tools are free during the beta. Enter your name and email and we will send you a sign-in link." },
        { title: "Search, done",
          body: "The last tour covers the research tools: author pages, Compare, Ask, the notebook and your saved passages." }
      ]
    },
    research: {
      name: "Research tools",
      blurb: "Author pages, Ask, Compare, Connections, bookmarks, the notebook and the Desk.",
      url: "/the-faith-received/author/?a=augustine-of-hippo",
      ready: ["#segw, .tfr-gate-form, [data-research-mode]"],
      steps: [
        { title: "Research tools",
          body: "The research tools help you study an author, compare writers and keep what you find. The tour starts on an author's page." },
        { sel: ["main .bhero h1", "main h1"],
          title: "An author's page",
          body: "Every author in the library has a page like this one. It gathers their works and shows how the tradition received them." },
        { sel: ["main details > summary"],
          title: "About the author",
          body: "Open this for a short account of the author's life and writings." },
        { sel: ["#segw"],
          title: "Works",
          body: "Every work by this author in the library. Filter by kind or by title to find one." },
        { sel: ["#room-works .pinb-work", ".pinb-work"], member: "tfr-notebook",
          title: "Save a work",
          body: "Save work keeps it in your notebook, ready to open again from any page." },
        { sel: ["#segp"],
          title: "Positions",
          body: "What the author held on each doctrine, topic by topic, with the passages behind each summary." },
        { sel: ["#segs"],
          title: "Scripture",
          body: "The books and verses of the Bible this author cites, with the places they cite them." },
        { sel: ["#segt"],
          title: "Topics",
          body: "The doctrines this author wrote on, linked to the Topics pages." },
        { sel: ["#segr"],
          title: "Reception",
          body: "Who cited this author afterwards, how often and where. It follows a writer through the centuries after them." },
        { sel: ["#segc"],
          title: "Connections",
          body: "The writers this author read and the writers who read them, drawn as a map." },
        { sel: ["#segx"],
          title: "Search this author",
          body: "Search looks through this author's works only." },
        // The Research desk. Rendered on the server for members only;
        // signed-out readers get its sign-up panel, so each tool has a
        // signed-in step on the real tab and a signed-out step with an
        // example on the panel's list of tools.
        { at: "/the-faith-received/research/", sel: ["[data-research-mode=\"ask\"]"], only: "signed-in",
          title: "The Research desk",
          body: "The desk holds every research tool behind one row of tabs. Each tab keeps its own place." },
        { at: "/the-faith-received/research/", sel: ["#research-panel-ask"], open: ["[data-research-mode=\"ask\"]"], only: "signed-in", member: "ask",
          title: "Ask",
          body: "Ask the whole library a question. Every answer cites the pages it draws on, so you can check it." },
        { at: "/the-faith-received/research/", sel: ["#research-panel-power-search"], open: ["[data-research-mode=\"power-search\"]"], only: "signed-in", member: "tfr-search",
          title: "Power Search",
          body: "Search by meaning rather than exact words, with filters for author, period and tradition." },
        { at: "/the-faith-received/research/", sel: ["#research-panel-compare"], open: ["[data-research-mode=\"compare\"]"], only: "signed-in", member: "tfr-compare",
          title: "Compare",
          body: "Set two to four authors side by side on one topic, each with the passages that show their view." },
        { at: "/the-faith-received/research/", sel: ["#research-panel-bookmarks"], open: ["[data-research-mode=\"bookmarks\"]"], only: "signed-in", member: "tfr-bookmarks",
          title: "Bookmarks",
          body: "The works and places you have bookmarked while reading, in one list." },
        { at: "/the-faith-received/research/", sel: ["#research-panel-notebook"], open: ["[data-research-mode=\"notebook\"]"], only: "signed-in", member: "tfr-notebook",
          title: "Notebook",
          body: "Your highlights, notes and clipped passages, each with its citation. Search them or export them." },
        { at: "/the-faith-received/research/", sel: ["#research-panel-connections"], open: ["[data-research-mode=\"connections\"]"], only: "signed-in", member: "tfr-connections",
          title: "Connections",
          body: "The whole library mapped by citation. Choose an author to see who they read and who read them." },
        { at: "/the-faith-received/research/", sel: ["#research-panel-desk"], span: true, open: ["[data-research-mode=\"desk\"]"], only: "signed-in", member: "tfr-desk",
          title: "Desk",
          body: "Write with what you have kept beside you. Every quotation stays linked to the page it came from." },
        { at: "/the-faith-received/research/", sel: [".blist--tools li:nth-child(1)"], only: "signed-out", member: "ask",
          example: [
            "Q. How did the Fathers read the Song of Songs?",
            "A. An answer drawn from the library, each claim linked to the page it comes from."
          ],
          title: "Ask",
          body: "Ask the whole library a question. Every answer cites the pages it draws on, so you can check it." },
        { at: "/the-faith-received/research/", sel: [".blist--tools li:nth-child(3)"], only: "signed-out", member: "tfr-compare",
          example: [
            "Compare: Augustine, Aquinas and Calvin on grace",
            "Three columns, one per author, each with the passages that show their view."
          ],
          title: "Compare",
          body: "Set two to four authors side by side on one topic, each with the passages that show their view." },
        { at: "/the-faith-received/research/", sel: [".blist--tools li:nth-child(4)"], only: "signed-out", member: "tfr-connections",
          title: "Connections",
          body: "The whole library mapped by citation. Choose an author to see who they read and who read them." },
        { at: "/the-faith-received/research/", sel: [".blist--tools li:nth-child(5)"], only: "signed-out", member: "tfr-notebook",
          example: [
            "\u201cOur heart is restless until it rests in you.\u201d Augustine, <em>Confessions</em> I.1",
            "Note: the theme of the whole book, stated in its first paragraph."
          ],
          title: "The notebook",
          body: "Your highlights, notes, bookmarks and clipped passages, each with its citation." },
        { at: "/the-faith-received/research/", sel: [".blist--tools li:nth-child(6)"], only: "signed-out", member: "tfr-desk",
          title: "Desk",
          body: "Write with what you have kept beside you. Every quotation stays linked to the page it came from." },
        { at: "/the-faith-received/research/", sel: [".tfr-gate-form"], only: "signed-out",
          title: "Open the tools",
          body: "The research tools are free during the beta. Enter your name and email and we will send you a sign-in link." },
        { at: "/the-faith-received/research/",
          title: "Research tools, done",
          body: "The last tour opens Connections, the map of who read whom across the whole library." }
      ]
    },
    connections: {
      name: "Connections",
      blurb: "The whole library mapped by citation: who each author read, who read them and the passages behind every link.",
      url: "/the-faith-received/connections/",
      ready: ["#explorer, .tfr-gate-band"],
      steps: [
        { title: "Connections",
          body: "Connections maps the whole library by citation. Every point is an author. Every line is one author citing another." },
        { sel: [".tfr-gate-band"], only: "signed-out", member: "tfr-connections",
          title: "Open the map",
          body: "Connections needs a free account during the beta. Sign in, then take this tour again to see the map itself." },
        { sel: ["#find"], member: "tfr-connections",
          title: "Find an author",
          body: "Type a name to jump straight to that author." },
        { sel: ["#author-index"], member: "tfr-connections",
          title: "Browse authors",
          body: "Every author in the index with how many readers they have. The menu above the list sorts it another way." },
        { sel: ["#map-filters > summary", "#map-filters"], member: "tfr-connections",
          title: "Filter the index",
          body: "Narrow the map to one shelf, a period or a span of years. Network prominence keeps only the most connected authors." },
        { sel: ["#mobile-view"], only: "phone", member: "tfr-connections",
          title: "List or map",
          body: "On a phone the page opens on the list of authors. View map shows the network itself." },
        { sel: ["#graph-frame"], only: "desktop", member: "tfr-connections",
          title: "The citation network",
          body: "Each point is an author and each line a recorded citation. Earlier authors sit to the left and later ones to the right." },
        { sel: ["#network-layouts"], only: "desktop", member: "tfr-connections",
          title: "Three layouts",
          body: "Timeline places authors by date. Rings and Tradition arrange the same network by closeness and by tradition." },
        { sel: ["#web-zoom"], only: "desktop", member: "tfr-connections",
          title: "Move around the map",
          body: "Drag to pan. Use plus and minus to zoom, or Fit map to see the whole network again." },
        { sel: ["#period-key"], only: "desktop", member: "tfr-connections",
          title: "Colors",
          body: "A point's color shows the period its author belongs to." },
        { sel: ["#panel:not([inert])", "#panel"], open: [{ press: "#author-index [data-author]", unless: "#panel:not([inert]) #pbody > *" }], shut: "#px", member: "tfr-connections",
          title: "An author's connections",
          body: "Choose any author to see who they cited and who cited them. Each link opens the passages where it happens." },
        { sel: ["#network-author-map"], open: [{ press: "#author-index [data-author]", unless: "#panel:not([inert]) #pbody > *" }], shut: "#px", member: "tfr-connections",
          title: "One author's map",
          body: "This redraws the network around the author you chose, with only their connections." },
        { sel: ["#connection-discovery"], only: "desktop", member: "tfr-connections",
          title: "Places to start",
          body: "A few recorded connections to explore first. Each opens the passages where one author cites another." },
        { sel: ["#mnav"], member: "tfr-connections",
          title: "Other views",
          body: "Paths traces the chain of citations between two authors. Topics and Scripture show who wrote on a doctrine or a passage of the Bible." },
        { title: "That is the whole library",
          body: "You have seen every tour. The Tutorial link in the bar at the top brings you back to any of them." }
      ]
    }
  };
  Object.keys(TOURS).forEach((k) => TOURS[k].steps.forEach((st, i) => { st.idx = i; }));
  const ORDER = [
    ["reader", "Reading a work"],
    ["scripture", "Scripture"],
    ["topics", "Topics"],
    ["search", "Search"],
    ["research", "Research tools"],
    ["connections", "Connections"]
  ];

  // ── Storage ─────────────────────────────────────────────────────
  function doneList() {
    try {
      const v = JSON.parse(window.localStorage.getItem(DONE_KEY) || "[]");
      return Array.isArray(v) ? v : [];
    } catch (e) { return []; }
  }
  function markDone(name) {
    try {
      const v = doneList();
      if (v.indexOf(name) < 0) v.push(name);
      window.localStorage.setItem(DONE_KEY, JSON.stringify(v));
    } catch (e) { /* storage refused: the tour still ran */ }
  }

  function tourUrl(name) {
    const t = TOURS[name];
    if (!t) return "";
    return `${t.url + (t.url.indexOf("?") < 0 ? "?" : "&")}tour=${encodeURIComponent(name)}`;
  }
  function nextTourOf(name) {
    const i = ORDER.findIndex((o) => o[0] === name);
    for (let j = i + 1; j < ORDER.length; j++) if (TOURS[ORDER[j][0]]) return ORDER[j];
    return null;
  }

  let cssAsked = false;
  function loadCss() {
    if (cssAsked || !CSS) return;
    cssAsked = true;
    const l = document.createElement("link");
    l.rel = "stylesheet";
    l.href = CSS;
    document.head.appendChild(l);
  }

  // ── Targets ─────────────────────────────────────────────────────
  const phone = () => window.innerWidth < PHONE || document.documentElement.classList.contains("g-mobile");
  function visible(el) {
    if (!el || !el.isConnected) return false;
    if (el.closest("[hidden]")) return false;
    const r = el.getBoundingClientRect();
    if (r.width < 2 || r.height < 2) return false;
    const cs = window.getComputedStyle(el);
    return cs.visibility !== "hidden" && cs.display !== "none" && Number(cs.opacity) > 0.05;
  }
  function find(sel) {
    const list = [].concat(sel || []);
    for (const s of list) {
      let els;
      try { els = document.querySelectorAll(s); } catch (e) { continue; }
      for (const el of els) if (visible(el)) return el;
    }
    return null;
  }
  // Signed in, as the server rendered the page (read once, before a
  // tour lends the attribute).
  let signedIn = null;
  const isSignedIn = () => {
    if (signedIn === null) signedIn = Boolean(document.body && document.body.hasAttribute("data-member-status"));
    return signedIn;
  };
  function fits(step) {
    if (step.only === "phone" && !phone()) return false;
    if (step.only === "desktop" && phone()) return false;
    if (step.only === "signed-in" && !isSignedIn()) return false;
    if (step.only === "signed-out" && isSignedIn()) return false;
    return true;
  }
  // Of several matches, the first one at or below the top of the screen.
  function findNear(sel) {
    let best = null;
    let bestTop = Infinity;
    for (const s of [].concat(sel || [])) {
      let els;
      try { els = document.querySelectorAll(s); } catch (e) { continue; }
      for (const el of els) {
        if (!visible(el)) continue;
        const t = el.getBoundingClientRect().top;
        if (t >= 80 && t < bestTop) { best = el; bestTop = t; }
      }
    }
    return best || find(sel);
  }
  const target = (step) => (step.sel ? (step.near ? findNear(step.sel) : find(step.sel)) : null);
  function waitFor(sels, ms) {
    return new Promise((resolve) => {
      const t0 = Date.now();
      (function poll() {
        if (sels.every((s) => find(s))) return resolve(true);
        if (Date.now() - t0 > ms) return resolve(false);
        window.setTimeout(poll, 250);
      }());
    });
  }
  const wait = (ms) => new Promise((r) => window.setTimeout(r, ms));

  // Which page a step lives on, and whether that is this one. The tour's
  // own parameters are ignored; so is anything a page adds to its own
  // address after load, by comparing only the parameters the step names.
  const pageOf = (tour, step) => step.at || tour.url;
  function onPage(url) {
    const want = new URL(url, window.location.origin);
    const here = new URL(window.location.href);
    if (want.pathname !== here.pathname) return false;
    for (const [k, v] of want.searchParams) if (here.searchParams.get(k) !== v) return false;
    // A bare page (the Topics index) is not the same page as one of its
    // topics.
    if (!want.search && here.searchParams.has("t")) return false;
    return true;
  }

  // ── The tour ────────────────────────────────────────────────────
  let run = null;

  // The in-memory flag feature-gate.js reads. Never stored, never taken
  // from the address: it lives exactly as long as the tour on screen.
  // ONE MORE GATE. The Ask workspace (a port file we do not edit) sends
  // a reader whose <body> has no data-member-status to the /ask/ page
  // instead of opening beside the book. For the length of a tour a
  // signed-out reader's body carries data-member-status="tour", removed
  // again with the flag; the server still decides what Ask will answer.
  let lentStatus = false;
  function setTouring(on) {
    const body = document.body;
    isSignedIn();
    if (on) {
      window.MOTour = { active: true };
      if (!body.hasAttribute("data-member-status")) { body.setAttribute("data-member-status", "tour"); lentStatus = true; }
    } else {
      if (window.MOTour) window.MOTour.active = false;
      if (lentStatus) { body.removeAttribute("data-member-status"); lentStatus = false; }
    }
    document.documentElement.classList.toggle("fr-touring", Boolean(on));
  }
  function isMember(feature) {
    // Asked with the tour flag down, so it answers for the reader rather
    // than for the tour.
    const g = window.MOFeatureGate;
    if (!g || typeof g.allowed !== "function") return false;
    const was = window.MOTour && window.MOTour.active;
    if (window.MOTour) window.MOTour.active = false;
    try { return g.allowed(feature); } finally { if (window.MOTour) window.MOTour.active = was; }
  }

  function build() {
    const catchEl = document.createElement("div");
    catchEl.className = "frt-catch";
    const spot = document.createElement("div");
    spot.className = "frt-spot is-none";
    spot.setAttribute("aria-hidden", "true");
    const card = document.createElement("div");
    card.className = "frt-card";
    card.setAttribute("role", "dialog");
    card.setAttribute("aria-modal", "false");
    card.setAttribute("aria-labelledby", "frtTitle");
    card.tabIndex = -1;
    card.innerHTML =
      '<button type="button" class="frt-x" aria-label="Close the tour">×</button>' +
      '<div aria-live="polite" aria-atomic="true">' +
      '<p class="frt-eyebrow"><span class="frt-count"></span><span class="frt-pill" hidden>Members</span></p>' +
      '<h2 class="frt-title" id="frtTitle"></h2><p class="frt-body"></p>' +
      '<div class="frt-example" hidden></div>' +
      '</div>' +
      '<p class="frt-next-tour" hidden></p>' +
      '<div class="frt-foot">' +
      '<button type="button" class="frt-skip">Skip tour</button>' +
      '<button type="button" class="frt-btn frt-back">← Back</button>' +
      '<button type="button" class="frt-btn frt-btn--primary frt-next">Next →</button>' +
      '</div>';
    // Clicks inside the tour stay inside it: the reader closes Aa and the
    // Tools tray on any document click, which would shut the panel the
    // next step points into.
    ["click", "mousedown", "pointerdown", "touchstart"].forEach((ev) => {
      card.addEventListener(ev, (e) => e.stopPropagation());
      catchEl.addEventListener(ev, (e) => { e.stopPropagation(); if (ev !== "touchstart") e.preventDefault(); });
    });
    document.body.append(catchEl, spot, card);
    // On a phone the Ask workspace makes every other child of <body>
    // inert while it is open, which would leave the card unclickable
    // over the very panel it describes. The tour's own nodes shed it.
    const unInert = new MutationObserver((list) => {
      list.forEach((m) => { if (m.target.hasAttribute("inert")) m.target.removeAttribute("inert"); });
    });
    [catchEl, spot, card].forEach((n) => unInert.observe(n, { attributes: true, attributeFilter: ["inert"] }));
    card.querySelector(".frt-x").addEventListener("click", () => stop(false));
    card.querySelector(".frt-skip").addEventListener("click", () => stop(false));
    card.querySelector(".frt-back").addEventListener("click", () => go(-1));
    card.querySelector(".frt-next").addEventListener("click", () => go(1));
    return { catchEl, spot, card, unInert };
  }

  async function start(name, fromIdx) {
    const tour = TOURS[name];
    if (!tour || run) return;
    loadCss();
    // Arriving mid-tour on another page (the Verse Desk, a topic page):
    // wait for that step's own target, not the first page's, which never
    // appears there and held the tour for the full 20 seconds.
    const arriving = fromIdx > 0 ? tour.steps.find((s) => s.idx >= fromIdx) : null;
    if (arriving && arriving.at) { if (arriving.sel) await waitFor([arriving.sel], 10000); }
    else if (tour.ready) await waitFor(tour.ready, 20000);
    await wait(700);
    if (run) return;
    const steps = tour.steps.filter(fits);
    // Every step that fits this screen stays, so the count matches the
    // tutorial page. A step whose feature this work lacks shows its card
    // in the middle of the screen with nothing lit.
    const live = steps;
    let first = 0;
    if (fromIdx > 0) first = Math.max(0, live.findIndex((s) => s.idx >= fromIdx));
    // A reader opened at a #place keeps jumping back to it as the page
    // settles, which would pull every lit feature off the screen.
    if (window.location.hash) {
      try { window.history.replaceState(window.history.state, "", window.location.pathname + window.location.search); } catch (e) { /* ignore */ }
    }
    setTouring(true);
    run = { name, tour, steps: live, i: -1, opened: [], target: null, raf: 0, ui: build(), lastFocus: document.activeElement,
      arrivedAt: fromIdx > 0 && live[first] ? live[first].idx : -1, lastAt: "",
      hasMember: live.some((s) => s.member) };
    window.addEventListener("keydown", onKey, true);
    window.addEventListener("resize", schedule);
    document.addEventListener("scroll", schedule, true);
    show(first, 1);
  }

  // An `open` entry is a selector to press, or { press, unless } to press
  // only while `unless` is not on screen.
  const keyOf = (o) => (typeof o === "string" ? o : o.press);
  const isOpen = (t) => {
    if (!t) return false;
    // The desktop Tools tray's own record of whether it is open; its
    // button's aria-expanded can say open while the tray has folded shut
    // (closing the Research panel folds it), which left Ask lit on an
    // empty slot in the toolbar.
    if (t.id === "rdTools") {
      const d = document.querySelector(".fr-tools-drawer");
      if (d) return d.dataset.want === "open";
    }
    return t.getAttribute("aria-expanded") === "true" || t.getAttribute("aria-selected") === "true";
  };
  function press(sel) {
    const t = find(sel);
    if (!t) return null;
    if (!isOpen(t)) t.click();
    return t;
  }
  // Undo what the last step opened, keeping whatever the next step
  // opens too (so Aa stays open across its three steps).
  function unwind(next) {
    if (!run) return;
    const keep = ((next && next.open) || []).map(keyOf);
    let closed = false;
    const prev = run.steps[run.i];
    if (prev && prev.shut && (!next || next.shut !== prev.shut)) {
      const x = find(prev.shut);
      if (x) { x.click(); closed = true; }
    }
    const still = [];
    for (let k = run.opened.length - 1; k >= 0; k--) {
      const o = run.opened[k];
      if (keep.indexOf(o.sel) >= 0) { still.unshift(o); continue; }
      if (o.el.getAttribute("aria-expanded") === "true") { o.el.click(); closed = true; }
    }
    run.opened = still;
    return closed;
  }

  async function show(i, dir) {
    if (!run) return;
    const {steps} = run;
    const token = (run.token = (run.token || 0) + 1);
    run.busy = true;
    while (i >= 0 && i < steps.length) {
      const step = steps[i];
      // A panel sliding shut hides its neighbours until it has closed.
      if (unwind(step)) await wait(380);
      if (token !== run.token || !run) return;
      // Only a step with `at`, or the step after one, can change page,
      // and never the step a page was just opened for: a page that
      // rewrites its own address must not send the tour round in a loop.
      const leaving = step.at ? !onPage(step.at) : Boolean(run.lastAt) && onPage(run.lastAt);
      if (leaving && step.idx !== run.arrivedAt) {
        const u = new URL(pageOf(run.tour, step), window.location.origin);
        u.searchParams.set("tour", run.name);
        u.searchParams.set("tstep", String(step.idx));
        run.busy = false;
        // A same-origin address built from the tour's own data; followed
        // as a link so the page's own link handling applies.
        const go = document.createElement("a");
        go.href = u.pathname + u.search;
        go.hidden = true;
        document.body.appendChild(go);
        go.click();
        return;
      }
      if (step.prefill) {
        const f = find(step.prefill.sel);
        if (f && !f.value) f.value = step.prefill.value;
      }
      if (step.open) {
        const nb = run.ui.card.querySelector(".frt-next");
        nb.setAttribute("aria-busy", "true");
        nb.textContent = "Opening\u2026";
      }
      for (const entry of step.open || []) {
        const sel = keyOf(entry);
        if (entry.unless && find(entry.unless)) continue;
        if (run.opened.some((o) => o.sel === sel) && isOpen(run.opened.find((o) => o.sel === sel).el)) continue;
        const t = press(sel);
        if (t) {
          run.opened.push({ sel, el: t });
          // A panel that builds itself (Ask) can take a moment to appear.
          if (entry.unless) await waitFor([entry.unless], 4000);
          await wait(450);
        }
        if (token !== run.token || !run) return;
      }
      if (step.fill) {
        const f = find(step.fill.sel);
        if (f && !f.value) f.value = step.fill.value;
      }
      const el = target(step);
      run.busy = false;
      paint(i, step, el);
      settle(token, step);
      return;
    }
    run.busy = false;
    if (i < 0) { show(0, 1); return; }
    stop(true);
  }

  // For a moment after a step paints, keep it honest: a page that jumps
  // back to its own #anchor, or a tray still folding shut from the last
  // step, would otherwise leave the light on the wrong place.
  async function settle(token, step) {
    for (let k = 0; k < 10; k++) {
      await wait(160);
      if (!run || token !== run.token) return;
      let el = run.target && run.target.isConnected && visible(run.target) ? run.target : target(step);
      if (step.sel && !el && step.open) {
        for (const entry of step.open) {
          if (entry.unless && find(entry.unless)) continue;
          const t = find(keyOf(entry));
          if (t && !isOpen(t)) { t.click(); await wait(380); }
        }
        if (!run || token !== run.token) return;
        el = target(step);
      }
      if (!el) continue;
      run.target = el;
      const r = el.getBoundingClientRect();
      if (r.bottom < 60 || r.top > window.innerHeight - 20) el.scrollIntoView({ block: "center", inline: "nearest", behavior: "instant" });
      place();
    }
  }

  function paint(i, step, el) {
    run.i = i;
    run.lastAt = step.at || "";
    run.target = el;
    const { card } = run.ui;
    const last = i === run.steps.length - 1;
    card.querySelector(".frt-count").textContent = `Step ${i + 1} of ${run.steps.length}`;
    card.querySelector(".frt-pill").hidden = !step.member;
    card.querySelector(".frt-title").innerHTML = step.title;
    card.querySelector(".frt-body").innerHTML = step.body + (step.member ? ` <span class="frt-members-line">${MEMBERS_LINE}</span>` : "");
    const ex = card.querySelector(".frt-example");
    ex.hidden = !step.example;
    ex.innerHTML = step.example
      ? `<span class="frt-example-tag">Example</span>${step.example.map((l) => `<p>${l}</p>`).join("")}`
      : "";
    card.querySelector(".frt-back").hidden = i === 0;
    const nextBtn = card.querySelector(".frt-next");
    nextBtn.removeAttribute("aria-busy");
    nextBtn.textContent = last ? "Done" : "Next →";
    const nt = card.querySelector(".frt-next-tour");
    const nxt = last ? nextTourOf(run.name) : null;
    const join = last && run.hasMember && !isMember("tfr-research");
    nt.hidden = !last;
    nt.textContent = "";
    if (nxt) {
      const a = document.createElement("a");
      a.href = tourUrl(nxt[0]);
      a.textContent = `Next tour: ${nxt[1]} →`;
      nt.appendChild(a);
    }
    // Every tour ends with a way back to the tutorial page, to pick
    // another tour or take this one again.
    if (last) {
      const h = document.createElement("a");
      h.href = "/the-faith-received/tutorial/";
      h.className = "frt-all-tours";
      h.textContent = "All tours";
      nt.appendChild(h);
    }
    if (join) {
      const m = document.createElement("a");
      m.href = "/membership/";
      m.className = "frt-join";
      m.textContent = "Become a member";
      nt.appendChild(m);
    }
    if (last) markDone(run.name);
    if (el) {
      const r = el.getBoundingClientRect();
      const inView = r.top >= 60 && r.bottom <= window.innerHeight - 20;
      // A tray that scrolls sideways (the Tools drawer) can hold the
      // target past the edge of the screen.
      const across = r.left >= 0 && r.right <= window.innerWidth;
      if (!inView && r.height < window.innerHeight * 0.8) el.scrollIntoView({ block: "center", inline: "nearest", behavior: "instant" });
      else if (!inView) el.scrollIntoView({ block: "start", inline: "nearest", behavior: "instant" });
      else if (!across) el.scrollIntoView({ block: "nearest", inline: "center", behavior: "instant" });
    }
    place();
    // Scrolling can make the reader fold its toolbar away; place again
    // once that has settled.
    window.setTimeout(place, 260);
    try { card.focus({ preventScroll: true }); } catch (e) { card.focus(); }
  }

  function place() {
    if (!run) return;
    const { spot, card } = run.ui;
    const el = run.target;
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    card.classList.remove("is-dock-top", "is-dock-bottom");
    if (!el || !el.isConnected || !visible(el)) {
      spot.classList.add("is-none");
      Object.assign(spot.style, { top: `${vh / 2}px`, left: `${vw / 2}px`, width: "0px", height: "0px" });
      if (vw < PHONE) { card.classList.add("is-dock-bottom"); return; }
      const cw = card.offsetWidth;
      const ch = card.offsetHeight;
      card.style.left = `${Math.max(12, (vw - cw) / 2)}px`;
      card.style.top = `${Math.max(12, (vh - ch) / 2)}px`;
      return;
    }
    spot.classList.remove("is-none");
    const step = run.steps[run.i];
    const pad = step && step.pad != null ? step.pad : 6;
    let r = el.getBoundingClientRect();
    // `span`: light everything the target lays out, even where its
    // children run wider than the target itself (the Desk's side columns).
    if (step && step.span) {
      let { left: l, top: t, right: rt, bottom: b } = r;
      el.querySelectorAll(":scope > *, :scope > * > *, :scope > * > * > *").forEach((c) => {
        const q = c.getBoundingClientRect();
        if (q.width < 2 || q.height < 2) return;
        l = Math.min(l, q.left); t = Math.min(t, q.top); rt = Math.max(rt, q.right); b = Math.max(b, q.bottom);
      });
      r = { left: l, top: t, right: rt, bottom: b };
    }
    // Clip the box to the screen so a long target still reads as lit.
    const top = Math.max(2, r.top - pad);
    const left = Math.max(2, r.left - pad);
    const bottom = Math.min(vh - 2, r.bottom + pad);
    const right = Math.min(vw - 2, r.right + pad);
    Object.assign(spot.style, { top: `${top}px`, left: `${left}px`, width: `${Math.max(0, right - left)}px`, height: `${Math.max(0, bottom - top)}px` });

    if (vw < PHONE) {
      const mid = (top + bottom) / 2;
      card.classList.add(mid > vh * 0.5 ? "is-dock-top" : "is-dock-bottom");
      return;
    }
    const cw = card.offsetWidth;
    const ch = card.offsetHeight;
    const gap = 14;
    let x;
    let y;
    if (vh - bottom >= ch + gap + 8) { y = bottom + gap; x = left; }
    else if (top >= ch + gap + 8) { y = top - gap - ch; x = left; }
    else if (vw - right >= cw + gap + 8) { x = right + gap; y = top; }
    else if (left >= cw + gap + 8) { x = left - gap - cw; y = top; }
    else { x = vw - cw - 16; y = vh - ch - 16; }
    x = Math.min(Math.max(12, x), vw - cw - 12);
    y = Math.min(Math.max(12, y), vh - ch - 12);
    card.style.left = `${x}px`;
    card.style.top = `${y}px`;
  }

  function schedule() {
    if (!run || run.raf) return;
    run.raf = window.requestAnimationFrame(() => { if (run) { run.raf = 0; place(); } });
  }

  function go(d) {
    // Ignored while a step is still opening its panel.
    if (!run || run.busy) return;
    const i = run.i + d;
    if (i < 0) return;
    // Done on the last step returns to the tutorial page to pick the next tour.
    if (i >= run.steps.length) { stop(true); toHub(); return; }
    show(i, d);
  }

  function onKey(e) {
    if (!run) return;
    const k = e.key;
    if (k === "ArrowRight" || k === "ArrowLeft" || k === "Escape") {
      e.preventDefault();
      e.stopImmediatePropagation();
      if (k === "Escape") stop(false);
      else go(k === "ArrowRight" ? 1 : -1);
    }
  }

  function toHub() {
    const hub = "/the-faith-received/tutorial/";
    if (window.location.pathname === hub) return;
    // eslint-disable-next-line no-restricted-syntax -- same-origin path literal
    window.location.assign(hub);
  }

  function stop(finished) {
    if (!run) return;
    if (finished) markDone(run.name);
    run.token = (run.token || 0) + 1;
    unwind(null);
    // Any panel a skipped or interrupted step left open.
    run.tour.steps.forEach((st) => {
      const x = st.shut && find(st.shut);
      if (x) x.click();
    });
    setTouring(false);
    window.removeEventListener("keydown", onKey, true);
    window.removeEventListener("resize", schedule);
    document.removeEventListener("scroll", schedule, true);
    if (run.raf) window.cancelAnimationFrame(run.raf);
    const { catchEl, spot, card, unInert } = run.ui;
    unInert.disconnect();
    catchEl.remove(); spot.remove(); card.remove();
    const back = run.lastFocus;
    run = null;
    if (back && back.focus && back.isConnected) { try { back.focus({ preventScroll: true }); } catch (e) { /* ignore */ } }
  }

  // ── Hub cards ───────────────────────────────────────────────────
  // The tutorial page (custom-faith-tutorial.hbs) marks each card
  // [data-frt-card=<name>]; this fills its step count, start link and
  // done tick from the tour data and localStorage.
  function paintHooks() {
    const done = doneList();
    document.querySelectorAll("[data-frt-card]").forEach((c) => {
      const name = c.getAttribute("data-frt-card");
      const t = TOURS[name];
      c.classList.toggle("is-done", done.indexOf(name) >= 0);
      c.classList.toggle("is-soon", !t);
      const n = c.querySelector("[data-frt-count]");
      if (n) n.textContent = t ? `${t.steps.filter(fits).length} steps` : "Coming soon";
      const a = c.querySelector("[data-frt-start]");
      if (a) {
        if (t) { a.href = tourUrl(name); a.hidden = false; a.textContent = done.indexOf(name) >= 0 ? "Take again" : "Start"; }
        else a.hidden = true;
      }
    });
  }

  window.FRTour = { tours: TOURS, order: ORDER, start, stop, done: doneList };

  let wanted = "";
  let fromIdx = 0;
  try {
    const q = new URLSearchParams(window.location.search);
    wanted = q.get("tour") || "";
    fromIdx = Number(q.get("tstep")) || 0;
  } catch (e) { wanted = ""; }
  function boot() {
    paintHooks();
    if (wanted && TOURS[wanted]) start(wanted, fromIdx);
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", boot);
  else boot();
}());
