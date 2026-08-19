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
 * window.MOAuth and window.MOSafeHref both come from boot.min.js, which
 * default.hbs loads in <head> before {{{body}}}. Page scripts run BEFORE
 * site.min.js, so nothing here may reach for a site-bundle global.
 */
(function () {
  const mount = document.querySelector('[data-dashboard-institution-full]');
  if (!mount) return;

  const loadingEl = document.querySelector('[data-institution-loading]');

  function fail(message) {
    if (loadingEl) loadingEl.hidden = true;
    const p = document.createElement('p');
    p.className = 'dashboard-empty';
    p.textContent = message;
    mount.innerHTML = '';
    mount.appendChild(p);
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

  window.MOAuth.fetch(`${apiBase.replace(/\/$/, '')}/api/institution/curated-for-me`, {
    credentials: 'omit'
  })
    .then((r) => { return r.ok ? r.json() : null; })
    .then((data) => {
      if (loadingEl) loadingEl.hidden = true;
      const institutions = (data && data.institutions) || [];
      if (!institutions.length) {
        fail('You are not a member of any organization, or no content has been curated yet.');
        return;
      }
      institutions.forEach((inst) => {
        const items = inst.curated || [];
        // Inline spacing rather than a class: screen.css has no rule for
        // this page, and adding one would mean a full min-file rebuild
        // for 48px. style-src allows 'unsafe-inline', so this is safe.
        const section = document.createElement('div');
        section.style.marginBottom = '48px';

        const heading = document.createElement('h2');
        heading.className = 'dashboard-module-title';
        const em = document.createElement('em');
        em.textContent = inst.name || 'Your Organization';
        heading.appendChild(em);
        section.appendChild(heading);

        if (!items.length) {
          const empty = document.createElement('p');
          empty.className = 'dashboard-empty';
          empty.textContent = 'No content curated yet.';
          section.appendChild(empty);
          mount.appendChild(section);
          return;
        }

        const grid = document.createElement('div');
        grid.className = 'week-grid dashboard-entry-grid';
        items.forEach((item) => {
          const entry = document.createElement('article');
          entry.className = 'entry';
          const url = item.content_type === 'podcast'
            ? `/podcasts/${item.show_slug || 'mere-fidelity'}/#ep-${String(item.content_id || '').replace('podcast:', '')}`
            : `/${item.slug || ''}`;

          // slug / show_slug / feature_image are worker-supplied, so both
          // the href and the src go through MOSafeHref (SECURITY-AGENT M5).
          // A slug beginning with "/" would otherwise make "/" + slug a
          // protocol-relative off-site URL.
          const a = document.createElement('a');
          window.MOSafeHref.set(a, url, '/dashboard/');
          a.className = 'entry-link';

          if (item.feature_image && window.MOSafeHref.isSafe(item.feature_image)) {
            const imgWrap = document.createElement('div');
            imgWrap.className = 'entry-image';
            const img = document.createElement('img');
            img.src = item.feature_image;
            img.alt = '';
            img.loading = 'lazy';
            imgWrap.appendChild(img);
            a.appendChild(imgWrap);
          }

          const body = document.createElement('div');
          body.className = 'entry-body';
          const titleEl = document.createElement('h3');
          titleEl.className = 'entry-title';
          titleEl.textContent = item.title || item.content_id;
          body.appendChild(titleEl);

          if (item.content_type === 'podcast') {
            const badge = document.createElement('p');
            badge.className = 'entry-meta';
            badge.textContent = 'Podcast';
            body.appendChild(badge);
          }

          if (item.pushed_at) {
            const dateEl = document.createElement('p');
            dateEl.className = 'entry-meta';
            dateEl.textContent = `Curated ${new Date(item.pushed_at).toLocaleDateString()}`;
            body.appendChild(dateEl);
          }

          a.appendChild(body);
          entry.appendChild(a);
          grid.appendChild(entry);
        });
        section.appendChild(grid);
        mount.appendChild(section);
      });
    })
    .catch(() => {
      fail('Could not load curated content. Try reloading.');
    });
})();
