/*
 * The Faith Received — guides to the shelves (/the-faith-received/guide/).
 *
 * One template, custom-faith-guide.hbs, serves every guide: ?s=<shelf>
 * picks one, and with no ?s= the page is the guides themselves under a
 * century ruler. This loader fetches the shelf's markup and data from
 * assets/data/faith-received/guides/, then runs the shared engine
 * (faith-guide-engine.js) and the shelf's own scenes
 * (faith-guide-<shelf>.js). The same three files make the stand-alone
 * previews the owner reviewed, so a guide reads the same in both.
 *
 * A guide is shown whole (a reader, 10-11: "a few little glitchy
 * things...might wanna have it give a loading status until all the
 * elements are loaded"). Its markup, its data, its map and its two
 * scripts are fetched at once, not one after another. A cover with the
 * progress stands over the guide while its scenes are drawn and their
 * pins measured out of sight, and it lifts when they are in place. Until
 * then the reader saw the guide's own title before the band took it, the
 * figures at 0 beside an empty picture, and the page grow by 45,000px.
 *
 * Versions below are each file's frv (the first 16 hex of its sha256),
 * stamped by the export that writes these files.
 */
(() => {
  const SHELVES = {"library": {"name": "Guides to the Shelves", "cls": "lib"}, "english": {"name": "The English Divines", "cls": "eng", "land": true}, "westminster": {"name": "The Westminster Assembly", "cls": "wes", "land": true}, "puritans": {"name": "The Puritans", "cls": "pur"}, "anglicans": {"name": "The Anglicans", "cls": "ang"}, "methodists": {"name": "The Methodists", "cls": "met"}, "councils": {"name": "The Councils", "cls": "cou", "bare": true, "land": true}, "greek": {"name": "The Greek Fathers", "cls": "gre", "land": true}, "latin": {"name": "The Latin Fathers", "cls": "lat", "land": true}, "medieval": {"name": "The Medieval Shelf", "cls": "med", "land": true}, "catholic": {"name": "Roman Catholic", "cls": "cat", "land": true}, "reformed": {"name": "Continental Reformed", "cls": "ref", "land": true}, "lutheran": {"name": "Lutheran", "cls": "lut", "land": true}, "eastern": {"name": "The Eastern Fathers", "cls": "eas"}};
  const V = {"reformed.html": "813cb90eac5f8449", "reformed.json": "c1ad47c495ffa419", "reformed": "e0cafeeabbfe797e", "library.html": "53bba38bb5dbcb43", "library.json": "4032275dd4bf3f64", "library": "cd623161f3080535", "english.html": "bc0e39552e4ea005", "english.json": "93a305c3acb090a1", "english": "c540ce38b363c27f", "westminster.html": "79a8270dfc5972e0", "westminster.json": "6810ce6fa284b50e", "westminster": "7219aa0c4bb39911", "puritans.html": "9640bc23bfddb975", "puritans.json": "cfb09e35ecbee27e", "puritans": "6d1ccf175be87a70", "anglicans.html": "0cfef67531644023", "anglicans.json": "034ab2c903086dd7", "anglicans": "a74811b7ed7c2b54", "methodists.html": "83fcbb6b8a10497e", "methodists.json": "f26204fc4abcd8fb", "methodists": "0bc80bf3e6450970", "councils.html": "fb9c82f68ceb5d3c", "councils.json": "f4e31af4976d0feb", "councils": "7108ab3576b7f724", "greek.html": "a06455b3897412f4", "greek.json": "3dc0723d527a65e4", "greek": "933ef14384fb6286", "latin.html": "aa90d875d3d85eb6", "latin.json": "7cfcf32327ec2b53", "latin": "ada78f27d96b5ab1", "medieval.html": "1d5a93683440a9a8", "medieval.json": "b8d0b7cf3611617c", "medieval": "6024f91fcaf7d4c8", "catholic.html": "c495bad031ba0c6c", "catholic.json": "14d4717be4d62779", "catholic": "034b7d6e8c4794c0", "lutheran.html": "4022ae44d76745eb", "lutheran.json": "6773d66a53af987c", "lutheran": "26cb506ac475c8cc", "eastern.html": "0c4c0c39179530ac", "eastern.json": "5e4e46688c1fe174", "eastern": "d4e9f05ac5381a2d", "engine": "5d95932ae4caccca", "europe_land.json": "bb985d269feafed6"};
  const root = document.querySelector("[data-guide-root]");
  if (!root) return;
  const {assets} = root.dataset;
  const asked = new URLSearchParams(location.search).get("s") || "";
  const key = Object.prototype.hasOwnProperty.call(SHELVES, asked) ? asked : "library";
  const shelf = SHELVES[key];
  const v = (name) => `?v=${V[name] || "0"}`;
  const ENGINE = `/assets/js/faith-guide-engine.js${v("engine")}`;
  const SCENES = `/assets/js/faith-guide-${key}.js${v(key)}`;

  // the cover: the shelf's name, a rule that fills as the parts arrive, and what is being loaded
  const cover = document.createElement("div");
  cover.className = "tg-cover";
  cover.setAttribute("role", "status");
  cover.innerHTML = '<p class="tg-cover-k"></p><p class="tg-cover-t">Loading the guide…</p><div class="tg-cover-bar" aria-hidden="true"><i></i></div><p class="tg-cover-s">Loading the page</p>';
  cover.querySelector(".tg-cover-k").textContent = key === "library" ? "Guides to the shelves" : shelf.name;
  const bar = cover.querySelector(".tg-cover-bar i");
  const say = cover.querySelector(".tg-cover-s");
  let done = 0;
  const step = (n, text) => {
    done = Math.min(100, done + n);
    bar.style.width = `${done}%`;
    if (text) say.textContent = text;
  };
  root.classList.add("tg-wait");
  root.setAttribute("aria-busy", "true");
  root.replaceChildren(cover);
  step(5);

  const fail = () => {
    root.classList.remove("tg-wait");
    root.removeAttribute("aria-busy");
    root.innerHTML = '<div class="wrap gut" style="padding-block:64px"><p>This guide could not be loaded. <a href="/the-faith-received/guide/">See all the guides</a> or <a href="/the-faith-received/all-works/">browse the shelves</a>.</p></div>';
  };
  const text = (url) => fetch(url).then((r) => (r.ok ? r.text() : Promise.reject(new Error(`HTTP ${r.status}`))));
  const script = (src) => new Promise((resolve, reject) => {
    const s = document.createElement("script");
    s.src = src;
    s.onload = resolve;
    s.onerror = reject;
    document.body.appendChild(s);
  });
  // the two scripts download while the data does; they run once the markup and the data are in the page
  [ENGINE, SCENES].forEach((href) => {
    const l = document.createElement("link");
    l.rel = "preload";
    l.as = "script";
    l.href = href;
    document.head.appendChild(l);
  });
  // the data goes in as JSON in the page, the form the stand-alone previews use: the engine's TG.load and the
  // Councils guide's own loader read #tg-<name> before they fetch (in the head, so the links pass never reads it)
  const inline = (name, json) => {
    const s = document.createElement("script");
    s.type = "application/json";
    s.id = `tg-${name}`;
    s.textContent = json;
    document.head.appendChild(s);
  };
  // this script comes before GSAP, ScrollTrigger and d3 in the page (from jsDelivr), so the guide's files are fetched while those are;
  // the scenes run once the page has been read to its end and those are in
  const parsed = document.readyState === "loading" ? new Promise((resolve) => { document.addEventListener("DOMContentLoaded", () => resolve(), { once: true }); }) : Promise.resolve();
  // MereO (2026-10-12): a frame or half a second, whichever comes first; a tab opened behind another gets no frames, and the cover must not wait on one
  const frame = () => new Promise((resolve) => { requestAnimationFrame(() => resolve()); setTimeout(resolve, 500); });
  // the page band takes the guide's title and line (faith-guide-skin.js, which runs after this script); the guide shows once it has,
  // or after two seconds if it cannot
  const skinned = () => !document.querySelector('script[src*="faith-guide-skin"]') || root.classList.contains("tfr-guide-skinned");
  const skin = () => new Promise((resolve) => {
    if (skinned()) { resolve(); return; }
    const mo = new MutationObserver(() => { if (skinned()) { mo.disconnect(); resolve(); } });
    mo.observe(root, { attributes: true, attributeFilter: ["class"] });
    setTimeout(() => { mo.disconnect(); resolve(); }, 2000);
  });
  const wait = (ms) => new Promise((resolve) => { setTimeout(resolve, ms); });

  if (asked && key === "library") history.replaceState(null, "", location.pathname);
  document.title = key === "library" ? "Guides to the Shelves | The Faith Received | Mere Orthodoxy" : `${shelf.name} | Guides to the Shelves | The Faith Received`;
  const dataURL = `${assets}${key}.json${v(`${key}.json`)}`;
  const landURL = `${assets}europe_land.json${v("europe_land.json")}`;
  const data = text(dataURL).then((t) => { step(45); return t; });
  const land = shelf.land ? text(landURL).then((t) => { step(5); return t; }) : Promise.resolve(step(5));
  data.catch(() => {});
  land.catch(() => {});
  text(`${assets}${key}.html${v(`${key}.html`)}`)
    .then((html) => {
      // the Councils guide keeps its own scoped styles (.tg-cou) and does not take the shared .tg ones
      if (shelf.bare) root.classList.remove("tg");
      root.classList.add(`tg-${shelf.cls}`);
      root.dataset.data = dataURL;
      root.dataset.land = landURL;
      // the markup goes in at once, out of sight under the cover, so its type starts loading while the data does
      root.innerHTML = html;
      root.prepend(cover);
      step(15, "Loading the works and authors");
      return Promise.all([data, land, parsed]);
    })
    .then(([d, l]) => {
      inline("data", d);
      if (typeof l === "string") inline("land", l);
      step(0, "Drawing the guide");
      return script(ENGINE);
    })
    .then(() => { step(5); return script(SCENES); })
    // the scenes are built when their script has run; the engine's Key Works and Who's who follow a frame later.
    // Then the type: a title set in IM Fell is taller than its fallback, and the pins are measured with it.
    .then(() => { step(15); return frame(); })
    .then(frame)
    .then(() => Promise.race([document.fonts ? document.fonts.ready : null, wait(1500)]))
    .then(skin)
    .then(() => {
      step(100);
      root.classList.remove("tg-wait");
      root.removeAttribute("aria-busy");
      // every pin measured again in page order, now the guide stands at its full height
      if (window.TG && window.TG.inOrder) window.TG.inOrder();
      else if (window.ScrollTrigger) window.ScrollTrigger.refresh();
      root.dispatchEvent(new Event("tg-shown"));
      cover.classList.add("tg-done");
      setTimeout(() => cover.remove(), 450);
      document.querySelectorAll('head > script[type="application/json"][id^="tg-"]').forEach((s) => s.remove());
      if (location.hash) {
        const t = document.getElementById(location.hash.slice(1));
        if (t) setTimeout(() => t.scrollIntoView(), 60);
      }
    })
    .catch(fail);
})();
