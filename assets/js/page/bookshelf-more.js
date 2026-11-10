/*
 * /books/ shelves show five rows of covers; "Show all" opens the rest.
 * The row limit lives in screen.css (.shelf.is-clamped), so the button
 * appears only when the current width actually hides books. Without
 * this script every book shows.
 */
(function () {
  document.querySelectorAll("[data-shelf]").forEach((shelf) => {
    const btn = shelf.querySelector("[data-shelf-more]");
    if (!btn) return;
    const books = shelf.querySelectorAll(".shelf-book");
    shelf.classList.add("is-clamped");

    function sync() {
      btn.hidden = !Array.prototype.some.call(books, (li) => { return li.offsetParent === null; });
    }
    sync();
    window.addEventListener("resize", sync);

    btn.addEventListener("click", () => {
      const firstHidden = Array.prototype.find.call(books, (li) => { return li.offsetParent === null; });
      shelf.classList.remove("is-clamped");
      window.removeEventListener("resize", sync);
      btn.hidden = true;
      const link = firstHidden && firstHidden.querySelector("a");
      if (link) link.focus();
    });
  });
})();
