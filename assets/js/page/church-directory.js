/* Church Directory prototype — all behavior for
 * custom-church-directory.hbs.
 *
 * TWO REQUESTS, BOTH FOR THIS SITE'S OWN STATIC ASSETS: the
 * listings and the map outlines, both under /assets/data/. There is no
 * worker, no Ghost API, no form endpoint, no map tiles, and the claim
 * form deliberately sends nothing: see the submit handler at the bottom,
 * which does not and must not fetch.
 *
 * THE MAP IS INLINE SVG DRAWN FROM THOSE OUTLINES, not an embed. See
 * the template header for why. It is projected Web Mercator into a
 * 1000-unit square, the same math the outline file was built with, and
 * it zooms by moving the viewBox. Pins are not in the tab order: the map
 * is a picture of the list, and every church on it is a link in the list
 * below with the same destination.
 *
 * THREE VIEWS, SWITCHED BY THE HASH. All three are in the markup and
 * two carry `hidden`; this file shows one at a time. A Ghost draft
 * preview has no routes beneath it, so a church cannot have a path of
 * its own, and the hash is what is left. Back and forward work because
 * the only state that decides the view is the hash itself.
 *
 * DATA GOES IN WITH textContent, NEVER innerHTML. Every listing field
 * is somebody's free text in the real thing, so none of it is ever
 * parsed as markup. The only markup this file creates is its own
 * elements.
 *
 * THE DATA MAY BE INCOMPLETE, AND THE PAGE SAYS SO RATHER THAN LYING.
 * A listing with no city, tradition or service times renders "Not
 * given" and drops out of the filters it has nothing to answer. That is
 * not defensive padding: the real church list we hold is a free-text
 * name and nothing else, so a page that assumed ten full fields would
 * show invented facts next to a real congregation's name.
 */
