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
  const expanded = new Set();
  const notesSaveTimers = {};

  hydrate();
  wireDropTargets();

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
  // Card rendering — single template covers both inbox and board variants.
  // The expanded body is always rendered; CSS hides it until is-expanded.

  function renderCard(row, variant) {
    const name = escapeHtml(`${row.first_name} ${row.last_name || ""}`);
    const when = formatDate(row.created_at);
    const bioPreview = escapeHtml((row.bio || "").slice(0, 180));
    const bioFull = escapeHtml(row.bio || "");
    const notes = escapeAttr(row.notes || "");
    const meta = [];
    if (row.email) meta.push(`<a href="mailto:${escapeAttr(row.email)}">${escapeHtml(row.email)}</a>`);
    if (row.phone) meta.push(escapeHtml(row.phone));
    meta.push(escapeHtml(when));
    const isExpanded = expanded.has(row.id);
    const cardClass = (variant === "inbox" ? "editorial-inbox-card" : "editorial-card") + (isExpanded ? " is-expanded" : "");

    const hint = variant === "inbox"
      ? (isExpanded ? "Hide details" : "View details")
      : (isExpanded ? "Hide" : "View");

    const head =
      `<div class="editorial-card-head" data-card-toggle data-id="${row.id}">` +
        `<div class="editorial-card-headline">` +
          `<p class="editorial-card-name">${name}</p>` +
          `<p class="editorial-card-meta">${meta.join(' &middot; ')}</p>${ 
          variant === "inbox" && bioPreview ? `<p class="editorial-card-bio">${bioPreview}${row.bio && row.bio.length > 180 ? "&hellip;" : ""}</p>` : "" 
        }</div>` +
        `<span class="editorial-card-toggle" aria-hidden="true">` +
          `<span class="editorial-card-toggle-label">${hint}</span>` +
          `<span class="editorial-card-toggle-chevron">${isExpanded ? "&#9652;" : "&#9662;"}</span>` +
        `</span>` +
      `</div>`;

    // Decision row only for inbox cards — already-on-the-board cards
    // change status by drag-drop, not buttons. Sized to match the
    // download buttons above it so the section reads as a quiet
    // closing action, not a CTA banner.
    let decision = "";
    if (variant === "inbox") {
      decision =
        `<div class="editorial-card-section editorial-card-decision">` +
          `<p class="eyebrow">Decision</p>` +
          `<div class="editorial-card-decision-actions">` +
            `<button type="button" class="btn btn-sm btn-pill btn-primary" data-action="approve" data-id="${row.id}">Approve</button>` +
            `<button type="button" class="btn btn-sm btn-pill" data-action="deny" data-id="${row.id}">Deny</button>` +
            `<span class="editorial-card-decision-hint">Approving moves this card into the workflow board below.</span>` +
          `</div>` +
        `</div>`;
    }

    const body =
      `<div class="editorial-card-body">${ 
        bioFull ? `<div class="editorial-card-section"><p class="eyebrow">Bio</p><p>${bioFull}</p></div>` : "" 
        }<div class="editorial-card-section">` +
          `<p class="eyebrow">Files</p>` +
          `<div class="editorial-card-files">${ 
            row.essay_key ? `<button type="button" class="btn btn-sm btn-pill" data-action="download" data-id="${row.id}" data-which="essay">Download essay</button>` : '' 
            }${row.headshot_key ? `<button type="button" class="btn btn-sm btn-pill" data-action="download" data-id="${row.id}" data-which="headshot">Download headshot</button>` : '' 
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
      }</div>`;

    const tag = variant === "inbox" ? "li" : "article";
    return `<${tag} class="${cardClass}" draggable="true" data-id="${row.id}">${head}${body}</${tag}>`;
  }

  // -------------------------------------------------------------------------
  // Wire interactions on whichever card host we just rendered into.

  function wireCard(host) {
    if (!host) return;

    host.querySelectorAll('[data-card-toggle]').forEach((head) => {
      head.addEventListener("click", (ev) => {
        // Buttons inside the head shouldn't toggle the card.
        if (ev.target.closest("button, a, textarea, input")) return;
        const id = parseInt(head.getAttribute("data-id"), 10);
        if (expanded.has(id)) expanded.delete(id);
        else expanded.add(id);
        repaint();
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

  function showForbidden() {
    const body = root.querySelector(".container");
    if (!body) return;
    body.innerHTML =
      '<div class="admin-forbidden">' +
        '<p class="eyebrow">Staff only</p>' +
        '<h2 class="section-heading"><em>Not authorized.</em></h2>' +
        "<p>Your member email isn't on the Ghost staff list. Add yourself in Ghost Admin &rarr; Settings &rarr; Staff, then reload.</p>" +
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
