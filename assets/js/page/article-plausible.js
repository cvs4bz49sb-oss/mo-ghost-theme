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
window.addEventListener("load", () => {
  if (!window.plausible) return;
  const titleEl = document.querySelector(".article-title");
  const title = titleEl ? titleEl.textContent.trim().slice(0, 200) : document.title;

  // Structural tags are public, so they render as pills and used to win the
  // primary_tag slot: "featured" and "uncategorized" sit first on a third of
  // all posts, which filed a third of reads under a non-topic and made
  // top-topics unusable for comparing demand against output. Skip them and
  // take the first real topic instead. Issue tags (winter-2026) are the same
  // problem in a form that grows every quarter, hence the pattern.
  const NON_TOPIC = ["featured", "uncategorized", "journal", "trivial-link",
    "mere-fidelity", "earthen-vessels", "passages", "podcast"];
  const isNonTopic = (slug) =>
    NON_TOPIC.indexOf(slug) !== -1 || /^(winter|spring|summer|fall|autumn)-\d{4}$/.test(slug);

  const tagEls = document.querySelectorAll(".article-topic-tag[data-tag-slug]");
  let primary_tag = "";
  let fallback_tag = "";
  let author = "";
  tagEls.forEach((el) => {
    const slug = el.getAttribute("data-tag-slug") || "";
    if (!slug) return;
    if (slug.indexOf("author-") === 0) {
      if (!author) author = slug.replace(/^author-/, "");
    } else if (isNonTopic(slug)) {
      // Keep it only as a last resort: a post tagged nothing but "featured"
      // should still report something rather than an empty string.
      if (!fallback_tag) fallback_tag = slug;
    } else if (!primary_tag) {
      primary_tag = slug;
    }
  });
  if (!primary_tag) primary_tag = fallback_tag;

  window.plausible("Article Read", {
    props: { title, primary_tag, author },
  });
});
