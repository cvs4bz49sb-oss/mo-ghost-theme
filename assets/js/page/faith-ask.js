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
 * bubble. See custom-faith-ask.hbs for the markup this fills in.
 *
 * Access: the "Ask the library" button carries data-feature-gate="ask"
 * (see assets/js/feature-gate.js, loaded before this file) — a free
 * or anonymous visitor's click is intercepted there and never reaches
 * the submit handler below. That is a CLIENT-side gate only. The
 * Worker's own /v1/ask endpoint does not itself check Ghost member
 * status server-side (verifying a Ghost member session from a Worker
 * with no existing auth integration for this corpus was out of scope
 * for this build) — a determined caller could hit the endpoint
 * directly. Flagged here and in the build report; closing it is
 * unfinished work, not a design decision.
 *
 * Loaded as a page-template script, so per the theme's own script-
 * order rule it runs before site.min.js and must not depend on any
 * bundle global — everything this file needs, it defines itself.
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

  // Same worker every other faith-*.js file in this theme talks to
  // (see assets/js/faith-corpora.js's own BLOB/LIBRARY constant) —
  // each file defines its own copy of this base URL rather than
  // sharing a global, matching that existing convention.
  const ASK_URL = "https://mo-tfr-library.mo-podcast-feed.workers.dev/v1/ask";

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
  function renderAnswer(text, citations) {
    const citByN = new Map((citations || []).map((c) => [c.n, c]));
    const escaped = escapeHtml(text);
    const paras = escaped.split(/\n{2,}/).map((p) => p.trim()).filter(Boolean);
    const html = paras.map((p) => {
      const withNotes = p.replace(/\[(\d+)\]/g, (whole, numStr) => {
        const n = parseInt(numStr, 10);
        if (!citByN.has(n)) return ""; // a dangling marker never renders as text or markup
        return `<sup class="ask-footnote-ref"><a href="#ask-fn-${n}">${n}</a></sup>`;
      });
      return `<p>${withNotes}</p>`;
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

  async function streamAsk(question) {
    let resp;
    try {
      resp = await fetch(ASK_URL, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ question }),
      });
    } catch (_) {
      showError("Could not reach the library. Please check your connection and try again.");
      return;
    }

    if (!resp.ok || !resp.body) {
      let message = "Ask is temporarily unavailable. Please try again shortly.";
      try {
        const j = await resp.json();
        if (j && j.error) message = j.error;
      } catch (_) { /* non-JSON error body — keep the generic message */ }
      showError(message);
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
})();
