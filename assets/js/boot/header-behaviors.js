/*
 * Header scroll-pin + mobile nav behaviors.
 *
 *   1. Site header is fixed-position. We measure its rendered height
 *      and add equivalent body padding-top + scroll-padding so anchor
 *      jumps land at the right offset and content doesn't slide under
 *      the header. Resize-observed so font-loading and viewport
 *      changes recompute.
 *
 *   2. Header hides on scroll-down past a small threshold; re-appears
 *      on any upward scroll. Pinned at top of page.
 *
 *   3. Mobile nav: tap toggles the slide-in panel. Pressing Escape,
 *      tapping the backdrop, or following a link inside the panel
 *      closes it. Body overflow is locked while open.
 */
(function () {
  const header = document.querySelector('.site-header');
  if (!header) return;

  const isFixed = () => getComputedStyle(header).position === 'fixed';

  function syncOffset() {
    // Only a fixed header needs paying for. /welcome/ puts the header back in
    // the flow so a full-height page needs no offset constant, and adding one
    // there reserves the header's height a SECOND time: an empty band above
    // the header, and that much less room for the survey. Clear the inline
    // styles rather than just skipping, or a page that starts fixed and goes
    // static keeps a stale offset.
    if (!isFixed()) {
      document.body.style.paddingTop = '';
      document.documentElement.style.scrollPaddingTop = '';
      return;
    }
    const h = header.getBoundingClientRect().height;
    document.body.style.paddingTop = `${h}px`;
    // Anchor jumps (href="#x") should land the target at the bottom
    // edge of the fixed nav.
    document.documentElement.style.scrollPaddingTop = `${h}px`;
  }
  syncOffset();
  window.addEventListener('resize', syncOffset);
  if (window.ResizeObserver) {
    new ResizeObserver(syncOffset).observe(header);
  }
  // This file is loaded before {{{body}}} on purpose (see default.hbs), which
  // means the page's own markup is not in the DOM yet. A rule keyed to it —
  // body:has(.welcome-page) makes the header static — therefore cannot match
  // on the first call, so the header reads as fixed and gets an offset it
  // does not want. The ResizeObserver does not save us: fixed-to-static does
  // not change the header's height, so it never fires. Re-check once the rest
  // of the document exists.
  document.addEventListener('DOMContentLoaded', syncOffset);
  window.addEventListener('load', syncOffset);

  let lastY = window.pageYOffset || window.scrollY || 0;
  const threshold = 80;
  const downDelta = 10;
  let ticking = false;
  function onScroll() {
    // An in-flow header must not be transformed away: it would take its space
    // with it and drag the page up under nothing.
    if (!isFixed()) return;
    const y = window.pageYOffset || window.scrollY || 0;
    if (y < threshold) {
      header.classList.remove('is-hidden');
    } else if (y > lastY + downDelta) {
      header.classList.add('is-hidden');
    } else if (y < lastY) {
      header.classList.remove('is-hidden');
    }
    lastY = y;
    ticking = false;
  }
  window.addEventListener('scroll', () => {
    if (!ticking) {
      window.requestAnimationFrame(onScroll);
      ticking = true;
    }
  }, { passive: true });
})();

(function () {
  const toggle = document.querySelector('.nav-toggle');
  const panel = document.getElementById('mobile-nav');
  if (!toggle || !panel) return;
  const closeBtn = panel.querySelector('.mobile-nav-close');
  const backdrop = panel.querySelector('.mobile-nav-backdrop');
  const links = panel.querySelectorAll('a, [data-portal]');

  function open() {
    panel.hidden = false;
    requestAnimationFrame(() => { panel.setAttribute('data-open', 'true'); });
    toggle.setAttribute('aria-expanded', 'true');
    document.body.style.overflow = 'hidden';
  }
  function close() {
    panel.removeAttribute('data-open');
    toggle.setAttribute('aria-expanded', 'false');
    document.body.style.overflow = '';
    setTimeout(() => { panel.hidden = true; }, 260);
  }

  toggle.addEventListener('click', () => {
    toggle.getAttribute('aria-expanded') === 'true' ? close() : open();
  });
  closeBtn.addEventListener('click', close);
  backdrop.addEventListener('click', close);
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && toggle.getAttribute('aria-expanded') === 'true') close();
  });
  links.forEach((l) => {
    l.addEventListener('click', () => { setTimeout(close, 50); });
  });
})();
