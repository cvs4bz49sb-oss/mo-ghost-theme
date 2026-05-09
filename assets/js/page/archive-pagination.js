/*
 * /archive/ pagination — renders a windowed list of page links
 * (current ± 2, plus first / last / ~5 landmarks evenly spread
 * across the range) so the bar gives a sense of scale even at 400+
 * pages. Plus an "I'm curious" random-page link.
 *
 * Driven by data-* attributes on the [data-pagination] nav element.
 */
(function () {
  var nav = document.querySelector("[data-pagination]");
  if (!nav) return;
  var page = parseInt(nav.getAttribute("data-page"), 10) || 1;
  var pages = parseInt(nav.getAttribute("data-pages"), 10) || 1;
  var base = nav.getAttribute("data-base") || "/";
  if (pages < 2) return;

  function url(n) { return n === 1 ? base : base + "page/" + n + "/"; }

  var window_ = 2;
  var set = {};
  set[1] = true;
  set[pages] = true;
  for (var i = page - window_; i <= page + window_; i++) {
    if (i >= 1 && i <= pages) set[i] = true;
  }
  // Spread landmark pages across the full range so the bar
  // gives a sense of scale (e.g. 1 2 3 … 50 … 100 … 200 … 300 … 409).
  var landmarks = 5;
  for (var k = 1; k <= landmarks; k++) {
    var lm = Math.round((pages / (landmarks + 1)) * k);
    if (lm >= 1 && lm <= pages) set[lm] = true;
  }
  var nums = Object.keys(set).map(Number).sort(function (a, b) { return a - b; });

  var list = nav.querySelector("[data-pagination-pages]");
  list.replaceChildren();
  var prev = 0;
  nums.forEach(function (n) {
    if (prev && n - prev > 1) {
      var liDots = document.createElement("li");
      liDots.className = "pagination-ellipsis";
      liDots.textContent = "…";
      liDots.setAttribute("aria-hidden", "true");
      list.appendChild(liDots);
    }
    var li = document.createElement("li");
    if (n === page) {
      var cur = document.createElement("span");
      cur.className = "pagination-current";
      cur.setAttribute("aria-current", "page");
      cur.textContent = String(n);
      li.appendChild(cur);
    } else {
      var a = document.createElement("a");
      a.href = url(n);
      a.className = "pagination-num";
      a.textContent = String(n);
      li.appendChild(a);
    }
    list.appendChild(li);
    prev = n;
  });

  var curious = document.querySelector("[data-curious-link]");
  if (curious && pages > 1) {
    function setRandom() {
      var rp = Math.floor(Math.random() * pages) + 1;
      curious.href = url(rp);
    }
    setRandom();
    curious.addEventListener("click", function () { setRandom(); });
  }
})();
