/*
 * /admin/members/map/ - members on an OpenStreetMap world map.
 *
 * GET {membership_api_base}/api/admin/member-map[?status=all] returns
 * { points: [{lat, lon, n, cc, precision, place}], total, placed, pending,
 *   unplaced, unknown, sources, countries: [{cc, n}], scope, warning? }. One point is one
 * postcode or town with n members in it. Nothing here is a street address,
 * so the map stops at zoom 12, the scale where a postcode reads as a place.
 *
 * Points cluster with Leaflet.markercluster. A cluster's number is the sum
 * of the members in it (not the number of postcodes), and so is a single
 * point's when more than one member shares it.
 *
 * Every string from the API goes into the DOM through textContent.
 */
(function () {
  'use strict';

  const host = document.querySelector('[data-member-map]');
  if (!host || !window.L || !window.L.markerClusterGroup || !window.MOAuth) return;
  const {L} = window;

  const apiBase = (host.dataset.apiBase || '').replace(/\/$/, '');
  const statusEl = host.querySelector('[data-map-status]');
  const canvas = host.querySelector('[data-map-canvas]');
  const regionsEl = host.querySelector('[data-map-regions]');
  const scopeBtns = Array.from(host.querySelectorAll('[data-map-scope]'));

  const MAX_ZOOM = 12;
  const nf = new Intl.NumberFormat('en-US');
  let countryName = (cc) => cc;
  try {
    const names = new Intl.DisplayNames(['en'], {type: 'region'});
    countryName = (cc) => names.of(cc) || cc;
  } catch (_) { /* older browser: codes are fine */ }

  // Where "United States" should frame: the lower 48, not a box stretched
  // to Alaska and Hawaii. Other countries frame their own points.
  const FIXED_BOUNDS = {
    US: [[24.4, -125.0], [49.4, -66.9]],
  };

  const map = L.map(canvas, {
    worldCopyJump: true,
    minZoom: 2,
    maxZoom: MAX_ZOOM,
    zoomSnap: 0.5,
  }).setView([30, -40], 2);

  L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
    maxZoom: MAX_ZOOM,
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
  }).addTo(map);

  function membersIn(marker) {
    return marker.options.members || 1;
  }

  function sizeFor(n) {
    // 14px for one member, growing with the log of the count.
    return Math.round(14 + Math.min(30, Math.log2(n) * 5));
  }

  function badge(n, kind) {
    const size = n > 1 ? Math.max(sizeFor(n), 24) : 14;
    return L.divIcon({
      html: n > 1 ? `<span>${nf.format(n)}</span>` : '',
      className: `member-map-${kind}${n > 1 ? '' : ' is-single'}`,
      iconSize: [size, size],
    });
  }

  const cluster = L.markerClusterGroup({
    showCoverageOnHover: false,
    maxClusterRadius: 48,
    spiderfyOnMaxZoom: true,
    iconCreateFunction(c) {
      const n = c.getAllChildMarkers().reduce((sum, m) => sum + membersIn(m), 0);
      return badge(n, 'cluster');
    },
  });
  map.addLayer(cluster);

  function popupFor(p) {
    const el = document.createElement('div');
    el.className = 'member-map-popup';
    const place = document.createElement('strong');
    place.textContent = p.place || countryName(p.cc);
    const count = document.createElement('span');
    count.textContent = `${nf.format(p.n)} ${p.n === 1 ? 'member' : 'members'}`;
    el.append(place, document.createElement('br'), count);
    if (p.precision !== 'postcode') {
      const note = document.createElement('em');
      note.textContent = p.precision === 'country' ? ' (placed by country)' : ' (placed by town)';
      el.append(note);
    }
    return el;
  }

  let points = [];

  function draw() {
    cluster.clearLayers();
    cluster.addLayers(points.map((p) =>
      L.marker([p.lat, p.lon], {icon: badge(p.n, 'point'), members: p.n, keyboard: false})
        .bindPopup(() => popupFor(p))
    ));
  }

  function frame(cc) {
    // An open popup pans the map back to itself and undoes the framing.
    map.closePopup();
    if (cc === 'world') { map.setView([30, -40], 2); return; }
    const box = FIXED_BOUNDS[cc] || points.filter((p) => p.cc === cc).map((p) => [p.lat, p.lon]);
    if (!box.length) return;
    map.fitBounds(L.latLngBounds(box).pad(0.15), {maxZoom: 7});
  }

  function setRegions(countries) {
    regionsEl.querySelectorAll('[data-map-region]:not([data-map-region="world"])').forEach((b) => b.remove());
    countries.slice(0, 8).forEach((c) => {
      const b = document.createElement('button');
      b.type = 'button';
      b.className = 'admin-table-scope-btn';
      b.dataset.mapRegion = c.cc;
      b.textContent = `${countryName(c.cc)} ${nf.format(c.n)}`;
      regionsEl.append(b);
    });
  }

  regionsEl.addEventListener('click', (e) => {
    const b = e.target.closest('[data-map-region]');
    if (b) frame(b.dataset.mapRegion);
  });

  function setStat(key, value) {
    const el = host.querySelector(`[data-stat="${key}"]`);
    if (el) el.textContent = value == null ? '—' : nf.format(value);
  }

  function setStatus(msg) {
    statusEl.textContent = msg;
    statusEl.hidden = !msg;
  }

  let scope = '';
  let loading = 0;

  async function load() {
    const ticket = ++loading;
    setStatus('Loading the map…');
    let res;
    try {
      const url = new URL(`${apiBase}/api/admin/member-map`, window.location.origin);
      if (scope) url.searchParams.set('status', scope);
      res = await window.MOAuth.fetch(url.toString(), {credentials: 'omit'});
    } catch (_) {
      if (ticket === loading) setStatus('Could not reach the membership service. Try again in a minute.');
      return;
    }
    if (ticket !== loading) return;
    if (res.status === 401) { setStatus('Sign in required.'); return; }
    if (res.status === 403) { setStatus('This page needs the Members permission. Ask an admin to grant it.'); return; }
    if (!res.ok) { setStatus(`The map could not load (error ${res.status}).`); return; }
    let data;
    try {
      data = await res.json();
    } catch (_) {
      if (ticket === loading) setStatus('The map could not load.');
      return;
    }
    if (ticket !== loading) return;

    points = Array.isArray(data.points) ? data.points : [];
    draw();
    setRegions(data.countries || []);
    setStat('placed', data.placed);
    setStat('countries', (data.countries || []).length);
    setStat('pending', data.pending);
    setStat('unplaced', data.unplaced);
    setStat('unknown', data.unknown);

    const notes = [];
    if (data.warning) notes.push(data.warning);
    if (data.pending) notes.push(`${nf.format(data.pending)} ${data.pending === 1 ? 'member is' : 'members are'} not on the map yet. Locations are looked up every hour.`);
    setStatus(notes.join(' '));
  }

  scopeBtns.forEach((btn) => btn.addEventListener('click', () => {
    scope = btn.dataset.mapScope;
    scopeBtns.forEach((b) => {
      const on = b === btn;
      b.classList.toggle('is-active', on);
      b.setAttribute('aria-pressed', on ? 'true' : 'false');
    });
    load();
  }));

  load();
})();
