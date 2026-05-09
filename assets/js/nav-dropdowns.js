/*
 * Navigation dropdowns.
 *
 * Ghost's admin Navigation panel is flat — one URL per label, no
 * nesting UI. This script rebuilds any [data-nav-dropdowns] <nav>
 * into a grouped structure using a "Parent > Child" label
 * convention: an item whose label contains ">" becomes a child of
 * the parent named before it. The parent itself can either be
 * declared explicitly as its own flat item (to get a URL) or
 * implicitly — if no standalone "Parent" row exists, a non-link
 * button is synthesized.
 *
 * Two render modes:
 *   - desktop (default): parent renders as a toggle button; children
 *     appear in a popover opened on click.
 *   - mobile (data-nav-mode="mobile"): parent and children always
 *     render inline so the drawer shows the full tree.
 *
 * The server renders the flat list first, so if this script fails
 * or doesn't load the user still sees every nav item as a link
 * (clicking "Topics > Church" just follows its URL as stored).
 */
(function () {
  const navs = document.querySelectorAll("[data-nav-dropdowns]");
  if (!navs.length) return;

  navs.forEach((nav) => {
    const mode = nav.getAttribute("data-nav-mode") || "desktop";
    const items = Array.prototype.slice.call(nav.querySelectorAll("a[data-nav-label]"));
    if (!items.length) return;

    const groups = [];
    const byLabel = {};

    items.forEach((a) => {
      const label = (a.getAttribute("data-nav-label") || "").trim();
      const url = a.getAttribute("href") || "#";
      const sep = label.indexOf(">");
      if (sep === -1) {
        let g = byLabel[label];
        if (g) {
          g.url = url;
        } else {
          g = { label, url, children: [] };
          groups.push(g);
          byLabel[label] = g;
        }
      } else {
        const parentLabel = label.slice(0, sep).trim();
        const childLabel = label.slice(sep + 1).trim();
        let parent = byLabel[parentLabel];
        if (!parent) {
          parent = { label: parentLabel, url: null, children: [] };
          groups.push(parent);
          byLabel[parentLabel] = parent;
        }
        parent.children.push({ label: childLabel, url });
      }
    });

    nav.innerHTML = "";
    groups.forEach((g) => {
      if (!g.children.length) {
        nav.appendChild(makeLink(g.label, g.url));
        return;
      }
      if (mode === "mobile") {
        nav.appendChild(renderMobileGroup(g));
      } else {
        nav.appendChild(renderDesktopGroup(g, nav));
      }
    });

    if (mode !== "mobile") {
      document.addEventListener("click", (e) => {
        if (nav.contains(e.target)) return;
        closeAll(nav);
      });
      document.addEventListener("keydown", (e) => {
        if (e.key === "Escape") closeAll(nav);
      });
    }
  });

  function renderDesktopGroup(g, nav) {
    const wrap = document.createElement("div");
    wrap.className = "nav-dropdown";

    const toggle = document.createElement("button");
    toggle.type = "button";
    toggle.className = "nav-dropdown-toggle";
    toggle.setAttribute("aria-haspopup", "true");
    toggle.setAttribute("aria-expanded", "false");
    toggle.appendChild(document.createTextNode(`${g.label} `));
    const caret = document.createElement("span");
    caret.className = "nav-dropdown-caret";
    caret.setAttribute("aria-hidden", "true");
    caret.textContent = "\u25BE";
    toggle.appendChild(caret);
    wrap.appendChild(toggle);

    const menu = document.createElement("ul");
    menu.className = "nav-dropdown-menu";
    menu.setAttribute("role", "menu");
    // The parent's own URL is intentionally NOT added as a menu row.
    // When Ghost Admin's nav has a "Resources" item alongside its
    // "Resources > …" children, surfacing that URL at the top of the
    // dropdown produces a labeled-but-confusing row that visitors read
    // as a clickable dead zone. The toggle button itself carries the
    // parent identity; if a real Resources index page exists later,
    // add it as a normal child item instead.
    g.children.forEach((c) => {
      menu.appendChild(makeMenuItem(c.label, c.url));
    });
    wrap.appendChild(menu);

    toggle.addEventListener("click", (e) => {
      e.preventDefault();
      const open = wrap.classList.contains("is-open");
      closeAll(nav);
      if (!open) {
        wrap.classList.add("is-open");
        toggle.setAttribute("aria-expanded", "true");
      }
    });

    // Clicking a child link should close the dropdown. This matters
    // when the link is a same-page anchor (e.g. /#join from the
    // homepage) — the URL change doesn't trigger a navigation, the
    // document click handler at the top of the file ignores clicks
    // inside the nav, and the dropdown otherwise stays open until the
    // visitor clicks somewhere else on the page.
    menu.addEventListener("click", (e) => {
      if (e.target.closest("a")) closeAll(nav);
    });

    return wrap;
  }

  function renderMobileGroup(g) {
    const wrap = document.createElement("div");
    wrap.className = "mobile-nav-group";

    if (g.url) {
      // Parent has its own URL — keep as a link (navigates) and
      // children always visible. Collapsing would hide the link
      // target under a toggle, which isn't what we want here.
      wrap.appendChild(makeLink(g.label, g.url, "mobile-nav-group-parent"));
    } else {
      // Parent is a grouping only (e.g. Resources, Support) — render
      // as a toggle button, start collapsed so the drawer stays short
      // on mobile. Children expand/collapse on tap.
      wrap.classList.add("is-collapsed");
      const heading = document.createElement("button");
      heading.type = "button";
      heading.className = "mobile-nav-group-heading mobile-nav-group-toggle";
      heading.setAttribute("aria-expanded", "false");
      heading.appendChild(document.createTextNode(`${g.label} `));
      const mCaret = document.createElement("span");
      mCaret.className = "mobile-nav-group-caret";
      mCaret.setAttribute("aria-hidden", "true");
      mCaret.textContent = "\u25BE";
      heading.appendChild(mCaret);
      heading.addEventListener("click", () => {
        const nowCollapsed = wrap.classList.toggle("is-collapsed");
        heading.setAttribute("aria-expanded", nowCollapsed ? "false" : "true");
      });
      wrap.appendChild(heading);
    }

    const list = document.createElement("div");
    list.className = "mobile-nav-group-children";
    g.children.forEach((c) => {
      list.appendChild(makeLink(c.label, c.url, "mobile-nav-group-child"));
    });
    wrap.appendChild(list);
    return wrap;
  }

  function makeLink(label, url, className) {
    const a = document.createElement("a");
    a.href = url;
    a.textContent = label;
    if (className) a.className = className;
    return a;
  }

  function makeMenuItem(label, url, extraClass) {
    const li = document.createElement("li");
    const a = document.createElement("a");
    a.href = url;
    a.textContent = label;
    a.setAttribute("role", "menuitem");
    if (extraClass) a.className = extraClass;
    li.appendChild(a);
    return li;
  }

  function closeAll(nav) {
    nav.querySelectorAll(".nav-dropdown.is-open").forEach((d) => {
      d.classList.remove("is-open");
    });
    nav.querySelectorAll('[aria-expanded="true"]').forEach((b) => {
      b.setAttribute("aria-expanded", "false");
    });
  }

  function escapeHtml(s) {
    return String(s == null ? "" : s).replace(/[&<>"']/g, (c) => {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
    });
  }
})();
