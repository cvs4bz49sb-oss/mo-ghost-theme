/*
 * Form counter: how often each form on the site is seen, started,
 * submitted and completed, by day, so a conversion rate can be taken.
 *
 * Four events per form, each counted at most once per page view:
 *   view     half the form was on screen (or it filled half the screen)
 *   start    the visitor focused or typed in it
 *   submit   they pressed its submit button
 *   success  its handler reported that the submission went through
 * A later event implies the earlier ones, so a success on a form that
 * was never seen (submitted with Enter before the observer fired) also
 * counts the view, start and submit it skipped. Rates are therefore
 * monotone: successes <= submits <= starts <= views.
 *
 * What it sends is one row's address and an event: the form's kind
 * (FORMS below), its placement (the data-source a signup form already
 * carries, the campaign a newsletter form carries), the page key
 * (page-key.js) and the event. No identifier of any kind, not even the
 * heatmap's tab id. The worker adds one to a daily counter
 * (mo-admin POST /forms/track -> D1 form_daily, Central-time days), the
 * same pattern as the slide-in and year-end counters.
 *
 * Do Not Track and Global Privacy Control are honored, as on the
 * heatmap. Because views and completions are counted from the same
 * browsers, the rate between them is unaffected; the absolute number of
 * completions lives in each form's own table (submissions, welcome_survey,
 * writers_meetings_registrations, ...) and in Ghost.
 *
 * Success is reported by the handlers themselves, one line each:
 *   if (window.MOForms) window.MOForms.done(rootOrFormElement);
 * An element inside a tracked form works too; so does a form this file
 * has not seen yet, as long as it matches FORMS.
 */
