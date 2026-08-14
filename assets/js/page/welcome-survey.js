/*
 * /welcome/ — post-signup welcome survey, one question per screen.
 *
 * PREVIEW BUILD: Save does not persist anything. See the note at the top of
 * custom-welcome.hbs for what is deliberately missing (the signup redirect,
 * and per-step persistence).
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
  }

  function next() {
    if (index < TOTAL - 1) show(index + 1, false);
    else finish();
  }

  // Answers are collected but go nowhere yet. Kept as a single object so
  // wiring persistence later is one fetch, not a rewrite.
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
    steps.forEach((s) => { s.hidden = true; s.classList.remove("is-active"); });
    done.hidden = false;
    bar.hidden = true;
    const title = done.querySelector(".welcome-title");
    if (title) {
      title.setAttribute("tabindex", "-1");
      title.focus();
    }
  }

  nextBtn.addEventListener("click", next);
  backBtn.addEventListener("click", () => { if (index > 0) show(index - 1, true); });

  // Auto-advance on the single-choice questions only. A third of a second is
  // long enough that the choice registers before the screen moves. Doing this
  // on the multi-selects would advance on the first of three answers.
  form.querySelectorAll("[data-single]").forEach((group) => {
    group.addEventListener("change", (e) => {
      if (e.target && e.target.type === "radio") setTimeout(next, 350);
    });
  });

  // Enter should advance rather than submit: there is nothing to submit to.
  form.addEventListener("submit", (e) => { e.preventDefault(); next(); });

  show(0);
})();
