/*
 * /admin/editorial/ hydration.
 *
 * Two views, one in-memory store:
 *   1. Inbox — every submission with status='submitted'. Approve / Deny
 *      inline buttons + drag-drop into any board column.
 *   2. Board — five workflow columns (Approved, Edited, Scheduled,
 *      Published, Denied) with HTML5 drag-drop between any of them.
 *
 * Every card click-expands to show: full bio, an editable Notes
 * textarea (saves on blur), and download buttons for the archived
 * essay + headshot. File downloads route through the worker so each
 * fetch carries the JWT — anchors couldn't, so we use fetch+blob and
 * synthesise a download click. Same pattern as the admin-table CSV.
 *
 * Status changes are optimistic: update locally + repaint, then POST.
 * On failure, revert + surface the error in the status line.
 *
 * Auth: window.MOAuth.fetch — Ghost member JWT verified
 * worker-side against the live Ghost staff list.
 */
(function () {
  const root = document.querySelector("[data-admin-editorial]");
  if (!root) return;

  const apiBase = (root.getAttribute("data-api-base") || "").replace(/\/$/, "");
  if (!apiBase) {
    setStatus("Editorial admin is not configured — set @custom.membership_api_base in theme settings.");
    return;
  }

  const inboxEl = root.querySelector("[data-editorial-inbox]");
  const inboxEmpty = root.querySelector("[data-editorial-inbox-empty]");
  const statusEl = root.querySelector("[data-editorial-status]");
  const boardCols = {};
  const boardCounts = {};
  ["approved", "edited", "scheduled", "published", "denied"].forEach((s) => {
    boardCols[s] = root.querySelector(`[data-editorial-drop="${s}"]`);
    boardCounts[s] = root.querySelector(`[data-editorial-count="${s}"]`);
  });

  // In-memory copy of every row, keyed by id. Moves are optimistic:
  // update locally + repaint, then POST. Card-expansion state is
  // tracked separately so a status change doesn't collapse cards
  // unrelated to the move.
  const rows = {};
  const notesSaveTimers = {};

  hydrate();
  wireDropTargets();
  wireToolbar();

  function hydrate() {
    setStatus("");
    window.MOAuth.fetch(`${apiBase}/api/admin/submissions`, { credentials: "omit" })
      .then((r) => {
        if (r.status === 401 || r.status === 403) { showForbidden(); return null; }
        if (!r.ok) { setStatus(`Could not load submissions (${r.status}).`); return null; }
        return r.json();
      })
      .then((data) => {
        if (!data) return;
        (data.submissions || []).forEach((row) => { rows[row.id] = row; });
        repaint();
      })
      .catch((err) => {
        console.error("editorial fetch failed", err);
        setStatus("Network error loading submissions.");
      });
  }

  function repaint() {
    const inboxRows = Object.values(rows).filter((r) => { return r.status === "submitted"; });
    if (!inboxRows.length) {
      inboxEl.innerHTML = "";
      if (inboxEmpty) inboxEmpty.removeAttribute("hidden");
    } else {
      if (inboxEmpty) inboxEmpty.setAttribute("hidden", "");
      inboxEl.innerHTML = inboxRows.map((r) => { return renderCard(r, "inbox"); }).join("");
    }
    wireCard(inboxEl);

    Object.keys(boardCols).forEach((status) => {
      const col = boardCols[status];
      const count = boardCounts[status];
      const colRows = Object.values(rows)
        .filter((r) => { return r.status === status; })
        .sort((a, b) => { return (b.created_at || "").localeCompare(a.created_at || ""); });
      col.innerHTML = colRows.map((r) => { return renderCard(r, "board"); }).join("");
      if (count) count.textContent = colRows.length;
      wireCard(col);
    });
  }

  // -------------------------------------------------------------------------
  // Card rendering — all cards are compact rows that open a detail modal.

  function renderCard(row, variant) {
    if (variant === "board") return renderBoardCard(row);
    return renderInboxCard(row);
  }

  function renderBoardCard(row) {
    const name = escapeHtml(`${row.first_name} ${row.last_name || ""}`);
    return (
      `<article class="editorial-card" draggable="true" data-id="${row.id}">` +
        `<span class="editorial-card-name" data-action="open-detail" data-id="${row.id}">${name}</span>` +
      `</article>`
    );
  }

  function renderInboxCard(row) {
    const name = escapeHtml(`${row.first_name} ${row.last_name || ""}`);
    const when = formatDate(row.created_at);
    return (
      `<li class="editorial-inbox-card" draggable="true" data-id="${row.id}">` +
        `<div class="editorial-card-head" data-action="open-detail" data-id="${row.id}">` +
          `<span class="editorial-card-name">${name}</span>` +
          `<span class="editorial-card-date">${escapeHtml(when)}</span>` +
        `</div>` +
      `</li>`
    );
  }

  function renderDetailBody(row, isInbox) {
    const bioFull = escapeHtml(row.bio || "");
    const notes = escapeAttr(row.notes || "");
    const contactMeta = [];
    if (row.email) contactMeta.push(`<a href="mailto:${escapeAttr(row.email)}">${escapeHtml(row.email)}</a>`);
    if (row.phone) contactMeta.push(escapeHtml(row.phone));

    let decision = "";
    if (isInbox) {
      decision =
        `<div class="editorial-card-section editorial-card-decision">` +
          `<p class="eyebrow">Decision</p>` +
          `<div class="editorial-card-decision-actions">` +
            `<button type="button" class="btn btn-sm btn-primary" data-action="approve" data-id="${row.id}">Approve</button>` +
            `<button type="button" class="btn btn-sm" data-action="deny" data-id="${row.id}">Deny</button>` +
            `<span class="editorial-card-decision-hint">Approving moves this card into the workflow board below.</span>` +
          `</div>` +
        `</div>`;
    }

    return (
      `<div class="editorial-card-body">${ 
        contactMeta.length ? `<p class="editorial-card-contact">${contactMeta.join(' &middot; ')}</p>` : '' 
        }${bioFull ? `<div class="editorial-card-section"><p class="eyebrow">Bio</p><p>${bioFull}</p></div>` : '' 
        }<div class="editorial-card-section">` +
          `<p class="eyebrow">Files</p>` +
          `<div class="editorial-card-files">${
            row.essay_key ? `<button type="button" class="btn btn-sm" data-action="download" data-id="${row.id}" data-which="essay">Download essay</button>` : ''
            }${row.headshot_key ? `<button type="button" class="btn btn-sm" data-action="download" data-id="${row.id}" data-which="headshot">Download headshot</button>` : ''
            }${!row.essay_key && !row.headshot_key ? '<p class="editorial-card-empty">No files archived.</p>' : ''
          }</div>` +
        `</div>` +
        `<div class="editorial-card-section">` +
          `<label class="editorial-card-notes-label" for="editorial-notes-${row.id}">` +
            `<span class="eyebrow">Notes</span>` +
            `<span class="editorial-card-notes-state" data-notes-state></span>` +
          `</label>` +
          `<textarea class="editorial-card-notes" id="editorial-notes-${row.id}" data-notes data-id="${row.id}" rows="3" placeholder="Editor notes — saves automatically.">${notes}</textarea>` +
        `</div>${ 
        decision 
        }<div class="editorial-card-section editorial-card-remove-section">` +
          `<button type="button" class="btn btn-sm btn-danger" data-action="remove" data-id="${row.id}">Remove submission</button>` +
        `</div>` +
      `</div>`
    );
  }

  // -------------------------------------------------------------------------
  // Detail modal — opens when a board card is clicked.

  function openDetailModal(id) {
    const row = rows[id];
    if (!row) return;
    closeDetailModal();

    const name = escapeHtml(`${row.first_name} ${row.last_name || ""}`);
    const when = formatDate(row.created_at);
    const statusLabel = row.status.charAt(0).toUpperCase() + row.status.slice(1);

    const overlay = document.createElement("div");
    overlay.className = "au-modal-overlay editorial-detail-overlay";
    overlay.setAttribute("data-editorial-detail-overlay", "");
    overlay.innerHTML =
      `<div class="au-modal editorial-detail-modal">` +
        `<div class="editorial-detail-header">` +
          `<div>` +
            `<h3 class="editorial-detail-name">${name}</h3>` +
            `<p class="editorial-detail-meta">${escapeHtml(when)} &middot; ${escapeHtml(statusLabel)}</p>` +
          `</div>` +
          `<button type="button" class="editorial-detail-close" data-action="close-detail" aria-label="Close">&times;</button>` +
        `</div>${ 
        renderDetailBody(row, row.status === "submitted") 
      }</div>`;

    document.body.appendChild(overlay);

    overlay.querySelector("[data-action='close-detail']").addEventListener("click", closeDetailModal);
    overlay.addEventListener("click", (ev) => {
      if (ev.target === overlay) closeDetailModal();
    });

    wireCard(overlay);
  }

  function closeDetailModal() {
    const el = document.querySelector("[data-editorial-detail-overlay]");
    if (el) el.remove();
  }

  // -------------------------------------------------------------------------
  // Wire interactions on whichever card host we just rendered into.

  function wireCard(host) {
    if (!host) return;

    host.querySelectorAll('[data-action="open-detail"]').forEach((el) => {
      el.addEventListener("click", (ev) => {
        ev.preventDefault();
        ev.stopPropagation();
        openDetailModal(el.getAttribute("data-id"));
      });
    });

    host.querySelectorAll('[data-action="approve"], [data-action="deny"]').forEach((btn) => {
      btn.addEventListener("click", (ev) => {
        ev.preventDefault();
        ev.stopPropagation();
        const id = btn.getAttribute("data-id");
        const next = btn.getAttribute("data-action") === "approve" ? "approved" : "denied";
        moveCard(id, next);
      });
    });

    host.querySelectorAll('[data-action="download"]').forEach((btn) => {
      btn.addEventListener("click", (ev) => {
        ev.preventDefault();
        ev.stopPropagation();
        downloadFile(btn.getAttribute("data-id"), btn.getAttribute("data-which"), btn);
      });
    });

    host.querySelectorAll('[data-action="remove"]').forEach((btn) => {
      btn.addEventListener("click", (ev) => {
        ev.preventDefault();
        ev.stopPropagation();
        const id = btn.getAttribute("data-id");
        const row = rows[id];
        if (!row) return;
        const name = `${row.first_name} ${row.last_name || ""}`.trim();
        if (!confirm(`Remove "${name}" permanently? This cannot be undone.`)) return;
        removeCard(id, btn);
      });
    });

    host.querySelectorAll("[data-notes]").forEach((ta) => {
      ta.addEventListener("input", () => {
        const id = ta.getAttribute("data-id");
        clearTimeout(notesSaveTimers[id]);
        const stateEl = ta.closest(".editorial-card-body").querySelector("[data-notes-state]");
        if (stateEl) stateEl.textContent = "Editing…";
        notesSaveTimers[id] = setTimeout(() => { saveNotes(id, ta.value, stateEl); }, 700);
      });
      ta.addEventListener("blur", () => {
        const id = ta.getAttribute("data-id");
        clearTimeout(notesSaveTimers[id]);
        const stateEl = ta.closest(".editorial-card-body").querySelector("[data-notes-state]");
        saveNotes(id, ta.value, stateEl);
      });
    });

    wireDraggables(host);
  }

  // -------------------------------------------------------------------------
  // Drag-drop

  function wireDraggables(host) {
    host.querySelectorAll('[draggable="true"]').forEach((card) => {
      card.addEventListener("dragstart", (ev) => {
        ev.dataTransfer.setData("text/plain", card.getAttribute("data-id"));
        ev.dataTransfer.effectAllowed = "move";
        card.classList.add("is-dragging");
      });
      card.addEventListener("dragend", () => { card.classList.remove("is-dragging"); });
    });
  }

  function wireDropTargets() {
    Object.keys(boardCols).forEach((status) => {
      const col = boardCols[status];
      if (!col) return;
      col.addEventListener("dragover", (ev) => {
        ev.preventDefault();
        ev.dataTransfer.dropEffect = "move";
        col.classList.add("is-drop-target");
      });
      col.addEventListener("dragleave", () => { col.classList.remove("is-drop-target"); });
      col.addEventListener("drop", (ev) => {
        ev.preventDefault();
        col.classList.remove("is-drop-target");
        const id = ev.dataTransfer.getData("text/plain");
        if (id) moveCard(id, status);
      });
    });
  }

  // -------------------------------------------------------------------------
  // State change — optimistic update + persist.

  function moveCard(id, nextStatus) {
    const row = rows[id];
    if (!row) return;
    if (row.status === nextStatus) return;
    const prevStatus = row.status;
    row.status = nextStatus;
    repaint();
    setStatus("");

    window.MOAuth.fetch(`${apiBase}/api/admin/submissions/${encodeURIComponent(id)}/status`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "omit",
      body: JSON.stringify({ status: nextStatus }),
    })
      .then((r) => {
        if (r.status === 401 || r.status === 403) {
          row.status = prevStatus; repaint(); showForbidden(); return;
        }
        if (!r.ok) {
          row.status = prevStatus; repaint();
          setStatus(`Couldn't save move (${r.status}). Reverted.`);
        }
      })
      .catch((err) => {
        console.error("editorial move failed", err);
        row.status = prevStatus; repaint();
        setStatus("Network error saving move. Reverted.");
      });
  }

  function removeCard(id, btn) {
    const origLabel = btn.textContent;
    btn.disabled = true;
    btn.textContent = "Removing…";

    window.MOAuth.fetch(`${apiBase}/api/admin/submissions/${encodeURIComponent(id)}`, {
      method: "DELETE",
      credentials: "omit",
    })
      .then((r) => {
        if (r.status === 401 || r.status === 403) { showForbidden(); return; }
        if (!r.ok) {
          setStatus(`Couldn't remove submission (${r.status}).`);
          btn.disabled = false;
          btn.textContent = origLabel;
          return;
        }
        delete rows[id];
        closeDetailModal();
        repaint();
      })
      .catch((err) => {
        console.error("editorial remove failed", err);
        setStatus("Network error removing submission.");
        btn.disabled = false;
        btn.textContent = origLabel;
      });
  }

  function saveNotes(id, value, stateEl) {
    const row = rows[id];
    if (!row) return;
    const trimmed = String(value || "");
    if ((row.notes || "") === trimmed) {
      if (stateEl) stateEl.textContent = "";
      return;
    }
    if (stateEl) stateEl.textContent = "Saving…";

    window.MOAuth.fetch(`${apiBase}/api/admin/submissions/${encodeURIComponent(id)}/notes`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "omit",
      body: JSON.stringify({ notes: trimmed }),
    })
      .then((r) => {
        if (!r.ok) {
          if (stateEl) stateEl.textContent = "Save failed.";
          return;
        }
        row.notes = trimmed;
        if (stateEl) {
          stateEl.textContent = "Saved";
          setTimeout(() => { if (stateEl.textContent === "Saved") stateEl.textContent = ""; }, 2000);
        }
      })
      .catch((err) => {
        console.error("notes save failed", err);
        if (stateEl) stateEl.textContent = "Save failed.";
      });
  }

  function downloadFile(id, which, btn) {
    const origLabel = btn.textContent;
    btn.disabled = true;
    btn.textContent = "Downloading…";
    window.MOAuth.fetch(`${apiBase}/api/admin/submissions/${encodeURIComponent(id)}/${which}`, {
      credentials: "omit",
    })
      .then((r) => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        // Filename from Content-Disposition if provided.
        const dispo = r.headers.get("content-disposition") || "";
        const m = /filename="?([^"]+)"?/.exec(dispo);
        const filename = m ? m[1] : (which + (which === "essay" ? ".docx" : ".jpg"));
        return r.blob().then((blob) => { return { blob, filename }; });
      })
      .then((data) => {
        const url = URL.createObjectURL(data.blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = data.filename;
        document.body.appendChild(a);
        a.click();
        a.remove();
        URL.revokeObjectURL(url);
      })
      .catch((err) => {
        console.error("download failed", err);
        setStatus(`Download failed: ${err.message}`);
      })
      .then(() => {
        btn.disabled = false;
        btn.textContent = origLabel;
      });
  }

  // -------------------------------------------------------------------------
  // "+ New submission" button + edit modal

  function wireToolbar() {
    const btn = root.querySelector('[data-action="new-submission"]');
    if (btn) btn.addEventListener("click", () => { openEditModal(null); });
  }

  function openEditModal(id) {
    const row = id ? rows[id] : {};
    const isNew = !id;
    closeDetailModal();
    closeEditModal();

    const overlay = document.createElement("div");
    overlay.className = "au-modal-overlay editorial-edit-overlay";
    overlay.setAttribute("data-editorial-edit-overlay", "");
    overlay.innerHTML =
      `<div class="au-modal sponsor-edit-modal">` +
        `<div class="sponsor-detail-header">` +
          `<h3 class="sponsor-detail-name">${isNew ? 'New submission' : 'Edit submission'}</h3>` +
          `<button type="button" class="editorial-detail-close" data-action="close-edit" aria-label="Close">&times;</button>` +
        `</div>` +
        `<form class="sponsor-form" data-editorial-form>${
          formField("First name", "first_name", row.first_name || "", "text", true)
          }${formField("Last name", "last_name", row.last_name || "", "text", true)
          }${formField("Email", "email", row.email || "", "email")
          }${formField("Phone", "phone", row.phone || "")
          }${formTextarea("Bio", "bio", row.bio || "", "Author bio")
          }${formSelect("Status", "status", row.status || "submitted", ["submitted", "approved", "edited", "scheduled", "published", "denied"])
          }${formTextarea("Notes", "notes", row.notes || "", "Editor notes")
          }<div class="sponsor-form-actions">` +
            `<button type="submit" class="btn btn-sm btn-primary">${isNew ? 'Create' : 'Save'}</button>` +
            `<button type="button" class="btn btn-sm" data-action="close-edit">Cancel</button>` +
          `</div>` +
        `</form>` +
      `</div>`;

    document.body.appendChild(overlay);
    const returnId = isNew ? null : id;
    overlay.querySelectorAll('[data-action="close-edit"]').forEach((b) => {
      b.addEventListener("click", () => { closeEditModal(); if (returnId) openDetailModal(returnId); });
    });
    overlay.addEventListener("click", (ev) => { if (ev.target === overlay) { closeEditModal(); if (returnId) openDetailModal(returnId); } });

    const form = overlay.querySelector("[data-editorial-form]");
    form.addEventListener("submit", (ev) => {
      ev.preventDefault();
      const fd = new FormData(form);
      const payload = {};
      payload.first_name = fd.get("first_name");
      payload.last_name = fd.get("last_name");
      payload.email = fd.get("email") || "";
      payload.phone = fd.get("phone") || null;
      payload.bio = fd.get("bio") || null;
      payload.status = fd.get("status") || "submitted";
      payload.notes = fd.get("notes") || null;

      if (!payload.first_name) { setStatus("First name is required."); return; }
      if (!payload.last_name) { setStatus("Last name is required."); return; }

      if (isNew) {
        createSubmission(payload);
      }
    });
  }

  function closeEditModal() {
    const el = document.querySelector("[data-editorial-edit-overlay]");
    if (el) el.remove();
  }

  function formField(label, name, value, type, required, placeholder) {
    return (
      `<div class="sponsor-form-field">` +
        `<label class="sponsor-form-label">${escapeHtml(label)}</label>` +
        `<input type="${type || 'text'}" name="${name}" value="${escapeAttr(value)}" class="sponsor-form-input" ${required ? 'required' : ''} ${placeholder ? `placeholder="${escapeAttr(placeholder)}"` : ''} />` +
      `</div>`
    );
  }

  function formTextarea(label, name, value, placeholder) {
    return (
      `<div class="sponsor-form-field">` +
        `<label class="sponsor-form-label">${escapeHtml(label)}</label>` +
        `<textarea name="${name}" class="sponsor-form-input sponsor-form-textarea" rows="3" placeholder="${escapeAttr(placeholder || '')}">${escapeHtml(value)}</textarea>` +
      `</div>`
    );
  }

  function formSelect(label, name, value, options) {
    const opts = options.map((o) => `<option value="${o}" ${o === value ? 'selected' : ''}>${o.charAt(0).toUpperCase() + o.slice(1)}</option>`).join("");
    return (
      `<div class="sponsor-form-field">` +
        `<label class="sponsor-form-label">${escapeHtml(label)}</label>` +
        `<select name="${name}" class="sponsor-form-input">${opts}</select>` +
      `</div>`
    );
  }

  function createSubmission(payload) {
    setStatus("");
    window.MOAuth.fetch(`${apiBase}/api/admin/submissions`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "omit",
      body: JSON.stringify(payload),
    })
      .then((r) => r.json())
      .then((data) => {
        if (data.error) { setStatus(data.error); return; }
        rows[data.id] = {
          id: data.id,
          first_name: payload.first_name,
          last_name: payload.last_name,
          email: payload.email,
          phone: payload.phone,
          bio: payload.bio,
          ai_attested: 0,
          essay_key: null,
          essay_name: null,
          headshot_key: null,
          headshot_name: null,
          status: payload.status,
          notes: payload.notes,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        };
        closeEditModal();
        repaint();
      })
      .catch((err) => { console.error(err); setStatus("Network error creating submission."); });
  }

  // -------------------------------------------------------------------------

  function showForbidden() {
    const body = root.querySelector(".container");
    if (!body) return;
    body.innerHTML =
      '<div class="admin-forbidden">' +
        '<p class="eyebrow">Setup required</p>' +
        '<h2 class="section-heading"><em>One more step.</em></h2>' +
        "<p>You have editorial permissions, but the submissions database requires Ghost staff access. Ask Ian to add your email under Ghost Admin &rarr; Settings &rarr; Staff (Contributor role), then reload.</p>" +
      '</div>';
  }

  function setStatus(msg) { if (statusEl) statusEl.textContent = msg || ""; }
  function escapeHtml(s) {
    return String(s == null ? "" : s).replace(/[&<>"']/g, (c) => {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
    });
  }
  function escapeAttr(s) { return escapeHtml(s); }
  function formatDate(iso) {
    if (!iso) return "";
    const d = new Date(iso.replace(" ", "T") + (iso.includes("Z") ? "" : "Z"));
    if (isNaN(d.getTime())) return iso;
    return d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
  }
})();
