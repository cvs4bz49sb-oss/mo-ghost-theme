/*
 * Power Search — the semantic-search workspace on
 * /the-faith-received/research/ (the "Power Search" tab).
 *
 * Search by MEANING rather than by word. Talks to the mo-tfr-library
 * Worker's GET /v1/vsearch, which embeds the query once and runs it
 * against the Vectorize index over the corpus. See
 * website/workers/tfr-library/lib/vsearch.js — that file is the
 * authority on both the query params and the result shape:
 *
 *   GET /v1/vsearch?q=<text>&k=<1..20>&tradition=<one value>
 *   -> { query, results: [ { doc, anchor, cit, snippet, score,
 *                            tradition, author, title, page, locus,
 *                            corpus, url } ] }
 *
 * Two fields do real work here and both are built server-side:
 *
 *   `cit`  A finished citation string ("Augustine of Hippo, The
 *          Literal Meaning of Genesis, PL 34"). It already resolves
 *          the page-vs-locus question per collection — most of this
 *          corpus has no printed page numbers, and `page` is a section
 *          ordinal for the collections that don't — so this file uses
 *          `cit` and never reassembles a citation out of
 *          author/title/page itself.
 *   `url`  A finished reader link from the worker's own corpus-aware
 *          readerUrlFor(). Used exactly as given. Building one here
 *          from `doc` would silently drop the `?c=` corpus param the
 *          non-native collections need and load an empty reader.
 *
 * ACCESS. /v1/vsearch is paid-member gated on the worker
 * (requirePaidMember() in tfr-library/worker.js: verified Ghost member
 * JWT, then a 30-per-60s limit on that identity, then paid/comped).
 * So every call goes through window.MOAuth.fetch (assets/js/admin-auth.js,
 * in boot.min.js in <head>), which attaches the member's bearer token
 * and refuses outright if the destination isn't on the page's
 * mo-trusted-hosts allowlist. The submit button also carries
 * data-feature-gate="ask" so feature-gate.js intercepts a free or
 * anonymous visitor's click before it reaches the handler below — the
 * standing rule is that a member-gated, money-spending endpoint is
 * gated on BOTH sides, the client side existing only to explain why
 * rather than to enforce. Anyone who gets here anyway (console, gate
 * bypass) gets the worker's own 401/403 `.error` string, surfaced
 * verbatim: it already says "This feature is for paid members. Sign
 * in, or become a member at /membership/." and papering that over with
 * "search is unavailable" would tell a signed-out reader there was an
 * outage.
 *
 * RENDERING. Every field below crossed a trust boundary. Results are
 * built with createElement + textContent rather than a template
 * string, so there is no HTML-escaping step to forget and no path from
 * a server string to markup at all; the one URL is routed through
 * MOSafeHref, which rejects anything that isn't http(s)/relative.
 *
 * INDEX COVERAGE. The vector index is still being populated across the
 * collections. A thin result set is therefore not necessarily a bug —
 * the no-results copy in the template says so rather than implying the
 * library has nothing on the subject.
 *
 * Loaded as a page-template script (FRONTEND §6.18): runs before
 * site.min.js, touches no bundle globals. window.MOAuth and
 * window.MOSafeHref both ship in boot.min.js in <head> and are already
 * present.
 */
