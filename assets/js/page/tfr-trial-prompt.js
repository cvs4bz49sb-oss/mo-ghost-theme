/*
 * The free-account prompt on Scripture and Topics (Ian, 2026-10-24: "just do the dismissible prompt for now and
 * measure how it converts"). It stands in for the hard wall that tfr-use-counter.js was sizing.
 *
 * WHEN. A signed-out visitor who has opened FREE_USES distinct things on a tool (verses on Scripture, topics on
 * Topics, counted by tfr-use-counter.js and heard here as the "mo:tfr-use" event) sees one small card on their 4th
 * use and after. The card is added by this script after the use is counted, never by the server, so the page a
 * crawler or a reader receives is the same with or without it.
 *
 * WHERE. At the end of the tool's content, below what the visitor is reading. It is not a modal: no overlay, no
 * scroll lock, no focus trap, nothing covered, and nothing already in view moves. A polite live region announces it.
 *
 * NEVER. To a signed-in member or subscriber (the counter's "who", from the body's data-member-status). To a
 * crawler or preview bot (user agent). On the first FREE_USES uses. On any page that is not Scripture or Topics.
 * More than MAX_SHOWS times in one browser, ever. Within SNOOZE_DAYS of "Not now".
 *
 * MEASURING. Half of the signed-out visitors (chosen at random on their first use, kept in localStorage) are the
 * control: they are counted like everyone else and never see the card. Events go to Plausible through the same
 * proxied helper the counter uses; no verse, no topic, nothing about the reader.
 *   "TFR Prompt"         props {action, tool, n, variant}
 *       prompt arm:   action = shown | seen | dismissed | cta_click
 *                     (seen = half the card was on screen; it sits low on a long page)
 *       control arm:  action = would_show, once, when the card WOULD have been added
 *   "TFR Prompt Signup"  props {tool, n, variant, source}
 *       the sign-up form opened from the card was accepted in this browser (the magic link was sent).
 *       The member carries the label source:feature-gate:tfr-trial-prompt.
 * Compare unique visitors, not events: a prompt-arm visitor can see the card up to MAX_SHOWS times.
 * How to read it: website/audits/tfr-trial-prompt-experiment.md in the MOCA.
 *
 * STORAGE. localStorage "mo-tfr-prompt:v1" {variant, shownCount, dismissedAt, wouldShow}. It is read defensively
 * and trusted for nothing but this card, so editing it only changes this card.
 *
 * SIGN-UP. The button calls MOFeatureGate.open("tfr-trial-prompt") (feature-gate.js): the dialog and form every
 * other free-account door uses. The feature's name is the signup source label.
 */
