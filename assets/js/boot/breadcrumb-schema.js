(function () {
  var site = "Mere Orthodoxy";
  var origin = window.location.origin;
  var path = window.location.pathname;

  var crumbs = [{ name: "Home", url: origin + "/" }];

  var routes = {
    "/about/": [{ name: "About" }],
    "/membership/": [{ name: "Membership" }],
    "/archive/": [{ name: "Archive" }],
    "/contributors/": [{ name: "Contributors" }],
    "/submissions/": [{ name: "Write for Us" }],
    "/contact/": [{ name: "Contact" }],
    "/events/": [{ name: "Events" }],
    "/ebooks/": [{ name: "Ebooks" }],
    "/give/": [{ name: "Gift a Membership" }],
    "/donate/": [{ name: "Donate" }],
    "/the-faith-received/": [{ name: "The Faith Received" }],
    "/podcasts/mere-fidelity/": [{ name: "Podcasts", url: "/" }, { name: "Mere Fidelity" }],
    "/podcasts/christians-reading-classics/": [{ name: "Podcasts", url: "/" }, { name: "Christians Reading Classics" }]
  };

  var match = routes[path];

  if (match) {
    match.forEach(function (c) {
      crumbs.push({ name: c.name, url: c.url ? origin + c.url : origin + path });
    });
  } else if (path.indexOf("/the-faith-received/") === 0 && path !== "/the-faith-received/") {
    crumbs.push({ name: "The Faith Received", url: origin + "/the-faith-received/" });
    var h1 = document.querySelector("h1");
    if (h1) crumbs.push({ name: h1.textContent.trim() });
  } else if (path.indexOf("/archive/page/") === 0) {
    crumbs.push({ name: "Archive", url: origin + "/archive/" });
    var pm = path.match(/\/page\/(\d+)\//);
    if (pm) crumbs.push({ name: "Page " + pm[1] });
  } else if (path.indexOf("/tag/") === 0) {
    var h1 = document.querySelector("h1");
    var isContrib = document.querySelector('[data-tag-slug^="author-"]');
    if (isContrib) {
      crumbs.push({ name: "Contributors", url: origin + "/contributors/" });
    }
    if (h1) crumbs.push({ name: h1.textContent.trim() });
  } else if (path.indexOf("/ebook/") === 0) {
    crumbs.push({ name: "Ebooks", url: origin + "/ebooks/" });
    var h1 = document.querySelector("h1");
    if (h1) crumbs.push({ name: h1.textContent.trim() });
  } else if (document.querySelector("article.post")) {
    var topic = document.querySelector("[data-topic] [data-tag-slug]:not([data-tag-slug^='author-']):not([data-tag-slug^='hash-'])");
    if (topic) {
      var slug = topic.getAttribute("data-tag-slug");
      crumbs.push({ name: topic.textContent.trim(), url: origin + "/tag/" + slug + "/" });
    }
    var h1 = document.querySelector("h1");
    if (h1) crumbs.push({ name: h1.textContent.trim() });
  } else {
    return;
  }

  if (crumbs.length < 2) return;

  var items = crumbs.map(function (c, i) {
    var item = {
      "@type": "ListItem",
      "position": i + 1,
      "name": c.name
    };
    if (c.url) item.item = c.url;
    return item;
  });

  var schema = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    "itemListElement": items
  };

  var script = document.createElement("script");
  script.type = "application/ld+json";
  script.textContent = JSON.stringify(schema);
  document.head.appendChild(script);
})();
