/*
 * /admin/settings/ — site settings + admin user management.
 *
 * Site settings: read/write journal status and gate config via KV.
 * Admin users: staff-only CRUD for non-staff admin permissions.
 */
(function () {
  const host = document.querySelector("[data-admin-settings]");
  if (!host) return;

  const workerUrl = host.getAttribute("data-worker-url");
  if (!workerUrl) return;

  // -----------------------------------------------------------------------
  // Tool definitions for permission checkboxes
  // -----------------------------------------------------------------------
  const TOOLS = [
    { id: "members", label: "Members", group: "Executive" },
    { id: "traffic", label: "Traffic", group: "Executive" },
    { id: "content", label: "Content Calendar", group: "Executive" },
    { id: "agenda", label: "Meeting Agenda", group: "Executive" },
    { id: "settings", label: "Settings", group: "Executive" },
    { id: "coverage", label: "Coverage Scan", group: "Editorial" },
    { id: "editorial", label: "Editorial", group: "Editorial" },
    { id: "digest", label: "Email Builder", group: "Marketing" },
    { id: "social", label: "Social Dashboard", group: "Marketing" },
    { id: "assets", label: "Social Assets", group: "Marketing" },
    { id: "copy", label: "Social Copy", group: "Marketing" },
    { id: "extract", label: "Article Extractor", group: "Marketing" },
    { id: "slide-ins", label: "Slide-ins", group: "Marketing" },
    { id: "engagement", label: "Engagement", group: "Marketing" },
  ];

  // -----------------------------------------------------------------------
  // Site Settings (existing)
  // -----------------------------------------------------------------------
  const form = host.querySelector("[data-settings-form]");
  const submitBtn = host.querySelector("[data-settings-submit]");
  const statusEl = host.querySelector("[data-settings-status]");
  const fields = {
    journal_status_issue: form.querySelector('[name="journal_status_issue"]'),
    journal_status_stage: form.querySelector('[name="journal_status_stage"]'),
    gate_days: form.querySelector('[name="gate_days"]'),
    gate_tier: form.querySelector('[name="gate_tier"]'),
  };

  function showStatus(msg, isError) {
    statusEl.textContent = msg;
    statusEl.classList.toggle("is-error", !!isError);
    statusEl.hidden = false;
    if (!isError) setTimeout(() => { statusEl.hidden = true; }, 3000);
  }

  function populate(settings) {
    for (const key in fields) {
      if (fields[key] && settings[key] !== undefined) {
        fields[key].value = settings[key];
      }
    }
  }

  function collect() {
    const out = {};
    for (const key in fields) {
      if (fields[key]) out[key] = fields[key].value;
    }
    return out;
  }

  window.MOAuth.fetch(`${workerUrl}/settings`)
    .then((r) => {
      if (r.status === 401 || r.status === 403) {
        showStatus("Not authorized.", true);
        throw new Error("forbidden");
      }
      return r.json();
    })
    .then(populate)
    .catch((err) => {
      if (err && err.message === "forbidden") return;
      showStatus("Could not load settings.", true);
    });

  submitBtn.addEventListener("click", () => {
    submitBtn.disabled = true;
    statusEl.hidden = true;
    const body = collect();
    window.MOAuth.fetch(`${workerUrl}/settings`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    })
      .then((r) => {
        if (!r.ok) return r.json().then((d) => { throw new Error(d.error || r.status); });
        return r.json();
      })
      .then((saved) => {
        populate(saved);
        try { sessionStorage.removeItem("mo_site_settings"); } catch (_) { /* */ }
        showStatus("Saved.");
      })
      .catch((err) => { showStatus(err.message || "Save failed.", true); })
      .finally(() => { submitBtn.disabled = false; });
  });

  // -----------------------------------------------------------------------
  // Admin Users Management (staff-only)
  // -----------------------------------------------------------------------
  const auSection = host.querySelector("[data-admin-users-section]");
  const auList = host.querySelector("[data-au-list]");
  const auEmpty = host.querySelector("[data-au-empty]");
  const auAddBtn = host.querySelector("[data-au-add]");
  let adminUsers = [];

  window.MOAuth.fetch(`${workerUrl}/my-permissions`)
    .then((r) => r.json())
    .then((perms) => {
      if (perms.isStaff) {
        auSection.hidden = false;
        loadAdminUsers();
      }
    })
    .catch(() => { /* non-staff — section stays hidden */ });

  function loadAdminUsers() {
    window.MOAuth.fetch(`${workerUrl}/admin-users`)
      .then((r) => r.json())
      .then((data) => {
        adminUsers = data.users || [];
        renderUserList();
      })
      .catch(() => { /* fail silently */ });
  }

  function renderUserList() {
    const rows = adminUsers.map((u) => {
      const enabledCount = TOOLS.filter((t) => u.tools && u.tools[t.id]).length;
      return `<div class="au-row" data-au-email="${esc(u.email)}">` +
        `<div class="au-row-info">` +
          `<span class="au-row-name">${esc(u.name)}</span>` +
          `<span class="au-row-email">${esc(u.email)}</span>` +
        `</div>` +
        `<div class="au-row-meta">` +
          `<span class="au-row-count">${enabledCount} tool${enabledCount !== 1 ? "s" : ""}</span>` +
        `</div>` +
        `<div class="au-row-actions">` +
          `<button type="button" class="au-row-btn" data-au-edit="${esc(u.email)}" title="Edit permissions">` +
            `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path></svg>` +
          `</button>` +
          `<button type="button" class="au-row-btn au-row-btn--danger" data-au-remove="${esc(u.email)}" title="Remove user">` +
            `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6m5 0V4a1 1 0 0 1 1-1h2a1 1 0 0 1 1 1v2"></path></svg>` +
          `</button>` +
        `</div>` +
      `</div>`;
    }).join("");

    if (adminUsers.length) {
      auEmpty.hidden = true;
      auList.innerHTML = rows + (auEmpty.outerHTML);
    } else {
      auList.innerHTML = auEmpty.outerHTML;
      auList.querySelector("[data-au-empty]").hidden = false;
    }
  }

  auList.addEventListener("click", (e) => {
    const editBtn = e.target.closest("[data-au-edit]");
    if (editBtn) {
      const email = editBtn.getAttribute("data-au-edit");
      const user = adminUsers.find((u) => u.email === email);
      if (user) showUserModal(user);
      return;
    }
    const removeBtn = e.target.closest("[data-au-remove]");
    if (removeBtn) {
      const email = removeBtn.getAttribute("data-au-remove");
      const user = adminUsers.find((u) => u.email === email);
      if (user) showRemoveConfirm(user);
    }
  });

  auAddBtn.addEventListener("click", () => {
    showUserModal(null);
  });

  // -----------------------------------------------------------------------
  // User modal (add / edit)
  // -----------------------------------------------------------------------
  function showUserModal(existingUser) {
    const isEdit = !!existingUser;
    const tools = existingUser ? (existingUser.tools || {}) : {};

    const groups = {};
    for (const t of TOOLS) {
      if (!groups[t.group]) groups[t.group] = [];
      groups[t.group].push(t);
    }

    let checkboxesHtml = "";
    for (const [group, items] of Object.entries(groups)) {
      checkboxesHtml += `<div class="au-modal-group">`;
      checkboxesHtml += `<p class="au-modal-group-label">${esc(group)}</p>`;
      for (const t of items) {
        const checked = tools[t.id] ? " checked" : "";
        checkboxesHtml += `<label class="au-modal-check">` +
          `<input type="checkbox" name="tool_${t.id}" value="1"${checked} />` +
          `<span>${esc(t.label)}</span>` +
        `</label>`;
      }
      checkboxesHtml += `</div>`;
    }

    const html = `<div class="au-modal-overlay" data-au-modal>` +
      `<div class="au-modal">` +
        `<h3 class="au-modal-title">${isEdit ? "Edit" : "Add"} Admin User</h3>` +
        `<div class="au-modal-fields">` +
          `<label class="settings-field">` +
            `<span class="settings-field-label">Name</span>` +
            `<input type="text" class="settings-input" data-au-name value="${isEdit ? esc(existingUser.name) : ""}" placeholder="Full name" />` +
          `</label>` +
          `<label class="settings-field">` +
            `<span class="settings-field-label">Email</span>` +
            `<input type="email" class="settings-input" data-au-email value="${isEdit ? esc(existingUser.email) : ""}" placeholder="user@example.com" ${isEdit ? "readonly" : ""} />` +
          `</label>` +
        `</div>` +
        `<div class="au-modal-perms">` +
          `<p class="au-modal-perms-label">Permissions</p>` +
          `<div class="au-modal-select-all">` +
            `<button type="button" class="au-link-btn" data-au-select-all>Select all</button>` +
            `<button type="button" class="au-link-btn" data-au-select-none>Clear all</button>` +
          `</div>${ 
          checkboxesHtml 
        }</div>` +
        `<div class="au-modal-actions">` +
          `<button type="button" class="btn btn-pill btn-primary" data-au-save>${isEdit ? "Save" : "Add user"}</button>` +
          `<button type="button" class="btn btn-pill" data-au-cancel>Cancel</button>` +
        `</div>` +
        `<p class="au-modal-status" data-au-modal-status hidden></p>` +
      `</div>` +
    `</div>`;

    document.body.insertAdjacentHTML("beforeend", html);
    const overlay = document.querySelector("[data-au-modal]");

    overlay.querySelector("[data-au-cancel]").addEventListener("click", () => overlay.remove());
    overlay.addEventListener("click", (e) => { if (e.target === overlay) overlay.remove(); });

    overlay.querySelector("[data-au-select-all]").addEventListener("click", () => {
      overlay.querySelectorAll('input[type="checkbox"]').forEach((cb) => { cb.checked = true; });
    });
    overlay.querySelector("[data-au-select-none]").addEventListener("click", () => {
      overlay.querySelectorAll('input[type="checkbox"]').forEach((cb) => { cb.checked = false; });
    });

    overlay.querySelector("[data-au-save]").addEventListener("click", () => {
      const name = overlay.querySelector("[data-au-name]").value.trim();
      const email = overlay.querySelector("[data-au-email]").value.trim().toLowerCase();
      const modalStatus = overlay.querySelector("[data-au-modal-status]");

      if (!name || !email || !email.includes("@")) {
        modalStatus.textContent = "Name and valid email are required.";
        modalStatus.hidden = false;
        return;
      }

      const toolPerms = {};
      for (const t of TOOLS) {
        const cb = overlay.querySelector(`[name="tool_${t.id}"]`);
        toolPerms[t.id] = cb ? cb.checked : false;
      }

      const saveBtn = overlay.querySelector("[data-au-save]");
      saveBtn.disabled = true;
      modalStatus.hidden = true;

      window.MOAuth.fetch(`${workerUrl}/admin-users`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, email, tools: toolPerms }),
      })
        .then((r) => {
          if (!r.ok) return r.json().then((d) => { throw new Error(d.error || r.status); });
          return r.json();
        })
        .then(() => {
          overlay.remove();
          loadAdminUsers();
        })
        .catch((err) => {
          modalStatus.textContent = err.message || "Save failed.";
          modalStatus.hidden = false;
          saveBtn.disabled = false;
        });
    });

    if (!isEdit) {
      setTimeout(() => overlay.querySelector("[data-au-name]").focus(), 50);
    }
  }

  // -----------------------------------------------------------------------
  // Remove confirmation
  // -----------------------------------------------------------------------
  function showRemoveConfirm(user) {
    const html = `<div class="au-modal-overlay" data-au-modal>` +
      `<div class="au-modal au-modal--narrow">` +
        `<h3 class="au-modal-title">Remove Admin User</h3>` +
        `<p class="au-modal-body">Remove <strong>${esc(user.name)}</strong> (${esc(user.email)}) from admin access? They will no longer be able to use any admin tools.</p>` +
        `<div class="au-modal-actions">` +
          `<button type="button" class="btn btn-pill btn-danger" data-au-confirm-remove>Remove</button>` +
          `<button type="button" class="btn btn-pill" data-au-cancel>Cancel</button>` +
        `</div>` +
      `</div>` +
    `</div>`;

    document.body.insertAdjacentHTML("beforeend", html);
    const overlay = document.querySelector("[data-au-modal]");

    overlay.querySelector("[data-au-cancel]").addEventListener("click", () => overlay.remove());
    overlay.addEventListener("click", (e) => { if (e.target === overlay) overlay.remove(); });

    overlay.querySelector("[data-au-confirm-remove]").addEventListener("click", () => {
      const btn = overlay.querySelector("[data-au-confirm-remove]");
      btn.disabled = true;
      window.MOAuth.fetch(`${workerUrl}/admin-users/${encodeURIComponent(user.email)}`, {
        method: "DELETE",
      })
        .then((r) => {
          if (!r.ok) throw new Error("Delete failed");
          overlay.remove();
          loadAdminUsers();
        })
        .catch(() => {
          btn.disabled = false;
        });
    });
  }

  function esc(s) {
    const d = document.createElement("div");
    d.textContent = s;
    return d.innerHTML;
  }
})();
