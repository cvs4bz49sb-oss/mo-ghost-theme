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
  var navs = document.querySelectorAll("[data-nav-dropdowns]");
  if (!navs.length) return;

  navs.forEach(function (nav) {
    var mode = nav.getAttribute("data-nav-mode") || "desktop";
    var items = Array.prototype.slice.call(nav.querySelectorAll("a[data-nav-label]"));
    if (!items.length) return;

    var groups = [];
    var byLabel = {};

    items.forEach(function (a) {
      var label = (a.getAttribute("data-nav-label") || "").trim();
      var url = a.getAttribute("href") || "#";
      var sep = label.indexOf(">");
      if (sep === -1) {
        var g = byLabel[label];
        if (g) {
          g.url = url;
        } else {
          g = { label: label, url: url, children: [] };
          groups.push(g);
          byLabel[label] = g;
        }
      } else {
        var parentLabel = label.slice(0, sep).trim();
        var childLabel = label.slice(sep + 1).trim();
        var parent = byLabel[parentLabel];
        if (!parent) {
          parent = { label: parentLabel, url: null, children: [] };
          groups.push(parent);
          byLabel[parentLabel] = parent;
        }
        parent.children.push({ label: childLabel, url: url });
      }
    });

    nav.innerHTML = "";
    groups.forEach(function (g) {
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
      document.addEventListener("click", function (e) {
        if (nav.contains(e.target)) return;
        closeAll(nav);
      });
      document.addEventListener("keydown", function (e) {
        if (e.key === "Escape") closeAll(nav);
      });
    }
  });

  function renderDesktopGroup(g, nav) {
    var wrap = document.createElement("div");
    wrap.className = "nav-dropdown";

    var toggle = document.createElement("button");
    toggle.type = "button";
    toggle.className = "nav-dropdown-toggle";
    toggle.setAttribute("aria-haspopup", "true");
    toggle.setAttribute("aria-expanded", "false");
    toggle.innerHTML = escapeHtml(g.label) +
      ' <span class="nav-dropdown-caret" aria-hidden="true">\u25BE</span>';
    wrap.appendChild(toggle);

    var menu = document.createElement("ul");
    menu.className = "nav-dropdown-menu";
    menu.setAttribute("role", "menu");
    if (g.url) {
      // Parent has its own URL — add it at the top of the menu so the
      // button's role as "jump to index" stays discoverable.
      menu.appendChild(makeMenuItem(g.label, g.url, "nav-dropdown-parent"));
    }
    g.children.forEach(function (c) {
      menu.appendChild(makeMenuItem(c.label, c.url));
    });
    wrap.appendChild(menu);

    toggle.addEventListener("click", function (e) {
      e.preventDefault();
      var open = wrap.classList.contains("is-open");
      closeAll(nav);
      if (!open) {
        wrap.classList.add("is-open");
        toggle.setAttribute("aria-expanded", "true");
      }
    });

    return wrap;
  }

  function renderMobileGroup(g) {
    var wrap = document.createElement("div");
    wrap.className = "mobile-nav-group";

    if (g.url) {
      wrap.appendChild(makeLink(g.label, g.url, "mobile-nav-group-parent"));
    } else {
      var heading = document.createElement("p");
      heading.className = "mobile-nav-group-heading";
      heading.textContent = g.label;
      wrap.appendChild(heading);
    }

    var list = document.createElement("div");
    list.className = "mobile-nav-group-children";
    g.children.forEach(function (c) {
      list.appendChild(makeLink(c.label, c.url, "mobile-nav-group-child"));
    });
    wrap.appendChild(list);
    return wrap;
  }

  function makeLink(label, url, className) {
    var a = document.createElement("a");
    a.href = url;
    a.textContent = label;
    if (className) a.className = className;
    return a;
  }

  function makeMenuItem(label, url, extraClass) {
    var li = document.createElement("li");
    var a = document.createElement("a");
    a.href = url;
    a.textContent = label;
    a.setAttribute("role", "menuitem");
    if (extraClass) a.className = extraClass;
    li.appendChild(a);
    return li;
  }

  function closeAll(nav) {
    nav.querySelectorAll(".nav-dropdown.is-open").forEach(function (d) {
      d.classList.remove("is-open");
    });
    nav.querySelectorAll('[aria-expanded="true"]').forEach(function (b) {
      b.setAttribute("aria-expanded", "false");
    });
  }

  function escapeHtml(s) {
    return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
    });
  }
})();
