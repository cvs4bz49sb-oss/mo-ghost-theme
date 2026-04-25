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
 * Auth: window.MOAdminAuth.headers() — Ghost member JWT verified
 * worker-side against the live Ghost staff list.
 */
(function () {
  var root = document.querySelector("[data-admin-editorial]");
  if (!root) return;

  var apiBase = (root.getAttribute("data-api-base") || "").replace(/\/$/, "");
  if (!apiBase) {
    setStatus("Editorial admin is not configured — set @custom.membership_api_base in theme settings.");
    return;
  }

  var inboxEl = root.querySelector("[data-editorial-inbox]");
  var inboxEmpty = root.querySelector("[data-editorial-inbox-empty]");
  var statusEl = root.querySelector("[data-editorial-status]");
  var boardCols = {};
  var boardCounts = {};
  ["approved", "edited", "scheduled", "published", "denied"].forEach(function (s) {
    boardCols[s] = root.querySelector('[data-editorial-drop="' + s + '"]');
    boardCounts[s] = root.querySelector('[data-editorial-count="' + s + '"]');
  });

  // In-memory copy of every row, keyed by id. Moves are optimistic:
  // update locally + repaint, then POST. Card-expansion state is
  // tracked separately so a status change doesn't collapse cards
  // unrelated to the move.
  var rows = {};
  var expanded = new Set();
  var notesSaveTimers = {};

  hydrate();
  wireDropTargets();

  function hydrate() {
    setStatus("");
    window.MOAdminAuth.headers()
      .then(function (headers) {
        return fetch(apiBase + "/api/admin/submissions", { headers: headers, credentials: "omit" });
      })
      .then(function (r) {
        if (r.status === 401 || r.status === 403) { showForbidden(); return null; }
        if (!r.ok) { setStatus("Could not load submissions (" + r.status + ")."); return null; }
        return r.json();
      })
      .then(function (data) {
        if (!data) return;
        (data.submissions || []).forEach(function (row) { rows[row.id] = row; });
        repaint();
      })
      .catch(function (err) {
        console.error("editorial fetch failed", err);
        setStatus("Network error loading submissions.");
      });
  }

  function repaint() {
    var inboxRows = Object.values(rows).filter(function (r) { return r.status === "submitted"; });
    if (!inboxRows.length) {
      inboxEl.innerHTML = "";
      if (inboxEmpty) inboxEmpty.removeAttribute("hidden");
    } else {
      if (inboxEmpty) inboxEmpty.setAttribute("hidden", "");
      inboxEl.innerHTML = inboxRows.map(function (r) { return renderCard(r, "inbox"); }).join("");
    }
    wireCard(inboxEl);

    Object.keys(boardCols).forEach(function (status) {
      var col = boardCols[status];
      var count = boardCounts[status];
      var colRows = Object.values(rows)
        .filter(function (r) { return r.status === status; })
        .sort(function (a, b) { return (b.created_at || "").localeCompare(a.created_at || ""); });
      col.innerHTML = colRows.map(function (r) { return renderCard(r, "board"); }).join("");
      if (count) count.textContent = colRows.length;
      wireCard(col);
    });
  }

  // -------------------------------------------------------------------------
  // Card rendering — single template covers both inbox and board variants.
  // The expanded body is always rendered; CSS hides it until is-expanded.

  function renderCard(row, variant) {
    var name = escapeHtml(row.first_name + " " + (row.last_name || ""));
    var when = formatDate(row.created_at);
    var bioPreview = escapeHtml((row.bio || "").slice(0, 180));
    var bioFull = escapeHtml(row.bio || "");
    var notes = escapeAttr(row.notes || "");
    var meta = [];
    if (row.email) meta.push('<a href="mailto:' + escapeAttr(row.email) + '">' + escapeHtml(row.email) + '</a>');
    if (row.phone) meta.push(escapeHtml(row.phone));
    meta.push(escapeHtml(when));
    var isExpanded = expanded.has(row.id);
    var cardClass = (variant === "inbox" ? "editorial-inbox-card" : "editorial-card") + (isExpanded ? " is-expanded" : "");

    var hint = variant === "inbox"
      ? (isExpanded ? "Hide details" : "View details")
      : (isExpanded ? "Hide" : "View");

    var head =
      '<div class="editorial-card-head" data-card-toggle data-id="' + row.id + '">' +
        '<div class="editorial-card-headline">' +
          '<p class="editorial-card-name">' + name + '</p>' +
          '<p class="editorial-card-meta">' + meta.join(' &middot; ') + '</p>' +
          (variant === "inbox" && bioPreview ? '<p class="editorial-card-bio">' + bioPreview + (row.bio && row.bio.length > 180 ? "&hellip;" : "") + '</p>' : "") +
        '</div>' +
        '<span class="editorial-card-toggle" aria-hidden="true">' +
          '<span class="editorial-card-toggle-label">' + hint + '</span>' +
          '<span class="editorial-card-toggle-chevron">' + (isExpanded ? "&#9652;" : "&#9662;") + '</span>' +
        '</span>' +
      '</div>';

    // Decision row only for inbox cards — already-on-the-board cards
    // change status by drag-drop, not buttons. Sized to match the
    // download buttons above it so the section reads as a quiet
    // closing action, not a CTA banner.
    var decision = "";
    if (variant === "inbox") {
      decision =
        '<div class="editorial-card-section editorial-card-decision">' +
          '<p class="eyebrow">Decision</p>' +
          '<div class="editorial-card-decision-actions">' +
            '<button type="button" class="btn btn-sm btn-pill btn-primary" data-action="approve" data-id="' + row.id + '">Approve</button>' +
            '<button type="button" class="btn btn-sm btn-pill" data-action="deny" data-id="' + row.id + '">Deny</button>' +
            '<span class="editorial-card-decision-hint">Approving moves this card into the workflow board below.</span>' +
          '</div>' +
        '</div>';
    }

    var body =
      '<div class="editorial-card-body">' +
        (bioFull ? '<div class="editorial-card-section"><p class="eyebrow">Bio</p><p>' + bioFull + '</p></div>' : "") +
        '<div class="editorial-card-section">' +
          '<p class="eyebrow">Files</p>' +
          '<div class="editorial-card-files">' +
            (row.essay_key ? '<button type="button" class="btn btn-sm btn-pill" data-action="download" data-id="' + row.id + '" data-which="essay">Download essay</button>' : '') +
            (row.headshot_key ? '<button type="button" class="btn btn-sm btn-pill" data-action="download" data-id="' + row.id + '" data-which="headshot">Download headshot</button>' : '') +
            (!row.essay_key && !row.headshot_key ? '<p class="editorial-card-empty">No files archived.</p>' : '') +
          '</div>' +
        '</div>' +
        '<div class="editorial-card-section">' +
          '<label class="editorial-card-notes-label" for="editorial-notes-' + row.id + '">' +
            '<span class="eyebrow">Notes</span>' +
            '<span class="editorial-card-notes-state" data-notes-state></span>' +
          '</label>' +
          '<textarea class="editorial-card-notes" id="editorial-notes-' + row.id + '" data-notes data-id="' + row.id + '" rows="3" placeholder="Editor notes — saves automatically.">' + notes + '</textarea>' +
        '</div>' +
        decision +
      '</div>';

    var tag = variant === "inbox" ? "li" : "article";
    return '<' + tag + ' class="' + cardClass + '" draggable="true" data-id="' + row.id + '">' + head + body + '</' + tag + '>';
  }

  // -------------------------------------------------------------------------
  // Wire interactions on whichever card host we just rendered into.

  function wireCard(host) {
    if (!host) return;

    host.querySelectorAll('[data-card-toggle]').forEach(function (head) {
      head.addEventListener("click", function (ev) {
        // Buttons inside the head shouldn't toggle the card.
        if (ev.target.closest("button, a, textarea, input")) return;
        var id = parseInt(head.getAttribute("data-id"), 10);
        if (expanded.has(id)) expanded.delete(id);
        else expanded.add(id);
        repaint();
      });
    });

    host.querySelectorAll('[data-action="approve"], [data-action="deny"]').forEach(function (btn) {
      btn.addEventListener("click", function (ev) {
        ev.preventDefault();
        ev.stopPropagation();
        var id = btn.getAttribute("data-id");
        var next = btn.getAttribute("data-action") === "approve" ? "approved" : "denied";
        moveCard(id, next);
      });
    });

    host.querySelectorAll('[data-action="download"]').forEach(function (btn) {
      btn.addEventListener("click", function (ev) {
        ev.preventDefault();
        ev.stopPropagation();
        downloadFile(btn.getAttribute("data-id"), btn.getAttribute("data-which"), btn);
      });
    });

    host.querySelectorAll("[data-notes]").forEach(function (ta) {
      ta.addEventListener("input", function () {
        var id = ta.getAttribute("data-id");
        clearTimeout(notesSaveTimers[id]);
        var stateEl = ta.closest(".editorial-card-body").querySelector("[data-notes-state]");
        if (stateEl) stateEl.textContent = "Editing…";
        notesSaveTimers[id] = setTimeout(function () { saveNotes(id, ta.value, stateEl); }, 700);
      });
      ta.addEventListener("blur", function () {
        var id = ta.getAttribute("data-id");
        clearTimeout(notesSaveTimers[id]);
        var stateEl = ta.closest(".editorial-card-body").querySelector("[data-notes-state]");
        saveNotes(id, ta.value, stateEl);
      });
    });

    wireDraggables(host);
  }

  // -------------------------------------------------------------------------
  // Drag-drop

  function wireDraggables(host) {
    host.querySelectorAll('[draggable="true"]').forEach(function (card) {
      card.addEventListener("dragstart", function (ev) {
        ev.dataTransfer.setData("text/plain", card.getAttribute("data-id"));
        ev.dataTransfer.effectAllowed = "move";
        card.classList.add("is-dragging");
      });
      card.addEventListener("dragend", function () { card.classList.remove("is-dragging"); });
    });
  }

  function wireDropTargets() {
    Object.keys(boardCols).forEach(function (status) {
      var col = boardCols[status];
      if (!col) return;
      col.addEventListener("dragover", function (ev) {
        ev.preventDefault();
        ev.dataTransfer.dropEffect = "move";
        col.classList.add("is-drop-target");
      });
      col.addEventListener("dragleave", function () { col.classList.remove("is-drop-target"); });
      col.addEventListener("drop", function (ev) {
        ev.preventDefault();
        col.classList.remove("is-drop-target");
        var id = ev.dataTransfer.getData("text/plain");
        if (id) moveCard(id, status);
      });
    });
  }

  // -------------------------------------------------------------------------
  // State change — optimistic update + persist.

  function moveCard(id, nextStatus) {
    var row = rows[id];
    if (!row) return;
    if (row.status === nextStatus) return;
    var prevStatus = row.status;
    row.status = nextStatus;
    repaint();
    setStatus("");

    window.MOAdminAuth.headers({ "Content-Type": "application/json" })
      .then(function (headers) {
        return fetch(apiBase + "/api/admin/submissions/" + encodeURIComponent(id) + "/status", {
          method: "POST", headers: headers, credentials: "omit",
          body: JSON.stringify({ status: nextStatus }),
        });
      })
      .then(function (r) {
        if (r.status === 401 || r.status === 403) {
          row.status = prevStatus; repaint(); showForbidden(); return;
        }
        if (!r.ok) {
          row.status = prevStatus; repaint();
          setStatus("Couldn't save move (" + r.status + "). Reverted.");
        }
      })
      .catch(function (err) {
        console.error("editorial move failed", err);
        row.status = prevStatus; repaint();
        setStatus("Network error saving move. Reverted.");
      });
  }

  function saveNotes(id, value, stateEl) {
    var row = rows[id];
    if (!row) return;
    var trimmed = String(value || "");
    if ((row.notes || "") === trimmed) {
      if (stateEl) stateEl.textContent = "";
      return;
    }
    if (stateEl) stateEl.textContent = "Saving…";

    window.MOAdminAuth.headers({ "Content-Type": "application/json" })
      .then(function (headers) {
        return fetch(apiBase + "/api/admin/submissions/" + encodeURIComponent(id) + "/notes", {
          method: "POST", headers: headers, credentials: "omit",
          body: JSON.stringify({ notes: trimmed }),
        });
      })
      .then(function (r) {
        if (!r.ok) {
          if (stateEl) stateEl.textContent = "Save failed.";
          return;
        }
        row.notes = trimmed;
        if (stateEl) {
          stateEl.textContent = "Saved";
          setTimeout(function () { if (stateEl.textContent === "Saved") stateEl.textContent = ""; }, 2000);
        }
      })
      .catch(function (err) {
        console.error("notes save failed", err);
        if (stateEl) stateEl.textContent = "Save failed.";
      });
  }

  function downloadFile(id, which, btn) {
    var origLabel = btn.textContent;
    btn.disabled = true;
    btn.textContent = "Downloading…";
    window.MOAdminAuth.headers()
      .then(function (headers) {
        return fetch(apiBase + "/api/admin/submissions/" + encodeURIComponent(id) + "/" + which, {
          headers: headers, credentials: "omit",
        });
      })
      .then(function (r) {
        if (!r.ok) throw new Error("HTTP " + r.status);
        // Filename from Content-Disposition if provided.
        var dispo = r.headers.get("content-disposition") || "";
        var m = /filename="?([^"]+)"?/.exec(dispo);
        var filename = m ? m[1] : (which + (which === "essay" ? ".docx" : ".jpg"));
        return r.blob().then(function (blob) { return { blob: blob, filename: filename }; });
      })
      .then(function (data) {
        var url = URL.createObjectURL(data.blob);
        var a = document.createElement("a");
        a.href = url;
        a.download = data.filename;
        document.body.appendChild(a);
        a.click();
        a.remove();
        URL.revokeObjectURL(url);
      })
      .catch(function (err) {
        console.error("download failed", err);
        setStatus("Download failed: " + err.message);
      })
      .then(function () {
        btn.disabled = false;
        btn.textContent = origLabel;
      });
  }

  // -------------------------------------------------------------------------

  function showForbidden() {
    var body = root.querySelector(".container");
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
    return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
    });
  }
  function escapeAttr(s) { return escapeHtml(s); }
  function formatDate(iso) {
    if (!iso) return "";
    var d = new Date(iso.replace(" ", "T") + (iso.includes("Z") ? "" : "Z"));
    if (isNaN(d.getTime())) return iso;
    return d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
  }
})();
