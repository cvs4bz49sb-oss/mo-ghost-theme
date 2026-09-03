/*
 * The Faith Received — Glossary.
 *
 * mo-tfr's v1/glossary2/ is 296 gzipped buckets (~34 MB total), one per
 * lowercased first-two-character prefix of the term ("aa.json.gz" for
 * every term starting "aa", "1p.json.gz" for terms like "1 Peter" once
 * its space is stripped). Each bucket is a map of term -> an array of
 * { d: definition, a: author, s: work slug, p: page }, one row per
 * work that defines the term. There is no index of which terms exist
 * without downloading a bucket, so this page has exactly two ways in,
 * both bucket-scoped rather than whole-library:
 *
 *   Search   — type a term, fetch the ONE bucket it would fall in,
 *              filter client-side. Cheap: one file, ~40-380 KB gzipped.
 *   Browse   — pick a letter, fetch every bucket starting with that
 *              letter in parallel (up to 26 files, a few MB gzipped),
 *              list the terms it holds. Heavier, so it only runs on an
 *              explicit click, and the term list renders 50 at a time.
 *
 * BUCKETS is the live bucket listing as of 2026-09-03 (296 files) —
 * there is no list endpoint to ask at runtime, so this has to be kept
 * in sync by hand if the bucket layout changes. Look for BUCKETS if a
 * click on a letter comes back with fewer terms than the library
 * actually has for it.
 */
