/*
 * /admin/emails/ — edit the copy inside every automatic email.
 *
 * The design is not editable here on purpose. The shell (masthead,
 * measure, typeface, dark-mode handling, footer, unsubscribe) lives in
 * workers/_shared/email-layout.js and is version-controlled, because a
 * stray paste in the wrong place breaks Outlook for everyone. This page
 * owns the words, which are Ian's and should never wait on a deploy.
 *
 * Preview posts the CURRENT editor state, saved or not, and the worker
 * renders it through the real shell with sample values. So the frame
 * shows what a reader gets, not an approximation of it.
 */
(function () {
  const root = document.querySelector("[data-admin-emails]");
  if (!root || !window.MOAuth) return;

  const WORKER = (root.getAttribute("data-worker-url") || "").replace(/\/$/, "");
  if (!WORKER) return;

  const statusEl = root.querySelector("[data-emails-status]");
  const layout = root.querySelector("[data-emails-layout]");
  const listEl = root.querySelector("[data-emails-list]");
  const editor = root.querySelector("[data-emails-editor]");
  const frame = root.querySelector("[data-emails-frame]");
  const sizeEl = root.querySelector("[data-emails-size]");
  const savedEl = root.querySelector("[data-emails-saved]");
  const varsEl = root.querySelector("[data-emails-vars]");
  const saveBtn = root.querySelector("[data-emails-save]");

  const FIELDS = ["subject", "preheader", "eyebrow", "title", "body_html"];
  const input = (f) => root.querySelector(`[data-email-field="${f}"]`);

  let templates = [];
  let current = null;
  let dirty = false;

  function api(path, opts) {
    return window.MOAuth.fetch(`${WORKER}${path}`, {
      mode: "cors", credentials: "omit", ...(opts || {}),
    });
  }

  function fail(msg) {
    if (statusEl) {
      statusEl.hidden = false;
      statusEl.textContent = msg;
    }
  }

  // ── The list ──────────────────────────────────────────────────
  function paintList() {
    listEl.innerHTML = "";
    templates.forEach((t) => {
      const b = document.createElement("button");
      b.type = "button";
      b.className = "admin-emails-item";
      if (current && current.key === t.key) b.classList.add("is-on");
      b.innerHTML =
        `<span class="admin-emails-item-label">${esc(t.label)}</span>` +
        `<span class="admin-emails-item-key">${esc(t.key)}</span>${
          t.description ? `<span class="admin-emails-item-desc">${esc(t.description)}</span>` : ""}`;
      b.addEventListener("click", () => {
        // A half-typed edit is worth more than a click, so ask before
        // throwing it away.
        if (dirty && !window.confirm("You have unsaved changes. Discard them?")) return;
        open(t.key);
      });
      listEl.appendChild(b);
    });
  }

  function open(key) {
    api(`/email-templates/${encodeURIComponent(key)}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (!data || !data.template) return fail("Could not load that template.");
        current = data.template;
        dirty = false;
        FIELDS.forEach((f) => {
          const el = input(f);
          if (el) el.value = current[f] == null ? "" : current[f];
        });
        varsEl.textContent = current.vars
          ? `Available: ${current.vars.split(/\s*,\s*/).map((v) => `{{${v}}}`).join("  ")}`
          : "This email takes no variables.";
        editor.hidden = false;
        paintList();
        preview();
      })
      .catch(() => fail("Could not load that template."));
  }

  // ── Preview ───────────────────────────────────────────────────
  let previewTimer = 0;
  function schedulePreview() {
    dirty = true;
    savedEl.hidden = true;
    window.clearTimeout(previewTimer);
    previewTimer = window.setTimeout(preview, 350);
  }

  function preview() {
    const payload = {};
    FIELDS.forEach((f) => { const el = input(f); if (el) payload[f] = el.value; });
    api("/email-templates/preview", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    })
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (!data) return;
        // srcdoc with a sandboxed frame: this is our own HTML, but it is
        // HTML someone just typed into a textarea, and it has no business
        // running script or reaching the admin session around it.
        frame.srcdoc = data.html;
        const kb = (data.bytes / 1024).toFixed(1);
        sizeEl.textContent = data.clipRisk
          ? `${kb} KB — Gmail clips around 102 KB, so this one is close`
          : `${kb} KB`;
        sizeEl.classList.toggle("is-warn", !!data.clipRisk);
      })
      .catch(() => {});
  }

  // ── Save ──────────────────────────────────────────────────────
  function save() {
    if (!current) return;
    const payload = {};
    FIELDS.forEach((f) => { const el = input(f); if (el) payload[f] = el.value; });
    saveBtn.disabled = true;
    api(`/email-templates/${encodeURIComponent(current.key)}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    })
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error(String(r.status)))))
      .then(() => {
        dirty = false;
        savedEl.hidden = false;
        window.setTimeout(() => { savedEl.hidden = true; }, 2200);
      })
      .catch(() => fail("Could not save. Nothing was changed."))
      .then(() => { saveBtn.disabled = false; });
  }

  FIELDS.forEach((f) => {
    const el = input(f);
    if (el) el.addEventListener("input", schedulePreview);
  });
  saveBtn.addEventListener("click", save);

  // Leaving with unsaved copy in the box is almost always an accident.
  window.addEventListener("beforeunload", (e) => {
    if (!dirty) return;
    e.preventDefault();
    e.returnValue = "";
  });

  function esc(s) {
    return String(s == null ? "" : s).replace(/[&<>"']/g, (c) => (
      { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]
    ));
  }

  // ── Boot ──────────────────────────────────────────────────────
  api("/email-templates")
    .then((r) => (r.ok ? r.json() : Promise.reject(new Error(String(r.status)))))
    .then((data) => {
      templates = (data && data.templates) || [];
      statusEl.hidden = true;
      layout.hidden = false;
      paintList();
      if (templates.length) open(templates[0].key);
    })
    .catch(() => fail("Could not load the auto-responders."));
})();
