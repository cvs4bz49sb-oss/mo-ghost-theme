(function () {
  "use strict";

  const root = document.querySelector("[data-ag-root]");
  if (!root) return;

  const LS_KEY = "mo_content_calendar";
  const PROJECT_ID = "weekly-meeting";
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
    categories: DEFAULT_CATEGORIES.map((c) => { return { ...c}; }),
    items: []
  };

  function load() {
    try {
      const raw = localStorage.getItem(LS_KEY);
      if (raw) {
        const d = JSON.parse(raw);
        if (!d.projects) d.projects = DEFAULT_DATA.projects;
        if (!d.people) d.people = DEFAULT_DATA.people;
        if (!d.categories) d.categories = DEFAULT_CATEGORIES.map((c) => { return { ...c}; });
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
          if (!Array.isArray(server.categories)) server.categories = DEFAULT_CATEGORIES.map((c) => { return { ...c}; });
          if (!Array.isArray(server.items)) server.items = [];
          data.projects = server.projects;
          data.people = server.people;
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
    return data.items.filter((it) => { return it.project === PROJECT_ID; });
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

  function renderItem(it) {
    const done = isCompleted(it);
    const cat = data.categories.find((c) => { return c.id === it.type; });
    const catLabel = cat ? cat.name : "";
    const catColor = cat ? cat.color : "#9a8773";
    return `<div class="ag-item${done ? ' is-done' : ''}" data-ag-item-id="${it.id}">` +
      `<button type="button" class="ag-check${done ? ' is-checked' : ''}" data-ag-toggle="${it.id}" title="${done ? 'Mark incomplete' : 'Mark complete'}">` +
        `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="20 6 9 17 4 12"></polyline></svg>` +
      `</button>` +
      `<span class="ag-item-title">${esc(it.title)}</span>${ 
      it.date ? `<span class="ag-item-date">${fmtDate(it.date)}</span>` : '' 
      }${catLabel ? `<span class="ag-item-cat" style="color:${catColor}">${esc(catLabel)}</span>` : '' 
      }<button type="button" class="ag-item-remove" data-ag-remove="${it.id}" title="Remove">&times;</button>` +
    `</div>`;
  }

  function render() {
    const items = agendaItems();
    const active = items.filter((it) => { return !isCompleted(it); });
    const completed = items.filter((it) => { return isCompleted(it); });

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

    let html = "";

    if (unassigned.length > 0) {
      html += `<div class="ag-group">` +
        `<h3 class="ag-group-title">Unassigned</h3>` +
        `<div class="ag-group-items">${unassigned.map(renderItem).join("")}</div>` +
      `</div>`;
    }

    data.people.forEach((person) => {
      const personItems = groups[person] || [];
      html += `<div class="ag-group">` +
        `<h3 class="ag-group-title">${esc(person) 
        }<span class="ag-group-count">${personItems.length}</span></h3>` +
        `<div class="ag-group-items">`;
      if (personItems.length === 0) {
        html += '<p class="ag-empty">No items</p>';
      } else {
        html += personItems.map(renderItem).join("");
      }
      html += '</div></div>';
    });

    root.querySelector("[data-ag-groups]").innerHTML = html;

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

  function showAddModal(person) {
    const overlay = document.createElement("div");
    overlay.className = "cc-modal-overlay";
    overlay.innerHTML =
      `<div class="cc-modal">` +
        `<h3 class="cc-modal-title">Add Agenda Item</h3>` +
        `<label class="cc-modal-field"><span>Title</span><input type="text" data-ag-modal-title placeholder="What needs to happen?"></label>` +
        `<label class="cc-modal-field"><span>Date</span><input type="date" data-ag-modal-date></label>` +
        `<label class="cc-modal-field"><span>Assigned To</span><select data-ag-modal-person>` +
          `<option value="">--</option>${ 
          data.people.map((p) => { return `<option value="${escAttr(p)}"${p === person ? ' selected' : ''}>${esc(p)}</option>`; }).join("") 
        }</select></label>` +
        `<label class="cc-modal-field"><span>Category</span><select data-ag-modal-type>` +
          `<option value="">--</option>${ 
          data.categories.map((c) => { return `<option value="${c.id}">${esc(c.name)}</option>`; }).join("") 
        }</select></label>` +
        `<div class="cc-modal-actions">` +
          `<button type="button" class="btn btn-sm" data-ag-modal-cancel>Cancel</button>` +
          `<button type="button" class="btn btn-sm btn-primary" data-ag-modal-save>Add Item</button>` +
        `</div>` +
      `</div>`;

    document.body.appendChild(overlay);
    const titleInput = overlay.querySelector("[data-ag-modal-title]");
    titleInput.focus();

    overlay.querySelector("[data-ag-modal-cancel]").onclick = function () { overlay.remove(); };
    overlay.addEventListener("click", (e) => { if (e.target === overlay) overlay.remove(); });
    overlay.querySelector("[data-ag-modal-save]").onclick = function () {
      const title = titleInput.value.trim();
      if (!title) { titleInput.focus(); return; }
      data.items.push({
        id: `item_${Date.now()}`,
        title,
        date: overlay.querySelector("[data-ag-modal-date]").value,
        project: PROJECT_ID,
        type: overlay.querySelector("[data-ag-modal-type]").value,
        person: overlay.querySelector("[data-ag-modal-person]").value,
        status: "Idea"
      });
      save(data);
      render();
      overlay.remove();
    };
    titleInput.addEventListener("keydown", (e) => {
      if (e.key === "Enter") overlay.querySelector("[data-ag-modal-save]").click();
    });
  }

  function showEditModal(item) {
    const overlay = document.createElement("div");
    overlay.className = "cc-modal-overlay";
    overlay.innerHTML =
      `<div class="cc-modal">` +
        `<h3 class="cc-modal-title">Edit Item</h3>` +
        `<label class="cc-modal-field"><span>Title</span><input type="text" data-ag-modal-title value="${escAttr(item.title)}"></label>` +
        `<label class="cc-modal-field"><span>Date</span><input type="date" data-ag-modal-date value="${item.date || ''}"></label>` +
        `<label class="cc-modal-field"><span>Assigned To</span><select data-ag-modal-person>` +
          `<option value="">--</option>${ 
          data.people.map((p) => { return `<option value="${escAttr(p)}"${p === item.person ? ' selected' : ''}>${esc(p)}</option>`; }).join("") 
        }</select></label>` +
        `<label class="cc-modal-field"><span>Category</span><select data-ag-modal-type>` +
          `<option value="">--</option>${ 
          data.categories.map((c) => { return `<option value="${c.id}"${c.id === item.type ? ' selected' : ''}>${esc(c.name)}</option>`; }).join("") 
        }</select></label>` +
        `<label class="cc-modal-field"><span>Status</span><select data-ag-modal-status>${ 
          STATUS_OPTIONS.map((s) => { return `<option value="${s}"${s === item.status ? ' selected' : ''}>${s}</option>`; }).join("") 
        }</select></label>` +
        `<div class="cc-modal-actions">` +
          `<button type="button" class="btn btn-sm cc-btn-danger" data-ag-modal-delete>Delete</button>` +
          `<span style="flex:1"></span>` +
          `<button type="button" class="btn btn-sm" data-ag-modal-cancel>Cancel</button>` +
          `<button type="button" class="btn btn-sm btn-primary" data-ag-modal-save>Save</button>` +
        `</div>` +
      `</div>`;

    document.body.appendChild(overlay);
    overlay.querySelector("[data-ag-modal-cancel]").onclick = function () { overlay.remove(); };
    overlay.addEventListener("click", (e) => { if (e.target === overlay) overlay.remove(); });
    overlay.querySelector("[data-ag-modal-delete]").onclick = function () {
      data.items = data.items.filter((it) => { return it.id !== item.id; });
      save(data);
      render();
      overlay.remove();
    };
    overlay.querySelector("[data-ag-modal-save]").onclick = function () {
      item.title = overlay.querySelector("[data-ag-modal-title]").value.trim() || item.title;
      item.date = overlay.querySelector("[data-ag-modal-date]").value;
      item.person = overlay.querySelector("[data-ag-modal-person]").value;
      item.type = overlay.querySelector("[data-ag-modal-type]").value;
      item.status = overlay.querySelector("[data-ag-modal-status]").value;
      save(data);
      render();
      overlay.remove();
    };
  }

  root.addEventListener("click", (e) => {
    let btn;

    btn = e.target.closest("[data-ag-toggle]");
    if (btn) {
      const item = data.items.find((it) => { return it.id === btn.dataset.agToggle; });
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
      data.items = data.items.filter((it) => { return it.id !== btn.dataset.agRemove; });
      save(data);
      render();
      return;
    }

    if (e.target.closest("[data-ag-add]")) {
      showAddModal("");
      return;
    }

    if (e.target.closest("[data-ag-toggle-completed]")) {
      showCompleted = !showCompleted;
      render();
      return;
    }

    btn = e.target.closest("[data-ag-item-id]");
    if (btn && !e.target.closest("[data-ag-toggle]") && !e.target.closest("[data-ag-remove]")) {
      return;
    }
  });

  root.addEventListener("dblclick", (e) => {
    const itemEl = e.target.closest("[data-ag-item-id]");
    if (!itemEl) return;
    const item = data.items.find((it) => { return it.id === itemEl.dataset.agItemId; });
    if (item) showEditModal(item);
  });

  render();
  syncFromServer();
})();
