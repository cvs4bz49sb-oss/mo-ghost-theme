(() => {
  const body = document.body;
  const status = body.getAttribute("data-member-status") || "";
  if (status !== "paid" && status !== "comped") return;

  const apiBaseMeta = document.querySelector('meta[name="mo-api-base"]');
  const apiBase = apiBaseMeta ? apiBaseMeta.content.replace(/\/$/, '') : '';
  if (!apiBase || !window.MOAuth) return;

  let adminInstitutions = null; // cached result from am-i-admin
  const CACHE_KEY = 'mo-inst-admin-cache';
  const CACHE_TTL = 10 * 60 * 1000;

  async function fetchJson(path) {
    const res = await window.MOAuth.fetch(apiBase + path, { credentials: 'omit' });
    return res.ok ? res.json() : null;
  }

  async function postJson(path, data) {
    const res = await window.MOAuth.fetch(apiBase + path, {
      method: 'POST',
      credentials: 'omit',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    return res.ok ? res.json() : null;
  }

  async function getAdminInstitutions() {
    if (adminInstitutions) return adminInstitutions;

    // Check cache
    try {
      const cached = JSON.parse(sessionStorage.getItem(CACHE_KEY));
      if (cached && Date.now() - cached.ts < CACHE_TTL) {
        adminInstitutions = cached.institutions;
        return adminInstitutions;
      }
    } catch (_) {}

    const data = await fetchJson('/api/institution/am-i-admin');
    adminInstitutions = (data && data.institutions) || [];

    try {
      sessionStorage.setItem(CACHE_KEY, JSON.stringify({ ts: Date.now(), institutions: adminInstitutions }));
    } catch (_) {}

    return adminInstitutions;
  }

  // --- Article push button ---

  async function initArticleButton() {
    const contentEl = document.querySelector('[data-post-gate]');
    if (!contentEl) return;

    const insts = await getAdminInstitutions();
    if (!insts.length) return;

    const postId = contentEl.getAttribute('data-post-id') || '';
    if (!postId) return;

    // Create the button dynamically — never server-rendered
    const btn = document.createElement('div');
    btn.className = 'institution-push-bar';
    btn.innerHTML = '<button class="institution-push" type="button" aria-label="Push to institution" aria-pressed="false">' +
      '<svg class="institution-push-icon" viewBox="0 0 24 24" aria-hidden="true">' +
      '<path d="M12 2L4 10h3v6h10v-6h3L12 2z" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round"/>' +
      '<rect x="4" y="18" width="16" height="2" rx="1" fill="currentColor"/>' +
      '</svg>' +
      '<span class="institution-push-label">Push to ' + (insts.length === 1 ? insts[0].name : 'Institution') + '</span>' +
      '</button>';
    contentEl.parentNode.insertBefore(btn, contentEl.nextSibling);

    const pushBtn = btn.querySelector('.institution-push');

    // Get current push status
    const statusData = await fetchJson(
      '/api/institution/curate/status?content_type=article&content_id=' + encodeURIComponent(postId)
    );
    const pushed = (statusData && statusData.pushed) || [];
    const pushedIds = new Set(pushed.map(function (p) { return p.institution_id; }));

    setupPushButton(pushBtn, insts, 'article', postId, pushedIds);
  }

  // --- Podcast push buttons ---

  async function initPodcastButtons() {
    // Wait for podcast-feed.js to render episodes
    const episodes = document.querySelectorAll('article.pod-entry--episode[id^="ep-"]');
    if (!episodes.length) return;

    const insts = await getAdminInstitutions();
    if (!insts.length) return;

    episodes.forEach(ep => {
      const rawId = ep.id.replace(/^ep-/, '');
      if (!rawId) return;
      const contentId = `podcast:${rawId}`;

      // Don't inject twice
      if (ep.querySelector('[data-institution-push-pod]')) return;

      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'institution-push institution-push--podcast';
      btn.setAttribute('data-institution-push-pod', '');
      btn.setAttribute('aria-label', 'Push to institution');
      btn.innerHTML = `<svg class="institution-push-icon" viewBox="0 0 24 24" aria-hidden="true"><path d="M12 2L4 10h3v6h10v-6h3L12 2z" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round"/><rect x="4" y="18" width="16" height="2" rx="1" fill="currentColor"/></svg><span class="institution-push-label">Push</span>`;

      // Insert at the end of the episode card (before the footer if it exists)
      const footer = ep.querySelector('.pod-footer');
      if (footer) {
        footer.insertAdjacentElement('beforebegin', btn);
      } else {
        ep.appendChild(btn);
      }

      // Fetch status for this episode asynchronously
      fetchJson(`/api/institution/curate/status?content_type=podcast&content_id=${encodeURIComponent(contentId)}`)
        .then(data => {
          const pushed = (data && data.pushed) || [];
          const pushedIds = new Set(pushed.map(p => p.institution_id));
          setupPushButton(btn, insts, 'podcast', contentId, pushedIds);
        });
    });
  }

  // --- Shared push button logic ---

  function setupPushButton(btn, institutions, contentType, contentId, pushedIds) {
    const isPushed = pushedIds.size > 0;

    // Get article metadata for storage
    const meta = getContentMeta(contentType, contentId);

    if (institutions.length === 1) {
      // Single institution: simple toggle
      const inst = institutions[0];
      let pushed = pushedIds.has(inst.id);

      function updateState() {
        btn.classList.toggle('is-pushed', pushed);
        const label = btn.querySelector('.institution-push-label');
        if (label) label.textContent = pushed ? 'Pushed' : 'Push';
        btn.setAttribute('aria-pressed', String(pushed));
      }
      updateState();

      btn.addEventListener('click', async () => {
        if (btn.classList.contains('is-loading')) return;
        btn.classList.add('is-loading');
        const action = pushed ? 'remove' : 'add';
        const result = await postJson(`/api/institution/curate/${action}`, {
          institution_id: inst.id,
          content_type: contentType,
          content_id: contentId,
          ...meta,
        });
        if (result && result.ok !== undefined) {
          pushed = !pushed;
          updateState();
        }
        btn.classList.remove('is-loading');
      });
    } else {
      // Multiple institutions: dropdown
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        toggleDropdown(btn, institutions, contentType, contentId, pushedIds, meta);
      });
      if (isPushed) {
        btn.classList.add('is-pushed');
        const label = btn.querySelector('.institution-push-label');
        if (label) label.textContent = `Pushed (${pushedIds.size})`;
      }
    }
  }

  function toggleDropdown(btn, institutions, contentType, contentId, pushedIds, meta) {
    // Close any existing dropdown
    const existing = document.querySelector('.institution-push-dropdown');
    if (existing) { existing.remove(); return; }

    const dropdown = document.createElement('div');
    dropdown.className = 'institution-push-dropdown';

    institutions.forEach(inst => {
      const item = document.createElement('label');
      item.className = 'institution-push-dropdown-item';

      const cb = document.createElement('input');
      cb.type = 'checkbox';
      cb.checked = pushedIds.has(inst.id);

      const nameSpan = document.createElement('span');
      nameSpan.textContent = inst.name;

      item.appendChild(cb);
      item.appendChild(nameSpan);
      dropdown.appendChild(item);

      cb.addEventListener('change', async () => {
        cb.disabled = true;
        const action = cb.checked ? 'add' : 'remove';
        const result = await postJson(`/api/institution/curate/${action}`, {
          institution_id: inst.id,
          content_type: contentType,
          content_id: contentId,
          ...meta,
        });
        cb.disabled = false;
        if (result && result.ok !== undefined) {
          if (cb.checked) pushedIds.add(inst.id);
          else pushedIds.delete(inst.id);
          // Update button state
          const isPushed = pushedIds.size > 0;
          btn.classList.toggle('is-pushed', isPushed);
          const label = btn.querySelector('.institution-push-label');
          if (label) label.textContent = isPushed ? `Pushed (${pushedIds.size})` : 'Push';
        }
      });
    });

    btn.style.position = 'relative';
    dropdown.style.position = 'absolute';
    dropdown.style.top = '100%';
    dropdown.style.left = '0';
    dropdown.style.zIndex = '100';
    btn.appendChild(dropdown);

    // Close on outside click
    const close = (e) => {
      if (!btn.contains(e.target)) {
        dropdown.remove();
        document.removeEventListener('click', close);
      }
    };
    setTimeout(() => document.addEventListener('click', close), 0);
  }

  function getContentMeta(contentType, contentId) {
    if (contentType === 'article') {
      // Get article metadata from the page
      const titleEl = document.querySelector('.article-title');
      const title = titleEl ? titleEl.textContent.trim() : '';
      const slug = window.location.pathname.split('/').filter(Boolean).pop() || '';
      const imgEl = document.querySelector('.article-feature-image img, .kg-image');
      const feature_image = imgEl ? imgEl.src : '';
      return { title, slug, feature_image };
    }
    if (contentType === 'podcast') {
      const epId = contentId.replace('podcast:', '');
      const epEl = document.getElementById(`ep-${epId}`);
      const titleEl = epEl ? epEl.querySelector('.pod-title') : null;
      const title = titleEl ? titleEl.textContent.trim() : '';
      const show_slug = epEl ? (epEl.getAttribute('data-show') || '') : '';
      return { title, show_slug };
    }
    return {};
  }

  // --- Init ---

  // Article: run immediately
  initArticleButton();

  // Podcast: wait for episodes to render, then inject buttons.
  // podcast-feed.js fetches async, so we observe mutations on .listen-grid containers.
  const grids = document.querySelectorAll('.listen-grid');
  if (grids.length) {
    const observer = new MutationObserver(() => {
      initPodcastButtons();
    });
    grids.forEach(g => observer.observe(g, { childList: true }));
    // Also try immediately in case episodes already rendered
    setTimeout(() => initPodcastButtons(), 1000);
  }
})();
