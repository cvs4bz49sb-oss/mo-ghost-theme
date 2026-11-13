/*
 * The member bar: a slim terracotta bar across the foot of main-site
 * pages for signed-in paid and comped members, carrying one of two tabs.
 * Never both: a member owed a migration sees only that one.
 *
 *   "Confirm Address For Journal"  only for members with no mailing
 *       address on file. A plain link to /manage/, where it is saved.
 *
 *   "Migrate Your Membership"  only for comped members whose old
 *       HubSpot membership is still billing them. Slides a panel up,
 *       the same way the TFR reader survey (faith-survey.js) does, with
 *       a note and a link to /migrate/.
 *
 * Who sees which tab is decided by mo-membership GET /api/member/prompts
 * (website/workers/membership/lib/member-prompts.js); the browser cannot
 * see either fact. Each tab disappears once its action is taken: the
 * address row exists, or migrating makes the member Stripe-paid, which
 * ends "comped" here before any lookup.
 *
 * The answer is cached for the browser session so a reader paging
 * through the site costs one lookup. Visiting any page that saves an
 * address or starts the migration clears it (ACTION_PAGES), so a member
 * returns from either to a fresh answer. Neither tab can be dismissed for good: both go away
 * by being done.
 *
 * Never under /the-faith-received/, which has its own bar in the same
 * place. The member attributes come from <body> in default.hbs.
 */
(function () {
  const CACHE_KEY = "mo_member_prompts";
  const CACHE_MS = 30 * 60 * 1000;

  const path = String(window.location.pathname || "/").toLowerCase().replace(/\/+$/, "");
  if (path.indexOf("/the-faith-received") === 0) return;

  function forget() {
    try { window.sessionStorage.removeItem(CACHE_KEY); } catch (_) { /* private mode */ }
  }
  // The pages the tabs point at, and the other pages that save an
  // address, do not need the bar, and a visit to any of them is the
  // moment the answer may change.
  const ACTION_PAGES = ["/manage", "/migrate", "/dashboard", "/complete-membership", "/welcome"];
  if (ACTION_PAGES.indexOf(path) !== -1) { forget(); return; }

  const { body } = document;
  if (!body) return;
  const email = (body.getAttribute("data-member-email") || "").toLowerCase();
  const status = body.getAttribute("data-member-status") || "";
  if (!email || (status !== "paid" && status !== "comped" && status !== "gift")) { forget(); return; }

  const metaBase = document.querySelector('meta[name="mo-api-base"]');
  const apiBase = ((metaBase && metaBase.getAttribute("content")) || "").replace(/\/+$/, "");
  if (!apiBase || !window.MOAuth) return;

  function readCache() {
    try {
      const c = JSON.parse(window.sessionStorage.getItem(CACHE_KEY) || "null");
      if (c && c.email === email && c.status === status && Date.now() - c.at < CACHE_MS) return c;
    } catch (_) { /* unreadable is the same as empty */ }
    return null;
  }
  function writeCache(p) {
    try {
      window.sessionStorage.setItem(CACHE_KEY, JSON.stringify({
        email, status, at: Date.now(), address: !!p.address, migrate: !!p.migrate,
      }));
    } catch (_) { /* private mode */ }
  }

  async function lookup() {
    const cached = readCache();
    if (cached) return cached;
    const res = await window.MOAuth.fetch(`${apiBase}/api/member/prompts`);
    if (!res.ok) return null;
    const p = await res.json();
    writeCache(p);
    return p;
  }

  lookup().then((p) => {
    if (!p) return;
    // Only comped members can owe a migration. A stale cached "true"
    // from before checkout must not survive the status change.
    const migrate = !!p.migrate && status === "comped";
    // One tab at a time, and migrating wins: the migration checkout
    // collects the address too, so asking for both asks twice.
    if (migrate) mount(false, true);
    else if (p.address && !eoyCampaign()) mount(true, false);
  }).catch(() => { /* no bar is the safe failure */ });

  // Year-end campaign (Ian, 2026-11-13): while partials/year-end-bar.hbs
  // runs, the "Confirm Address For Journal" tab stands down so the
  // year-end bar is the only thing along the bottom. The migration tab
  // still shows (the year-end bar steps aside for it in CSS). Returns on
  // its own when the campaign ends or the partial is removed.
  function eoyCampaign() {
    const eoy = document.querySelector("[data-eoy-bar]");
    return !!eoy && Date.now() < Date.parse(eoy.getAttribute("data-ends") || "");
  }

  function mount(address, migrate) {
    const root = document.createElement("div");
    root.className = "journal-address";
    const addressTab = address
      ? `<a class="journal-address-tab" href="/manage/">Confirm Address For Journal</a>`
      : "";
    const migrateTab = migrate
      ? `<button type="button" class="journal-address-tab" data-ja-open aria-expanded="false" aria-controls="journal-migrate-panel">Migrate Your Membership</button>`
      : "";
    const panel = migrate
      ? `<div class="journal-address-panel" id="journal-migrate-panel" role="dialog" aria-modal="false" aria-labelledby="journal-migrate-title">
          <div class="journal-address-inner">
            <button type="button" class="journal-address-close" data-ja-close aria-label="Close">&times;</button>
            <p class="journal-address-title" id="journal-migrate-title">Your membership still needs to move to our new system.</p>
            <p class="journal-address-note">You are still being billed through our old membership system. Migrate your membership to the new site and receive 25% off your next year.</p>
            <a class="btn btn-dark journal-address-go" href="/migrate/">Migrate My Membership</a>
          </div>
        </div>`
      : "";
    root.innerHTML =
      `<div class="journal-address-bar"><div class="journal-address-tabs">${addressTab}${migrateTab}</div></div>${panel}`;
    body.appendChild(root);
    body.classList.add("has-journal-address");
    if (!migrate) return;

    const tab = root.querySelector("[data-ja-open]");
    function onKey(e) {
      if (e.key === "Escape") { e.preventDefault(); close(); }
    }
    function open() {
      root.classList.add("is-open");
      tab.setAttribute("aria-expanded", "true");
      document.addEventListener("keydown", onKey);
      const go = root.querySelector(".journal-address-go");
      if (go) go.focus();
    }
    function close() {
      root.classList.remove("is-open");
      tab.setAttribute("aria-expanded", "false");
      document.removeEventListener("keydown", onKey);
      tab.focus();
    }
    root.addEventListener("click", (e) => {
      if (e.target.closest("[data-ja-open]")) { open(); return; }
      if (e.target.closest("[data-ja-close]")) close();
    });
  }
})();
