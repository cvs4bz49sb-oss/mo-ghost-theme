(function () {
  function readAuthor() {
    const meta = document.querySelector('.article-meta');
    if (!meta) return '';
    const candidates = meta.querySelectorAll('.meta-author--candidate[data-tag-slug^="author-"] .meta-author-name em');
    const names = [];
    if (candidates.length) {
      for (let i = 0; i < candidates.length; i++) {
        const t = (candidates[i].textContent || '').trim();
        if (t) names.push(t);
      }
    } else {
      const fb = meta.querySelector('.meta-authors-fallback .meta-author-name em');
      if (fb) {
        const ft = (fb.textContent || '').trim();
        if (ft) names.push(ft);
      }
    }
    if (names.length === 0) return '';
    if (names.length === 1) return names[0];
    if (names.length === 2) return `${names[0]} and ${names[1]}`;
    return `${names.slice(0, -1).join(', ')}, and ${names[names.length - 1]}`;
  }

  function buildText(title, author, url) {
    const head = title;
    const byline = author ? `\n\nby ${author} at Mere Orthodoxy` : '';
    return `${head + byline}\n\n${url}`;
  }

  function init(box) {
    const title = box.getAttribute('data-share-title') || document.title || '';
    const url = box.getAttribute('data-share-url') || window.location.href;
    const author = readAuthor();
    const text = buildText(title, author, url);

    const x = box.querySelector('[data-share-target="x"]');
    if (x) {
      x.href = `https://twitter.com/intent/tweet?text=${encodeURIComponent(text)}`;
    }

    const fb = box.querySelector('[data-share-target="facebook"]');
    if (fb) {
      fb.href = `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(url)}`;
    }

    const email = box.querySelector('[data-share-target="email"]');
    if (email) {
      email.href = `mailto:?subject=${encodeURIComponent(title)}&body=${encodeURIComponent(text)}`;
    }

    const copy = box.querySelector('[data-share-target="copy"]');
    if (copy) {
      copy.addEventListener('click', (e) => {
        e.preventDefault();
        if (!navigator.clipboard) return;
        navigator.clipboard.writeText(url).then(() => {
          const original = copy.getAttribute('aria-label') || '';
          copy.setAttribute('aria-label', 'Copied');
          copy.classList.add('share-btn--copied');
          setTimeout(() => {
            copy.setAttribute('aria-label', original);
            copy.classList.remove('share-btn--copied');
          }, 1500);
        }).catch(() => {});
      });
    }
  }

  function ready() {
    const boxes = document.querySelectorAll('[data-share]');
    for (let i = 0; i < boxes.length; i++) init(boxes[i]);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', ready);
  } else {
    ready();
  }
})();
