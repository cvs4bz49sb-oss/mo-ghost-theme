/*
 * Opens the magazine view at load on /journal/preview/, the free Issue
 * 005 preview framed by the Journal landing page. magazine.js builds the
 * book as a dialog behind a button; here the book is the whole page.
 */
(function () {
  "use strict";
  // The dialog closes on Escape and traps Tab. Inside a frame that would
  // blank the preview or hold keyboard focus, so neither reaches it.
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape" || e.key === "Tab") e.stopPropagation();
  }, true);
  // The cover, shown at once where the book will open. The magazine
  // clears its stage when the pages are set, which takes this away.
  const stage = document.querySelector("[data-mag-stage]");
  const cover = document.querySelector(".rd-title-page .rd-cover img");
  if (stage && cover) {
    const poster = document.createElement("div");
    poster.className = "pv-poster";
    const img = document.createElement("img");
    img.src = cover.currentSrc || cover.src;
    img.alt = "";
    poster.appendChild(img);
    stage.appendChild(poster);
  }
  const door = document.querySelector("[data-mag-open]");
  if (door) door.click();
})();
