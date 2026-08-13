/*
 * Generic admin data-table loader. Drives every /admin/<section>/ page
 * that needs to render a worker-backed list with a CSV download.
 *
 * Auth: requires window.MOAuth (admin-auth.js) to be loaded first.
 * Each fetch carries Authorization: Bearer <ghost-identity-jwt>; the
 * worker verifies the JWT signature against Ghost's JWKS and only
 * then checks the email against ADMIN_EMAILS. The CSV download path
 * uses a fetch+blob shim (anchors can't send custom headers).
 *
 * Markup contract (single host element with data-admin-table):
 *   data-endpoint           Worker path — e.g. /api/admin/addresses
 *   data-collection         Key in the JSON response — e.g. "addresses"
 *   data-api-base           @custom.membership_api_base
 *   data-columns            Comma-separated field names (render order)
 *   data-column-labels      Comma-separated header labels (same order)
 *   data-link-column        (Optional) Field whose cell becomes a link
 *   data-link-template      (Optional) URL template; {field} gets
 *                           replaced with row[field]. Used with
 *                           data-link-column to drill into a detail page.
 *   data-search             (Optional) "1" to show a filter box. Matches
 *                           across every rendered column plus email.
 *   data-edit-endpoint      (Optional) Worker path taking a PUT of the
 *                           edited row. Presence of this attribute is
 *                           what turns editing on.
 *   data-edit-fields        (Optional) Comma-separated editable field
 *                           names. Anything outside this list is shown
 *                           read-only in the form.
 *   data-edit-key           (Optional) Identifying field sent with every
 *                           edit, default "email".
 *
 * Sorting is always on: click any header. It sorts the rows already
 * fetched, so it is instant and needs no worker support.
 */