(function () {
  "use strict";

  try {
    if (new URLSearchParams(window.location.search).get("mo-hm-preview") === "1") return;
  } catch (_) { /* no preview param, carry on */ }

  const noop = { done() {}, submit() {} };
  window.MOForms = noop;

  if (
    navigator.doNotTrack === "1" ||
    window.doNotTrack === "1" ||
    navigator.msDoNotTrack === "1" ||
    navigator.globalPrivacyControl === true
  ) return;

  const { body } = document;
  if (!body) return;
  const WORKER = (body.getAttribute("data-admin-worker-url") || "").replace(/\/+$/, "");
  if (!WORKER) return;
  const PAGE = typeof window.MOPageKey === "function" ? window.MOPageKey() : null;
  if (!PAGE) return;

  const EVENTS = ["view", "start", "submit", "success"];

  function slug(text) {
    return String(text || "")
      .toLowerCase()
      .replace(/[^a-z0-9-]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 40);
  }

  // Signup blocks driven by inline-signup.js (and the ebook card, which
  // ebook-landing.js drives). Kind from what the block signs you up for;
  // placement from its data-source, which already names where it sits.
  function inlineSignup(el) {
    let kind = "signup";
    const newsletter = el.getAttribute("data-newsletter");
    if (el.hasAttribute("data-ebook-signup")) kind = "ebook-signup";
    else if (el.hasAttribute("data-register-endpoint")) kind = "event-register";
    else if (el.hasAttribute("data-account-signup")) kind = "tfr-account";
    else if (newsletter === "weekly-digest") kind = "digest-signup";
    else if (newsletter === "daily-liturgy") kind = "liturgy-signup";
    return { kind, placement: el.getAttribute("data-source") };
  }

  const SITE_FORMS = ["contact", "submissions", "sponsorship", "newsletter", "writers-meetings"];
  function siteForm(el) {
    const kind = el.getAttribute("data-site-form");
    if (SITE_FORMS.indexOf(kind) < 0) return null;
    return { kind, placement: el.getAttribute("data-campaign") };
  }

  // [selector, kind or kind function]. Mirror of FORM_KINDS in
  // workers/admin/lib/form-stats.js: a kind the worker does not list is
  // dropped there.
  const FORMS = [
    ["[data-form-track]", (el) => {
      const [kind, placement] = String(el.getAttribute("data-form-track") || "").split(":");
      return { kind, placement };
    }],
    ["form[data-site-form]", siteForm],
    ["[data-inline-signup]", inlineSignup],
    ["form[data-welcome]", () => ({ kind: "welcome-survey" })],
    ["form[data-gift-checkout]", () => ({ kind: "gift-checkout" })],
    ["form#gift-form", () => ({ kind: "lifetime-gift" })],
    ["form[data-lifetime-gift-form]", () => ({ kind: "lifetime-gift", placement: "dashboard" })],
    ["form[data-student-form]", () => ({ kind: "student" })],
    ["form#group-form", () => ({ kind: "group-purchase" })],
    ["form#institution-checkout-form", () => ({ kind: "institution-checkout" })],
    ["form[data-join-form]", () => ({ kind: "institution-join" })],
  ];
  const ANY = FORMS.map((f) => f[0]).join(", ");

  const state = new WeakMap();

  function identify(el) {
    for (const [sel, fn] of FORMS) {
      if (!el.matches(sel)) continue;
      const id = fn(el);
      if (id && id.kind) return { kind: slug(id.kind), placement: slug(id.placement) };
    }
    return null;
  }

  // The outermost tracked block an element belongs to, registered on
  // first sight. Outermost, because a signup block can hold a <form>
  // that also matches, and one form is one row.
  function rootOf(el) {
    if (!el || el.nodeType !== 1) return null;
    let found = null;
    let node = el.closest ? el.closest(ANY) : null;
    while (node) {
      found = node;
      node = node.parentElement ? node.parentElement.closest(ANY) : null;
    }
    if (!found && el.matches && el.matches(ANY)) found = el;
    if (!found) return null;
    if (!state.has(found)) {
      const id = identify(found);
      if (!id) return null;
      state.set(found, { id, sent: Object.create(null) });
    }
    return found;
  }

  function beacon(id, event) {
    const json = JSON.stringify({ v: 1, k: id.kind, p: id.placement, pg: PAGE, e: event });
    const url = `${WORKER}/forms/track`;
    try {
      const blob = new Blob([json], { type: "text/plain;charset=UTF-8" });
      if (navigator.sendBeacon && navigator.sendBeacon(url, blob)) return;
    } catch (_) { /* fall through */ }
    try {
      fetch(url, {
        method: "POST",
        body: json,
        keepalive: true,
        mode: "cors",
        credentials: "omit",
        headers: { "content-type": "text/plain;charset=UTF-8" },
      }).catch(() => {});
    } catch (_) { /* telemetry, never the product */ }
  }

  function record(root, event) {
    const s = root && state.get(root);
    if (!s) return;
    const upto = EVENTS.indexOf(event);
    for (let i = 0; i <= upto; i += 1) {
      const e = EVENTS[i];
      if (s.sent[e]) continue;
      s.sent[e] = 1;
      beacon(s.id, e);
    }
  }

  // ── view ──────────────────────────────────────────────────────────
  let observer = null;
  function watch() {
    if (typeof IntersectionObserver !== "function") return;
    if (!observer) {
      observer = new IntersectionObserver(
        (entries) => {
          entries.forEach((e) => {
            if (!e.isIntersecting) return;
            const tallEnough = e.intersectionRect.height >= window.innerHeight * 0.5;
            if (e.intersectionRatio >= 0.5 || tallEnough) {
              record(e.target, "view");
              observer.unobserve(e.target);
            }
          });
        },
        { threshold: [0, 0.25, 0.5, 0.75] }
      );
    }
    document.querySelectorAll(ANY).forEach((el) => {
      const root = rootOf(el);
      if (!root || root !== el) return;
      const s = state.get(root);
      if (s.watched) return;
      s.watched = true;
      observer.observe(root);
    });
  }

  // ── start / submit ────────────────────────────────────────────────
  function onFirstTouch(event) {
    const t = event.target;
    if (!t || !t.matches || !t.matches("input, textarea, select")) return;
    // A form drawn after load (a modal, the ebook card) is observed from
    // here on, so its view is counted on the same terms as the rest.
    if (event.type === "focusin") watch();
    record(rootOf(t), "start");
  }
  document.addEventListener("focusin", onFirstTouch, true);
  document.addEventListener("input", onFirstTouch, true);

  document.addEventListener("submit", (event) => { record(rootOf(event.target), "submit"); }, true);
  document.addEventListener(
    "click",
    (event) => {
      const t = event.target;
      const btn = t && t.closest ? t.closest("[data-signup-submit], button[type='submit'], input[type='submit']") : null;
      if (btn) record(rootOf(btn), "submit");
    },
    true
  );

  window.MOForms = {
    done(el) { record(rootOf(el), "success"); },
    submit(el) { record(rootOf(el), "submit"); },
  };

  // site.min.js is plain concatenation: a throw here would stop every
  // file after this one.
  try { watch(); } catch (_) { /* telemetry only */ }
  window.addEventListener("load", () => {
    try { watch(); } catch (_) { /* telemetry only */ }
  }, { once: true });
})();
