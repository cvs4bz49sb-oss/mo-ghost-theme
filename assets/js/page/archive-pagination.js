/*
 * /archive/ pagination — renders a windowed list of page links
 * (current ± 2, plus first / last / ~5 landmarks evenly spread
 * across the range) so the bar gives a sense of scale even at 400+
 * pages. Plus an "I'm curious" random-page link.
 *
 * Driven by data-* attributes on the [data-pagination] nav element.
 */
(function () {
  const nav = document.querySelector("[data-pagination]");
  if (!nav) return;
  const page = parseInt(nav.getAttribute("data-page"), 10) || 1;
  const pages = parseInt(nav.getAttribute("data-pages"), 10) || 1;
  const base = nav.getAttribute("data-base") || "/";
  if (pages < 2) return;

  function url(n) { return n === 1 ? base : `${base}page/${n}/`; }

  const window_ = 2;
  const set = {};
  set[1] = true;
  set[pages] = true;
  for (let i = page - window_; i <= page + window_; i++) {
    if (i >= 1 && i <= pages) set[i] = true;
  }
  // Spread landmark pages across the full range so the bar
  // gives a sense of scale (e.g. 1 2 3 … 50 … 100 … 200 … 300 … 409).
  const landmarks = 5;
  for (let k = 1; k <= landmarks; k++) {
    const lm = Math.round((pages / (landmarks + 1)) * k);
    if (lm >= 1 && lm <= pages) set[lm] = true;
  }
  const nums = Object.keys(set).map(Number).sort((a, b) => { return a - b; });

  const list = nav.querySelector("[data-pagination-pages]");
  list.replaceChildren();
  let prev = 0;
  nums.forEach((n) => {
    if (prev && n - prev > 1) {
      const liDots = document.createElement("li");
      liDots.className = "pagination-ellipsis";
      liDots.textContent = "…";
      liDots.setAttribute("aria-hidden", "true");
      list.appendChild(liDots);
    }
    const li = document.createElement("li");
    if (n === page) {
      const cur = document.createElement("span");
      cur.className = "pagination-current";
      cur.setAttribute("aria-current", "page");
      cur.textContent = String(n);
      li.appendChild(cur);
    } else {
      const a = document.createElement("a");
      a.href = url(n);
      a.className = "pagination-num";
      a.textContent = String(n);
      li.appendChild(a);
    }
    list.appendChild(li);
    prev = n;
  });

  const curious = document.querySelector("[data-curious-link]");
  if (curious && pages > 1) {
    function setRandom() {
      const rp = Math.floor(Math.random() * pages) + 1;
      curious.href = url(rp);
    }
    setRandom();
    curious.addEventListener("click", () => { setRandom(); });
  }
})();
