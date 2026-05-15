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
      "/admin/engagement": "engagement"
    };
    const page = map[path];
    if (page) links.forEach((a) => {
      if (a.getAttribute("data-ws-page") === page) a.classList.add("is-active");
    });
  }

  // Collapsible sections — persisted in localStorage
  const COLLAPSE_KEY = "mo_admin_sidebar_collapsed";
  let collapsed = {};
  try { collapsed = JSON.parse(localStorage.getItem(COLLAPSE_KEY)) || {}; } catch (e) { /* ignore */ }

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

  // Auto-expand the section containing the active page
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
})();
