(function () {
  "use strict";

  // Module-level cache
  let adminUsers = null; // [{ email, name }]
  let adminUrl = "";

  function loadUsers() {
    if (adminUsers) return Promise.resolve(adminUsers);
    return window.MOAuth.fetch(`${adminUrl}/admin-users`, { credentials: "omit" })
      .then((r) => r.ok ? r.json() : { users: [] })
      .then((data) => { adminUsers = data.users || []; return adminUsers; })
      .catch(() => { adminUsers = []; return []; });
  }

  // Parse @[Name](email) tokens → array of unique email strings
  window.MOAdmin = window.MOAdmin || {};
  window.MOAdmin.extractMentions = function(text) {
    const matches = [...String(text).matchAll(/@\[([^\]]+)\]\(([^)]+)\)/g)];
    return [...new Set(matches.map((m) => m[2].toLowerCase()))];
  };

  // Replace @[Name](email) tokens with highlighted spans for display
  window.MOAdmin.renderMentions = function(text) {
    return escapeHtmlMentions(String(text || "")).replace(
      /@\[([^\]]+)\]\(([^)]+)\)/g,
      (_, name) => `<span class="mention-chip">@${escapeHtml(name)}</span>`
    );
  };

  // Wire all textareas + text inputs in a container
  window.MOAdmin.initMentions = function(container, url) {
    adminUrl = url;
    const fields = container.querySelectorAll("textarea, input[type='text']");
    fields.forEach((field) => wireField(field));
  };

  let dropdown = null;
  let activeField = null;
  let mentionStart = -1;

  function wireField(field) {
    field.addEventListener("keydown", onKeyDown);
    field.addEventListener("input", onInput);
  }

  function onKeyDown(e) {
    if (dropdown) {
      if (e.key === "ArrowDown") { e.preventDefault(); moveFocus(1); return; }
      if (e.key === "ArrowUp") { e.preventDefault(); moveFocus(-1); return; }
      if (e.key === "Enter") { e.preventDefault(); selectFocused(); return; }
      if (e.key === "Escape") { closeDropdown(); return; }
    }
  }

  function onInput(e) {
    const field = e.target;
    const val = field.value;
    const pos = field.selectionStart;
    // Find the @ before cursor
    const before = val.slice(0, pos);
    const atIdx = before.lastIndexOf("@");
    if (atIdx < 0) { closeDropdown(); return; }
    const query = before.slice(atIdx + 1);
    // No spaces in the query (means user moved past mention)
    if (query.includes(" ") && query.length > 20) { closeDropdown(); return; }
    mentionStart = atIdx;
    activeField = field;
    loadUsers().then((users) => {
      const filtered = users.filter((u) =>
        u.name.toLowerCase().includes(query.toLowerCase()) ||
        u.email.toLowerCase().includes(query.toLowerCase())
      );
      if (!filtered.length) { closeDropdown(); return; }
      showDropdown(field, filtered);
    });
  }

  function showDropdown(field, users) {
    closeDropdown();
    dropdown = document.createElement("ul");
    dropdown.className = "mention-dropdown";
    users.forEach((u, i) => {
      const li = document.createElement("li");
      li.className = "mention-option";
      li.textContent = u.name;
      li.dataset.email = u.email;
      li.dataset.name = u.name;
      if (i === 0) li.classList.add("is-focused");
      li.addEventListener("mousedown", (e) => { e.preventDefault(); insertMention(u); });
      dropdown.appendChild(li);
    });
    // Position near field
    const rect = field.getBoundingClientRect();
    dropdown.style.position = "fixed";
    dropdown.style.top = (rect.bottom + 2) + "px";
    dropdown.style.left = rect.left + "px";
    dropdown.style.zIndex = "9999";
    document.body.appendChild(dropdown);
    document.addEventListener("click", onDocClick, { once: true });
  }

  function closeDropdown() {
    if (dropdown) { dropdown.remove(); dropdown = null; }
    activeField = null;
    mentionStart = -1;
  }

  function moveFocus(dir) {
    if (!dropdown) return;
    const items = dropdown.querySelectorAll(".mention-option");
    const cur = dropdown.querySelector(".is-focused");
    const idx = [...items].indexOf(cur);
    const next = items[(idx + dir + items.length) % items.length];
    if (cur) cur.classList.remove("is-focused");
    if (next) next.classList.add("is-focused");
  }

  function selectFocused() {
    const focused = dropdown && dropdown.querySelector(".is-focused");
    if (!focused) return;
    insertMention({ name: focused.dataset.name, email: focused.dataset.email });
  }

  function insertMention(user) {
    if (!activeField) return;
    const val = activeField.value;
    const pos = activeField.selectionStart;
    const before = val.slice(0, mentionStart);
    const after = val.slice(pos);
    const token = `@[${user.name}](${user.email})`;
    activeField.value = before + token + after;
    const newPos = before.length + token.length;
    activeField.setSelectionRange(newPos, newPos);
    activeField.dispatchEvent(new Event("change", { bubbles: true }));
    closeDropdown();
  }

  function onDocClick() { closeDropdown(); }

  function escapeHtml(s) {
    return String(s == null ? "" : s).replace(/[&<>"']/g, (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c])
    );
  }
  // Version that doesn't escape @[Name](email) tokens (used before renderMentions replaces them)
  function escapeHtmlMentions(s) { return escapeHtml(s); }
})();
