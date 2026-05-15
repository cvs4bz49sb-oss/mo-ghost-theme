(function () {
  "use strict";

  var root = document.querySelector("[data-extract-creator]");
  if (!root) return;

  var siteUrl = (root.dataset.siteUrl || "").replace(/\/$/, "");
  var contentApiKey = root.dataset.contentApiKey || "";

  var $url = root.querySelector("[data-extract-url]");
  var $pullBtn = root.querySelector("[data-extract-pull]");
  var $status = root.querySelector("[data-extract-status]");
  var $output = root.querySelector("[data-extract-output]");
  var $title = root.querySelector("[data-extract-title]");
  var $author = root.querySelector("[data-extract-author]");
  var $excerpt = root.querySelector("[data-extract-excerpt]");
  var $excerptCard = root.querySelector("[data-extract-excerpt-card]");
  var $tags = root.querySelector("[data-extract-tags]");
  var $tagsCard = root.querySelector("[data-extract-tags-card]");
  var $image = root.querySelector("[data-extract-image]");
  var $imageCard = root.querySelector("[data-extract-image-card]");
  var $plaintext = root.querySelector("[data-extract-plaintext]");
  var $bio = root.querySelector("[data-extract-bio]");
  var $bioCard = root.querySelector("[data-extract-bio-card]");

  var articleData = {};

  $pullBtn.addEventListener("click", extract);

  root.querySelectorAll("[data-extract-copy]").forEach(function (btn) {
    btn.addEventListener("click", function () {
      var key = btn.dataset.extractCopy;
      var text = "";
      if (key === "title") text = articleData.title || "";
      else if (key === "author") text = articleData.author || "";
      else if (key === "excerpt") text = articleData.excerpt || "";
      else if (key === "tags") text = articleData.tags || "";
      else if (key === "bio") text = articleData.bio || "";
      else if (key === "image") text = articleData.feature_image || "";
      else if (key === "plaintext") {
        var html = articleData.html || "";
        var plain = articleData.plaintext || "";
        if (html) {
          navigator.clipboard.write([new ClipboardItem({
            "text/html": new Blob([html], { type: "text/html" }),
            "text/plain": new Blob([plain], { type: "text/plain" })
          })]).then(function () {
            btn.textContent = "Copied";
            setTimeout(function () { btn.textContent = "Copy all"; }, 1400);
          });
          return;
        }
        text = plain;
      }
      if (text) navigator.clipboard.writeText(text).then(function () {
        btn.textContent = "Copied";
        var resetLabel = key === "image" ? "Copy URL" : key === "plaintext" ? "Copy all" : "Copy";
        setTimeout(function () { btn.textContent = resetLabel; }, 1400);
      });
    });
  });

  var $copyImageBtn = root.querySelector("[data-extract-copy-image]");
  if ($copyImageBtn) {
    $copyImageBtn.addEventListener("click", async function () {
      var url = articleData.feature_image;
      if (!url) return;
      $copyImageBtn.textContent = "Copying…";
      try {
        var img = new Image();
        img.crossOrigin = "anonymous";
        await new Promise(function (resolve, reject) {
          img.onload = resolve;
          img.onerror = reject;
          img.src = url;
        });
        var canvas = document.createElement("canvas");
        canvas.width = img.naturalWidth;
        canvas.height = img.naturalHeight;
        canvas.getContext("2d").drawImage(img, 0, 0);
        var pngBlob = await new Promise(function (resolve) { canvas.toBlob(resolve, "image/png"); });
        await navigator.clipboard.write([new ClipboardItem({ "image/png": pngBlob })]);
        $copyImageBtn.textContent = "Copied";
      } catch (e) {
        console.error("Copy image failed:", e);
        navigator.clipboard.writeText(url).then(function () {
          $copyImageBtn.textContent = "URL copied";
        });
      }
      setTimeout(function () { $copyImageBtn.textContent = "Copy Image"; }, 1400);
    });
  }

  async function extract() {
    var url = $url.value.trim();
    if (!url) return;
    if (!contentApiKey) { setStatus("Content API key not configured.", true); return; }

    var slug = url.split("/").filter(Boolean).pop();
    if (!slug) { setStatus("Could not extract slug from URL.", true); return; }

    $pullBtn.disabled = true;
    $pullBtn.textContent = "Extracting...";
    setStatus("");

    try {
      var apiUrl = siteUrl + "/ghost/api/content/posts/slug/" + slug +
        "/?key=" + contentApiKey +
        "&include=authors,tags&formats=plaintext,html";
      var resp = await fetch(apiUrl);
      var data = await resp.json();
      var post = data.posts && data.posts[0];
      if (!post) throw new Error("Article not found");

      var allTags = post.tags || [];
      var authorTags = allTags
        .filter(function (t) { return t.slug && t.slug.indexOf("author-") === 0; })
        .map(function (t) { return t.name; });
      var authorName = authorTags.length
        ? authorTags.join(", ")
        : (post.primary_author && post.primary_author.name) || "";

      var publicTags = allTags
        .filter(function (t) {
          return t.name && t.name.charAt(0) !== "#" && !(t.slug && t.slug.indexOf("author-") === 0);
        })
        .map(function (t) { return t.name; });

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
        bio: (post.primary_author && post.primary_author.bio) || ""
      };

      renderArticle(articleData);
    } catch (err) {
      console.error("Extract failed:", err);
      setStatus("Failed: " + (err.message || err), true);
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

    var words = a.plaintext ? a.plaintext.split(/\s+/).length : 0;
    setStatVal("words", words.toLocaleString());
    setStatVal("reading", a.reading_time ? a.reading_time + " min" : "--");
    setStatVal("published", a.published_at ? new Date(a.published_at).toLocaleDateString() : "--");
  }

  function setStatVal(key, val) {
    var el = root.querySelector('[data-extract-stat="' + key + '"]');
    if (el) el.textContent = val;
  }

  function setStatus(text, isError) {
    $status.textContent = text || "";
    $status.hidden = !text;
    $status.style.color = isError ? "#c1593c" : "var(--color-muted)";
  }
})();
