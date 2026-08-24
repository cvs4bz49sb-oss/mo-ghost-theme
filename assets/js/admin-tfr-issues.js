/*
 * Reader issue reports for The Faith Received.
 *
 * Written by mo-forms when someone uses "Report An Issue" in the text
 * tools, read here out of the shared mo-membership D1 through
 * mo-admin. Ten to a page, because an inbox is worked through rather
 * than surveyed.
 *
 * Two things can be done with a report: answer the person, or mark it
 * done. Answering opens Gmail with the address and subject filled in,
 * rather than trying to be a mail client.
 *
 * Auth: window.MOAuth.fetch, the same Ghost member JWT the rest of the
 * board uses. Rides the "engagement" tool, like the rest of this page.
 */
(function () {
  const root = document.querySelector("[data-tfr-issues]");
  if (!root) return;

  const adminUrl = (root.getAttribute("data-admin-url") || "").replace(/\/$/, "");
  const listEl = root.querySelector("[data-issues-list]");
  const statusEl = root.querySelector("[data-issues-status]");
  const pagerEl = root.querySelector("[data-issues-pager]");
  const tabsEl = root.querySelector("[data-issues-tabs]");

  let page = 1;
  let status = "open";

  function escapeHtml(s) {
    return String(s == null ? "" : s).replace(/[&<>"']/g, (c) => ({
      "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;",
    }[c]));
  }

  function when(iso) {
    if (!iso) return "";
    // SQLite's datetime('now') has no zone marker; it is UTC.
    const d = new Date(/[Zz+]|\d{2}:\d{2}$/.test(iso) ? iso : `${iso}Z`);
    if (isNaN(d)) return String(iso);
    return d.toLocaleString(undefined, {
      year: "numeric", month: "short", day: "numeric",
      hour: "numeric", minute: "2-digit",
    });
  }

  // Only our own pages become links. The URL is submitted by whoever
  // filled the form, and this one is printed for a staff member to
  // click, so anything else is shown as text.
  function safeLink(u) {
    if (!u) return "";
    try {
      const p = new URL(u);
      if (p.protocol !== "https:") return escapeHtml(u);
      if (!/(^|\.)mereorthodoxy\.com$/.test(p.hostname)) return escapeHtml(u);
      return `<a class="tfr-issue-link" href="${escapeHtml(p.href)}" target="_blank" rel="noopener">${escapeHtml(p.pathname + p.search)}</a>`;
    } catch (_) { return escapeHtml(u); }
  }

  function gmailHref(row) {
    const to = encodeURIComponent(row.email || "");
    const subject = encodeURIComponent("Re: The Faith Received Issue Report");
    return `https://mail.google.com/mail/?view=cm&fs=1&to=${to}&su=${subject}`;
  }

  function card(row) {
    const name = `${row.first_name || ""} ${row.last_name || ""}`.trim();
    const done = row.status === "done";
    return `<li class="tfr-issue" data-issue="${row.id}">`
      + `<div class="tfr-issue-head">`
      + `<span class="tfr-issue-type">${escapeHtml(row.issue_type || "")}</span>`
      + `<span class="tfr-issue-when">${escapeHtml(when(row.created_at))}</span>`
      + `</div>`
      + `<p class="tfr-issue-work">${escapeHtml(row.work_name || "")}</p>`
      + (row.page_url ? `<p class="tfr-issue-where">${safeLink(row.page_url)}</p>` : "")
      + `<p class="tfr-issue-who">${escapeHtml(name)} &middot; `
      + `<a href="mailto:${escapeHtml(row.email || "")}">${escapeHtml(row.email || "")}</a></p>`
      + `<div class="tfr-issue-comment">${escapeHtml(row.comment || "")}</div>`
      + `<div class="tfr-issue-actions">`
      + `<a class="tfr-issue-btn" href="${escapeHtml(gmailHref(row))}" target="_blank" rel="noopener">Reply in Gmail</a>`
      + `<button type="button" class="tfr-issue-btn tfr-issue-btn--done" data-issue-done="${row.id}" `
      + `data-next="${done ? "open" : "done"}">${done ? "Reopen" : "Mark complete"}</button>`
      + `</div></li>`;
  }

  function pager(data) {
    if (!pagerEl) return;
    if (data.pages <= 1) { pagerEl.innerHTML = ""; return; }
    const btns = [];
    for (let i = 1; i <= data.pages; i += 1) {
      btns.push(`<button type="button" class="tfr-issue-page${i === data.page ? " is-current" : ""}" `
        + `data-issue-page="${i}"${i === data.page ? ' aria-current="true"' : ""}>${i}</button>`);
    }
    pagerEl.innerHTML = btns.join("");
  }

  function load() {
    if (statusEl) statusEl.textContent = "Loading…";
    if (!window.MOAuth || !window.MOAuth.fetch) {
      if (statusEl) statusEl.textContent = "Not signed in.";
      return;
    }
    window.MOAuth.fetch(`${adminUrl}/tfr/issues?page=${page}&status=${encodeURIComponent(status)}`,
      { credentials: "omit" })
      .then((r) => {
        if (r.status === 401 || r.status === 403) {
          if (statusEl) statusEl.textContent = "You do not have access to this inbox.";
          return null;
        }
        if (!r.ok) {
          if (statusEl) statusEl.textContent = `Could not load reports (${r.status}).`;
          return null;
        }
        return r.json();
      })
      .then((data) => {
        if (!data || !data.ok) return;
        if (statusEl) {
          statusEl.textContent = data.total
            ? `${data.total.toLocaleString()} ${status === "open" ? "open" : "completed"}`
            : "";
        }
        if (tabsEl) {
          const openTab = tabsEl.querySelector('[data-issue-status="open"]');
          if (openTab) {
            openTab.textContent = data.openCount
              ? `Open (${data.openCount.toLocaleString()})` : "Open";
          }
        }
        listEl.innerHTML = data.issues.length
          ? `<ul class="tfr-issue-list">${data.issues.map(card).join("")}</ul>`
          : `<p class="admin-tfr-empty"><em>${status === "open"
            ? "No open reports. Nothing is broken that anyone has told us about."
            : "Nothing completed yet."}</em></p>`;
        pager(data);
      })
      .catch(() => {
        if (statusEl) statusEl.textContent = "Could not load reports.";
      });
  }

  root.addEventListener("click", (e) => {
    const pageBtn = e.target.closest("[data-issue-page]");
    if (pageBtn) {
      page = parseInt(pageBtn.getAttribute("data-issue-page"), 10) || 1;
      load();
      return;
    }
    const tab = e.target.closest("[data-issue-status]");
    if (tab) {
      status = tab.getAttribute("data-issue-status") === "done" ? "done" : "open";
      page = 1;
      tabsEl.querySelectorAll("[data-issue-status]").forEach((b) => {
        b.classList.toggle("is-current", b === tab);
      });
      load();
      return;
    }
    const done = e.target.closest("[data-issue-done]");
    if (!done) return;
    const id = done.getAttribute("data-issue-done");
    const next = done.getAttribute("data-next");
    done.disabled = true;
    window.MOAuth.fetch(`${adminUrl}/tfr/issues/${encodeURIComponent(id)}/status`, {
      method: "POST",
      credentials: "omit",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ status: next }),
    })
      .then((r) => (r.ok ? r.json() : null))
      .then((res) => {
        if (!res || !res.ok) { done.disabled = false; return; }
        load();
      })
      .catch(() => { done.disabled = false; });
  });

  load();
}());
