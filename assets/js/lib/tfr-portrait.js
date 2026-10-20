/*
 * The portrait, one helper (see assets/css/tfr-portrait.css).
 *
 * Portraits live in assets/data/faith-received/guides/portraits/ and the
 * shelf guides say who made each one. author-portraits.json (built by
 * scripts/build-author-portraits.mjs) gathers that into one small file.
 * This helper:
 *   - resolves an author to a portrait: the room's slug, then the alias
 *     map, then the folded name (accents and punctuation ignored);
 *   - gives the picture's address with its content hash (the manifest's
 *     `f`), so a replaced picture is never served stale;
 *   - puts the source in the image's own metadata: title, alt and
 *     data-credit carry artist, date, licence and the source link. Nothing
 *     visible is drawn for public-domain and CC0 pictures;
 *   - upgrades any <img data-por="<slug>"> the page draws (Topic Desk,
 *     Verse Desk, Traditions, author room) as it appears.
 * Strings are set with textContent or attributes only.
 */
(function () {
  "use strict";
  const BASE = "/assets/data/faith-received/guides/";
  const MANIFEST = "/assets/data/faith-received/author-portraits.json";
  const fold = (s) => String(s || "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[^a-z0-9]/g, "");
  let loaded = null;

  function load() {
    if (!loaded) {
      const url = window.moDataUrl ? window.moDataUrl(MANIFEST) : MANIFEST;
      loaded = fetch(url).then((r) => (r.ok ? r.json() : null)).catch(() => null);
    }
    return loaded;
  }
  function find(m, name, slug) {
    if (!m || !m.p) return null;
    const id = (slug && m.p[slug] && slug) || (slug && m.alias && m.alias[slug]) || (m.by || {})[fold(name)];
    return id && m.p[id] ? { id, ...m.p[id] } : null;
  }
  const url = (p) => `${BASE}${p.f}`;
  const initials = (name) => String(name).split(/\s+/).filter((w) => /^[A-ZÀ-Þ]/.test(w)).slice(0, 2).map((w) => w[0]).join("") || String(name).slice(0, 1);
  // Public domain, CC0 and "no restrictions" ask for nothing on the page.
  const needsCredit = (p) => !/^(public domain|cc0|no restrictions)/i.test(p.l || "");
  const who = (p) => [p.a, p.d].filter(Boolean).join(", ");
  const kindWord = (p) => ({ painting: "Painting", engraving: "Engraving", woodcut: "Woodcut", icon: "Icon", illumination: "Illumination", drawing: "Drawing" }[p.k] || "Portrait");
  // The long form, for title, data-credit and the credits list.
  const credit = (p) => `${kindWord(p)}: ${who(p) || "artist unknown"}${p.l ? `. ${p.l}` : ""}${/^https:\/\//.test(p.u) ? `. Source: ${p.u}` : ""}`;

  function dress(img, p, name) {
    img.src = url(p);
    const label = name || p.n;
    if (!img.alt) img.alt = `Portrait of ${label}`;
    img.title = `${label}. ${credit(p)}`;
    img.setAttribute("data-credit", credit(p));
    if (!img.width) { img.width = 84; img.height = 84; }
  }

  // A finished portrait: <span class="tfr-por tfr-por--size"> with the picture, or initials when there is none.
  function node(name, p, size) {
    const wrap = document.createElement("span");
    wrap.className = `tfr-por tfr-por--${size || "m"}`;
    const ini = document.createElement("span");
    ini.className = "tfr-por-ini";
    ini.setAttribute("aria-hidden", "true");
    ini.textContent = initials(name);
    if (p) {
      const img = document.createElement("img");
      img.setAttribute("data-por-done", "");
      dress(img, p, name);
      const px = { s: 56, m: 84, l: 168 }[size || "m"];
      img.width = px;
      img.height = px;
      img.decoding = "async";
      img.addEventListener("error", () => { img.remove(); ini.hidden = false; });
      ini.hidden = true;
      wrap.append(img, ini);
    } else {
      wrap.append(ini);
    }
    return wrap;
  }

  // A quiet visible credit, only for a licence that asks for one.
  function creditLine(p) {
    if (!p || !needsCredit(p)) return null;
    const line = document.createElement("small");
    line.className = "tfr-por-credit";
    line.append(`${who(p) || "Artist unknown"} · ${p.l}`);
    if (/^https:\/\//.test(p.u)) {
      const a = document.createElement("a");
      a.href = p.u;
      a.rel = "noopener noreferrer";
      a.target = "_blank";
      a.textContent = " Source";
      line.append(a);
    }
    return line;
  }

  // Schema.org for an author page: the person and the picture, with its creator, licence and where it came from.
  function jsonLd(name, p, pageUrl) {
    const id = "tfr-por-jsonld";
    const old = document.getElementById(id);
    if (old) old.remove();
    if (!p) return;
    const image = { "@type": "ImageObject", contentUrl: new URL(url(p), location.origin).href, name: `Portrait of ${name}`, description: credit(p) };
    if (p.a && p.a !== "Unknown artist") image.creator = { "@type": "Person", name: p.a };
    if (p.d) image.dateCreated = p.d;
    if (p.l) image.license = p.l;
    if (/^https:\/\//.test(p.u)) { image.acquireLicensePage = p.u; image.isBasedOn = p.u; }
    const s = document.createElement("script");
    s.type = "application/ld+json";
    s.id = id;
    s.textContent = JSON.stringify({ "@context": "https://schema.org", "@type": "Person", name, image, url: pageUrl || location.href }).replace(/</g, "\\u003c");
    document.head.append(s);
  }

  // Any <img data-por="slug"> a page draws is resolved and dressed as it appears.
  function upgrade() {
    const imgs = document.querySelectorAll("img[data-por]:not([data-por-done])");
    if (!imgs.length) return;
    imgs.forEach((i) => i.setAttribute("data-por-done", ""));
    load().then((m) => {
      imgs.forEach((img) => {
        const p = find(m, img.getAttribute("data-por-name") || "", img.getAttribute("data-por"));
        if (!p) return;
        dress(img, p, img.getAttribute("data-por-name") || p.n);
        // A picture that does not load gives way to the initials the page already drew.
        img.addEventListener("error", () => {
          const ini = img.parentElement && img.parentElement.querySelector(".tfr-por-ini, .ini");
          img.remove();
          if (ini) ini.hidden = false;
        }, { once: true });
      });
    });
  }
  let queued = false;
  const schedule = () => {
    if (queued) return;
    queued = true;
    requestAnimationFrame(() => { queued = false; upgrade(); });
  };
  new MutationObserver(schedule).observe(document.documentElement, { childList: true, subtree: true });
  schedule();

  window.TFRPortrait = { load, find, url, initials, node, credit, creditLine, jsonLd, needsCredit };
})();
