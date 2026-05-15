(function () {
  "use strict";

  var root = document.querySelector("[data-cc-root]");
  if (!root) return;

  var LS_KEY = "mo_content_calendar";
  var DAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
  var DAYS_SHORT = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
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
  var monthOffset = 0;
  var viewMode = "week";
  var activeFilters = { project: null, type: null, person: null, status: null };
  var activeProject = null;
  var collapsedGroups = {};

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

  function getMonthDays(offset) {
    var now = new Date();
    var year = now.getFullYear();
    var month = now.getMonth() + offset;
    while (month < 0) { year--; month += 12; }
    while (month > 11) { year++; month -= 12; }
    var first = new Date(year, month, 1);
    var startDay = first.getDay();
    var start = new Date(first);
    start.setDate(1 - (startDay === 0 ? 6 : startDay - 1));
    var cells = [];
    for (var i = 0; i < 42; i++) {
      var d = new Date(start);
      d.setDate(start.getDate() + i);
      cells.push(d);
    }
    return { year: year, month: month, cells: cells };
  }

  function fmtDate(d) {
    return d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0");
  }

  function isToday(d) {
    var t = new Date();
    return d.getFullYear() === t.getFullYear() && d.getMonth() === t.getMonth() && d.getDate() === t.getDate();
  }

  function formatWeekRange(days) {
    var first = days[0];
    var last = days[6];
    if (first.getMonth() === last.getMonth()) {
      return FULL_MONTHS[first.getMonth()] + " " + first.getDate() + " – " + last.getDate() + ", " + first.getFullYear();
    }
    return MONTHS[first.getMonth()] + " " + first.getDate() + " – " + MONTHS[last.getMonth()] + " " + last.getDate() + ", " + last.getFullYear();
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

  function renderItemChip(it) {
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
  }

  // Week view
  function renderWeekView() {
    var days = getWeekDays(weekOffset);

    var headEl = root.querySelector("[data-cc-main-head]");
    headEl.innerHTML =
      '<h2 class="cc-main-title">What\'s Happening This Week</h2>' +
      '<div class="cc-nav-row">' +
        '<div class="cc-week-nav">' +
          '<button type="button" class="cc-week-nav-btn" data-cc-prev>' +
            '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="15 18 9 12 15 6"></polyline></svg>' +
          '</button>' +
          '<button type="button" class="cc-week-nav-label" data-cc-today>This Week</button>' +
          '<button type="button" class="cc-week-nav-btn" data-cc-next>' +
            '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="9 18 15 12 9 6"></polyline></svg>' +
          '</button>' +
          '<span class="cc-week-nav-range">' + formatWeekRange(days) + '</span>' +
        '</div>' +
        '<div class="cc-view-toggle">' +
          '<button type="button" class="cc-view-btn is-active" data-cc-set-view="week">Week</button>' +
          '<button type="button" class="cc-view-btn" data-cc-set-view="month">Month</button>' +
        '</div>' +
      '</div>';

    var container = root.querySelector("[data-cc-days]");
    container.className = "cc-days";
    container.innerHTML = days.map(function (d) {
      var dateStr = fmtDate(d);
      var today = isToday(d);
      var dayItems = data.items.filter(function (it) {
        return it.date === dateStr && matchesFilters(it);
      });

      var itemsHtml = "";
      if (dayItems.length === 0) {
        itemsHtml = '<p class="cc-day-empty">Nothing scheduled</p>';
      } else {
        itemsHtml = dayItems.map(renderItemChip).join("");
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

  // Month view
  function renderMonthView() {
    var m = getMonthDays(monthOffset);

    var headEl = root.querySelector("[data-cc-main-head]");
    headEl.innerHTML =
      '<h2 class="cc-main-title">' + FULL_MONTHS[m.month] + ' ' + m.year + '</h2>' +
      '<div class="cc-nav-row">' +
        '<div class="cc-week-nav">' +
          '<button type="button" class="cc-week-nav-btn" data-cc-prev>' +
            '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="15 18 9 12 15 6"></polyline></svg>' +
          '</button>' +
          '<button type="button" class="cc-week-nav-label" data-cc-today>This Month</button>' +
          '<button type="button" class="cc-week-nav-btn" data-cc-next>' +
            '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="9 18 15 12 9 6"></polyline></svg>' +
          '</button>' +
        '</div>' +
        '<div class="cc-view-toggle">' +
          '<button type="button" class="cc-view-btn" data-cc-set-view="week">Week</button>' +
          '<button type="button" class="cc-view-btn is-active" data-cc-set-view="month">Month</button>' +
        '</div>' +
      '</div>';

    var container = root.querySelector("[data-cc-days]");
    container.className = "cc-days cc-month-grid";

    var headerRow = '<div class="cc-month-header">' +
      DAYS_SHORT.map(function (d, i) {
        var idx = (i + 1) % 7;
        return '<div class="cc-month-header-cell">' + DAYS_SHORT[idx === 0 ? 0 : idx] + '</div>';
      }).join("") + '</div>';

    var weeks = [];
    for (var w = 0; w < 6; w++) {
      var cells = [];
      for (var d = 0; d < 7; d++) {
        var cell = m.cells[w * 7 + d];
        var dateStr = fmtDate(cell);
        var today = isToday(cell);
        var isCurrentMonth = cell.getMonth() === m.month;
        var dayItems = data.items.filter(function (it) {
          return it.date === dateStr && matchesFilters(it);
        });

        var itemDots = dayItems.slice(0, 4).map(function (it) {
          var proj = data.projects.find(function (p) { return p.id === it.project; });
          var col = proj ? proj.color : "#9a8773";
          return '<span class="cc-mcell-dot" style="background:' + col + '" title="' + escAttr(it.title) + '"></span>';
        }).join("");
        if (dayItems.length > 4) {
          itemDots += '<span class="cc-mcell-more">+' + (dayItems.length - 4) + '</span>';
        }

        var itemList = dayItems.map(function (it) {
          var proj = data.projects.find(function (p) { return p.id === it.project; });
          var col = proj ? proj.color : "#9a8773";
          return '<div class="cc-mcell-item" data-cc-item-id="' + it.id + '">' +
            '<span class="cc-item-dot" style="background:' + col + '"></span>' +
            '<span class="cc-mcell-item-title">' + esc(it.title) + '</span>' +
          '</div>';
        }).join("");

        cells.push(
          '<div class="cc-month-cell' + (today ? ' is-today' : '') + (!isCurrentMonth ? ' is-other-month' : '') + '" data-cc-cell-date="' + dateStr + '">' +
            '<div class="cc-mcell-head">' +
              '<span class="cc-mcell-date">' + cell.getDate() + '</span>' +
              (today ? '<span class="cc-mcell-today">Today</span>' : '') +
              '<button type="button" class="cc-mcell-add" data-cc-add-item="' + dateStr + '">+</button>' +
            '</div>' +
            '<div class="cc-mcell-items">' + itemList + '</div>' +
          '</div>'
        );
      }
      weeks.push('<div class="cc-month-row">' + cells.join("") + '</div>');
    }

    var headerCells = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].map(function (d) {
      return '<div class="cc-month-header-cell">' + d + '</div>';
    }).join("");

    container.innerHTML =
      '<div class="cc-month-header">' + headerCells + '</div>' +
      weeks.join("");
  }

  function renderCalendar() {
    if (viewMode === "month") {
      renderMonthView();
    } else {
      renderWeekView();
    }
  }

  // Filter dropdowns
  function closeAllDropdowns() {
    root.querySelectorAll(".cc-filter-dropdown").forEach(function (d) { d.classList.remove("is-open"); });
  }

  function renderFilterDropdown(filterKey) {
    var dd = root.querySelector('[data-cc-filter="' + filterKey + '"] .cc-filter-dropdown');
    var options = [];

    if (filterKey === "project") {
      options = data.projects.map(function (p) { return { label: p.name, value: p.id }; });
    } else if (filterKey === "type") {
      options = CONTENT_TYPES.map(function (t) { return { label: t, value: t }; });
    } else if (filterKey === "person") {
      options = data.people.map(function (p) { return { label: p, value: p }; });
    } else if (filterKey === "status") {
      options = STATUS_OPTIONS.map(function (s) { return { label: s, value: s }; });
    }

    var current = activeFilters[filterKey];
    dd.innerHTML = '<button type="button" class="cc-filter-option' + (!current ? ' is-active' : '') + '" data-cc-filter-val="">All</button>' +
      options.map(function (o) {
        var cls = current === o.value ? " is-active" : "";
        return '<button type="button" class="cc-filter-option' + cls + '" data-cc-filter-val="' + esc(o.value) + '">' + esc(o.label) + '</button>';
      }).join("");
  }

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
    if (activeProject) overlay.querySelector("[data-cc-modal-project]").value = activeProject;

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

    // View toggle
    btn = e.target.closest("[data-cc-set-view]");
    if (btn) {
      var newView = btn.dataset.ccSetView;
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
      data.items = data.items.filter(function (it) { return it.id !== btn.dataset.ccRemoveItem; });
      save(data);
      renderCalendar();
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
      var filterEl = btn.closest(".cc-filter");
      var dd = filterEl.querySelector(".cc-filter-dropdown");
      var wasOpen = dd.classList.contains("is-open");
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
      var filterParent = btn.closest(".cc-filter");
      var filterKey = filterParent.dataset.ccFilter;
      var val = btn.dataset.ccFilterVal;
      activeFilters[filterKey] = val || null;
      closeAllDropdowns();

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
    if (e.target.closest("[data-cc-add-project]")) { showAddProjectModal(); return; }
    if (e.target.closest("[data-cc-settings]")) { showSettingsModal(); return; }

    // Close dropdowns on outside click
    if (!e.target.closest(".cc-filter")) closeAllDropdowns();
  });

  // Double-click to edit
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

  renderSidebar();
  renderCalendar();
})();