(function () {
  const form = document.querySelector("[data-ps-form]");
  if (!form) return;

  const input = form.querySelector("[data-ps-input]");
  const submitBtn = form.querySelector("[data-ps-submit]");
  const statusEl = document.querySelector("[data-ps-status]");
  const errorEl = document.querySelector("[data-ps-error]");
  const emptyEl = document.querySelector("[data-ps-empty]");
  const countEl = document.querySelector("[data-ps-count]");
  const resultsEl = document.querySelector("[data-ps-results]");
  const noResultsEl = document.querySelector("[data-ps-noresults]");

  const scopeEl = document.querySelector("[data-ps-scope]");
  const scopeStateEl = document.querySelector("[data-ps-scope-state]");
  const tradPills = Array.from(document.querySelectorAll("[data-ps-tradition]"));

  // Same worker every other faith-*.js file in this theme talks to.
  // Each file defines its own copy of the base URL rather than sharing
  // a global — matching the existing convention (see faith-ask.js and
  // faith-corpora.js).
  const WORKER = "https://mo-tfr-library.mo-podcast-feed.workers.dev";
  const VSEARCH_URL = `${WORKER}/v1/vsearch`;

  // MAX_K in lib/vsearch.js is 20 and the endpoint clamps to it. Asking
  // for the ceiling costs nothing extra — one embedding and one
  // Vectorize query either way — and a semantic result list is worth
  // reading past ten.
  const K = 20;

  // ── Scope ──────────────────────────────────────────────────────
  //
  // Single-select, unlike Ask's multi-select control, because
  // handleVSearch() reads exactly one `tradition` param and passes it
  // as an exact-match Vectorize metadata filter. Offering checkboxes
  // here would promise a query the endpoint cannot run. The nine
  // values live in the template and must stay byte-identical to
  // KNOWN_TRADITIONS in the worker's lib/ask.js — an unrecognised
  // value doesn't error, it just matches nothing, which reads as "the
  // library has nothing on this."
  function currentTradition() {
    const active = tradPills.find((p) => p.classList.contains("is-active"));
    return active ? (active.getAttribute("data-ps-tradition") || "") : "";
  }

  function renderScopeState() {
    if (!scopeStateEl) return;
    const trad = currentTradition();
    scopeStateEl.textContent = trad || "The whole library";
    if (scopeEl) scopeEl.classList.toggle("ps-scope--set", Boolean(trad));
  }

  tradPills.forEach((pill) => {
    pill.addEventListener("click", () => {
      tradPills.forEach((p) => {
        const active = p === pill;
        p.classList.toggle("is-active", active);
        p.setAttribute("aria-pressed", active ? "true" : "false");
      });
      renderScopeState();
      // Changing the scope does NOT re-run the search: a search spends
      // a real embedding call and the paid-member gate lives on the
      // submit button's own click, so nothing may reach the worker
      // without a deliberate press. But results already on screen were
      // retrieved under the OLD scope, and leaving them there
      // unremarked is the "the filter did nothing" failure in a
      // different costume. Say so instead.
      if (resultsEl && !resultsEl.hidden) {
        setStatus("Scope changed. Search again to apply it.");
      }
    });
  });

  // ── States ─────────────────────────────────────────────────────
  //
  // Five of them and they are mutually exclusive: empty (nothing asked
  // yet), loading, results, no-results, error. Each transition below
  // sets all of them rather than only the one it cares about, because
  // the bug this shape prevents — a stale result list still on screen
  // under a fresh error, or a "no results" line under twenty hits — is
  // exactly what a half-updated state produces.
  function setStatus(message) {
    if (!statusEl) return;
    if (!message) { statusEl.hidden = true; statusEl.textContent = ""; return; }
    statusEl.hidden = false;
    statusEl.textContent = message;
  }

  function clearResults() {
    if (resultsEl) { resultsEl.textContent = ""; resultsEl.hidden = true; }
    if (countEl) { countEl.textContent = ""; countEl.hidden = true; }
    if (noResultsEl) noResultsEl.hidden = true;
  }

  function showError(message) {
    setStatus("");
    clearResults();
    if (emptyEl) emptyEl.hidden = true;
    if (errorEl) {
      errorEl.hidden = false;
      errorEl.textContent = message || "Something went wrong searching the library. Please try again.";
    }
  }

  // ── Results ────────────────────────────────────────────────────
  //
  // A flat editorial list: hairline-separated rows, each one a
  // tradition line, the citation as the row's title, and the passage
  // itself underneath. No score — a raw cosine number is noise to a
  // reader and an invitation to over-read a 0.71 against a 0.68 — and
  // no card, per the house rule.
  function renderResults(results, trad) {
    if (!resultsEl) return;
    resultsEl.textContent = "";

    if (!results.length) {
      if (countEl) { countEl.textContent = ""; countEl.hidden = true; }
      resultsEl.hidden = true;
      if (noResultsEl) noResultsEl.hidden = false;
      return;
    }
    if (noResultsEl) noResultsEl.hidden = true;

    results.forEach((r) => {
      const li = document.createElement("li");
      li.className = "ps-hit";

      const a = document.createElement("a");
      a.className = "ps-hit-link";
      // r.url is the worker's own readerUrlFor() output, but it still
      // crossed the network, so it goes through the same scheme check
      // every other non-literal href in this theme does.
      window.MOSafeHref.set(a, r.url, "#");
      a.target = "_blank";
      a.rel = "noopener";

      const tradLabel = r.tradition || r.corpus || "";
      if (tradLabel) {
        const meta = document.createElement("p");
        meta.className = "ps-hit-meta";
        meta.textContent = tradLabel;
        a.appendChild(meta);
      }

      const cit = document.createElement("p");
      cit.className = "ps-hit-cit";
      // `cit` already resolves page-vs-locus per collection; `doc` (the
      // canonical slug) is the last-resort label so a row is never
      // blank and unclickable-looking.
      cit.textContent = r.cit || r.doc || "Untitled passage";
      a.appendChild(cit);

      if (r.snippet) {
        const snip = document.createElement("p");
        snip.className = "ps-hit-snippet";
        snip.textContent = r.snippet;
        a.appendChild(snip);
      }

      li.appendChild(a);
      resultsEl.appendChild(li);
    });

    resultsEl.hidden = false;
    if (countEl) {
      const n = results.length;
      const noun = n === 1 ? "passage" : "passages";
      countEl.textContent = trad ? `${n} ${noun} in ${trad}` : `${n} ${noun}`;
      countEl.hidden = false;
    }
  }

  // ── The search ─────────────────────────────────────────────────
  //
  // A token rather than an AbortController: two searches in flight is
  // the only race here and all it needs is "ignore anything that isn't
  // the newest". Aborting would also need the disabled button and the
  // status line unwound from the abort path, for no reader benefit on
  // a call that returns in under a second.
  let runToken = 0;

  async function runSearch(query) {
    const token = ++runToken;
    const trad = currentTradition();

    const params = new URLSearchParams({ q: query, k: String(K) });
    if (trad) params.set("tradition", trad);
    const url = `${VSEARCH_URL}?${params.toString()}`;

    let resp;
    try {
      // MOAuth.fetch attaches the member's Ghost bearer token when one
      // exists and refuses the call outright if the worker host isn't
      // on the page's mo-trusted-hosts allowlist (default.hbs). The
      // fallback to a bare fetch() only matters if boot.min.js failed
      // to load; the worker then answers 401 with a real message,
      // which is a better outcome than a TypeError.
      //
      // The branch is at the CALL, not hoisted into a variable:
      // `const go = window.fetch; go(url)` throws "Illegal invocation"
      // because the native fetch needs its Window receiver. Same shape
      // faith-ask.js's loadUsage() uses, for the same reason.
      resp = await (window.MOAuth && window.MOAuth.fetch ? window.MOAuth.fetch(url) : fetch(url));
    } catch (err) {
      // Keep the real reason in the console — an untrusted-destination
      // refusal and a network/CORS failure produce the same sentence
      // on screen and are otherwise indistinguishable in a bug report.
      console.error("[faith-power-search] GET /v1/vsearch failed before a response was received", err);
      if (token === runToken) showError("Could not reach the library. Please check your connection and try again.");
      return;
    }

    if (token !== runToken) return;

    if (!resp.ok) {
      // 401/403 are the worker's paid-member gate and 429 its burst
      // limiter; all three answer with a reader-facing `.error` string
      // the worker already wrote, and all three are shown as-is. A
      // generic "temporarily unavailable" here would tell a visitor
      // who simply isn't signed in that the library is down.
      let message = "Search is temporarily unavailable. Please try again shortly.";
      try {
        const j = await resp.json();
        if (j && j.error) message = j.error;
      } catch (_) { /* non-JSON error body — keep the generic message */ }
      // Re-checked after the await: a newer search may have started
      // while the error body was being read, and painting this one's
      // failure over that one's results would be a lie about the
      // query on screen.
      if (token === runToken) showError(message);
      return;
    }

    let data;
    try {
      data = await resp.json();
    } catch (err) {
      console.error("[faith-power-search] /v1/vsearch returned an unreadable body", err);
      if (token === runToken) showError("The library sent back something we couldn't read. Please try again.");
      return;
    }

    if (token !== runToken) return;

    setStatus("");
    if (errorEl) errorEl.hidden = true;
    if (emptyEl) emptyEl.hidden = true;
    renderResults(Array.isArray(data && data.results) ? data.results : [], trad);
  }

  form.addEventListener("submit", (e) => {
    e.preventDefault();
    const query = (input.value || "").trim();
    if (!query) { input.focus(); return; }

    if (errorEl) errorEl.hidden = true;
    clearResults();
    if (emptyEl) emptyEl.hidden = true;
    if (submitBtn) submitBtn.disabled = true;
    setStatus("Searching the library…");

    runSearch(query).finally(() => {
      if (submitBtn) submitBtn.disabled = false;
    });
  });

  // Example searches fill the box and stop there — same reasoning as
  // Ask's: the paid-member gate is on the submit button's own click
  // and a search spends real money, so nothing here may reach the
  // worker on its own.
  document.querySelectorAll("[data-ps-example]").forEach((btn) => {
    btn.addEventListener("click", () => {
      input.value = (btn.textContent || "").trim();
      input.focus();
    });
  });

  // A ?q= in the URL prefills the box and stops there, for the same
  // reason. Pair it with #power-search to land on this tab:
  // /the-faith-received/research/?q=justification#power-search
  try {
    const q = new URLSearchParams(window.location.search).get("q");
    if (q) input.value = q.slice(0, 300);
  } catch (_) { /* malformed query string — nothing to prefill */ }

  renderScopeState();
})();
