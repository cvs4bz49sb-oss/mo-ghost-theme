/*
 * /welcome/ — post-signup welcome survey, one question per screen.
 *
 * Answers POST to mo-membership /api/welcome-survey after every step, authed
 * by the Ghost member identity JWT that window.MOAuth attaches. Identity comes
 * from that token on the worker side, never from this page.
 *
 * Every save is fire-and-forget. A reader must never wait on, or be blocked
 * by, a network call for an optional survey: if the save fails the flow
 * continues and the next step's post carries the same answers again, since
 * each post sends the whole object rather than a delta.
 *
 * Page-template script: runs BEFORE site.min.js, so it uses no bundle
 * globals. It needs none.
 */
(function () {
  const form = document.querySelector("[data-welcome]");
  if (!form) return;

  const steps = [].slice.call(form.querySelectorAll(".welcome-step[data-step]"))
    .filter((s) => s.getAttribute("data-step") !== "done");
  const done = form.querySelector('[data-step="done"]');
  const bar = form.querySelector("[data-welcome-bar]");
  const fill = form.querySelector("[data-welcome-fill]");
  const count = form.querySelector("[data-welcome-count]");
  const backBtn = form.querySelector("[data-welcome-back]");
  const nextBtn = form.querySelector("[data-welcome-next]");
  const track = form.querySelector(".welcome-track");
  const TOTAL = steps.length;
  let index = 0;

  // ---- location options ----------------------------------------------------
  // Built here rather than in the template so the markup stays readable; the
  // list is inert data either way.
  const STATES = ["Alabama", "Alaska", "Arizona", "Arkansas", "California", "Colorado",
    "Connecticut", "Delaware", "District of Columbia", "Florida", "Georgia", "Hawaii",
    "Idaho", "Illinois", "Indiana", "Iowa", "Kansas", "Kentucky", "Louisiana", "Maine",
    "Maryland", "Massachusetts", "Michigan", "Minnesota", "Mississippi", "Missouri",
    "Montana", "Nebraska", "Nevada", "New Hampshire", "New Jersey", "New Mexico",
    "New York", "North Carolina", "North Dakota", "Ohio", "Oklahoma", "Oregon",
    "Pennsylvania", "Rhode Island", "South Carolina", "South Dakota", "Tennessee",
    "Texas", "Utah", "Vermont", "Virginia", "Washington", "West Virginia", "Wisconsin",
    "Wyoming"];
  // The 2026 survey's international respondents, in order of how many there
  // were, then a catch-all. Nine in ten of them were in the first four.
  const COUNTRIES = ["United Kingdom", "Canada", "Australia", "New Zealand", "Ireland",
    "Germany", "Netherlands", "Philippines", "South Africa", "Singapore", "Japan",
    "Spain", "Somewhere else"];

  const locationSel = form.querySelector("[data-location]");
  if (locationSel) {
    const blank = document.createElement("option");
    blank.value = "";
    blank.textContent = "Select a state or country";
    locationSel.appendChild(blank);
    const usGroup = document.createElement("optgroup");
    usGroup.label = "United States";
    STATES.forEach((s) => {
      const o = document.createElement("option");
      o.value = s;
      o.textContent = s;
      usGroup.appendChild(o);
    });
    locationSel.appendChild(usGroup);
    const intlGroup = document.createElement("optgroup");
    intlGroup.label = "Elsewhere";
    COUNTRIES.forEach((c) => {
      const o = document.createElement("option");
      o.value = c;
      o.textContent = c;
      intlGroup.appendChild(o);
    });
    locationSel.appendChild(intlGroup);
  }

  // ---- the three-answer cap ------------------------------------------------
  // Disabling the rest at three is gentler than accepting a fourth and then
  // telling someone off for it. The chosen three stay clickable so the way
  // out is to change your mind, not to hunt for a reset.
  const capBox = form.querySelector("[data-cap]");
  if (capBox) {
    const cap = parseInt(capBox.getAttribute("data-cap"), 10) || 3;
    const boxes = [].slice.call(capBox.querySelectorAll('input[type="checkbox"]'));
    capBox.addEventListener("change", () => {
      const chosen = boxes.filter((b) => b.checked).length;
      boxes.forEach((b) => {
        b.disabled = !b.checked && chosen >= cap;
        b.closest(".welcome-option").classList.toggle("is-disabled", b.disabled);
      });
    });
  }

  // ---- fit -----------------------------------------------------------------
  // Measure, do not guess. A height media query can only pick one threshold,
  // and the threshold that fits a phone leaves a short desktop window
  // scrolling: the seven age options ran past the fold at ~1000px tall.
  // After each step renders, check whether the content overflows its box and
  // escalate until it does not.
  //
  //   is-compact    tighter type and spacing, and the decorative eyebrow goes
  //   is-compact-2  every option list additionally goes two-up
  const pageEl = document.querySelector(".welcome-page");
  function fit() {
    if (!pageEl) return;
    pageEl.classList.remove("is-compact", "is-compact-2", "is-overflowing");
    const over = () => pageEl.scrollHeight > pageEl.clientHeight + 1;
    if (!over()) return;
    pageEl.classList.add("is-compact");
    if (!over()) return;
    pageEl.classList.add("is-compact-2");
    if (!over()) return;
    // Still too tall even fully compacted (a very short window, or text
    // scaled up in the OS). Stop centring: auto margins push the overflow
    // off BOTH ends, which puts the heading above the scroll origin where it
    // cannot be reached. Top-anchored, the overflow all goes downward and is
    // scrollable.
    pageEl.classList.add("is-overflowing");
  }
  let fitTimer = null;
  const refit = () => {
    clearTimeout(fitTimer);
    fitTimer = setTimeout(fit, 120);
  };
  window.addEventListener("resize", refit, { passive: true });
  // Web fonts land AFTER first paint. Measuring before they swap reports a
  // shorter page than the reader ends up with, so fit() concludes everything
  // fits and never compacts — which is what a desktop harness with the fonts
  // already cached will never show you.
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(fit).catch(() => {});
  window.addEventListener("load", refit);
  // One frame after paint, for the same reason: layout is not final on the
  // tick that show() runs.
  requestAnimationFrame(() => requestAnimationFrame(fit));
  // A mobile browser collapsing or restoring its toolbars changes the visible
  // height without always firing resize. visualViewport does report it, and
  // that height change is exactly the one that pushes an option out of sight.
  if (window.visualViewport) {
    window.visualViewport.addEventListener("resize", refit, { passive: true });
    window.visualViewport.addEventListener("scroll", refit, { passive: true });
  }

  // ---- steps ---------------------------------------------------------------
  function show(i, viaBack) {
    steps.forEach((s, n) => {
      s.hidden = n !== i;
      s.classList.toggle("is-active", n === i);
    });
    index = i;
    const human = i + 1;
    // Two labels, one shown per breakpoint. Same welcome-lfull / welcome-labbr
    // convention the KPI toolbar uses, and the reason is the same: the long
    // form wraps to two lines in a fixed bar on a phone.
    count.textContent = "";
    // Both spans live in the DOM and CSS shows one, so the element's text is
    // the two strings run together. Hide them from assistive tech and put the
    // single sentence on the container, or it is announced twice.
    count.setAttribute("aria-label", `Question ${human} of ${TOTAL}`);
    const full = document.createElement("span");
    full.className = "welcome-lfull";
    full.setAttribute("aria-hidden", "true");
    full.textContent = `Question ${human} of ${TOTAL}`;
    const abbr = document.createElement("span");
    abbr.className = "welcome-labbr";
    abbr.setAttribute("aria-hidden", "true");
    abbr.textContent = `${human} of ${TOTAL}`;
    count.appendChild(full);
    count.appendChild(abbr);
    fill.style.width = `${(human / TOTAL) * 100}%`;
    track.setAttribute("aria-valuenow", String(human));
    backBtn.hidden = i === 0;
    nextBtn.textContent = i === TOTAL - 1 ? "Save answers" : "Next";

    // Focus the new question. Without this a keyboard or screen-reader user
    // stays parked on a button whose meaning just changed underneath them,
    // which is the standard way step flows quietly break.
    const legend = steps[i].querySelector(".welcome-q");
    if (legend && (viaBack !== undefined)) legend.focus();

    fit();
  }

  // ---- persistence ---------------------------------------------------------
  const API = (form.getAttribute("data-api-base") || window.MO_API_BASE || "").replace(/\/+$/, "");
  const SOURCE = form.getAttribute("data-source") || "welcome";
  let lastSent = "";

  function save(completed) {
    if (!API || !window.MOAuth) return;
    const payload = collect();
    payload.completed = !!completed;
    payload.source = SOURCE;
    // Skip a post that would say exactly what the last one said. Back and
    // forth through the steps is normal and would otherwise fire a write per
    // keystroke of navigation.
    const fingerprint = JSON.stringify(payload);
    if (fingerprint === lastSent) return;
    lastSent = fingerprint;
    window.MOAuth.fetch(`${API}/api/welcome-survey`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: fingerprint,
    }).catch(() => { /* optional survey; never surface a network error */ });
  }

  function next() {
    // Save on the way out of a step, so a reader who abandons mid-flow still
    // leaves behind everything they answered up to that point.
    save(false);
    if (index < TOTAL - 1) show(index + 1, false);
    else finish();
  }

  function collect() {
    const data = { role: [], interests: [] };
    ["gender", "age", "denomination"].forEach((name) => {
      const hit = form.querySelector(`input[name="${name}"]:checked`);
      data[name] = hit ? hit.value : null;
    });
    [].slice.call(form.querySelectorAll('input[name="role"]:checked'))
      .forEach((b) => data.role.push(b.value));
    [].slice.call(form.querySelectorAll('input[name="interests"]:checked'))
      .forEach((b) => data.interests.push(b.value));
    data.location = locationSel && locationSel.value ? locationSel.value : null;
    return data;
  }

  function finish() {
    form.__answers = collect();
    // completed:true only ever ratchets up on the worker side, so a reader
    // who returns to the page later cannot un-complete themselves.
    save(true);
    steps.forEach((s) => { s.hidden = true; s.classList.remove("is-active"); });
    // BOTH are required. .welcome-step is display:none and only .is-active
    // sets display:block, so clearing the hidden attribute on its own leaves
    // the panel invisible and the last answer drops the reader onto a blank
    // screen. Verify this with computed display, not the hidden property.
    done.hidden = false;
    done.classList.add("is-active");
    bar.hidden = true;
    const page = document.querySelector(".welcome-page");
    if (page) page.scrollTop = 0;
    const title = done.querySelector(".welcome-title");
    if (title) {
      title.setAttribute("tabindex", "-1");
      title.focus();
    }
  }

  nextBtn.addEventListener("click", next);
  backBtn.addEventListener("click", () => { if (index > 0) show(index - 1, true); });

  // Auto-advance on the single-choice questions. A third of a second is long
  // enough that the choice registers before the screen moves. Deliberately NOT
  // on the two multi-selects, where advancing on the first of three answers
  // would be wrong; those wait for Next, and their hint says so.
  form.querySelectorAll("[data-single]").forEach((group) => {
    group.addEventListener("change", (e) => {
      if (e.target && e.target.type === "radio") setTimeout(next, 350);
    });
  });

  // The location dropdown is a single choice too, so it advances like the
  // radios. It needs a longer, resetting timer rather than a fixed one:
  // arrow-keying through a closed select fires a change event per keystroke,
  // and a fixed delay would carry a keyboard user off the question before
  // they reached the option they wanted.
  if (locationSel) {
    let settle = null;
    locationSel.addEventListener("change", () => {
      if (!locationSel.value) return;
      clearTimeout(settle);
      settle = setTimeout(next, 600);
    });
  }

  // Enter should advance rather than submit: there is nothing to submit to.
  form.addEventListener("submit", (e) => { e.preventDefault(); next(); });

  show(0);
})();
