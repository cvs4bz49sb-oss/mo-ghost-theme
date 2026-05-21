(function () {
  "use strict";

  const root = document.querySelector("[data-ag-root]");
  if (!root) return;

  const LS_KEY = "mo_content_calendar";
  const PROJECT_ID = "weekly-meeting";
  const COLLAPSE_KEY = "mo_agenda_collapsed";
  const STATUS_OPTIONS = ["Idea", "Drafting", "In Review", "Scheduled", "Published"];
  const WORKER_URL = (document.body.getAttribute("data-admin-worker-url") || "").replace(/\/$/, "");
  let syncVersion = 0;
  let saveTimer = null;
  let showCompleted = false;

  const DEFAULT_CATEGORIES = [
    { id: "essay", name: "Essay", color: "#c1593c" },
    { id: "newsletter", name: "Newsletter", color: "#3498db" },
    { id: "podcast", name: "Podcast", color: "#9b59b6" },
    { id: "social", name: "Social", color: "#1abc9c" },
    { id: "event", name: "Event", color: "#f39c12" },
    { id: "meeting", name: "Meeting", color: "#34495e" },
    { id: "other", name: "Other", color: "#9a8773" }
  ];

  const DEFAULT_DATA = {
    projects: [
      { id: "content-calendar", name: "Content Calendar", group: "operations", color: "#c1593c" },
      { id: "weekly-meeting", name: "Weekly Meeting Agenda", group: "operations", color: "#3498db" },
      { id: "marketing", name: "Marketing", group: "operations", color: "#3498db" },
      { id: "sponsorships", name: "Sponsorships", group: "operations", color: "#f39c12" },
      { id: "fundraising", name: "Fundraising", group: "operations", color: "#27ae60" },
      { id: "mere-fidelity", name: "Mere Fidelity", group: "podcasts", color: "#c1593c" },
      { id: "christians-reading-classics", name: "Christians Reading Classics", group: "podcasts", color: "#c1593c" }
    ],
    people: ["Jake Meador", "Ian Harber", "Mark Kremer", "Nadya Williams"],
    categories: DEFAULT_CATEGORIES.map((c) => ({ ...c })),
    items: []
  };

  let collapsed = {};
  try { collapsed = JSON.parse(localStorage.getItem(COLLAPSE_KEY)) || {}; } catch (_) { /* */ }

  function saveCollapsed() {
    localStorage.setItem(COLLAPSE_KEY, JSON.stringify(collapsed));
  }

  function load() {
    try {
      const raw = localStorage.getItem(LS_KEY);
      if (raw) {
        const d = JSON.parse(raw);
        if (!d.projects) d.projects = DEFAULT_DATA.projects;
        if (!d.people || d.people.length === 0) {
          // Rebuild people from items if the list was accidentally cleared
          const fromItems = [...new Set((d.items || []).map((it) => it.person).filter(Boolean))];
          d.people = fromItems.length > 0 ? fromItems : DEFAULT_DATA.people.slice();
        }
        if (!d.categories) d.categories = DEFAULT_CATEGORIES.map((c) => ({ ...c }));
        if (!d.items) d.items = [];
        return d;
      }
    } catch (_) { /* */ }
    return JSON.parse(JSON.stringify(DEFAULT_DATA));
  }

  function save(d) {
    localStorage.setItem(LS_KEY, JSON.stringify(d));
    debouncedPush(d);
  }

  function setSyncStatus(s) {
    const el = document.querySelector("[data-cc-sync]");
    if (!el) return;
    el.className = `cc-sync cc-sync--${s}`;
    const labels = { idle: "Saved", saving: "Saving…", saved: "Synced", error: "Offline" };
    el.textContent = labels[s] || s;
  }

  function debouncedPush(d) {
    if (!WORKER_URL || !window.MOAuth) return;
    clearTimeout(saveTimer);
    setSyncStatus("saving");
    saveTimer = setTimeout(() => { pushToServer(d); }, 800);
  }

  function pushToServer(d) {
    window.MOAuth.fetch(`${WORKER_URL}/calendar`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ data: { projects: d.projects, people: d.people, categories: d.categories, items: d.items } })
    }).then((resp) => {
      if (resp.ok) {
        resp.json().then((result) => {
          syncVersion = result.version || 0;
          setSyncStatus("saved");
        });
      } else {
        setSyncStatus("error");
      }
    }).catch(() => {
      setSyncStatus("error");
    });
  }

  function syncFromServer() {
    if (!WORKER_URL || !window.MOAuth) return;
    setSyncStatus("saving");
    window.MOAuth.fetch(`${WORKER_URL}/calendar`, { method: "GET" }).then((resp) => {
      if (!resp.ok) { setSyncStatus("error"); return; }
      resp.json().then((result) => {
        if (result.data) {
          syncVersion = result.version || 0;
          const server = result.data;
          if (!Array.isArray(server.projects)) server.projects = DEFAULT_DATA.projects;
          if (!Array.isArray(server.people)) server.people = DEFAULT_DATA.people;
          if (!Array.isArray(server.categories)) server.categories = DEFAULT_CATEGORIES.map((c) => ({ ...c }));
          if (!Array.isArray(server.items)) server.items = [];
          data.projects = server.projects;
          // Don't overwrite local people with empty server list — rebuild from items instead
          if (server.people.length > 0) {
            data.people = server.people;
          } else {
            const fromItems = [...new Set(server.items.map((it) => it.person).filter(Boolean))];
            data.people = fromItems.length > 0 ? fromItems : DEFAULT_DATA.people.slice();
          }
          data.categories = server.categories;
          data.items = server.items;
          localStorage.setItem(LS_KEY, JSON.stringify(data));
          render();
          setSyncStatus("saved");
        } else {
          pushToServer(data);
        }
      });
    }).catch(() => {
      setSyncStatus("error");
    });
  }

  function esc(s) { return (s || "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;"); }
  function escAttr(s) { return (s || "").replace(/&/g, "&amp;").replace(/"/g, "&quot;"); }

  const data = load();

  function agendaItems() {
    return data.items.filter((it) => it.project === PROJECT_ID);
  }

  function isCompleted(it) {
    return it.status === "Published" || it.completed;
  }

  function fmtDate(d) {
    const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
    const parts = d.split("-");
    if (parts.length !== 3) return d;
    return `${months[parseInt(parts[1], 10) - 1]} ${parseInt(parts[2], 10)}`;
  }

  // -----------------------------------------------------------------------
  // Render
  // -----------------------------------------------------------------------

  function renderItem(it) {
    const done = isCompleted(it);
    const cat = data.categories.find((c) => c.id === it.type);
    const catLabel = cat ? cat.name : "";
    const catColor = cat ? cat.color : "#9a8773";
    return `<div class="ag-item${done ? " is-done" : ""}" data-ag-item-id="${it.id}" draggable="true">` +
      `<button type="button" class="ag-check${done ? " is-checked" : ""}" data-ag-toggle="${it.id}" title="${done ? "Mark incomplete" : "Mark complete"}">` +
        `<svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3"><polyline points="20 6 9 17 4 12"></polyline></svg>` +
      `</button>` +
      `<span class="ag-item-title" data-ag-inline-title="${it.id}">${esc(it.title)}</span>` +
      `<span class="ag-item-meta">${
        it.date ? `<span class="ag-item-date">${fmtDate(it.date)}</span>` : ""
        }${catLabel ? `<span class="ag-item-cat" style="--cat-color:${catColor}">${esc(catLabel)}</span>` : ""
      }</span>` +
      `<button type="button" class="ag-item-detail" data-ag-edit="${it.id}" title="Edit details">` +
        `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="1"/><circle cx="19" cy="12" r="1"/><circle cx="5" cy="12" r="1"/></svg>` +
      `</button>` +
      `<button type="button" class="ag-item-remove" data-ag-remove="${it.id}" title="Remove">&times;</button>` +
      `<span class="ag-drag-handle" title="Drag to reorder">` +
        `<svg width="6" height="10" viewBox="0 0 6 10" fill="currentColor"><circle cx="1" cy="1" r="1"/><circle cx="5" cy="1" r="1"/><circle cx="1" cy="5" r="1"/><circle cx="5" cy="5" r="1"/><circle cx="1" cy="9" r="1"/><circle cx="5" cy="9" r="1"/></svg>` +
      `</span>` +
    `</div>`;
  }

  function renderSection(person, items, key) {
    const isCollapsed = collapsed[key];
    const count = items.length;
    const isUnassigned = key === "__unassigned__";
    return `<div class="ag-section${isCollapsed ? " is-collapsed" : ""}" data-ag-section="${key}">` +
      `<div class="ag-section-head" data-ag-section-toggle="${key}"${!isUnassigned ? ` draggable="true" data-ag-section-drag="${key}"` : ""}>` +
        `<svg class="ag-section-caret" width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="6 9 12 15 18 9"></polyline></svg>` +
        `<span class="ag-section-name"${!isUnassigned ? ` data-ag-section-rename="${escAttr(key)}"` : ""}>${esc(person)}</span>` +
        `<span class="ag-section-count">${count}</span>${
        !isUnassigned ? `<button type="button" class="ag-section-remove" data-ag-section-remove="${key}" title="Remove section">&times;</button>` +
          `<span class="ag-section-drag-handle" title="Drag to reorder">` +
            `<svg width="6" height="10" viewBox="0 0 6 10" fill="currentColor"><circle cx="1" cy="1" r="1"/><circle cx="5" cy="1" r="1"/><circle cx="1" cy="5" r="1"/><circle cx="5" cy="5" r="1"/><circle cx="1" cy="9" r="1"/><circle cx="5" cy="9" r="1"/></svg>` +
          `</span>` : ""
      }</div>` +
      `<div class="ag-section-body" data-ag-section-body="${key}">` +
        `<div class="ag-section-items" data-ag-drop-zone="${key}">${ 
          items.length > 0 ? items.map(renderItem).join("") : "" 
        }</div>` +
        `<div class="ag-inline-add" data-ag-inline-add="${key}">` +
          `<button type="button" class="ag-inline-add-btn" data-ag-show-inline="${key}">` +
            `<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>` +
            ` Add item…` +
          `</button>` +
          `<div class="ag-inline-add-form" data-ag-inline-form="${key}" hidden>` +
            `<input type="text" class="ag-inline-input" data-ag-inline-input="${key}" placeholder="Item name…" />` +
            `<div class="ag-inline-actions">` +
              `<button type="button" class="ag-inline-save" data-ag-inline-save="${key}">Add</button>` +
              `<button type="button" class="ag-inline-cancel" data-ag-inline-cancel="${key}">&times;</button>` +
            `</div>` +
          `</div>` +
        `</div>` +
      `</div>` +
    `</div>`;
  }

  function render() {
    const items = agendaItems();
    const active = items.filter((it) => !isCompleted(it));
    const completed = items.filter((it) => isCompleted(it));

    const groups = {};
    const unassigned = [];
    data.people.forEach((p) => { groups[p] = []; });

    active.forEach((it) => {
      if (it.person && groups[it.person]) {
        groups[it.person].push(it);
      } else if (it.person) {
        if (!groups[it.person]) groups[it.person] = [];
        groups[it.person].push(it);
      } else {
        unassigned.push(it);
      }
    });

    // Recover: if data.people is missing anyone referenced by items, add them back
    Object.keys(groups).forEach((person) => {
      if (person && !data.people.includes(person)) data.people.push(person);
    });

    let html = "";

    if (unassigned.length > 0) {
      html += renderSection("Unassigned", unassigned, "__unassigned__");
    }

    data.people.forEach((person) => {
      html += renderSection(person, groups[person] || [], person);
    });

    html += `<div class="ag-add-section" data-ag-add-section>` +
      `<button type="button" class="ag-add-section-btn" data-ag-show-add-section>` +
        `<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>` +
        ` Add section…` +
      `</button>` +
      `<div class="ag-add-section-form" data-ag-add-section-form hidden>` +
        `<input type="text" class="ag-inline-input" data-ag-section-name-input placeholder="Section name…" />` +
        `<div class="ag-inline-actions">` +
          `<button type="button" class="ag-inline-save" data-ag-save-section>Add</button>` +
          `<button type="button" class="ag-inline-cancel" data-ag-cancel-add-section>&times;</button>` +
        `</div>` +
      `</div>` +
    `</div>`;

    const groupsEl = root.querySelector("[data-ag-groups]");
    groupsEl.innerHTML = html;

    if (window.MOAdmin && window.MOAdmin.initMentions) window.MOAdmin.initMentions(groupsEl, WORKER_URL);

    const completedWrap = root.querySelector("[data-ag-completed-wrap]");
    root.querySelector("[data-ag-completed-count]").textContent = `(${completed.length})`;
    if (completed.length === 0) {
      completedWrap.style.display = "none";
    } else {
      completedWrap.style.display = "";
      const cList = root.querySelector("[data-ag-completed]");
      cList.style.display = showCompleted ? "" : "none";
      root.querySelector(".ag-completed-caret").style.transform = showCompleted ? "" : "rotate(-90deg)";
      if (showCompleted) {
        cList.innerHTML = completed.map(renderItem).join("");
      }
    }
  }

  // -----------------------------------------------------------------------
  // Inline add
  // -----------------------------------------------------------------------

  function showInlineAdd(key) {
    const form = root.querySelector(`[data-ag-inline-form="${key}"]`);
    const btn = root.querySelector(`[data-ag-show-inline="${key}"]`);
    if (!form || !btn) return;
    btn.hidden = true;
    form.hidden = false;
    const input = form.querySelector(`[data-ag-inline-input="${key}"]`);
    input.value = "";
    input.focus();
  }

  function hideInlineAdd(key) {
    const form = root.querySelector(`[data-ag-inline-form="${key}"]`);
    const btn = root.querySelector(`[data-ag-show-inline="${key}"]`);
    if (form) form.hidden = true;
    if (btn) btn.hidden = false;
  }

  function commitInlineAdd(key) {
    const input = root.querySelector(`[data-ag-inline-input="${key}"]`);
    if (!input) return;
    const title = input.value.trim();
    if (!title) { hideInlineAdd(key); return; }

    const person = key === "__unassigned__" ? "" : key;
    data.items.push({
      id: `item_${Date.now()}`,
      title,
      date: "",
      project: PROJECT_ID,
      type: "",
      person,
      status: "Idea"
    });
    save(data);
    render();
    setTimeout(() => showInlineAdd(key), 10);
  }

  // -----------------------------------------------------------------------
  // Section management
  // -----------------------------------------------------------------------

  function showAddSection() {
    const form = root.querySelector("[data-ag-add-section-form]");
    const btn = root.querySelector("[data-ag-show-add-section]");
    if (!form || !btn) return;
    btn.hidden = true;
    form.hidden = false;
    const input = form.querySelector("[data-ag-section-name-input]");
    input.value = "";
    input.focus();
  }

  function hideAddSection() {
    const form = root.querySelector("[data-ag-add-section-form]");
    const btn = root.querySelector("[data-ag-show-add-section]");
    if (form) form.hidden = true;
    if (btn) btn.hidden = false;
  }

  function commitAddSection() {
    const input = root.querySelector("[data-ag-section-name-input]");
    if (!input) return;
    const name = input.value.trim();
    if (!name) { hideAddSection(); return; }
    if (data.people.includes(name)) { hideAddSection(); return; }
    data.people.push(name);
    save(data);
    render();
  }

  function removeSection(key) {
    const sectionItems = agendaItems().filter((it) => it.person === key && !isCompleted(it));
    if (sectionItems.length > 0) {
      if (!confirm(`"${key}" has ${sectionItems.length} item${sectionItems.length > 1 ? "s" : ""}. Remove section and move items to Unassigned?`)) return;
      sectionItems.forEach((it) => { it.person = ""; });
    }
    data.people = data.people.filter((p) => p !== key);
    save(data);
    render();
  }

  function startSectionRename(nameEl, key) {
    const current = key;
    const input = document.createElement("input");
    input.type = "text";
    input.className = "ag-inline-section-input";
    input.value = current;
    nameEl.replaceWith(input);
    input.focus();
    input.select();

    function commit() {
      const val = input.value.trim();
      if (val && val !== current && !data.people.includes(val)) {
        const idx = data.people.indexOf(current);
        if (idx !== -1) data.people[idx] = val;
        data.items.forEach((it) => { if (it.person === current) it.person = val; });
        if (collapsed[current]) { collapsed[val] = collapsed[current]; delete collapsed[current]; saveCollapsed(); }
        save(data);
      }
      render();
    }

    input.addEventListener("blur", commit);
    input.addEventListener("keydown", (e) => {
      if (e.key === "Enter") { e.preventDefault(); input.blur(); }
      if (e.key === "Escape") { input.value = current; input.blur(); }
    });
  }

  // -----------------------------------------------------------------------
  // Inline title editing
  // -----------------------------------------------------------------------

  function startInlineEdit(titleEl, itemId) {
    const item = data.items.find((it) => it.id === itemId);
    if (!item) return;
    const current = item.title;
    const input = document.createElement("input");
    input.type = "text";
    input.className = "ag-inline-title-input";
    input.value = current;
    titleEl.replaceWith(input);
    input.focus();
    input.select();

    function commit() {
      const val = input.value.trim();
      if (val && val !== current) {
        item.title = val;
        save(data);
      }
      render();
    }

    input.addEventListener("blur", commit);
    input.addEventListener("keydown", (e) => {
      if (e.key === "Enter") { e.preventDefault(); input.blur(); }
      if (e.key === "Escape") { input.value = current; input.blur(); }
    });
  }

  // -----------------------------------------------------------------------
  // Drag and drop
  // -----------------------------------------------------------------------

  let dragItemId = null;
  let dragSectionKey = null;

  root.addEventListener("dragstart", (e) => {
    const sectionHead = e.target.closest("[data-ag-section-drag]");
    if (sectionHead) {
      dragSectionKey = sectionHead.dataset.agSectionDrag;
      sectionHead.closest(".ag-section").classList.add("is-section-dragging");
      e.dataTransfer.effectAllowed = "move";
      e.dataTransfer.setData("text/plain", `section:${dragSectionKey}`);
      return;
    }

    const el = e.target.closest("[data-ag-item-id]");
    if (!el) return;
    dragItemId = el.dataset.agItemId;
    el.classList.add("is-dragging");
    e.dataTransfer.effectAllowed = "move";
    e.dataTransfer.setData("text/plain", dragItemId);
  });

  root.addEventListener("dragend", () => {
    root.querySelectorAll(".is-section-dragging, .ag-section-drop-above, .ag-section-drop-below").forEach((x) => {
      x.classList.remove("is-section-dragging", "ag-section-drop-above", "ag-section-drop-below");
    });
    root.querySelectorAll(".is-dragging, .ag-drop-above, .ag-drop-below, .ag-drop-zone-active").forEach((x) => {
      x.classList.remove("is-dragging", "ag-drop-above", "ag-drop-below", "ag-drop-zone-active");
    });
    dragItemId = null;
    dragSectionKey = null;
  });

  root.addEventListener("dragover", (e) => {
    if (dragSectionKey) {
      e.preventDefault();
      e.dataTransfer.dropEffect = "move";
      root.querySelectorAll(".ag-section-drop-above, .ag-section-drop-below").forEach((x) => {
        x.classList.remove("ag-section-drop-above", "ag-section-drop-below");
      });
      const overSection = e.target.closest("[data-ag-section]");
      if (overSection && overSection.dataset.agSection !== dragSectionKey && overSection.dataset.agSection !== "__unassigned__") {
        const rect = overSection.getBoundingClientRect();
        if (e.clientY < rect.top + rect.height / 2) {
          overSection.classList.add("ag-section-drop-above");
        } else {
          overSection.classList.add("ag-section-drop-below");
        }
      }
      return;
    }

    if (!dragItemId) return;
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";

    root.querySelectorAll(".ag-drop-above, .ag-drop-below, .ag-drop-zone-active").forEach((x) => {
      x.classList.remove("ag-drop-above", "ag-drop-below", "ag-drop-zone-active");
    });

    const overItem = e.target.closest("[data-ag-item-id]");
    if (overItem && overItem.dataset.agItemId !== dragItemId) {
      const rect = overItem.getBoundingClientRect();
      const mid = rect.top + rect.height / 2;
      if (e.clientY < mid) {
        overItem.classList.add("ag-drop-above");
      } else {
        overItem.classList.add("ag-drop-below");
      }
    } else {
      const zone = e.target.closest("[data-ag-drop-zone]");
      if (zone && zone.children.length === 0) {
        zone.classList.add("ag-drop-zone-active");
      }
    }
  });

  root.addEventListener("drop", (e) => {
    e.preventDefault();

    if (dragSectionKey) {
      const overSection = e.target.closest("[data-ag-section]");
      if (!overSection) return;
      const overKey = overSection.dataset.agSection;
      if (overKey === dragSectionKey || overKey === "__unassigned__") return;
      const fromIdx = data.people.indexOf(dragSectionKey);
      if (fromIdx === -1) return;
      data.people.splice(fromIdx, 1);
      let toIdx = data.people.indexOf(overKey);
      if (toIdx === -1) return;
      const rect = overSection.getBoundingClientRect();
      if (e.clientY > rect.top + rect.height / 2) toIdx++;
      data.people.splice(toIdx, 0, dragSectionKey);
      save(data);
      render();
      return;
    }

    if (!dragItemId) return;
    const item = data.items.find((it) => it.id === dragItemId);
    if (!item) return;

    const overItem = e.target.closest("[data-ag-item-id]");
    const zone = e.target.closest("[data-ag-drop-zone]");
    if (!zone) return;

    const targetPerson = zone.dataset.agDropZone;
    item.person = targetPerson === "__unassigned__" ? "" : targetPerson;

    if (overItem && overItem.dataset.agItemId !== dragItemId) {
      const overItemData = data.items.find((it) => it.id === overItem.dataset.agItemId);
      if (overItemData) {
        const fromIdx = data.items.indexOf(item);
        data.items.splice(fromIdx, 1);
        let toIdx = data.items.indexOf(overItemData);
        const rect = overItem.getBoundingClientRect();
        if (e.clientY > rect.top + rect.height / 2) toIdx++;
        data.items.splice(toIdx, 0, item);
      }
    }

    save(data);
    render();
  });

  // -----------------------------------------------------------------------
  // Touch drag and drop (mobile)
  // -----------------------------------------------------------------------

  let touchDragType = null;
  let touchDragKey = null;
  let touchOrigEl = null;
  let touchGhost = null;

  function createGhost(el, x, y) {
    const ghost = el.cloneNode(true);
    const rect = el.getBoundingClientRect();
    ghost.style.cssText = `position:fixed;left:0;top:${y - 20}px;width:${rect.width}px;opacity:0.85;z-index:9999;pointer-events:none;box-shadow:0 4px 16px rgba(0,0,0,0.18);border-radius:4px;background:var(--color-page,#fff);`;
    document.body.appendChild(ghost);
    return ghost;
  }

  function moveGhost(y) {
    if (touchGhost) touchGhost.style.top = `${y - 20}px`;
  }

  function removeGhost() {
    if (touchGhost) { touchGhost.remove(); touchGhost = null; }
  }

  root.addEventListener("touchstart", (e) => {
    const sectionHandle = e.target.closest(".ag-section-drag-handle");
    if (sectionHandle) {
      const head = sectionHandle.closest("[data-ag-section-drag]");
      if (head) {
        touchDragType = "section";
        touchDragKey = head.dataset.agSectionDrag;
        touchOrigEl = head.closest(".ag-section");
        touchOrigEl.classList.add("is-section-dragging");
        const t = e.touches[0];
        touchGhost = createGhost(touchOrigEl.querySelector(".ag-section-head"), t.clientX, t.clientY);
        e.preventDefault();
        return;
      }
    }
    const itemHandle = e.target.closest(".ag-drag-handle");
    if (itemHandle) {
      const item = itemHandle.closest("[data-ag-item-id]");
      if (item) {
        touchDragType = "item";
        touchDragKey = item.dataset.agItemId;
        touchOrigEl = item;
        item.classList.add("is-dragging");
        const t = e.touches[0];
        touchGhost = createGhost(item, t.clientX, t.clientY);
        e.preventDefault();
      }
    }
  }, { passive: false });

  root.addEventListener("touchmove", (e) => {
    if (!touchDragType) return;
    e.preventDefault();
    const y = e.touches[0].clientY;
    const x = e.touches[0].clientX;
    moveGhost(y);

    root.querySelectorAll(".ag-section-drop-above, .ag-section-drop-below, .ag-drop-above, .ag-drop-below, .ag-drop-zone-active").forEach((el) => {
      el.classList.remove("ag-section-drop-above", "ag-section-drop-below", "ag-drop-above", "ag-drop-below", "ag-drop-zone-active");
    });

    const target = document.elementFromPoint(x, y);
    if (!target) return;

    if (touchDragType === "section") {
      const overSection = target.closest("[data-ag-section]");
      if (overSection && overSection.dataset.agSection !== touchDragKey && overSection.dataset.agSection !== "__unassigned__") {
        const rect = overSection.getBoundingClientRect();
        if (y < rect.top + rect.height / 2) {
          overSection.classList.add("ag-section-drop-above");
        } else {
          overSection.classList.add("ag-section-drop-below");
        }
      }
    } else {
      const overItem = target.closest("[data-ag-item-id]");
      if (overItem && overItem.dataset.agItemId !== touchDragKey) {
        const rect = overItem.getBoundingClientRect();
        if (y < rect.top + rect.height / 2) {
          overItem.classList.add("ag-drop-above");
        } else {
          overItem.classList.add("ag-drop-below");
        }
      } else {
        const zone = target.closest("[data-ag-drop-zone]");
        if (zone && zone.children.length === 0) {
          zone.classList.add("ag-drop-zone-active");
        }
      }
    }
  }, { passive: false });

  root.addEventListener("touchend", (e) => {
    if (!touchDragType) return;
    removeGhost();
    const y = e.changedTouches[0].clientY;
    const x = e.changedTouches[0].clientX;
    const target = document.elementFromPoint(x, y);

    if (touchDragType === "section" && target) {
      const overSection = target.closest("[data-ag-section]");
      if (overSection) {
        const overKey = overSection.dataset.agSection;
        if (overKey !== touchDragKey && overKey !== "__unassigned__") {
          const fromIdx = data.people.indexOf(touchDragKey);
          if (fromIdx !== -1) {
            data.people.splice(fromIdx, 1);
            let toIdx = data.people.indexOf(overKey);
            if (toIdx !== -1) {
              const rect = overSection.getBoundingClientRect();
              if (y > rect.top + rect.height / 2) toIdx++;
              data.people.splice(toIdx, 0, touchDragKey);
              save(data);
            }
          }
        }
      }
    } else if (touchDragType === "item" && target) {
      const item = data.items.find((it) => it.id === touchDragKey);
      if (item) {
        const zone = target.closest("[data-ag-drop-zone]");
        if (zone) {
          const targetPerson = zone.dataset.agDropZone;
          item.person = targetPerson === "__unassigned__" ? "" : targetPerson;
          const overItem = target.closest("[data-ag-item-id]");
          if (overItem && overItem.dataset.agItemId !== touchDragKey) {
            const overItemData = data.items.find((it) => it.id === overItem.dataset.agItemId);
            if (overItemData) {
              const fromIdx = data.items.indexOf(item);
              data.items.splice(fromIdx, 1);
              let toIdx = data.items.indexOf(overItemData);
              const rect = overItem.getBoundingClientRect();
              if (y > rect.top + rect.height / 2) toIdx++;
              data.items.splice(toIdx, 0, item);
            }
          }
          save(data);
        }
      }
    }

    root.querySelectorAll(".is-section-dragging, .ag-section-drop-above, .ag-section-drop-below, .is-dragging, .ag-drop-above, .ag-drop-below, .ag-drop-zone-active").forEach((el) => {
      el.classList.remove("is-section-dragging", "ag-section-drop-above", "ag-section-drop-below", "is-dragging", "ag-drop-above", "ag-drop-below", "ag-drop-zone-active");
    });
    touchDragType = null;
    touchDragKey = null;
    touchOrigEl = null;
    render();
  });

  // -----------------------------------------------------------------------
  // Notifications
  // -----------------------------------------------------------------------

  function notifyAssigned(item, personName) {
    if (!window.MOAdmin || !window.MOAdmin.getUsers || !WORKER_URL || !window.MOAuth) return;
    window.MOAdmin.getUsers(WORKER_URL).then(function (users) {
      const needle = personName.trim().toLowerCase();
      const user = users.find(function (u) { return u.name === personName || u.name.trim().toLowerCase() === needle; });
      if (!user) return;
      window.MOAuth.fetch(`${WORKER_URL}/inbox/notify`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "omit",
        body: JSON.stringify({
          to_emails: [user.email],
          type: "assigned",
          source: "weekly-meeting",
          source_id: item.id,
          source_title: item.title,
          source_url: "/admin/agenda/",
          snippet: `You've been assigned "${item.title}" on the meeting agenda.`
        })
      }).catch(function () {});
    });
  }

  // -----------------------------------------------------------------------
  // Edit modal
  // -----------------------------------------------------------------------

  function showEditModal(item) {
    const oldPerson = item.person;
    const overlay = document.createElement("div");
    overlay.className = "au-modal-overlay";
    overlay.innerHTML =
      `<div class="au-modal au-modal--narrow">` +
        `<h3 class="au-modal-title">Edit Item</h3>` +
        `<div class="au-modal-fields">` +
          `<label class="settings-field">` +
            `<span class="settings-field-label">Title</span>` +
            `<input type="text" class="settings-input" data-ag-modal-title value="${escAttr(item.title)}">` +
          `</label>` +
          `<label class="settings-field">` +
            `<span class="settings-field-label">Date</span>` +
            `<input type="date" class="settings-input" data-ag-modal-date value="${item.date || ""}">` +
          `</label>` +
          `<label class="settings-field">` +
            `<span class="settings-field-label">Assigned to</span>` +
            `<select class="settings-select" data-ag-modal-person>` +
              `<option value="">Unassigned</option>${
              data.people.map((p) => `<option value="${escAttr(p)}"${p === item.person ? " selected" : ""}>${esc(p)}</option>`).join("")
            }</select>` +
          `</label>` +
          `<label class="settings-field">` +
            `<span class="settings-field-label">Category</span>` +
            `<select class="settings-select" data-ag-modal-type>` +
              `<option value="">None</option>${
              data.categories.map((c) => `<option value="${c.id}"${c.id === item.type ? " selected" : ""}>${esc(c.name)}</option>`).join("")
            }</select>` +
          `</label>` +
          `<label class="settings-field">` +
            `<span class="settings-field-label">Status</span>` +
            `<select class="settings-select" data-ag-modal-status>${
              STATUS_OPTIONS.map((s) => `<option value="${s}"${s === item.status ? " selected" : ""}>${s}</option>`).join("")
            }</select>` +
          `</label>` +
        `</div>` +
        `<div class="au-modal-actions">` +
          `<button type="button" class="btn btn-primary" data-ag-modal-save>Save</button>` +
          `<button type="button" class="btn" data-ag-modal-cancel>Cancel</button>` +
          `<button type="button" class="btn btn-danger" style="margin-left:auto" data-ag-modal-delete>Delete</button>` +
        `</div>` +
      `</div>`;

    document.body.appendChild(overlay);
    if (window.MOAdmin && window.MOAdmin.initMentions) window.MOAdmin.initMentions(overlay, WORKER_URL);
    overlay.querySelector("[data-ag-modal-cancel]").onclick = () => overlay.remove();
    overlay.addEventListener("click", (e) => { if (e.target === overlay) overlay.remove(); });

    overlay.querySelector("[data-ag-modal-delete]").onclick = () => {
      data.items = data.items.filter((it) => it.id !== item.id);
      save(data);
      render();
      overlay.remove();
    };

    overlay.querySelector("[data-ag-modal-save]").onclick = () => {
      item.title = overlay.querySelector("[data-ag-modal-title]").value.trim() || item.title;
      item.date = overlay.querySelector("[data-ag-modal-date]").value;
      const newPerson = overlay.querySelector("[data-ag-modal-person]").value;
      item.person = newPerson;
      item.type = overlay.querySelector("[data-ag-modal-type]").value;
      item.status = overlay.querySelector("[data-ag-modal-status]").value;
      save(data);
      render();
      overlay.remove();
      if (newPerson && newPerson !== oldPerson) notifyAssigned(item, newPerson);
    };
  }

  // -----------------------------------------------------------------------
  // Event delegation
  // -----------------------------------------------------------------------

  root.addEventListener("click", (e) => {
    let btn;

    btn = e.target.closest("[data-ag-section-remove]");
    if (btn) {
      removeSection(btn.dataset.agSectionRemove);
      return;
    }

    btn = e.target.closest("[data-ag-section-toggle]");
    if (btn) {
      const key = btn.dataset.agSectionToggle;
      const section = root.querySelector(`[data-ag-section="${key}"]`);
      if (section) {
        section.classList.toggle("is-collapsed");
        collapsed[key] = section.classList.contains("is-collapsed");
        saveCollapsed();
      }
      return;
    }

    btn = e.target.closest("[data-ag-toggle]");
    if (btn) {
      const item = data.items.find((it) => it.id === btn.dataset.agToggle);
      if (item) {
        if (isCompleted(item)) {
          item.status = "Idea";
          item.completed = false;
        } else {
          item.status = "Published";
          item.completed = true;
        }
        save(data);
        render();
      }
      return;
    }

    btn = e.target.closest("[data-ag-remove]");
    if (btn) {
      data.items = data.items.filter((it) => it.id !== btn.dataset.agRemove);
      save(data);
      render();
      return;
    }

    btn = e.target.closest("[data-ag-edit]");
    if (btn) {
      const item = data.items.find((it) => it.id === btn.dataset.agEdit);
      if (item) showEditModal(item);
      return;
    }

    if (e.target.closest("[data-ag-add]")) {
      const firstPerson = data.people[0] || "__unassigned__";
      showInlineAdd(firstPerson);
      return;
    }

    btn = e.target.closest("[data-ag-show-inline]");
    if (btn) {
      showInlineAdd(btn.dataset.agShowInline);
      return;
    }

    btn = e.target.closest("[data-ag-inline-save]");
    if (btn) {
      commitInlineAdd(btn.dataset.agInlineSave);
      return;
    }

    btn = e.target.closest("[data-ag-inline-cancel]");
    if (btn) {
      hideInlineAdd(btn.dataset.agInlineCancel);
      return;
    }

    if (e.target.closest("[data-ag-show-add-section]")) {
      showAddSection();
      return;
    }

    if (e.target.closest("[data-ag-save-section]")) {
      commitAddSection();
      return;
    }

    if (e.target.closest("[data-ag-cancel-add-section]")) {
      hideAddSection();
      return;
    }

    if (e.target.closest("[data-ag-toggle-completed]")) {
      showCompleted = !showCompleted;
      render();
      return;
    }

    if (e.target.closest("[data-ag-clear-completed]")) {
      const completed = agendaItems().filter(isCompleted);
      if (completed.length > 0 && confirm(`Remove ${completed.length} completed item${completed.length > 1 ? "s" : ""}?`)) {
        const ids = new Set(completed.map((it) => it.id));
        data.items = data.items.filter((it) => !ids.has(it.id));
        save(data);
        render();
      }
      return;
    }

    const titleEl = e.target.closest("[data-ag-inline-title]");
    if (titleEl) {
      startInlineEdit(titleEl, titleEl.dataset.agInlineTitle);
      return;
    }
  });

  root.addEventListener("dblclick", (e) => {
    const nameEl = e.target.closest("[data-ag-section-rename]");
    if (nameEl) {
      e.preventDefault();
      startSectionRename(nameEl, nameEl.dataset.agSectionRename);
    }
  });

  root.addEventListener("keydown", (e) => {
    if (e.key === "Enter") {
      const input = e.target.closest("[data-ag-inline-input]");
      if (input) {
        e.preventDefault();
        commitInlineAdd(input.dataset.agInlineInput);
        return;
      }
      const sectionInput = e.target.closest("[data-ag-section-name-input]");
      if (sectionInput) {
        e.preventDefault();
        commitAddSection();
        return;
      }
    }
    if (e.key === "Escape") {
      const input = e.target.closest("[data-ag-inline-input]");
      if (input) {
        hideInlineAdd(input.dataset.agInlineInput);
        return;
      }
      const sectionInput = e.target.closest("[data-ag-section-name-input]");
      if (sectionInput) {
        hideAddSection();
        return;
      }
    }
  });

  render();
  syncFromServer();
})();
