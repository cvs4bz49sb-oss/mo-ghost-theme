(function () {
  "use strict";

  var root = document.querySelector("[data-cc-root]");
  if (!root) return;

  var LS_KEY = "mo_content_calendar";
  var DAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
  var MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  var FULL_MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
  var CONTENT_TYPES = ["Essay", "Newsletter", "Podcast", "Social", "Event", "Meeting", "Other"];
  var STATUS_OPTIONS = ["Idea", "Drafting", "In Review", "Scheduled", "Published"];
  var STATUS_COLORS = { Idea: "#9a8773", Drafting: "#3498db", "In Review": "#f39c12", Scheduled: "#27ae60", Published: "#2d2927" };
  var PROJECT_COLORS = ["#c1593c", "#3498db", "#27ae60", "#f39c12", "#9b59b6", "#1abc9c", "#e74c3c", "#34495e"];

  var DEFAULT_DATA = {
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
    items: []
  };

  function load() {
    try {
      var raw = localStorage.getItem(LS_KEY);
      if (raw) {
        var d = JSON.parse(raw);
        if (!d.projects) d.projects = DEFAULT_DATA.projects;
        if (!d.people) d.people = DEFAULT_DATA.people;
        if (!d.items) d.items = [];
        return d;
      }
    } catch (e) { /* ignore */ }
    return JSON.parse(JSON.stringify(DEFAULT_DATA));
  }

  function save(data) {
    localStorage.setItem(LS_KEY, JSON.stringify(data));
  }

  var data = load();
  var weekOffset = 0;
  var activeFilters = { project: null, type: null, person: null, status: null };
  var activeProject = null;
  var collapsedGroups = {};

  // Week helpers
  function getMonday(offset) {
    var d = new Date();
    d.setHours(0, 0, 0, 0);
    var day = d.getDay();
    var diff = d.getDate() - day + (day === 0 ? -6 : 1);
    d.setDate(diff + (offset * 7));
    return d;
  }

  function getWeekDays(offset) {
    var mon = getMonday(offset);
    var days = [];
    for (var i = 0; i < 7; i++) {
      var d = new Date(mon);
      d.setDate(mon.getDate() + i);
      days.push(d);
    }
    return days;
  }

  function fmtDate(d) {
    return d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0");
  }

  function isToday(d) {
    var t = new Date();
    return d.getFullYear() === t.getFullYear() && d.getMonth() === t.getMonth() && d.getDate() === t.getDate();
  }

  function formatRange(days) {
    var first = days[0];
    var last = days[6];
    if (first.getMonth() === last.getMonth()) {
      return FULL_MONTHS[first.getMonth()] + " " + first.getDate() + " – " + last.getDate() + ", " + first.getFullYear();
    }
    return MONTHS[first.getMonth()] + " " + first.getDate() + " – " + MONTHS[last.getMonth()] + " " + last.getDate() + ", " + last.getFullYear();
  }

  // Sidebar rendering
  function renderSidebar() {
    var groups = {};
    data.projects.forEach(function (p) {
      if (!groups[p.group]) groups[p.group] = [];
      groups[p.group].push(p);
    });

    ["operations", "podcasts"].forEach(function (g) {
      var list = root.querySelector('[data-cc-list="' + g + '"]');
      var count = root.querySelector('[data-cc-count="' + g + '"]');
      var items = groups[g] || [];
      count.textContent = items.length;
      list.innerHTML = items.map(function (p) {
        var cls = "cc-sidebar-item" + (activeProject === p.id ? " is-active" : "");
        return '<li><button type="button" class="' + cls + '" data-cc-project-id="' + p.id + '">' +
          '<span class="cc-sidebar-dot" style="background:' + p.color + '"></span>' +
          '<span class="cc-sidebar-item-name">' + esc(p.name) + '</span>' +
          '</button></li>';
      }).join("");

      var groupEl = root.querySelector('[data-cc-group="' + g + '"]');
      if (collapsedGroups[g]) {
        groupEl.classList.add("is-collapsed");
      } else {
        groupEl.classList.remove("is-collapsed");
      }
    });
  }

  // Calendar rendering
  function renderCalendar() {
    var days = getWeekDays(weekOffset);
    var rangeEl = root.querySelector("[data-cc-week-range]");
    rangeEl.textContent = formatRange(days);

    var container = root.querySelector("[data-cc-days]");
    container.innerHTML = days.map(function (d) {
      var dateStr = fmtDate(d);
      var today = isToday(d);
      var dayItems = data.items.filter(function (it) {
        if (it.date !== dateStr) return false;
        if (activeProject && it.project !== activeProject) return false;
        if (activeFilters.project && it.project !== activeFilters.project) return false;
        if (activeFilters.type && it.type !== activeFilters.type) return false;
        if (activeFilters.person && it.person !== activeFilters.person) return false;
        if (activeFilters.status && it.status !== activeFilters.status) return false;
        return true;
      });

      var itemsHtml = "";
      if (dayItems.length === 0) {
        itemsHtml = '<p class="cc-day-empty">Nothing scheduled</p>';
      } else {
        itemsHtml = dayItems.map(function (it) {
          var proj = data.projects.find(function (p) { return p.id === it.project; });
          var col = proj ? proj.color : "#9a8773";
          var statusCol = STATUS_COLORS[it.status] || "#9a8773";
          return '<div class="cc-item" data-cc-item-id="' + it.id + '">' +
            '<span class="cc-item-dot" style="background:' + col + '"></span>' +
            '<span class="cc-item-title">' + esc(it.title) + '</span>' +
            (it.type ? '<span class="cc-item-type">' + esc(it.type) + '</span>' : '') +
            (it.person ? '<span class="cc-item-person">' + esc(it.person) + '</span>' : '') +
            (it.status ? '<span class="cc-item-status" style="color:' + statusCol + '">' + esc(it.status) + '</span>' : '') +
            '<button type="button" class="cc-item-remove" data-cc-remove-item="' + it.id + '" title="Remove">&times;</button>' +
            '</div>';
        }).join("");
      }

      return '<div class="cc-day-row' + (today ? ' is-today' : '') + '">' +
        '<div class="cc-day-head">' +
          '<span class="cc-day-name">' + DAYS[d.getDay()] + ', ' + FULL_MONTHS[d.getMonth()] + ' ' + d.getDate() + '</span>' +
          (today ? '<span class="cc-day-today-badge">Today</span>' : '') +
          '<button type="button" class="cc-day-add" data-cc-add-item="' + dateStr + '" title="Add item">+ Add</button>' +
        '</div>' +
        '<div class="cc-day-items">' + itemsHtml + '</div>' +
        '</div>';
    }).join("");
  }

  // Filter dropdowns
  function renderFilterDropdown(filterKey) {
    var dd = root.querySelector('[data-cc-filter="' + filterKey + '"] .cc-filter-dropdown');
    var options = [];

    if (filterKey === "project") {
      options = data.projects.map(function (p) { return p.name; });
    } else if (filterKey === "type") {
      options = CONTENT_TYPES.slice();
    } else if (filterKey === "person") {
      options = data.people.slice();
    } else if (filterKey === "status") {
      options = STATUS_OPTIONS.slice();
    }

    var current = activeFilters[filterKey];
    dd.innerHTML = '<button type="button" class="cc-filter-option' + (!current ? ' is-active' : '') + '" data-cc-filter-val="">All</button>' +
      options.map(function (o) {
        var matchVal = filterKey === "project" ? data.projects.find(function (p) { return p.name === o; })?.id : o;
        var cls = current === matchVal ? " is-active" : "";
        return '<button type="button" class="cc-filter-option' + cls + '" data-cc-filter-val="' + esc(matchVal || o) + '">' + esc(o) + '</button>';
      }).join("");
  }

  // Add item modal
  function showAddItemModal(dateStr) {
    var overlay = document.createElement("div");
    overlay.className = "cc-modal-overlay";
    overlay.innerHTML =
      '<div class="cc-modal">' +
        '<h3 class="cc-modal-title">Add Calendar Item</h3>' +
        '<label class="cc-modal-field"><span>Title</span><input type="text" data-cc-modal-title placeholder="What\'s happening?"></label>' +
        '<label class="cc-modal-field"><span>Date</span><input type="date" data-cc-modal-date value="' + dateStr + '"></label>' +
        '<label class="cc-modal-field"><span>Project</span><select data-cc-modal-project>' +
          data.projects.map(function (p) { return '<option value="' + p.id + '">' + esc(p.name) + '</option>'; }).join("") +
        '</select></label>' +
        '<label class="cc-modal-field"><span>Content Type</span><select data-cc-modal-type>' +
          '<option value="">—</option>' +
          CONTENT_TYPES.map(function (t) { return '<option value="' + t + '">' + t + '</option>'; }).join("") +
        '</select></label>' +
        '<label class="cc-modal-field"><span>Person</span><select data-cc-modal-person>' +
          '<option value="">—</option>' +
          data.people.map(function (p) { return '<option value="' + esc(p) + '">' + esc(p) + '</option>'; }).join("") +
        '</select></label>' +
        '<label class="cc-modal-field"><span>Status</span><select data-cc-modal-status>' +
          STATUS_OPTIONS.map(function (s) { return '<option value="' + s + '">' + s + '</option>'; }).join("") +
        '</select></label>' +
        '<div class="cc-modal-actions">' +
          '<button type="button" class="btn btn-sm" data-cc-modal-cancel>Cancel</button>' +
          '<button type="button" class="btn btn-sm btn-primary" data-cc-modal-save>Add Item</button>' +
        '</div>' +
      '</div>';

    document.body.appendChild(overlay);

    var titleInput = overlay.querySelector("[data-cc-modal-title]");
    titleInput.focus();

    if (activeProject) {
      var projSelect = overlay.querySelector("[data-cc-modal-project]");
      projSelect.value = activeProject;
    }

    overlay.querySelector("[data-cc-modal-cancel]").onclick = function () { overlay.remove(); };
    overlay.addEventListener("click", function (e) { if (e.target === overlay) overlay.remove(); });

    overlay.querySelector("[data-cc-modal-save]").onclick = function () {
      var title = titleInput.value.trim();
      if (!title) { titleInput.focus(); return; }
      data.items.push({
        id: "item_" + Date.now(),
        title: title,
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

    titleInput.addEventListener("keydown", function (e) {
      if (e.key === "Enter") overlay.querySelector("[data-cc-modal-save]").click();
    });
  }

  // Add project modal
  function showAddProjectModal() {
    var overlay = document.createElement("div");
    overlay.className = "cc-modal-overlay";
    overlay.innerHTML =
      '<div class="cc-modal">' +
        '<h3 class="cc-modal-title">Add Project</h3>' +
        '<label class="cc-modal-field"><span>Name</span><input type="text" data-cc-modal-name placeholder="Project name"></label>' +
        '<label class="cc-modal-field"><span>Group</span><select data-cc-modal-group>' +
          '<option value="operations">Operations</option>' +
          '<option value="podcasts">Podcasts</option>' +
        '</select></label>' +
        '<label class="cc-modal-field"><span>Color</span>' +
          '<div class="cc-color-picker">' +
            PROJECT_COLORS.map(function (c) {
              return '<button type="button" class="cc-color-swatch" data-cc-color="' + c + '" style="background:' + c + '"></button>';
            }).join("") +
          '</div>' +
        '</label>' +
        '<div class="cc-modal-actions">' +
          '<button type="button" class="btn btn-sm" data-cc-modal-cancel>Cancel</button>' +
          '<button type="button" class="btn btn-sm btn-primary" data-cc-modal-save>Add Project</button>' +
        '</div>' +
      '</div>';

    document.body.appendChild(overlay);

    var nameInput = overlay.querySelector("[data-cc-modal-name]");
    nameInput.focus();
    var selectedColor = PROJECT_COLORS[0];

    overlay.querySelectorAll(".cc-color-swatch").forEach(function (sw) {
      if (sw.dataset.ccColor === selectedColor) sw.classList.add("is-active");
      sw.onclick = function () {
        overlay.querySelectorAll(".cc-color-swatch").forEach(function (s) { s.classList.remove("is-active"); });
        sw.classList.add("is-active");
        selectedColor = sw.dataset.ccColor;
      };
    });

    overlay.querySelector("[data-cc-modal-cancel]").onclick = function () { overlay.remove(); };
    overlay.addEventListener("click", function (e) { if (e.target === overlay) overlay.remove(); });

    overlay.querySelector("[data-cc-modal-save]").onclick = function () {
      var name = nameInput.value.trim();
      if (!name) { nameInput.focus(); return; }
      data.projects.push({
        id: name.toLowerCase().replace(/[^a-z0-9]+/g, "-"),
        name: name,
        group: overlay.querySelector("[data-cc-modal-group]").value,
        color: selectedColor
      });
      save(data);
      renderSidebar();
      overlay.remove();
    };
  }

  // Settings modal
  function showSettingsModal() {
    var overlay = document.createElement("div");
    overlay.className = "cc-modal-overlay";
    overlay.innerHTML =
      '<div class="cc-modal">' +
        '<h3 class="cc-modal-title">Calendar Settings</h3>' +
        '<label class="cc-modal-field"><span>People (one per line)</span>' +
          '<textarea data-cc-settings-people rows="5">' + data.people.join("\n") + '</textarea>' +
        '</label>' +
        '<div class="cc-modal-actions">' +
          '<button type="button" class="btn btn-sm" data-cc-modal-cancel>Cancel</button>' +
          '<button type="button" class="btn btn-sm btn-primary" data-cc-modal-save>Save</button>' +
        '</div>' +
      '</div>';

    document.body.appendChild(overlay);
    overlay.querySelector("[data-cc-modal-cancel]").onclick = function () { overlay.remove(); };
    overlay.addEventListener("click", function (e) { if (e.target === overlay) overlay.remove(); });

    overlay.querySelector("[data-cc-modal-save]").onclick = function () {
      var lines = overlay.querySelector("[data-cc-settings-people]").value.split("\n").map(function (l) { return l.trim(); }).filter(Boolean);
      data.people = lines;
      save(data);
      overlay.remove();
    };
  }

  // Event delegation
  root.addEventListener("click", function (e) {
    var btn;

    // Week navigation
    if (e.target.closest("[data-cc-prev-week]")) {
      weekOffset--;
      renderCalendar();
      return;
    }
    if (e.target.closest("[data-cc-next-week]")) {
      weekOffset++;
      renderCalendar();
      return;
    }
    if (e.target.closest("[data-cc-this-week]")) {
      weekOffset = 0;
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
      data.items = data.items.filter(function (it) { return it.id !== btn.dataset.ccRemoveItem; });
      save(data);
      renderCalendar();
      return;
    }

    // Project sidebar click
    btn = e.target.closest("[data-cc-project-id]");
    if (btn) {
      if (activeProject === btn.dataset.ccProjectId) {
        activeProject = null;
      } else {
        activeProject = btn.dataset.ccProjectId;
      }
      renderSidebar();
      renderCalendar();
      return;
    }

    // Group toggle
    btn = e.target.closest("[data-cc-toggle-group]");
    if (btn) {
      var g = btn.dataset.ccToggleGroup;
      collapsedGroups[g] = !collapsedGroups[g];
      renderSidebar();
      return;
    }

    // Filter button
    btn = e.target.closest(".cc-filter-btn");
    if (btn) {
      var filterEl = btn.closest(".cc-filter");
      var dd = filterEl.querySelector(".cc-filter-dropdown");
      var wasHidden = dd.hidden;
      root.querySelectorAll(".cc-filter-dropdown").forEach(function (d) { d.hidden = true; });
      if (wasHidden) {
        var key = filterEl.dataset.ccFilter;
        renderFilterDropdown(key);
        dd.hidden = false;
      }
      return;
    }

    // Filter option
    btn = e.target.closest(".cc-filter-option");
    if (btn) {
      var filterParent = btn.closest(".cc-filter");
      var filterKey = filterParent.dataset.ccFilter;
      var val = btn.dataset.ccFilterVal;
      activeFilters[filterKey] = val || null;
      filterParent.querySelector(".cc-filter-dropdown").hidden = true;

      var filterBtn = filterParent.querySelector(".cc-filter-btn");
      var labels = { project: "Project", type: "Content Type", person: "Person", status: "Status" };
      if (val) {
        var displayVal = val;
        if (filterKey === "project") {
          var proj = data.projects.find(function (p) { return p.id === val; });
          displayVal = proj ? proj.name : val;
        }
        filterBtn.innerHTML = esc(displayVal) + ' <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="6 9 12 15 18 9"></polyline></svg>';
        filterBtn.classList.add("is-filtered");
      } else {
        filterBtn.innerHTML = labels[filterKey] + ' <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="6 9 12 15 18 9"></polyline></svg>';
        filterBtn.classList.remove("is-filtered");
      }
      renderCalendar();
      return;
    }

    // Add project
    if (e.target.closest("[data-cc-add-project]")) {
      showAddProjectModal();
      return;
    }

    // Settings
    if (e.target.closest("[data-cc-settings]")) {
      showSettingsModal();
      return;
    }

    // Close filter dropdowns on outside click
    if (!e.target.closest(".cc-filter")) {
      root.querySelectorAll(".cc-filter-dropdown").forEach(function (d) { d.hidden = true; });
    }
  });

  // Click on item to edit
  root.addEventListener("dblclick", function (e) {
    var itemEl = e.target.closest("[data-cc-item-id]");
    if (!itemEl) return;
    var item = data.items.find(function (it) { return it.id === itemEl.dataset.ccItemId; });
    if (!item) return;

    var overlay = document.createElement("div");
    overlay.className = "cc-modal-overlay";
    overlay.innerHTML =
      '<div class="cc-modal">' +
        '<h3 class="cc-modal-title">Edit Item</h3>' +
        '<label class="cc-modal-field"><span>Title</span><input type="text" data-cc-modal-title value="' + escAttr(item.title) + '"></label>' +
        '<label class="cc-modal-field"><span>Date</span><input type="date" data-cc-modal-date value="' + item.date + '"></label>' +
        '<label class="cc-modal-field"><span>Project</span><select data-cc-modal-project>' +
          data.projects.map(function (p) { return '<option value="' + p.id + '"' + (p.id === item.project ? ' selected' : '') + '>' + esc(p.name) + '</option>'; }).join("") +
        '</select></label>' +
        '<label class="cc-modal-field"><span>Content Type</span><select data-cc-modal-type>' +
          '<option value="">—</option>' +
          CONTENT_TYPES.map(function (t) { return '<option value="' + t + '"' + (t === item.type ? ' selected' : '') + '>' + t + '</option>'; }).join("") +
        '</select></label>' +
        '<label class="cc-modal-field"><span>Person</span><select data-cc-modal-person>' +
          '<option value="">—</option>' +
          data.people.map(function (p) { return '<option value="' + esc(p) + '"' + (p === item.person ? ' selected' : '') + '>' + esc(p) + '</option>'; }).join("") +
        '</select></label>' +
        '<label class="cc-modal-field"><span>Status</span><select data-cc-modal-status>' +
          STATUS_OPTIONS.map(function (s) { return '<option value="' + s + '"' + (s === item.status ? ' selected' : '') + '>' + s + '</option>'; }).join("") +
        '</select></label>' +
        '<div class="cc-modal-actions">' +
          '<button type="button" class="btn btn-sm cc-btn-danger" data-cc-modal-delete>Delete</button>' +
          '<span style="flex:1"></span>' +
          '<button type="button" class="btn btn-sm" data-cc-modal-cancel>Cancel</button>' +
          '<button type="button" class="btn btn-sm btn-primary" data-cc-modal-save>Save</button>' +
        '</div>' +
      '</div>';

    document.body.appendChild(overlay);
    overlay.querySelector("[data-cc-modal-cancel]").onclick = function () { overlay.remove(); };
    overlay.addEventListener("click", function (ev) { if (ev.target === overlay) overlay.remove(); });

    overlay.querySelector("[data-cc-modal-delete]").onclick = function () {
      data.items = data.items.filter(function (it) { return it.id !== item.id; });
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
  });

  function esc(s) { return (s || "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;"); }
  function escAttr(s) { return (s || "").replace(/&/g, "&amp;").replace(/"/g, "&quot;"); }

  // Initial render
  renderSidebar();
  renderCalendar();
})();