(function () {
  "use strict";

  const root = document.querySelector("[data-faith-glossary]");
  if (!root) return;

  const LIBRARY = "https://mo-tfr-library.mo-podcast-feed.workers.dev";
  const GLOSSARY_BASE = `${LIBRARY}/v1/glossary2`;

  const BUCKETS = {
    "#": ["12", "14", "1p", "24", "2t"],
    a: ["aa", "ab", "ac", "ad", "ae", "af", "ag", "ah", "ai", "aj", "ak", "al", "am", "an", "ao", "ap", "aq", "ar", "as", "at", "au", "av", "aw", "ax", "ay", "az"],
    b: ["ba", "bd", "be", "bi", "bl", "bo", "br", "bu", "by"],
    c: ["ca", "ce", "ch", "ci", "cl", "cn", "co", "cr", "ct", "cu", "cy"],
    d: ["da", "de", "di", "do", "dr", "du", "dw", "dy"],
    e: ["ea", "eb", "ec", "ed", "ef", "eg", "eh", "ei", "ej", "ek", "el", "em", "en", "eo", "ep", "eq", "er", "es", "et", "eu", "ev", "ex", "ey", "ez"],
    f: ["fa", "fe", "ff", "fi", "fl", "fn", "fo", "fr", "fu"],
    g: ["ga", "ge", "gh", "gi", "gl", "gn", "go", "gr", "gu", "gw", "gy"],
    h: ["ha", "he", "hi", "hn", "ho", "hr", "hu", "hy"],
    i: ["ia", "ib", "ic", "id", "ie", "if", "ig", "ih", "ii", "ij", "ik", "il", "im", "in", "io", "ip", "ir", "is", "it", "iu", "iv", "iw", "ix", "iy"],
    j: ["ja", "je", "jo", "ju"],
    k: ["ka", "ke", "kh", "ki", "kl", "kn", "ko", "kr", "kt", "ku", "ky"],
    l: ["la", "le", "li", "lo", "lu", "lx", "ly"],
    m: ["ma", "me", "mi", "mn", "mo", "ms", "mu", "my"],
    n: ["na", "ne", "ni", "no", "nu", "nv", "ny"],
    o: ["oa", "ob", "oc", "od", "oe", "of", "og", "oh", "oi", "ol", "om", "on", "oo", "op", "or", "os", "ot", "ou", "ov", "ow", "ox", "oy", "oz"],
    p: ["pa", "pe", "ph", "pi", "pl", "pn", "po", "pr", "ps", "pt", "pu", "py"],
    q: ["qa", "qe", "qo", "qu"],
    r: ["ra", "re", "rh", "ri", "ro", "ru"],
    s: ["sa", "sc", "se", "sh", "si", "sk", "sl", "sm", "sn", "so", "sp", "sq", "st", "su", "sw", "sy"],
    t: ["ta", "te", "th", "ti", "tm", "tn", "to", "tr", "ts", "tu", "tw", "ty", "tz"],
    u: ["ub", "uc", "ud", "ug", "ul", "um", "un", "up", "ur", "us", "ut", "uv", "ux", "uz"],
    v: ["va", "ve", "vi", "vl", "vo", "vr", "vs", "vu"],
    w: ["wa", "we", "wh", "wi", "wo", "wr"],
    x: ["xa", "xe", "xi", "xo", "xx", "xy"],
    y: ["ya", "yc", "ye", "yg", "yh", "yi", "ym", "yo", "yp", "yr"],
    z: ["za", "ze", "zi", "zm", "zo", "zu"],
  };

  const input = document.querySelector("[data-faith-glossary-input]");
  const form = document.querySelector("[data-faith-glossary-form]");
  const statusEl = root.querySelector("[data-faith-glossary-status]");
  const termsEl = root.querySelector("[data-faith-glossary-terms]");
  const moreBtn = root.querySelector("[data-faith-glossary-more]");
  const entriesEl = root.querySelector("[data-faith-glossary-entries]");
  const emptyEl = root.querySelector("[data-faith-glossary-empty]");
  const letterButtons = root.querySelectorAll("[data-faith-glossary-letter]");

  const bucketCache = new Map(); // bucket key -> Promise<Map<term, rows>>

  function escapeHtml(s) {
    return String(s == null ? "" : s).replace(/[&<>"']/g, (c) => ({
      "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;",
    }[c]));
  }

  function setStatus(text, isError) {
    statusEl.textContent = text || "";
    statusEl.classList.toggle("is-error", !!isError);
  }

  // Same gzip handling as faith-text.js / faith-reader.js: the bucket
  // is served as raw gzip bytes (no Content-Encoding), so this decodes
  // it itself when the browser supports DecompressionStream and falls
  // back to fetch()'s own inflation when the host sets the header.
  async function gunzip(response) {
    if (typeof window.DecompressionStream === "function") {
      const blob = await response.blob();
      const stream = blob.stream().pipeThrough(new window.DecompressionStream("gzip"));
      return JSON.parse(await new Response(stream).text());
    }
    return response.json();
  }

  function loadBucket(key) {
    if (bucketCache.has(key)) return bucketCache.get(key);
    const p = fetch(`${GLOSSARY_BASE}/${encodeURIComponent(key)}.json.gz`)
      .then((r) => {
        if (!r.ok) throw new Error(String(r.status));
        return gunzip(r);
      })
      .then((data) => new Map(Object.entries(data || {})))
      .catch(() => new Map());
    bucketCache.set(key, p);
    return p;
  }

  // First two normalized (lowercase, alphanumeric-only) characters of
  // a term decide its bucket — matches how the buckets were built, so
  // "1 Peter" -> "1peter" -> "1p", "De Deo" -> "dedeo" -> "de".
  function normalize(term) {
    return String(term || "").toLowerCase().replace(/[^a-z0-9]/g, "");
  }

  function readerUrl(work, page) {
    let url = `/the-faith-received/reader/?w=${encodeURIComponent(work)}`;
    if (page != null && page !== "") url += `&p=${encodeURIComponent(page)}`;
    return url;
  }

  function humanizeSlug(s) {
    return String(s || "").replace(/-/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
  }

  function renderEntry(term, rows) {
    const defs = (rows || []).map((r) => {
      const cite = r.s
        ? `<a class="faith-glossary-cite" href="${readerUrl(r.s, r.p)}">${escapeHtml(r.a || humanizeSlug(r.s))}${r.p != null ? `, p. ${escapeHtml(String(r.p))}` : ""}</a>`
        : `<span class="faith-glossary-cite-plain">${escapeHtml(r.a || "")}</span>`;
      return `
        <li class="faith-glossary-def">
          <p class="faith-glossary-def-text">${escapeHtml(r.d || "")}</p>
          <p class="faith-glossary-def-source">${cite}</p>
        </li>`;
    }).join("");
    return `
      <li class="faith-glossary-entry">
        <h3 class="faith-glossary-term">${escapeHtml(term)}</h3>
        <ol class="faith-glossary-def-list">${defs}</ol>
      </li>`;
  }

  function showEntries(matches) {
    termsEl.hidden = true;
    moreBtn.hidden = true;
    if (!matches.length) {
      entriesEl.innerHTML = "";
      emptyEl.hidden = false;
      return;
    }
    emptyEl.hidden = true;
    entriesEl.innerHTML = matches.map(([term, rows]) => renderEntry(term, rows)).join("\n");
  }

  // ── Search: type a term, fetch its one bucket ──────────────────
  let searchToken = 0;
  function runSearch(raw) {
    const q = normalize(raw);
    if (q.length < 2) {
      setStatus("");
      entriesEl.innerHTML = "";
      emptyEl.hidden = true;
      termsEl.hidden = true;
      moreBtn.hidden = true;
      return;
    }
    const token = ++searchToken;
    const key = q.slice(0, 2);
    setStatus(`Looking up “${raw.trim()}”…`);
    loadBucket(key).then((map) => {
      if (token !== searchToken) return; // a newer search superseded this one
      const matches = [];
      map.forEach((rows, term) => {
        if (normalize(term).indexOf(q) === 0 || normalize(term).indexOf(q) >= 0) {
          matches.push([term, rows]);
        }
      });
      // Exact/prefix matches first, then whatever else contained the
      // query, each group alphabetical.
      matches.sort((x, y) => {
        const nx = normalize(x[0]).indexOf(q) === 0 ? 0 : 1;
        const ny = normalize(y[0]).indexOf(q) === 0 ? 0 : 1;
        if (nx !== ny) return nx - ny;
        return x[0].localeCompare(y[0]);
      });
      setStatus(matches.length
        ? `${matches.length.toLocaleString()} term${matches.length === 1 ? "" : "s"}`
        : "");
      showEntries(matches.slice(0, 40));
    });
  }

  let debounceTimer = null;
  if (input) {
    input.addEventListener("input", () => {
      window.clearTimeout(debounceTimer);
      debounceTimer = window.setTimeout(() => runSearch(input.value), 250);
    });
  }
  if (form) {
    form.addEventListener("submit", (e) => {
      e.preventDefault();
      window.clearTimeout(debounceTimer);
      runSearch(input ? input.value : "");
    });
  }

  // ── Browse: pick a letter, list its terms 50 at a time ──────────
  let browseTerms = []; // [[term, rows], ...] sorted
  let browseShown = 0;
  const PAGE = 50;

  function renderTermButtons() {
    const next = browseTerms.slice(browseShown, browseShown + PAGE);
    const html = next.map(([term]) =>
      `<button type="button" class="faith-glossary-term-btn" data-faith-glossary-term="${escapeHtml(term)}">${escapeHtml(term)}</button>`
    ).join("");
    termsEl.insertAdjacentHTML("beforeend", html);
    browseShown += next.length;
    const left = browseTerms.length - browseShown;
    moreBtn.hidden = left <= 0;
    if (left > 0) moreBtn.textContent = `Show ${Math.min(left, PAGE)} more`;
  }

  function openLetter(letter) {
    const buckets = BUCKETS[letter];
    if (!buckets) return;
    entriesEl.innerHTML = "";
    emptyEl.hidden = true;
    termsEl.hidden = false;
    termsEl.innerHTML = "";
    moreBtn.hidden = true;
    browseTerms = [];
    browseShown = 0;
    setStatus(`Loading “${letter === "#" ? "0–9" : letter.toUpperCase()}”…`);

    Promise.all(buckets.map((key) => loadBucket(key))).then((maps) => {
      const all = [];
      maps.forEach((map) => map.forEach((rows, term) => all.push([term, rows])));
      all.sort((x, y) => x[0].localeCompare(y[0]));
      browseTerms = all;
      setStatus(`${all.length.toLocaleString()} term${all.length === 1 ? "" : "s"}`);
      if (!all.length) {
        emptyEl.hidden = false;
        termsEl.hidden = true;
        return;
      }
      renderTermButtons();
    });
  }

  letterButtons.forEach((btn) => {
    btn.addEventListener("click", () => {
      letterButtons.forEach((b) => b.classList.remove("is-active"));
      btn.classList.add("is-active");
      if (input) input.value = "";
      openLetter(btn.getAttribute("data-faith-glossary-letter"));
    });
  });

  if (moreBtn) moreBtn.addEventListener("click", renderTermButtons);

  root.addEventListener("click", (e) => {
    const termBtn = e.target.closest("[data-faith-glossary-term]");
    if (!termBtn) return;
    const term = termBtn.getAttribute("data-faith-glossary-term");
    const rows = browseTerms.find(([t]) => t === term);
    if (rows) showEntries([rows]);
  });

  // A term or ?q= in the URL opens straight to it, so a glossary link
  // from elsewhere in the reader can land a visitor on the definition
  // rather than the empty page.
  const qs = new URLSearchParams(window.location.search).get("q");
  if (qs && input) {
    input.value = qs;
    runSearch(qs);
  }
}());
