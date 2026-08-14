/*
 * /admin/events/ — forum registrations, live.
 *
 * Reads mo-membership GET /api/admin/events (see lib/admin-data.js)
 * and repaints on a timer so a roster left open on a second screen
 * stays current while people sign up.
 *
 * Auth: window.MOAuth (admin-auth.js) must load first. Every request
 * carries the Ghost staff identity JWT; the worker verifies it against
 * Ghost's JWKS and checks the email against the live staff list.
 *
 * Polling rules, so this is cheap enough to leave open all day:
 *   - 20s while the tab is visible.
 *   - Nothing at all while it is hidden. A backgrounded tab polling a
 *     Ghost-backed endpoint for eight hours is pure waste.
 *   - An immediate refresh when it becomes visible again, so coming
 *     back to the tab never shows a stale list.
 *   - Backs off to a minute after repeated failures, and says so.
 */
(() => {
  const root = document.querySelector('[data-admin-events]');
  if (!root) return;

  const apiBase = (root.dataset.apiBase || '').replace(/\/$/, '');
  const ENDPOINT = '/api/admin/events';
  const POLL_MS = 20000;
  const BACKOFF_MS = 60000;

  const liveEl = root.querySelector('[data-live-label]');
  const srEl = root.querySelector('[data-live-sr]');
  const statusEl = root.querySelector('[data-status]');
  const cardsEl = root.querySelector('[data-event-cards]');
  const wrapEl = root.querySelector('[data-table-wrap]');
  const titleEl = root.querySelector('[data-table-title]');
  const tbody = root.querySelector('[data-tbody]');
  const emptyEl = root.querySelector('[data-empty]');
  const searchEl = root.querySelector('[data-search]');
  const refreshEl = root.querySelector('[data-refresh]');
  const downloadEl = root.querySelector('[data-download-csv]');

  let rows = [];
  let events = [];
  let contactsResolved = true;
  let selectedSlug = '';
  let query = '';
  let lastLoadedAt = 0;
  let failures = 0;
  let timer = null;
  let tickTimer = null;
  // AbortController for the request in progress; null when idle.
  let inflight = null;
  // Set on an auth verdict. Only a page reload clears it.
  let stopped = false;

  if (!apiBase) {
    statusEl.textContent = 'Admin is not configured: membership_api_base is empty.';
    liveEl.textContent = '';
    return;
  }
  // admin-auth.js is a separate tag above this one. If it failed to
  // load, every fetch below would throw a TypeError that reads as a
  // network error and sends someone hunting the wrong problem.
  if (!window.MOAuth || typeof window.MOAuth.fetch !== 'function') {
    statusEl.textContent = 'Admin auth failed to load. Reload the page.';
    liveEl.textContent = '';
    return;
  }

  searchEl.addEventListener('input', () => {
    query = searchEl.value.trim().toLowerCase();
    paintTable();
  });
  refreshEl.addEventListener('click', () => load({ manual: true }));

  downloadEl.addEventListener('click', async (ev) => {
    ev.preventDefault();
    // An anchor can't carry the bearer token, so fetch it and hand the
    // browser a blob. Same auth path as the list itself.
    const qs = selectedSlug ? `?event=${encodeURIComponent(selectedSlug)}&format=csv` : '?format=csv';
    try {
      const res = await window.MOAuth.fetch(apiBase + ENDPOINT + qs);
      if (!res.ok) { statusEl.textContent = `CSV download failed (${res.status}).`; return; }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `mo-event-registrants-${new Date().toISOString().slice(0, 10)}.csv`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error('events CSV failed', err);
      statusEl.textContent = 'CSV download failed.';
    }
  });

  // Pause while hidden, catch up on return. The 5s floor stops rapid
  // tab-switching from bypassing the poll interval entirely.
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) {
      stopPolling();
      if (inflight) inflight.abort();
      return;
    }
    if (Date.now() - lastLoadedAt > 5000) load();
    startPolling();
  });

  load();
  startPolling();

  function startPolling() {
    stopPolling();
    if (stopped) return;
    timer = setInterval(load, failures ? BACKOFF_MS : POLL_MS);
    // The ticker belongs to the same lifecycle: left running while
    // hidden it burns a wakeup a second for nothing, and started once
    // at boot it never comes back after a bfcache restore.
    tickTimer = setInterval(paintLive, 1000);
  }
  function stopPolling() {
    if (timer) { clearInterval(timer); timer = null; }
    if (tickTimer) { clearInterval(tickTimer); tickTimer = null; }
  }

  async function load(opts) {
    const manual = !!(opts && opts.manual);
    // The page is gone (admin-sidebar's blockPage replaces .admin-main),
    // or an auth verdict already settled it. Either way, stop.
    if (stopped || !root.isConnected) { stopPolling(); return; }
    // Without this, a hung worker stacks requests until something
    // gives, and `failures` never increments because nothing settles.
    if (inflight) return;
    inflight = new AbortController();
    if (manual) { statusEl.textContent = ''; refreshEl.disabled = true; refreshEl.textContent = 'Refreshing…'; }
    try {
      const res = await window.MOAuth.fetch(apiBase + ENDPOINT, { credentials: 'omit', signal: inflight.signal });
      // An auth verdict cannot change without a reload, so retrying it
      // every minute forever is noise. Say so once and stand down.
      if (res.status === 401) { halt('Sign in required. Reload the page.'); return; }
      if (res.status === 403) { halt('Forbidden: your Ghost account is not staff.'); return; }
      if (!res.ok) { fail(`Could not load registrations (${res.status}).`); return; }
      const body = await res.json();
      rows = body.registrants || [];
      events = body.events || [];
      contactsResolved = body.contacts_resolved !== false;
      lastLoadedAt = Date.now();
      if (failures) { failures = 0; startPolling(); }
      announceCount();
      statusEl.textContent = contactsResolved
        ? ''
        : 'Ghost is not answering, so the Already in Ghost? column is unavailable. Everything else is current.';
      paint();
    } catch (err) {
      if (err && err.name === 'AbortError') return;
      console.error('events load failed', err);
      fail('Network error loading registrations.');
    } finally {
      inflight = null;
      if (manual) { refreshEl.disabled = false; refreshEl.textContent = 'Refresh now'; }
    }
  }

  function halt(msg) {
    stopped = true;
    stopPolling();
    statusEl.textContent = msg;
    failures = 1;
    paintLive();
  }

  function fail(msg) {
    failures++;
    statusEl.textContent = failures > 1 ? `${msg} Retrying every minute.` : msg;
    // Slow down rather than hammering a worker that is already unhappy.
    if (failures === 1) startPolling();
    paintLive();
  }

  // Most polls bring back exactly what is already on screen. Repainting
  // anyway would throw away the focused element, any in-progress text
  // selection, and the scroll position of the table, every 20 seconds,
  // for nothing. So diff first and only touch the DOM when the data
  // actually moved.
  let lastSignature = '';

  function paint(opts) {
    const force = !!(opts && opts.force);
    const signature = JSON.stringify({ rows, events, contactsResolved, selectedSlug, query });
    if (!force && signature === lastSignature) { paintLive(); return; }
    lastSignature = signature;

    // Restore focus if a poll lands while someone is tabbed onto a card.
    const focusedSlug = document.activeElement
      && document.activeElement.classList
      && document.activeElement.classList.contains('admin-event-card')
      ? document.activeElement.dataset.slug
      : '';

    paintCards();
    // Rebuilding the tbody under someone who is mid-selection or
    // tabbing through it destroys both. When that's happening, hold
    // the new rows behind a button instead of yanking the table.
    if (tableBusy()) {
      pendingRows = true;
      paintPending();
    } else {
      pendingRows = false;
      paintPending();
      paintTable();
    }
    paintLive();
    const any = rows.length > 0;
    cardsEl.hidden = !any;
    wrapEl.hidden = !any;
    emptyEl.hidden = any;
    downloadEl.hidden = !any;

    if (focusedSlug) {
      const again = cardsEl.querySelector(`[data-slug="${CSS.escape(focusedSlug)}"]`);
      if (again) again.focus();
    }
  }

  // True while the user is interacting with the table itself.
  function tableBusy() {
    if (wrapEl.contains(document.activeElement) && document.activeElement !== document.body) return true;
    const sel = window.getSelection && window.getSelection();
    return !!(sel && !sel.isCollapsed && sel.anchorNode && wrapEl.contains(sel.anchorNode));
  }

  let pendingRows = false;
  function paintPending() {
    let btn = root.querySelector('[data-show-pending]');
    if (!pendingRows) { if (btn) btn.remove(); return; }
    if (btn) return;
    btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'admin-events-pending';
    btn.setAttribute('data-show-pending', '');
    btn.textContent = 'New registrations — show';
    btn.addEventListener('click', () => {
      pendingRows = false;
      paintPending();
      paintTable();
    });
    titleEl.insertAdjacentElement('afterend', btn);
  }

  function paintCards() {
    cardsEl.textContent = '';
    events.forEach((e) => {
      const card = document.createElement('button');
      card.type = 'button';
      card.className = 'admin-event-card';
      card.dataset.slug = e.slug;
      // The cards are a filter, so they are buttons in a toggle group
      // rather than decoration.
      const on = selectedSlug === e.slug;
      card.setAttribute('aria-pressed', on ? 'true' : 'false');
      card.classList.toggle('is-active', on);
      // Read selectedSlug at click time rather than closing over `on`:
      // a poll can repaint between render and click, and a stale
      // capture would toggle the wrong way.
      card.addEventListener('click', () => {
        selectedSlug = selectedSlug === e.slug ? '' : e.slug;
        paint();
      });

      const title = document.createElement('span');
      title.className = 'admin-event-card-title';
      title.textContent = e.title || e.slug;

      const count = document.createElement('span');
      count.className = 'admin-event-card-count';
      count.textContent = `${e.count} registered`;

      const split = document.createElement('span');
      split.className = 'admin-event-card-split';
      if (contactsResolved) {
        split.textContent = `${e.new_count} new · ${e.existing_count} existing`;
      } else {
        split.textContent = 'contact status unavailable';
      }

      const zoom = document.createElement('span');
      zoom.className = 'admin-event-card-zoom';
      // in_zoom counts rows Zoom actually accepted. Everything else is
      // held by us and still needs the link sent.
      zoom.textContent = e.in_zoom === e.count
        ? 'All in Zoom'
        : `${e.count - e.in_zoom} still need the Zoom link`;
      zoom.classList.toggle('is-warn', e.in_zoom !== e.count);

      card.append(title, count, split, zoom);
      cardsEl.appendChild(card);
    });
  }

  function visibleRows() {
    let out = rows;
    if (selectedSlug) out = out.filter((r) => r.event_slug === selectedSlug);
    if (query) {
      out = out.filter((r) => [r.first_name, r.last_name, r.email]
        .some((v) => String(v || '').toLowerCase().includes(query)));
    }
    return out;
  }

  function paintTable() {
    const list = visibleRows();
    const label = selectedSlug
      ? (events.find((e) => e.slug === selectedSlug) || {}).title || 'Registrants'
      : 'All registrants';
    titleEl.textContent = `${label} (${list.length})`;

    // Toggling the card off again is the only other way out of a
    // filter, and nothing on screen says so.
    const existingClear = root.querySelector('[data-clear-filter]');
    if (existingClear) existingClear.remove();
    if (selectedSlug) {
      const clear = document.createElement('button');
      clear.type = 'button';
      clear.className = 'admin-events-clear';
      clear.setAttribute('data-clear-filter', '');
      clear.textContent = 'Clear filter';
      clear.addEventListener('click', () => { selectedSlug = ''; paint({ force: true }); });
      titleEl.insertAdjacentElement('afterend', clear);
    }

    tbody.textContent = '';
    if (!list.length) {
      const tr = document.createElement('tr');
      const td = document.createElement('td');
      td.colSpan = 5;
      td.className = 'admin-table-empty';
      td.textContent = query ? 'Nothing matches that search.' : 'No registrants for this forum yet.';
      tr.appendChild(td);
      tbody.appendChild(tr);
      return;
    }

    list.forEach((r) => {
      const tr = document.createElement('tr');
      tr.appendChild(cell(`${r.first_name || ''} ${r.last_name || ''}`.trim()));

      tr.appendChild(emailCell(r.email));

      tr.appendChild(contactCell(r));
      tr.appendChild(cell(formatWhen(r.registered_at)));

      const zoomTd = document.createElement('td');
      const zoomBadge = document.createElement('span');
      const inZoom = r.registration === 'registered';
      zoomBadge.className = `admin-pill ${inZoom ? 'admin-pill--ok' : 'admin-pill--wait'}`;
      // "In Zoom" rather than "Registered": the column next door is
      // also called Registered and means a timestamp, and the flag
      // this reads is whether Zoom holds a seat.
      zoomBadge.textContent = inZoom ? 'In Zoom' : 'Not in Zoom';
      zoomTd.appendChild(zoomBadge);
      tr.appendChild(zoomTd);

      tbody.appendChild(tr);
    });
  }

  // Registrant addresses arrive from a public form. `mailto:` treats
  // everything after a ? as headers, so an address like
  // "victim@x.com?bcc=collector@evil.tld" would silently copy a third
  // party on a staff reply — and bcc isn't shown in most compose
  // windows. A literal scheme prefix makes an href inert as markup, not
  // as a command. Anything that isn't address-shaped renders as plain
  // text instead of a link.
  const MAILTO_SAFE = /^[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}$/i;
  function emailCell(email) {
    const td = document.createElement('td');
    const value = String(email || '');
    if (MAILTO_SAFE.test(value)) {
      const a = document.createElement('a');
      a.href = `mailto:${value}`;
      a.textContent = value;
      td.appendChild(a);
    } else {
      td.textContent = value;
    }
    return td;
  }

  function contactCell(r) {
    const td = document.createElement('td');
    const pill = document.createElement('span');
    if (r.contact === 'existing') {
      pill.className = 'admin-pill admin-pill--existing';
      pill.textContent = 'Existing';
      td.appendChild(pill);
      const note = document.createElement('span');
      note.className = 'admin-cell-note';
      // Tier plus how far back they go, which is the useful follow-up
      // question once you know they aren't new.
      const bits = [];
      if (r.member_status) bits.push(r.member_status);
      if (r.member_since) bits.push(`since ${r.member_since}`);
      note.textContent = bits.join(' · ');
      if (bits.length) td.appendChild(note);
    } else if (r.contact === 'new') {
      pill.className = 'admin-pill admin-pill--new';
      pill.textContent = 'New';
      td.appendChild(pill);
    } else {
      pill.className = 'admin-pill admin-pill--unknown';
      pill.textContent = 'Unknown';
      pill.title = 'Ghost could not be reached on the last refresh.';
      td.appendChild(pill);
    }
    return td;
  }

  function cell(text) {
    const td = document.createElement('td');
    td.textContent = text;
    return td;
  }

  // Timestamps arrive as SQLite UTC ("YYYY-MM-DD HH:MM:SS"), which
  // Safari will not parse without the T and the Z.
  function parseUtc(s) {
    if (!s) return null;
    const d = new Date(`${String(s).replace(' ', 'T')}Z`);
    return Number.isNaN(d.getTime()) ? null : d;
  }

  function formatWhen(s) {
    const d = parseUtc(s);
    if (!d) return '';
    return d.toLocaleString(undefined, {
      month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit',
    });
  }

  function paintLive() {
    if (!lastLoadedAt) {
      liveEl.textContent = failures ? 'Not connected' : 'Loading…';
      // A green dot beside "Not connected" is exactly the wrong signal
      // for the glance this indicator exists to serve.
      liveEl.classList.toggle('is-stale', failures > 0);
      liveEl.classList.toggle('is-down', failures > 0);
      return;
    }
    const secs = Math.round((Date.now() - lastLoadedAt) / 1000);
    const ago = secs < 5 ? 'just now'
      : secs < 60 ? `${secs}s ago`
        : `${Math.floor(secs / 60)}m ago`;
    const total = rows.length;
    liveEl.textContent = `${total} registration${total === 1 ? '' : 's'} · updated ${ago}`;
    liveEl.classList.toggle('is-stale', failures > 0 || secs > 90);
    liveEl.classList.toggle('is-down', failures > 0);
  }

  // Announced only when the count actually moves, so a screen reader
  // hears "2 new registrations. 8 total." rather than a per-second
  // ticker. Kept separate from the visible label for that reason.
  let announcedCount = null;
  function announceCount() {
    const total = rows.length;
    if (announcedCount === null) { announcedCount = total; return; }
    if (total === announcedCount) return;
    const delta = total - announcedCount;
    announcedCount = total;
    srEl.textContent = delta > 0
      ? `${delta} new registration${delta === 1 ? '' : 's'}. ${total} total.`
      : `${total} registration${total === 1 ? '' : 's'}.`;
  }

  window.addEventListener('pagehide', () => {
    stopPolling();
    if (inflight) inflight.abort();
  });
  // bfcache restore: visibilitychange doesn't always fire, so the
  // timers stopped by pagehide would never come back.
  window.addEventListener('pageshow', (e) => {
    if (e.persisted && !stopped) { load(); startPolling(); }
  });
})();
