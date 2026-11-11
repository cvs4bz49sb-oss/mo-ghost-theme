/*
 * The signed-in member's labels and "Member since" date, from mo-kit
 * /member-profile. Ghost gives the theme no labels (@member.labels is
 * always empty), so three things read them from here:
 *   - the nav Support panel's Role CTAs (.mm-pick[data-roles]),
 *   - the dashboard's complimentary-reason line (.dashboard-comp-why),
 *   - the dashboard's "Member since" line ([data-member-since]).
 * Fetched once per signed-in session and kept in sessionStorage for 30
 * minutes, so most page views make no request. Signed out, or on any
 * failure, nothing changes: the Role CTAs keep their default card and the
 * since line stays hidden.
 */
(function () {
  const {body} = document;
  const WORKER = (body.getAttribute("data-kit-worker-url") || "").replace(/\/$/, "");
  const EMAIL = body.getAttribute("data-member-email") || "";
  const pick = document.querySelector(".mm-pick");
  const why = document.querySelector(".dashboard-comp-why");
  const since = document.querySelector("[data-member-since]");
  if (!WORKER || !EMAIL || !window.MOAuth || !(pick || why || since)) return;

  const KEY = `mo-member-profile:${EMAIL}`;
  const TTL = 30 * 60 * 1000;

  function cached() {
    try {
      const hit = JSON.parse(sessionStorage.getItem(KEY) || "null");
      if (hit && Date.now() - hit.at < TTL) return hit.data;
    } catch (e) { /* storage blocked */ }
    return null;
  }

  function apply(data) {
    const labels = (data && Array.isArray(data.labels)) ? data.labels : [];
    if (pick) pick.setAttribute("data-roles", `|${labels.filter((n) => n.startsWith("Role:")).join("|")}|`);
    if (why) why.setAttribute("data-labels", `|${labels.join("|")}|`);
    const m = since && data && /^(\d{4})-(\d{2})-(\d{2})$/.exec(data.since || "");
    const out = since && since.querySelector("[data-member-since-date]");
    if (m && out) {
      // Built from parts so the date never shifts a day across time zones.
      const d = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
      out.textContent = d.toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" });
      since.hidden = false;
    }
  }

  const hit = cached();
  if (hit) { apply(hit); return; }
  window.MOAuth.fetch(`${WORKER}/member-profile`, { method: "GET", mode: "cors", credentials: "omit" })
    .then((r) => { return r.ok ? r.json() : null; })
    .then((data) => {
      if (!data) return;
      try { sessionStorage.setItem(KEY, JSON.stringify({ at: Date.now(), data })); } catch (e) { /* storage blocked */ }
      apply(data);
    })
    .catch(() => {});
}());
