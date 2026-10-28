/*
 * Feature gate — blocks clicks on action-row buttons the current
 * visitor isn't entitled to, and presents a modal with the right
 * next step.
 *
 * Tier mapping (Ian, 2026-04-23; pdf moved to member 2026-09-02; ask
 * moved to subscriber for the TFR beta 2026-09-11):
 *   - Members (paid/comped):        audio, bookmark, pdf
 *   - Subscribers (any signed-in):  gift, ask
 *   - Everyone:                     dark mode (no gate)
 *
 * `ask` is the odd one out and is deliberately temporary. See
 * TFR_BETA_OPEN_TO_ALL_MEMBERS below for the switch that puts it back.
 *
 * pdf was listed as subscriber-tier here while article-pdf.js required
 * paid and hard-redirected to /membership/ when it didn't find it. A free
 * subscriber therefore passed this gate, got no modal, and was bounced off
 * the essay with no explanation. Anselm House reported it on 2026-08-29.
 * Resolved in favour of member-tier: the modal now says so, and the same
 * check is enforced in article-pdf.js and in mo-pdf's /sign endpoint.
 *
 * Subscriber-tier features → modal with an inline Ghost magic-link
 * signup form. On submit, Ghost emails a verify link that redirects
 * back to the current post; the subscriber stays on the article.
 *
 * Member-tier features → modal with a prominent "Become a Member"
 * CTA to /membership/, since upgrade needs Stripe checkout, not an
 * email form.
 *
 * Member status comes from body[data-member-status] which default.hbs
 * writes for signed-in users. Missing attribute = anonymous.
 *
 * Capture-phase click handler with stopImmediatePropagation so the
 * existing per-feature handlers (article-audio.js, article-bookmark.js,
 * article-gift.js) don't ALSO fire alongside the gate.
 */
