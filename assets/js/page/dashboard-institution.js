/*
 * /dashboard/institution/ — renders the curated reading list an
 * organization's administrator has pushed to its members.
 *
 * Externalized from custom-dashboard-institution.hbs on 2026-08-19.
 * The logic used to live in an inline <script> in that template, which
 * meant it never ran: default.hbs sets a CSP with
 * `script-src 'self' …` and NO 'unsafe-inline', so the browser blocked
 * the block outright. The visible symptom was the page sitting on
 * "Loading curated content..." forever with an empty mount, because
 * nothing ever executed to replace it. Do not move this back inline.
 *
 * The first externalized version kept the original markup, which was
 * wrong in a way the CSP bug had been hiding: it emitted
 * article.entry > a.entry-link > (.entry-image + .entry-body). Only one
 * of those classes exists in screen.css. `.entry` is a
 * `grid-template-columns: 150px 1fr` two-child grid, so wrapping both
 * halves in a single <a> dropped the whole tile into the 150px image
 * column and titles wrapped to five lines.
 *
 * This version renders .dash-new-* tiles instead — the vocabulary from
 * the "New since your last visit" rail on /dashboard/, which already
 * handles a dense grid mixing 16:9 essay art with 1:1 podcast covers.
 * See the .institution-grid block in screen.css for why not .week-grid,
 * and why .dash-new-item specifically is NOT reused.
 *
 * window.MOAuth and window.MOSafeHref both come from boot.min.js, which
 * default.hbs loads in <head> before {{{body}}}. Page scripts run BEFORE
 * site.min.js, so nothing here may reach for a site-bundle global.
 */
