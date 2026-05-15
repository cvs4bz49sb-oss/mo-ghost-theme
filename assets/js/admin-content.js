(function () {
  "use strict";

  const root = document.querySelector("[data-cc-root]");
  if (!root) return;

  const LS_KEY = "mo_content_calendar";
  const DAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
  const DAYS_SHORT = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
  const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  const FULL_MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
  const DEFAULT_CATEGORIES = [
    { id: "essay", name: "Essay", color: "#c1593c" },
    { id: "newsletter", name: "Newsletter", color: "#3498db" },
    { id: "podcast", name: "Podcast", color: "#9b59b6" },
    { id: "social", name: "Social", color: "#1abc9c" },
    { id: "event", name: "Event", color: "#f39c12" },
    { id: "meeting", name: "Meeting", color: "#34495e" },
    { id: "other", name: "Other", color: "#9a8773" }
  ];
  const STATUS_OPTIONS = ["Idea", "Drafting", "In Review", "Scheduled", "Published"];
  const STATUS_COLORS = { Idea: "#9a8773", Drafting: "#3498db", "In Review": "#f39c12", Scheduled: "#27ae60", Published: "#2d2927" };
  const SWATCH_COLORS = ["#c1593c", "#3498db", "#27ae60", "#f39c12", "#9b59b6", "#1abc9c", "#e74c3c", "#34495e", "#e67e22", "#2d2927", "#16a085", "#8e44ad"];

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
    categories: DEFAULT_CATEGORIES.map((c) => { return {...c}; }),
    items: []
  };

  const WORKER_URL = (document.body.getAttribute("data-admin-worker-url") || "").replace(/\/$/, "");
  let syncVersion = 0;
  let saveTimer = null;
  let syncStatus = "idle";

  function load() {
    try {
      const raw = localStorage.getItem(LS_KEY);
      if (raw) {
        const d = JSON.parse(raw);
        if (!d.projects) d.projects = DEFAULT_DATA.projects;
        if (!d.people) d.people = DEFAULT_DATA.people;
        if (!d.categories) d.categories = DEFAULT_CATEGORIES.map((c) => { return {...c}; });
        if (!d.items) d.items = [];
        return d;
      }
    } catch (e) { /* ignore */ }
    return JSON.parse(JSON.stringify(DEFAULT_DATA));
  }

  function save(d) {
    localStorage.setItem(LS_KEY, JSON.stringify(d));
    debouncedPush(d);
  }

  function setSyncStatus(s) {
    syncStatus = s;
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

  async function pushToServer(d) {
    try {
      const resp = await window.MOAuth.fetch(`${WORKER_URL}/calendar`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ data: { projects: d.projects, people: d.people, categories: d.categories, items: d.items } }),
      });
      if (resp.ok) {
        const result = await resp.json();
        syncVersion = result.version || 0;
        setSyncStatus("saved");
      } else {
        setSyncStatus("error");
      }
    } catch (e) {
      setSyncStatus("error");
    }
  }

  async function syncFromServer() {
    if (!WORKER_URL || !window.MOAuth) return;
    setSyncStatus("saving");
    try {
      const resp = await window.MOAuth.fetch(`${WORKER_URL}/calendar`, { method: "GET" });
      if (!resp.ok) { setSyncStatus("error"); return; }
      const result = await resp.json();
      if (result.data) {
        syncVersion = result.version || 0;
        const server = result.data;
        if (!Array.isArray(server.projects)) server.projects = DEFAULT_DATA.projects;
        if (!Array.isArray(server.people)) server.people = DEFAULT_DATA.people;
        if (!Array.isArray(server.categories)) server.categories = DEFAULT_CATEGORIES.map((c) => ({...c}));
        if (!Array.isArray(server.items)) server.items = [];
        data.projects = server.projects;
        data.people = server.people;
        data.categories = server.categories;
        data.items = server.items;
        localStorage.setItem(LS_KEY, JSON.stringify(data));
        renderSidebar();
        renderCalendar();
        setSyncStatus("saved");
      } else {
        pushToServer(data);
      }
    } catch (e) {
      setSyncStatus("error");
    }
  }

  const data = load();
  let weekOffset = 0;
  let monthOffset = 0;
  let viewMode = "week";
  const activeFilters = { project: null, type: null, person: null, status: null };
  let activeProject = null;
  const collapsedGroups = {};

  function getMonday(offset) {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    const day = d.getDay();
    const diff = d.getDate() - day + (day === 0 ? -6 : 1);
    d.setDate(diff + (offset * 7));
    return d;
  }

  function getWeekDays(offset) {
    const mon = getMonday(offset);
    const days = [];
    for (let i = 0; i < 7; i++) {
      const d = new Date(mon);
      d.setDate(mon.getDate() + i);
      days.push(d);
    }
    return days;
  }

  function getMonthDays(offset) {
    const now = new Date();
    let year = now.getFullYear();
    let month = now.getMonth() + offset;
    while (month < 0) { year--; month += 12; }
    while (month > 11) { year++; month -= 12; }
    const first = new Date(year, month, 1);
    const startDay = first.getDay();
    const start = new Date(first);
    start.setDate(1 - (startDay === 0 ? 6 : startDay - 1));
    const cells = [];
    for (let i = 0; i < 42; i++) {
      const d = new Date(start);
      d.setDate(start.getDate() + i);
      cells.push(d);
    }
    return { year, month, cells };
  }

  function fmtDate(d) {
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  }

  function isToday(d) {
    const t = new Date();
    return d.getFullYear() === t.getFullYear() && d.getMonth() === t.getMonth() && d.getDate() === t.getDate();
  }

  function formatWeekRange(days) {
    const first = days[0];
    const last = days[6];
    if (first.getMonth() === last.getMonth()) {
      return `${FULL_MONTHS[first.getMonth()]} ${first.getDate()} – ${last.getDate()}, ${first.getFullYear()}`;
    }
    return `${MONTHS[first.getMonth()]} ${first.getDate()} – ${MONTHS[last.getMonth()]} ${last.getDate()}, ${last.getFullYear()}`;
  }

  function matchesFilters(it) {
    if (activeProject && it.project !== activeProject) return false;
    if (activeFilters.project && it.project !== activeFilters.project) return false;
    if (activeFilters.type && it.type !== activeFilters.type) return false;
    if (activeFilters.person && it.person !== activeFilters.person) return false;
    if (activeFilters.status && it.status !== activeFilters.status) return false;
    return true;
  }

  function renderSidebar() {
    const groups = {};
    data.projects.forEach((p) => {
      if (!groups[p.group]) groups[p.group] = [];
      groups[p.group].push(p);
    });

    ["operations", "podcasts"].forEach((g) => {
      const list = root.querySelector(`[data-cc-list="${g}"]`);
      const count = root.querySelector(`[data-cc-count="${g}"]`);
      const items = groups[g] || [];
      count.textContent = items.length;
      list.innerHTML = items.map((p) => {
        const cls = `cc-sidebar-item${activeProject === p.id ? " is-active" : ""}`;
        return `<li><button type="button" class="${cls}" data-cc-project-id="${p.id}">` +
          `<span class="cc-sidebar-dot" style="background:${p.color}"></span>` +
          `<span class="cc-sidebar-item-name">${esc(p.name)}</span>` +
          `<span class="cc-sidebar-item-edit" data-cc-edit-project="${p.id}" title="Edit project">` +
            `<svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path></svg>` +
          `</span>` +
          `</button></li>`;
      }).join("");

      const groupEl = root.querySelector(`[data-cc-group="${g}"]`);
      if (collapsedGroups[g]) {
        groupEl.classList.add("is-collapsed");
      } else {
        groupEl.classList.remove("is-collapsed");
      }
    });
  }

  function renderItemChip(it) {
    const cat = data.categories.find((c) => { return c.id === it.type; });
    const col = cat ? cat.color : "#9a8773";
    const statusCol = STATUS_COLORS[it.status] || "#9a8773";
    return `<div class="cc-item" data-cc-item-id="${it.id}" draggable="true">` +
      `<span class="cc-item-dot" style="background:${col}"></span>` +
      `<span class="cc-item-title">${esc(it.title)}</span>${
      cat ? `<span class="cc-item-type">${esc(cat.name)}</span>` : ''
      }${it.person ? `<span class="cc-item-person">${esc(it.person)}</span>` : '' 
      }${it.status ? `<span class="cc-item-status" style="color:${statusCol}">${esc(it.status)}</span>` : '' 
      }<button type="button" class="cc-item-remove" data-cc-remove-item="${it.id}" title="Remove">&times;</button>` +
      `</div>`;
  }

  // Week view
  function renderWeekView() {
    const days = getWeekDays(weekOffset);

    const headEl = root.querySelector("[data-cc-main-head]");
    headEl.innerHTML =
      `<h2 class="cc-main-title">What's Happening This Week</h2>` +
      `<div class="cc-nav-row">` +
        `<div class="cc-week-nav">` +
          `<button type="button" class="cc-week-nav-btn" data-cc-prev>` +
            `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="15 18 9 12 15 6"></polyline></svg>` +
          `</button>` +
          `<button type="button" class="cc-week-nav-label" data-cc-today>This Week</button>` +
          `<button type="button" class="cc-week-nav-btn" data-cc-next>` +
            `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="9 18 15 12 9 6"></polyline></svg>` +
          `</button>` +
          `<span class="cc-week-nav-range">${formatWeekRange(days)}</span>` +
        `</div>` +
        `<div class="cc-view-toggle">` +
          `<button type="button" class="cc-view-btn is-active" data-cc-set-view="week">Week</button>` +
          `<button type="button" class="cc-view-btn" data-cc-set-view="month">Month</button>` +
          `<button type="button" class="cc-view-btn" data-cc-set-view="list">List</button>` +
        `</div>` +
      `</div>`;

    const container = root.querySelector("[data-cc-days]");
    container.className = "cc-days";
    container.innerHTML = days.map((d) => {
      const dateStr = fmtDate(d);
      const today = isToday(d);
      const dayItems = data.items.filter((it) => {
        return it.date === dateStr && matchesFilters(it);
      });

      let itemsHtml = "";
      if (dayItems.length === 0) {
        itemsHtml = '<p class="cc-day-empty">Nothing scheduled</p>';
      } else {
        itemsHtml = dayItems.map(renderItemChip).join("");
      }

      return `<div class="cc-day-row${today ? ' is-today' : ''}" data-cc-date="${dateStr}">` +
        `<div class="cc-day-head">` +
          `<span class="cc-day-name">${DAYS[d.getDay()]}, ${FULL_MONTHS[d.getMonth()]} ${d.getDate()}</span>${ 
          today ? '<span class="cc-day-today-badge">Today</span>' : '' 
          }<button type="button" class="cc-day-add" data-cc-add-item="${dateStr}" title="Add item">+ Add</button>` +
        `</div>` +
        `<div class="cc-day-items">${itemsHtml}</div>` +
        `</div>`;
    }).join("");
  }

  // Month view
  function renderMonthView() {
    const m = getMonthDays(monthOffset);

    const headEl = root.querySelector("[data-cc-main-head]");
    headEl.innerHTML =
      `<h2 class="cc-main-title">${FULL_MONTHS[m.month]} ${m.year}</h2>` +
      `<div class="cc-nav-row">` +
        `<div class="cc-week-nav">` +
          `<button type="button" class="cc-week-nav-btn" data-cc-prev>` +
            `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="15 18 9 12 15 6"></polyline></svg>` +
          `</button>` +
          `<button type="button" class="cc-week-nav-label" data-cc-today>This Month</button>` +
          `<button type="button" class="cc-week-nav-btn" data-cc-next>` +
            `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="9 18 15 12 9 6"></polyline></svg>` +
          `</button>` +
        `</div>` +
        `<div class="cc-view-toggle">` +
          `<button type="button" class="cc-view-btn" data-cc-set-view="week">Week</button>` +
          `<button type="button" class="cc-view-btn is-active" data-cc-set-view="month">Month</button>` +
          `<button type="button" class="cc-view-btn" data-cc-set-view="list">List</button>` +
        `</div>` +
      `</div>`;

    const container = root.querySelector("[data-cc-days]");
    container.className = "cc-days cc-month-grid";

    const headerRow = `<div class="cc-month-header">${ 
      DAYS_SHORT.map((d, i) => {
        const idx = (i + 1) % 7;
        return `<div class="cc-month-header-cell">${DAYS_SHORT[idx === 0 ? 0 : idx]}</div>`;
      }).join("")}</div>`;

    const weeks = [];
    for (let w = 0; w < 6; w++) {
      const cells = [];
      for (let d = 0; d < 7; d++) {
        const cell = m.cells[w * 7 + d];
        const dateStr = fmtDate(cell);
        const today = isToday(cell);
        const isCurrentMonth = cell.getMonth() === m.month;
        const dayItems = data.items.filter((it) => {
          return it.date === dateStr && matchesFilters(it);
        });

        let itemDots = dayItems.slice(0, 4).map((it) => {
          const cat = data.categories.find((c) => { return c.id === it.type; });
          const col = cat ? cat.color : "#9a8773";
          return `<span class="cc-mcell-dot" style="background:${col}" title="${escAttr(it.title)}"></span>`;
        }).join("");
        if (dayItems.length > 4) {
          itemDots += `<span class="cc-mcell-more">+${dayItems.length - 4}</span>`;
        }

        const MAX_VISIBLE = 3;
        const visible = dayItems.slice(0, MAX_VISIBLE);
        const overflow = dayItems.length - MAX_VISIBLE;

        const itemList = visible.map((it) => {
          const cat = data.categories.find((c) => { return c.id === it.type; });
          const col = cat ? cat.color : "#9a8773";
          return `<div class="cc-mcell-item" data-cc-item-id="${it.id}" draggable="true" style="background:${col}">` +
            `<span class="cc-mcell-item-title">${esc(it.title)}</span>` +
          `</div>`;
        }).join("");

        const moreHtml = overflow > 0 ? `<span class="cc-mcell-more">+${overflow} more</span>` : "";

        cells.push(
          `<div class="cc-month-cell${today ? ' is-today' : ''}${!isCurrentMonth ? ' is-other-month' : ''}" data-cc-date="${dateStr}">` +
            `<div class="cc-mcell-head">` +
              `<span class="cc-mcell-date${today ? ' is-today' : ''}">${cell.getDate()}</span>` +
              `<button type="button" class="cc-mcell-add" data-cc-add-item="${dateStr}">+</button>` +
            `</div>` +
            `<div class="cc-mcell-items">${itemList}${moreHtml}</div>` +
          `</div>`
        );
      }
      weeks.push(`<div class="cc-month-row">${cells.join("")}</div>`);
    }

    const headerCells = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].map((d) => {
      return `<div class="cc-month-header-cell">${d}</div>`;
    }).join("");

    container.innerHTML =
      `<div class="cc-month-header">${headerCells}</div>${ 
      weeks.join("")}`;
  }

  function renderListView() {
    const headEl = root.querySelector("[data-cc-main-head]");
    headEl.innerHTML =
      '<h2 class="cc-main-title">All Items by Category</h2>' +
      '<div class="cc-nav-row">' +
        '<div class="cc-week-nav"></div>' +
        '<div class="cc-view-toggle">' +
          '<button type="button" class="cc-view-btn" data-cc-set-view="week">Week</button>' +
          '<button type="button" class="cc-view-btn" data-cc-set-view="month">Month</button>' +
          '<button type="button" class="cc-view-btn is-active" data-cc-set-view="list">List</button>' +
        '</div>' +
      '</div>';

    const container = root.querySelector("[data-cc-days]");
    container.className = "cc-days cc-list-groups";

    const grouped = {};
    const uncategorized = [];
    data.categories.forEach((c) => { grouped[c.id] = []; });

    const filtered = data.items.filter(matchesFilters);
    filtered.forEach((it) => {
      if (it.type && grouped[it.type]) {
        grouped[it.type].push(it);
      } else {
        uncategorized.push(it);
      }
    });

    const STATUS_COLORS = { Idea: "#9a8773", Drafting: "#3498db", "In Review": "#f39c12", Scheduled: "#27ae60", Published: "#2d2927" };

    let html = "";
    data.categories.forEach((cat) => {
      const items = grouped[cat.id] || [];
      html += `<div class="cc-list-group">` +
        `<div class="cc-list-group-head">` +
          `<span class="cc-list-group-dot" style="background:${cat.color}"></span>` +
          `<h3 class="cc-list-group-name">${esc(cat.name)}</h3>` +
          `<span class="cc-list-group-count">${items.length}</span>` +
          `<button type="button" class="cc-list-group-edit" data-cc-list-edit-cat="${cat.id}" title="Edit category">` +
            `<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path></svg>` +
          `</button>` +
        `</div>`;

      if (items.length === 0) {
        html += '<p class="cc-list-empty">No items</p>';
      } else {
        items.sort((a, b) => { return (a.date || "").localeCompare(b.date || ""); });
        items.forEach((it) => {
          const statusCol = STATUS_COLORS[it.status] || "#9a8773";
          html += `<div class="cc-list-item" data-cc-item-id="${it.id}">` +
            `<span class="cc-list-item-title">${esc(it.title)}</span>${ 
            it.person ? `<span class="cc-list-item-person">${esc(it.person)}</span>` : '' 
            }${it.date ? `<span class="cc-list-item-date">${esc(it.date)}</span>` : '' 
            }${it.status ? `<span class="cc-list-item-status" style="color:${statusCol}">${esc(it.status)}</span>` : '' 
          }</div>`;
        });
      }
      html += '</div>';
    });

    if (uncategorized.length > 0) {
      html += `<div class="cc-list-group">` +
        `<div class="cc-list-group-head">` +
          `<span class="cc-list-group-dot" style="background:#9a8773"></span>` +
          `<h3 class="cc-list-group-name">Uncategorized</h3>` +
          `<span class="cc-list-group-count">${uncategorized.length}</span>` +
        `</div>`;
      uncategorized.forEach((it) => {
        const statusCol = STATUS_COLORS[it.status] || "#9a8773";
        html += `<div class="cc-list-item" data-cc-item-id="${it.id}">` +
          `<span class="cc-list-item-title">${esc(it.title)}</span>${ 
          it.person ? `<span class="cc-list-item-person">${esc(it.person)}</span>` : '' 
          }${it.date ? `<span class="cc-list-item-date">${esc(it.date)}</span>` : '' 
          }${it.status ? `<span class="cc-list-item-status" style="color:${statusCol}">${esc(it.status)}</span>` : '' 
        }</div>`;
      });
      html += '</div>';
    }

    container.innerHTML = html;
  }

  function showEditCategoryInline(catId) {
    const cat = data.categories.find((c) => { return c.id === catId; });
    if (!cat) return;

    const overlay = document.createElement("div");
    overlay.className = "cc-modal-overlay";
    overlay.innerHTML =
      `<div class="cc-modal" style="max-width:400px">` +
        `<h3 class="cc-modal-title">Edit Category</h3>` +
        `<label class="cc-modal-field"><span>Name</span><input type="text" data-cc-edit-cat-name value="${escAttr(cat.name)}"></label>` +
        `<label class="cc-modal-field"><span>Color</span>` +
          `<div class="cc-color-picker">${ 
            SWATCH_COLORS.map((c) => {
              return `<button type="button" class="cc-color-swatch${c === cat.color ? ' is-active' : ''}" data-cc-color="${c}" style="background:${c}"></button>`;
            }).join("") 
          }</div>` +
        `</label>` +
        `<div class="cc-modal-actions">` +
          `<button type="button" class="btn btn-sm cc-btn-danger" data-cc-edit-cat-delete>Delete Category</button>` +
          `<span style="flex:1"></span>` +
          `<button type="button" class="btn btn-sm" data-cc-modal-cancel>Cancel</button>` +
          `<button type="button" class="btn btn-sm btn-primary" data-cc-edit-cat-save>Save</button>` +
        `</div>` +
      `</div>`;

    root.appendChild(overlay);
    const nameInput = overlay.querySelector("[data-cc-edit-cat-name]");
    nameInput.focus();
    let editColor = cat.color;

    overlay.querySelectorAll(".cc-color-swatch").forEach((sw) => {
      sw.onclick = function () {
        overlay.querySelectorAll(".cc-color-swatch").forEach((s) => { s.classList.remove("is-active"); });
        sw.classList.add("is-active");
        editColor = sw.dataset.ccColor;
      };
    });

    overlay.querySelector("[data-cc-modal-cancel]").onclick = function () { overlay.remove(); };
    overlay.addEventListener("click", (e) => { if (e.target === overlay) overlay.remove(); });

    overlay.querySelector("[data-cc-edit-cat-delete]").onclick = function () {
      data.categories = data.categories.filter((c) => { return c.id !== catId; });
      save(data);
      renderCalendar();
      overlay.remove();
    };

    overlay.querySelector("[data-cc-edit-cat-save]").onclick = function () {
      const newName = nameInput.value.trim();
      if (newName) cat.name = newName;
      cat.color = editColor;
      save(data);
      renderCalendar();
      overlay.remove();
    };
  }

  function renderCalendar() {
    if (viewMode === "list") {
      renderListView();
    } else if (viewMode === "month") {
      renderMonthView();
    } else {
      renderWeekView();
    }
  }

  // Filter dropdowns
  function closeAllDropdowns() {
    root.querySelectorAll(".cc-filter-dropdown").forEach((d) => { d.classList.remove("is-open"); });
  }

  function renderFilterDropdown(filterKey) {
    const dd = root.querySelector(`[data-cc-filter="${filterKey}"] .cc-filter-dropdown`);
    let options = [];

    if (filterKey === "project") {
      options = data.projects.map((p) => { return { label: p.name, value: p.id }; });
    } else if (filterKey === "type") {
      options = data.categories.map((c) => { return { label: c.name, value: c.id }; });
    } else if (filterKey === "person") {
      options = data.people.map((p) => { return { label: p, value: p }; });
    } else if (filterKey === "status") {
      options = STATUS_OPTIONS.map((s) => { return { label: s, value: s }; });
    }

    const current = activeFilters[filterKey];
    dd.innerHTML = `<button type="button" class="cc-filter-option${!current ? ' is-active' : ''}" data-cc-filter-val="">All</button>${ 
      options.map((o) => {
        const cls = current === o.value ? " is-active" : "";
        return `<button type="button" class="cc-filter-option${cls}" data-cc-filter-val="${esc(o.value)}">${esc(o.label)}</button>`;
      }).join("")}`;
  }

  function showAddItemModal(dateStr) {
    const overlay = document.createElement("div");
    overlay.className = "cc-modal-overlay";
    overlay.innerHTML =
      `<div class="cc-modal">` +
        `<h3 class="cc-modal-title">Add Calendar Item</h3>` +
        `<label class="cc-modal-field"><span>Title</span><input type="text" data-cc-modal-title placeholder="What's happening?"></label>` +
        `<label class="cc-modal-field"><span>Date</span><input type="date" data-cc-modal-date value="${dateStr}"></label>` +
        `<label class="cc-modal-field"><span>Project</span><select data-cc-modal-project>${ 
          data.projects.map((p) => { return `<option value="${p.id}">${esc(p.name)}</option>`; }).join("") 
        }</select></label>` +
        `<label class="cc-modal-field"><span>Category</span><select data-cc-modal-type>` +
          `<option value="">—</option>${
          data.categories.map((c) => { return `<option value="${c.id}">${esc(c.name)}</option>`; }).join("")
        }</select></label>` +
        `<label class="cc-modal-field"><span>Assigned To</span><select data-cc-modal-person>` +
          `<option value="">—</option>${
          data.people.map((p) => { return `<option value="${esc(p)}">${esc(p)}</option>`; }).join("")
        }</select></label>` +
        `<label class="cc-modal-field"><span>Status</span><select data-cc-modal-status>${
          STATUS_OPTIONS.map((s) => { return `<option value="${s}">${s}</option>`; }).join("")
        }</select></label>` +
        `<div class="cc-modal-actions">` +
          `<button type="button" class="btn btn-sm" data-cc-modal-cancel>Cancel</button>` +
          `<button type="button" class="btn btn-sm btn-primary" data-cc-modal-save>Add Item</button>` +
        `</div>` +
      `</div>`;

    root.appendChild(overlay);
    const titleInput = overlay.querySelector("[data-cc-modal-title]");
    titleInput.focus();
    if (activeProject) overlay.querySelector("[data-cc-modal-project]").value = activeProject;

    overlay.querySelector("[data-cc-modal-cancel]").onclick = function () { overlay.remove(); };
    overlay.addEventListener("click", (e) => { if (e.target === overlay) overlay.remove(); });
    overlay.querySelector("[data-cc-modal-save]").onclick = function () {
      const title = titleInput.value.trim();
      if (!title) { titleInput.focus(); return; }
      data.items.push({
        id: `item_${Date.now()}`,
        title,
        date: overlay.querySelector("[data-cc-modal-date]").value,
        project: overlay.querySelector("[data-cc-modal-project]").value,
        type: overlay.querySelector("[data-cc-modal-type]").value,
        person: overlay.querySelector("[data-cc-modal-person]").value,
        status: overlay.querySelector("[data-cc-modal-status]").value
      });
      save(data);
      renderCalendar();
      overlay.remove();
    };
    titleInput.addEventListener("keydown", (e) => {
      if (e.key === "Enter") overlay.querySelector("[data-cc-modal-save]").click();
    });
  }

  function showAddProjectModal() {
    const overlay = document.createElement("div");
    overlay.className = "cc-modal-overlay";
    overlay.innerHTML =
      `<div class="cc-modal">` +
        `<h3 class="cc-modal-title">Add Project</h3>` +
        `<label class="cc-modal-field"><span>Name</span><input type="text" data-cc-modal-name placeholder="Project name"></label>` +
        `<label class="cc-modal-field"><span>Group</span><select data-cc-modal-group>` +
          `<option value="operations">Operations</option>` +
          `<option value="podcasts">Podcasts</option>` +
        `</select></label>` +
        `<label class="cc-modal-field"><span>Color</span>` +
          `<div class="cc-color-picker">${ 
            SWATCH_COLORS.map((c) => {
              return `<button type="button" class="cc-color-swatch" data-cc-color="${c}" style="background:${c}"></button>`;
            }).join("") 
          }</div>` +
        `</label>` +
        `<div class="cc-modal-actions">` +
          `<button type="button" class="btn btn-sm" data-cc-modal-cancel>Cancel</button>` +
          `<button type="button" class="btn btn-sm btn-primary" data-cc-modal-save>Add Project</button>` +
        `</div>` +
      `</div>`;

    root.appendChild(overlay);
    const nameInput = overlay.querySelector("[data-cc-modal-name]");
    nameInput.focus();
    let selectedColor = SWATCH_COLORS[0];
    overlay.querySelectorAll(".cc-color-swatch").forEach((sw) => {
      if (sw.dataset.ccColor === selectedColor) sw.classList.add("is-active");
      sw.onclick = function () {
        overlay.querySelectorAll(".cc-color-swatch").forEach((s) => { s.classList.remove("is-active"); });
        sw.classList.add("is-active");
        selectedColor = sw.dataset.ccColor;
      };
    });
    overlay.querySelector("[data-cc-modal-cancel]").onclick = function () { overlay.remove(); };
    overlay.addEventListener("click", (e) => { if (e.target === overlay) overlay.remove(); });
    overlay.querySelector("[data-cc-modal-save]").onclick = function () {
      const name = nameInput.value.trim();
      if (!name) { nameInput.focus(); return; }
      data.projects.push({
        id: name.toLowerCase().replace(/[^a-z0-9]+/g, "-"),
        name,
        group: overlay.querySelector("[data-cc-modal-group]").value,
        color: selectedColor
      });
      save(data);
      renderSidebar();
      overlay.remove();
    };
  }

  function showEditProjectModal(projectId) {
    const proj = data.projects.find((p) => p.id === projectId);
    if (!proj) return;

    const overlay = document.createElement("div");
    overlay.className = "cc-modal-overlay";
    overlay.innerHTML =
      `<div class="cc-modal" style="max-width:400px">` +
        `<h3 class="cc-modal-title">Edit Project</h3>` +
        `<label class="cc-modal-field"><span>Name</span><input type="text" data-cc-edit-proj-name value="${escAttr(proj.name)}"></label>` +
        `<label class="cc-modal-field"><span>Group</span><select data-cc-edit-proj-group>` +
          `<option value="operations"${proj.group === "operations" ? " selected" : ""}>Operations</option>` +
          `<option value="podcasts"${proj.group === "podcasts" ? " selected" : ""}>Podcasts</option>` +
        `</select></label>` +
        `<label class="cc-modal-field"><span>Color</span>` +
          `<div class="cc-color-picker">${
            SWATCH_COLORS.map((c) => {
              return `<button type="button" class="cc-color-swatch${c === proj.color ? " is-active" : ""}" data-cc-color="${c}" style="background:${c}"></button>`;
            }).join("")
          }</div>` +
        `</label>` +
        `<div class="cc-modal-actions">` +
          `<button type="button" class="btn btn-sm cc-btn-danger" data-cc-edit-proj-delete>Delete Project</button>` +
          `<span style="flex:1"></span>` +
          `<button type="button" class="btn btn-sm" data-cc-modal-cancel>Cancel</button>` +
          `<button type="button" class="btn btn-sm btn-primary" data-cc-edit-proj-save>Save</button>` +
        `</div>` +
      `</div>`;

    root.appendChild(overlay);
    const nameInput = overlay.querySelector("[data-cc-edit-proj-name]");
    nameInput.focus();
    let editColor = proj.color;

    overlay.querySelectorAll(".cc-color-swatch").forEach((sw) => {
      sw.onclick = function () {
        overlay.querySelectorAll(".cc-color-swatch").forEach((s) => { s.classList.remove("is-active"); });
        sw.classList.add("is-active");
        editColor = sw.dataset.ccColor;
      };
    });

    overlay.querySelector("[data-cc-modal-cancel]").onclick = function () { overlay.remove(); };
    overlay.addEventListener("click", (e) => { if (e.target === overlay) overlay.remove(); });

    overlay.querySelector("[data-cc-edit-proj-delete]").onclick = function () {
      data.projects = data.projects.filter((p) => p.id !== projectId);
      if (activeProject === projectId) activeProject = null;
      save(data);
      renderSidebar();
      renderCalendar();
      overlay.remove();
    };

    overlay.querySelector("[data-cc-edit-proj-save]").onclick = function () {
      const newName = nameInput.value.trim();
      if (newName) proj.name = newName;
      proj.group = overlay.querySelector("[data-cc-edit-proj-group]").value;
      proj.color = editColor;
      save(data);
      renderSidebar();
      renderCalendar();
      overlay.remove();
    };
  }

  function showSettingsModal() {
    const overlay = document.createElement("div");
    overlay.className = "cc-modal-overlay";
    overlay.innerHTML =
      `<div class="cc-modal">` +
        `<h3 class="cc-modal-title">Calendar Settings</h3>` +
        `<label class="cc-modal-field"><span>People (one per line)</span>` +
          `<textarea data-cc-settings-people rows="5">${data.people.join("\n")}</textarea>` +
        `</label>` +
        `<div class="cc-modal-actions">` +
          `<button type="button" class="btn btn-sm" data-cc-modal-cancel>Cancel</button>` +
          `<button type="button" class="btn btn-sm btn-primary" data-cc-modal-save>Save</button>` +
        `</div>` +
      `</div>`;

    root.appendChild(overlay);
    overlay.querySelector("[data-cc-modal-cancel]").onclick = function () { overlay.remove(); };
    overlay.addEventListener("click", (e) => { if (e.target === overlay) overlay.remove(); });
    overlay.querySelector("[data-cc-modal-save]").onclick = function () {
      const lines = overlay.querySelector("[data-cc-settings-people]").value.split("\n").map((l) => { return l.trim(); }).filter(Boolean);
      data.people = lines;
      save(data);
      overlay.remove();
    };
  }

  function showCategoriesModal() {
    const overlay = document.createElement("div");
    overlay.className = "cc-modal-overlay";

    function renderCategoryList() {
      return data.categories.map((c) => {
        return `<div class="cc-cat-row" data-cc-cat-id="${c.id}">` +
          `<span class="cc-cat-swatch" style="background:${c.color}"></span>` +
          `<span class="cc-cat-name">${esc(c.name)}</span>` +
          `<button type="button" class="cc-cat-edit" data-cc-edit-cat="${c.id}" title="Edit">` +
            `<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path></svg>` +
          `</button>` +
          `<button type="button" class="cc-cat-remove" data-cc-remove-cat="${c.id}" title="Remove">&times;</button>` +
        `</div>`;
      }).join("");
    }

    overlay.innerHTML =
      `<div class="cc-modal" style="max-width:480px">` +
        `<h3 class="cc-modal-title">Manage Categories</h3>` +
        `<div class="cc-cat-list" data-cc-cat-list>${renderCategoryList()}</div>` +
        `<div class="cc-cat-add-row">` +
          `<input type="text" class="cc-cat-add-input" data-cc-cat-name placeholder="New category name">` +
          `<div class="cc-color-picker cc-cat-add-colors">${
            SWATCH_COLORS.map((c) => {
              return `<button type="button" class="cc-color-swatch" data-cc-color="${c}" style="background:${c}"></button>`;
            }).join("")
          }</div>` +
          `<button type="button" class="btn btn-sm btn-primary" data-cc-cat-add-btn>Add</button>` +
        `</div>` +
        `<div class="cc-modal-actions" style="margin-top:16px">` +
          `<button type="button" class="btn btn-sm btn-primary" data-cc-modal-done>Done</button>` +
        `</div>` +
      `</div>`;

    root.appendChild(overlay);
    let newCatColor = SWATCH_COLORS[0];
    const swatches = overlay.querySelectorAll(".cc-cat-add-colors .cc-color-swatch");
    swatches.forEach((sw) => {
      if (sw.dataset.ccColor === newCatColor) sw.classList.add("is-active");
      sw.onclick = function () {
        swatches.forEach((s) => { s.classList.remove("is-active"); });
        sw.classList.add("is-active");
        newCatColor = sw.dataset.ccColor;
      };
    });

    overlay.querySelector("[data-cc-cat-add-btn]").onclick = function () {
      const nameInput = overlay.querySelector("[data-cc-cat-name]");
      const name = nameInput.value.trim();
      if (!name) { nameInput.focus(); return; }
      const id = name.toLowerCase().replace(/[^a-z0-9]+/g, "-");
      if (data.categories.some((c) => { return c.id === id; })) { nameInput.focus(); return; }
      data.categories.push({ id, name, color: newCatColor });
      save(data);
      overlay.querySelector("[data-cc-cat-list]").innerHTML = renderCategoryList();
      nameInput.value = "";
      nameInput.focus();
    };

    overlay.addEventListener("click", (ev) => {
      if (ev.target === overlay) { overlay.remove(); renderCalendar(); return; }

      const removeBtn = ev.target.closest("[data-cc-remove-cat]");
      if (removeBtn) {
        data.categories = data.categories.filter((c) => { return c.id !== removeBtn.dataset.ccRemoveCat; });
        save(data);
        overlay.querySelector("[data-cc-cat-list]").innerHTML = renderCategoryList();
        return;
      }

      const editBtn = ev.target.closest("[data-cc-edit-cat]");
      if (editBtn) {
        const catId = editBtn.dataset.ccEditCat;
        const cat = data.categories.find((c) => { return c.id === catId; });
        if (!cat) return;
        const row = editBtn.closest(".cc-cat-row");
        row.innerHTML =
          `<input type="text" class="cc-cat-edit-input" value="${escAttr(cat.name)}">` +
          `<div class="cc-color-picker" style="flex:1">${
            SWATCH_COLORS.map((c) => {
              return `<button type="button" class="cc-color-swatch${c === cat.color ? ' is-active' : ''}" data-cc-color="${c}" style="background:${c}"></button>`;
            }).join("")
          }</div>` +
          `<button type="button" class="btn btn-sm btn-primary cc-cat-save-edit">Save</button>`;
        const editInput = row.querySelector(".cc-cat-edit-input");
        editInput.focus();
        let editColor = cat.color;
        row.querySelectorAll(".cc-color-swatch").forEach((sw) => {
          sw.onclick = function () {
            row.querySelectorAll(".cc-color-swatch").forEach((s) => { s.classList.remove("is-active"); });
            sw.classList.add("is-active");
            editColor = sw.dataset.ccColor;
          };
        });
        row.querySelector(".cc-cat-save-edit").onclick = function () {
          const newName = editInput.value.trim();
          if (newName) cat.name = newName;
          cat.color = editColor;
          save(data);
          overlay.querySelector("[data-cc-cat-list]").innerHTML = renderCategoryList();
        };
        return;
      }
    });

    overlay.querySelector("[data-cc-modal-done]").onclick = function () {
      overlay.remove();
      renderCalendar();
    };
  }

  // ── CSV helpers ─────────────────────────────────────────────────
  function parseCSV(text) {
    const lines = [];
    let cur = [];
    let field = "";
    let inQuotes = false;
    for (let i = 0; i < text.length; i++) {
      const ch = text[i];
      if (inQuotes) {
        if (ch === '"' && text[i + 1] === '"') { field += '"'; i++; }
        else if (ch === '"') { inQuotes = false; }
        else { field += ch; }
      } else if (ch === '"') { inQuotes = true; }
        else if (ch === ",") { cur.push(field); field = ""; }
        else if (ch === "\n" || (ch === "\r" && text[i + 1] === "\n")) {
          cur.push(field); field = "";
          if (cur.length > 1 || cur[0] !== "") lines.push(cur);
          cur = [];
          if (ch === "\r") i++;
        } else { field += ch; }
    }
    cur.push(field);
    if (cur.length > 1 || cur[0] !== "") lines.push(cur);
    return lines;
  }

  function normalizeDate(raw) {
    if (!raw) return "";
    const s = raw.trim();
    const iso = /^(\d{4})-(\d{1,2})-(\d{1,2})/.exec(s);
    if (iso) return `${iso[1]}-${iso[2].padStart(2, "0")}-${iso[3].padStart(2, "0")}`;
    const mdy = /^(\d{1,2})\/(\d{1,2})\/(\d{2,4})/.exec(s);
    if (mdy) {
      const y = mdy[3].length === 2 ? `20${mdy[3]}` : mdy[3];
      return `${y}-${mdy[1].padStart(2, "0")}-${mdy[2].padStart(2, "0")}`;
    }
    const d = new Date(s);
    if (!isNaN(d.getTime())) return fmtDate(d);
    return "";
  }

  function slugify(s) {
    return (s || "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
  }

  function ensureCategory(name) {
    if (!name) return "";
    const id = slugify(name);
    if (!data.categories.some((c) => c.id === id)) {
      const colorIdx = data.categories.length % SWATCH_COLORS.length;
      data.categories.push({ id, name: name.trim(), color: SWATCH_COLORS[colorIdx] });
    }
    return id;
  }

  function ensurePerson(name) {
    if (!name) return "";
    const trimmed = name.trim();
    if (!data.people.some((p) => p.toLowerCase() === trimmed.toLowerCase())) {
      data.people.push(trimmed);
    }
    return trimmed;
  }

  function ensureProject(name) {
    if (!name) return data.projects.length ? data.projects[0].id : "";
    const id = slugify(name);
    if (!data.projects.some((p) => p.id === id)) {
      const colorIdx = data.projects.length % SWATCH_COLORS.length;
      data.projects.push({ id, name: name.trim(), group: "operations", color: SWATCH_COLORS[colorIdx] });
    }
    return id;
  }

  function showAsanaImportModal() {
    const overlay = document.createElement("div");
    overlay.className = "cc-modal-overlay";
    overlay.innerHTML =
      `<div class="cc-modal" style="max-width:560px">` +
        `<h3 class="cc-modal-title">Import from Asana</h3>` +
        `<p style="font-family:var(--font-body);font-size:13px;color:var(--color-muted);margin:0 0 16px">` +
          `Export your Asana project as CSV, then upload it here. Tasks are mapped by Name, Due Date, Assignee, and Section.` +
        `</p>` +
        `<label class="cc-modal-field">` +
          `<span>CSV File</span>` +
          `<input type="file" accept=".csv,text/csv" data-cc-import-file style="font-family:var(--font-body);font-size:13px">` +
        `</label>` +
        `<div data-cc-import-preview style="display:none">` +
          `<div data-cc-import-summary style="font-family:var(--font-body);font-size:13px;margin-bottom:12px;padding:12px;background:var(--color-page);border-radius:6px;border:1px solid var(--color-rule)"></div>` +
          `<details style="margin-bottom:12px">` +
            `<summary style="font-family:var(--font-body);font-size:12px;color:var(--color-muted);cursor:pointer">Preview rows</summary>` +
            `<div data-cc-import-table style="max-height:200px;overflow:auto;margin-top:8px"></div>` +
          `</details>` +
        `</div>` +
        `<div class="cc-modal-actions">` +
          `<button type="button" class="btn btn-sm" data-cc-modal-cancel>Cancel</button>` +
          `<button type="button" class="btn btn-sm btn-primary" data-cc-import-go style="display:none">Import</button>` +
        `</div>` +
      `</div>`;

    root.appendChild(overlay);
    overlay.querySelector("[data-cc-modal-cancel]").onclick = () => { overlay.remove(); };
    overlay.addEventListener("click", (ev) => { if (ev.target === overlay) overlay.remove(); });

    let parsedRows = [];
    let headerMap = {};

    const fileInput = overlay.querySelector("[data-cc-import-file]");
    fileInput.addEventListener("change", () => {
      const file = fileInput.files[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = () => {
        const lines = parseCSV(reader.result);
        if (lines.length < 2) {
          overlay.querySelector("[data-cc-import-summary]").textContent = "No data rows found.";
          overlay.querySelector("[data-cc-import-preview]").style.display = "";
          return;
        }

        const headers = lines[0].map((h) => h.trim());
        headerMap = {};
        headers.forEach((h, i) => { headerMap[h.toLowerCase()] = i; });

        const nameIdx = headerMap["name"] ?? headerMap["task name"] ?? -1;
        const dateIdx = headerMap["due date"] ?? headerMap["start date"] ?? -1;
        const assigneeIdx = headerMap["assignee"] ?? -1;
        const sectionIdx = headerMap["section/column"] ?? headerMap["section"] ?? headerMap["column"] ?? -1;
        const completedIdx = headerMap["completed at"] ?? -1;
        const projectIdx = headerMap["projects"] ?? headerMap["project"] ?? -1;

        if (nameIdx === -1) {
          overlay.querySelector("[data-cc-import-summary]").innerHTML =
            `<strong style="color:#c1593c">Could not find a "Name" column.</strong><br>` +
            `Found columns: ${headers.map((h) => `<code>${esc(h)}</code>`).join(", ")}`;
          overlay.querySelector("[data-cc-import-preview]").style.display = "";
          return;
        }

        parsedRows = [];
        for (let r = 1; r < lines.length; r++) {
          const row = lines[r];
          const name = (row[nameIdx] || "").trim();
          if (!name) continue;
          const dueRaw = dateIdx >= 0 ? (row[dateIdx] || "") : "";
          const dateVal = normalizeDate(dueRaw);
          if (!dateVal) continue;
          const assignee = assigneeIdx >= 0 ? (row[assigneeIdx] || "").trim() : "";
          const section = sectionIdx >= 0 ? (row[sectionIdx] || "").trim() : "";
          const completed = completedIdx >= 0 ? (row[completedIdx] || "").trim() : "";
          const project = projectIdx >= 0 ? (row[projectIdx] || "").trim() : "";

          let status = "Idea";
          if (completed) status = "Published";

          parsedRows.push({ name, date: dateVal, assignee, section, status, project });
        }

        const skipped = (lines.length - 1) - parsedRows.length;
        let summaryHtml = `<strong>${parsedRows.length}</strong> tasks with dates found.`;
        if (skipped > 0) summaryHtml += ` <span style="color:var(--color-muted)">(${skipped} skipped — no date)</span>`;

        const sections = [...new Set(parsedRows.map((r) => r.section).filter(Boolean))];
        if (sections.length) {
          summaryHtml += `<br><span style="font-size:12px;color:var(--color-muted)">Sections → categories: ${sections.map((s) => esc(s)).join(", ")}</span>`;
        }
        const assignees = [...new Set(parsedRows.map((r) => r.assignee).filter(Boolean))];
        if (assignees.length) {
          summaryHtml += `<br><span style="font-size:12px;color:var(--color-muted)">Assignees: ${assignees.map((a) => esc(a)).join(", ")}</span>`;
        }

        overlay.querySelector("[data-cc-import-summary]").innerHTML = summaryHtml;
        overlay.querySelector("[data-cc-import-preview]").style.display = "";
        overlay.querySelector("[data-cc-import-go]").style.display = "";

        const tableHtml = `<table style="width:100%;font-family:var(--font-body);font-size:11px;border-collapse:collapse">` +
          `<thead><tr style="text-align:left;border-bottom:1px solid var(--color-rule)">` +
            `<th style="padding:4px 6px">Name</th><th style="padding:4px 6px">Date</th><th style="padding:4px 6px">Category</th><th style="padding:4px 6px">Assignee</th><th style="padding:4px 6px">Status</th>` +
          `</tr></thead><tbody>${
            parsedRows.slice(0, 50).map((r) => {
              return `<tr style="border-bottom:1px solid var(--color-rule)"><td style="padding:4px 6px">${esc(r.name)}</td><td style="padding:4px 6px">${r.date}</td><td style="padding:4px 6px">${esc(r.section)}</td><td style="padding:4px 6px">${esc(r.assignee)}</td><td style="padding:4px 6px">${esc(r.status)}</td></tr>`;
            }).join("")
          }${parsedRows.length > 50 ? `<tr><td colspan="5" style="padding:4px 6px;color:var(--color-muted)">…and ${parsedRows.length - 50} more</td></tr>` : ""}</tbody></table>`;
        overlay.querySelector("[data-cc-import-table]").innerHTML = tableHtml;
      };
      reader.readAsText(file);
    });

    overlay.querySelector("[data-cc-import-go]").onclick = () => {
      let added = 0;
      for (const row of parsedRows) {
        const catId = ensureCategory(row.section);
        const person = ensurePerson(row.assignee);
        const projectId = ensureProject(row.project);
        data.items.push({
          id: `item_${Date.now()}_${added}`,
          title: row.name,
          date: row.date,
          project: projectId,
          type: catId,
          person,
          status: row.status
        });
        added++;
      }
      save(data);
      renderSidebar();
      renderCalendar();
      overlay.remove();
    };
  }

  // Event delegation
  root.addEventListener("click", (e) => {
    let btn;

    // View toggle
    btn = e.target.closest("[data-cc-set-view]");
    if (btn) {
      const newView = btn.dataset.ccSetView;
      if (newView !== viewMode) {
        viewMode = newView;
        renderCalendar();
      }
      return;
    }

    // Prev/Next/Today navigation
    if (e.target.closest("[data-cc-prev]")) {
      if (viewMode === "week") weekOffset--;
      else monthOffset--;
      renderCalendar();
      return;
    }
    if (e.target.closest("[data-cc-next]")) {
      if (viewMode === "week") weekOffset++;
      else monthOffset++;
      renderCalendar();
      return;
    }
    if (e.target.closest("[data-cc-today]")) {
      if (viewMode === "week") weekOffset = 0;
      else monthOffset = 0;
      renderCalendar();
      return;
    }

    // Add item
    btn = e.target.closest("[data-cc-add-item]");
    if (btn) {
      showAddItemModal(btn.dataset.ccAddItem);
      return;
    }

    // Remove item
    btn = e.target.closest("[data-cc-remove-item]");
    if (btn) {
      data.items = data.items.filter((it) => { return it.id !== btn.dataset.ccRemoveItem; });
      save(data);
      renderCalendar();
      return;
    }

    // Edit project (intercept before project-id toggle)
    btn = e.target.closest("[data-cc-edit-project]");
    if (btn) {
      e.stopPropagation();
      showEditProjectModal(btn.dataset.ccEditProject);
      return;
    }

    // Project sidebar
    btn = e.target.closest("[data-cc-project-id]");
    if (btn) {
      activeProject = activeProject === btn.dataset.ccProjectId ? null : btn.dataset.ccProjectId;
      renderSidebar();
      renderCalendar();
      return;
    }

    // Group toggle
    btn = e.target.closest("[data-cc-toggle-group]");
    if (btn) {
      collapsedGroups[btn.dataset.ccToggleGroup] = !collapsedGroups[btn.dataset.ccToggleGroup];
      renderSidebar();
      return;
    }

    // Filter button toggle
    btn = e.target.closest(".cc-filter-btn");
    if (btn) {
      const filterEl = btn.closest(".cc-filter");
      const dd = filterEl.querySelector(".cc-filter-dropdown");
      const wasOpen = dd.classList.contains("is-open");
      closeAllDropdowns();
      if (!wasOpen) {
        renderFilterDropdown(filterEl.dataset.ccFilter);
        dd.classList.add("is-open");
      }
      return;
    }

    // Filter option select
    btn = e.target.closest(".cc-filter-option");
    if (btn) {
      const filterParent = btn.closest(".cc-filter");
      const filterKey = filterParent.dataset.ccFilter;
      const val = btn.dataset.ccFilterVal;
      activeFilters[filterKey] = val || null;
      closeAllDropdowns();

      const filterBtn = filterParent.querySelector(".cc-filter-btn");
      const labels = { project: "Project", type: "Content Type", person: "Person", status: "Status" };
      if (val) {
        let displayVal = val;
        if (filterKey === "project") {
          const proj = data.projects.find((p) => { return p.id === val; });
          displayVal = proj ? proj.name : val;
        }
        filterBtn.innerHTML = `${esc(displayVal)} <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="6 9 12 15 18 9"></polyline></svg>`;
        filterBtn.classList.add("is-filtered");
      } else {
        filterBtn.innerHTML = `${labels[filterKey]} <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="6 9 12 15 18 9"></polyline></svg>`;
        filterBtn.classList.remove("is-filtered");
      }
      renderCalendar();
      return;
    }

    // Edit category from list view
    btn = e.target.closest("[data-cc-list-edit-cat]");
    if (btn) { showEditCategoryInline(btn.dataset.ccListEditCat); return; }

    // List view item click — open edit modal (single click, since no drag-drop)
    btn = e.target.closest(".cc-list-item[data-cc-item-id]");
    if (btn && viewMode === "list") {
      const listItem = data.items.find((it) => { return it.id === btn.dataset.ccItemId; });
      if (listItem) showEditItemModal(listItem);
      return;
    }

    // Add project
    if (e.target.closest("[data-cc-add-project]")) { showAddProjectModal(); return; }
    if (e.target.closest("[data-cc-categories]")) { showCategoriesModal(); return; }
    if (e.target.closest("[data-cc-import-asana]")) { showAsanaImportModal(); return; }
    if (e.target.closest("[data-cc-settings]")) { showSettingsModal(); return; }

    // Close dropdowns on outside click
    if (!e.target.closest(".cc-filter")) closeAllDropdowns();
  });

  function showEditItemModal(item) {
    const overlay = document.createElement("div");
    overlay.className = "cc-modal-overlay";
    overlay.innerHTML =
      `<div class="cc-modal">` +
        `<h3 class="cc-modal-title">Edit Item</h3>` +
        `<label class="cc-modal-field"><span>Title</span><input type="text" data-cc-modal-title value="${escAttr(item.title)}"></label>` +
        `<label class="cc-modal-field"><span>Date</span><input type="date" data-cc-modal-date value="${item.date}"></label>` +
        `<label class="cc-modal-field"><span>Project</span><select data-cc-modal-project>${
          data.projects.map((p) => { return `<option value="${p.id}"${p.id === item.project ? ' selected' : ''}>${esc(p.name)}</option>`; }).join("")
        }</select></label>` +
        `<label class="cc-modal-field"><span>Category</span><select data-cc-modal-type>` +
          `<option value="">—</option>${
          data.categories.map((c) => { return `<option value="${c.id}"${c.id === item.type ? ' selected' : ''}>${esc(c.name)}</option>`; }).join("")
        }</select></label>` +
        `<label class="cc-modal-field"><span>Assigned To</span><select data-cc-modal-person>` +
          `<option value="">—</option>${
          data.people.map((p) => { return `<option value="${esc(p)}"${p === item.person ? ' selected' : ''}>${esc(p)}</option>`; }).join("")
        }</select></label>` +
        `<label class="cc-modal-field"><span>Status</span><select data-cc-modal-status>${
          STATUS_OPTIONS.map((s) => { return `<option value="${s}"${s === item.status ? ' selected' : ''}>${s}</option>`; }).join("")
        }</select></label>` +
        `<div class="cc-modal-actions">` +
          `<button type="button" class="btn btn-sm cc-btn-danger" data-cc-modal-delete>Delete</button>` +
          `<span style="flex:1"></span>` +
          `<button type="button" class="btn btn-sm" data-cc-modal-cancel>Cancel</button>` +
          `<button type="button" class="btn btn-sm btn-primary" data-cc-modal-save>Save</button>` +
        `</div>` +
      `</div>`;

    root.appendChild(overlay);
    overlay.querySelector("[data-cc-modal-cancel]").onclick = function () { overlay.remove(); };
    overlay.addEventListener("click", (ev) => { if (ev.target === overlay) overlay.remove(); });
    overlay.querySelector("[data-cc-modal-delete]").onclick = function () {
      data.items = data.items.filter((it) => { return it.id !== item.id; });
      save(data);
      renderCalendar();
      overlay.remove();
    };
    overlay.querySelector("[data-cc-modal-save]").onclick = function () {
      item.title = overlay.querySelector("[data-cc-modal-title]").value.trim() || item.title;
      item.date = overlay.querySelector("[data-cc-modal-date]").value;
      item.project = overlay.querySelector("[data-cc-modal-project]").value;
      item.type = overlay.querySelector("[data-cc-modal-type]").value;
      item.person = overlay.querySelector("[data-cc-modal-person]").value;
      item.status = overlay.querySelector("[data-cc-modal-status]").value;
      save(data);
      renderCalendar();
      overlay.remove();
    };
  }

  // Double-click to edit
  root.addEventListener("dblclick", (e) => {
    const itemEl = e.target.closest("[data-cc-item-id]");
    if (!itemEl) return;
    const item = data.items.find((it) => { return it.id === itemEl.dataset.ccItemId; });
    if (item) showEditItemModal(item);
  });

  function esc(s) { return (s || "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;"); }
  function escAttr(s) { return (s || "").replace(/&/g, "&amp;").replace(/"/g, "&quot;"); }

  // ── Drag-and-drop ──────────────────────────────────────────────
  let dragItemId = null;

  function removeDropLine() {
    root.querySelectorAll(".cc-drop-line").forEach((el) => { el.remove(); });
  }

  function clearDragState() {
    root.querySelectorAll(".is-dragging").forEach((el) => { el.classList.remove("is-dragging"); });
    root.querySelectorAll(".cc-drag-over").forEach((el) => { el.classList.remove("cc-drag-over"); });
    removeDropLine();
    dragItemId = null;
  }

  function showDropLine(container, clientY) {
    removeDropLine();
    const items = Array.from(container.querySelectorAll(".cc-item, .cc-mcell-item"));
    const line = document.createElement("div");
    line.className = "cc-drop-line";

    let insertBefore = null;
    for (const item of items) {
      if (item.classList.contains("is-dragging")) continue;
      const rect = item.getBoundingClientRect();
      if (clientY < rect.top + rect.height / 2) {
        insertBefore = item;
        break;
      }
    }

    if (insertBefore) {
      container.insertBefore(line, insertBefore);
    } else {
      container.appendChild(line);
    }
  }

  root.addEventListener("dragstart", (e) => {
    const itemEl = e.target.closest("[data-cc-item-id][draggable]");
    if (!itemEl) return;
    dragItemId = itemEl.dataset.ccItemId;
    itemEl.classList.add("is-dragging");
    e.dataTransfer.effectAllowed = "move";
    e.dataTransfer.setData("text/plain", dragItemId);
  });

  root.addEventListener("dragend", () => {
    clearDragState();
  });

  root.addEventListener("dragover", (e) => {
    if (!dragItemId) return;
    const dayContainer = e.target.closest("[data-cc-date]");
    if (!dayContainer) return;
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";

    root.querySelectorAll(".cc-drag-over").forEach((el) => {
      if (el !== dayContainer) el.classList.remove("cc-drag-over");
    });
    dayContainer.classList.add("cc-drag-over");

    const itemsContainer = dayContainer.querySelector(".cc-day-items, .cc-mcell-items");
    if (itemsContainer) {
      showDropLine(itemsContainer, e.clientY);
    }
  });

  root.addEventListener("dragleave", (e) => {
    const dayContainer = e.target.closest("[data-cc-date]");
    if (dayContainer && !dayContainer.contains(e.relatedTarget)) {
      dayContainer.classList.remove("cc-drag-over");
      removeDropLine();
    }
  });

  root.addEventListener("drop", (e) => {
    if (!dragItemId) return;
    e.preventDefault();
    const dayContainer = e.target.closest("[data-cc-date]");
    if (!dayContainer) { clearDragState(); return; }

    const newDate = dayContainer.dataset.ccDate;
    const item = data.items.find((it) => { return it.id === dragItemId; });
    if (item && newDate) {
      item.date = newDate;
      save(data);
      renderCalendar();
    }
    clearDragState();
  });

  renderSidebar();
  renderCalendar();
  syncFromServer();
})();
