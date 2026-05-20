/*
 * /admin/sponsors/ hydration.
 *
 * Five-column pipeline board (Prospecting / Negotiating / Agreed /
 * Active / Completed) with HTML5 drag-drop. Compact cards open a
 * detail modal on click with full sponsor info, financials, assets,
 * and notes. Same interaction pattern as the editorial board.
 *
 * Auth: window.MOAuth.fetch — Ghost member JWT verified worker-side.
 */
(function () {
  const root = document.querySelector("[data-admin-sponsors]");
  if (!root) return;

  const adminUrl = (root.getAttribute("data-admin-url") || "").replace(/\/$/, "");
  if (!adminUrl) {
    setStatus("Sponsorship admin is not configured — set @custom.admin_worker_url in theme settings.");
    return;
  }

  const statusEl = root.querySelector("[data-sponsor-status]");
  const inboxEl = root.querySelector("[data-sponsor-inbox]");
  const inboxEmpty = root.querySelector("[data-sponsor-inbox-empty]");
  const boardCols = {};
  const boardCounts = {};
  ["prospecting", "negotiating", "agreed", "active", "completed"].forEach((s) => {
    boardCols[s] = root.querySelector(`[data-sponsor-drop="${s}"]`);
    boardCounts[s] = root.querySelector(`[data-sponsor-count="${s}"]`);
  });

  const rows = {};
  const notesSaveTimers = {};

  hydrate();
  wireToolbar();

  // ---------------------------------------------------------------------------
  // Data

  function hydrate() {
    setStatus("");
    window.MOAuth.fetch(`${adminUrl}/sponsors/sponsorships`, { credentials: "omit" })
      .then((r) => {
        if (r.status === 401 || r.status === 403) { showForbidden(); return null; }
        if (!r.ok) { setStatus(`Could not load sponsorships (${r.status}).`); return null; }
        return r.json();
      })
      .then((data) => {
        if (!data) return;
        (data.sponsorships || []).forEach((row) => { rows[row.id] = row; });
        repaint();
      })
      .catch((err) => {
        console.error("sponsors fetch failed", err);
        setStatus("Network error loading sponsorships.");
      });
  }

  function repaint() {
    updateMetrics();

    // Inbox — inquiries from the public form
    if (inboxEl) {
      const inboxRows = Object.values(rows)
        .filter((r) => r.status === "inquiry")
        .sort((a, b) => (b.created_at || "").localeCompare(a.created_at || ""));
      if (!inboxRows.length) {
        inboxEl.innerHTML = "";
        if (inboxEmpty) inboxEmpty.removeAttribute("hidden");
      } else {
        if (inboxEmpty) inboxEmpty.setAttribute("hidden", "");
        inboxEl.innerHTML = inboxRows.map(renderInboxCard).join("");
      }
      wireInboxCards(inboxEl);
    }

    // Board columns
    Object.keys(boardCols).forEach((status) => {
      const col = boardCols[status];
      const count = boardCounts[status];
      const colRows = Object.values(rows)
        .filter((r) => r.status === status)
        .sort((a, b) => (b.created_at || "").localeCompare(a.created_at || ""));
      col.innerHTML = colRows.map(renderCard).join("");
      if (count) count.textContent = colRows.length;
      wireCards(col);
    });
  }

  function updateMetrics() {
    const all = Object.values(rows);
    const active = all.filter((r) => r.status === "active");
    const activeRevenue = active.reduce((sum, r) => sum + (r.amount_cents || 0), 0);
    const unpaid = all.filter((r) => r.status !== "completed" && !r.paid && r.amount_cents);
    const unpaidTotal = unpaid.reduce((sum, r) => sum + (r.amount_cents || 0), 0);
    const now = new Date();
    const thirtyDays = new Date(now.getTime() + 30 * 86400000).toISOString().slice(0, 10);
    const today = now.toISOString().slice(0, 10);
    const upcoming = all.filter((r) => r.start_date && r.start_date > today && r.start_date <= thirtyDays);

    setMetric("active-count", active.length);
    setMetric("active-revenue", formatCents(activeRevenue));
    setMetric("outstanding", formatCents(unpaidTotal));
    setMetric("upcoming", upcoming.length);
  }

  // ---------------------------------------------------------------------------
  // Rendering

  function renderCard(row) {
    const name = escapeHtml(row.sponsor_name);
    const type = escapeHtml(row.type || "");
    return (
      `<article class="sponsor-card" data-id="${row.id}">` +
        `<span class="sponsor-card-name" data-action="open-detail" data-id="${row.id}">${name}</span>` +
        `<span class="sponsor-card-type">${type}</span>` +
      `</article>`
    );
  }

  function renderInboxCard(row) {
    const name = escapeHtml(row.sponsor_name);
    const contact = escapeHtml(row.contact_name || "");
    const when = formatDate(row.created_at);
    const type = escapeHtml(row.type || "");
    const placement = escapeHtml(row.placement || "");
    return (
      `<li class="editorial-inbox-card sponsor-inbox-card" data-id="${row.id}">` +
        `<div class="editorial-card-head" data-action="open-inbox-detail" data-id="${row.id}">` +
          `<span class="editorial-card-name">${name}${contact && contact !== name ? ` <span class="sponsor-inbox-contact">(${contact})</span>` : ''}</span>` +
          `<span class="editorial-card-date">${escapeHtml(when)}</span>` +
        `</div>` +
        `<div class="sponsor-inbox-meta">` +
          `<span class="sponsor-card-type">${type}</span>${ 
          placement ? `<span class="sponsor-inbox-placement">${placement}</span>` : '' 
        }</div>` +
      `</li>`
    );
  }

  function wireInboxCards(host) {
    host.querySelectorAll('[data-action="open-inbox-detail"]').forEach((el) => {
      el.addEventListener("click", (ev) => {
        ev.preventDefault();
        ev.stopPropagation();
        openInboxDetailModal(el.getAttribute("data-id"));
      });
    });
  }

  // ---------------------------------------------------------------------------
  // Inbox detail modal — for form inquiries before they enter the pipeline

  function openInboxDetailModal(id) {
    const row = rows[id];
    if (!row) return;
    closeDetailModal();
    closeInboxDetailModal();

    const name = escapeHtml(row.sponsor_name);
    const contact = escapeHtml(row.contact_name || "");
    const email = row.contact_email || "";
    const type = row.type ? row.type.charAt(0).toUpperCase() + row.type.slice(1) : "";
    const placement = escapeHtml(row.placement || "");
    const description = escapeHtml(row.description || "");
    const notes = escapeHtml(row.notes || "");
    const when = formatDate(row.created_at);
    const startDate = row.start_date ? escapeHtml(row.start_date) : "";

    const overlay = document.createElement("div");
    overlay.className = "au-modal-overlay sponsor-inbox-detail-overlay";
    overlay.setAttribute("data-sponsor-inbox-detail-overlay", "");
    overlay.innerHTML =
      `<div class="au-modal sponsor-detail-modal">` +
        `<div class="sponsor-detail-header">` +
          `<div>` +
            `<h3 class="sponsor-detail-name">${name}</h3>` +
            `<p class="sponsor-detail-meta">Inquiry &middot; ${escapeHtml(type)} &middot; ${escapeHtml(when)}</p>` +
          `</div>` +
          `<button type="button" class="editorial-detail-close" data-action="close-inbox-detail" aria-label="Close">&times;</button>` +
        `</div>` +
        `<div class="sponsor-detail-body">` +
          // Contact
          `<div class="sponsor-detail-section">` +
            `<p class="eyebrow">Contact</p>` +
            `<p class="sponsor-detail-text">${escapeHtml(contact)}${email ? ` &middot; <a href="mailto:${escapeAttr(email)}">${escapeHtml(email)}</a>` : ''}</p>` +
          `</div>${ 
          // Placements requested
          placement ? `<div class="sponsor-detail-section"><p class="eyebrow">Interested in</p><p class="sponsor-detail-text">${placement}</p></div>` : '' 
          // Duration + start
          }${description || startDate ? `<div class="sponsor-detail-section"><p class="eyebrow">Details</p><p class="sponsor-detail-text">${description}${startDate ? ` &middot; Start: ${startDate}` : ''}</p></div>` : '' 
          // Message / notes from form
          }${notes ? `<div class="sponsor-detail-section"><p class="eyebrow">Message</p><p class="sponsor-detail-text" style="white-space:pre-wrap">${notes}</p></div>` : '' 
          // Decision
          }<div class="sponsor-detail-section editorial-card-decision">` +
            `<p class="eyebrow">Decision</p>` +
            `<div class="editorial-card-decision-actions">` +
              `<button type="button" class="btn btn-sm btn-primary" data-action="inbox-promote" data-id="${row.id}">Move to Pipeline</button>` +
              `<button type="button" class="btn btn-sm btn-danger" data-action="inbox-dismiss" data-id="${row.id}">Dismiss</button>` +
              `<span class="editorial-card-decision-hint">Moving to pipeline places this in the Prospecting column.</span>` +
            `</div>` +
          `</div>` +
        `</div>` +
      `</div>`;

    document.body.appendChild(overlay);
    overlay.querySelector("[data-action='close-inbox-detail']").addEventListener("click", closeInboxDetailModal);
    overlay.addEventListener("click", (ev) => { if (ev.target === overlay) closeInboxDetailModal(); });

    // Promote to pipeline
    const promoteBtn = overlay.querySelector('[data-action="inbox-promote"]');
    if (promoteBtn) {
      promoteBtn.addEventListener("click", () => {
        moveCard(row.id, "prospecting");
        closeInboxDetailModal();
      });
    }

    // Dismiss (delete)
    const dismissBtn = overlay.querySelector('[data-action="inbox-dismiss"]');
    if (dismissBtn) {
      dismissBtn.addEventListener("click", () => {
        if (!confirm(`Dismiss this inquiry from "${row.sponsor_name}"? This cannot be undone.`)) return;
        removeSponsorship(row.id, dismissBtn);
        closeInboxDetailModal();
      });
    }
  }

  function closeInboxDetailModal() {
    const el = document.querySelector("[data-sponsor-inbox-detail-overlay]");
    if (el) el.remove();
  }

  // ---------------------------------------------------------------------------
  // Detail modal

  function openDetailModal(id) {
    const row = rows[id];
    if (!row) return;
    closeDetailModal();

    const name = escapeHtml(row.sponsor_name);
    const typeLabel = row.type ? row.type.charAt(0).toUpperCase() + row.type.slice(1) : "";
    const statuses = ["inquiry", "prospecting", "negotiating", "agreed", "active", "completed"];
    const statusOptions = statuses.map((s) =>
      `<option value="${s}"${s === row.status ? ' selected' : ''}>${s.charAt(0).toUpperCase() + s.slice(1)}</option>`
    ).join('');

    const overlay = document.createElement("div");
    overlay.className = "au-modal-overlay sponsor-detail-overlay";
    overlay.setAttribute("data-sponsor-detail-overlay", "");
    overlay.innerHTML =
      `<div class="au-modal sponsor-detail-modal">` +
        `<div class="sponsor-detail-header">` +
          `<div>` +
            `<h3 class="sponsor-detail-name">${name}</h3>` +
            `<p class="sponsor-detail-meta">${escapeHtml(typeLabel)} &middot; <select class="sponsor-status-select" data-action="change-status" data-id="${row.id}">${statusOptions}</select></p>` +
          `</div>` +
          `<button type="button" class="editorial-detail-close" data-action="close-detail" aria-label="Close">&times;</button>` +
        `</div>${ 
        renderDetailBody(row) 
      }</div>`;

    document.body.appendChild(overlay);
    overlay.querySelector("[data-action='close-detail']").addEventListener("click", closeDetailModal);
    overlay.addEventListener("click", (ev) => { if (ev.target === overlay) closeDetailModal(); });
    wireModalInteractions(overlay, row);
  }

  function closeDetailModal() {
    const el = document.querySelector("[data-sponsor-detail-overlay]");
    if (el) el.remove();
  }

  function renderDetailBody(row) {
    const contact = [];
    if (row.contact_name) contact.push(escapeHtml(row.contact_name));
    if (row.contact_email) contact.push(`<a href="mailto:${escapeAttr(row.contact_email)}">${escapeHtml(row.contact_email)}</a>`);

    const dates = [];
    if (row.start_date) dates.push(`Start: ${escapeHtml(row.start_date)}`);
    if (row.end_date) dates.push(`End: ${escapeHtml(row.end_date)}`);

    const notes = escapeAttr(row.notes || "");

    return (
      `<div class="sponsor-detail-body">${ 
        // Contact
        contact.length ? `<div class="sponsor-detail-section"><p class="eyebrow">Contact</p><p class="sponsor-detail-text">${contact.join(' &middot; ')}</p></div>` : '' 
        // Placement + description
        }${row.placement ? `<div class="sponsor-detail-section"><p class="eyebrow">Placement</p><p class="sponsor-detail-text">${escapeHtml(row.placement)}</p></div>` : '' 
        }${row.description ? `<div class="sponsor-detail-section"><p class="eyebrow">Description</p><p class="sponsor-detail-text">${escapeHtml(row.description)}</p></div>` : '' 
        // Dates
        }${dates.length ? `<div class="sponsor-detail-section"><p class="eyebrow">Schedule</p><p class="sponsor-detail-text">${dates.join(' &middot; ')}</p></div>` : '' 
        // Financials
        }<div class="sponsor-detail-section">` +
          `<p class="eyebrow">Financials</p>` +
          `<div class="sponsor-financials">` +
            `<span class="sponsor-amount">${row.amount_cents ? formatCents(row.amount_cents) : '—'}</span>` +
            `<label class="sponsor-check"><input type="checkbox" data-field="agreement_signed" ${row.agreement_signed ? 'checked' : ''}> Agreement signed</label>` +
            `<label class="sponsor-check"><input type="checkbox" data-field="invoiced" ${row.invoiced ? 'checked' : ''}> Invoiced</label>` +
            `<label class="sponsor-check"><input type="checkbox" data-field="paid" ${row.paid ? 'checked' : ''}> Paid</label>` +
          `</div>` +
        `</div>` +
        // Assets
        `<div class="sponsor-detail-section">` +
          `<p class="eyebrow">Assets</p>` +
          `<div class="sponsor-assets" data-sponsor-assets></div>` +
          `<div class="sponsor-asset-upload">` +
            `<input type="text" class="sponsor-asset-label-input" data-asset-label placeholder="Label (e.g. Banner graphic)" />` +
            `<input type="file" class="sponsor-asset-file-input" data-asset-file />` +
            `<button type="button" class="btn btn-sm" data-action="upload-asset" data-id="${row.id}">Upload</button>` +
            `<input type="text" class="sponsor-asset-url-input" data-asset-url placeholder="or paste a URL" />` +
            `<button type="button" class="btn btn-sm" data-action="add-link-asset" data-id="${row.id}">Add link</button>` +
          `</div>` +
        `</div>` +
        // Notes
        `<div class="sponsor-detail-section">` +
          `<label class="sponsor-notes-label" for="sponsor-notes-${row.id}">` +
            `<span class="eyebrow">Notes</span>` +
            `<span class="sponsor-notes-state" data-notes-state></span>` +
          `</label>` +
          `<textarea class="editorial-card-notes" id="sponsor-notes-${row.id}" data-notes data-id="${row.id}" rows="3" placeholder="Internal notes — saves automatically.">${notes}</textarea>` +
        `</div>` +
        // Actions
        `<div class="sponsor-detail-section sponsor-detail-actions">` +
          `<button type="button" class="btn btn-sm" data-action="edit-sponsorship" data-id="${row.id}">Edit details</button>` +
          `<button type="button" class="btn btn-sm btn-danger" data-action="remove" data-id="${row.id}">Remove</button>` +
        `</div>` +
      `</div>`
    );
  }

  // ---------------------------------------------------------------------------
  // Modal interactions

  function wireModalInteractions(overlay, row) {
    // Status dropdown
    const statusSelect = overlay.querySelector('[data-action="change-status"]');
    if (statusSelect) {
      statusSelect.addEventListener("change", () => {
        moveCard(row.id, statusSelect.value);
      });
    }

    // Financial checkboxes
    overlay.querySelectorAll("[data-field]").forEach((cb) => {
      cb.addEventListener("change", () => {
        const field = cb.getAttribute("data-field");
        const val = cb.checked;
        row[field] = val ? 1 : 0;
        updateField(row.id, { [field]: val });
        repaint();
      });
    });

    // Notes autosave
    const ta = overlay.querySelector("[data-notes]");
    if (ta) {
      ta.addEventListener("input", () => {
        const id = ta.getAttribute("data-id");
        clearTimeout(notesSaveTimers[id]);
        const stateEl = overlay.querySelector("[data-notes-state]");
        if (stateEl) stateEl.textContent = "Editing…";
        notesSaveTimers[id] = setTimeout(() => { saveNotes(id, ta.value, stateEl); }, 700);
      });
      ta.addEventListener("blur", () => {
        const id = ta.getAttribute("data-id");
        clearTimeout(notesSaveTimers[id]);
        const stateEl = overlay.querySelector("[data-notes-state]");
        saveNotes(id, ta.value, stateEl);
      });
    }

    // Upload file asset
    const uploadBtn = overlay.querySelector('[data-action="upload-asset"]');
    if (uploadBtn) {
      uploadBtn.addEventListener("click", () => {
        const fileInput = overlay.querySelector("[data-asset-file]");
        const labelInput = overlay.querySelector("[data-asset-label]");
        if (!fileInput.files.length) { setStatus("Select a file first."); return; }
        uploadAsset(row.id, labelInput.value || "Asset", fileInput.files[0], overlay);
      });
    }

    // Add link asset
    const linkBtn = overlay.querySelector('[data-action="add-link-asset"]');
    if (linkBtn) {
      linkBtn.addEventListener("click", () => {
        const urlInput = overlay.querySelector("[data-asset-url]");
        const labelInput = overlay.querySelector("[data-asset-label]");
        if (!urlInput.value.trim()) { setStatus("Enter a URL."); return; }
        addLinkAsset(row.id, labelInput.value || "Link", urlInput.value.trim(), overlay);
      });
    }

    // Edit details
    const editBtn = overlay.querySelector('[data-action="edit-sponsorship"]');
    if (editBtn) {
      editBtn.addEventListener("click", () => { closeDetailModal(); openEditModal(row.id); });
    }

    // Remove
    const removeBtn = overlay.querySelector('[data-action="remove"]');
    if (removeBtn) {
      removeBtn.addEventListener("click", () => {
        if (!confirm(`Remove "${row.sponsor_name}" permanently? This cannot be undone.`)) return;
        removeSponsorship(row.id, removeBtn);
      });
    }

    // Load assets
    loadAssets(row.id, overlay);
  }

  // ---------------------------------------------------------------------------
  // Edit modal — full form for creating/editing a sponsorship

  function openEditModal(id) {
    const row = id ? rows[id] : {};
    const isNew = !id;
    closeDetailModal();
    closeEditModal();

    const overlay = document.createElement("div");
    overlay.className = "au-modal-overlay sponsor-edit-overlay";
    overlay.setAttribute("data-sponsor-edit-overlay", "");
    overlay.innerHTML =
      `<div class="au-modal sponsor-edit-modal">` +
        `<div class="sponsor-detail-header">` +
          `<h3 class="sponsor-detail-name">${isNew ? 'New sponsorship' : 'Edit sponsorship'}</h3>` +
          `<button type="button" class="editorial-detail-close" data-action="close-edit" aria-label="Close">&times;</button>` +
        `</div>` +
        `<form class="sponsor-form" data-sponsor-form>${ 
          formField("Sponsor name", "sponsor_name", row.sponsor_name || "", "text", true) 
          }${formField("Contact name", "contact_name", row.contact_name || "") 
          }${formField("Contact email", "contact_email", row.contact_email || "", "email") 
          }${formSelect("Type", "type", row.type || "newsletter", ["newsletter", "podcast", "website", "event", "bundle"]) 
          }${formField("Placement", "placement", row.placement || "", "text", false, "e.g. Tuesday newsletter, Mere Fidelity") 
          }${formField("Amount ($)", "amount_display", row.amount_cents ? (row.amount_cents / 100).toFixed(2) : "", "number", false, "0.00") 
          }${formField("Start date", "start_date", row.start_date || "", "date") 
          }${formField("End date", "end_date", row.end_date || "", "date") 
          }${formTextarea("Description", "description", row.description || "", "What the sponsor gets") 
          }${isNew ? formSelect("Status", "status", "prospecting", ["prospecting", "negotiating", "agreed", "active", "completed"]) : '' 
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

    const form = overlay.querySelector("[data-sponsor-form]");
    form.addEventListener("submit", (ev) => {
      ev.preventDefault();
      const fd = new FormData(form);
      const payload = {};
      payload.sponsor_name = fd.get("sponsor_name");
      payload.contact_name = fd.get("contact_name") || null;
      payload.contact_email = fd.get("contact_email") || null;
      payload.type = fd.get("type");
      payload.placement = fd.get("placement") || null;
      const amountStr = fd.get("amount_display");
      payload.amount_cents = amountStr ? Math.round(parseFloat(amountStr) * 100) : null;
      payload.start_date = fd.get("start_date") || null;
      payload.end_date = fd.get("end_date") || null;
      payload.description = fd.get("description") || null;
      if (isNew) payload.status = fd.get("status") || "prospecting";

      if (!payload.sponsor_name) { setStatus("Sponsor name is required."); return; }

      if (isNew) {
        createSponsorship(payload);
      } else {
        updateSponsorship(id, payload);
      }
    });
  }

  function closeEditModal() {
    const el = document.querySelector("[data-sponsor-edit-overlay]");
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

  // ---------------------------------------------------------------------------
  // API calls

  function createSponsorship(payload) {
    setStatus("");
    window.MOAuth.fetch(`${adminUrl}/sponsors/sponsorships`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "omit",
      body: JSON.stringify(payload),
    })
      .then((r) => r.json())
      .then((data) => {
        if (data.error) { setStatus(data.error); return; }
        rows[data.id] = { id: data.id, ...payload, created_at: new Date().toISOString(), updated_at: new Date().toISOString(), agreement_signed: 0, invoiced: 0, paid: 0, notes: null };
        closeEditModal();
        repaint();
      })
      .catch((err) => { console.error(err); setStatus("Network error creating sponsorship."); });
  }

  function updateSponsorship(id, payload) {
    setStatus("");
    window.MOAuth.fetch(`${adminUrl}/sponsors/sponsorships/${encodeURIComponent(id)}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      credentials: "omit",
      body: JSON.stringify(payload),
    })
      .then((r) => r.json())
      .then((data) => {
        if (data.error) { setStatus(data.error); return; }
        Object.assign(rows[id], payload);
        closeEditModal();
        repaint();
      })
      .catch((err) => { console.error(err); setStatus("Network error updating sponsorship."); });
  }

  function updateField(id, fields) {
    window.MOAuth.fetch(`${adminUrl}/sponsors/sponsorships/${encodeURIComponent(id)}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      credentials: "omit",
      body: JSON.stringify(fields),
    })
      .then((r) => { if (!r.ok) setStatus("Couldn't save change. Please try again."); })
      .catch((err) => { console.error("field update failed", err); setStatus("Network error saving change."); });
  }

  function moveCard(id, nextStatus) {
    const row = rows[id];
    if (!row || row.status === nextStatus) return;
    const prevStatus = row.status;
    row.status = nextStatus;
    repaint();

    window.MOAuth.fetch(`${adminUrl}/sponsors/sponsorships/${encodeURIComponent(id)}/status`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "omit",
      body: JSON.stringify({ status: nextStatus }),
    })
      .then((r) => {
        if (!r.ok) { row.status = prevStatus; repaint(); setStatus("Couldn't save move. Reverted."); }
      })
      .catch(() => { row.status = prevStatus; repaint(); setStatus("Network error. Reverted."); });
  }

  function removeSponsorship(id, btn) {
    const origLabel = btn.textContent;
    btn.disabled = true;
    btn.textContent = "Removing…";

    window.MOAuth.fetch(`${adminUrl}/sponsors/sponsorships/${encodeURIComponent(id)}`, {
      method: "DELETE",
      credentials: "omit",
    })
      .then((r) => {
        if (!r.ok) { setStatus("Couldn't remove sponsorship."); btn.disabled = false; btn.textContent = origLabel; return; }
        delete rows[id];
        closeDetailModal();
        repaint();
      })
      .catch(() => { setStatus("Network error."); btn.disabled = false; btn.textContent = origLabel; });
  }

  function saveNotes(id, value, stateEl) {
    const row = rows[id];
    if (!row) return;
    row.notes = value;
    updateField(id, { notes: value });
    if (stateEl) { stateEl.textContent = "Saved"; setTimeout(() => { stateEl.textContent = ""; }, 1500); }
  }

  // ---------------------------------------------------------------------------
  // Assets

  function loadAssets(id, overlay) {
    const container = overlay.querySelector("[data-sponsor-assets]");
    if (!container) return;
    container.innerHTML = '<p class="admin-empty">Loading…</p>';

    window.MOAuth.fetch(`${adminUrl}/sponsors/sponsorships/${encodeURIComponent(id)}/assets`, { credentials: "omit" })
      .then((r) => r.json())
      .then((data) => {
        const assets = data.assets || [];
        if (!assets.length) {
          container.innerHTML = '<p class="sponsor-asset-empty">No assets yet.</p>';
          return;
        }
        container.innerHTML = assets.map((a) => {
          if (a.asset_type === "link") {
            return `<div class="sponsor-asset-row"><span class="sponsor-asset-label">${escapeHtml(a.label)}</span><a href="${escapeAttr(a.url)}" target="_blank" rel="noopener" class="sponsor-asset-link">${escapeHtml(a.url)}</a><button type="button" class="sponsor-asset-delete" data-action="delete-asset" data-id="${id}" data-asset-id="${a.id}">&times;</button></div>`;
          }
          return `<div class="sponsor-asset-row"><span class="sponsor-asset-label">${escapeHtml(a.label)}</span><button type="button" class="btn btn-sm" data-action="download-asset" data-id="${id}" data-asset-id="${a.id}">${escapeHtml(a.file_name || 'Download')}</button><button type="button" class="sponsor-asset-delete" data-action="delete-asset" data-id="${id}" data-asset-id="${a.id}">&times;</button></div>`;
        }).join("");

        container.querySelectorAll('[data-action="download-asset"]').forEach((btn) => {
          btn.addEventListener("click", () => { downloadAsset(btn.getAttribute("data-id"), btn.getAttribute("data-asset-id"), btn); });
        });
        container.querySelectorAll('[data-action="delete-asset"]').forEach((btn) => {
          btn.addEventListener("click", () => { deleteAsset(btn.getAttribute("data-id"), btn.getAttribute("data-asset-id"), overlay); });
        });
      })
      .catch(() => { container.innerHTML = '<p class="sponsor-asset-empty">Failed to load assets.</p>'; });
  }

  function uploadAsset(id, label, file, overlay) {
    const fd = new FormData();
    fd.append("label", label);
    fd.append("file", file);

    window.MOAuth.fetch(`${adminUrl}/sponsors/sponsorships/${encodeURIComponent(id)}/assets`, {
      method: "POST",
      credentials: "omit",
      body: fd,
    })
      .then((r) => r.json())
      .then((data) => {
        if (data.error) { setStatus(data.error); return; }
        loadAssets(id, overlay);
        const fileInput = overlay.querySelector("[data-asset-file]");
        const labelInput = overlay.querySelector("[data-asset-label]");
        if (fileInput) fileInput.value = "";
        if (labelInput) labelInput.value = "";
      })
      .catch(() => { setStatus("Upload failed."); });
  }

  function addLinkAsset(id, label, url, overlay) {
    const fd = new FormData();
    fd.append("label", label);
    fd.append("url", url);

    window.MOAuth.fetch(`${adminUrl}/sponsors/sponsorships/${encodeURIComponent(id)}/assets`, {
      method: "POST",
      credentials: "omit",
      body: fd,
    })
      .then((r) => r.json())
      .then((data) => {
        if (data.error) { setStatus(data.error); return; }
        loadAssets(id, overlay);
        const urlInput = overlay.querySelector("[data-asset-url]");
        const labelInput = overlay.querySelector("[data-asset-label]");
        if (urlInput) urlInput.value = "";
        if (labelInput) labelInput.value = "";
      })
      .catch(() => { setStatus("Failed to add link."); });
  }

  function downloadAsset(id, assetId, btn) {
    btn.disabled = true;
    window.MOAuth.fetch(`${adminUrl}/sponsors/sponsorships/${encodeURIComponent(id)}/assets/${encodeURIComponent(assetId)}/file`, { credentials: "omit" })
      .then((r) => {
        if (!r.ok) throw new Error(r.status);
        const disp = r.headers.get("content-disposition") || "";
        const match = disp.match(/filename="(.+?)"/);
        const filename = match ? match[1] : "asset";
        return r.blob().then((blob) => ({ blob, filename }));
      })
      .then(({ blob, filename }) => {
        const a = document.createElement("a");
        a.href = URL.createObjectURL(blob);
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        a.remove();
        URL.revokeObjectURL(a.href);
      })
      .catch(() => { setStatus("Download failed."); })
      .finally(() => { btn.disabled = false; });
  }

  function deleteAsset(id, assetId, overlay) {
    window.MOAuth.fetch(`${adminUrl}/sponsors/sponsorships/${encodeURIComponent(id)}/assets/${encodeURIComponent(assetId)}`, {
      method: "DELETE",
      credentials: "omit",
    })
      .then((r) => {
        if (!r.ok) { setStatus("Couldn't delete asset."); return; }
        loadAssets(id, overlay);
      })
      .catch(() => { setStatus("Network error deleting asset."); });
  }

  // ---------------------------------------------------------------------------
  // Card interactions

  function wireCards(host) {
    host.querySelectorAll('[data-action="open-detail"]').forEach((el) => {
      el.addEventListener("click", (ev) => {
        ev.preventDefault();
        ev.stopPropagation();
        openDetailModal(el.getAttribute("data-id"));
      });
    });
  }

  function wireToolbar() {
    const btn = root.querySelector('[data-action="new-sponsorship"]');
    if (btn) btn.addEventListener("click", () => { openEditModal(null); });
  }

  // ---------------------------------------------------------------------------
  // Helpers

  function setStatus(msg) { if (statusEl) statusEl.textContent = msg; }
  function setMetric(key, val) {
    const el = root.querySelector(`[data-metric="${key}"]`);
    if (el) el.textContent = val;
  }
  function formatCents(cents) {
    if (!cents) return "$0";
    return `$${(cents / 100).toLocaleString("en-US", { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;
  }
  function formatDate(iso) {
    if (!iso) return "";
    const d = new Date(iso);
    return d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
  }
  function escapeHtml(s) { const d = document.createElement("div"); d.textContent = s; return d.innerHTML; }
  function escapeAttr(s) { return String(s || "").replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;").replace(/>/g, "&gt;"); }
  function showForbidden() { root.innerHTML = '<div class="admin-forbidden"><p class="eyebrow">Access Denied</p><h2 class="section-heading">You don\'t have permission to view sponsorships.</h2><p>Ask an administrator to grant you access.</p></div>'; }
})();