(function () {
  const mount = document.querySelector('[data-dashboard-institution-full]');
  if (!mount) return;

  const loadingEl = document.querySelector('[data-institution-loading]');

  function fail(message, linkHref, linkText) {
    if (loadingEl) loadingEl.hidden = true;
    mount.innerHTML = '';
    const p = document.createElement('p');
    p.className = 'dashboard-empty';
    p.textContent = message;
    mount.appendChild(p);
    if (linkHref) {
      const wrap = document.createElement('p');
      wrap.className = 'dashboard-actions';
      const a = document.createElement('a');
      // Always a same-origin literal from this file, but M5 is mechanical
      // and routing it costs nothing.
      window.MOSafeHref.set(a, linkHref, '/');
      a.className = 'btn btn-ghost';
      a.textContent = linkText;
      wrap.appendChild(a);
      mount.appendChild(wrap);
    }
  }

  const apiBaseMeta = document.querySelector('meta[name="mo-api-base"]');
  const apiBase = (apiBaseMeta && apiBaseMeta.getAttribute('content')) || '';

  // Never return silently. A missing api base or a missing MOAuth is a
  // misconfiguration, and the old silent `return` is exactly what made
  // this page look like it was loading forever.
  if (!apiBase) {
    fail('Curated content is not configured right now. Please try again later.');
    return;
  }
  if (!window.MOAuth || !window.MOSafeHref) {
    fail('Could not load curated content. Try reloading.');
    return;
  }

  // pushed_at is SQLite CURRENT_TIMESTAMP: "YYYY-MM-DD HH:MM:SS", UTC,
  // space-separated, no zone marker. Passing that straight to new Date()
  // is unreliable — Safari returns Invalid Date for the space form, and
  // engines that do accept it disagree on whether to read it as local or
  // UTC. Normalize to an explicit ISO instant, then render in UTC so the
  // displayed day can't slide backwards for members west of Greenwich.
  function parseTimestamp(value) {
    if (typeof value !== 'string') return new Date(value);
    const dateTime = value.match(/^(\d{4}-\d{2}-\d{2})[ T](\d{2}:\d{2}:\d{2})/);
    if (dateTime) return new Date(`${dateTime[1]}T${dateTime[2]}Z`);
    if (/^\d{4}-\d{2}-\d{2}$/.test(value)) return new Date(`${value}T00:00:00Z`);
    return new Date(value);
  }

  function formatCurated(value) {
    // new Date(null) is the epoch, not an invalid date, so a null
    // pushed_at would otherwise render "Curated Jan 1".
    if (!value) return '';
    const d = parseTimestamp(value);
    if (isNaN(d.getTime())) return '';
    // Short month: the theme's long "MMMM D" overruns a 160px tile at
    // the ≤640 two-up breakpoint.
    return `Curated ${d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', timeZone: 'UTC' })}`;
  }

  function buildPlate(item) {
    const plate = document.createElement('span');
    plate.className = 'dash-new-plate';
    // The plate is ALWAYS rendered, even with no image. Omitting it in a
    // stacked grid pulls that tile's title to the top of its cell while
    // every neighbour's title sits a plate-height lower.
    if (item.feature_image && window.MOSafeHref.isSafe(item.feature_image)) {
      // JSON.stringify quotes and escapes the URL. isSafe() vets the
      // scheme but not a `");` inside the path, which would otherwise
      // break out of the CSS string. Mirrors dashboard.js.
      plate.style.backgroundImage = `url(${JSON.stringify(item.feature_image)})`;
    } else {
      plate.classList.add('dash-new-plate--empty');
      const mark = document.createElement('span');
      mark.className = 'dash-new-plate-mark';
      mark.textContent = '¶';
      plate.appendChild(mark);
    }
    return plate;
  }

  function buildTile(item) {
    const isPodcast = item.content_type === 'podcast';
    const url = isPodcast
      ? `/podcasts/${item.show_slug || 'mere-fidelity'}/#ep-${String(item.content_id || '').replace('podcast:', '')}`
      : `/${item.slug || ''}`;

    const li = document.createElement('li');
    li.className = 'institution-item';

    const a = document.createElement('a');
    a.className = 'dash-new-link';
    // slug / show_slug are worker-supplied, so the href goes through
    // MOSafeHref (SECURITY-AGENT M5). A slug beginning with "/" would
    // otherwise make "/" + slug a protocol-relative off-site URL.
    window.MOSafeHref.set(a, url, '/dashboard/');

    a.appendChild(buildPlate(item));

    // The kind is emitted for EVERY item, not just podcasts. The plate
    // and the eyebrow are the fixed-height run-up to the title; skipping
    // the eyebrow on essays would knock those titles out of line with
    // the podcasts beside them.
    const kind = document.createElement('span');
    kind.className = 'dash-new-kind';
    kind.textContent = isPodcast ? 'Podcast' : 'Essay';
    a.appendChild(kind);

    const titleEl = document.createElement('h3');
    titleEl.className = 'dash-new-item-title';
    titleEl.textContent = item.title || item.content_id;
    a.appendChild(titleEl);

    const curated = item.pushed_at ? formatCurated(item.pushed_at) : '';
    if (curated) {
      const dateEl = document.createElement('p');
      dateEl.className = 'institution-item-date';
      dateEl.textContent = curated;
      a.appendChild(dateEl);
    }

    li.appendChild(a);
    return li;
  }

  window.MOAuth.fetch(`${apiBase.replace(/\/$/, '')}/api/institution/curated-for-me`, {
    credentials: 'omit'
  })
    .then((r) => (r.ok ? r.json() : null))
    .then((data) => {
      if (loadingEl) loadingEl.hidden = true;
      const institutions = (data && data.institutions) || [];
      if (!institutions.length) {
        fail(
          'You are not a member of any organization yet.',
          '/institutions/',
          'About organizational membership'
        );
        return;
      }
      mount.innerHTML = '';

      // The hero headline IS the organization's name. Server-rendered as a
      // placeholder because the name only exists in this response.
      const pageName = document.querySelector('[data-institution-page-name]');
      if (pageName) {
        pageName.textContent = institutions.length === 1 && institutions[0].name
          ? institutions[0].name
          : 'Your organizations';
      }

      // With one organization the hero already carries the name, so a section
      // heading beneath it would just say the same thing twice. Members of
      // more than one still need the per-section headings to tell them apart.
      const showSectionHeadings = institutions.length > 1;

      institutions.forEach((inst) => {
        const items = inst.curated || [];

        const section = document.createElement('section');
        section.className = 'institution-section';

        if (showSectionHeadings) {
          const heading = document.createElement('h2');
          heading.className = 'dashboard-module-title institution-section-title';
          const em = document.createElement('em');
          em.textContent = inst.name || 'Your organization';
          heading.appendChild(em);
          section.appendChild(heading);
        }

        if (!items.length) {
          const empty = document.createElement('p');
          empty.className = 'dashboard-empty';
          empty.textContent = 'No content curated yet.';
          section.appendChild(empty);
          mount.appendChild(section);
          return;
        }

        const grid = document.createElement('ul');
        grid.className = 'institution-grid';
        items.forEach((item) => { grid.appendChild(buildTile(item)); });
        section.appendChild(grid);
        mount.appendChild(section);
      });
    })
    .catch(() => {
      fail('Could not load curated content. Try reloading.');
    });
})();
