(function () {
  function readAuthor() {
    var meta = document.querySelector('.article-meta');
    if (!meta) return '';
    var candidates = meta.querySelectorAll('.meta-author--candidate[data-tag-slug^="author-"] .meta-author-name em');
    var names = [];
    if (candidates.length) {
      for (var i = 0; i < candidates.length; i++) {
        var t = (candidates[i].textContent || '').trim();
        if (t) names.push(t);
      }
    } else {
      var fb = meta.querySelector('.meta-authors-fallback .meta-author-name em');
      if (fb) {
        var ft = (fb.textContent || '').trim();
        if (ft) names.push(ft);
      }
    }
    if (names.length === 0) return '';
    if (names.length === 1) return names[0];
    if (names.length === 2) return names[0] + ' and ' + names[1];
    return names.slice(0, -1).join(', ') + ', and ' + names[names.length - 1];
  }

  function buildText(title, author, url) {
    var head = title;
    var byline = author ? '\n\nby ' + author + ' at Mere Orthodoxy' : '';
    return head + byline + '\n\n' + url;
  }

  function init(box) {
    var title = box.getAttribute('data-share-title') || document.title || '';
    var url = box.getAttribute('data-share-url') || window.location.href;
    var author = readAuthor();
    var text = buildText(title, author, url);

    var x = box.querySelector('[data-share-target="x"]');
    if (x) {
      x.href = 'https://twitter.com/intent/tweet?text=' + encodeURIComponent(text);
    }

    var fb = box.querySelector('[data-share-target="facebook"]');
    if (fb) {
      fb.href = 'https://www.facebook.com/sharer/sharer.php?u=' + encodeURIComponent(url);
    }

    var email = box.querySelector('[data-share-target="email"]');
    if (email) {
      email.href = 'mailto:?subject=' + encodeURIComponent(title) + '&body=' + encodeURIComponent(text);
    }

    var copy = box.querySelector('[data-share-target="copy"]');
    if (copy) {
      copy.addEventListener('click', function (e) {
        e.preventDefault();
        if (!navigator.clipboard) return;
        navigator.clipboard.writeText(text).then(function () {
          var original = copy.getAttribute('aria-label') || '';
          copy.setAttribute('aria-label', 'Copied');
          copy.classList.add('share-btn--copied');
          setTimeout(function () {
            copy.setAttribute('aria-label', original);
            copy.classList.remove('share-btn--copied');
          }, 1500);
        }).catch(function () {});
      });
    }
  }

  function ready() {
    var boxes = document.querySelectorAll('[data-share]');
    for (var i = 0; i < boxes.length; i++) init(boxes[i]);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', ready);
  } else {
    ready();
  }
})();
