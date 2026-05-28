(function () {
  "use strict";

  const root = document.querySelector("[data-copy-creator]");
  if (!root) return;

  const workerUrl = (root.dataset.workerUrl || "").replace(/\/$/, "");
  const siteUrl = (root.dataset.siteUrl || "").replace(/\/$/, "");
  const contentApiKey = root.dataset.contentApiKey || "";

  const $urlInput = root.querySelector("[data-copy-url]");
  const $textInput = root.querySelector("[data-copy-text]");
  const $tone = root.querySelector("[data-copy-tone]");
  const $generateBtn = root.querySelector("[data-copy-generate]");
  const $status = root.querySelector("[data-copy-status]");
  const $output = root.querySelector("[data-copy-output]");
  const $results = root.querySelector("[data-copy-results]");

  // Platform pill toggles
  root.querySelectorAll("[data-copy-platform]").forEach((pill) => {
    pill.addEventListener("click", () => {
      pill.classList.toggle("is-active");
    });
  });

  $generateBtn.addEventListener("click", generate);

  function getSelectedPlatforms() {
    const pills = root.querySelectorAll("[data-copy-platform].is-active");
    const out = [];
    pills.forEach((p) => { out.push(p.dataset.copyPlatform); });
    return out;
  }

  async function generate() {
    const platforms = getSelectedPlatforms();
    if (!platforms.length) { setStatus("Select at least one platform.", true); return; }

    const url = $urlInput.value.trim();
    const text = $textInput.value.trim();
    if (!url && !text) { setStatus("Provide an article URL or paste text.", true); return; }

    $generateBtn.disabled = true;
    $generateBtn.textContent = "Generating...";
    setStatus("");

    try {
      let articleContent = text;
      if (url && contentApiKey && !text) {
        articleContent = await pullArticle(url);
      }

      if (!articleContent) { setStatus("Could not pull article content.", true); return; }

      const resp = await window.MOAuth.fetch(`${workerUrl}/social/copy`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          content: articleContent,
          platforms,
          tone: $tone.value,
          url
        })
      });

      const data = await resp.json();
      if (!resp.ok) throw new Error(data.message || data.error || `HTTP ${resp.status}`);

      renderResults(data.results, url);
    } catch (err) {
      console.error("Copy generation failed:", err);
      setStatus(`Failed: ${err.message || err}`, true);
    } finally {
      $generateBtn.disabled = false;
      $generateBtn.textContent = "Generate copy";
    }
  }

  async function pullArticle(url) {
    try {
      const slug = url.split("/").filter(Boolean).pop();
      const apiUrl = `${siteUrl}/ghost/api/content/posts/slug/${slug}/?key=${contentApiKey}&fields=title,custom_excerpt,plaintext&formats=plaintext`;
      const resp = await fetch(apiUrl);
      if (!resp.ok) throw new Error(`Ghost API ${resp.status}`);
      const data = await resp.json();
      const post = data.posts && data.posts[0];
      if (!post) return "";
      const parts = [];
      if (post.title) parts.push(`Title: ${post.title}`);
      if (post.custom_excerpt) parts.push(`Excerpt: ${post.custom_excerpt}`);
      if (post.plaintext) parts.push(`Content:\n${post.plaintext.substring(0, 3000)}`);
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
      const empty = document.createElement("p");
      empty.className = "copy-status";
      empty.textContent = "No results returned.";
      $results.appendChild(empty);
      return;
    }
    results.forEach((r) => {
      const card = document.createElement("div");
      card.className = "copy-result-card";

      const platform = document.createElement("p");
      platform.className = "copy-result-platform";
      platform.textContent = r.platform;
      card.appendChild(platform);

      const text = document.createElement("p");
      text.className = "copy-result-text";
      text.textContent = r.text;
      card.appendChild(text);

      const actions = document.createElement("div");
      actions.className = "copy-result-actions";
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "btn btn-ghost btn-sm";
      btn.textContent = "Copy";
      btn.addEventListener("click", () => {
        navigator.clipboard.writeText(r.text).then(() => {
          btn.textContent = "Copied";
          setTimeout(() => { btn.textContent = "Copy"; }, 1400);
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
