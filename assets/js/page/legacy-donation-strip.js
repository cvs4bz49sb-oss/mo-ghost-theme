/*
 * Strip the legacy "Enjoy the article? Pay the writer." donation form
 * that was baked into ~580 HubSpot-migrated post bodies.
 *
 * The form is always: an <h2 id="enjoy-the-article-pay-the-writer">
 * followed by 6-7 sibling elements ending with "Donation Total: $0".
 * We remove the h2 and every sibling after it up to and including the
 * "Donation Total" paragraph, leaving any legitimate content (footnotes,
 * image credits) that may follow intact.
 */
(function () {
  const heading = document.getElementById("enjoy-the-article-pay-the-writer");
  if (!heading) return;

  const toRemove = [heading];
  let el = heading.nextElementSibling;

  while (el) {
    toRemove.push(el);
    if (el.textContent && el.textContent.indexOf("Donation Total") !== -1) break;
    el = el.nextElementSibling;
  }

  for (let i = 0; i < toRemove.length; i++) {
    toRemove[i].parentNode.removeChild(toRemove[i]);
  }
})();
