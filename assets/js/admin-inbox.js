(function () {
  "use strict";

  const root = document.querySelector("[data-admin-inbox]");
  if (!root) return;

  const adminUrl = (root.getAttribute("data-admin-url") || "").replace(/\/$/, "");
  if (!adminUrl) return;

  const listEl = root.querySelector("[data-inbox-list]");
  const emptyEl = root.querySelector("[data-inbox-empty]");
  const statusEl = root.querySelector("[data-inbox-status]");
  const filterBtns = root.querySelectorAll("[data-inbox-filter]");

  let notifications = {};
  let activeFilter = "all";

  const SOURCE_LABELS = {
    editorial: "Editorial",
    contact: "Contact",
    sponsors: "Sponsors",
    agenda: "Agenda",
    members: "Members",
    traffic: "Traffic",
  };

  const STATUS_OPTIONS_EDITORIAL = ["submitted", "reviewing", "accepted", "rejected", "published"];
  const STATUS_OPTIONS_SPONSORS = ["prospect", "pitched", "negotiating", "confirmed", "live", "completed", "passed"];

  hydrate();
  wireFilters();

  // Expose refresh for sidebar badge
  window.MOInbox = window.MOInbox || {};
  window.MOInbox.refresh = hydrate;

  function hydrate() {
    setStatus("");
    window.MOAuth.fetch(`${adminUrl}/inbox/notifications`, { credentials: "omit" })
      .then((r) => {
        if (r.status === 401 || r.status === 403) { showForbidden(); return null; }
        if (!r.ok) { setStatus(`Could not load inbox (${r.status}).`); return null; }
        return r.json();
      })
      .then((data) => {
        if (!data) return;
        notifications = {};
        (data.notifications || []).forEach((n) => { notifications[n.id] = n; });
        updateFilterCounts();
        repaint();
      })
      .catch(() => setStatus("Network error loading inbox."));
  }

  function repaint() {
    const all = Object.values(notifications)
      .sort((a, b) => (b.created_at || "").localeCompare(a.created_at || ""));
    const filtered = activeFilter === "all"
      ? all
      : all.filter((n) => n.type === activeFilter || (activeFilter === "assignment" && n.type === "new_item"));

    if (!filtered.length) {
      listEl.innerHTML = "";
      if (emptyEl) emptyEl.removeAttribute("hidden");
    } else {
      if (emptyEl) emptyEl.setAttribute("hidden", "");
      listEl.innerHTML = filtered.map(renderRow).join("");
      wireRows();
    }
  }

  function renderRow(n) {
    const title = escapeHtml(n.source_title || "Untitled");
    const sourceLabel = escapeHtml(SOURCE_LABELS[n.source] || n.source || "");
    const fromName = escapeHtml(n.from_name || "");
    const when = formatDate(n.created_at);
    const unread = !n.read;
    const snippet = renderMentions(n.snippet || "");

    // Inline actions based on source type
    let inlineActions = "";
    if (n.source === "editorial") {
      const opts = STATUS_OPTIONS_EDITORIAL.map((s) =>
        `<option value="${s}"${n.source_status === s ? " selected" : ""}>${capitalize(s)}</option>`
      ).join("");
      inlineActions = `
        <select class="inbox-status-select" data-action="update-status" data-source="editorial" data-source-id="${escapeAttr(n.source_id)}">
          <option value="">Change status&hellip;</option>${opts}
        </select>
        <button type="button" class="btn btn-sm btn-danger" data-action="delete-source" data-source="editorial" data-source-id="${escapeAttr(n.source_id)}">Delete submission</button>`;
    } else if (n.source === "contact") {
      inlineActions = `
        <a href="mailto:${escapeAttr(n.source_email || "")}" class="btn btn-sm">Reply by email</a>
        <button type="button" class="btn btn-sm btn-danger" data-action="delete-source" data-source="contact" data-source-id="${escapeAttr(n.source_id)}">Delete message</button>`;
    } else if (n.source === "sponsors") {
      const opts = STATUS_OPTIONS_SPONSORS.map((s) =>
        `<option value="${s}"${n.source_status === s ? " selected" : ""}>${capitalize(s)}</option>`
      ).join("");
      inlineActions = `
        <select class="inbox-status-select" data-action="update-status" data-source="sponsors" data-source-id="${escapeAttr(n.source_id)}">
          <option value="">Change status&hellip;</option>${opts}
        </select>
        <button type="button" class="btn btn-sm btn-danger" data-action="delete-source" data-source="sponsors" data-source-id="${escapeAttr(n.source_id)}">Delete</button>`;
    }

    return (
      `<li class="inbox-row${unread ? " is-unread" : ""}" data-id="${escapeAttr(n.id)}"` +
        ` draggable="true" data-title="${escapeAttr(n.source_title || "")}" data-url="${escapeAttr(n.source_url || "")}">` +
        `<div class="inbox-row-head" data-action="toggle" data-id="${escapeAttr(n.id)}">` +
          `<span class="inbox-source-badge inbox-source-${escapeAttr(n.source || "other")}">${sourceLabel}</span>` +
          `<span class="inbox-row-title">${title}${unread ? `<span class="inbox-unread-dot"></span>` : ""}</span>` +
          `<span class="inbox-row-from">${fromName}</span>` +
          `<span class="inbox-row-date">${escapeHtml(when)}</span>` +
        `</div>` +
        `<div class="inbox-row-body" hidden>` +
          (snippet ? `<p class="inbox-snippet">${snippet}</p>` : "") +
          `<div class="inbox-row-actions">` +
            `<a href="${escapeAttr(n.source_url || "#")}" class="btn btn-sm">View</a>` +
            `<button type="button" class="btn btn-sm" data-action="${unread ? "mark-read" : "mark-unread"}" data-id="${escapeAttr(n.id)}">${unread ? "Mark read" : "Mark unread"}</button>` +
            `<button type="button" class="btn btn-sm btn-danger" data-action="dismiss" data-id="${escapeAttr(n.id)}">Dismiss</button>` +
            `<button type="button" class="btn btn-sm" data-action="add-to-todo" data-id="${escapeAttr(n.id)}" data-title="${escapeAttr(n.source_title || "")}" data-url="${escapeAttr(n.source_url || "")}">+ To&#8209;Do</button>` +
            inlineActions +
          `</div>` +
        `</div>` +
      `</li>`
    );
  }

  function wireRows() {
    // Toggle expand
    listEl.querySelectorAll('[data-action="toggle"]').forEach((el) => {
      el.addEventListener("click", () => {
        const id = el.getAttribute("data-id");
        const row = listEl.querySelector(`li[data-id="${id}"]`);
        if (!row) return;
        const body = row.querySelector(".inbox-row-body");
        if (!body) return;
        const wasHidden = body.hasAttribute("hidden");
        listEl.querySelectorAll(".inbox-row-body").forEach((b) => b.setAttribute("hidden", ""));
        if (wasHidden) {
          body.removeAttribute("hidden");
          if (notifications[id] && !notifications[id].read) markRead(id, true);
        }
      });
    });

    // Mark read/unread
    listEl.querySelectorAll('[data-action="mark-read"], [data-action="mark-unread"]').forEach((btn) => {
      btn.addEventListener("click", (e) => {
        e.stopPropagation();
        const id = btn.getAttribute("data-id");
        markRead(id, btn.getAttribute("data-action") === "mark-read");
      });
    });

    // Dismiss
    listEl.querySelectorAll('[data-action="dismiss"]').forEach((btn) => {
      btn.addEventListener("click", (e) => {
        e.stopPropagation();
        const id = btn.getAttribute("data-id");
        dismissNotif(id);
      });
    });

    // Add to To-Do (touch-friendly fallback for drag)
    listEl.querySelectorAll('[data-action="add-to-todo"]').forEach((btn) => {
      btn.addEventListener("click", (e) => {
        e.stopPropagation();
        const title = btn.getAttribute("data-title") || "Untitled";
        const url = btn.getAttribute("data-url") || "";
        if (window.MOTodos && window.MOTodos.addItem) {
          window.MOTodos.addItem(title, "today", url);
          btn.textContent = "Added!";
          btn.disabled = true;
          setTimeout(() => { btn.textContent = "+ To‑Do"; btn.disabled = false; }, 1500);
        }
      });
    });

    // Status updates
    listEl.querySelectorAll('[data-action="update-status"]').forEach((sel) => {
      sel.addEventListener("change", (e) => {
        e.stopPropagation();
        const source = sel.getAttribute("data-source");
        const sourceId = sel.getAttribute("data-source-id");
        const status = sel.value;
        if (!status) return;
        updateSourceStatus(source, sourceId, status, sel);
      });
    });

    // Delete source
    listEl.querySelectorAll('[data-action="delete-source"]').forEach((btn) => {
      btn.addEventListener("click", (e) => {
        e.stopPropagation();
        const source = btn.getAttribute("data-source");
        const sourceId = btn.getAttribute("data-source-id");
        if (!confirm("Delete this item? This cannot be undone.")) return;
        deleteSource(source, sourceId, btn);
      });
    });

    // Drag
    listEl.querySelectorAll("li.inbox-row").forEach((row) => {
      row.addEventListener("dragstart", (e) => {
        const payload = JSON.stringify({
          title: row.getAttribute("data-title") || "",
          source_url: row.getAttribute("data-url") || "",
          source: row.getAttribute("data-source") || "",
        });
        e.dataTransfer.setData("text/x-inbox-item", payload);
        e.dataTransfer.effectAllowed = "copy";
        row.classList.add("is-dragging");
      });
      row.addEventListener("dragend", () => row.classList.remove("is-dragging"));
    });
  }

  function wireFilters() {
    filterBtns.forEach((btn) => {
      btn.addEventListener("click", () => {
        activeFilter = btn.getAttribute("data-inbox-filter");
        filterBtns.forEach((b) => b.classList.toggle("is-active", b === btn));
        repaint();
      });
    });
  }

  function markRead(id, read) {
    const n = notifications[id];
    if (!n) return;
    n.read = read;
    repaint();
    updateFilterCounts();
    window.MOAuth.fetch(`${adminUrl}/inbox/notifications/${encodeURIComponent(id)}/read`, {
      method: "POST", headers: { "Content-Type": "application/json" }, credentials: "omit",
      body: JSON.stringify({ read }),
    }).catch(() => {});
  }

  function dismissNotif(id) {
    delete notifications[id];
    repaint();
    updateFilterCounts();
    window.MOAuth.fetch(`${adminUrl}/inbox/notifications/${encodeURIComponent(id)}`, {
      method: "DELETE", credentials: "omit",
    }).catch(() => {});
  }

  function updateSourceStatus(source, sourceId, status, sel) {
    sel.disabled = true;
    const urlMap = {
      editorial: `${adminUrl}/editorial/submissions/${encodeURIComponent(sourceId)}/status`,
      sponsors: `${adminUrl}/sponsors/sponsorships/${encodeURIComponent(sourceId)}/status`,
    };
    const url = urlMap[source];
    if (!url) { sel.disabled = false; return; }
    window.MOAuth.fetch(url, {
      method: "POST", headers: { "Content-Type": "application/json" }, credentials: "omit",
      body: JSON.stringify({ status }),
    })
      .then((r) => { if (!r.ok) throw new Error(r.status); sel.disabled = false; })
      .catch(() => { sel.disabled = false; setStatus("Status update failed."); });
  }

  function deleteSource(source, sourceId, btn) {
    btn.disabled = true;
    const urlMap = {
      editorial: `${adminUrl}/editorial/submissions/${encodeURIComponent(sourceId)}`,
      contact: `${adminUrl}/contact/messages/${encodeURIComponent(sourceId)}`,
      sponsors: `${adminUrl}/sponsors/sponsorships/${encodeURIComponent(sourceId)}`,
    };
    const url = urlMap[source];
    if (!url) { btn.disabled = false; return; }
    window.MOAuth.fetch(url, { method: "DELETE", credentials: "omit" })
      .then((r) => { if (!r.ok) throw new Error(r.status); })
      .catch(() => { btn.disabled = false; setStatus("Delete failed."); });
  }

  function updateFilterCounts() {
    const all = Object.values(notifications);
    filterBtns.forEach((btn) => {
      const filter = btn.getAttribute("data-inbox-filter");
      const badge = btn.querySelector("[data-count]");
      if (!badge) return;
      let unread;
      if (filter === "all") unread = all.filter((n) => !n.read).length;
      else if (filter === "assignment") unread = all.filter((n) => !n.read && (n.type === "assignment" || n.type === "new_item")).length;
      else unread = all.filter((n) => !n.read && n.type === filter).length;
      badge.textContent = unread || "";
      badge.classList.toggle("has-count", unread > 0);
    });
    // Update sidebar badge
    const sidebarBadge = document.querySelector("[data-inbox-badge]");
    if (sidebarBadge) {
      const total = all.filter((n) => !n.read).length;
      sidebarBadge.textContent = total || "";
      sidebarBadge.classList.toggle("has-count", total > 0);
    }
  }

  function showForbidden() {
    root.innerHTML = '<div class="admin-forbidden"><p>No access to inbox.</p></div>';
  }

  function setStatus(msg) { if (statusEl) statusEl.textContent = msg || ""; }

  function renderMentions(text) {
    return escapeHtml(text).replace(
      /@\[([^\]]+)\]\([^)]+\)/g,
      (_, name) => `<span class="mention-chip">@${escapeHtml(name)}</span>`
    );
  }

  function capitalize(s) { return s ? s[0].toUpperCase() + s.slice(1) : s; }

  function escapeHtml(s) {
    return String(s == null ? "" : s).replace(/[&<>"']/g, (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c])
    );
  }
  function escapeAttr(s) { return escapeHtml(s); }

  function formatDate(iso) {
    if (!iso) return "";
    const d = new Date(iso);
    if (isNaN(d.getTime())) return iso;
    return d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
  }
})();
