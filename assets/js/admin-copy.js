(function () {
  "use strict";

  var root = document.querySelector("[data-copy-creator]");
  if (!root) return;

  var workerUrl = (root.dataset.workerUrl || "").replace(/\/$/, "");
  var siteUrl = (root.dataset.siteUrl || "").replace(/\/$/, "");
  var contentApiKey = root.dataset.contentApiKey || "";

  var $urlInput = root.querySelector("[data-copy-url]");
  var $textInput = root.querySelector("[data-copy-text]");
  var $tone = root.querySelector("[data-copy-tone]");
  var $generateBtn = root.querySelector("[data-copy-generate]");
  var $status = root.querySelector("[data-copy-status]");
  var $output = root.querySelector("[data-copy-output]");
  var $results = root.querySelector("[data-copy-results]");

  // Platform pill toggles
  root.querySelectorAll("[data-copy-platform]").forEach(function (pill) {
    pill.addEventListener("click", function () {
      pill.classList.toggle("is-active");
    });
  });

  $generateBtn.addEventListener("click", generate);

  function getSelectedPlatforms() {
    var pills = root.querySelectorAll("[data-copy-platform].is-active");
    var out = [];
    pills.forEach(function (p) { out.push(p.dataset.copyPlatform); });
    return out;
  }

  async function generate() {
    var platforms = getSelectedPlatforms();
    if (!platforms.length) { setStatus("Select at least one platform.", true); return; }

    var url = $urlInput.value.trim();
    var text = $textInput.value.trim();
    if (!url && !text) { setStatus("Provide an article URL or paste text.", true); return; }

    $generateBtn.disabled = true;
    $generateBtn.textContent = "Generating...";
    setStatus("");

    try {
      var articleContent = text;
      if (url && contentApiKey && !text) {
        articleContent = await pullArticle(url);
      }

      if (!articleContent) { setStatus("Could not pull article content.", true); return; }

      var resp = await window.MOAuth.fetch(workerUrl + "/social/copy", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          content: articleContent,
          platforms: platforms,
          tone: $tone.value,
          url: url
        })
      });

      var data = await resp.json();
      if (!resp.ok) throw new Error(data.message || data.error || "HTTP " + resp.status);

      renderResults(data.results, url);
    } catch (err) {
      console.error("Copy generation failed:", err);
      setStatus("Failed: " + (err.message || err), true);
    } finally {
      $generateBtn.disabled = false;
      $generateBtn.textContent = "Generate copy";
    }
  }

  async function pullArticle(url) {
    try {
      var slug = url.split("/").filter(Boolean).pop();
      var apiUrl = siteUrl + "/ghost/api/content/posts/slug/" + slug + "/?key=" + contentApiKey + "&fields=title,custom_excerpt,plaintext&formats=plaintext";
      var resp = await fetch(apiUrl);
      var data = await resp.json();
      var post = data.posts && data.posts[0];
      if (!post) return "";
      var parts = [];
      if (post.title) parts.push("Title: " + post.title);
      if (post.custom_excerpt) parts.push("Excerpt: " + post.custom_excerpt);
      if (post.plaintext) parts.push("Content:\n" + post.plaintext.substring(0, 3000));
      return parts.join("\n\n");
    } catch (e) {
      console.error("Pull failed:", e);
      return "";
    }
  }

  function renderResults(results, articleUrl) {
    $output.hidden = false;
    $results.textContent = "";
    if (!results || !results.length) {
      var empty = document.createElement("p");
      empty.className = "copy-status";
      empty.textContent = "No results returned.";
      $results.appendChild(empty);
      return;
    }
    results.forEach(function (r) {
      var card = document.createElement("div");
      card.className = "copy-result-card";

      var platform = document.createElement("p");
      platform.className = "copy-result-platform";
      platform.textContent = r.platform;
      card.appendChild(platform);

      var text = document.createElement("p");
      text.className = "copy-result-text";
      text.textContent = r.text;
      card.appendChild(text);

      var actions = document.createElement("div");
      actions.className = "copy-result-actions";
      var btn = document.createElement("button");
      btn.type = "button";
      btn.className = "btn btn-pill btn-ghost btn-sm";
      btn.textContent = "Copy";
      btn.addEventListener("click", function () {
        navigator.clipboard.writeText(r.text).then(function () {
          btn.textContent = "Copied";
          setTimeout(function () { btn.textContent = "Copy"; }, 1400);
        });
      });
      actions.appendChild(btn);
      card.appendChild(actions);

      $results.appendChild(card);
    });
  }

  function setStatus(text, isError) {
    $status.textContent = text || "";
    $status.hidden = !text;
    $status.style.color = isError ? "#c1593c" : "var(--color-muted)";
  }
})();
