/*
 * /admin/members/migrations/ hydration.
 *
 * Reads the mo-membership API base from the [data-migrations] host,
 * fetches GET /api/admin/migrations, and renders the table. Each
 * row has a status <select> (pending / cancelled / no_action) and
 * a delete button. Status changes save optimistically.
 */
(function () {
  var root = document.querySelector("[data-migrations]");
  if (!root) return;

  var apiBase = (root.getAttribute("data-api-base") || "").trim().replace(/\/$/, "");
  var statusEl = root.querySelector("[data-migrations-status]");
  var tableEl = root.querySelector("[data-migrations-table]");
  var tbodyEl = root.querySelector("[data-migrations-tbody]");
  var emptyEl = root.querySelector("[data-migrations-empty]");

  if (!apiBase) {
    setStatus("Membership API base URL is not configured.");
    return;
  }

  load();

  function load() {
    window.MOAdminAuth.headers()
      .then(function (headers) {
        return fetch(apiBase + "/api/admin/migrations", { headers: headers, credentials: "omit" });
      })
      .then(function (res) {
        if (res.status === 401 || res.status === 403) {
          setStatus("Forbidden — your account isn't on the staff list.");
          return null;
        }
        if (!res.ok) {
          setStatus("Couldn't load migration requests (" + res.status + ").");
          return null;
        }
        return res.json();
      })
      .then(function (data) {
        if (!data) return;
        render(data.migrations || []);
      })
      .catch(function (err) {
        console.error("migrations fetch failed", err);
        setStatus("Network error loading migration requests.");
      });
  }

  function render(rows) {
    fillStats(rows);

    if (!rows.length) {
      setStatus("");
      if (tableEl) tableEl.hidden = true;
      if (emptyEl) emptyEl.hidden = false;
      return;
    }

    setStatus("");
    if (emptyEl) emptyEl.hidden = true;
    if (tableEl) tableEl.hidden = false;
    tbodyEl.innerHTML = "";
    rows.forEach(function (row) { tbodyEl.appendChild(buildRow(row)); });
  }

  function fillStats(rows) {
    var counts = { pending: 0, cancelled: 0, no_action: 0 };
    rows.forEach(function (r) { if (counts.hasOwnProperty(r.status)) counts[r.status] += 1; });
    setStat("pending", counts.pending);
    setStat("cancelled", counts.cancelled);
    setStat("no_action", counts.no_action);
    setStat("total", rows.length);
  }

  function setStat(key, val) {
    var el = root.querySelector('[data-stat="' + key + '"]');
    if (el) el.textContent = String(val);
  }

  function buildRow(row) {
    var tr = document.createElement("tr");
    tr.setAttribute("data-row-id", String(row.id));

    tr.appendChild(td(escapeHtml((row.first_name || "") + " " + (row.last_name || "")).trim()));
    tr.appendChild(td('<a href="mailto:' + escapeAttr(row.email) + '">' + escapeHtml(row.email) + "</a>", true));
    tr.appendChild(td(row.started_new ? '<span class="pill pill-good">Yes</span>' : '<span class="pill pill-muted">No</span>', true));

    var statusCell = document.createElement("td");
    statusCell.appendChild(buildStatusSelect(row));
    tr.appendChild(statusCell);

    tr.appendChild(td(escapeHtml(formatDate(row.created_at))));

    var actionCell = document.createElement("td");
    actionCell.className = "admin-migrations-actions";
    if (row.status === "pending") {
      actionCell.appendChild(buildDoneBtn(row));
    }
    actionCell.appendChild(buildDeleteBtn(row));
    tr.appendChild(actionCell);

    return tr;
  }

  function buildDoneBtn(row) {
    var btn = document.createElement("button");
    btn.type = "button";
    btn.className = "admin-migrations-done";
    btn.textContent = "Mark Done";
    btn.title = "Set status to Done (HubSpot membership cancelled)";
    btn.addEventListener("click", function () {
      btn.disabled = true;
      window.MOAdminAuth.headers({ "Content-Type": "application/json" })
        .then(function (headers) {
          return fetch(apiBase + "/api/admin/migrations/" + row.id + "/status", {
            method: "POST",
            headers: headers,
            credentials: "omit",
            body: JSON.stringify({ status: "cancelled" }),
          });
        })
        .then(function (res) {
          if (!res.ok) {
            btn.disabled = false;
            alert("Couldn't mark done (" + res.status + ").");
            return;
          }
          load();
        })
        .catch(function () {
          btn.disabled = false;
          alert("Network error marking done.");
        });
    });
    return btn;
  }

  function buildStatusSelect(row) {
    var sel = document.createElement("select");
    sel.className = "admin-migrations-status-select";
    [["pending", "Pending"], ["cancelled", "Done"], ["no_action", "No action"]].forEach(function (opt) {
      var o = document.createElement("option");
      o.value = opt[0];
      o.textContent = opt[1];
      if (row.status === opt[0]) o.selected = true;
      sel.appendChild(o);
    });
    sel.addEventListener("change", function () { updateStatus(row, sel.value, sel); });
    return sel;
  }

  function buildDeleteBtn(row) {
    var btn = document.createElement("button");
    btn.type = "button";
    btn.className = "admin-migrations-delete";
    btn.textContent = "Delete";
    btn.title = "Remove this row from the database";
    btn.addEventListener("click", function () { deleteRow(row, btn); });
    return btn;
  }

  function updateStatus(row, next, sel) {
    var prev = row.status;
    row.status = next;
    sel.disabled = true;

    window.MOAdminAuth.headers({ "Content-Type": "application/json" })
      .then(function (headers) {
        return fetch(apiBase + "/api/admin/migrations/" + row.id + "/status", {
          method: "POST",
          headers: headers,
          credentials: "omit",
          body: JSON.stringify({ status: next }),
        });
      })
      .then(function (res) {
        sel.disabled = false;
        if (!res.ok) {
          row.status = prev;
          sel.value = prev;
          alert("Couldn't update status (" + res.status + ").");
          return;
        }
        // Refresh stats
        load();
      })
      .catch(function () {
        sel.disabled = false;
        row.status = prev;
        sel.value = prev;
        alert("Network error updating status.");
      });
  }

  function deleteRow(row, btn) {
    if (!window.confirm("Delete this migration request? This can't be undone.")) return;
    btn.disabled = true;

    window.MOAdminAuth.headers()
      .then(function (headers) {
        return fetch(apiBase + "/api/admin/migrations/" + row.id, {
          method: "DELETE",
          headers: headers,
          credentials: "omit",
        });
      })
      .then(function (res) {
        if (!res.ok) {
          btn.disabled = false;
          alert("Couldn't delete (" + res.status + ").");
          return;
        }
        var tr = tbodyEl.querySelector('[data-row-id="' + row.id + '"]');
        if (tr) tr.remove();
        // Refresh stats
        load();
      })
      .catch(function () {
        btn.disabled = false;
        alert("Network error deleting row.");
      });
  }

  function setStatus(msg) {
    if (statusEl) statusEl.textContent = msg;
  }

  function td(content, isHtml) {
    var cell = document.createElement("td");
    if (isHtml) cell.innerHTML = content;
    else cell.textContent = content;
    return cell;
  }

  function formatDate(iso) {
    if (!iso) return "";
    var d = new Date(iso.indexOf("T") > -1 ? iso : iso.replace(" ", "T") + "Z");
    if (isNaN(d.getTime())) return iso;
    return d.toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" });
  }

  function escapeHtml(s) {
    return String(s == null ? "" : s)
      .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;").replace(/'/g, "&#39;");
  }
  function escapeAttr(s) { return escapeHtml(s); }
})();