(function () {
  /* Bound once. This file ships in site.min.js AND is loaded again by
     its own <script> tag on the pages whose own scripts need it before
     the bundle arrives, so without this the document ends up with two
     capture handlers and one click opens two modals. */
  if (window.__moFeatureGate) return;
  window.__moFeatureGate = true;

  let STATUS = (document.body.getAttribute("data-member-status") || "anonymous").toLowerCase();

  // QA override: ?gate=force on any URL forces STATUS to anonymous
  // so every gated button fires. Persists to sessionStorage for
  // tab-internal navigation. ?gate=off clears.
  let forced = false;
  try {
    const params = new URLSearchParams(window.location.search);
    const g = params.get("gate");
    if (g === "force") sessionStorage.setItem("mo-gate-force", "1");
    if (g === "off") sessionStorage.removeItem("mo-gate-force");
    forced = sessionStorage.getItem("mo-gate-force") === "1";
  } catch (e) { /* private mode — ignore */ }

  if (forced) {
    STATUS = "anonymous";
  }

  /*
   * BETA SWITCH for The Faith Received (2026-09-11, Ian). One constant,
   * one place, and the two shapes the `ask` feature can take.
   *
   * While this is true the research tools are free and need only an
   * account. Set it to false to end the beta and put Ask, Power Search
   * and the rest back behind paid membership. Nothing else in this file
   * has to change.
   */
  /* Declared in assets/js/boot/tfr-tier.js, which is in boot.min.js and
     has therefore already run. Defaults to the beta if boot failed to
     load: a reader who is wrongly offered a tool gets a 401 from the
     worker, and a reader who is wrongly refused one gets nothing at
     all, so of the two failures this is the one that keeps the site
     usable. */
  const TFR_BETA_OPEN_TO_ALL_MEMBERS = window.MO_TFR_BETA_OPEN_TO_ALL_MEMBERS !== false;

  /* One tool, two tiers, one shape. Every research tool is gated the
     same way and flips at the same moment, so they are built from one
     factory rather than written out twice each: what changes between
     them is the sentence that names the tool, never the tier.

     `body` is what a reader sees when they click a tool they cannot use
     yet. It says what the tool does before it asks for anything, since
     a modal that only asks is a toll booth. */
  function betaFeature(title, does) {
    return TFR_BETA_OPEN_TO_ALL_MEMBERS
      ? {
        requires: "subscriber",
        eyebrow: "Free during the beta",
        title,
        body: `${does} It is free while the beta runs, and the rest of the research tools come with it. Give us an email address and we will send a sign-in link.`,
      }
      : {
        requires: "member",
        eyebrow: "Members Only",
        title,
        body: `${does} Members get the research tools, the print journal, Discord, and a growing library of benefits. Support the work to unlock it all.`,
      };
  }

  const BETA_ASK_FEATURE = TFR_BETA_OPEN_TO_ALL_MEMBERS
    ? {
      requires: "subscriber",
      eyebrow: "Free during the beta",
      title: "The research tools need an account",
      body: "Ask the library a question and read a cited answer. Semantic search, Compare and the notebook come with it. All of it is free while the beta runs. Give us an email address and we will send a sign-in link.",
    }
    : {
      requires: "member",
      eyebrow: "Members Only",
      title: "Ask is for members",
      body: "Members can ask a question of the library and get back a cited answer, plus semantic search, the print journal, Discord, and a growing library of benefits. Support the work to unlock it all.",
    };

  const FEATURES = {
    /* The dismissible prompt on Scripture and Topics (tfr-trial-prompt.js, Ian 2026-10-24). Its own entry so the
       sign-up carries source:feature-gate:tfr-trial-prompt, which isTfrSourced counts as a TFR signup. */
    "tfr-trial-prompt": {
      requires: "subscriber",
      eyebrow: "Free",
      title: "Create a free account",
      body: "Ask, Power Search, Compare, Commentary Decks, the Lexicon, the Notebook and Bookmarks need an account. Give us an email address and we will send a sign-in link.",
    },
    audio: {
      requires: "member",
      eyebrow: "Members Only",
      title: "Audio articles are for members",
      body: "Members get audio on every essay, the print journal, Discord, and a growing library of benefits. Support the work to unlock it all.",
    },
    bookmark: {
      requires: "member",
      eyebrow: "Members Only",
      title: "Bookmarks are for members",
      body: "Members get saved essays, the print journal, Discord, and a growing library of benefits. Support the work to unlock it all.",
    },
    pdf: {
      requires: "member",
      eyebrow: "Members Only",
      title: "PDFs are for members",
      body: "Members get downloadable PDFs of every essay, the print journal, Discord, and a growing library of benefits. Support the work to unlock it all.",
    },
    gift: {
      requires: "subscriber",
      eyebrow: "Free Subscriber",
      title: "Subscribe to gift essays",
      body: "Become a free subscriber and we'll email a magic link to verify your address. You'll come right back to this essay.",
    },
    /*
     * BETA MEASURE (2026-09-11, Ian). The Faith Received research
     * tools are free during the beta and require only an account, so
     * `ask` is subscriber-tier rather than member-tier for as long as
     * TFR_BETA_OPEN_TO_ALL_MEMBERS is true above.
     *
     * TO END THE BETA: flip that constant to false. This entry falls
     * back to member-tier and the modal copy goes back to the
     * Become-a-Member wording, because subscriber-tier features render
     * the inline signup form and member-tier ones render the CTA.
     *
     * The tier is declared in three places and all three must agree:
     * here, the server gate in website/workers/tfr-library/worker.js
     * (requireLibraryMember), and the page markup that decides who is
     * served the tools at all. Change one without the others and a
     * reader either sees a modal for something they can use or reaches
     * a button that 403s with no explanation.
     */
    ask: BETA_ASK_FEATURE,

    /* The rest of the research tools, gated 2026-09-22 on Ian's call:
       "all research tools should be subscriber only", and "if someone
       clicks on one anywhere in TFR, they should get a small subscribe
       form pop-up that works properly".

       WHAT IS NOT HERE, and deliberately. Reading is not a tool: the
       texts, Browse, the rooms, the Dictionary's articles, Topics,
       Scripture, the Glossary and the author pages stay open to anyone.
       The gate is on what you do WITH the library, not on the library.

       Each of these needs a server counterpart or it is theatre. The
       search and Ask routes are gated in mo-tfr-library and
       mo-tfr-ask-dev; bookmarks are gated in mo-kit; the notebook and
       Desk are this browser's localStorage and have no server to gate.
       See website/workers/scripts/check-tfr-tier.mjs. */
    "tfr-search": betaFeature(
      "Search needs an account",
      "Search every work in the library by title, by passage, by Scripture reference, or by meaning."
    ),
    "tfr-compare": betaFeature(
      "Compare needs an account",
      "Put two authors side by side on the same question and read them against each other."
    ),
    "tfr-connections": betaFeature(
      "Connections needs an account",
      "Follow the citation map: who reads whom across the whole library, and the texts behind each link."
    ),
    "tfr-bookmarks": betaFeature(
      "Saving a work needs an account",
      "Keep the works you are reading, and the place you stopped in each one."
    ),
    "tfr-notebook": betaFeature(
      "The notebook needs an account",
      "Clip a passage as you read, keep it with its citation, and come back to the exact paragraph."
    ),
    // The reader's Modernizer (Ian, 2026-09-23: "Modernize, Bookmark, and
    // Ask should all pop up a message similar to this for non-subscribers").
    "tfr-modernize": betaFeature(
      "Modernize needs an account",
      "Read early modern English in today's spelling, with the old verb endings brought up to date. Switch it off to see the words as the printer set them."
    ),
    "tfr-research": betaFeature(
      "Research needs an account",
      "Open the research beside the text: the work's topics and Scripture, and your own notes and saved passages."
    ),
    "tfr-report": betaFeature(
      "Reporting a problem needs an account",
      "Tell us about a bad scan, a wrong word or a broken link, and we will look at it."
    ),
    "tfr-desk": betaFeature(
      "Desk needs an account",
      "Write with your saved sources beside you, each one still linked to the text it came from."
    ),
    /* The rest of the Research drawer (Ian, 2026-10-24: "every Research
       tool needs to be freewalled. Free subscription required."). Same
       factory and same tier as the keys above. Three places declare each
       one and scripts/check-research-tools.mjs holds them together: the
       rail (partials/faith-received/_tfr-rail.hbs), this map, and the
       template that serves the page (server-side {{#if @member}}). */
    "tfr-decks": betaFeature(
      "Commentary Decks need an account",
      "Read a commented text place by place with its commentators beside it, or put two commentators side by side."
    ),
    "tfr-disputed": betaFeature(
      "Disputed Questions need an account",
      "Read the questions the schools and the confessions argued, with each author's answer and the pages it comes from."
    ),
    "tfr-lexicon": betaFeature(
      "The Lexicon needs an account",
      "Look up a term and see how each author in the library defines it, with the page that does."
    ),
    "tfr-set-index": betaFeature(
      "Set Indexes need an account",
      "Browse one index for a whole set of volumes."
    ),
    "tfr-scans": betaFeature(
      "Page Scans need an account",
      "Read a work beside the printed page it was transcribed from. The text itself stays open to everyone."
    ),
    "tfr-research-desk": betaFeature(
      "The Research desk needs an account",
      "Ask, search by meaning, compare authors, keep what you find and write from it. The Research tools are free with an account."
    ),
  };

  function hasAccess(feature) {
    /* TOUR BYPASS (Ian, 2026-09-25): a guided tour shows the member
       tools open, to everyone. assets/js/page/faith-tour.js sets
       window.MOTour.active in memory while a tour runs and clears it the
       moment the tour ends, is skipped or is closed; it is never stored
       and never read from the address. Every gate below (the click
       gate, the address doors, MOFeatureGate.open/allowed) asks here, so
       this one check covers them all. It is the modal only: the workers'
       own member checks are untouched, so nothing a member pays for is
       served by this. */
    if (window.MOTour && window.MOTour.active === true) return true;
    if (feature.requires === "subscriber") {
      return STATUS === "free" || STATUS === "paid" || STATUS === "comped";
    }
    if (feature.requires === "member") {
      return STATUS === "paid" || STATUS === "comped";
    }
    return true;
  }

  // Declared before anything below can open a modal: gateArrival() runs
  // at load, and a `let` read before its line is a ReferenceError.
  let modalEl = null;
  let modalOpener = null;
  let portalSigninRequested = false;

  /* DOORS BY ADDRESS (Ian, 2026-09-24: "Anywhere any one of these
     tools shows up in other places around TFR, they need to be met with
     a subscribe pop-up").

     A link is a door to a tool because of where it goes, not because
     someone remembered to mark it. There are links to the tools in
     sixty-odd files, most of them built in JS (the shelf rows, the port
     engines, the author and Scripture pages), and every one written
     tomorrow would be another chance to forget the attribute. So a link
     with no data-feature-gate of its own is gated by its address: any
     same-origin <a> whose path is one of the tool pages below is
     treated exactly as if it carried the matching attribute. An explicit
     data-feature-gate always wins, and data-feature-gate="open" (a name
     not in FEATURES) is how a link opts out.

     Keys are the first path segment under /the-faith-received/. The
     Research desk routes on its hash, so it is read separately; a bare
     /research/ is gated too (2026-10-24), as the desk itself.
     /scripture/desk/ is the Verse Desk, which is Scripture (reading),
     and does not match: only the FIRST segment is compared. */
  const TFR_ROOT = "/the-faith-received/";
  const TFR_TOOL_ROUTES = {
    "ask": "ask",
    "ask-workspace": "ask",
    "search": "tfr-search",
    "compare": "tfr-compare",
    "connections": "tfr-connections",
    "constellations": "tfr-connections",
    "web": "tfr-connections",
    "desk": "tfr-desk",
    // /pins/ forwards to /research/#notebook.
    "pins": "tfr-notebook",
    // The rest of the Research drawer (2026-10-24).
    "commentary-decks": "tfr-decks",
    "disputed-questions": "tfr-disputed",
    "lexicon": "tfr-lexicon",
    "set-index": "tfr-set-index",
    "scans": "tfr-scans",
  };
  // The Research desk's modes (faith-research.js), by the hash that
  // opens each one. "#compare&a=…" is mode "compare": the mode is the
  // first "&" segment, as faith-research.js reads it.
  const TFR_RESEARCH_MODES = {
    "ask": "ask",
    "power-search": "tfr-search",
    "compare": "tfr-compare",
    "bookmarks": "tfr-bookmarks",
    "notebook": "tfr-notebook",
    "connections": "tfr-connections",
    "constellations": "tfr-connections",
    "desk": "tfr-desk",
  };
  function modeOfHash(hash) {
    return String(hash || "").replace(/^#/, "").split("&")[0];
  }
  function gateForLink(a) {
    const raw = a.getAttribute("href");
    if (!raw) return null;
    let u;
    try { u = new URL(raw, window.location.href); } catch (err) { return null; }
    if (u.origin !== window.location.origin) return null;
    if (u.hash.indexOf("#/portal/") === 0) return null;
    if (u.pathname.indexOf(TFR_ROOT) !== 0) return null;
    const seg = u.pathname.slice(TFR_ROOT.length).split("/")[0];
    /* The Research desk itself is a tool now (Ian, 2026-10-24), so a bare
       /research/ and a hash that names no mode gate too. Before that it
       was the open sign-up landing; its signed-out branch is now the
       quiet "Free account required" state, which carries its own
       sign-up button. */
    if (seg === "research") return TFR_RESEARCH_MODES[modeOfHash(u.hash)] || "tfr-research-desk";
    return TFR_TOOL_ROUTES[seg] || null;
  }

  // The element that decides, and the feature name it resolves to.
  function gateOf(target) {
    if (!target || !target.closest) return null;
    const marked = target.closest("[data-feature-gate]");
    if (marked) return { el: marked, name: marked.getAttribute("data-feature-gate") };
    const a = target.closest("a[href]");
    if (a) {
      const name = gateForLink(a);
      if (name) return { el: a, name };
    }
    return null;
  }

  function intercept(e) {
    const g = gateOf(e.target);
    if (!g) return;
    const feature = FEATURES[g.name];
    if (!feature) return;
    if (hasAccess(feature)) return;
    e.preventDefault();
    e.stopImmediatePropagation();
    showModal(g.name, feature, g.el);
  }

  document.addEventListener("click", intercept, true);
  // A middle-click opens a link in a new tab without ever firing
  // "click", which would land the reader on the refusing page anyway.
  document.addEventListener(
    "auxclick",
    (e) => { if (e.button === 1) intercept(e); },
    true
  );

  /* ARRIVING AT A GATED TOOL BY ADDRESS. A reader who follows a shared
     /research/#compare link (or types it) has not clicked anything, so
     the click gate never runs. Any element carrying data-gate-hash names
     the hash that opens it; when the page's hash names that element and
     the reader cannot use its tool, the modal opens as if they had
     clicked it. The Research page's signed-out tab strip is the one that
     does this (custom-faith-research.hbs). Runs once at load and on
     every later hash change. This file ships at the foot of the page, so
     the markup is already parsed. */
  function gateArrival() {
    if (portalSigninRequested || window.location.hash.indexOf("#/portal/") === 0) return;
    /* A whole page that is a tool (the Connections atlas, whose signed-out
       branch is only the hero and the beta gate) marks itself with an
       empty, hidden [data-gate-on-arrival][data-feature-gate] element,
       and the modal opens over it on arrival, whatever the hash. Hidden
       and empty on purpose: the click gate above matches
       closest("[data-feature-gate]"), so the marker must never be an
       ancestor of anything a reader clicks. */
    const page = document.querySelector("[data-gate-on-arrival][data-feature-gate]");
    if (page) {
      const pname = page.getAttribute("data-feature-gate");
      const pfeature = FEATURES[pname];
      if (pfeature && !hasAccess(pfeature)) { if (!modalEl) showModal(pname, pfeature, null); return; }
    }
    const mode = modeOfHash(window.location.hash);
    if (!mode) return;
    const els = document.querySelectorAll("[data-gate-hash][data-feature-gate]");
    for (let i = 0; i < els.length; i++) {
      if (els[i].getAttribute("data-gate-hash") !== mode) continue;
      const name = els[i].getAttribute("data-feature-gate");
      const feature = FEATURES[name];
      if (feature && !hasAccess(feature)) showModal(name, feature, els[i]);
      return;
    }
  }
  gateArrival();
  window.addEventListener("hashchange", gateArrival);

  /* For doors that are not clicks: a keyboard shortcut, a ?ask= address,
     a function other code calls (FRAsk.open, the reader's research
     panel). open() shows the modal and returns true when the reader
     cannot use the feature, and returns false (doing nothing) when they
     can, so a caller writes `if (window.MOFeatureGate &&
     MOFeatureGate.open("ask")) return;` at the top of the function the
     tool opens through.

     A bundle global, so it exists only once site.min.js has run. Page
     scripts run BEFORE the bundle (FRONTEND §6.18): anything calling
     this at parse time must wait for DOMContentLoaded, and every caller
     must guard for its absence. */
  window.MOFeatureGate = {
    allowed(name) {
      const feature = FEATURES[name];
      return !feature || hasAccess(feature);
    },
    open(name, opener) {
      const feature = FEATURES[name];
      if (!feature || hasAccess(feature)) return false;
      showModal(name, feature, opener || document.activeElement);
      return true;
    },
  };


  function showModal(featureName, feature, opener) {
    dismissModal(true);
    modalOpener = opener;
    portalSigninRequested = false;

    const overlay = document.createElement("div");
    overlay.className = "feature-gate-modal";
    overlay.setAttribute("role", "dialog");
    overlay.setAttribute("aria-modal", "true");
    overlay.setAttribute("aria-labelledby", "fg-modal-title");

    // Build the panel scaffold via DOM construction (textContent for
    // anything dynamic). Pass 3 #7 in audits/SYNTHESIS.md flagged
    // this innerHTML pattern as fragile — same H4 class. Inner
    // contents (subscriberInner / memberInner) are hardcoded strings
    // so they remain innerHTML for now; if any data-driven field
    // ever lands inside them, convert those too.
    const backdrop = document.createElement("div");
    backdrop.className = "feature-gate-modal-backdrop";
    backdrop.setAttribute("data-fg-dismiss", "");

    const panel = document.createElement("div");
    panel.className = "feature-gate-modal-panel";

    const closeBtn = document.createElement("button");
    closeBtn.className = "feature-gate-modal-close";
    closeBtn.type = "button";
    closeBtn.setAttribute("data-fg-dismiss", "");
    closeBtn.setAttribute("aria-label", "Close");
    closeBtn.textContent = "×"; // ×

    const eyebrow = document.createElement("p");
    eyebrow.className = "eyebrow";
    eyebrow.textContent = feature.eyebrow;

    const title = document.createElement("h3");
    title.id = "fg-modal-title";
    title.className = "feature-gate-modal-title";
    title.textContent = feature.title;

    const bodyP = document.createElement("p");
    bodyP.className = "feature-gate-modal-body";
    bodyP.textContent = feature.body;

    panel.append(closeBtn, eyebrow, title, bodyP);

    const innerWrap = document.createElement("div");
    if (feature.requires === "subscriber") {
      innerWrap.innerHTML = subscriberInner(featureName, feature);
      const form = innerWrap.querySelector("[data-inline-signup]");
      const link = opener && opener.closest && opener.closest("a[href]");
      if (form && link) {
        try {
          const target = new URL(link.getAttribute("href"), window.location.href);
          if (/^https?:$/.test(target.protocol) && target.origin === window.location.origin) {
            form.setAttribute("data-signup-redirect", target.href);
          }
        } catch (_) { /* keep the current-page return target */ }
      }
    } else {
      innerWrap.innerHTML = memberInner(feature);
    }
    while (innerWrap.firstChild) panel.appendChild(innerWrap.firstChild);

    /* "Already a subscriber? Sign in" at the foot of every gate (Ian,
       2026-09-23). Only for someone signed out: a signed-in free reader
       meeting a members-only tool is already signed in. The link opens
       Ghost's own sign-in (Portal) and closes this dialog. */
    if (STATUS === "anonymous") {
      const signin = document.createElement("p");
      signin.className = "feature-gate-modal-signin";
      signin.append(feature.requires === "member" ? "Already a member? " : "Already a subscriber? ");
      const a = document.createElement("a");
      a.href = "#/portal/signin";
      // Portal binds data-portal triggers only at startup. A dynamic
      // link uses its supported hash route and must not reopen this gate
      // when Portal consumes that hash.
      a.addEventListener("click", () => {
        portalSigninRequested = true;
        dismissModal(true, false);
      });
      a.textContent = "Sign in";
      signin.appendChild(a);
      panel.appendChild(signin);
    }

    overlay.append(backdrop, panel);

    document.body.appendChild(overlay);
    modalEl = overlay;
    document.body.classList.add("feature-gate-modal-open");

    overlay.addEventListener("click", (e) => {
      if (e.target.closest("[data-fg-dismiss]")) dismissModal();
    });
    document.addEventListener("keydown", escHandler);

    requestAnimationFrame(() => {
      overlay.classList.add("is-visible");
      const first =
        overlay.querySelector("#fg-email") ||
        overlay.querySelector(".feature-gate-modal-cta");
      if (first) first.focus();
    });
  }

  function subscriberInner(featureName, feature) {
    const account = featureName === "ask" || featureName.indexOf("tfr-") === 0;
    const accountAttr = account ? " data-account-signup" : "";
    const submitText = account ? "Create free account" : "Subscribe";
    // Mirrors partials/digest-cta.hbs form structure so inline-signup.js
    // picks it up unchanged.
    return (
      `<div class="feature-gate-modal-form digest-form" data-inline-signup${accountAttr} data-source="feature-gate:${escapeAttr(featureName)}">` +
        `<div class="digest-field"><label for="fg-first">First Name</label>` +
          `<input id="fg-first" type="text" autocomplete="given-name" placeholder="First" data-signup-first required /></div>` +
        `<div class="digest-field"><label for="fg-last">Last Name</label>` +
          `<input id="fg-last" type="text" autocomplete="family-name" placeholder="Last" data-signup-last required /></div>` +
        `<div class="digest-field"><label for="fg-email">Email</label>` +
          `<input id="fg-email" type="email" autocomplete="email" placeholder="you@example.com" data-signup-email required /></div>` +
        `<button type="button" class="digest-submit" data-signup-submit>${submitText}</button>` +
        `<p class="digest-fineprint">Free. Unsubscribe anytime.</p>` +
        `<p class="digest-status" data-signup-status role="status" aria-live="polite"></p>` +
      `</div>`
    );
  }

  function memberInner() {
    return (
      '<div class="feature-gate-modal-actions">' +
        '<a href="/membership/" class="feature-gate-modal-cta btn btn-solid btn-primary">Become a Member</a>' +
      '</div>'
    );
  }

  /* Escape closes it, and Tab stays inside it. The dialog is
     aria-modal, which tells a screen reader the rest of the page is
     inert, but it does not make the browser agree: without this, Tab
     walks straight out of the modal and into the page behind, where a
     keyboard reader is then tabbing through a tool they were just told
     they cannot use yet. Lifted from faith-report-issue.js, which is
     the only dialog in the theme that had it. */
  function escHandler(e) {
    if (e.key === "Escape") { dismissModal(); return; }
    if (e.key !== "Tab" || !modalEl) return;
    const f = modalEl.querySelectorAll(
      'a[href], button:not([disabled]), input, select, textarea'
    );
    if (!f.length) return;
    const first = f[0];
    // Focus that is outside the dialog (a click on the page behind it) comes back in on the next Tab.
    if (!modalEl.contains(document.activeElement)) { e.preventDefault(); first.focus(); return; }
    const last = f[f.length - 1];
    if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
    else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
  }

  function dismissModal(immediate, returnFocus = true) {
    if (!modalEl) return;
    const m = modalEl;
    const opener = modalOpener;
    modalOpener = null;
    modalEl = null;
    document.removeEventListener("keydown", escHandler);
    document.body.classList.remove("feature-gate-modal-open");
    if (immediate) { m.remove(); if (returnFocus) restoreFocus(opener); return; }
    m.classList.add("is-closing");
    setTimeout(() => { if (m.parentNode) m.remove(); if (returnFocus && !modalEl) restoreFocus(opener); }, 220);
  }

  function restoreFocus(opener) {
    if (opener && opener.isConnected && opener.focus) {
      try { opener.focus({ preventScroll: true }); } catch (e) { /* no-op */ }
    }
  }

  function escapeHtml(s) {
    return String(s).replace(/[&<>"']/g, (c) => {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
    });
  }
  function escapeAttr(s) {
    return String(s).replace(/["<>]/g, (c) => {
      return { '"': "&quot;", "<": "&lt;", ">": "&gt;" }[c];
    });
  }
})();
