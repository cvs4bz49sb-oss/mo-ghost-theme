(function () {
  "use strict";

  const sidebar = document.querySelector("[data-ws-sidebar]");
  if (!sidebar) return;

  const path = window.location.pathname.replace(/\/+$/, "") || "/admin";
  const links = sidebar.querySelectorAll("[data-ws-page]");
  if (!sidebar.querySelector(".ws-sidebar-link.is-active")) {
    const map = {
      "/admin": "overview",
      "/admin/members": "members", "/admin/members/addresses": "members",
      "/admin/members/gifts": "members", "/admin/members/groups": "members",
      "/admin/members/institutions": "members",
      "/admin/members/institutions/manage": "members",
      "/admin/members/drift": "members",
      "/admin/traffic": "traffic", "/admin/content": "content",
      "/admin/agenda": "agenda", "/admin/settings": "settings",
      "/admin/coverage": "coverage", "/admin/editorial": "editorial",
      "/digest-gen": "digest", "/admin/social": "social",
      "/admin/assets": "assets", "/admin/quote": "quote",
      "/admin/copy": "copy", "/admin/extract": "extract",
      "/admin/slide-ins": "slide-ins",
      "/admin/engagement": "engagement",
      "/admin/podcasts": "podcasts",
    };
    const page = map[path];
    if (page) links.forEach((a) => {
      if (a.getAttribute("data-ws-page") === page) a.classList.add("is-active");
    });
  }

  // -----------------------------------------------------------------------
  // Collapsible sections — persisted in localStorage
  // -----------------------------------------------------------------------
  const COLLAPSE_KEY = "mo_admin_sidebar_collapsed";
  let collapsed = {};
  try { collapsed = JSON.parse(localStorage.getItem(COLLAPSE_KEY)) || {}; } catch (_) { /* ignore */ }

  sidebar.querySelectorAll("[data-ws-section]").forEach((section) => {
    const key = section.dataset.wsSection;
    if (collapsed[key]) section.classList.add("is-collapsed");
  });

  sidebar.addEventListener("click", (e) => {
    const btn = e.target.closest("[data-ws-section-toggle]");
    if (!btn) return;
    const key = btn.dataset.wsSectionToggle;
    const section = sidebar.querySelector(`[data-ws-section="${key}"]`);
    if (!section) return;
    section.classList.toggle("is-collapsed");
    collapsed[key] = section.classList.contains("is-collapsed");
    localStorage.setItem(COLLAPSE_KEY, JSON.stringify(collapsed));
  });

  const activeLink = sidebar.querySelector(".ws-sidebar-link.is-active");
  if (activeLink) {
    const parentSection = activeLink.closest("[data-ws-section]");
    if (parentSection && parentSection.classList.contains("is-collapsed")) {
      parentSection.classList.remove("is-collapsed");
      delete collapsed[parentSection.dataset.wsSection];
      localStorage.setItem(COLLAPSE_KEY, JSON.stringify(collapsed));
    }
  }

  const toggle = document.querySelector("[data-ws-toggle]");
  const backdrop = document.querySelector("[data-ws-backdrop]");
  if (toggle) toggle.addEventListener("click", () => { sidebar.classList.toggle("is-open"); });
  if (backdrop) backdrop.addEventListener("click", () => { sidebar.classList.remove("is-open"); });

  // -----------------------------------------------------------------------
  // Permissions enforcement — hide unauthorized tools, block pages
  // -----------------------------------------------------------------------
  const workerUrl = (document.body.getAttribute("data-admin-worker-url") || "").replace(/\/+$/, "");
  if (!workerUrl || !window.MOAuth) return;

  const PAGE_TO_TOOL = {
    members: "members",
    traffic: "traffic",
    content: "content",
    agenda: "agenda",
    settings: "settings",
    coverage: "coverage",
    editorial: "editorial",
    sponsors: "sponsors",
    digest: "digest",
    social: "social",
    assets: "assets",
    copy: "copy",
    extract: "extract",
    "slide-ins": "slide-ins",
    engagement: "engagement",
    podcasts: "podcasts",
  };

  window.MOAuth.fetch(`${workerUrl}/my-permissions`)
    .then((r) => r.json())
    .then((perms) => {
      if (!perms.authorized && perms.authorized !== undefined) {
        blockPage();
        return;
      }

      window.__moPerms = perms;

      if (perms.isStaff || perms.tools === null) return;

      const tools = perms.tools || {};
      links.forEach((link) => {
        const page = link.getAttribute("data-ws-page");
        const tool = PAGE_TO_TOOL[page];
        if (tool && !tools[tool]) {
          const li = link.closest("li");
          if (li) li.style.display = "none";
        }
      });

      hideSectionsIfEmpty();

      const activePg = sidebar.querySelector(".ws-sidebar-link.is-active");
      if (activePg) {
        const pgId = activePg.getAttribute("data-ws-page");
        const pgTool = PAGE_TO_TOOL[pgId];
        if (pgTool && !tools[pgTool]) blockPage();
      }
    })
    .catch(() => { /* fail open for staff on network errors — worker still enforces */ });

  function hideSectionsIfEmpty() {
    sidebar.querySelectorAll("[data-ws-section]").forEach((section) => {
      const visibleLinks = section.querySelectorAll(".ws-sidebar-list li");
      let anyVisible = false;
      visibleLinks.forEach((li) => {
        if (li.style.display !== "none") anyVisible = true;
      });
      if (!anyVisible) section.style.display = "none";
    });
  }

  function blockPage() {
    const main = document.querySelector(".admin-main");
    if (!main) return;
    main.innerHTML = `<div class="admin-denied-wrap">` +
      `<h2 class="admin-denied-title">Access Denied</h2>` +
      `<p class="admin-denied-text">You don't have permission to view this page. Contact a site administrator to request access.</p>` +
      `<a href="/admin/" class="btn">Back to Dashboard</a>` +
    `</div>`;
  }
})();
