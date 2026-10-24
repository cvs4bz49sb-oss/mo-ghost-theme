/*
 * The use counter on Scripture and Topics (Ian, 2026-10-22: measure before deciding whether to gate them after a
 * trial of 3 to 5 uses). Nothing on the page changes. It counts, per browser, the distinct things a reader opens and
 * tells Plausible when the count reaches 1 through 10, so "how many visitors reach use 4" is the number of visitors
 * with n = 4.
 *
 *   Scripture: a use is a verse opened (the sidebar of what the library says about it). Reading a chapter is not.
 *   Topics:    a use is a topic opened (?t=<locus>). Switching tabs inside the same topic is not.
 *
 * Opening the same verse or topic again does not count twice. The count lives in localStorage and survives visits, as
 * a trial gate's would. Only the tool, the count and whether the reader is signed in are sent: no verse, no topic,
 * nothing about the reader. Event "TFR Tool Use", props {tool, n, who}.
 *
 * Ghost's proxied Plausible build replaces window.plausible without replaying the queue (see article-plausible.js), so
 * anything counted before 'load' waits for it.
 *
 * The count also reaches tfr-trial-prompt.js (2026-10-24, the dismissible free-account prompt that came of this
 * measurement): each new use is announced as a "mo:tfr-use" event on document with {tool, n, who}, for every n, not
 * just the first MAX_SENT. How a use is counted, and the Plausible event above, are unchanged. The prompt script loads
 * before this one so it hears the use a deep link counts at start-up.
 */
(function () {
  "use strict";
  if (window.__moTfrUseCounter) return;
  window.__moTfrUseCounter = true;

  const path = location.pathname;
  const tool = /^\/the-faith-received\/scripture\/?$/.test(path) ? "scripture"
    : /^\/the-faith-received\/topics\/?$/.test(path) ? "topics" : "";
  if (!tool) return;

  const KEY = "mo-tfr-uses:v1";
  const MAX_SEEN = 40; // enough to dedupe; the count itself keeps going
  const MAX_SENT = 10;
  const status = (document.body.getAttribute("data-member-status") || "").toLowerCase();
  const who = status === "paid" || status === "comped" || status === "gift" ? "member" : status === "free" ? "subscriber" : "anonymous";

  function load() {
    try {
      const d = JSON.parse(localStorage.getItem(KEY) || "{}");
      return d && typeof d === "object" && !Array.isArray(d) ? d : {};
    } catch (_) { return {}; }
  }
  function save(d) {
    try { localStorage.setItem(KEY, JSON.stringify(d)); } catch (_) { /* private mode: count nothing */ }
  }

  let loaded = document.readyState === "complete";
  const pending = [];
  function send(n) {
    const fire = () => { if (typeof window.plausible === "function") window.plausible("TFR Tool Use", { props: { tool, n: String(n), who } }); };
    if (loaded) fire(); else pending.push(fire);
  }
  if (!loaded) window.addEventListener("load", () => { loaded = true; pending.splice(0).forEach((f) => f()); });

  function use(id) {
    if (!id) return;
    const d = load();
    const t = d[tool] && typeof d[tool] === "object" ? d[tool] : { n: 0, seen: [] };
    if (!Array.isArray(t.seen)) t.seen = [];
    if (t.seen.includes(id)) return;
    t.seen.push(id);
    if (t.seen.length > MAX_SEEN) t.seen = t.seen.slice(-MAX_SEEN);
    t.n = (Number(t.n) || 0) + 1;
    d[tool] = t;
    save(d);
    try { document.dispatchEvent(new CustomEvent("mo:tfr-use", { detail: { tool, n: t.n, who } })); } catch (_) { /* nothing listens */ }
    if (t.n <= MAX_SENT) send(t.n);
  }

  if (tool === "scripture") {
    // ?ref=<book>.<c>.<v>: three parts is a verse. scripture-dev.js writes the URL before it announces sd:verse.
    const verseRef = () => {
      const ref = (new URLSearchParams(location.search).get("ref") || "").toLowerCase();
      return ref.split(".").length === 3 ? ref : "";
    };
    // A deep link counts once scripture-dev.js has opened it (the address is then canonical), not as typed:
    // ?ref=rom.5.12 becomes romans.5.12, and a ref with no such verse never opens.
    if (document.querySelector(".sd-text .bible-verse.is-active")) use(verseRef());
    window.addEventListener("sd:verse", (e) => { if (e.detail && e.detail.v) use(verseRef()); });
  } else {
    // topics-dev.js moves between topics with pushState and has no event of its own, so watch the address.
    const topic = () => (new URLSearchParams(location.search).get("t") || "").toLowerCase();
    let last = "";
    const check = () => { const t = topic(); if (t !== last) { last = t; use(t); } };
    check();
    window.addEventListener("popstate", check);
    document.addEventListener("click", () => { setTimeout(check, 0); setTimeout(check, 400); }, true);
  }
})();
