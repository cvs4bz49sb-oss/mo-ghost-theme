/*
 * Reading preferences for The Faith Received.
 *
 * Type size, face, line spacing and measure, plus a reading tint. Five
 * settings, each with a small fixed range, because a reader wants the
 * page to suit their eyes and does not want a design tool.
 *
 * Applied as data attributes and a custom property on <html>, so the
 * whole reader responds including anything rendered later, and stored
 * in localStorage under one key.
 *
 * Read before write. The store is only ever written from a real
 * interaction: a mount that saved its defaults would overwrite a
 * reader's saved settings with the defaults every time the page
 * loaded, which is how the email builder lost its history.
 */
(function () {
  const host = document.querySelector("[data-faith-prefs]");
  if (!host) return;

  const KEY = "mo-tfr-reading-prefs";
  const root = document.documentElement;

  // value -> what it does. The first entry of each is the default.
  const SETTINGS = {
    size: { label: "Size", values: ["s", "m", "l", "xl"], names: ["Small", "Medium", "Large", "Larger"], def: "m" },
    face: { label: "Face", values: ["serif", "sans"], names: ["Serif", "Sans"], def: "serif" },
    lead: { label: "Spacing", values: ["tight", "normal", "loose"], names: ["Tight", "Normal", "Loose"], def: "normal" },
    measure: { label: "Width", values: ["narrow", "normal", "wide"], names: ["Narrow", "Normal", "Wide"], def: "normal" },
    tint: { label: "Paper", values: ["default", "warm", "dark"], names: ["Default", "Warm", "Dark"], def: "default" },
  };

  function read() {
    try {
      const raw = window.localStorage.getItem(KEY);
      if (!raw) return {};
      const parsed = JSON.parse(raw);
      return parsed && typeof parsed === "object" ? parsed : {};
    } catch (_) {
      return {};
    }
  }

  function write(prefs) {
    try {
      window.localStorage.setItem(KEY, JSON.stringify(prefs));
    } catch (_) { /* private mode; the session still works */ }
  }

  const prefs = read();

  function valueOf(key) {
    const spec = SETTINGS[key];
    const v = prefs[key];
    return spec.values.indexOf(v) === -1 ? spec.def : v;
  }

  function apply() {
    Object.keys(SETTINGS).forEach((key) => {
      root.setAttribute(`data-fr-${key}`, valueOf(key));
    });
  }

  // Applied before the panel is built, so a reader's saved settings are
  // on the page from the first paint of the text rather than snapping
  // into place after it.
  apply();

  // ── The panel ────────────────────────────────────────────────
  const btn = document.createElement("button");
  btn.type = "button";
  btn.className = "faith-tool faith-prefs-toggle";
  btn.setAttribute("aria-expanded", "false");
  btn.setAttribute("aria-label", "Reading preferences");
  btn.innerHTML = `<span class="faith-prefs-icon" aria-hidden="true">Aa</span>`;

  const panel = document.createElement("div");
  panel.className = "faith-prefs-panel";
  panel.hidden = true;
  panel.setAttribute("role", "group");
  panel.setAttribute("aria-label", "Reading preferences");

  const rows = Object.keys(SETTINGS).map((key) => {
    const spec = SETTINGS[key];
    const opts = spec.values.map((v, i) =>
      `<button type="button" class="faith-prefs-opt" data-pref="${key}" data-val="${v}">${spec.names[i]}</button>`
    ).join("");
    return `<div class="faith-prefs-row"><span class="faith-prefs-label">${spec.label}</span><div class="faith-prefs-opts">${opts}</div></div>`;
  }).join("");
  const reset = `<div class="faith-prefs-row faith-prefs-row--reset"><button type="button" class="faith-prefs-reset" data-prefs-reset>Reset to defaults</button></div>`;
  panel.innerHTML = `${rows}${reset}`;

  function paint() {
    panel.querySelectorAll("[data-pref]").forEach((b) => {
      const on = valueOf(b.getAttribute("data-pref")) === b.getAttribute("data-val");
      b.setAttribute("aria-pressed", on ? "true" : "false");
      b.classList.toggle("is-active", on);
    });
  }

  panel.addEventListener("click", (e) => {
    const opt = e.target.closest("[data-pref]");
    if (opt) {
      prefs[opt.getAttribute("data-pref")] = opt.getAttribute("data-val");
      write(prefs);
      apply();
      paint();
      return;
    }
    if (e.target.closest("[data-prefs-reset]")) {
      Object.keys(SETTINGS).forEach((k) => delete prefs[k]);
      write(prefs);
      apply();
      paint();
    }
  });

  function close() {
    panel.hidden = true;
    btn.setAttribute("aria-expanded", "false");
  }

  btn.addEventListener("click", (e) => {
    e.stopPropagation();
    const open = panel.hidden;
    panel.hidden = !open;
    btn.setAttribute("aria-expanded", open ? "true" : "false");
    if (open) paint();
  });

  document.addEventListener("click", (e) => {
    if (!panel.hidden && !panel.contains(e.target) && e.target !== btn) close();
  });
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && !panel.hidden) { close(); btn.focus(); }
  });

  host.appendChild(btn);
  host.appendChild(panel);
  paint();
})();
