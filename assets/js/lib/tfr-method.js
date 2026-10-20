/* The Methodology disclosure (2026-10-20, Ian). One markup for every note that says HOW a number, chart, ranking or match
 * was produced, or what a term means: a native <details class="tfr-method"> closed under the figure it explains. It works
 * with no script, because the element does the opening. This file only builds the string for the JS renderers, so every
 * call site emits the same markup, and opens the notes for print.
 *
 * Use: TFRMethod.html("<p>How it was counted.</p>") returns the disclosure. A body that is plain text is wrapped in <p>.
 * The caller escapes anything that came from data; the body is HTML. Trust and safety notes (AI labels, "does not speak
 * for the library", report a problem, credits) stay visible and never go through here.
 * Styles: faith-site-theme.css (section "Methodology"). Loaded in default.hbs, so every page has both.
 */
(function (root) {
  'use strict';
  const LABEL = 'Methodology';
  const html = (body, label) => {
    const inner = String(body == null ? '' : body).trim();
    if (!inner) return '';
    const text = String(label || LABEL).replace(/[<>&"]/g, '');
    return `<details class="tfr-method"><summary class="tfr-method-s">${text}</summary><div class="tfr-method-b">${/^</.test(inner) ? inner : `<p>${inner}</p>`}</div></details>`;
  };
  root.TFRMethod = { html };
  if (typeof root.addEventListener !== 'function') return; // Node (the checks): the builder is all they need

  // Print shows every note open, then puts the reader's choice back. Newer browsers also get this from the stylesheet.
  const opened = [];
  root.addEventListener('beforeprint', () => {
    root.document.querySelectorAll('details.tfr-method:not([open])').forEach((d) => { d.open = true; opened.push(d); });
  });
  root.addEventListener('afterprint', () => {
    while (opened.length) opened.pop().open = false;
  });
})(typeof window === 'undefined' ? globalThis : window);
