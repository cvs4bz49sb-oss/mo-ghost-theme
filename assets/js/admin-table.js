/*
 * Generic admin data-table loader. Drives every /admin/<section>/ page
 * that needs to render a worker-backed list with a CSV download.
 *
 * Auth: requires window.MOAdminAuth (admin-auth.js) to be loaded first.
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
 */
(() => {
  const host = document.querySelector('[data-admin-table]');
  if (!host) return;

  const apiBase = (host.dataset.apiBase || '').replace(/\/$/, '');
  const endpoint = host.dataset.endpoint;
  const collection = host.dataset.collection;
  const columns = (host.dataset.columns || '').split(',').map((s) => s.trim()).filter(Boolean);
  const labels = (host.dataset.columnLabels || '').split(',').map((s) => s.trim()).filter(Boolean);

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

  // Render headers up front.
  labels.forEach((label) => {
    const th = document.createElement('th');
    th.textContent = label;
    theadRow.appendChild(th);
  });

  (async () => {
    try {
      const headers = await window.MOAdminAuth.headers();
      const res = await fetch(apiBase + endpoint, { headers, credentials: 'omit' });
      if (res.status === 401) { setStatus('Sign in required.'); return; }
      if (res.status === 403) { setStatus('Forbidden — your email is not in the admin list.'); return; }
      if (!res.ok) { setStatus('Could not load data. (' + res.status + ')'); return; }
      const body = await res.json();
      render(body[collection] || [], body.count);
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
        const headers = await window.MOAdminAuth.headers();
        const r = await fetch(apiBase + endpoint + '?format=csv', { headers });
        if (!r.ok) return setStatus('CSV download failed: ' + r.status);
        const blob = await r.blob();
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = (endpoint.split('/').pop() || 'data') + '-' + new Date().toISOString().slice(0, 10) + '.csv';
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
    if (!rows.length) {
      const tr = document.createElement('tr');
      const td = document.createElement('td');
      td.colSpan = columns.length;
      td.className = 'admin-table-empty';
      td.textContent = 'No rows yet.';
      tr.appendChild(td);
      tbody.appendChild(tr);
      return;
    }
    rows.forEach((row) => {
      const tr = document.createElement('tr');
      columns.forEach((col) => {
        const td = document.createElement('td');
        const v = row[col];
        td.textContent = v === null || v === undefined ? '' : String(v);
        tr.appendChild(td);
      });
      tbody.appendChild(tr);
    });
  }
})();
