/*
 * Liturgical-calendar boot — applies the season class to <body> before
 * first paint to prevent a flash where the page renders in default
 * styling and then snaps to season styling on second paint.
 *
 * Loaded synchronously immediately after <body> opens so document.body
 * is parsed but no styles have been applied yet. The full liturgical
 * settings UI (toggle, season override) is in liturgical-calendar.js,
 * loaded later in the body.
 *
 * Stored value in localStorage["mo_liturgical"]:
 *   "off"        — feature disabled
 *   "auto"       — compute current season from today's date
 *   "advent"     — explicit override (any of the season slugs below)
 *   "christmas"
 *   "epiphany"
 *   "lent"
 *   "easter"
 *   "pentecost"
 *   "ordinary"
 */
(function () {
  // Liturgical season is the same regardless of whether the visitor
  // is signed in. The previous version returned early when no member
  // email was present, which was a copy-paste bug from a member-only
  // feature.
  let p;
  try { p = localStorage.getItem("mo_liturgical"); } catch (x) {}
  if (!p || p === "off") return;
  let s = p;

  if (p === "auto") {
    const now = new Date(),
        Y = now.getFullYear(),
        M = now.getMonth(),
        D = now.getDate();

    function easter(y) {
      const a = y % 19,
          b = Math.floor(y / 100),
          c = y % 100,
          d = Math.floor(b / 4),
          e2 = b % 4,
          f = Math.floor((b + 8) / 25),
          g = Math.floor((b - f + 1) / 3),
          h = (19 * a + b - d - g + 15) % 30,
          i = Math.floor(c / 4),
          k = c % 4,
          l = (32 + 2 * e2 + 2 * i - h - k) % 7,
          m = Math.floor((a + 11 * h + 22 * l) / 451),
          mo = Math.floor((h + l - 7 * m + 114) / 31),
          da = ((h + l - 7 * m + 114) % 31) + 1;
      return new Date(y, mo - 1, da);
    }
    function add(n, d) {
      const r = new Date(d);
      r.setDate(r.getDate() + n);
      return r;
    }
    function ymd(d) {
      return new Date(d.getFullYear(), d.getMonth(), d.getDate());
    }

    const ea = easter(Y),
        aw = add(-46, ea), // Ash Wednesday
        hs = add(-1, ea), // Holy Saturday
        pn = add(49, ea), // Pentecost
        d24 = new Date(Y, 11, 24),
        dw = d24.getDay(),
        a4 = dw === 0 ? d24 : new Date(Y, 11, 24 - dw),
        av = add(-21, a4), // First Sunday of Advent
        t = ymd(now);

    if (M === 0 && D <= 5) s = "christmas";
    else if (t >= new Date(Y, 0, 6) && t < aw) s = "epiphany";
    else if (t >= aw && t <= hs) s = "lent";
    else if (t >= ea && t < pn) s = "easter";
    else if (t.getTime() === ymd(pn).getTime()) s = "pentecost";
    else if (t > pn && t < av) s = "ordinary";
    else if (t >= av && M === 11 && D <= 24) s = "advent";
    else if (M === 11 && D >= 25) s = "christmas";
    else s = "ordinary";
  }

  if (s && s !== "off") document.body.classList.add(`lc-${s}`);
})();
