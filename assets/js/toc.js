(function () {
  // Build a table of contents from the <h2> elements Ghost renders inside
  // .article-content and inject entries into every [data-toc] container on
  // the page (currently: a sticky desktop rail and a mobile slot below the
  // hero image). Containers stay `hidden` if the article has no H2s, so
  // posts without subheads don't show an empty widget.

  const content = document.querySelector('.article-content');
  const containers = document.querySelectorAll('[data-toc]');
  if (!content || !containers.length) return;

  const headings = content.querySelectorAll('h2');
  if (!headings.length) return;

  const usedIds = Object.create(null);
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
    let id = base;
    let n = 2;
    while (usedIds[id] || document.getElementById(id)) {
      id = `${base}-${n++}`;
    }
    usedIds[id] = true;
    return id;
  }

  const items = [];
  Array.prototype.forEach.call(headings, (h2) => {
    if (!h2.id) h2.id = uniqueId(slugify(h2.textContent));
    else usedIds[h2.id] = true;
    items.push({ id: h2.id, text: h2.textContent });
  });

  containers.forEach((container) => {
    const list = container.querySelector('[data-toc-list]');
    if (!list) return;
    list.innerHTML = '';
    items.forEach((item) => {
      const li = document.createElement('li');
      li.className = 'toc-item';
      const a = document.createElement('a');
      a.href = `#${item.id}`;
      a.className = 'toc-link';
      a.textContent = item.text;
      li.appendChild(a);
      list.appendChild(li);
    });
    container.hidden = false;
  });
})();
