(function () {
  "use strict";

  var sidebar = document.querySelector("[data-ws-sidebar]");
  if (!sidebar) return;

  var path = window.location.pathname.replace(/\/+$/, "") || "/admin";
  var links = sidebar.querySelectorAll("[data-ws-page]");
  if (!sidebar.querySelector(".ws-sidebar-link.is-active")) {
    var map = {
      "/admin": "overview",
      "/admin/members": "members", "/admin/members/addresses": "members",
      "/admin/members/gifts": "members", "/admin/members/groups": "members",
      "/admin/members/institutions": "members",
      "/admin/members/institutions/manage": "members",
      "/admin/members/drift": "members",
      "/admin/traffic": "traffic", "/admin/settings": "settings",
      "/admin/coverage": "coverage", "/admin/editorial": "editorial",
      "/digest-gen": "digest", "/admin/social": "social",
      "/admin/assets": "assets", "/admin/quote": "quote",
      "/admin/copy": "copy", "/admin/extract": "extract",
      "/admin/slide-ins": "slide-ins",
      "/admin/engagement": "engagement"
    };
    var page = map[path];
    if (page) links.forEach(function (a) {
      if (a.getAttribute("data-ws-page") === page) a.classList.add("is-active");
    });
  }

  var toggle = document.querySelector("[data-ws-toggle]");
  var backdrop = document.querySelector("[data-ws-backdrop]");
  if (toggle) toggle.addEventListener("click", function () { sidebar.classList.toggle("is-open"); });
  if (backdrop) backdrop.addEventListener("click", function () { sidebar.classList.remove("is-open"); });
})();
