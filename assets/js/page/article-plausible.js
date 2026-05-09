/*
 * Fire a Plausible "Article Read" custom event on post pages, with
 * title / primary_tag / author props extracted from the rendered DOM.
 *
 * Why on 'load' rather than inline: Ghost's proxied Plausible build
 * replaces window.plausible without replaying the queue shim, so
 * queued events fired during parse get silently dropped. Waiting for
 * 'load' guarantees the deferred tracker has installed the real
 * sender first.
 */
window.addEventListener("load", function () {
  if (!window.plausible) return;
  var titleEl = document.querySelector(".article-title");
  var title = titleEl ? titleEl.textContent.trim().slice(0, 200) : document.title;

  var tagEls = document.querySelectorAll(".article-topic-tag[data-tag-slug]");
  var primary_tag = "";
  var author = "";
  tagEls.forEach(function (el) {
    var slug = el.getAttribute("data-tag-slug") || "";
    if (!slug) return;
    if (slug.indexOf("author-") === 0) {
      if (!author) author = slug.replace(/^author-/, "");
    } else if (!primary_tag) {
      primary_tag = slug;
    }
  });

  window.plausible("Article Read", {
    props: { title: title, primary_tag: primary_tag, author: author },
  });
});