(function () {
  "use strict";
  if (window.__moTfrTrialPrompt) return;
  window.__moTfrTrialPrompt = true;

  const FREE_USES = 3; // the card appears on use FREE_USES + 1
  const SNOOZE_DAYS = 7; // after "Not now"
  const MAX_SHOWS = 3; // per browser, ever
  const KEY = "mo-tfr-prompt:v1";
  const FEATURE = "tfr-trial-prompt"; // a key of FEATURES in feature-gate.js, and the signup source label
  const COPY = {
    text: "A free account opens Ask, Power Search, Compare, Commentary Decks, the Lexicon, the Notebook and Bookmarks.",
    cta: "Create a free account",
    dismiss: "Not now",
  };
  const BOTS = /bot|crawl|spider|slurp|headless|lighthouse|pagespeed|gtmetrix|facebookexternalhit|embedly|preview|archive\.org|ia_archiver|curl\/|wget|python-requests|httpclient|go-http|okhttp|ahrefs|semrush|mj12|yandex|baidu|duckduck|applebot|monitor|uptime|pingdom/i;

  const DAY = 86400000;
  let state = null; // the last record; the fallback when storage cannot be read or written

  // Read fresh each time: another tab may have dismissed the card since this page loaded.
  function load() {
    let d = null;
    try {
      const raw = JSON.parse(localStorage.getItem(KEY) || "null");
      if (raw && typeof raw === "object" && !Array.isArray(raw)) d = raw;
    } catch (_) { /* unreadable or blocked */ }
    if (!d) return state || { variant: "", shownCount: 0, dismissedAt: 0, wouldShow: 0 };
    const num = (v) => (typeof v === "number" && isFinite(v) && v >= 0 ? v : 0);
    return {
      variant: d.variant === "prompt" || d.variant === "control" ? d.variant : "",
      shownCount: Math.min(num(d.shownCount), 99),
      dismissedAt: num(d.dismissedAt),
      wouldShow: d.wouldShow ? 1 : 0,
    };
  }
  function update(change) {
    state = load();
    change(state);
    try { localStorage.setItem(KEY, JSON.stringify(state)); } catch (_) { /* private mode: this page view only */ }
    return state;
  }

  // Ghost's proxied Plausible build replaces window.plausible without replaying the queue (see article-plausible.js),
  // so anything fired before 'load' waits for it, as in tfr-use-counter.js.
  let loaded = document.readyState === "complete";
  const pending = [];
  function fire(name, props) {
    const go = () => { if (typeof window.plausible === "function") window.plausible(name, { props }); };
    if (loaded) go(); else pending.push(go);
  }
  if (!loaded) window.addEventListener("load", () => { loaded = true; pending.splice(0).forEach((f) => f()); });

  function el(tag, cls, text) {
    const e = document.createElement(tag);
    if (cls) e.className = cls;
    if (text) e.textContent = text;
    return e;
  }

  function onUse(detail) {
    if (!detail || detail.who !== "anonymous") return;
    if (BOTS.test(navigator.userAgent || "")) return;
    const tool = detail.tool === "scripture" || detail.tool === "topics" ? detail.tool : "";
    const n = Math.floor(Number(detail.n));
    if (!tool || !(n >= 1)) return;

    const rec = update((r) => { if (!r.variant) r.variant = Math.random() < 0.5 ? "prompt" : "control"; });
    if (n <= FREE_USES) return;

    if (rec.variant === "control") {
      if (rec.wouldShow) return;
      update((r) => { r.wouldShow = 1; });
      fire("TFR Prompt", { action: "would_show", tool, n: String(n), variant: "control" });
      return;
    }

    if (rec.shownCount >= MAX_SHOWS) return;
    if (rec.dismissedAt && Date.now() - rec.dismissedAt < SNOOZE_DAYS * DAY) return;
    if (document.querySelector(".tfr-prompt-host")) return; // one card per page view
    show(tool, n);
  }

  function show(tool, n) {
    const main = document.querySelector("main");
    if (!main) return;
    const props = (action) => ({ action, tool, n: String(n), variant: "prompt" });

    // The live region goes in empty and gets its card a moment later: a screen reader announces a change inside a
    // region it already knows, not a region that arrives with its text.
    const host = el("div", "tfr-prompt-host container");
    host.setAttribute("aria-live", "polite");
    const after = main.querySelector(".sd-attribution");
    main.insertBefore(host, after && after.parentNode === main ? after : null);

    setTimeout(() => {
      if (!host.isConnected) return;
      const card = el("section", "tfr-prompt");
      card.setAttribute("aria-label", "Free account");
      const text = el("p", "tfr-prompt-text", COPY.text);
      const actions = el("div", "tfr-prompt-actions");
      const cta = el("button", "btn tfr-prompt-cta", COPY.cta);
      cta.type = "button";
      const no = el("button", "tfr-prompt-dismiss", COPY.dismiss);
      no.type = "button";
      actions.append(cta, no);
      card.append(text, actions);
      host.appendChild(card);

      update((r) => { r.shownCount += 1; });
      fire("TFR Prompt", props("shown"));

      if (typeof IntersectionObserver === "function") {
        const io = new IntersectionObserver((entries) => {
          if (!entries.some((e) => e.isIntersecting)) return;
          io.disconnect();
          fire("TFR Prompt", props("seen"));
        }, { threshold: 0.5 });
        io.observe(card);
      }

      no.addEventListener("click", () => {
        const hadFocus = card.contains(document.activeElement);
        update((r) => { r.dismissedAt = Date.now(); });
        fire("TFR Prompt", props("dismissed"));
        host.remove();
        if (hadFocus) {
          const h = document.querySelector("main h1");
          if (h) { h.setAttribute("tabindex", "-1"); h.focus({ preventScroll: true }); }
        }
      });

      cta.addEventListener("click", () => {
        fire("TFR Prompt", props("cta_click"));
        const gate = window.MOFeatureGate;
        if (gate && typeof gate.open === "function") {
          if (gate.open(FEATURE, cta)) watchSignup(tool, n);
        } else {
          window.location.hash = "/portal/signup"; // site.min.js did not load: Ghost's own sign-up
        }
      });
    }, 150);
  }

  // inline-signup.js swaps the form for .inline-signup-success once Ghost has accepted the address. Watch for that
  // swap inside the dialog this card opened, so a sign-up is counted only when it began here.
  function watchSignup(tool, n) {
    const form = document.querySelector(".feature-gate-modal [data-inline-signup]");
    const panel = form && form.parentNode;
    if (!panel) return;
    const mo = new MutationObserver(() => {
      if (!panel.isConnected) { mo.disconnect(); return; }
      if (form.isConnected || !panel.querySelector(".inline-signup-success")) return;
      mo.disconnect();
      fire("TFR Prompt Signup", { tool, n: String(n), variant: "prompt", source: FEATURE });
    });
    mo.observe(document.body, { childList: true, subtree: true });
    setTimeout(() => mo.disconnect(), 30 * 60 * 1000);
  }

  document.addEventListener("mo:tfr-use", (e) => onUse(e.detail));
})();
