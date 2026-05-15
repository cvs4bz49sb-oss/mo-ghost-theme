(function () {
  "use strict";

  const root = document.querySelector("[data-extract-creator]");
  if (!root) return;

  const siteUrl = (root.dataset.siteUrl || "").replace(/\/$/, "");
  const contentApiKey = root.dataset.contentApiKey || "";

  const $url = root.querySelector("[data-extract-url]");
  const $pullBtn = root.querySelector("[data-extract-pull]");
  const $status = root.querySelector("[data-extract-status]");
  const $output = root.querySelector("[data-extract-output]");
  const $title = root.querySelector("[data-extract-title]");
  const $author = root.querySelector("[data-extract-author]");
  const $excerpt = root.querySelector("[data-extract-excerpt]");
  const $excerptCard = root.querySelector("[data-extract-excerpt-card]");
  const $tags = root.querySelector("[data-extract-tags]");
  const $tagsCard = root.querySelector("[data-extract-tags-card]");
  const $image = root.querySelector("[data-extract-image]");
  const $imageCard = root.querySelector("[data-extract-image-card]");
  const $plaintext = root.querySelector("[data-extract-plaintext]");
  const $bio = root.querySelector("[data-extract-bio]");
  const $bioCard = root.querySelector("[data-extract-bio-card]");

  let articleData = {};

  $pullBtn.addEventListener("click", extract);

  root.querySelectorAll("[data-extract-copy]").forEach((btn) => {
    btn.addEventListener("click", () => {
      const key = btn.dataset.extractCopy;
      let text = "";
      if (key === "title") text = articleData.title || "";
      else if (key === "author") text = articleData.author || "";
      else if (key === "excerpt") text = articleData.excerpt || "";
      else if (key === "tags") text = articleData.tags || "";
      else if (key === "bio") text = articleData.bio || "";
      else if (key === "image") text = articleData.feature_image || "";
      else if (key === "plaintext") {
        const html = articleData.html || "";
        const plain = articleData.plaintext || "";
        if (html) {
          navigator.clipboard.write([new ClipboardItem({
            "text/html": new Blob([html], { type: "text/html" }),
            "text/plain": new Blob([plain], { type: "text/plain" })
          })]).then(() => {
            btn.textContent = "Copied";
            setTimeout(() => { btn.textContent = "Copy all"; }, 1400);
          });
          return;
        }
        text = plain;
      }
      if (text) navigator.clipboard.writeText(text).then(() => {
        btn.textContent = "Copied";
        const resetLabel = key === "image" ? "Copy URL" : key === "plaintext" ? "Copy all" : "Copy";
        setTimeout(() => { btn.textContent = resetLabel; }, 1400);
      });
    });
  });

  const $copyImageBtn = root.querySelector("[data-extract-copy-image]");
  if ($copyImageBtn) {
    $copyImageBtn.addEventListener("click", async () => {
      const url = articleData.feature_image;
      if (!url) return;
      $copyImageBtn.textContent = "Copying…";
      try {
        const img = new Image();
        img.crossOrigin = "anonymous";
        await new Promise((resolve, reject) => {
          img.onload = resolve;
          img.onerror = reject;
          img.src = url;
        });
        const canvas = document.createElement("canvas");
        canvas.width = img.naturalWidth;
        canvas.height = img.naturalHeight;
        canvas.getContext("2d").drawImage(img, 0, 0);
        const pngBlob = await new Promise((resolve) => { canvas.toBlob(resolve, "image/png"); });
        await navigator.clipboard.write([new ClipboardItem({ "image/png": pngBlob })]);
        $copyImageBtn.textContent = "Copied";
      } catch (e) {
        console.error("Copy image failed:", e);
        navigator.clipboard.writeText(url).then(() => {
          $copyImageBtn.textContent = "URL copied";
        });
      }
      setTimeout(() => { $copyImageBtn.textContent = "Copy Image"; }, 1400);
    });
  }

  async function extract() {
    const url = $url.value.trim();
    if (!url) return;
    if (!contentApiKey) { setStatus("Content API key not configured.", true); return; }

    const slug = url.split("/").filter(Boolean).pop();
    if (!slug) { setStatus("Could not extract slug from URL.", true); return; }

    $pullBtn.disabled = true;
    $pullBtn.textContent = "Extracting...";
    setStatus("");

    try {
      const apiUrl = `${siteUrl}/ghost/api/content/posts/slug/${slug 
        }/?key=${contentApiKey 
        }&include=authors,tags&formats=plaintext,html`;
      const resp = await fetch(apiUrl);
      const data = await resp.json();
      const post = data.posts && data.posts[0];
      if (!post) throw new Error("Article not found");

      const allTags = post.tags || [];
      const authorTags = allTags
        .filter((t) => { return t.slug && t.slug.indexOf("author-") === 0; })
        .map((t) => { return t.name; });
      const authorName = authorTags.length
        ? authorTags.join(", ")
        : (post.primary_author && post.primary_author.name) || "";

      let authorBio = "";
      const authorTagObj = allTags.find((t) => { return t.slug && t.slug.indexOf("author-") === 0 && t.description; });
      if (authorTagObj) authorBio = authorTagObj.description;

      const publicTags = allTags
        .filter((t) => {
          return t.name && t.name.charAt(0) !== "#" && !(t.slug && t.slug.indexOf("author-") === 0);
        })
        .map((t) => { return t.name; });

      articleData = {
        title: post.title || "",
        author: authorName,
        excerpt: post.custom_excerpt || "",
        tags: publicTags.join(", "),
        feature_image: post.feature_image || "",
        published_at: post.published_at || "",
        reading_time: post.reading_time || 0,
        plaintext: post.plaintext || "",
        html: post.html || "",
        bio: authorBio
      };

      renderArticle(articleData);
    } catch (err) {
      console.error("Extract failed:", err);
      setStatus(`Failed: ${err.message || err}`, true);
    } finally {
      $pullBtn.disabled = false;
      $pullBtn.textContent = "Extract";
    }
  }

  function renderArticle(a) {
    $output.hidden = false;

    $title.textContent = a.title;
    $author.textContent = a.author;

    if (a.bio) {
      $bioCard.hidden = false;
      $bio.textContent = a.bio;
    } else {
      $bioCard.hidden = true;
    }

    if (a.excerpt) {
      $excerptCard.hidden = false;
      $excerpt.textContent = a.excerpt;
    } else {
      $excerptCard.hidden = true;
    }

    if (a.tags) {
      $tagsCard.hidden = false;
      $tags.textContent = a.tags;
    } else {
      $tagsCard.hidden = true;
    }

    if (a.feature_image) {
      $imageCard.hidden = false;
      $image.src = a.feature_image;
    } else {
      $imageCard.hidden = true;
    }

    if (a.html) {
      $plaintext.innerHTML = a.html;
    } else {
      $plaintext.textContent = a.plaintext;
    }

    const words = a.plaintext ? a.plaintext.split(/\s+/).length : 0;
    setStatVal("words", words.toLocaleString());
    setStatVal("reading", a.reading_time ? `${a.reading_time} min` : "--");
    setStatVal("published", a.published_at ? new Date(a.published_at).toLocaleDateString() : "--");
  }

  function setStatVal(key, val) {
    const el = root.querySelector(`[data-extract-stat="${key}"]`);
    if (el) el.textContent = val;
  }

  function setStatus(text, isError) {
    $status.textContent = text || "";
    $status.hidden = !text;
    $status.style.color = isError ? "#c1593c" : "var(--color-muted)";
  }
})();