(() => {
  const host = document.querySelector('[data-admin-table]');
  if (!host) return;

  const apiBase = (host.dataset.apiBase || '').replace(/\/$/, '');
  const {endpoint} = host.dataset;
  const {collection} = host.dataset;
  const columns = (host.dataset.columns || '').split(',').map((s) => s.trim()).filter(Boolean);
  const labels = (host.dataset.columnLabels || '').split(',').map((s) => s.trim()).filter(Boolean);
  const linkColumn = host.dataset.linkColumn || '';
  const linkTemplate = host.dataset.linkTemplate || '';
  const searchOn = host.dataset.search === '1';
  const editEndpoint = host.dataset.editEndpoint || '';
  const editFields = (host.dataset.editFields || '').split(',').map((s2) => s2.trim()).filter(Boolean);
  const editKey = host.dataset.editKey || 'email';

  let allRows = [];
  let sortKey = '';
  let sortDir = 'asc';
  let query = '';

  const statusEl = host.querySelector('[data-status]');
  const countEl = host.querySelector('[data-count-label]');
  const downloadEl = host.querySelector('[data-download-csv]');
  const tableEl = host.querySelector('[data-table]');
  const theadRow = host.querySelector('[data-thead]');
  const tbody = host.querySelector('[data-tbody]');

  if (!apiBase || !endpoint || !collection) {
    setStatus('Admin is not configured — missing api base or endpoint.');
    return;
  }

  // Render headers up front. Every one sorts.
  labels.forEach((label, i) => {
    const th = document.createElement('th');
    th.textContent = label;
    const key = columns[i];
    if (key) {
      th.dataset.sortKey = key;
      th.tabIndex = 0;
      const go = () => {
        if (sortKey === key) sortDir = sortDir === 'asc' ? 'desc' : 'asc';
        else { sortKey = key; sortDir = 'asc'; }
        paint();
      };
      th.addEventListener('click', go);
      th.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); go(); }
      });
    }
    theadRow.appendChild(th);
  });
  if (editEndpoint) {
    const th = document.createElement('th');
    th.innerHTML = '<span class="visually-hidden">Actions</span>';
    theadRow.appendChild(th);
  }

  // Filter box, injected next to the row count so the markup contract
  // stays a single host element.
  let searchInput = null;
  if (searchOn) {
    const wrap = document.createElement('div');
    wrap.className = 'admin-table-search';
    searchInput = document.createElement('input');
    searchInput.type = 'search';
    searchInput.placeholder = 'Search…';
    searchInput.setAttribute('aria-label', 'Search rows');
    searchInput.addEventListener('input', () => { query = searchInput.value.trim().toLowerCase(); paint(); });
    wrap.appendChild(searchInput);
    const toolbar = host.querySelector('.admin-table-toolbar');
    if (toolbar) toolbar.insertBefore(wrap, toolbar.firstChild);
  }

  if (editEndpoint) {
    const toolbar = host.querySelector('.admin-table-toolbar');
    if (toolbar) {
      const add = document.createElement('button');
      add.type = 'button';
      add.className = 'btn btn-primary btn-sm';
      add.textContent = 'Add address';
      // A blank row: the editor treats a row with no key as a create,
      // which POSTs instead of PUTs.
      add.addEventListener('click', () => openEditor({}, true));
      toolbar.appendChild(add);
    }
  }

  (async () => {
    try {
      const res = await window.MOAuth.fetch(apiBase + endpoint, { credentials: 'omit' });
      if (res.status === 401) { setStatus('Sign in required.'); return; }
      if (res.status === 403) { setStatus('Forbidden — your email is not in the admin list.'); return; }
      if (!res.ok) { setStatus(`Could not load data. (${res.status})`); return; }
      const body = await res.json();
      allRows = body[collection] || [];
      render(allRows, body.count);
    } catch (err) {
      console.error('admin-table fetch failed', err);
      setStatus('Network error loading data.');
    }
  })();

  function setStatus(msg) {
    statusEl.textContent = msg;
    countEl.textContent = '';
  }

  function render(rows, count) {
    statusEl.textContent = '';
    countEl.textContent = `${count ?? rows.length} row${rows.length === 1 ? '' : 's'}`;
    downloadEl.hidden = false;
    // Anchors can't send custom headers, so the Download button does
    // a fetch with the bearer token, blob-converts the response, and
    // triggers a synthetic <a> click. Same auth path as the list view.
    downloadEl.href = '#';
    downloadEl.addEventListener('click', async (ev) => {
      ev.preventDefault();
      try {
        const r = await window.MOAuth.fetch(`${apiBase + endpoint}?format=csv`);
        if (!r.ok) return setStatus(`CSV download failed: ${r.status}`);
        const blob = await r.blob();
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `${endpoint.split('/').pop() || 'data'}-${new Date().toISOString().slice(0, 10)}.csv`;
        document.body.appendChild(a);
        a.click();
        a.remove();
        URL.revokeObjectURL(url);
      } catch (err) {
        console.error(err);
        setStatus('CSV download failed.');
      }
    }, { once: false });

    tableEl.hidden = false;
    paint();
  }

  // Filter, then sort, then draw. Both operate on the rows already
  // fetched, so neither needs the worker.
  function visibleRows() {
    let out = allRows;
    if (query) {
      out = out.filter((row) => columns.concat([editKey]).some((c) => {
        const v = row[c];
        return v !== null && v !== undefined && String(v).toLowerCase().includes(query);
      }));
    }
    if (sortKey) {
      const dir = sortDir === 'asc' ? 1 : -1;
      out = out.slice().sort((a, b) => {
        const x = a[sortKey]; const y = b[sortKey];
        const xe = x === null || x === undefined || x === '';
        const ye = y === null || y === undefined || y === '';
        // Blanks sink in both directions: an empty cell is missing data,
        // not the smallest value.
        if (xe && ye) return 0;
        if (xe) return 1;
        if (ye) return -1;
        return String(x).localeCompare(String(y), undefined, {numeric: true, sensitivity: 'base'}) * dir;
      });
    }
    return out;
  }

  function paint() {
    theadRow.querySelectorAll('[data-sort-key]').forEach((th) => {
      const on = th.dataset.sortKey === sortKey;
      th.classList.toggle('is-sorted', on);
      th.classList.toggle('is-desc', on && sortDir === 'desc');
      th.setAttribute('aria-sort', on ? (sortDir === 'asc' ? 'ascending' : 'descending') : 'none');
    });

    const rows = visibleRows();
    countEl.textContent = `${rows.length} row${rows.length === 1 ? '' : 's'}${query ? ` matching “${query}”` : ''}`;
    tbody.textContent = '';

    if (!rows.length) {
      const tr = document.createElement('tr');
      const td = document.createElement('td');
      td.colSpan = columns.length + (editEndpoint ? 1 : 0);
      td.className = 'admin-table-empty';
      td.textContent = query ? 'Nothing matches that search.' : 'No rows yet.';
      tr.appendChild(td);
      tbody.appendChild(tr);
      return;
    }

    rows.forEach((row) => {
      const tr = document.createElement('tr');
      columns.forEach((col) => {
        const td = document.createElement('td');
        const v = row[col];
        const text = v === null || v === undefined ? '' : String(v);
        if (col === linkColumn && linkTemplate && text) {
          const a = document.createElement('a');
          a.className = 'admin-table-link';
          a.href = linkTemplate.replace(/\{(\w+)\}/g, (_, key) => {
            const val = row[key];
            return val === null || val === undefined ? '' : encodeURIComponent(String(val));
          });
          a.textContent = text;
          td.appendChild(a);
        } else {
          td.textContent = text;
        }
        tr.appendChild(td);
      });
      if (editEndpoint) {
        const td = document.createElement('td');
        td.className = 'admin-table-actions';
        const b = document.createElement('button');
        b.type = 'button';
        b.className = 'btn btn-ghost btn-sm';
        b.textContent = 'Edit';
        b.addEventListener('click', () => openEditor(row));
        td.appendChild(b);
        const del = document.createElement('button');
        del.type = 'button';
        del.className = 'btn btn-ghost btn-sm admin-table-danger';
        del.textContent = 'Delete';
        del.addEventListener('click', () => confirmDelete(row, del));
        td.appendChild(del);
        tr.appendChild(td);
      }
      tbody.appendChild(tr);
    });
  }

  /*
   * Delete, confirmed on the button rather than in a window.confirm.
   * First click arms it, second click within 4 seconds does it, and it
   * disarms itself if you walk away. No modal for a one-row action.
   */
  function confirmDelete(row, btn) {
    if (btn.dataset.armed !== '1') {
      btn.dataset.armed = '1';
      const prev = btn.textContent;
      btn.textContent = 'Delete — sure?';
      setTimeout(() => {
        if (btn.dataset.armed === '1') { btn.dataset.armed = ''; btn.textContent = prev; }
      }, 4000);
      return;
    }
    btn.dataset.armed = '';
    btn.disabled = true;
    btn.textContent = 'Deleting…';
    window.MOAuth.fetch(apiBase + editEndpoint, {
      method: 'DELETE',
      headers: {'content-type': 'application/json'},
      body: JSON.stringify({[editKey]: row[editKey]}),
    }).then(async (r) => {
      const out = await r.json().catch(() => ({}));
      if (!r.ok) {
        setStatus(out.error ? `Delete failed: ${out.error}` : `Delete failed (${r.status}).`);
        btn.disabled = false;
        btn.textContent = 'Delete';
        return;
      }
      allRows = allRows.filter((x) => x[editKey] !== row[editKey]);
      paint();
    }).catch((err) => {
      console.error(err);
      setStatus('Network error while deleting.');
      btn.disabled = false;
      btn.textContent = 'Delete';
    });
  }

  // ---- Editing -----------------------------------------------------
  //
  // Built with createElement throughout: every value here is member-
  // entered text coming back from the worker.
  function openEditor(row, isNew) {
    const existing = document.querySelector('[data-admin-edit]');
    if (existing) existing.remove();

    const back = document.createElement('div');
    back.className = 'admin-edit-backdrop';
    back.setAttribute('data-admin-edit', '');

    const form = document.createElement('form');
    form.className = 'admin-edit-panel';
    form.setAttribute('role', 'dialog');
    form.setAttribute('aria-modal', 'true');
    form.setAttribute('aria-label', 'Edit row');

    const head = document.createElement('div');
    head.className = 'admin-edit-head';
    const h = document.createElement('h2');
    h.className = 'admin-edit-title';
    h.textContent = isNew ? 'Add address' : 'Edit address';
    const who = document.createElement('p');
    who.className = 'admin-edit-sub';
    who.textContent = isNew ? 'Enter the member\u2019s email, then their address.' : String(row[editKey] || '');
    head.appendChild(h);
    head.appendChild(who);
    form.appendChild(head);

    const grid = document.createElement('div');
    grid.className = 'admin-edit-grid';
    const inputs = {};

    // Creating needs the identifying field; editing must never let it be
    // changed, or the save would silently write to a different member.
    let keyInput = null;
    if (isNew) {
      const wrap = document.createElement('label');
      wrap.className = 'admin-edit-field admin-edit-field--wide';
      const lab = document.createElement('span');
      lab.className = 'admin-edit-label';
      lab.textContent = 'Member email (must already exist in Ghost)';
      keyInput = document.createElement('input');
      keyInput.type = 'email';
      keyInput.required = true;
      setTimeout(() => keyInput.focus(), 0);
      wrap.appendChild(lab);
      wrap.appendChild(keyInput);
      grid.appendChild(wrap);
    }
    (editFields.length ? editFields : columns).forEach((col, i) => {
      const wrap = document.createElement('label');
      wrap.className = 'admin-edit-field';
      const lab = document.createElement('span');
      lab.className = 'admin-edit-label';
      const idx = columns.indexOf(col);
      lab.textContent = idx >= 0 && labels[idx] ? labels[idx] : col;
      const inp = document.createElement('input');
      inp.type = 'text';
      inp.value = row[col] === null || row[col] === undefined ? '' : String(row[col]);
      inp.name = col;
      if (i === 0 && !isNew) setTimeout(() => inp.focus(), 0);
      inputs[col] = inp;
      wrap.appendChild(lab);
      wrap.appendChild(inp);
      grid.appendChild(wrap);
    });
    form.appendChild(grid);

    const msg = document.createElement('p');
    msg.className = 'admin-edit-msg';
    form.appendChild(msg);

    const actions = document.createElement('div');
    actions.className = 'admin-edit-actions';
    const save = document.createElement('button');
    save.type = 'submit';
    save.className = 'btn btn-primary btn-sm';
    save.textContent = 'Save changes';
    const cancel = document.createElement('button');
    cancel.type = 'button';
    cancel.className = 'btn btn-ghost btn-sm';
    cancel.textContent = 'Cancel';
    cancel.addEventListener('click', () => back.remove());
    actions.appendChild(save);
    actions.appendChild(cancel);
    form.appendChild(actions);

    form.addEventListener('submit', async (ev) => {
      ev.preventDefault();
      save.disabled = true;
      msg.textContent = 'Saving…';
      const keyValue = isNew ? (keyInput.value || '').trim().toLowerCase() : row[editKey];
      if (isNew && !keyValue) { msg.textContent = 'A member email is required.'; save.disabled = false; return; }
      const payload = {[editKey]: keyValue};
      Object.keys(inputs).forEach((k) => { payload[k] = inputs[k].value.trim(); });
      try {
        const r = await window.MOAuth.fetch(apiBase + editEndpoint, {
          method: isNew ? 'POST' : 'PUT',
          headers: {'content-type': 'application/json'},
          body: JSON.stringify(payload),
        });
        const out = await r.json().catch(() => ({}));
        if (!r.ok) {
          // Show the worker's own message. A bare status code sends
          // whoever hits this straight to devtools for no reason.
          msg.textContent = out.error ? `${out.error} (${r.status})` : `Save failed (${r.status}).`;
          console.error('admin-table save failed', r.status, out);
          save.disabled = false;
          return;
        }
        // Update the row in place so the table reflects the edit without
        // a full refetch losing the current sort and search.
        const updated = out.address || payload;
        const i = allRows.findIndex((x) => x[editKey] === keyValue);
        if (i >= 0) allRows[i] = {...allRows[i], ...updated};
        else allRows.unshift(updated);
        back.remove();
        paint();
      } catch (err) {
        console.error(err);
        msg.textContent = 'Network error while saving.';
        save.disabled = false;
      }
    });

    back.addEventListener('click', (e) => { if (e.target === back) back.remove(); });
    document.addEventListener('keydown', function esc(e) {
      if (e.key === 'Escape') { back.remove(); document.removeEventListener('keydown', esc); }
    });
    back.appendChild(form);
    document.body.appendChild(back);
  }
})();
