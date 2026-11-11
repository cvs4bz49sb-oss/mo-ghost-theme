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
  const door = document.querySelector("[data-mag-open]");
  if (door) door.click();
})();
