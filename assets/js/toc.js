(function () {
  // Build a table of contents from the <h2> elements Ghost renders inside
  // .article-content and inject entries into every [data-toc] container on
  // the page (currently: a sticky desktop rail and a mobile slot below the
  // hero image). Containers stay `hidden` if the article has no H2s, so
  // posts without subheads don't show an empty widget.

  var content = document.querySelector('.article-content');
  var containers = document.querySelectorAll('[data-toc]');
  if (!content || !containers.length) return;

  var headings = content.querySelectorAll('h2');
  if (!headings.length) return;

  var usedIds = Object.create(null);
  function slugify(text) {
    return (text || '')
      .toLowerCase()
      .trim()
      .replace(/[\s_]+/g, '-')
      .replace(/[^a-z0-9-]/g, '')
      .replace(/-+/g, '-')
      .replace(/^-|-$/g, '') || 'section';
  }
  function uniqueId(base) {
    var id = base;
    var n = 2;
    while (usedIds[id] || document.getElementById(id)) {
      id = base + '-' + n++;
    }
    usedIds[id] = true;
    return id;
  }

  var items = [];
  Array.prototype.forEach.call(headings, function (h2) {
    if (!h2.id) h2.id = uniqueId(slugify(h2.textContent));
    else usedIds[h2.id] = true;
    items.push({ id: h2.id, text: h2.textContent });
  });

  containers.forEach(function (container) {
    var list = container.querySelector('[data-toc-list]');
    if (!list) return;
    list.innerHTML = '';
    items.forEach(function (item) {
      var li = document.createElement('li');
      li.className = 'toc-item';
      var a = document.createElement('a');
      a.href = '#' + item.id;
      a.className = 'toc-link';
      a.textContent = item.text;
      li.appendChild(a);
      list.appendChild(li);
    });
    container.hidden = false;
  });
})();
