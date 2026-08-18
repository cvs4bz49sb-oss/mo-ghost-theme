/*
 * Membership pricing cards — the whole card is the target.
 *
 * From /admin/heatmap/, 30 days of desktop homepage traffic on the
 * #join block: 52 clicks in the section, 5 of them on the actual
 * "Become a Member" button. Two landed on the featured card itself and
 * seven more on its benefit rows, all recorded as dead clicks — someone
 * clicked "Most Popular / Member / $100 /yr" and the page did nothing.
 * The card is styled like a target, so it should behave like one.
 *
 * The button stays canonical. It is the only keyboard path and the only
 * thing announced to a screen reader; deliberately no role="button" or
 * tabindex on the card, which would add a second tab stop to the same
 * action. This is a mouse convenience layered on top: if the script
 * never loads, nothing is lost but the shortcut.
 */
(function () {
  const cards = document.querySelectorAll("[data-card-cta]");
  if (!cards.length) return;

  // Anything in here already does something on click, including the
  // card's own CTA, so the card must keep its hands off it.
  const INTERACTIVE =
    "a, button, input, select, textarea, label, summary, " +
    "[role='button'], [role='link'], [data-portal], [onclick]";

  cards.forEach((card) => {
    card.addEventListener("click", (event) => {
      if (event.defaultPrevented || event.button !== 0) return;
      // Cmd/ctrl/shift-click means "new tab" or "new window" and belongs
      // to the browser, not to us.
      if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;

      const { target } = event;
      if (!target || target.nodeType !== 1) return;
      if (target.closest(INTERACTIVE)) return;

      // Someone dragging across the pitch copy is reading it, not
      // buying. Firing checkout under a text selection is hostile.
      const selection = window.getSelection();
      if (selection && String(selection).trim().length) return;

      const cta = card.querySelector(".btn");
      if (!cta || cta.disabled) return;
      cta.click();
    });
  });
})();