(function () {
  "use strict";

  const root = document.querySelector("main.cd");
  if (!root) return;

  /* Renamed from church-directory.json on 2026-11-03: moDataUrl keys the
     CDN copy on the theme hash plus the hour, so a data change with no
     boot change waits up to an hour. A new name is the only immediate
     cache break. */
  const DATA_PATH = "/assets/data/church-directory-listings.json";
  const MAP_PATH = "/assets/data/church-directory-map.json";
  const TITLE_SUFFIX = "Church Directory (prototype) | Mere Orthodoxy";
  const DESCRIPTION_MAX = 300;
  const NOT_GIVEN = "Not given";

  /* Two-letter US codes are what the data carries, because that is what
     a US address carries. A reader filtering a directory reads state
     names, so the codes are expanded here. Everywhere else in the world
     the state field is already a full name and passes through. */
  const US_STATES = {
    AL: "Alabama", AK: "Alaska", AZ: "Arizona", AR: "Arkansas", CA: "California",
    CO: "Colorado", CT: "Connecticut", DE: "Delaware", DC: "District of Columbia",
    FL: "Florida", GA: "Georgia", HI: "Hawaii", ID: "Idaho", IL: "Illinois",
    IN: "Indiana", IA: "Iowa", KS: "Kansas", KY: "Kentucky", LA: "Louisiana",
    ME: "Maine", MD: "Maryland", MA: "Massachusetts", MI: "Michigan",
    MN: "Minnesota", MS: "Mississippi", MO: "Missouri", MT: "Montana",
    NE: "Nebraska", NV: "Nevada", NH: "New Hampshire", NJ: "New Jersey",
    NM: "New Mexico", NY: "New York", NC: "North Carolina", ND: "North Dakota",
    OH: "Ohio", OK: "Oklahoma", OR: "Oregon", PA: "Pennsylvania", PR: "Puerto Rico",
    RI: "Rhode Island", SC: "South Carolina", SD: "South Dakota", TN: "Tennessee",
    TX: "Texas", UT: "Utah", VT: "Vermont", VA: "Virginia", WA: "Washington",
    WV: "West Virginia", WI: "Wisconsin", WY: "Wyoming",
  };

  const $ = (sel, within) => (within || root).querySelector(sel);
  const $$ = (sel, within) => Array.prototype.slice.call((within || root).querySelectorAll(sel));

  const el = (tag, className, text) => {
    const node = document.createElement(tag);
    if (className) node.className = className;
    if (text != null) node.textContent = text;
    return node;
  };

  const str = (v) => (typeof v === "string" ? v.trim() : "");

  /* Case and accent insensitive, so "Brendan" finds "St. Brendan's" and
     "koln" finds "Köln". NFD splits a letter from its accent and the
     range strips the accents it produced. */
  const fold = (v) => str(v).normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();

  const stateNameOf = (church) => {
    const s = str(church.state);
    if (!s) return "";
    return str(church.country) === "US" ? US_STATES[s.toUpperCase()] || s : s;
  };
  const countryNameOf = (church) => str(church.countryName) || str(church.country);

  const placeOf = (church) => {
    const parts = [str(church.city), stateNameOf(church)].filter(Boolean);
    const country = countryNameOf(church);
    if (country && country !== "United States") parts.push(country);
    return parts.join(", ");
  };

  /* ── State ─────────────────────────────────────────────────────── */

  let churches = [];
  let loadFailed = false;
  let lastFound = [];
  let currentChurch = null;

  const FILTER_KEYS = ["q", "country", "state", "city", "tradition"];
  const filters = { q: "", country: "", state: "", city: "", tradition: "" };

  const STORE_KEY = "mo-cd-filters";

  const saveFilters = () => {
    try {
      sessionStorage.setItem(STORE_KEY, JSON.stringify(filters));
    } catch (e) { /* private mode, or storage refused: the hash still carries them */ }
  };
  const loadFilters = () => {
    try {
      const raw = sessionStorage.getItem(STORE_KEY);
      if (!raw) return;
      const saved = JSON.parse(raw);
      if (!saved || typeof saved !== "object") return;
      FILTER_KEYS.forEach((k) => { if (typeof saved[k] === "string") filters[k] = saved[k]; });
    } catch (e) { /* ignore unreadable storage */ }
  };

  const anyFilterSet = () => FILTER_KEYS.some((k) => filters[k]);

  const filterQuery = () => {
    const p = new URLSearchParams();
    FILTER_KEYS.forEach((k) => { if (filters[k]) p.set(k, filters[k]); });
    const s = p.toString();
    return s ? `?${s}` : "";
  };

  /* The directory's own address, filters included, so a Back link out of
     a church view returns the reader to the list they were reading. */
  const directoryHash = () => `#${filterQuery()}`;

  /* ── Elements ──────────────────────────────────────────────────── */

  const views = {
    directory: $('[data-cd-view="directory"]'),
    church: $('[data-cd-view="church"]'),
    form: $('[data-cd-view="form"]'),
  };
  const headings = {
    directory: $("#cd-directory-title"),
    church: $("#cd-church-title"),
    form: $("#cd-form-title"),
  };

  const qInput = $("[data-cd-q]");
  const countrySel = $("[data-cd-country]");
  const stateSel = $("[data-cd-state]");
  const stateFilterWrap = $("[data-cd-state-filter]");
  const citySel = $("[data-cd-city]");
  const traditionSel = $("[data-cd-tradition]");
  const clearBtn = $("[data-cd-clear]");
  const countEl = $("[data-cd-count]");
  const listEl = $("[data-cd-list]");

  const form = $("[data-cd-form]");
  const doneEl = $("[data-cd-done]");
  const summaryEl = $("[data-cd-summary]");
  const summaryList = $("[data-cd-summary-list]");
  const summaryHeading = $("[data-cd-summary-heading]");
  const claimingEl = $("[data-cd-claiming]");
  const charEl = $("[data-cd-char]");
  const formTitle = $("[data-cd-form-title]");
  const formSub = $("[data-cd-form-sub]");

  /* ── Filtering ─────────────────────────────────────────────────── */

  const matches = (church) => {
    if (filters.country && str(church.country) !== filters.country) return false;
    if (filters.state && stateNameOf(church) !== filters.state) return false;
    if (filters.city && str(church.city) !== filters.city) return false;
    if (filters.tradition && str(church.tradition) !== filters.tradition) return false;
    if (filters.q) {
      const needle = fold(filters.q);
      if (needle && fold(church.name).indexOf(needle) < 0 && fold(church.city).indexOf(needle) < 0) return false;
    }
    return true;
  };

  const sortByName = (a, b) => fold(a.name).localeCompare(fold(b.name));
  /* Array.from, not slice.call: a Set has no `length`, so slice.call on
     one returns an empty array and every group on the page silently
     renders nothing while the count above it still reads 24. */
  const uniqueSorted = (values) => Array.from(new Set(values.filter(Boolean)))
    .sort((a, b) => a.localeCompare(b));

  const fillSelect = (select, values, allLabel, current) => {
    if (!select) return;
    select.textContent = "";
    select.appendChild(el("option", null, allLabel)).value = "";
    values.forEach((v) => { select.appendChild(el("option", null, v)).value = v; });
    select.value = values.indexOf(current) >= 0 ? current : "";
  };

  /* Each select offers only what the one above it leaves possible, so a
     reader cannot assemble a combination with no churches in it. */
  const syncSelects = () => {
    const countries = uniqueSorted(churches.map(countryNameOf));
    const codeFor = {};
    churches.forEach((c) => { const n = countryNameOf(c); if (n) codeFor[n] = str(c.country); });

    if (countrySel) {
      countrySel.textContent = "";
      countrySel.appendChild(el("option", null, "All countries")).value = "";
      countries.forEach((name) => {
        const opt = el("option", null, name);
        opt.value = codeFor[name];
        countrySel.appendChild(opt);
      });
      countrySel.value = filters.country;
      if (countrySel.value !== filters.country) { filters.country = ""; countrySel.value = ""; }
    }

    const inCountry = churches.filter((c) => !filters.country || str(c.country) === filters.country);
    const states = uniqueSorted(inCountry.map(stateNameOf));

    /* Hidden when the chosen country has no states or provinces in the
       data, and hidden until a country is chosen: a list of every state
       in the world is not a filter anyone can use. */
    const showState = !!filters.country && states.length > 0;
    if (stateFilterWrap) stateFilterWrap.hidden = !showState;
    if (!showState) filters.state = "";
    fillSelect(stateSel, states, "All states or provinces", filters.state);
    if (stateSel && stateSel.value !== filters.state) filters.state = stateSel.value;

    const inState = inCountry.filter((c) => !filters.state || stateNameOf(c) === filters.state);
    const cities = uniqueSorted(inState.map((c) => str(c.city)));
    fillSelect(citySel, cities, "All cities", filters.city);
    if (citySel && citySel.value !== filters.city) filters.city = citySel.value;

    const traditions = uniqueSorted(churches.map((c) => str(c.tradition)));
    fillSelect(traditionSel, traditions, "All traditions", filters.tradition);
    if (traditionSel && traditionSel.value !== filters.tradition) filters.tradition = traditionSel.value;

    if (qInput && qInput.value !== filters.q) qInput.value = filters.q;
    if (clearBtn) clearBtn.hidden = !anyFilterSet();
  };

  /* ── The count ─────────────────────────────────────────────────── */

  const countText = (n) => {
    if (!n) return "No churches match";
    const noun = n === 1 ? "church" : "churches";
    const place = filters.city
      || filters.state
      || (filters.country ? (churches.filter((c) => str(c.country) === filters.country).map(countryNameOf)[0] || "") : "");
    return place ? `${n} ${noun} in ${place}` : `${n} ${noun}`;
  };

  /* ── The card ──────────────────────────────────────────────────── */

  const badgeText = (church) => (str(church.status) === "sample" ? "Unconfirmed sample" : "Unconfirmed");

  const cardFor = (church) => {
    const a = el("a", "cd-card");
    a.href = `#church/${encodeURIComponent(str(church.slug))}`;
    a.appendChild(el("span", "cd-card-name", str(church.name)));

    const place = placeOf(church);
    if (place) a.appendChild(el("span", "cd-card-place", place));

    const tradition = str(church.tradition);
    if (tradition) a.appendChild(el("span", "cd-card-tradition", tradition));

    const badges = el("span", "cd-card-badges");
    badges.appendChild(el("span", "cd-badge", badgeText(church)));
    a.appendChild(badges);
    return a;
  };

  /* ── The list ──────────────────────────────────────────────────── */

  const renderList = () => {
    if (!listEl) return;
    listEl.textContent = "";

    if (loadFailed) {
      if (countEl) countEl.textContent = "";
      const p = el("p", "cd-empty", "The listings could not be loaded. Reload the page to try again.");
      listEl.appendChild(p);
      return;
    }

    const found = churches.filter(matches);
    lastFound = found;
    if (countEl) countEl.textContent = countText(found.length);

    if (!found.length) {
      const p = el("p", "cd-empty");
      p.appendChild(document.createTextNode("No churches match those filters. "));
      const clear = el("button", "cd-empty-clear", "Clear filters");
      clear.type = "button";
      clear.addEventListener("click", clearFilters);
      p.appendChild(clear);
      p.appendChild(document.createTextNode(" or "));
      const link = el("a", null, "add your church");
      link.href = "#add";
      p.appendChild(link);
      p.appendChild(document.createTextNode("."));
      listEl.appendChild(p);
      return;
    }

    /* Country, then state inside it, both alphabetical. A church with no
       state sits directly under its country rather than under an
       invented heading. */
    const byCountry = new Map();
    found.forEach((c) => {
      const key = countryNameOf(c) || NOT_GIVEN;
      if (!byCountry.has(key)) byCountry.set(key, []);
      byCountry.get(key).push(c);
    });

    uniqueSorted(Array.from(byCountry.keys())).forEach((countryName) => {
      const group = el("section", "cd-group");
      group.appendChild(el("h2", "cd-group-country", countryName));

      const rows = byCountry.get(countryName);
      const withState = new Map();
      const without = [];
      rows.forEach((c) => {
        const s = stateNameOf(c);
        if (!s) { without.push(c); return; }
        if (!withState.has(s)) withState.set(s, []);
        withState.get(s).push(c);
      });

      if (without.length) {
        const cards = el("div", "cd-cards");
        without.sort(sortByName).forEach((c) => cards.appendChild(cardFor(c)));
        group.appendChild(cards);
      }

      uniqueSorted(Array.from(withState.keys())).forEach((stateName) => {
        group.appendChild(el("h3", "cd-group-state", stateName));
        const cards = el("div", "cd-cards");
        withState.get(stateName).sort(sortByName).forEach((c) => cards.appendChild(cardFor(c)));
        group.appendChild(cards);
      });

      listEl.appendChild(group);
    });
  };

  /* ── One church ────────────────────────────────────────────────── */

  const findChurch = (slug) => {
    const want = str(slug);
    for (let i = 0; i < churches.length; i++) {
      if (str(churches[i].slug) === want) return churches[i];
    }
    return null;
  };

  const renderChurch = (church) => {
    currentChurch = church;
    const set = (sel, text) => { const node = $(sel); if (node) node.textContent = text; };
    set("[data-cd-detail-name]", str(church.name));
    set("[data-cd-detail-place]", placeOf(church) || NOT_GIVEN);
    set("[data-cd-detail-description]", str(church.description) || "No description yet.");
    set("[data-cd-detail-tradition]", str(church.tradition) || NOT_GIVEN);
    set("[data-cd-detail-times]", str(church.serviceTimes) || NOT_GIVEN);
    set("[data-cd-detail-address]", str(church.address) || NOT_GIVEN);
    /* The website is text, not a link. It is whatever someone typed, and
       nobody has checked that it resolves, let alone that it belongs to
       the church. */
    set("[data-cd-detail-website]", str(church.website) || NOT_GIVEN);

    const badge = $(".cd-detail-badges .cd-badge");
    if (badge) badge.textContent = badgeText(church);

    const claim = $("[data-cd-claim-link]");
    if (claim) claim.href = `#claim/${encodeURIComponent(str(church.slug))}`;
  };

  /* ── The form ──────────────────────────────────────────────────── */

  const FIELD_LABELS = {
    church_name: "Church name",
    city: "City",
    country: "Country",
    your_name: "Your name",
    email: "Email",
    authorized: "Authorization",
  };
  const REQUIRED_MESSAGES = {
    church_name: "Enter the name of the church.",
    city: "Enter the city the church is in.",
    country: "Choose a country.",
    your_name: "Enter your name.",
    email: "Enter your email address.",
    authorized: "Check the box to confirm the church agrees to appear.",
  };

  const fieldEl = (name) => $(`[data-cd-field="${name}"]`);
  const errorEl = (name) => $(`[data-cd-error="${name}"]`);

  const showError = (name, message) => {
    const field = fieldEl(name);
    const node = errorEl(name);
    if (node) {
      node.textContent = message;
      node.classList.toggle("is-shown", !!message);
    }
    if (field) {
      if (message) field.setAttribute("aria-invalid", "true");
      else field.removeAttribute("aria-invalid");
    }
  };

  const clearErrors = () => {
    Object.keys(REQUIRED_MESSAGES).forEach((name) => showError(name, ""));
    if (summaryEl) summaryEl.hidden = true;
    if (summaryList) summaryList.textContent = "";
  };

  const validate = () => {
    const problems = [];
    Object.keys(REQUIRED_MESSAGES).forEach((name) => {
      const field = fieldEl(name);
      if (!field) return;
      const empty = field.type === "checkbox" ? !field.checked : !str(field.value);
      if (empty) problems.push({ name, message: REQUIRED_MESSAGES[name] });
    });

    const email = fieldEl("email");
    if (email && str(email.value) && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(str(email.value))) {
      problems.push({ name: "email", message: "Enter an email address with an @ and a domain." });
    }

    clearErrors();
    problems.forEach((p) => showError(p.name, p.message));

    if (problems.length && summaryEl && summaryList) {
      /* Buttons, not links. A real href of "#cd-field-city" would set the
         hash, and the hash is what chooses the view, so every click in
         this summary would navigate away from the form it belongs to. */
      problems.forEach((p) => {
        const li = el("li");
        const jump = el("button", null, FIELD_LABELS[p.name] || p.name);
        jump.type = "button";
        jump.addEventListener("click", () => {
          const field = fieldEl(p.name);
          if (field) field.focus();
        });
        li.appendChild(jump);
        li.appendChild(document.createTextNode(`: ${p.message}`));
        summaryList.appendChild(li);
      });
      summaryEl.hidden = false;
      if (summaryHeading) summaryHeading.focus();
    }
    return problems.length === 0;
  };

  const syncCharCount = () => {
    const field = fieldEl("description");
    if (!field || !charEl) return;
    const left = Math.max(0, DESCRIPTION_MAX - field.value.length);
    charEl.textContent = `${left} ${left === 1 ? "character" : "characters"} left`;
  };

  const resetForm = () => {
    if (form) {
      form.reset();
      form.hidden = false;
    }
    if (doneEl) doneEl.hidden = true;
    clearErrors();
    syncCharCount();
  };

  const prefillFrom = (church) => {
    const put = (name, value) => {
      const field = fieldEl(name);
      if (field) field.value = value;
    };
    put("church_name", str(church.name));
    put("address", str(church.address));
    put("city", str(church.city));
    put("state", str(church.state));
    put("website", str(church.website));
    put("service_times", str(church.serviceTimes));
    put("description", str(church.description));

    const country = fieldEl("country");
    if (country) country.value = str(church.country);
    const tradition = fieldEl("tradition");
    if (tradition) tradition.value = str(church.tradition);
    syncCharCount();
  };

  const setFormMode = (church) => {
    resetForm();
    if (church) {
      if (formTitle) formTitle.textContent = "Claim this listing";
      if (formSub) formSub.textContent = "Correct anything that is wrong. We confirm every listing with the church before it appears.";
      if (claimingEl) {
        claimingEl.textContent = `You are claiming ${str(church.name)}.`;
        claimingEl.hidden = false;
      }
      prefillFrom(church);
    } else {
      if (formTitle) formTitle.textContent = "Add your church";
      if (formSub) formSub.textContent = "Tell us about the congregation. We confirm every listing with the church before it appears.";
      if (claimingEl) { claimingEl.textContent = ""; claimingEl.hidden = true; }
    }
  };

  /* ── Country and tradition options inside the form ─────────────── */

  const fillFormSelects = () => {
    const countrySelect = $("[data-cd-country-select]");
    if (countrySelect) {
      const names = {};
      churches.forEach((c) => { const code = str(c.country); if (code) names[code] = countryNameOf(c); });
      countrySelect.textContent = "";
      countrySelect.appendChild(el("option", null, "Choose a country")).value = "";
      uniqueSorted(Object.keys(names).map((code) => names[code])).forEach((name) => {
        const code = Object.keys(names).filter((k) => names[k] === name)[0];
        const opt = el("option", null, name);
        opt.value = code;
        countrySelect.appendChild(opt);
      });
      /* The list is built from the listings, so a church anywhere
         else had no country to choose and could not get past a required
         field. The real directory would carry the full list. */
      countrySelect.appendChild(el("option", null, "Another country")).value = "other";
    }
    const traditionSelect = $("[data-cd-tradition-select]");
    if (traditionSelect) {
      traditionSelect.textContent = "";
      traditionSelect.appendChild(el("option", null, "Choose a tradition")).value = "";
      uniqueSorted(churches.map((c) => str(c.tradition))).forEach((t) => {
        traditionSelect.appendChild(el("option", null, t)).value = t;
      });
    }
  };

  /* ── The map ───────────────────────────────────────────────────── */

  const SVG_NS = "http://www.w3.org/2000/svg";
  const MAP_W = 1000;
  const MAX_LAT = 84;
  const PIN_PX = 6;

  let mapData = null;
  let directoryMap = null;
  let detailMap = null;

  const prefersReducedMotion = () => !!(window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches);

  const svgEl = (tag, attrs) => {
    const node = document.createElementNS(SVG_NS, tag);
    if (attrs) Object.keys(attrs).forEach((k) => node.setAttribute(k, String(attrs[k])));
    return node;
  };

  const hasPlace = (c) => Number.isFinite(c.lat) && Number.isFinite(c.lon);

  /* Web Mercator into a 1000-unit square, exactly as the outline file was
     built. Change one and the pins land in the sea. */
  const project = (lat, lon) => {
    const phi = Math.max(-MAX_LAT, Math.min(MAX_LAT, lat)) * Math.PI / 180;
    return [
      (lon + 180) / 360 * MAP_W,
      (1 - Math.log(Math.tan(Math.PI / 4 + phi / 2)) / Math.PI) / 2 * MAP_W,
    ];
  };

  const makeMap = (frame, minSpan, onZoom) => {
    const svg = svgEl("svg", { class: "cd-map-svg", role: "img", preserveAspectRatio: "xMidYMid meet" });
    const land = svgEl("g", { class: "cd-map-land" });
    mapData.countries.forEach((c) => land.appendChild(svgEl("path", { d: c.d })));
    const states = svgEl("g", { class: "cd-map-states" });
    mapData.states.forEach((st) => states.appendChild(svgEl("path", { d: st.d })));
    /* Two layers, every tap circle under every dot. With one <a> per
       church holding both, a later church's 44px tap circle painted over
       an earlier church's dot, and tapping that dot opened the wrong
       church. Now a tap on a visible dot always lands on its own link;
       only a tap on empty ground between pins falls to a tap circle. */
    const hits = svgEl("g", { class: "cd-map-hits", "aria-hidden": "true" });
    const pins = svgEl("g", { class: "cd-map-pins" });
    svg.appendChild(land);
    svg.appendChild(states);
    const clusters = svgEl("g", { class: "cd-map-clusters" });
    svg.appendChild(hits);
    svg.appendChild(pins);
    svg.appendChild(clusters);
    let pinEls = [];
    frame.textContent = "";
    frame.appendChild(svg);

    let vb = { x: 0, y: 160, w: MAP_W, h: 560 };
    let shown = [];
    let anim = 0;

    /* Pins stay the same size on screen at every zoom, so their radius is
       recomputed in map units whenever the view moves. Their outline does
       the same with vector-effect in the stylesheet. */
    /* Placing the pins, at every zoom (it runs on each frame of a zoom).
       Pins closer than a pin's width are grouped. Two or three in a group
       are set apart on a small ring around where they really are; four or
       more, while there is still room to zoom in, become one dark marker
       with a count, and clicking it zooms to them. Any two placed things
       that touch are merged and placed again, until nothing touches, so
       one dot never hides another and every visible dot opens its own
       church. Clusters, not rings, at wide zoom: a ring big enough for
       forty pins circles a continent. */
    const sizePins = () => {
      const unit = vb.w / (frame.clientWidth || 1);
      const r = unit * PIN_PX;
      const rc = unit * 13;
      const gap = unit * 3;
      /* The pin a reader sees is 12px across; the circle that takes the
         tap is 44px on a touch screen, the site's minimum target, and
         28px under a mouse. It is transparent, so it is felt and not
         seen. */
      const coarse = !!(window.matchMedia && window.matchMedia("(pointer: coarse)").matches);
      const hitR = unit * (coarse ? 22 : 14);
      const canZoom = vb.w > minSpan * 1.7;

      const group = pinEls.map((_, i) => i);
      const find = (i) => (group[i] === i ? i : (group[i] = find(group[i])));
      const join = (i, j) => { group[find(j)] = find(i); };
      for (let i = 0; i < pinEls.length; i++) {
        for (let j = i + 1; j < pinEls.length; j++) {
          if (Math.hypot(pinEls[i].x - pinEls[j].x, pinEls[i].y - pinEls[j].y) < r * 2.2) join(i, j);
        }
      }

      const layout = () => {
        const members = {};
        pinEls.forEach((_, i) => { const g = find(i); (members[g] = members[g] || []).push(i); });
        return Object.keys(members).map((g) => {
          const list = members[g];
          const cx = list.reduce((n, i) => n + pinEls[i].x, 0) / list.length;
          const cy = list.reduce((n, i) => n + pinEls[i].y, 0) / list.length;
          if (list.length >= 4 && canZoom) return { list, cluster: true, dots: [{ x: cx, y: cy, rad: rc }] };
          if (list.length === 1) return { list, cluster: false, dots: [{ i: list[0], x: cx, y: cy, rad: r }] };
          /* The chord between two pins on the ring is 2R·sin(π/n), held a
             little over one pin's width. */
          const ring = Math.max(r * 1.25, (r * 1.15) / Math.sin(Math.PI / list.length));
          return {
            list,
            cluster: false,
            dots: list.map((i, k) => {
              const angle = (k / list.length) * Math.PI * 2 - Math.PI / 2;
              return { i, x: cx + Math.cos(angle) * ring, y: cy + Math.sin(angle) * ring, rad: r };
            }),
          };
        });
      };

      let items = layout();
      for (let pass = 0; pass < pinEls.length; pass++) {
        let merged = false;
        for (let a = 0; a < items.length && !merged; a++) {
          for (let b = a + 1; b < items.length && !merged; b++) {
            const touch = items[a].dots.some((p) => items[b].dots.some((q) => Math.hypot(p.x - q.x, p.y - q.y) < p.rad + q.rad + gap));
            if (touch) { join(items[a].list[0], items[b].list[0]); merged = true; }
          }
        }
        if (!merged) break;
        items = layout();
      }

      clusters.textContent = "";
      items.forEach((item) => {
        if (item.cluster) {
          item.list.forEach((i) => { pinEls[i].hitLink.setAttribute("visibility", "hidden"); pinEls[i].link.setAttribute("visibility", "hidden"); });
          const [{ x, y }] = item.dots;
          const g = svgEl("g", { class: "cd-map-cluster" });
          const title = svgEl("title");
          title.textContent = `${item.list.length} churches here. Select to zoom in.`;
          g.appendChild(title);
          g.appendChild(svgEl("circle", { cx: x.toFixed(3), cy: y.toFixed(3), r: String(rc) }));
          const label = svgEl("text", { x: x.toFixed(3), y: y.toFixed(3), "font-size": String(unit * 12), "text-anchor": "middle", "dominant-baseline": "central" });
          label.textContent = String(item.list.length);
          g.appendChild(label);
          g.addEventListener("click", () => {
            moveTo(target(item.list.map((i) => pinEls[i].c)), true);
            if (onZoom) onZoom(true);
          });
          clusters.appendChild(g);
          return;
        }
        item.dots.forEach(({ i, x, y }) => {
          const { hit, dot, hitLink, link } = pinEls[i];
          hitLink.removeAttribute("visibility");
          link.removeAttribute("visibility");
          [hit, dot].forEach((c) => {
            c.setAttribute("cx", x.toFixed(3));
            c.setAttribute("cy", y.toFixed(3));
          });
          hit.setAttribute("r", String(hitR));
          dot.setAttribute("r", String(r));
        });
      });
    };

    const apply = (b) => {
      vb = b;
      svg.setAttribute("viewBox", `${b.x} ${b.y} ${b.w} ${b.h}`);
      sizePins();
    };

    const target = (list) => {
      const aspect = (frame.clientWidth && frame.clientHeight) ? frame.clientWidth / frame.clientHeight : 16 / 7;
      const pts = list.filter(hasPlace).map((c) => project(c.lat, c.lon));
      if (!pts.length) return { x: 0, y: 160, w: MAP_W, h: MAP_W / aspect };
      let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
      pts.forEach(([x, y]) => {
        minX = Math.min(minX, x); maxX = Math.max(maxX, x);
        minY = Math.min(minY, y); maxY = Math.max(maxY, y);
      });
      /* A third again on every side, and never closer in than minSpan, so
         a single church shows its region rather than one blank square of
         county. */
      let w = Math.max(maxX - minX, (maxY - minY) * aspect, minSpan) * 1.6;
      w = Math.min(w, MAP_W);
      const h = w / aspect;
      const cx = (minX + maxX) / 2;
      const cy = (minY + maxY) / 2;
      return { x: cx - w / 2, y: cy - h / 2, w, h };
    };

    const moveTo = (b, animate) => {
      if (anim) cancelAnimationFrame(anim);
      if (!animate || prefersReducedMotion()) { apply(b); return; }
      const from = { ...vb };
      const t0 = performance.now();
      const ms = 420;
      const ease = (t) => (t < 0.5 ? 2 * t * t : 1 - ((-2 * t + 2) ** 2) / 2);
      const step = (now) => {
        const t = Math.min(1, (now - t0) / ms);
        const k = ease(t);
        apply({
          x: from.x + (b.x - from.x) * k,
          y: from.y + (b.y - from.y) * k,
          w: from.w + (b.w - from.w) * k,
          h: from.h + (b.h - from.h) * k,
        });
        anim = t < 1 ? requestAnimationFrame(step) : 0;
      };
      anim = requestAnimationFrame(step);
    };

    const show = (list, animate) => {
      shown = list;
      hits.textContent = "";
      pins.textContent = "";
      pinEls = [];
      /* Southern pins drawn last, so where two overlap the one lower on
         the map sits in front, as it would on paper. */
      list.filter(hasPlace)
        .map((c) => ({ c, p: project(c.lat, c.lon) }))
        .sort((a, b) => a.p[1] - b.p[1])
        .forEach(({ c, p }) => {
          const href = `#church/${encodeURIComponent(str(c.slug))}`;

          const hitLink = svgEl("a", { href, tabindex: "-1" });
          const hit = svgEl("circle", { class: "cd-map-hit", cx: p[0].toFixed(3), cy: p[1].toFixed(3), r: 1 });
          hitLink.appendChild(hit);
          hits.appendChild(hitLink);

          const a = svgEl("a", { class: "cd-map-pin", href, tabindex: "-1" });
          const title = svgEl("title");
          title.textContent = [str(c.name), placeOf(c)].filter(Boolean).join(", ");
          a.appendChild(title);
          const dot = svgEl("circle", { class: "cd-map-dot", cx: p[0].toFixed(3), cy: p[1].toFixed(3), r: 1 });
          a.appendChild(dot);
          pins.appendChild(a);

          pinEls.push({ c, x: p[0], y: p[1], hit, dot, hitLink, link: a });
        });
      moveTo(target(list), animate);
      if (onZoom) onZoom(false);
    };

    const refit = () => { if (frame.clientWidth) moveTo(target(shown), false); };
    const label = (text) => svg.setAttribute("aria-label", text);

    /* Back out of a cluster to the view the filters chose. */
    const reset = () => { moveTo(target(shown), true); if (onZoom) onZoom(false); };

    return { show, refit, label, reset };
  };

  const mapFigure = $("[data-cd-map]");
  const mapFrame = $("[data-cd-map-frame]");
  const mapCaption = $("[data-cd-map-caption]");
  const mapReset = $("[data-cd-map-reset]");
  const detailFigure = $("[data-cd-detail-map]");
  const detailFrame = $("[data-cd-detail-map-frame]");

  const syncDirectoryMap = (animate) => {
    if (!mapFigure || !mapFrame) return;
    const placed = churches.filter(hasPlace);
    if (!mapData || !placed.length || loadFailed) { mapFigure.hidden = true; return; }
    mapFigure.hidden = false;
    if (!directoryMap) {
      directoryMap = makeMap(mapFrame, 40, (zoomed) => { if (mapReset) mapReset.hidden = !zoomed; });
      if (mapReset) mapReset.addEventListener("click", () => directoryMap.reset());
    }

    const onMap = lastFound.filter(hasPlace).length;
    const off = lastFound.length - onMap;
    const noun = onMap === 1 ? "church" : "churches";
    /* The count is the line above; the caption says what the map is for,
       and that a reader who cannot use the pins loses nothing. */
    let caption = onMap
      ? "Select a pin to open a church. Every church on the map is also in the list below."
      : "No church on the map matches these filters.";
    if (off > 0) caption += ` ${off} more ${off === 1 ? "is" : "are"} not on the map yet.`;
    /* ODbL: the pins are OpenStreetMap data, and the credit has to be
       visible wherever they are shown. */
    caption += " Church locations © OpenStreetMap contributors.";
    if (mapCaption) mapCaption.textContent = caption;
    directoryMap.label(onMap ? `Map of the ${onMap} ${noun} listed below.` : "Map with no churches shown.");
    directoryMap.show(lastFound, animate);
  };

  const syncDetailMap = () => {
    if (!detailFigure || !detailFrame) return;
    if (!mapData || !currentChurch || !hasPlace(currentChurch)) { detailFigure.hidden = true; return; }
    detailFigure.hidden = false;
    /* Regional, not street level. Outside the US the outlines are the
       1:110m world file, which reads well across a region and turns
       visibly blocky closer in; and a locator map answers "where is
       this", which a region answers. */
    if (!detailMap) detailMap = makeMap(detailFrame, 100);
    detailMap.label(`Map showing where ${str(currentChurch.name)} is.`);
    detailMap.show([currentChurch], false);
  };

  let resizeQueued = false;
  window.addEventListener("resize", () => {
    if (resizeQueued) return;
    resizeQueued = true;
    requestAnimationFrame(() => {
      resizeQueued = false;
      if (directoryMap && views.directory && !views.directory.hidden) directoryMap.refit();
      if (detailMap && views.church && !views.church.hidden) detailMap.refit();
    });
  });

  /* ── Views ─────────────────────────────────────────────────────── */

  const focusHeading = (name) => {
    const heading = headings[name];
    if (!heading) return;
    /* preventScroll, then scroll the page to the top ourselves. Focusing
       a heading scrolls IT to the top, and the prototype notice sits
       above all three views, so that would push the one line saying
       "none of this is real" off the screen on every view change. The
       top of the page is the notice, and each view's heading is the next
       thing under it, so this lands both. */
    try {
      heading.focus({ preventScroll: true });
    } catch (e) {
      heading.focus();
    }
    /* Instant, not smooth. A smooth scroll races the focus call and the
       repaint and settles tens of pixels short, which is enough to leave
       the notice tucked under the fixed masthead. A view change is a
       page change to the reader; it should land, not glide.

       "instant" rather than "auto": screen.css sets
       `html { scroll-behavior: smooth }`, and "auto" means "do whatever
       the CSS says", which is the smooth scroll this is avoiding. */
    try {
      window.scrollTo({ top: 0, left: 0, behavior: "instant" });
    } catch (e) {
      window.scrollTo(0, 0);
    }
  };

  const showView = (name, title, moveFocus) => {
    Object.keys(views).forEach((key) => {
      if (views[key]) views[key].hidden = key !== name;
    });
    document.title = title;
    if (moveFocus) focusHeading(name);
  };

  const syncBackLinks = () => {
    $$("[data-cd-back]").forEach((a) => { a.href = directoryHash(); });
  };

  /* decodeURIComponent throws on a stray "%" ("#church/%E0"). Thrown on
     first load, that landed in the listings' catch and reported that the
     listings had failed, which they had not. */
  const safeDecode = (v) => {
    try {
      return decodeURIComponent(v);
    } catch (e) {
      return "";
    }
  };

  const parseHash = () => {
    const raw = String(window.location.hash || "").replace(/^#/, "");
    const [path, query] = raw.split("?");
    return { path: path || "", query: query || "" };
  };

  /* A query in the address is the WHOLE filter state, not a patch over
     what is in storage. Merging them meant that opening
     "#?country=US&state=Texas" after a search for something unfindable
     kept the old search word and answered "No churches match". A filter
     the address does not mention is a filter that is not set. */
  const applyQueryToFilters = (query) => {
    if (!query) return false;
    const p = new URLSearchParams(query);
    FILTER_KEYS.forEach((k) => { filters[k] = p.get(k) || ""; });
    return true;
  };

  const route = (moveFocus) => {
    const { path, query } = parseHash();

    const church = /^church\/(.+)$/.exec(path);
    if (church) {
      const found = findChurch(safeDecode(church[1]));
      if (found) {
        renderChurch(found);
        syncBackLinks();
        showView("church", `${str(found.name)} | ${TITLE_SUFFIX}`, moveFocus);
        syncDetailMap();
        return;
      }
      /* An unknown slug is not an error page in a prototype: it is the
         directory, which is where the reader wanted to be. replaceState,
         not a new hash: a pushed entry put the bad address one Back away,
         and Back then bounced straight forward again. */
      if (window.history && window.history.replaceState) {
        window.history.replaceState(null, "", directoryHash());
        route(moveFocus);
      } else {
        window.location.hash = directoryHash();
      }
      return;
    }

    const claim = /^claim\/(.+)$/.exec(path);
    if (claim) {
      const found = findChurch(safeDecode(claim[1]));
      setFormMode(found || null);
      syncBackLinks();
      showView("form", `${found ? `Claim ${str(found.name)}` : "Add your church"} | ${TITLE_SUFFIX}`, moveFocus);
      return;
    }

    if (path === "add") {
      setFormMode(null);
      syncBackLinks();
      showView("form", `Add your church | ${TITLE_SUFFIX}`, moveFocus);
      return;
    }

    if (applyQueryToFilters(query)) saveFilters();
    else if (anyFilterSet() && window.history && window.history.replaceState) {
      /* Filters restored from this session's storage, with nothing in the
         address to show for them. Write them into the address, or the
         reader sees a filtered list at a bare URL and has no way to tell
         what is filtering it. */
      window.history.replaceState(null, "", directoryHash());
    }
    syncSelects();
    renderList();
    syncBackLinks();
    showView("directory", TITLE_SUFFIX, moveFocus);
    /* After showView, not before: a map drawn into a hidden view has no
       width to fit itself to. */
    syncDirectoryMap(false);
  };

  /* ── Events ────────────────────────────────────────────────────── */

  function clearFilters() {
    clearTimeout(searchTimer);
    FILTER_KEYS.forEach((k) => { filters[k] = ""; });
    if (qInput) qInput.value = "";
    onFilterChange();
    if (qInput) qInput.focus();
  }

  const onFilterChange = () => {
    saveFilters();
    syncSelects();
    renderList();
    syncDirectoryMap(true);
    syncBackLinks();
    /* replaceState rather than a new hash, so dragging a slider of
       filters does not bury the reader's Back button under twenty
       directory states. */
    if (window.history && window.history.replaceState) {
      window.history.replaceState(null, "", directoryHash());
    }
  };

  /* Search waits for a pause in typing. Otherwise the live count is read
     aloud after every letter and the map flies on every keystroke. */
  let searchTimer = 0;
  if (qInput) {
    qInput.addEventListener("input", () => {
      clearTimeout(searchTimer);
      searchTimer = setTimeout(() => { filters.q = qInput.value; onFilterChange(); }, 250);
    });
  }
  if (countrySel) {
    countrySel.addEventListener("change", () => {
      filters.country = countrySel.value;
      filters.state = "";
      filters.city = "";
      onFilterChange();
    });
  }
  if (stateSel) {
    stateSel.addEventListener("change", () => { filters.state = stateSel.value; filters.city = ""; onFilterChange(); });
  }
  if (citySel) {
    citySel.addEventListener("change", () => { filters.city = citySel.value; onFilterChange(); });
  }
  if (traditionSel) {
    traditionSel.addEventListener("change", () => { filters.tradition = traditionSel.value; onFilterChange(); });
  }
  if (clearBtn) clearBtn.addEventListener("click", clearFilters);

  /* A fixed field drops its error at once, rather than shouting until the
     next submit. Only that field's own message; the summary is redrawn on
     the next submit. */
  Object.keys(REQUIRED_MESSAGES).forEach((name) => {
    const field = fieldEl(name);
    if (!field) return;
    const clearIfFixed = () => {
      const filled = field.type === "checkbox" ? field.checked : !!str(field.value);
      if (filled && field.getAttribute("aria-invalid") === "true") showError(name, "");
    };
    field.addEventListener("input", clearIfFixed);
    field.addEventListener("change", clearIfFixed);
  });

  const descriptionField = fieldEl("description");
  if (descriptionField) descriptionField.addEventListener("input", syncCharCount);

  if (form) {
    form.addEventListener("submit", (event) => {
      /* THE PROTOTYPE SENDS NOTHING. No fetch, no XHR, no beacon, and the
         default submit is cancelled so the browser cannot post the form
         either. What the reader typed stays in the page and goes nowhere. */
      event.preventDefault();
      if (!validate()) return;
      form.hidden = true;
      if (doneEl) {
        doneEl.hidden = false;
        syncBackLinks();
        const heading = $("[data-cd-done-heading]");
        if (heading) {
          try {
            heading.focus({ preventScroll: true });
          } catch (e) {
            heading.focus();
          }
          if (heading.scrollIntoView) heading.scrollIntoView({ block: "start" });
        }
      }
    });
  }

  /* Before the listings arrive, every slug looks unknown and would be
     bounced to the directory. Ignore the change; the first route() after
     loading reads whatever the hash is by then. */
  window.addEventListener("hashchange", () => {
    if (!churches.length && !loadFailed) return;
    route(true);
  });

  /* ── Boot ──────────────────────────────────────────────────────── */

  const dataUrl = (path) => (window.moDataUrl ? window.moDataUrl(path)
    : window.moAssetUrl ? window.moAssetUrl(path)
      : path);

  /* The outlines are fetched alongside the listings and never wait on
     them, and a failure here only hides the map. The list is the page;
     the map is a picture of it. */
  /* Everything below waits on the password prompt, so a visitor who
     never gets past it never fetches the listings. */
  function start() {
  const mapReady = fetch(dataUrl(MAP_PATH), { credentials: "omit" })
    .then((res) => (res.ok ? res.json() : null))
    .then((m) => (m && Array.isArray(m.countries) && Array.isArray(m.states) ? m : null))
    .catch(() => null);

  fetch(dataUrl(DATA_PATH), { credentials: "omit" })
    .then((res) => {
      if (!res.ok) throw new Error(String(res.status));
      return res.json();
    })
    .then((data) => {
      churches = Array.isArray(data) ? data.filter((c) => c && str(c.slug) && str(c.name)) : [];
      if (!churches.length) throw new Error("empty");
      loadFilters();
      fillFormSelects();
      syncCharCount();
      /* No focus move on the first paint: the reader did not navigate
         here, they arrived, and stealing focus on load moves the page
         out from under them. */
      route(false);
      /* Detached from this chain on purpose: if drawing the map throws,
         the catch below would otherwise report that the LISTINGS failed
         to load, and blank a list that loaded fine. */
      mapReady.then((m) => {
        mapData = m;
        if (views.directory && !views.directory.hidden) syncDirectoryMap(false);
        if (views.church && !views.church.hidden) syncDetailMap();
      }).catch(() => {
        mapData = null;
        if (mapFigure) mapFigure.hidden = true;
        if (detailFigure) detailFigure.hidden = true;
      });
    })
    .catch(() => {
      loadFailed = true;
      churches = [];
      if (clearBtn) clearBtn.hidden = true;
      $$(".cd-filters .cd-input, .cd-filters .cd-select").forEach((control) => { control.disabled = true; });
      renderList();
      route(false);
    });
  }

  /* ── Password prompt ───────────────────────────────────────────
     Not a lock (Ian chose this knowing it): the hash and the listings
     file are both public. It keeps a casual visitor out. A pass is
     remembered for the browser tab. */
  const PASS_SHA256 = "a5b31120963e06c86d62de6234875ca944dc1a15a4944037fb02ca1298e273b2";
  const UNLOCK_KEY = "cd-unlocked";
  const lockEl = $("[data-cd-lock]");
  const contentEl = $("[data-cd-content]");

  const sha256 = (text) => crypto.subtle.digest("SHA-256", new TextEncoder().encode(text))
    .then((buf) => Array.from(new Uint8Array(buf), (b) => b.toString(16).padStart(2, "0")).join(""));

  const unlock = () => {
    if (lockEl) lockEl.hidden = true;
    if (contentEl) contentEl.hidden = false;
    start();
  };

  let passed = false;
  try { passed = sessionStorage.getItem(UNLOCK_KEY) === PASS_SHA256; } catch (_) { /* storage blocked */ }

  if (passed || !lockEl || !window.crypto || !crypto.subtle) {
    unlock();
  } else {
    lockEl.hidden = false;
    const lockForm = $("[data-cd-lock-form]");
    const pw = $("[data-cd-lock-pw]");
    const err = $("[data-cd-lock-error]");
    lockForm.addEventListener("submit", (e) => {
      e.preventDefault();
      sha256(pw.value).then((hash) => {
        if (hash !== PASS_SHA256) {
          err.hidden = false;
          pw.setAttribute("aria-invalid", "true");
          pw.select();
          return;
        }
        try { sessionStorage.setItem(UNLOCK_KEY, hash); } catch (_) { /* storage blocked */ }
        unlock();
      });
    });
    pw.addEventListener("input", () => { err.hidden = true; pw.removeAttribute("aria-invalid"); });
  }
}());
