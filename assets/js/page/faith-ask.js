/*
 * /the-faith-received/ask/ — "a question answered from the library
 * with citations." Talks to the mo-tfr-library Worker's POST
 * /v1/ask, which streams NDJSON: zero or more {"type":"progress"}
 * lines, then exactly one {"type":"result"} or {"type":"error"}
 * line. See website/workers/tfr-library/lib/ask.js for the contract.
 *
 * Rendered as an editorial set piece per the data owner's spec: the
 * question becomes a heading, the answer is running prose, and
 * citations are footnotes linking into the reader — not a chat
 * bubble. The markup is a shared partial,
 * partials/faith-received/_ask-panel.hbs (rendered by both
 * custom-faith-ask.hbs and the Ask tab of custom-faith-search.hbs);
 * read its header for the DOM contract every querySelector() below
 * depends on.
 *
 * SCOPE (2026-09): the composer carries a collapsed scope control —
 * multi-select traditions plus an author box — whose values go out as
 * `traditions` and `author` in the POST body. See currentScope() and
 * renderScopeState() below. The worker has accepted both fields since
 * the spend-cap work but this file never sent them, so a reader who
 * set a scope on the Search page got an unscoped answer with nothing
 * on screen to say the filter had been ignored. Ask's control is its
 * own thing, deliberately: the Search page's pills are single-select
 * and drive Pagefind through faith-tfr-search.js, and are hidden while
 * the Ask tab is active.
 *
 * Access: the "Ask the library" button carries data-feature-gate="ask"
 * (see assets/js/feature-gate.js, loaded before this file) — a free
 * or anonymous visitor's click is intercepted there and never reaches
 * the submit handler below. That client-side gate is now backed by a
 * real server-side one: security review 2026-09-03 found POST /v1/ask
 * took no Authorization header at all, so a determined caller could
 * bypass the modal with curl and spend our Workers AI + Claude budget
 * for free. The worker now requires a verified paid-member bearer
 * token (see requirePaidMember() in
 * website/workers/tfr-library/worker.js) — this file calls it through
 * window.MOAuth.fetch (assets/js/admin-auth.js, loaded in the boot
 * bundle before {{{body}}}) instead of a plain fetch(), so a signed-in
 * member's request actually carries that token. An anonymous visitor
 * who reaches streamAsk() anyway (JS console, gate bypass) still gets
 * a real 401 from the worker and the generic-but-actionable error
 * message below, not a raw network failure.
 *
 * SPEND-CAP UI (2026-09): a beta capacity cap now backs /v1/ask on the
 * worker side (per-member daily question cap + a shared daily $
 * budget — see lib/budget.js). Two additions here:
 *   1. A usage meter, fetched from GET /v1/ask/usage on page load and
 *      refreshed after every attempt (success, cooldown, or error) —
 *      mirrors Anthropic's own console pattern per the brief: a
 *      labeled bar, a percentage, a reset time. See renderUsage()
 *      and loadUsage() below, and .ask-usage* in faith-received.css.
 *   2. A cooldown response (HTTP 429, `{ok:false, cooldown:true,
 *      reason, error, resetsAt}` — see cooldownResponse() in
 *      lib/ask.js) is handled distinctly from a generic error: the
 *      message the worker already wrote is shown as-is (it already
 *      says which limit was hit and when it resets), and the meter is
 *      refreshed immediately so the reader sees the same 100% the
 *      error just described, not a stale 60%.
 *
 * Loaded as a page-template script, so per the theme's own script-
 * order rule it runs before site.min.js and must not depend on any
 * bundle global other than window.MOAuth, which is in the boot
 * bundle and therefore already on the page by the time this file's
 * IIFE runs (see default.hbs's boot-bundle comment).
 */
