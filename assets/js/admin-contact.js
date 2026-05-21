/*
 * /admin/contact/ — contact form inbox.
 *
 * All contact form submissions in one place, filterable by type via
 * a dropdown. Click a message to expand it. Auto-marks as read on open.
 * Unread counts update in the dropdown option labels.
 *
 * Auth: window.MOAuth.fetch — Ghost member JWT verified against
 * mo-admin permissions (requires "contact" tool access).
 */
(function () {
  "use strict";

  const root = document.querySelector("[data-admin-contact]");
  if (!root) return;

  const adminUrl = (root.getAttribute("data-admin-url") || "").replace(/\/$/, "");
  if (!adminUrl) {
    setStatus("Contact inbox is not configured — set @custom.admin_worker_url in theme settings.");
    return;
  }

  const TYPE_LABELS = {
    all: "All Messages",
    partnership_request: "Partnership Request",
    technical_support: "Technical Support",
    media_query: "Media Query",
    general_feedback: "General Feedback",
    other: "Other",
  };

  const listEl = root.querySelector("[data-contact-list]");
  const emptyEl = root.querySelector("[data-contact-empty]");
  const statusEl = root.querySelector("[data-contact-status]");
  const filterSelect = root.querySelector("[data-contact-filter-select]");

  let messages = {};
  let activeFilter = "all";

  hydrate();
  wireFilters();

  // -------------------------------------------------------------------------
  // Data

  function hydrate() {
    setStatus("");
    window.MOAuth.fetch(`${adminUrl}/contact/messages`, { credentials: "omit" })
      .then((r) => {
        if (r.status === 401 || r.status === 403) { showForbidden(); return null; }
        if (!r.ok) { setStatus(`Could not load messages (${r.status}).`); return null; }
        return r.json();
      })
      .then((data) => {
        if (!data) return;
        messages = {};
        (data.messages || []).forEach((m) => { messages[m.id] = m; });
        updateUnreadCounts();
        repaint();
      })
      .catch((err) => {
        console.error("contact fetch failed", err);
        setStatus("Network error loading messages.");
      });
  }

  // -------------------------------------------------------------------------
  // Rendering

  function repaint() {
    const all = Object.values(messages)
      .sort((a, b) => (b.created_at || "").localeCompare(a.created_at || ""));
    const filtered = activeFilter === "all"
      ? all
      : all.filter((m) => m.type === activeFilter);

    if (!filtered.length) {
      listEl.innerHTML = "";
      if (emptyEl) emptyEl.removeAttribute("hidden");
    } else {
      if (emptyEl) emptyEl.setAttribute("hidden", "");
      listEl.innerHTML = filtered.map(renderRow).join("");
      wireRows();
    }
  }

  function renderRow(m) {
    const name = escapeHtml(`${m.first_name} ${m.last_name || ""}`.trim());
    const typeLabel = escapeHtml(TYPE_LABELS[m.type] || m.type || "Other");
    const when = formatDate(m.created_at);
    const unread = !m.read;
    return (
      `<li class="contact-msg-row${unread ? " is-unread" : ""}" data-id="${m.id}">` +
        `<div class="contact-msg-head" data-action="toggle" data-id="${m.id}">` +
          `<span class="contact-msg-name">${name}${ 
            unread ? `<span class="contact-msg-dot"></span>` : "" 
          }</span>` +
          `<span class="contact-msg-badge contact-type-${escapeAttr(m.type || "other")}">${typeLabel}</span>` +
          `<span class="contact-msg-date">${escapeHtml(when)}</span>` +
        `</div>` +
        `<div class="contact-msg-body" hidden>` +
          `<p class="contact-msg-email">` +
            `<a href="mailto:${escapeAttr(m.email)}">${escapeHtml(m.email || "")}</a>` +
          `</p>` +
          `<p class="contact-msg-text">${escapeHtml(m.message || "")}</p>` +
          `<div class="contact-msg-actions">` +
            `<button type="button" class="btn btn-sm" data-action="${unread ? "mark-read" : "mark-unread"}" data-id="${m.id}">${ 
              unread ? "Mark read" : "Mark unread" 
            }</button>` +
            `<a href="mailto:${escapeAttr(m.email)}?subject=${encodeURIComponent("Re: Your message to Mere Orthodoxy")}" class="btn btn-sm">Reply</a>` +
            `<button type="button" class="btn btn-sm btn-danger" data-action="delete" data-id="${m.id}">Delete</button>` +
            `<select class="contact-assign-select" data-assign-contact="${escapeAttr(m.id)}" data-id="${escapeAttr(m.id)}"><option value="">Assign to…</option></select>` +
          `</div>` +
        `</div>` +
      `</li>`
    );
  }

  // -------------------------------------------------------------------------
  // Wire interactions

  function wireRows() {
    listEl.querySelectorAll('[data-action="toggle"]').forEach((el) => {
      el.addEventListener("click", () => {
        const id = el.getAttribute("data-id");
        const row = listEl.querySelector(`li[data-id="${id}"]`);
        if (!row) return;
        const body = row.querySelector(".contact-msg-body");
        if (!body) return;
        const wasHidden = body.hasAttribute("hidden");
        // Collapse any open row first.
        listEl.querySelectorAll(".contact-msg-body").forEach((b) => b.setAttribute("hidden", ""));
        if (wasHidden) {
          body.removeAttribute("hidden");
          // Auto-mark as read on open.
          if (messages[id] && !messages[id].read) markRead(id, true);
        }
      });
    });

    listEl.querySelectorAll('[data-action="mark-read"], [data-action="mark-unread"]').forEach((btn) => {
      btn.addEventListener("click", (ev) => {
        ev.stopPropagation();
        const id = btn.getAttribute("data-id");
        markRead(id, btn.getAttribute("data-action") === "mark-read");
      });
    });

    listEl.querySelectorAll('[data-action="delete"]').forEach((btn) => {
      btn.addEventListener("click", (ev) => {
        ev.stopPropagation();
        const id = btn.getAttribute("data-id");
        const m = messages[id];
        if (!m) return;
        const name = `${m.first_name} ${m.last_name || ""}`.trim();
        if (!confirm(`Delete message from "${name}"? This cannot be undone.`)) return;
        deleteMessage(id, btn);
      });
    });

    // Assign-to selects — populate async, wire change
    listEl.querySelectorAll("[data-assign-contact]").forEach((sel) => {
      const id = sel.getAttribute("data-id");
      const m = messages[id];
      if (!m) return;
      if (window.MOAdmin && window.MOAdmin.getUsers) {
        window.MOAdmin.getUsers(adminUrl).then((users) => {
          const current = m.assigned_to || "";
          users.forEach((u) => {
            const opt = document.createElement("option");
            opt.value = u.email;
            opt.textContent = u.name;
            if (u.email === current) opt.selected = true;
            sel.appendChild(opt);
          });
        });
      }
      sel.addEventListener("change", (ev) => {
        ev.stopPropagation();
        const email = sel.value || null;
        const name = email ? sel.options[sel.selectedIndex].textContent : null;
        assignMessage(id, email, name);
      });
    });
  }

  function wireFilters() {
    if (!filterSelect) return;
    filterSelect.addEventListener("change", () => {
      activeFilter = filterSelect.value;
      repaint();
    });
  }

  // -------------------------------------------------------------------------
  // Actions

  function markRead(id, read) {
    const m = messages[id];
    if (!m) return;
    m.read = read ? 1 : 0;
    repaint();
    updateUnreadCounts();
    window.MOAuth.fetch(`${adminUrl}/contact/messages/${encodeURIComponent(id)}/read`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "omit",
      body: JSON.stringify({ read }),
    }).catch((err) => { console.error("mark read failed", err); });
  }

  function deleteMessage(id, btn) {
    const origLabel = btn.textContent;
    btn.disabled = true;
    btn.textContent = "Deleting…";
    window.MOAuth.fetch(`${adminUrl}/contact/messages/${encodeURIComponent(id)}`, {
      method: "DELETE",
      credentials: "omit",
    })
      .then((r) => {
        if (!r.ok) { setStatus(`Couldn't delete (${r.status}).`); btn.disabled = false; btn.textContent = origLabel; return; }
        delete messages[id];
        updateUnreadCounts();
        repaint();
      })
      .catch(() => { setStatus("Network error."); btn.disabled = false; btn.textContent = origLabel; });
  }

  // -------------------------------------------------------------------------
  // Unread count labels on dropdown options

  function updateUnreadCounts() {
    if (!filterSelect) return;
    const all = Object.values(messages);
    filterSelect.querySelectorAll("option").forEach((opt) => {
      const filter = opt.value;
      const unread = filter === "all"
        ? all.filter((m) => !m.read).length
        : all.filter((m) => m.type === filter && !m.read).length;
      const base = TYPE_LABELS[filter] || filter;
      opt.textContent = unread > 0 ? `${base} (${unread} unread)` : base;
    });
  }

  // -------------------------------------------------------------------------
  // Helpers

  function assignMessage(id, email, name) {
    const m = messages[id];
    if (!m) return;
    m.assigned_to = email || null;
    window.MOAuth.fetch(`${adminUrl}/contact/messages/${encodeURIComponent(id)}/assign`, {
      method: "POST", headers: { "Content-Type": "application/json" }, credentials: "omit",
      body: JSON.stringify({ assigned_to: email || null }),
    }).catch(() => {});
    if (email) {
      const senderName = `${m.first_name} ${m.last_name || ""}`.trim();
      window.MOAuth.fetch(`${adminUrl}/inbox/notify`, {
        method: "POST", headers: { "Content-Type": "application/json" }, credentials: "omit",
        body: JSON.stringify({
          to_emails: [email],
          type: "assignment",
          source: "contact",
          source_id: id,
          source_title: `Message from ${senderName}`,
          source_url: "/admin/contact/",
          snippet: `You were assigned a message from ${senderName}`,
        }),
      }).catch(() => {});
    }
  }

  function showForbidden() {
    const container = root.querySelector(".container");
    if (!container) return;
    container.innerHTML =
      '<div class="admin-forbidden">' +
        '<p class="eyebrow">Access Denied</p>' +
        '<h2 class="section-heading"><em>No access.</em></h2>' +
        "<p>You don't have permission to view the contact inbox.</p>" +
      '</div>';
  }

  function setStatus(msg) { if (statusEl) statusEl.textContent = msg || ""; }

  function escapeHtml(s) {
    return String(s == null ? "" : s).replace(/[&<>"']/g, (c) => (
      { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]
    ));
  }

  function escapeAttr(s) { return escapeHtml(s); }

  function formatDate(iso) {
    if (!iso) return "";
    const d = new Date(iso);
    if (isNaN(d.getTime())) return iso;
    return d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
  }
})();
