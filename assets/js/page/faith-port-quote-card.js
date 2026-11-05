/*
 * The reader's quote image, in The Faith Received's template and a size
 * the reader picks.
 *
 * read-tools.js (Stiven's, vendored as-is) draws the card in a global
 * makeCard(text, cite, onReady) and hands the result to showQuoteImage,
 * which fills #nbImagePreview. We replace that function rather than edit
 * his file, so re-vendoring cannot drop the change. read-tools.js arrives
 * after this file (reader-core loads it from #frPortAssets the first time
 * Tools opens), and its function declaration would put his makeCard back,
 * so ours is reinstalled on every press before any click handler runs.
 * If his file ever stops declaring a top-level makeCard, this silently
 * does nothing: check that on every re-vendor.
 *
 * The drawing is MOQuoteCard (assets/js/quote-card.js, in site.min.js),
 * which loads after this file; it is looked up at click time. When it is
 * missing or fails, his card is drawn instead.
 */
(function () {
  const preview = document.getElementById("nbImagePreview");
  const select = document.getElementById("nbImageSize");
  const status = document.getElementById("nbActionStatus");
  let last = null, theirs = null, drawing = 0;

  function author() {
    return (typeof DATA !== "undefined" && DATA && DATA.author) ? String(DATA.author) : "";
  }

  // The cite read-tools passes begins with the author, who has a line of
  // their own on the card.
  function citeWithoutAuthor(cite, who) {
    const c = String(cite || "");
    return who && c.toLowerCase().startsWith(`${who.toLowerCase()}, `) ? c.slice(who.length + 2) : c;
  }

  function currentSize() {
    if (select && select.value) return select.value;
    return window.MOQuoteCard ? window.MOQuoteCard.savedSize("reader", "link") : "link";
  }

  function makeCard(text, cite, onReady) {
    last = { text, cite, onReady };
    if (!window.MOQuoteCard) { if (theirs) theirs(text, cite, onReady); return; }
    const run = ++drawing, who = author();
    window.MOQuoteCard.render({ brand: "tfr", size: currentSize(), quote: text, author: who, cite: citeWithoutAuthor(cite, who) })
      .then((r) => {
        // A newer size was picked while this one drew.
        if (run !== drawing) { URL.revokeObjectURL(r.url); return; }
        if (onReady) {
          onReady({ url: r.url, name: r.name });
          const img = preview && preview.querySelector("img");
          if (img) { img.width = r.width; img.height = r.height; }
          return;
        }
        const a = document.createElement("a");
        a.href = r.url; a.download = r.name; a.click();
        setTimeout(() => URL.revokeObjectURL(r.url), 4000);
      })
      .catch(() => {
        if (run !== drawing) return;
        if (theirs) theirs(text, cite, onReady);
        else if (status) status.textContent = "The quote image could not be made. Try again.";
      });
  }
  makeCard.mereO = true;

  function install() {
    const cur = window.makeCard;
    if (cur === makeCard) return;
    if (typeof cur === "function") theirs = cur;
    window.makeCard = makeCard;
  }
  install();
  ["pointerdown", "keydown", "touchstart"].forEach((t) => document.addEventListener(t, install, true));
  document.addEventListener("load", (e) => {
    if (e.target && e.target.tagName === "SCRIPT" && /read-tools\.js/.test(e.target.src || "")) install();
  }, true);

  if (select) {
    const restore = () => { if (window.MOQuoteCard) select.value = window.MOQuoteCard.savedSize("reader", "link"); };
    if (window.MOQuoteCard) restore(); else document.addEventListener("DOMContentLoaded", restore);
    select.addEventListener("change", () => {
      if (window.MOQuoteCard) window.MOQuoteCard.saveSize("reader", select.value);
      if (last && preview && !preview.hidden) { install(); makeCard(last.text, last.cite, last.onReady); }
    });
  }
})();