(function () {
  const form = document.querySelector("[data-ask-form]");
  if (!form) return;

  const input = form.querySelector("[data-ask-input]");
  const submitBtn = form.querySelector("[data-ask-submit]");
  const statusEl = document.querySelector("[data-ask-status]");
  const resultEl = document.querySelector("[data-ask-result]");
  const headingEl = document.querySelector("[data-ask-heading]");
  const answerEl = document.querySelector("[data-ask-answer]");
  const gapsEl = document.querySelector("[data-ask-gaps]");
  const footnotesWrap = document.querySelector("[data-ask-footnotes-wrap]");
  const footnotesEl = document.querySelector("[data-ask-footnotes]");
  const errorEl = document.querySelector("[data-ask-error]");

  // Scope control (2026-09): the collapsed <details> in the composer.
  // The worker has accepted `traditions` (array) and `author` on POST
  // /v1/ask since the spend-cap work -- see the body parse in
  // website/workers/tfr-library/lib/ask.js -- but nothing sent them
  // until now, so a reader who set a scope got an unscoped answer with
  // no sign anything had been ignored. The nine tradition values in the
  // partial are validated server-side against KNOWN_TRADITIONS and any
  // value the worker does not recognise is dropped, so the strings must
  // stay byte-identical to that set.
  const scopeEl = document.querySelector("[data-ask-scope]");
  const scopeStateEl = document.querySelector("[data-ask-scope-state]");
  const scopeAuthorEl = document.querySelector("[data-ask-author]");
  const scopeTraditionEls = Array.from(document.querySelectorAll("[data-ask-tradition]"));

  const usageEl = document.querySelector("[data-ask-usage]");
  const usageMineRow = document.querySelector("[data-ask-usage-mine]");
  const usageMineText = document.querySelector("[data-ask-usage-mine-text]");
  const usageMineFill = document.querySelector("[data-ask-usage-mine-fill]");
  const usageGlobalRow = usageMineRow ? usageMineRow.nextElementSibling : null;
  const usageGlobalText = document.querySelector("[data-ask-usage-global-text]");
  const usageGlobalFill = document.querySelector("[data-ask-usage-global-fill]");

  // Same worker every other faith-*.js file in this theme talks to
  // (see assets/js/faith-corpora.js's own BLOB/LIBRARY constant) —
  // each file defines its own copy of this base URL rather than
  // sharing a global, matching that existing convention.
  const WORKER = "https://mo-tfr-library.mo-podcast-feed.workers.dev";
  const ASK_URL = `${WORKER}/v1/ask`;
  const USAGE_URL = `${WORKER}/v1/ask/usage`;

  function escapeHtml(s) {
    return String(s == null ? "" : s).replace(/[&<>"']/g, (c) => {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
    });
  }

  function setStatus(message) {
    if (!statusEl) return;
    if (!message) { statusEl.hidden = true; statusEl.textContent = ""; return; }
    statusEl.hidden = false;
    statusEl.textContent = message;
  }

  function showError(message) {
    setStatus("");
    if (resultEl) resultEl.hidden = true;
    if (errorEl) {
      errorEl.hidden = false;
      errorEl.textContent = message || "Something went wrong asking the library. Please try again.";
    }
  }

  // Renders the answer as paragraphs, turning the server's [n]
  // citation markers into footnote links. The answer text (model
  // output) and the question (user input) are both untrusted for raw
  // HTML purposes and are escaped before any markup is reintroduced —
  // the only HTML added back in is the fixed <sup><a> template below,
  // and only for an `n` that is both a parsed integer AND present in
  // the citations list the server returned, so there is no path from
  // arbitrary answer text to arbitrary markup.
  // Citation markers and **bold** both operate on text that's already
  // been through escapeHtml() below -- the only tags this can ever
  // introduce are the fixed <strong>/<sup><a> templates here, so this
  // stays as safe as the citation-marker handling it's alongside.
  function renderInline(text, citByN) {
    const withNotes = text.replace(/\[(\d+)\]/g, (whole, numStr) => {
      const n = parseInt(numStr, 10);
      if (!citByN.has(n)) return ""; // a dangling marker never renders as text or markup
      return `<sup class="ask-footnote-ref"><a href="#ask-fn-${n}">${n}</a></sup>`;
    });
    // synthesisSystem() explicitly asks the model for **bold** lead-ins
    // ("bold heading each", "**Where they agree**" etc.) -- this used
    // to render as literal asterisks since nothing consumed them.
    return withNotes.replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>");
  }

  function renderAnswer(text, citations) {
    const citByN = new Map((citations || []).map((c) => [c.n, c]));
    const escaped = escapeHtml(text);
    const blocks = escaped.split(/\n{2,}/).map((b) => b.trim()).filter(Boolean);
    const html = blocks.map((block) => {
      const lines = block.split(/\n/).map((l) => l.trim()).filter(Boolean);

      // A "### Heading"-style block (2026-09, confirmed with Gemini's
      // synthesis output -- synthesisSystem() never asks for this, it
      // asks for **bold** lead-ins, but Gemini sometimes reaches for a
      // markdown heading for the same "heading for this block"
      // purpose). Same heading treatment as a leading **bold** below,
      // so the reader sees one consistent heading style regardless of
      // which markdown the model happened to use, rather than literal
      // "###" text.
      const headingMatch = lines.length === 1 && block.match(/^#{1,6}\s+(.+)$/);
      if (headingMatch) {
        return `<p class="ask-answer-lead">${renderInline(headingMatch[1], citByN)}</p>`;
      }

      // The ENUMERATE rule in synthesisSystem() asks for "EVERY relevant
      // one as its own bulleted entry" -- a block that's entirely "- "
      // lines renders as a real list instead of a paragraph with
      // literal dashes in it.
      const isList = lines.length > 1 && lines.every((l) => /^-\s+/.test(l));
      if (isList) {
        const items = lines.map((l) => `<li>${renderInline(l.replace(/^-\s+/, ""), citByN)}</li>`).join("");
        return `<ul>${items}</ul>`;
      }

      // A "> quoted text" line (2026-09, confirmed with Gemini): often
      // arrives as a lead-in sentence on one line ("...defines it as:")
      // followed by the blockquote on the next, both inside the SAME
      // block (single \n, not the \n{2,} that separates blocks) --
      // without handling this per-line, the old single-newline-to-space
      // join below smashes the lead-in and the literal "> " marker
      // together into one line of running prose. Walks the block's own
      // lines in order so a lead-in before/after the quote still reads
      // as normal prose, only the "> " line becomes a real blockquote.
      //
      // The marker is matched as `&gt;` first, not `>`. This whole
      // block runs on text that escapeHtml() has ALREADY been through
      // (see `escaped` above), so by the time a line reaches here a
      // model's "> quoted line" is literally "&gt; quoted line" and a
      // bare /^>/ test can never match. It never did: every quotation
      // the model marked up rendered as a paragraph beginning with a
      // visible "&gt;", and .ask-answer blockquote in
      // faith-received.css styled nothing. Found on the first real
      // render of the rebuilt panel, 2026-09. The bare `>` alternative
      // is kept so this still works if the escaping order ever moves.
      if (lines.some((l) => /^(?:&gt;|>)\s?/.test(l))) {
        const parts = [];
        let plain = [];
        const flushPlain = () => {
          if (plain.length) { parts.push(`<p>${renderInline(plain.join(" "), citByN)}</p>`); plain = []; }
        };
        for (const l of lines) {
          const q = l.match(/^(?:&gt;|>)\s?(.*)$/);
          if (q) {
            flushPlain();
            parts.push(`<blockquote>${renderInline(q[1], citByN)}</blockquote>`);
          } else {
            plain.push(l);
          }
        }
        flushPlain();
        return parts.join("");
      }

      const joined = block.replace(/\n/g, " ");
      // synthesisSystem() always uses a **bold** lead-in as a heading
      // for a block ("**Where they agree**", "**Hooker (Anglican) on
      // justification**" -- see its ANSWER SHAPE and PIVOT RULE) --
      // rendering that as plain inline <strong> left it running
      // straight into the sentence that follows with no break. Only a
      // LEADING bold phrase gets this heading treatment; **bold**
      // appearing mid-sentence elsewhere (renderInline handles that
      // case) stays inline emphasis.
      const lead = joined.match(/^\*\*(.+?)\*\*\s*-?\s*/);
      if (lead) {
        const heading = `<p class="ask-answer-lead">${renderInline(lead[1], citByN)}</p>`;
        const rest = joined.slice(lead[0].length);
        return rest ? `${heading}<p>${renderInline(rest, citByN)}</p>` : heading;
      }
      return `<p>${renderInline(joined, citByN)}</p>`;
    }).join("");
    answerEl.innerHTML = html || "<p>The library had nothing to answer this from.</p>";
  }

  function renderFootnotes(citations) {
    if (!footnotesEl || !footnotesWrap) return;
    footnotesEl.textContent = "";
    if (!citations || !citations.length) { footnotesWrap.hidden = true; return; }
    citations.forEach((c) => {
      const li = document.createElement("li");
      li.id = `ask-fn-${c.n}`;
      // citations only lists indexes the model actually cited, so this
      // list is sparse relative to the full evidence array (e.g. 1, 3,
      // 6, 7, 22 -- never a dense 1..k run). Without this, <ol>'s own
      // auto-numbering shows "1, 2, 3, 4, 5" here regardless of the
      // real n -- a reader following an inline "[22]" footnote link
      // would land on a sidebar entry visibly labeled "5", not "22",
      // and conclude sources were missing rather than mislabeled.
      li.value = c.n;
      const a = document.createElement("a");
      // c.url comes from the worker's own readerUrl() builder
      // (/the-faith-received/reader/?w=<slug>&p=<page>) — a fixed
      // shape built from data the worker looked up itself, not from
      // anything the model wrote, but still opened in a new tab as a
      // matter of course for an off-page footnote link.
      a.href = c.url || "#";
      a.target = "_blank";
      a.rel = "noopener";
      a.textContent = c.cit || c.doc || "Source";
      li.appendChild(a);
      if (c.tradition) {
        const span = document.createElement("span");
        span.className = "ask-footnote-tradition";
        span.textContent = ` (${c.tradition})`;
        li.appendChild(span);
      }
      footnotesEl.appendChild(li);
    });
    footnotesWrap.hidden = false;
  }

  function renderGaps(gaps) {
    if (!gapsEl) return;
    if (!gaps || !gaps.length) { gapsEl.hidden = true; return; }
    gapsEl.hidden = false;
    gapsEl.textContent = `Not yet represented in this answer: ${gaps.join("; ")}.`;
  }

  // ── Scope ────────────────────────────────────────────────────
  //
  // Read on every submit rather than tracked in a variable, so there is
  // exactly one source of truth (the checkboxes themselves) and no way
  // for the summary line and the request body to disagree.
  function currentScope() {
    const traditions = scopeTraditionEls.filter((el) => el.checked).map((el) => el.value);
    const author = scopeAuthorEl ? scopeAuthorEl.value.trim().slice(0, 100) : "";
    return { traditions, author };
  }

  // The collapsed summary has to say what is selected, or a scope set
  // and forgotten silently narrows every later answer with nothing on
  // screen to explain why the library suddenly knows less.
  function renderScopeState() {
    if (!scopeStateEl) return;
    const scope = currentScope();
    const parts = [];
    if (scope.traditions.length === 1) parts.push(scope.traditions[0]);
    else if (scope.traditions.length > 1) parts.push(`${scope.traditions.length} traditions`);
    if (scope.author) parts.push(scope.author);
    scopeStateEl.textContent = parts.length ? parts.join(" · ") : "The whole library";
    if (scopeEl) scopeEl.classList.toggle("ask-scope--set", parts.length > 0);
  }

  scopeTraditionEls.forEach((el) => el.addEventListener("change", renderScopeState));
  if (scopeAuthorEl) scopeAuthorEl.addEventListener("input", renderScopeState);
  renderScopeState();

  // Example questions in the empty state fill the box and stop there.
  // They deliberately do NOT submit: the paid-member gate is on the
  // submit button's own click (feature-gate.js), and a question spends
  // real money against the shared daily budget, so nothing may reach
  // the worker without a deliberate press.
  document.querySelectorAll("[data-ask-example]").forEach((btn) => {
    btn.addEventListener("click", () => {
      if (!input) return;
      input.value = (btn.textContent || "").trim();
      input.focus();
    });
  });

  // ── Usage meter ──────────────────────────────────────────────
  //
  // GET /v1/ask/usage never spends anything and never denies — it
  // always returns 200 with `global` (safe for any caller) and `mine`
  // (populated only for a verified, currently-paid member; null
  // otherwise). See handleAskUsage() in tfr-library/worker.js.
  function renderUsage(data) {
    if (!usageEl) return;
    const global = data && data.global;
    const mine = data && data.mine;

    // No global data at all (fetch failed, or the worker itself
    // reported the budget check unavailable) — hide the whole meter
    // rather than show a misleading 0%. See custom-faith-ask.hbs's own
    // comment: "hidden until that first read succeeds."
    if (!global || global.unavailable || typeof global.pctUsed !== "number") {
      usageEl.hidden = true;
      return;
    }
    usageEl.hidden = false;

    if (usageMineRow) {
      if (mine && !mine.unavailable && typeof mine.used === "number" && mine.cap > 0) {
        usageMineRow.hidden = false;
        const pct = Math.min(100, Math.round((mine.used / mine.cap) * 100));
        if (usageMineText) usageMineText.textContent = `${mine.used} of ${mine.cap} used`;
        if (usageMineFill) usageMineFill.style.width = `${pct}%`;
        usageMineRow.classList.toggle("ask-usage-row--warn", mine.used >= mine.cap);
      } else {
        usageMineRow.hidden = true;
      }
    }

    if (usageGlobalRow) {
      const pct = global.pctUsed;
      if (usageGlobalText) usageGlobalText.textContent = `${pct}% used, resets at midnight UTC`;
      if (usageGlobalFill) usageGlobalFill.style.width = `${pct}%`;
      usageGlobalRow.classList.toggle("ask-usage-row--warn", pct >= 90);
    }
  }

  function loadUsage() {
    if (!usageEl) return;
    const go = window.MOAuth && window.MOAuth.fetch ? window.MOAuth.fetch(USAGE_URL) : fetch(USAGE_URL);
    go.then((r) => (r.ok ? r.json() : null))
      .then((d) => { if (d) renderUsage(d); })
      .catch(() => { /* meter is a nice-to-have -- a failed fetch just leaves it hidden */ });
  }

  async function streamAsk(question) {
    let resp;
    // Only send a scope key when the reader actually set one. The
    // worker treats an empty `traditions` array the same as an absent
    // one, but omitting it keeps the request body an honest record of
    // what was asked for.
    const scope = currentScope();
    const payload = { question };
    if (scope.traditions.length) payload.traditions = scope.traditions;
    if (scope.author) payload.author = scope.author;
    try {
      // MOAuth.fetch attaches the caller's Ghost member bearer token
      // when one exists (anonymous visitors just get a plain fetch —
      // see admin-auth.js's authedFetch) and refuses the call outright
      // if mo-tfr-library.mo-podcast-feed.workers.dev isn't on the
      // page's mo-trusted-hosts allowlist (see default.hbs).
      resp = await window.MOAuth.fetch(ASK_URL, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(payload),
      });
    } catch (err) {
      // The actual reason (untrusted-destination refusal vs. a real
      // network/CORS failure) was previously discarded here, which
      // made this error unreconstructable from a bug report alone --
      // logged now so DevTools shows what MOAuth.fetch/fetch() itself
      // threw, not just the reader-facing message below.
      console.error("[faith-ask] POST /v1/ask failed before a response was received", err);
      showError("Could not reach the library. Please check your connection and try again.");
      return;
    }

    if (!resp.ok || !resp.body) {
      // 401/403 come from the worker's server-side paid-member gate
      // (requirePaidMember() in tfr-library/worker.js) and already
      // carry a reader-facing `.error` string — surfaced as-is rather
      // than papered over, since "Ask is temporarily unavailable"
      // would wrongly suggest an outage to a visitor who just isn't
      // signed in or isn't a paid member yet.
      //
      // 429 is the spend-cap cooldown (see cooldownResponse() in
      // lib/ask.js) — its `.error` string already names which limit
      // was hit and when it resets ("You've used your 5 questions for
      // today. Resets at midnight UTC." / "Today's shared Ask capacity
      // is used up. Resets at midnight UTC."), so it's shown the same
      // way as any other gate message. The one thing worth doing extra
      // on a cooldown specifically: refresh the meter immediately, so
      // it shows the same 100% the error text just described instead
      // of whatever stale percentage was last fetched.
      let message = "Ask is temporarily unavailable. Please try again shortly.";
      try {
        const j = await resp.json();
        if (j && j.error) message = j.error;
      } catch (_) { /* non-JSON error body — keep the generic message */ }
      showError(message);
      if (resp.status === 429) loadUsage();
      return;
    }

    const reader = resp.body.getReader();
    const decoder = new TextDecoder();
    let buf = "";
    let gotResult = false;

    for (;;) {
      let chunk;
      try {
        chunk = await reader.read();
      } catch (_) {
        break;
      }
      if (chunk.done) break;
      buf += decoder.decode(chunk.value, { stream: true });
      let idx;
      while ((idx = buf.indexOf("\n")) >= 0) {
        const line = buf.slice(0, idx).trim();
        buf = buf.slice(idx + 1);
        if (!line) continue;
        let obj;
        try { obj = JSON.parse(line); } catch (_) { continue; }
        if (obj.type === "progress") {
          setStatus(obj.message || "");
        } else if (obj.type === "result") {
          gotResult = true;
          setStatus("");
          if (errorEl) errorEl.hidden = true;
          headingEl.textContent = obj.question || question;
          renderAnswer(obj.answer || "", obj.citations || []);
          renderFootnotes(obj.citations || []);
          renderGaps(obj.gaps || []);
          resultEl.hidden = false;
          resultEl.scrollIntoView({ behavior: "smooth", block: "start" });
        } else if (obj.type === "error") {
          showError(obj.message);
        }
      }
    }

    if (!gotResult && (!errorEl || errorEl.hidden)) {
      showError("The library stopped answering before finishing. Please try again.");
    }

    // A successful question spent money and (if signed in) counted
    // against the per-member daily cap — refresh the meter so it
    // reflects that, whether or not the answer itself succeeded (a
    // question that errored out after the planner call still spent
    // something — see lib/ask.js's runAsk() finally block).
    loadUsage();
  }

  form.addEventListener("submit", (e) => {
    e.preventDefault();
    const question = (input.value || "").trim();
    if (!question) { input.focus(); return; }

    if (resultEl) resultEl.hidden = true;
    if (errorEl) errorEl.hidden = true;
    if (submitBtn) submitBtn.disabled = true;
    setStatus("Reading the question…");

    streamAsk(question).finally(() => {
      if (submitBtn) submitBtn.disabled = false;
    });
  });

  // Enter (without Shift) submits, same as a single-line search box —
  // routed through the submit button's own click so feature-gate.js's
  // capture-phase listener still gets first refusal for a visitor who
  // isn't a member.
  input.addEventListener("keydown", (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      if (submitBtn) submitBtn.click();
    }
  });

  loadUsage();
})();
