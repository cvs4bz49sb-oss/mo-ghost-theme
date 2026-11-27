/*
 * /writers-meetings/ — the upcoming meetings, live (2026-11-26).
 *
 * Reads mo-forms GET /writers-meetings/schedule: the meetings staff set
 * in MOOS's Events tool (D1 writers_meetings_schedule), upcoming only,
 * with no personal data. With one or more ahead, the date cards show
 * them, the "Next dates" fact names the first, and the RSVP form (the
 * <template data-wm-rsvp> in custom-writers-meetings.hbs) takes the
 * place of the interest sign-up. mo-forms accepts an RSVP only for a
 * meeting on that schedule, so a stale page cannot book a removed one.
 *
 * With none ahead, a failed or slow fetch, or no JavaScript, the page
 * stays exactly as the template draws it: dates to be announced and the
 * interest sign-up.
 *
 * Schedule text goes in with textContent only. The reading's link goes
 * through MOSafeHref, and only when it is https.
 */
(function () {
  const cards = document.querySelector("[data-wm-schedule]");
  if (!cards) return;
  const base = (cards.getAttribute("data-forms-url") || "").trim().replace(/\/$/, "");
  if (!/^https:\/\/[^/\s]+$/.test(base)) return;

  const KEY = /^\d{4}-\d{2}-\d{2}$/;
  const NUMERALS = ["I", "II", "III", "IV", "V", "VI"];
  const ctrl = typeof AbortController === "function" ? new AbortController() : null;
  const timer = setTimeout(() => { if (ctrl) ctrl.abort(); }, 8000);

  fetch(`${base}/writers-meetings/schedule`, { credentials: "omit", signal: ctrl ? ctrl.signal : undefined })
    .then((res) => (res.ok ? res.json() : null))
    .then((data) => {
      clearTimeout(timer);
      const list = data && Array.isArray(data.meetings)
        ? data.meetings.filter((m) => m && KEY.test(String(m.key)) && typeof m.label === "string").slice(0, NUMERALS.length)
        : [];
      if (list.length) render(list);
    })
    .catch(() => { clearTimeout(timer); });

  function el(tag, cls, text) {
    const node = document.createElement(tag);
    if (cls) node.className = cls;
    if (text) node.textContent = text;
    return node;
  }
  // "Tuesday, December 8, 2026" -> "Tuesday, December 8"
  function day(m) { return String(m.label).replace(/,\s*\d{4}$/, "").slice(0, 80); }
  function time(m) { return typeof m.time === "string" ? m.time.slice(0, 40) : ""; }

  function render(list) {
    cards.textContent = "";
    list.forEach((m, i) => {
      const li = el("li", "wm-date");
      const numeral = el("span", "wm-date-numeral", NUMERALS[i]);
      numeral.setAttribute("aria-hidden", "true");
      li.appendChild(numeral);
      li.appendChild(el("p", "wm-date-when", day(m)));
      li.appendChild(el("p", "wm-date-meta", [time(m), "One hour on Zoom"].filter(Boolean).join(" · ")));
      const reading = el("p", "wm-date-reading");
      const r = m.reading && typeof m.reading === "object" ? m.reading : null;
      const title = r && typeof r.title === "string" ? r.title.slice(0, 200) : "";
      const url = r && typeof r.url === "string" && /^https:\/\//.test(r.url) ? r.url : "";
      if (url && window.MOSafeHref) {
        const a = el("a", "", title || "The reading");
        window.MOSafeHref.set(a, url, "#");
        reading.appendChild(a);
      } else {
        reading.textContent = title || "Reading to be announced";
      }
      li.appendChild(reading);
      cards.appendChild(li);
    });

    const next = document.querySelector("[data-wm-next]");
    if (next) {
      // "January 12, February 9 and March 9"
      const dates = list.slice(0, 3).map((m) => day(m).replace(/^[A-Za-z]+,\s*/, ""));
      const more = list.length > 3 ? " and more" : "";
      next.textContent = dates.length > 1 && !more ? `${dates.slice(0, -1).join(", ")} and ${dates[dates.length - 1]}` : dates.join(", ") + more;
    }

    // The RSVP form in place of the interest sign-up
    const tpl = document.querySelector("template[data-wm-rsvp]");
    const interest = document.querySelector("[data-wm-interest]");
    if (!tpl || !interest || !tpl.content) return;
    const frag = tpl.content.cloneNode(true);
    const choices = frag.querySelector("[data-wm-choices]");
    const form = frag.querySelector("[data-site-form]");
    if (!choices || !form) return;
    list.forEach((m) => {
      const label = el("label", "site-form-field-check");
      const input = document.createElement("input");
      input.type = "radio";
      input.name = "meetings";
      input.value = m.key;
      input.required = true;
      input.checked = list.length === 1;
      label.appendChild(input);
      label.appendChild(el("span", "", [day(m), time(m)].filter(Boolean).join(", ")));
      choices.appendChild(label);
    });
    interest.replaceWith(frag);
    if (window.MOSiteForms && typeof window.MOSiteForms.mount === "function") window.MOSiteForms.mount(form);
  }
})();
