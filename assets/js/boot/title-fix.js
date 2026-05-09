(function () {
  var site = "Mere Orthodoxy";
  var titles = {
    "/about/": "About",
    "/membership/": "Become a Member",
    "/archive/": "Archive",
    "/contributors/": "Contributors",
    "/submissions/": "Write for Mere Orthodoxy",
    "/the-faith-received/": "The Faith Received",
    "/the-faith-received/search/": "Search the Faith Received",
    "/the-faith-received/scripture/": "Scripture Index",
    "/the-faith-received/today/": "Today in the Faith Received",
    "/the-faith-received/topics/": "Topics",
    "/the-faith-received/devotional/": "Daily Devotional",
    "/give/": "Gift a Membership",
    "/donate/": "Donate",
    "/contact/": "Contact",
    "/events/": "Events",
    "/ebooks/": "Ebooks",
    "/forum/": "Forum",
    "/podcasts/mere-fidelity/": "Mere Fidelity Podcast",
    "/podcasts/christians-reading-classics/": "Christians Reading Classics Podcast",
    "/dashboard/": "Dashboard",
    "/dashboard/bookmarks/": "Bookmarks",
    "/dashboard/commonplace/": "Commonplace Book",
    "/dashboard/history/": "Reading History",
    "/dashboard/replays/": "Replays",
    "/dashboard/ebooks/": "My Ebooks",
    "/dashboard/journals/": "Journal Archive",
    "/manage/": "Manage Membership",
    "/success/": "Welcome"
  };

  var path = window.location.pathname;

  // Exact match first
  var custom = titles[path];

  // Faith Received document pages: /the-faith-received/slug/
  if (!custom && path.indexOf("/the-faith-received/") === 0) {
    var el = document.querySelector("h1");
    if (el) {
      custom = el.textContent.trim();
    } else {
      custom = "The Faith Received";
    }
  }

  // Faith Received topic pages: /the-faith-received/topics/slug/
  if (!custom && path.indexOf("/the-faith-received/topics/") === 0) {
    custom = "Topics";
  }

  // Archive pagination: /archive/page/N/
  if (!custom && path.indexOf("/archive/") === 0) {
    var m = path.match(/\/page\/(\d+)\//);
    custom = m ? "Archive (Page " + m[1] + ")" : "Archive";
  }

  // Ebook pages: /ebook/slug/
  if (!custom && path.indexOf("/ebook/") === 0) {
    custom = "Ebooks";
  }

  // Journal issue pages: /journal-archive/issue-NN/
  if (!custom && path.indexOf("/journal-archive/") === 0) {
    custom = "Journal Archive";
  }

  if (custom) {
    document.title = custom + " | " + site;
  }

  // Noindex for internal/admin pages that shouldn't appear in search
  var noindex = [
    "/admin/", "/dashboard/", "/manage/", "/success/",
    "/complete-membership/", "/migrate/", "/digest-gen/",
    "/group-manage/", "/institution-manage/", "/groups/",
    "/institutions/", "/forum/"
  ];
  for (var i = 0; i < noindex.length; i++) {
    if (path.indexOf(noindex[i]) === 0) {
      var meta = document.createElement("meta");
      meta.name = "robots";
      meta.content = "noindex, nofollow";
      document.head.appendChild(meta);
      break;
    }
  }
})();
