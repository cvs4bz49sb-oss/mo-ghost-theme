(function () {
  "use strict";

  const root = document.querySelector("[data-admin-todos]");
  if (!root) return;

  const adminUrl = (root.getAttribute("data-admin-url") || "").replace(/\/$/, "");
  if (!adminUrl) return;

  const COLLAPSE_KEY = "mo_todos_collapsed";
  let todos = [];
  let collapsed = {};
  try { collapsed = JSON.parse(localStorage.getItem(COLLAPSE_KEY)) || {}; } catch (_) {}

  // Expose for inbox "Add to To-Do" button
  window.MOTodos = { addItem: function(text, category, source_url) { createTodo(text, category || "today", source_url); } };

  hydrate();

  function hydrate() {
    window.MOAuth.fetch(`${adminUrl}/inbox/todos`, { credentials: "omit" })
      .then((r) => r.ok ? r.json() : { todos: [] })
      .then((data) => { todos = data.todos || []; repaint(); })
      .catch(() => { todos = []; repaint(); });
  }

  function repaint() {
    root.innerHTML = `
      <h2 class="todos-pane-title">To&#8209;Do</h2>
      ${renderSection("today", "Today")}
      ${renderSection("week", "This Week")}
    `;
    wireSections();
  }

  function renderSection(category, label) {
    const items = todos.filter((t) => t.category === category);
    const doneCount = items.filter((t) => t.done).length;
    const undoneCount = items.length - doneCount;
    const isCollapsed = collapsed[category];
    return `
      <div class="todo-section${isCollapsed ? " is-collapsed" : ""}" data-todo-section="${category}">
        <button type="button" class="todo-section-head" data-todo-toggle="${category}">
          <span class="todo-section-label">${escapeHtml(label)}</span>
          ${undoneCount > 0 ? `<span class="todo-section-count">${undoneCount}</span>` : ""}
          <span class="todo-section-chevron">&#x203A;</span>
        </button>
        <div class="todo-section-body"
             data-todo-drop="${category}"
             data-dragover="false">
          <ul class="todo-list">
            ${items.length ? items.map(renderTodoItem).join("") : `<li class="todo-empty">Nothing here yet.</li>`}
          </ul>
          <div class="todo-add-row">
            <input type="text" class="todo-add-input" placeholder="Add to-do&hellip;" data-todo-add="${category}" />
          </div>
        </div>
      </div>
    `;
  }

  function renderTodoItem(t) {
    return `
      <li class="todo-item${t.done ? " is-done" : ""}" data-todo-id="${escapeAttr(t.id)}" data-todo-cat="${escapeAttr(t.category)}" draggable="true">
        <button type="button" class="todo-check" data-action="toggle-done" data-id="${escapeAttr(t.id)}" title="${t.done ? "Mark undone" : "Mark done"}">
          ${t.done ? checkIcon() : uncheckIcon()}
        </button>
        <span class="todo-text" data-action="start-edit" data-id="${escapeAttr(t.id)}">${escapeHtml(t.text)}</span>
        ${t.source_url ? `<a href="${escapeAttr(t.source_url)}" class="todo-source-link" target="_blank" rel="noopener" title="Open source">&#x2197;</a>` : ""}
        <button type="button" class="todo-edit-btn" data-action="start-edit" data-id="${escapeAttr(t.id)}" title="Edit">&#x270E;</button>
        <button type="button" class="todo-delete-btn" data-action="delete" data-id="${escapeAttr(t.id)}" title="Delete">&#x2715;</button>
      </li>
    `;
  }

  function wireSections() {
    // Collapse toggles
    root.querySelectorAll("[data-todo-toggle]").forEach((btn) => {
      btn.addEventListener("click", () => {
        const cat = btn.getAttribute("data-todo-toggle");
        const section = root.querySelector(`[data-todo-section="${cat}"]`);
        if (!section) return;
        section.classList.toggle("is-collapsed");
        collapsed[cat] = section.classList.contains("is-collapsed");
        localStorage.setItem(COLLAPSE_KEY, JSON.stringify(collapsed));
      });
    });

    // Add inputs
    root.querySelectorAll("[data-todo-add]").forEach((input) => {
      const category = input.getAttribute("data-todo-add");
      input.addEventListener("keydown", (e) => {
        if (e.key !== "Enter") return;
        const text = input.value.trim();
        if (!text) return;
        input.value = "";
        createTodo(text, category);
      });
    });

    // Item actions
    root.querySelectorAll("[data-action='toggle-done']").forEach((btn) => {
      btn.addEventListener("click", () => toggleDone(btn.getAttribute("data-id")));
    });
    root.querySelectorAll("[data-action='start-edit']").forEach((el) => {
      el.addEventListener("click", () => startEdit(el.getAttribute("data-id")));
    });
    root.querySelectorAll("[data-action='delete']").forEach((btn) => {
      btn.addEventListener("click", () => deleteTodo(btn.getAttribute("data-id")));
    });

    // Drag source — todo items can be dragged between sections
    root.querySelectorAll(".todo-item").forEach((item) => {
      item.addEventListener("dragstart", (e) => {
        e.dataTransfer.setData("text/x-todo-id", item.getAttribute("data-todo-id"));
        e.dataTransfer.setData("text/x-todo-cat", item.getAttribute("data-todo-cat"));
        e.dataTransfer.effectAllowed = "move";
        item.classList.add("is-dragging");
      });
      item.addEventListener("dragend", () => item.classList.remove("is-dragging"));
    });

    // Drop targets — inbox items AND todo items from other sections
    root.querySelectorAll("[data-todo-drop]").forEach((dropZone) => {
      const targetCat = dropZone.getAttribute("data-todo-drop");
      dropZone.addEventListener("dragover", (e) => {
        if (e.dataTransfer.types.includes("text/x-inbox-item") || e.dataTransfer.types.includes("text/x-todo-id")) {
          e.preventDefault();
          dropZone.setAttribute("data-dragover", "true");
        }
      });
      dropZone.addEventListener("dragleave", (e) => {
        if (!dropZone.contains(e.relatedTarget)) dropZone.setAttribute("data-dragover", "false");
      });
      dropZone.addEventListener("drop", (e) => {
        e.preventDefault();
        dropZone.setAttribute("data-dragover", "false");
        // Inbox item dropped
        const inboxData = e.dataTransfer.getData("text/x-inbox-item");
        if (inboxData) {
          try {
            const { title, source_url } = JSON.parse(inboxData);
            createTodo(title || "Untitled", targetCat, source_url);
          } catch (_) {}
          return;
        }
        // Todo item moved between sections
        const todoId = e.dataTransfer.getData("text/x-todo-id");
        const todoCat = e.dataTransfer.getData("text/x-todo-cat");
        if (todoId && todoCat !== targetCat) moveTodo(todoId, targetCat);
      });
    });
  }

  function createTodo(text, category, source_url) {
    const body = { text, category };
    if (source_url) { body.source_url = source_url; body.source_title = text; }
    window.MOAuth.fetch(`${adminUrl}/inbox/todos`, {
      method: "POST", headers: { "Content-Type": "application/json" }, credentials: "omit",
      body: JSON.stringify(body),
    })
      .then((r) => r.ok ? r.json() : null)
      .then((data) => { if (data && data.todo) { todos.unshift(data.todo); repaint(); } })
      .catch(() => {});
  }

  function toggleDone(id) {
    const t = todos.find((x) => x.id === id);
    if (!t) return;
    t.done = !t.done;
    repaint();
    window.MOAuth.fetch(`${adminUrl}/inbox/todos/${encodeURIComponent(id)}`, {
      method: "PUT", headers: { "Content-Type": "application/json" }, credentials: "omit",
      body: JSON.stringify({ done: t.done }),
    }).catch(() => {});
  }

  function startEdit(id) {
    const t = todos.find((x) => x.id === id);
    if (!t) return;
    const span = root.querySelector(`[data-action="start-edit"][data-id="${id}"]`);
    if (!span || span.tagName === "INPUT") return;
    const input = document.createElement("input");
    input.type = "text";
    input.className = "todo-edit-input";
    input.value = t.text;
    span.replaceWith(input);
    input.focus();
    input.select();
    function save() {
      const newText = input.value.trim();
      if (newText && newText !== t.text) {
        t.text = newText;
        window.MOAuth.fetch(`${adminUrl}/inbox/todos/${encodeURIComponent(id)}`, {
          method: "PUT", headers: { "Content-Type": "application/json" }, credentials: "omit",
          body: JSON.stringify({ text: newText }),
        }).catch(() => {});
      }
      repaint();
    }
    input.addEventListener("blur", save);
    input.addEventListener("keydown", (e) => {
      if (e.key === "Enter") { e.preventDefault(); input.blur(); }
      if (e.key === "Escape") { repaint(); }
    });
  }

  function moveTodo(id, category) {
    const t = todos.find((x) => x.id === id);
    if (!t) return;
    t.category = category;
    repaint();
    window.MOAuth.fetch(`${adminUrl}/inbox/todos/${encodeURIComponent(id)}`, {
      method: "PUT", headers: { "Content-Type": "application/json" }, credentials: "omit",
      body: JSON.stringify({ category }),
    }).catch(() => {});
  }

  function deleteTodo(id) {
    if (!confirm("Remove this to-do?")) return;
    todos = todos.filter((t) => t.id !== id);
    repaint();
    window.MOAuth.fetch(`${adminUrl}/inbox/todos/${encodeURIComponent(id)}`, {
      method: "DELETE", credentials: "omit",
    }).catch(() => {});
  }

  function checkIcon() { return `<svg viewBox="0 0 16 16" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3,8 7,12 13,4"/></svg>`; }
  function uncheckIcon() { return `<svg viewBox="0 0 16 16" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2"><rect x="2" y="2" width="12" height="12" rx="2"/></svg>`; }

  function escapeHtml(s) {
    return String(s == null ? "" : s).replace(/[&<>"']/g, (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c])
    );
  }
  function escapeAttr(s) { return escapeHtml(s); }
})();
