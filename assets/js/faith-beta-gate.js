/*
 * The Faith Received beta gate — the signed-in half.
 *
 * Read partials/faith-received/_beta-gate.hbs first. That file carries
 * the whole contract; this one implements clause 4 of it.
 *
 * WHAT THIS FILE DOES NOT DO, and why that matters: it does not hide
 * anything and it does not reveal anything. The gate's visibility is
 * decided before this script exists — either server-side by a
 * Handlebars {{#if @member}} (the markup is never sent) or by the
 * [data-tfr-gate] rules in assets/css/faith-received.css, which key off
 * body[data-member-status] and arrive in a render-blocking <link> in
 * <head>. Both are correct at first paint. A JS reveal would put the
 * tools on screen one frame late for every member and is exactly the
 * flash the CSS exists to avoid, so there is deliberately no reveal
 * path here to "fix" later.
 *
 * WHAT IT DOES: claims the TFR and TFR-Beta Kit tags for the member who
 * is looking at the page. One POST to mo-kit's /tfr-beta, carrying the
 * member's own Ghost identity JWT (window.MOAuth.fetch attaches it; the
 * kit worker host is in default.hbs's mo-trusted-hosts meta, which is
 * what makes that attachment legal). The endpoint takes no email —
 * mo-kit reads the identity off the verified token, so this cannot be
 * used to tag somebody else.
 *
 * WHY THE TAGS ARE CLAIMED HERE RATHER THAN AT SIGNUP. Two reasons,
 * both written out in the partial's header: Ghost's sendMagicLink
 * ignores `labels` for an address that already exists, so a signup form
 * cannot reliably write them; and Ian chose the emailed magic link over
 * silent member creation precisely so the address is confirmed before
 * anything lands in Kit. A member reading this page has clicked the
 * link. That is the confirmation.
 *
 * It follows that this also catches people who never touched the gate
 * box — an existing member who simply opened the research page. That is
 * intended. TFR-Beta is "has access to the tools during the beta", and
 * every signed-in member does.
 *
 * IT ALSO COUNTS USE, one day at a time. Once per Central-time day it
 * sends { type: "tfr_used" } to mo-kit's /event, the same signed-in
 * endpoint the dashboard counter uses. mo-kit turns that into the Kit
 * fields TFR: 1. Last Used through TFR: 4. Days Used (Lifetime), so an
 * email can go only to readers who used the tools recently. The day
 * marker below is a politeness cache like the claim marker; mo-kit holds
 * its own once-a-day key and counts the day on Central time whatever
 * this browser's clock says.
 *
 * MOAuth ships in boot.min.js in <head>, so it is already on the page
 * by the time any page-bottom script runs (page scripts run BEFORE
 * site.min.js; only head/boot globals are safe to depend on, which
 * MOAuth is). Everything here is still written defensively: a missing
 * MOAuth, a missing worker URL or a failed request all end as a silent
 * return. Nothing a reader can see depends on this call succeeding.
 */
(function () {
  // Signed out: the gate box is what is on screen, and there is no
  // identity to tag. Nothing to do. default.hbs only writes
  // data-member-status for a signed-in member, free included.
  const status = (document.body && document.body.getAttribute("data-member-status")) || "";
  if (!status) return;

  const base = (document.body.getAttribute("data-kit-worker-url") || "").replace(/\/+$/, "");
  if (!base) return;
  if (!window.MOAuth || typeof window.MOAuth.fetch !== "function") return;

  /*
   * Client-side "already done" marker. Bump the version suffix if the
   * tag set ever changes, which re-claims for everybody.
   *
   * This is a politeness cache, not the idempotency guarantee. mo-kit's
   * /tfr-beta is idempotent on its own (it merges Ghost labels rather
   * than replacing them, and Kit tagging only ever adds), and it holds
   * its own KV dedup key. So a cleared localStorage, a second browser
   * or a private window costs one extra no-op request and nothing else.
   * Never make a correctness claim rest on storage the reader can wipe.
   */
  const MARK = "mo_tfr_beta_claimed_v1";
  let claimed = false;
  try {
    claimed = !!window.localStorage && localStorage.getItem(MARK) === status;
  } catch (_) { /* private mode: fall through and just make the call */ }

  // Today in Central time, as YYYY-MM-DD, for the once-a-day use report.
  // An empty string (an old browser without the time zone) just means the
  // report goes every visit and mo-kit's own daily key absorbs it.
  const USE_MARK = "mo_tfr_use_day_v1";
  let today = "";
  try {
    today = new Intl.DateTimeFormat("en-CA", {
      timeZone: "America/Chicago", year: "numeric", month: "2-digit", day: "2-digit",
    }).format(new Date());
  } catch (_) { /* fall through with no marker */ }
  let reported = false;
  try {
    reported = !!today && !!window.localStorage && localStorage.getItem(USE_MARK) === today;
  } catch (_) { /* private mode: report and let mo-kit dedupe */ }

  if (claimed && reported) return;

  function claim() {
    window.MOAuth.fetch(`${base}/tfr-beta`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: "{}",
    }).then((res) => {
      if (!res || !res.ok) return;
      // Keyed by status so a free member who upgrades re-claims once and
      // mo-kit gets a fresh look at them. Cheap, and it keeps the Kit
      // tag state honest across a tier change.
      try { if (window.localStorage) localStorage.setItem(MARK, status); } catch (_) {}
    }).catch(() => {
      // Deliberately silent. A reader whose tagging failed still has the
      // tools; surfacing this would be noise about our own bookkeeping.
    });
  }

  function reportUse() {
    window.MOAuth.fetch(`${base}/event`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ type: "tfr_used" }),
    }).then((res) => {
      if (!res || !res.ok || !today) return;
      try { if (window.localStorage) localStorage.setItem(USE_MARK, today); } catch (_) {}
    }).catch(() => {
      // Silent for the same reason as claim(): bookkeeping, not a feature.
    });
  }

  function run() {
    if (!claimed) claim();
    if (!reported) reportUse();
  }

  // Off the critical path. The tools are already interactive and these
  // calls are bookkeeping, so they wait for an idle moment rather than
  // competing with the first fetch a reader actually triggers.
  if (typeof window.requestIdleCallback === "function") {
    window.requestIdleCallback(run, { timeout: 4000 });
  } else {
    window.setTimeout(run, 1200);
  }
})();
