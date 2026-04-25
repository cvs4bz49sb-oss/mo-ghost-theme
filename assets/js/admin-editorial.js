/*
 * /admin/editorial/ hydration.
 *
 * Two views:
 *   1. Inbox — every submission with status='submitted'. Each row is a
 *      card with Approve / Deny inline buttons (also draggable directly
 *      to a board column).
 *   2. Board — five workflow columns (Approved, Edited, Scheduled,
 *      Published, Denied). Cards drag between any of them.
 *
 * State changes (button clicks AND drag-drops) hit
 * POST {api-base}/api/admin/submissions/<id>/status with { status }.
 * The card moves immediately on success; on failure we revert + show
 * the error in the status line.
 *
 * Auth: window.MOAdminAuth.headers() — Ghost member JWT, verified
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
  // we update locally + repaint, then POST. On error we revert.
  var rows = {};

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
    // Inbox = status='submitted', newest first (the API already sorts
    // newest-first; we just filter).
    var inboxRows = Object.values(rows).filter(function (r) { return r.status === "submitted"; });
    if (!inboxRows.length) {
      inboxEl.innerHTML = "";
      if (inboxEmpty) inboxEmpty.removeAttribute("hidden");
    } else {
      if (inboxEmpty) inboxEmpty.setAttribute("hidden", "");
      inboxEl.innerHTML = inboxRows.map(renderInboxCard).join("");
    }
    wireInboxButtons();
    wireDraggables(inboxEl);

    // Board columns.
    Object.keys(boardCols).forEach(function (status) {
      var col = boardCols[status];
      var count = boardCounts[status];
      var colRows = Object.values(rows)
        .filter(function (r) { return r.status === status; })
        .sort(function (a, b) { return (b.created_at || "").localeCompare(a.created_at || ""); });
      col.innerHTML = colRows.map(renderBoardCard).join("");
      if (count) count.textContent = colRows.length;
      wireDraggables(col);
    });
  }

  // -------------------------------------------------------------------------
  // Cards

  function renderInboxCard(row) {
    var name = escapeHtml(row.first_name + " " + row.last_name);
    var when = formatDate(row.created_at);
    var bio = escapeHtml((row.bio || "").slice(0, 240));
    var essayUrl = essayLink(row);
    return (
      '<li class="editorial-inbox-card" draggable="true" data-id="' + row.id + '">' +
        '<div class="editorial-inbox-card-head">' +
          '<div>' +
            '<p class="editorial-card-name">' + name + '</p>' +
            '<p class="editorial-card-meta">' +
              '<a href="mailto:' + escapeAttr(row.email) + '">' + escapeHtml(row.email) + '</a>' +
              (row.phone ? ' &middot; ' + escapeHtml(row.phone) : "") +
              ' &middot; ' + escapeHtml(when) +
            '</p>' +
          '</div>' +
          '<div class="editorial-card-actions">' +
            (essayUrl ? '<a href="' + escapeAttr(essayUrl) + '" class="editorial-card-link" target="_blank" rel="noopener">Essay &rarr;</a>' : "") +
            '<button type="button" class="btn btn-sm btn-pill btn-primary" data-action="approve" data-id="' + row.id + '">Approve</button>' +
            '<button type="button" class="btn btn-sm btn-pill" data-action="deny" data-id="' + row.id + '">Deny</button>' +
          '</div>' +
        '</div>' +
        (bio ? '<p class="editorial-card-bio">' + bio + (row.bio.length > 240 ? "&hellip;" : "") + '</p>' : "") +
      '</li>'
    );
  }

  function renderBoardCard(row) {
    var name = escapeHtml(row.first_name + " " + row.last_name);
    var when = formatDate(row.updated_at || row.created_at);
    var essayUrl = essayLink(row);
    return (
      '<article class="editorial-card" draggable="true" data-id="' + row.id + '">' +
        '<p class="editorial-card-name">' + name + '</p>' +
        '<p class="editorial-card-meta">' + escapeHtml(when) + '</p>' +
        (essayUrl ? '<a href="' + escapeAttr(essayUrl) + '" class="editorial-card-link" target="_blank" rel="noopener">Essay &rarr;</a>' : "") +
      '</article>'
    );
  }

  function essayLink(row) {
    // We don't have a public R2 URL by default — the essay/headshot are
    // archived for backup. Surface the R2 key as a copyable string for
    // now; if @custom.submissions_public_base is added later, point the
    // link at that domain.
    if (!row.essay_key) return null;
    return "/admin/editorial/file?key=" + encodeURIComponent(row.essay_key);
  }

  // -------------------------------------------------------------------------
  // Inbox buttons (Approve / Deny)

  function wireInboxButtons() {
    inboxEl.querySelectorAll("[data-action]").forEach(function (btn) {
      btn.addEventListener("click", function (ev) {
        ev.preventDefault();
        var id = btn.getAttribute("data-id");
        var action = btn.getAttribute("data-action");
        var next = action === "approve" ? "approved" : "denied";
        moveCard(id, next);
      });
    });
  }

  // -------------------------------------------------------------------------
  // Drag and drop

  function wireDraggables(host) {
    if (!host) return;
    host.querySelectorAll('[draggable="true"]').forEach(function (card) {
      card.addEventListener("dragstart", function (ev) {
        var id = card.getAttribute("data-id");
        ev.dataTransfer.setData("text/plain", id);
        ev.dataTransfer.effectAllowed = "move";
        card.classList.add("is-dragging");
      });
      card.addEventListener("dragend", function () {
        card.classList.remove("is-dragging");
      });
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
      col.addEventListener("dragleave", function () {
        col.classList.remove("is-drop-target");
      });
      col.addEventListener("drop", function (ev) {
        ev.preventDefault();
        col.classList.remove("is-drop-target");
        var id = ev.dataTransfer.getData("text/plain");
        if (!id) return;
        moveCard(id, status);
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
          method: "POST",
          headers: headers,
          credentials: "omit",
          body: JSON.stringify({ status: nextStatus }),
        });
      })
      .then(function (r) {
        if (r.status === 401 || r.status === 403) {
          row.status = prevStatus;
          repaint();
          showForbidden();
          return;
        }
        if (!r.ok) {
          row.status = prevStatus;
          repaint();
          setStatus("Couldn't save move (" + r.status + "). Reverted.");
        }
      })
      .catch(function (err) {
        console.error("editorial move failed", err);
        row.status = prevStatus;
        repaint();
        setStatus("Network error saving move. Reverted.");
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
