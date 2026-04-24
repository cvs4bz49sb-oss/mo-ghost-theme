/*
 * Generic admin data-table loader. Drives every /admin/<section>/ page
 * that needs to render a worker-backed list with a CSV download.
 *
 * Markup contract (single host element with data-admin-table):
 *   data-endpoint           Worker path — e.g. /api/admin/addresses
 *   data-collection         Key in the JSON response — e.g. "addresses"
 *   data-api-base           @custom.membership_api_base
 *   data-member-email       @member.email (passed as X-Admin-Email)
 *   data-columns            Comma-separated field names (render order)
 *   data-column-labels      Comma-separated header labels (same order)
 *
 * Inside the host:
 *   [data-status]           Status / error message element
 *   [data-count-label]      Row count eyebrow
 *   [data-download-csv]     Anchor that becomes the CSV download link
 *   [data-table]            The <table> element (starts hidden)
 *   [data-thead]            <tr> inside thead — labels injected here
 *   [data-tbody]            <tbody> — rows injected here
 *
 * Worker returns { <collection>: [...rows], count: N } on success or
 * 403 on non-admin. CSV is the same endpoint with ?format=csv.
 */
(() => {
  const host = document.querySelector('[data-admin-table]');
  if (!host) return;

  const apiBase = (host.dataset.apiBase || '').replace(/\/$/, '');
  const email = (host.dataset.memberEmail || '').trim();
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

  if (!apiBase || !email || !endpoint || !collection) {
    setStatus('Admin is not configured — missing api base or member email.');
    return;
  }

  // Render headers up front.
  labels.forEach((label) => {
    const th = document.createElement('th');
    th.textContent = label;
    theadRow.appendChild(th);
  });

  fetch(apiBase + endpoint, {
    headers: { 'X-Admin-Email': email },
    credentials: 'omit',
  })
    .then(async (res) => {
      if (res.status === 403) { setStatus('Forbidden — your email is not in the admin list.'); return; }
      if (!res.ok) { setStatus('Could not load data. (' + res.status + ')'); return; }
      const body = await res.json();
      render(body[collection] || [], body.count);
    })
    .catch((err) => {
      console.error('admin-table fetch failed', err);
      setStatus('Network error loading data.');
    });

  function setStatus(msg) {
    statusEl.textContent = msg;
    countEl.textContent = '';
  }

  function render(rows, count) {
    statusEl.textContent = '';
    countEl.textContent = `${count ?? rows.length} row${rows.length === 1 ? '' : 's'}`;
    downloadEl.hidden = false;
    downloadEl.href = apiBase + endpoint + '?format=csv&admin=' + encodeURIComponent(email);
    // Also tack the admin email as an X-Admin-Email via a tiny GET+blob
    // shim so the Download button works without header-injection (anchor
    // <a> can't send custom headers). Worker accepts either header or
    // ?admin= query param.
    downloadEl.addEventListener('click', async (ev) => {
      ev.preventDefault();
      try {
        const r = await fetch(apiBase + endpoint + '?format=csv', {
          headers: { 'X-Admin-Email': email },
        });
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
