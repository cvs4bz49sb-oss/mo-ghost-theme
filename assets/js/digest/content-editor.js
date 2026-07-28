(() => {
  const { useState, useEffect } = React;
  function stripHtml(html) {
    if (!html) return "";
    const tmp = document.createElement("div");
    tmp.innerHTML = html;
    return (tmp.textContent || tmp.innerText || "").trim();
  }
  function findFirstImg(html) {
    if (!html) return null;
    const m = html.match(/<img[^>]+src=["']([^"']+)["']/i);
    return m ? m[1] : null;
  }
  function parseRSS(xmlText) {
    const parser = new DOMParser();
    const doc = parser.parseFromString(xmlText, "application/xml");
    const errNode = doc.querySelector("parsererror");
    if (errNode) throw new Error("Could not parse XML: " + (errNode.textContent || "").slice(0, 200));
    const items = Array.from(doc.querySelectorAll("item, entry"));
    if (!items.length) throw new Error("No <item> or <entry> elements found in feed.");
    const get = (el, tag) => {
      const node = el.querySelector(tag);
      return node ? (node.textContent || "").trim() : "";
    };
    const getNS = (el, name) => {
      const all = Array.from(el.getElementsByTagName("*"));
      const found = all.find((n) => n.localName === name);
      return found ? (found.textContent || "").trim() : "";
    };
    return items.map((it) => {
      const title = get(it, "title");
      let link = "";
      const linkEl = it.querySelector("link");
      if (linkEl) {
        link = linkEl.getAttribute("href") || (linkEl.textContent || "").trim();
      }
      const description = get(it, "description") || getNS(it, "summary") || "";
      const contentEncoded = getNS(it, "encoded") || "";
      const richHtml = contentEncoded || description;
      const summary = stripHtml(description) || stripHtml(contentEncoded);
      let byline = getNS(it, "creator") || get(it, "author") || "";
      if (/^(mere\s*orthodoxy|admin|editor|administrator)$/i.test(byline.trim())) {
        byline = "";
      }
      let image = it.querySelector('enclosure[url][type^="image"]')?.getAttribute("url") || it.querySelector("media\\:content[url], content[url]")?.getAttribute("url") || it.querySelector("media\\:thumbnail[url], thumbnail[url]")?.getAttribute("url") || findFirstImg(richHtml) || null;
      const categories = Array.from(it.querySelectorAll("category")).map((c) => c.textContent.trim()).filter(Boolean);
      const kicker = categories[0] || "";
      return {
        title,
        link,
        summary: summary.slice(0, 280),
        image,
        byline,
        kicker
      };
    });
  }
  const fieldStyles = {
    label: {
      display: "block",
      fontFamily: '"Source Sans 3", "Helvetica Neue", Arial, sans-serif',
      fontSize: 10,
      fontWeight: 700,
      letterSpacing: "0.18em",
      textTransform: "uppercase",
      color: "#9a8773",
      marginBottom: 6
    },
    input: {
      width: "100%",
      boxSizing: "border-box",
      border: "1px solid #d8c4a3",
      background: "#fff",
      padding: "8px 10px",
      fontFamily: '"Source Sans 3", "Helvetica Neue", Arial, sans-serif',
      fontSize: 13,
      color: "#2d2927",
      borderRadius: 10
    },
    textarea: {
      width: "100%",
      boxSizing: "border-box",
      border: "1px solid #d8c4a3",
      background: "#fff",
      padding: "8px 10px",
      fontFamily: "Georgia, serif",
      fontSize: 13,
      lineHeight: 1.5,
      color: "#2d2927",
      borderRadius: 10,
      resize: "vertical",
      minHeight: 70
    }
  };
  function Field({ label, value, onChange, multiline, rows = 3, placeholder, disabled, hint }) {
    const disabledInput = disabled ? { background: "#f1ece2", color: "#9a8773", cursor: "not-allowed" } : null;
    return /* @__PURE__ */ React.createElement("div", { style: { marginBottom: 12 } }, /* @__PURE__ */ React.createElement("label", { style: { ...fieldStyles.label, ...disabled ? { color: "#bcae99" } : null } }, label), multiline ? /* @__PURE__ */ React.createElement(
      "textarea",
      {
        style: { ...fieldStyles.textarea, minHeight: rows * 22, ...disabledInput },
        value: value || "",
        placeholder,
        disabled,
        onChange: (e) => onChange(e.target.value)
      }
    ) : /* @__PURE__ */ React.createElement(
      "input",
      {
        style: { ...fieldStyles.input, ...disabledInput },
        type: "text",
        value: value || "",
        placeholder,
        disabled,
        onChange: (e) => onChange(e.target.value)
      }
    ), hint ? /* @__PURE__ */ React.createElement("div", { style: {
      fontFamily: '"Source Sans 3", "Helvetica Neue", Arial, sans-serif',
      fontSize: 11,
      color: "#9a8773",
      marginTop: 4,
      fontStyle: "italic"
    } }, hint) : null);
  }
  function ImageUrlField({ value, onChange }) {
    const [uploading, setUploading] = useState(false);
    const [error, setError] = useState("");
    const inputRef = React.useRef(null);
    const workerUrl = window.MODigestRoot ? window.MODigestRoot.url("workerUrl") : "";
    const canUpload = !!(workerUrl && window.MOAuth && typeof window.MOAuth.fetch === "function");
    const handleFile = (file) => {
      if (!file) return;
      if (file.size > 5 * 1024 * 1024) {
        setError("Image is larger than 5MB. Please use a smaller file.");
        return;
      }
      setError("");
      setUploading(true);
      const fd = new FormData();
      fd.append("file", file);
      window.MOAuth.fetch(`${workerUrl}/images/upload`, { method: "POST", body: fd }).then((r) => r.ok ? r.json() : r.json().then((d) => {
        throw new Error(d.error || `Upload failed (${r.status})`);
      })).then((data) => {
        onChange(data.url);
        setUploading(false);
      }).catch((err) => {
        setError(err.message || "Upload failed.");
        setUploading(false);
      });
    };
    const uploadBtnStyle = {
      flexShrink: 0,
      background: "#fff",
      color: "#2d2927",
      border: "1px solid #2d2927",
      padding: "8px 14px",
      fontFamily: '"Source Sans 3", "Helvetica Neue", Arial, sans-serif',
      fontSize: 11,
      fontWeight: 700,
      letterSpacing: "0.14em",
      textTransform: "uppercase",
      cursor: uploading ? "wait" : "pointer",
      borderRadius: 10,
      opacity: uploading ? 0.6 : 1,
      whiteSpace: "nowrap"
    };
    return /* @__PURE__ */ React.createElement("div", { style: { marginBottom: 12 } }, /* @__PURE__ */ React.createElement("label", { style: fieldStyles.label }, "Image URL"), /* @__PURE__ */ React.createElement("div", { style: { display: "flex", gap: 8, alignItems: "stretch" } }, /* @__PURE__ */ React.createElement(
      "input",
      {
        style: { ...fieldStyles.input, flex: 1 },
        type: "text",
        value: value || "",
        placeholder: canUpload ? "Paste a hosted image URL, or upload \u2192" : "Paste a hosted image URL",
        onChange: (e) => onChange(e.target.value)
      }
    ), canUpload && /* @__PURE__ */ React.createElement(React.Fragment, null, /* @__PURE__ */ React.createElement(
      "input",
      {
        ref: inputRef,
        type: "file",
        accept: "image/jpeg,image/png,image/gif,image/webp,image/svg+xml",
        style: { display: "none" },
        onChange: (e) => {
          handleFile(e.target.files && e.target.files[0]);
          e.target.value = "";
        }
      }
    ), /* @__PURE__ */ React.createElement(
      "button",
      {
        type: "button",
        disabled: uploading,
        onClick: () => inputRef.current && inputRef.current.click(),
        style: uploadBtnStyle
      },
      uploading ? "Uploading\u2026" : "Upload"
    ))), error ? /* @__PURE__ */ React.createElement("div", { style: {
      fontFamily: '"Source Sans 3", "Helvetica Neue", Arial, sans-serif',
      fontSize: 11,
      color: "#a43a27",
      marginTop: 4
    } }, error) : null);
  }
  function Group({ title, children, defaultOpen = false }) {
    const [open, setOpen] = useState(defaultOpen);
    return /* @__PURE__ */ React.createElement("div", { style: { borderTop: "1px solid #e8d9bd", padding: "14px 0" } }, /* @__PURE__ */ React.createElement(
      "button",
      {
        onClick: () => setOpen(!open),
        style: {
          width: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          background: "transparent",
          border: "none",
          padding: "0 0 8px",
          cursor: "pointer",
          fontFamily: '"IM Fell English", Georgia, serif',
          fontSize: 16,
          color: "#2d2927",
          textAlign: "left"
        }
      },
      /* @__PURE__ */ React.createElement("span", null, title),
      /* @__PURE__ */ React.createElement("span", { style: { fontSize: 12, color: "#9a8773" } }, open ? "\u2212" : "+")
    ), open && /* @__PURE__ */ React.createElement("div", { style: { paddingTop: 4 } }, children));
  }
  const KIT_TAGS = [
    { tag: "{{ subscriber.first_name }}", label: "First name" },
    { tag: '{{ subscriber.first_name | default: "friend" }}', label: 'First name (with "friend" fallback)' },
    { tag: "{{ subscriber.last_name }}", label: "Last name" },
    { tag: "{{ subscriber.email_address }}", label: "Email address" },
    { tag: "{{ subscriber.id }}", label: "Subscriber ID (useful in URLs as ?ref=\u2026)" },
    { tag: "{{ unsubscribe_url }}", label: "Unsubscribe URL (already in the footer)" },
    { tag: "{{ subscriber_preferences_url }}", label: "Manage preferences URL (already in the footer)" }
  ];
  const SPONSOR_FIELDS = ["name", "label", "image", "headline", "body", "cta", "href"];
  const BUILTIN_SPONSORS = [
    {
      id: "builtin-beeson-preaching-2026",
      name: "Beeson Divinity School",
      label: "Ministry Partner",
      headline: "Preach The Word Well",
      body: 'Join Beeson Divinity School July 14-16 in Birmingham for the 2026 Preaching Conference: "Manifold Wisdom: The Wisdom of Preaching Across Christian Traditions."',
      cta: "Learn More & Register \u2192",
      href: ""
      // set the registration link before sending
    },
    {
      id: "builtin-crossway-botm",
      name: "Crossway Books",
      label: "Ministry Partner",
      headline: "Book of the Month",
      body: "Crossway's Book of the Month is From Dust To Dust by Jen Wilkin.",
      cta: "Get The Book \u2192",
      href: ""
    },
    {
      id: "builtin-beeson-mdiv",
      name: "Beeson Divinity School",
      label: "Ministry Partner",
      headline: "Start Your M.Div With A Scholarship",
      body: "Start your M.Div this Fall at Beeson Divinity School.",
      cta: "Start Your Application \u2192",
      href: ""
    }
  ];
  const SPONSOR_LIB_KEY = "mo:sponsorLibrary";
  function loadSponsorLibrary() {
    try {
      const raw = localStorage.getItem(SPONSOR_LIB_KEY);
      const arr = raw ? JSON.parse(raw) : [];
      return Array.isArray(arr) ? arr.filter((s) => s && s.id) : [];
    } catch (_) {
      return [];
    }
  }
  function saveSponsorLibrary(arr) {
    try {
      localStorage.setItem(SPONSOR_LIB_KEY, JSON.stringify(arr || []));
    } catch (_) {
    }
  }
  function sponsorFields(src) {
    const s = src || {};
    const out = {};
    SPONSOR_FIELDS.forEach((f) => {
      out[f] = s[f] || "";
    });
    return out;
  }
  function sponsorTitle(s) {
    const name = (s.savedLabel || s.name || "").trim();
    const headline = (s.headline || "").trim();
    if (name && headline && !s.savedLabel) return `${name} \xB7 ${headline}`;
    return name || headline || "Untitled sponsor";
  }
  const BUILTIN_BLOCKS = [
    {
      id: "builtin-summer-journal",
      type: "image",
      savedLabel: "Summer Journal promo",
      heading: "Your Summer Reading Is Almost Here",
      src: "",
      // paste the hosted image URL before sending
      body: "Get the Summer Issue of the Mere Orthodoxy Journal for premier essays you can read in print all Summer long.\n\nBecome a Member now to receive the Journal and get 20% off.",
      url: "",
      // link target for the image + caption
      linkText: "Get Your Journal",
      alt: "Open book and a cup of coffee on a wooden table"
    }
  ];
  const BLOCK_LIB_KEY = "mo:blockLibrary";
  function loadBlockLibrary() {
    try {
      const raw = localStorage.getItem(BLOCK_LIB_KEY);
      const arr = raw ? JSON.parse(raw) : [];
      return Array.isArray(arr) ? arr.filter((b) => b && b.id && b.type) : [];
    } catch (_) {
      return [];
    }
  }
  function saveBlockLibrary(arr) {
    try {
      localStorage.setItem(BLOCK_LIB_KEY, JSON.stringify(arr || []));
    } catch (_) {
    }
  }
  function blockFields(b) {
    const src = b || {};
    const type = src.type === "button" || src.type === "image" ? src.type : "text";
    if (type === "button") return { type, text: src.text || "", url: src.url || "", variant: src.variant || "primary" };
    if (type === "image") return { type, heading: src.heading || "", src: src.src || "", body: src.body || "", url: src.url || "", linkText: src.linkText || "", alt: src.alt || "" };
    return { type, text: src.text || "" };
  }
  function blockTitle(b) {
    if (b.savedLabel && b.savedLabel.trim()) return b.savedLabel.trim();
    const typeLabel = b.type === "button" ? "Button" : b.type === "image" ? "Image" : "Text";
    const snippet = String(b.heading || b.text || b.linkText || "").replace(/[#*_>[\]`]/g, "").trim();
    return snippet ? `${typeLabel}: ${snippet.slice(0, 40)}` : `${typeLabel} block`;
  }
  function ContentEditor({ open, content, onChange, onClose, isMember = false }) {
    const [sponsorLib, setSponsorLib] = React.useState(() => loadSponsorLibrary());
    const [blockLib, setBlockLib] = React.useState(() => loadBlockLibrary());
    const [rssText, setRssText] = useState("");
    const [copiedTag, setCopiedTag] = useState(null);
    const [sectionDragOver, setSectionDragOver] = useState(null);
    const [blockDragOver, setBlockDragOver] = useState(null);
    const [ghostUrl, setGhostUrl] = useState(() => localStorage.getItem("mo_ghost_url") || "https://mereorthodoxy.com");
    const [ghostKey, setGhostKey] = useState(() => localStorage.getItem("mo_ghost_key") || "");
    const [ghostError, setGhostError] = useState(null);
    const [ghostMessage, setGhostMessage] = useState(null);
    const [ghostLoading, setGhostLoading] = useState(false);
    const [ghostFilter, setGhostFilter] = useState("");
    const [essayCount, setEssayCount] = useState(10);
    const [podcastCount, setPodcastCount] = useState(2);
    const [showRssPanel, setShowRssPanel] = useState(false);
    const [showPodcastPanel, setShowPodcastPanel] = useState(false);
    const [podcastWorkerUrl, setPodcastWorkerUrl] = useState(() => localStorage.getItem("mo_podcast_worker") || localStorage.getItem("mo_captivate_worker") || "");
    const [podcastFeeds, setPodcastFeeds] = useState(() => {
      try {
        const saved = localStorage.getItem("mo_podcast_shows");
        if (saved) {
          const parsed = JSON.parse(saved);
          if (Array.isArray(parsed) && parsed.length && parsed[0] && "showId" in parsed[0]) {
            return [
              { label: "Mere Fidelity", slug: "mere-fidelity" },
              { label: "Christians Reading Classics", slug: "christians-reading-classics" }
            ];
          }
          return parsed;
        }
      } catch (e) {
      }
      return [
        { label: "Mere Fidelity", slug: "mere-fidelity" },
        { label: "Christians Reading Classics", slug: "christians-reading-classics" }
      ];
    });
    const [podcastError, setPodcastError] = useState(null);
    const [podcastMessage, setPodcastMessage] = useState(null);
    const [podcastLoading, setPodcastLoading] = useState(false);
    useEffect(() => {
      localStorage.setItem("mo_ghost_url", ghostUrl);
    }, [ghostUrl]);
    useEffect(() => {
      localStorage.setItem("mo_ghost_key", ghostKey);
    }, [ghostKey]);
    useEffect(() => {
      localStorage.setItem("mo_podcast_worker", podcastWorkerUrl);
    }, [podcastWorkerUrl]);
    useEffect(() => {
      localStorage.setItem("mo_podcast_shows", JSON.stringify(podcastFeeds));
    }, [podcastFeeds]);
    if (!open) return null;
    const fetchFromGhost = async (target, count) => {
      setGhostError(null);
      setGhostMessage(null);
      setGhostLoading(true);
      try {
        if (!ghostKey.trim()) throw new Error("Content API key required.");
        const base = ghostUrl.replace(/\/+$/, "");
        const params = new URLSearchParams({
          key: ghostKey.trim(),
          limit: String(count),
          include: "tags,authors",
          fields: "id,title,slug,excerpt,custom_excerpt,feature_image,published_at,url,primary_author,primary_tag",
          order: "published_at desc"
        });
        if (ghostFilter.trim()) params.set("filter", ghostFilter.trim());
        const url = `${base}/ghost/api/content/posts/?${params.toString()}`;
        const res = await fetch(url);
        if (!res.ok) {
          const body = await res.text().catch(() => "");
          throw new Error(`HTTP ${res.status}\xA0\u2014\xA0${body.slice(0, 160) || res.statusText}`);
        }
        const data = await res.json();
        const posts = data.posts || [];
        if (!posts.length) throw new Error("No posts returned. Check your filter or API key.");
        const PUB_AUTHOR_RX = /^(mere\s*orthodoxy|admin|editor|administrator)$/i;
        const cleanByline = (b) => b && PUB_AUTHOR_RX.test(b.trim()) ? "" : b || "";
        const next = JSON.parse(JSON.stringify(content));
        if (target === "essays") {
          const existing = next.essays || [];
          const fresh = posts.slice(0, count).map((p, i) => ({
            img: p.feature_image || existing[i] && existing[i].img || "assets/feature-hero.jpg",
            kicker: p.primary_tag && p.primary_tag.name || existing[i] && existing[i].kicker || "Essay",
            title: p.title || "Untitled",
            byline: cleanByline(p.primary_author && p.primary_author.name) || existing[i] && existing[i].byline || "",
            summary: (p.custom_excerpt || p.excerpt || "").slice(0, 280),
            url: p.url || existing[i] && existing[i].url || "#"
          }));
          next.essays = fresh;
        } else {
          const existing = next.podcasts || [];
          const fresh = posts.slice(0, count).map((p, i) => ({
            img: p.feature_image || existing[i] && existing[i].img || "assets/mere-fidelity.jpg",
            label: existing[i] && existing[i].label || p.primary_tag && p.primary_tag.name || "Podcast",
            episode: existing[i] && existing[i].episode || "Episode",
            title: p.title || "Untitled",
            summary: (p.custom_excerpt || p.excerpt || "").slice(0, 280),
            cta: existing[i] && existing[i].cta || "Listen to the episode",
            url: p.url || existing[i] && existing[i].url || "#"
          }));
          next.podcasts = fresh;
        }
        onChange(next);
        setGhostMessage(`Loaded ${Math.min(posts.length, count)} ${target} from Ghost (found ${posts.length} total).`);
      } catch (err) {
        const msg = /failed to fetch|networkerror/i.test(err.message) ? "Network error \u2014 check the site URL. (Ghost Content API does send CORS headers, so this is unusual.)" : err.message;
        setGhostError(msg);
      } finally {
        setGhostLoading(false);
      }
    };
    const fetchPodcastFeeds = async () => {
      setPodcastError(null);
      setPodcastMessage(null);
      if (!podcastWorkerUrl.trim()) {
        setPodcastError("Worker URL is required. Paste your mo-podcast-feed worker URL above (e.g. https://mo-podcast-feed.<your-subdomain>.workers.dev/).");
        return;
      }
      const rows = podcastFeeds.filter((f) => f.slug && f.slug.trim());
      if (!rows.length) {
        setPodcastError("Add at least one show slug above (e.g. mere-fidelity).");
        return;
      }
      setPodcastLoading(true);
      try {
        const workerBase = podcastWorkerUrl.trim().replace(/\/+$/, "");
        const results = await Promise.all(
          rows.map(async (row) => {
            try {
              const slug = row.slug.trim();
              const res = await fetch(`${workerBase}/?show=${encodeURIComponent(slug)}&limit=1&scheduled=true`);
              if (!res.ok) throw new Error(`HTTP ${res.status}`);
              const data = await res.json().catch(() => ({}));
              const showData = data && data[slug];
              if (!showData) throw new Error(`Worker returned no data for slug "${slug}".`);
              if (showData.error) throw new Error(showData.error);
              const episodes = showData.episodes || [];
              const ep = showData.nextScheduled || episodes[0];
              if (!ep) throw new Error("No episodes returned for this show.");
              return { row, show: showData.show, episode: ep };
            } catch (err) {
              return { row, error: err.message };
            }
          })
        );
        const next = JSON.parse(JSON.stringify(content));
        const existing = next.podcasts || [];
        const fresh = [];
        const errors = [];
        results.forEach((r, i) => {
          const slot = existing[i] || {};
          if (r.error) {
            errors.push(`${r.row.label || r.row.slug || "Show " + (i + 1)}: ${r.error}`);
            fresh.push(slot);
            return;
          }
          const ep = r.episode;
          let episodeNum = slot.episode || "Episode";
          if (ep.episode) {
            episodeNum = `Episode ${ep.episode}`;
          } else {
            const m = ep.title && ep.title.match(/(?:episode|ep\.?|#)\s*(\d+)/i);
            if (m) episodeNum = `Episode ${m[1]}`;
          }
          fresh.push({
            img: ep.artwork || slot.img || "assets/mere-fidelity.jpg",
            label: r.row.label || r.show && r.show.title || slot.label || "Podcast",
            episode: episodeNum,
            title: ep.title || slot.title || "Untitled",
            summary: (ep.description || "").slice(0, 280) || slot.summary || "",
            cta: slot.cta || "Listen to the episode",
            url: ep.link || ep.audioUrl || slot.url || "#"
          });
        });
        next.podcasts = fresh;
        onChange(next);
        const ok = results.length - errors.length;
        let msg = `Pulled ${ok}/${results.length} show${results.length === 1 ? "" : "s"}.`;
        if (errors.length) msg += " Errors: " + errors.join(" \xB7 ");
        if (errors.length && !ok) setPodcastError(msg);
        else setPodcastMessage(msg);
      } catch (err) {
        setPodcastError(/failed to fetch|networkerror/i.test(err.message) ? `Network error reaching the Worker. Check the Worker URL is correct and deployed. (${err.message})` : err.message);
      } finally {
        setPodcastLoading(false);
      }
    };
    const updatePodcastFeed = (i, patch) => {
      setPodcastFeeds((prev) => prev.map((f, j) => j === i ? { ...f, ...patch } : f));
    };
    const addPodcastFeed = () => {
      setPodcastFeeds((prev) => [...prev, { label: "", slug: "" }]);
    };
    const removePodcastFeed = (i) => {
      setPodcastFeeds((prev) => prev.filter((_, j) => j !== i));
    };
    const updateField = (path, value) => {
      const parts = path.split(".");
      const next = JSON.parse(JSON.stringify(content));
      let cursor = next;
      for (let i = 0; i < parts.length - 1; i++) {
        const k = parts[i];
        const idx = /^\d+$/.test(parts[i + 1]);
        if (cursor[k] == null) cursor[k] = idx ? [] : {};
        cursor = cursor[k];
      }
      cursor[parts[parts.length - 1]] = value;
      onChange(next);
    };
    const replaceEssaysFromRSS = (target, count) => {
      setGhostError(null);
      setGhostMessage(null);
      try {
        const parsed = parseRSS(rssText);
        if (!parsed.length) throw new Error("Feed had no items.");
        const next = JSON.parse(JSON.stringify(content));
        if (target === "essays") {
          const existing = next.essays || [];
          const fresh = parsed.slice(0, count).map((it, i) => ({
            img: it.image || existing[i] && existing[i].img || "assets/feature-hero.jpg",
            kicker: it.kicker || existing[i] && existing[i].kicker || "Essay",
            title: it.title || existing[i] && existing[i].title || "Untitled",
            byline: it.byline || existing[i] && existing[i].byline || "",
            summary: it.summary || existing[i] && existing[i].summary || ""
          }));
          while (fresh.length < count && existing[fresh.length]) {
            fresh.push(existing[fresh.length]);
          }
          next.essays = fresh;
        } else if (target === "podcasts") {
          const existing = next.podcasts || [];
          const fresh = parsed.slice(0, count).map((it, i) => ({
            img: it.image || existing[i] && existing[i].img || "assets/mere-fidelity.jpg",
            label: existing[i] && existing[i].label || "Podcast",
            episode: existing[i] && existing[i].episode || `Episode`,
            title: it.title || existing[i] && existing[i].title || "Untitled",
            summary: it.summary || existing[i] && existing[i].summary || "",
            cta: existing[i] && existing[i].cta || "Listen to the episode"
          }));
          while (fresh.length < count && existing[fresh.length]) {
            fresh.push(existing[fresh.length]);
          }
          next.podcasts = fresh;
        }
        onChange(next);
        setGhostMessage(`Loaded ${Math.min(parsed.length, count)} ${target} from XML (found ${parsed.length} items total).`);
      } catch (err) {
        setGhostError(err.message);
      }
    };
    const btnStyle = (variant = "primary") => ({
      background: variant === "primary" ? "#2d2927" : variant === "danger" ? "transparent" : "#fff",
      color: variant === "primary" ? "#fbf7ee" : variant === "danger" ? "#a43a27" : "#2d2927",
      border: variant === "danger" ? "1px solid #a43a27" : "1px solid #2d2927",
      padding: "8px 14px",
      fontFamily: '"Source Sans 3", "Helvetica Neue", Arial, sans-serif',
      fontSize: 11,
      fontWeight: 700,
      letterSpacing: "0.14em",
      textTransform: "uppercase",
      cursor: "pointer",
      borderRadius: 10
    });
    const loadSponsorIntoSlot = (slotKey, sponsorId) => {
      const all = [...BUILTIN_SPONSORS, ...sponsorLib];
      const sel = all.find((s) => s.id === sponsorId);
      if (sel) updateField(slotKey, sponsorFields(sel));
    };
    const saveSlotToLibrary = (slotKey) => {
      const slot = sponsorFields(content[slotKey]);
      if (!slot.name && !slot.headline) {
        alert("Add a sponsor name or headline before saving this block.");
        return;
      }
      const suggested = sponsorTitle(slot);
      const name = window.prompt("Save this sponsor block to your library as:", suggested);
      if (name == null) return;
      const entry = {
        ...slot,
        id: "spon_" + Date.now().toString(36) + Math.random().toString(36).slice(2, 6),
        savedLabel: name.trim() || suggested
      };
      const next = [...sponsorLib, entry];
      setSponsorLib(next);
      saveSponsorLibrary(next);
    };
    const deleteSavedSponsor = (sponsorId) => {
      const next = sponsorLib.filter((s) => s.id !== sponsorId);
      setSponsorLib(next);
      saveSponsorLibrary(next);
    };
    const renderSponsorTools = (slotKey) => /* @__PURE__ */ React.createElement("div", { style: {
      marginBottom: 14,
      paddingBottom: 14,
      borderBottom: "1px dashed #d8c4a3"
    } }, /* @__PURE__ */ React.createElement("div", { style: { display: "flex", gap: 8, alignItems: "flex-end", flexWrap: "wrap" } }, /* @__PURE__ */ React.createElement("div", { style: { flex: "1 1 220px" } }, /* @__PURE__ */ React.createElement("label", { style: fieldStyles.label }, "Load a saved sponsor"), /* @__PURE__ */ React.createElement(
      "select",
      {
        value: "",
        onChange: (e) => {
          loadSponsorIntoSlot(slotKey, e.target.value);
          e.target.value = "";
        },
        style: { ...fieldStyles.input, height: 38 }
      },
      /* @__PURE__ */ React.createElement("option", { value: "" }, "Choose a sponsor\u2026"),
      /* @__PURE__ */ React.createElement("optgroup", { label: "Built-in" }, BUILTIN_SPONSORS.map((s) => /* @__PURE__ */ React.createElement("option", { key: s.id, value: s.id }, sponsorTitle(s)))),
      sponsorLib.length > 0 && /* @__PURE__ */ React.createElement("optgroup", { label: "Saved by you" }, sponsorLib.map((s) => /* @__PURE__ */ React.createElement("option", { key: s.id, value: s.id }, sponsorTitle(s))))
    )), /* @__PURE__ */ React.createElement("button", { type: "button", style: btnStyle("secondary"), onClick: () => saveSlotToLibrary(slotKey) }, "Save this slot")), sponsorLib.length > 0 && /* @__PURE__ */ React.createElement("details", { style: { marginTop: 10 } }, /* @__PURE__ */ React.createElement("summary", { style: {
      fontFamily: '"Source Sans 3", "Helvetica Neue", Arial, sans-serif',
      fontSize: 11,
      letterSpacing: "0.06em",
      color: "#9a8773",
      cursor: "pointer"
    } }, "Manage saved sponsors (", sponsorLib.length, ")"), /* @__PURE__ */ React.createElement("ul", { style: { listStyle: "none", margin: "8px 0 0", padding: 0 } }, sponsorLib.map((s) => /* @__PURE__ */ React.createElement("li", { key: s.id, style: {
      display: "flex",
      alignItems: "center",
      justifyContent: "space-between",
      gap: 10,
      padding: "5px 0",
      borderTop: "1px solid #ece1cf"
    } }, /* @__PURE__ */ React.createElement("span", { style: {
      fontFamily: '"Source Sans 3", "Helvetica Neue", Arial, sans-serif',
      fontSize: 13,
      color: "#2d2927"
    } }, sponsorTitle(s)), /* @__PURE__ */ React.createElement(
      "button",
      {
        type: "button",
        style: { ...btnStyle("danger"), padding: "4px 10px" },
        onClick: () => {
          if (window.confirm(`Delete "${sponsorTitle(s)}" from your saved sponsors?`)) deleteSavedSponsor(s.id);
        }
      },
      "Delete"
    ))))));
    const insertBlockFromLibrary = (blockId) => {
      const all = [...BUILTIN_BLOCKS, ...blockLib];
      const sel = all.find((b) => b.id === blockId);
      if (!sel) return;
      const id = `b_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 7)}`;
      const next = JSON.parse(JSON.stringify(content));
      next.customBlocks = [...next.customBlocks || [], { id, ...blockFields(sel) }];
      next.sectionOrder = Array.isArray(next.sectionOrder) ? [...next.sectionOrder, id] : [id];
      onChange(next);
    };
    const saveBlockToLibrary = (block) => {
      const fields = blockFields(block);
      const hasContent = fields.text || fields.heading || fields.src || fields.body || fields.linkText || fields.url;
      if (!hasContent) {
        alert("Add some content to this block before saving it.");
        return;
      }
      const suggested = blockTitle(fields);
      const name = window.prompt("Save this block to your library as:", suggested);
      if (name == null) return;
      const entry = {
        ...fields,
        id: "blk_" + Date.now().toString(36) + Math.random().toString(36).slice(2, 6),
        savedLabel: name.trim() || suggested
      };
      const nextLib = [...blockLib, entry];
      setBlockLib(nextLib);
      saveBlockLibrary(nextLib);
    };
    const deleteSavedBlock = (blockId) => {
      const next = blockLib.filter((b) => b.id !== blockId);
      setBlockLib(next);
      saveBlockLibrary(next);
    };
    const renderBlockLibraryTools = () => /* @__PURE__ */ React.createElement("div", { style: { marginTop: 12, paddingTop: 12, borderTop: "1px dashed #d8c4a3" } }, /* @__PURE__ */ React.createElement("div", { style: { display: "flex", gap: 8, alignItems: "flex-end", flexWrap: "wrap" } }, /* @__PURE__ */ React.createElement("div", { style: { flex: "1 1 220px" } }, /* @__PURE__ */ React.createElement("label", { style: fieldStyles.label }, "Insert a saved block"), /* @__PURE__ */ React.createElement(
      "select",
      {
        value: "",
        onChange: (e) => {
          insertBlockFromLibrary(e.target.value);
          e.target.value = "";
        },
        style: { ...fieldStyles.input, height: 38 }
      },
      /* @__PURE__ */ React.createElement("option", { value: "" }, "Choose a block\u2026"),
      BUILTIN_BLOCKS.length > 0 && /* @__PURE__ */ React.createElement("optgroup", { label: "Built-in" }, BUILTIN_BLOCKS.map((b) => /* @__PURE__ */ React.createElement("option", { key: b.id, value: b.id }, blockTitle(b)))),
      blockLib.length > 0 && /* @__PURE__ */ React.createElement("optgroup", { label: "Saved by you" }, blockLib.map((b) => /* @__PURE__ */ React.createElement("option", { key: b.id, value: b.id }, blockTitle(b))))
    ))), blockLib.length > 0 && /* @__PURE__ */ React.createElement("details", { style: { marginTop: 10 } }, /* @__PURE__ */ React.createElement("summary", { style: {
      fontFamily: '"Source Sans 3", "Helvetica Neue", Arial, sans-serif',
      fontSize: 11,
      letterSpacing: "0.06em",
      color: "#9a8773",
      cursor: "pointer"
    } }, "Manage saved blocks (", blockLib.length, ")"), /* @__PURE__ */ React.createElement("ul", { style: { listStyle: "none", margin: "8px 0 0", padding: 0 } }, blockLib.map((b) => /* @__PURE__ */ React.createElement("li", { key: b.id, style: {
      display: "flex",
      alignItems: "center",
      justifyContent: "space-between",
      gap: 10,
      padding: "5px 0",
      borderTop: "1px solid #ece1cf"
    } }, /* @__PURE__ */ React.createElement("span", { style: {
      fontFamily: '"Source Sans 3", "Helvetica Neue", Arial, sans-serif',
      fontSize: 13,
      color: "#2d2927"
    } }, blockTitle(b)), /* @__PURE__ */ React.createElement(
      "button",
      {
        type: "button",
        style: { ...btnStyle("danger"), padding: "4px 10px" },
        onClick: () => {
          if (window.confirm(`Delete "${blockTitle(b)}" from your saved blocks?`)) deleteSavedBlock(b.id);
        }
      },
      "Delete"
    ))))));
    return /* @__PURE__ */ React.createElement(
      "div",
      {
        "data-mo-modal-overlay": true,
        style: {
          position: "fixed",
          inset: 0,
          background: "rgba(45, 41, 39, 0.5)",
          zIndex: 1e5,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          padding: 20
        },
        onClick: onClose
      },
      /* @__PURE__ */ React.createElement(
        "div",
        {
          "data-mo-modal-shell": true,
          onClick: (e) => e.stopPropagation(),
          style: {
            width: "100%",
            maxWidth: 720,
            maxHeight: "92vh",
            background: "#fbf7ee",
            border: "1px solid #d8c4a3",
            display: "flex",
            flexDirection: "column",
            boxShadow: "0 20px 60px rgba(45, 41, 39, 0.4)"
          }
        },
        /* @__PURE__ */ React.createElement("div", { "data-mo-modal-header": true, style: {
          padding: "18px 24px",
          borderBottom: "1px solid #e8d9bd",
          display: "flex",
          alignItems: "center",
          gap: 14,
          background: "#f1e0c9"
        } }, /* @__PURE__ */ React.createElement("div", { style: {
          fontFamily: '"IM Fell English", Georgia, serif',
          fontSize: 22,
          color: "#2d2927"
        } }, "Edit Content"), /* @__PURE__ */ React.createElement("div", { style: { flex: 1 } }), /* @__PURE__ */ React.createElement("button", { onClick: () => {
          setShowRssPanel(!showRssPanel);
          if (!showRssPanel) setShowPodcastPanel(false);
        }, style: btnStyle(showRssPanel ? "primary" : "secondary") }, showRssPanel ? "Hide Essays Pull" : "Pull Essays"), /* @__PURE__ */ React.createElement("button", { onClick: () => {
          setShowPodcastPanel(!showPodcastPanel);
          if (!showPodcastPanel) setShowRssPanel(false);
        }, style: btnStyle(showPodcastPanel ? "primary" : "secondary") }, showPodcastPanel ? "Hide Podcast Pull" : "Pull Podcasts"), /* @__PURE__ */ React.createElement("button", { onClick: () => onChange(DEFAULT_CONTENT), style: btnStyle("danger") }, "Reset"), /* @__PURE__ */ React.createElement("button", { onClick: onClose, style: { ...btnStyle("secondary"), border: "none", fontSize: 18, padding: "4px 10px" } }, "\xD7")),
        showRssPanel && /* @__PURE__ */ React.createElement("div", { style: {
          padding: "16px 24px",
          background: "#f6f3f2",
          borderBottom: "1px solid #e8d9bd"
        } }, /* @__PURE__ */ React.createElement("div", { style: {
          fontFamily: '"Source Sans 3", "Helvetica Neue", Arial, sans-serif',
          fontSize: 12,
          color: "#6b6258",
          marginBottom: 12,
          lineHeight: 1.55
        } }, "Pull posts directly from Ghost\u2019s Content API. Get a key in Ghost Admin \u2192 Settings \u2192 Integrations \u2192 Add custom integration \u2192 copy ", /* @__PURE__ */ React.createElement("strong", null, "Content API Key"), ". Stored locally in your browser."), /* @__PURE__ */ React.createElement("div", { style: { display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 10 } }, /* @__PURE__ */ React.createElement("div", null, /* @__PURE__ */ React.createElement("label", { style: fieldStyles.label }, "Site URL"), /* @__PURE__ */ React.createElement(
          "input",
          {
            type: "url",
            value: ghostUrl,
            onChange: (e) => setGhostUrl(e.target.value),
            placeholder: "https://yoursite.ghost.io",
            style: { ...fieldStyles.input, fontFamily: "ui-monospace, Menlo, monospace", fontSize: 12 }
          }
        )), /* @__PURE__ */ React.createElement("div", null, /* @__PURE__ */ React.createElement("label", { style: fieldStyles.label }, "Content API Key"), /* @__PURE__ */ React.createElement(
          "input",
          {
            type: "text",
            value: ghostKey,
            onChange: (e) => setGhostKey(e.target.value),
            placeholder: "22fe1aa0\u2026",
            style: { ...fieldStyles.input, fontFamily: "ui-monospace, Menlo, monospace", fontSize: 12 }
          }
        ))), /* @__PURE__ */ React.createElement("div", { style: { marginBottom: 10 } }, /* @__PURE__ */ React.createElement("label", { style: fieldStyles.label }, "Filter (optional)"), /* @__PURE__ */ React.createElement(
          "input",
          {
            type: "text",
            value: ghostFilter,
            onChange: (e) => setGhostFilter(e.target.value),
            placeholder: "e.g. tag:essays  \u2014 or leave blank for newest posts",
            style: { ...fieldStyles.input, fontFamily: "ui-monospace, Menlo, monospace", fontSize: 12 }
          }
        )), /* @__PURE__ */ React.createElement("div", { style: { display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" } }, /* @__PURE__ */ React.createElement("div", { style: { display: "flex", alignItems: "center", gap: 6 } }, /* @__PURE__ */ React.createElement(
          "input",
          {
            type: "number",
            min: "1",
            max: "50",
            value: essayCount,
            onChange: (e) => setEssayCount(Math.max(1, Math.min(50, parseInt(e.target.value, 10) || 1))),
            style: { ...fieldStyles.input, width: 56, textAlign: "center", padding: "8px 6px" }
          }
        ), /* @__PURE__ */ React.createElement("button", { onClick: () => fetchFromGhost("essays", essayCount), style: btnStyle("primary"), disabled: !ghostKey.trim() || ghostLoading }, ghostLoading ? "Loading\u2026" : `Pull \u2192 Essays`)), ghostMessage && /* @__PURE__ */ React.createElement("div", { style: { fontSize: 12, color: "#188038" } }, "\u2713 ", ghostMessage), ghostError && /* @__PURE__ */ React.createElement("div", { style: { fontSize: 12, color: "#a43a27", maxWidth: "100%", wordBreak: "break-word" } }, "\u26A0 ", ghostError)), /* @__PURE__ */ React.createElement("details", { style: { marginTop: 14 } }, /* @__PURE__ */ React.createElement("summary", { style: {
          cursor: "pointer",
          fontFamily: '"Source Sans 3", sans-serif',
          fontSize: 11,
          fontWeight: 700,
          letterSpacing: "0.14em",
          textTransform: "uppercase",
          color: "#6b6258"
        } }, "Or paste raw RSS/XML"), /* @__PURE__ */ React.createElement("div", { style: { marginTop: 10 } }, /* @__PURE__ */ React.createElement(
          "textarea",
          {
            value: rssText,
            onChange: (e) => setRssText(e.target.value),
            placeholder: '<?xml version="1.0"?><rss>\u2026</rss>',
            style: {
              ...fieldStyles.textarea,
              minHeight: 90,
              fontFamily: "ui-monospace, Menlo, Consolas, monospace",
              fontSize: 11
            }
          }
        ), /* @__PURE__ */ React.createElement("div", { style: { display: "flex", gap: 10, marginTop: 8 } }, /* @__PURE__ */ React.createElement("button", { onClick: () => replaceEssaysFromRSS("essays", 10), style: btnStyle("secondary"), disabled: !rssText.trim() }, "Load XML \u2192 Essays"), /* @__PURE__ */ React.createElement("button", { onClick: () => replaceEssaysFromRSS("podcasts", 2), style: btnStyle("secondary"), disabled: !rssText.trim() }, "Load XML \u2192 Podcasts"))))),
        showPodcastPanel && /* @__PURE__ */ React.createElement("div", { style: {
          padding: "16px 24px",
          background: "#f6f3f2",
          borderBottom: "1px solid #e8d9bd"
        } }, /* @__PURE__ */ React.createElement("div", { style: {
          fontFamily: '"Source Sans 3", "Helvetica Neue", Arial, sans-serif',
          fontSize: 12,
          color: "#6b6258",
          marginBottom: 12,
          lineHeight: 1.55
        } }, "Pulls the latest episode of each show via the existing ", /* @__PURE__ */ React.createElement("strong", null, "mo-podcast-feed"), " worker (the same one the homepage podcast cards consume). The worker holds the Buzzsprout API token as an env secret, so this page doesn't need it. Each row maps to a slot in the email; show name + CTA stay as you've edited them, while ", /* @__PURE__ */ React.createElement("strong", null, "title, summary, episode number, image, and link"), " get replaced."), /* @__PURE__ */ React.createElement("div", { style: { marginBottom: 12 } }, /* @__PURE__ */ React.createElement("label", { style: fieldStyles.label }, "Worker URL"), /* @__PURE__ */ React.createElement(
          "input",
          {
            type: "url",
            value: podcastWorkerUrl,
            onChange: (e) => setPodcastWorkerUrl(e.target.value),
            placeholder: "https://mo-podcast-feed.your-subdomain.workers.dev/",
            style: { ...fieldStyles.input, fontFamily: "ui-monospace, Menlo, monospace", fontSize: 12 }
          }
        )), /* @__PURE__ */ React.createElement("div", { style: { display: "grid", gap: 8, marginBottom: 12 } }, podcastFeeds.map((feed, i) => /* @__PURE__ */ React.createElement("div", { key: i, style: {
          display: "grid",
          gridTemplateColumns: "1fr 1fr auto",
          gap: 8,
          alignItems: "end"
        } }, /* @__PURE__ */ React.createElement("div", null, i === 0 && /* @__PURE__ */ React.createElement("label", { style: fieldStyles.label }, "Show name (display)"), /* @__PURE__ */ React.createElement(
          "input",
          {
            type: "text",
            value: feed.label,
            onChange: (e) => updatePodcastFeed(i, { label: e.target.value }),
            placeholder: "Mere Fidelity",
            style: fieldStyles.input
          }
        )), /* @__PURE__ */ React.createElement("div", null, i === 0 && /* @__PURE__ */ React.createElement("label", { style: fieldStyles.label }, "Show slug"), /* @__PURE__ */ React.createElement(
          "input",
          {
            type: "text",
            value: feed.slug || "",
            onChange: (e) => updatePodcastFeed(i, { slug: e.target.value }),
            placeholder: "mere-fidelity",
            style: { ...fieldStyles.input, fontFamily: "ui-monospace, Menlo, monospace", fontSize: 12 }
          }
        )), /* @__PURE__ */ React.createElement(
          "button",
          {
            onClick: () => removePodcastFeed(i),
            style: {
              ...btnStyle("secondary"),
              padding: "8px 12px",
              borderColor: "#d8c4a3",
              color: "#9a8773"
            },
            title: "Remove this show"
          },
          "\xD7"
        )))), /* @__PURE__ */ React.createElement("div", { style: { display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" } }, /* @__PURE__ */ React.createElement("button", { onClick: fetchPodcastFeeds, style: btnStyle("primary"), disabled: podcastLoading }, podcastLoading ? "Fetching\u2026" : "Pull latest episodes \u2192"), /* @__PURE__ */ React.createElement("button", { onClick: addPodcastFeed, style: btnStyle("secondary") }, "+ Add show"), podcastMessage && /* @__PURE__ */ React.createElement("div", { style: { fontSize: 12, color: "#188038" } }, "\u2713 ", podcastMessage), podcastError && /* @__PURE__ */ React.createElement("div", { style: { fontSize: 12, color: "#a43a27", maxWidth: "100%", wordBreak: "break-word" } }, "\u26A0 ", podcastError)), /* @__PURE__ */ React.createElement("details", { style: { marginTop: 14 } }, /* @__PURE__ */ React.createElement("summary", { style: {
          cursor: "pointer",
          fontFamily: '"Source Sans 3", sans-serif',
          fontSize: 11,
          fontWeight: 700,
          letterSpacing: "0.14em",
          textTransform: "uppercase",
          color: "#6b6258"
        } }, "About the show slugs"), /* @__PURE__ */ React.createElement("div", { style: {
          marginTop: 8,
          fontSize: 12,
          lineHeight: 1.7,
          color: "#6b6258",
          fontFamily: '"Source Sans 3", sans-serif'
        } }, /* @__PURE__ */ React.createElement("div", null, /* @__PURE__ */ React.createElement("strong", null, "Worker URL:"), " the same ", /* @__PURE__ */ React.createElement("code", { style: { fontFamily: "ui-monospace, monospace", fontSize: 11 } }, "mo-podcast-feed"), " worker URL the site uses for its homepage Listen rail (look in your Cloudflare dashboard \u2192 Workers)."), /* @__PURE__ */ React.createElement("div", null, /* @__PURE__ */ React.createElement("strong", null, "Show slug:"), " the slug configured in ", /* @__PURE__ */ React.createElement("code", { style: { fontFamily: "ui-monospace, monospace", fontSize: 11 } }, "workers/podcast-feed.js"), "'s ", /* @__PURE__ */ React.createElement("code", { style: { fontFamily: "ui-monospace, monospace", fontSize: 11 } }, "SHOWS"), " map. Currently ", /* @__PURE__ */ React.createElement("code", { style: { fontFamily: "ui-monospace, monospace", fontSize: 11 } }, "mere-fidelity"), " and ", /* @__PURE__ */ React.createElement("code", { style: { fontFamily: "ui-monospace, monospace", fontSize: 11 } }, "christians-reading-classics"), " (both Buzzsprout). Add new shows by editing that map and redeploying."), /* @__PURE__ */ React.createElement("div", { style: { marginTop: 6, color: "#9a8773" } }, /* @__PURE__ */ React.createElement("em", null, "Why this worker?"), " It already handles Buzzsprout auth and caching. Reusing it means one worker to maintain instead of two, and credentials never leave Cloudflare.")))),
        /* @__PURE__ */ React.createElement("div", { "data-mo-modal-body": true, style: { overflowY: "auto", padding: "0 24px 20px", flex: 1 } }, /* @__PURE__ */ React.createElement(Group, { title: "Header", defaultOpen: true }, /* @__PURE__ */ React.createElement(
          Field,
          {
            label: "Title (right of logo) \u2014 leave empty to remove",
            value: content.mastheadTitle != null ? content.mastheadTitle : "The Weekly Digest",
            placeholder: "The Weekly Digest",
            onChange: (v) => updateField("mastheadTitle", v)
          }
        ), /* @__PURE__ */ React.createElement("div", { style: { display: "grid", gridTemplateColumns: "1fr 2fr", gap: 12 } }, /* @__PURE__ */ React.createElement(Field, { label: "Issue number", value: content.issueNumber, onChange: (v) => updateField("issueNumber", v) }), /* @__PURE__ */ React.createElement(Field, { label: "Date", value: content.dateStr, onChange: (v) => updateField("dateStr", v), placeholder: "May 4, 2026" }))), /* @__PURE__ */ React.createElement(Group, { title: "Personalization tags (click to copy)" }, /* @__PURE__ */ React.createElement("div", { style: {
          fontFamily: '"Source Sans 3", Arial, sans-serif',
          fontSize: 12,
          color: "#6b6258",
          lineHeight: 1.5,
          marginBottom: 12
        } }, "Drop these into any text field \u2014 letter body, button label, subject line, sponsor copy. Kit substitutes them per recipient at send time. Use the ", /* @__PURE__ */ React.createElement("code", { style: { fontFamily: "ui-monospace, monospace" } }, '| default: "friend"'), ` filter to provide a fallback when the field is empty (so you don't get "Hi ,").`), /* @__PURE__ */ React.createElement("div", { style: { display: "flex", flexDirection: "column", gap: 6 } }, KIT_TAGS.map(({ tag, label }) => {
          const isCopied = copiedTag === tag;
          return /* @__PURE__ */ React.createElement(
            "button",
            {
              key: tag,
              onClick: async () => {
                const ok = window.copyToClipboard ? await window.copyToClipboard(tag) : false;
                if (ok) {
                  setCopiedTag(tag);
                  setTimeout(() => setCopiedTag((c) => c === tag ? null : c), 1500);
                }
              },
              title: `Copy ${tag}`,
              style: {
                display: "flex",
                alignItems: "center",
                gap: 12,
                padding: "8px 12px",
                background: isCopied ? "#fbf3e3" : "#fff",
                border: "1.5px solid " + (isCopied ? "#c1593c" : "#e8d9bd"),
                borderRadius: 10,
                cursor: "pointer",
                textAlign: "left",
                fontFamily: '"Source Sans 3", Arial, sans-serif'
              }
            },
            /* @__PURE__ */ React.createElement("code", { style: {
              fontFamily: "ui-monospace, Menlo, Consolas, monospace",
              fontSize: 12,
              color: "#2d2927",
              whiteSpace: "nowrap",
              overflow: "hidden",
              textOverflow: "ellipsis",
              flexShrink: 0,
              maxWidth: "60%"
            } }, tag),
            /* @__PURE__ */ React.createElement("span", { style: { flex: 1, fontSize: 11, color: "#6b6258", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" } }, "\u2014 ", label),
            /* @__PURE__ */ React.createElement("span", { style: {
              fontSize: 10,
              fontWeight: 700,
              letterSpacing: "0.14em",
              textTransform: "uppercase",
              color: isCopied ? "#c1593c" : "#9a8773",
              flexShrink: 0
            } }, isCopied ? "\u2713 Copied" : "Copy")
          );
        }))), /* @__PURE__ */ React.createElement(Group, { title: "Sections (order + show/hide)", defaultOpen: true }, /* @__PURE__ */ React.createElement("div", { style: {
          fontFamily: '"Source Sans 3", Arial, sans-serif',
          fontSize: 12,
          color: "#6b6258",
          lineHeight: 1.5,
          marginBottom: 12
        } }, "Drag rows to reorder sections in the email. Toggle the checkbox to show or hide a section without losing its content."), (() => {
          const FIXED_SECTION_LABELS = {
            letter: "Body block",
            membership: "Membership CTA / thanks",
            sponsorTop: "Top sponsor block",
            essays: "Essays grid",
            podcasts: "Podcasts grid",
            sponsorBottom: "Bottom sponsor block",
            signature: "Signature"
          };
          const FIXED_KEYS = Object.keys(FIXED_SECTION_LABELS);
          const blocks = content.customBlocks || [];
          const blocksById = {};
          blocks.forEach((b) => {
            if (b && b.id) blocksById[b.id] = b;
          });
          const blockIds = blocks.map((b) => b && b.id).filter(Boolean);
          const KNOWN = /* @__PURE__ */ new Set([...FIXED_KEYS, ...blockIds]);
          const orderRaw = Array.isArray(content.sectionOrder) && content.sectionOrder.length ? content.sectionOrder.filter((k) => KNOWN.has(k)) : FIXED_KEYS;
          const missing = [...FIXED_KEYS, ...blockIds].filter((k) => !orderRaw.includes(k));
          const fullOrder = [...orderRaw, ...missing];
          const labelFor = (k) => {
            if (FIXED_SECTION_LABELS[k]) return { label: FIXED_SECTION_LABELS[k], isBlock: false };
            const block = blocksById[k];
            if (block) {
              const plain = (block.text || "").replace(/\[([^\]]+)\]\([^)]+\)/g, "$1").replace(/[*_]+/g, "").replace(/\n+/g, " ").trim();
              const snippet = plain.length > 38 ? plain.slice(0, 38) + "\u2026" : plain;
              if (block.type === "button") {
                return { label: `Button \u2014 ${snippet || "untitled"}`, isBlock: true };
              }
              if (block.type === "image") {
                const head = (block.heading || "").replace(/[*_]+/g, "").trim();
                const cap = (block.linkText || "").trim();
                const alt = (block.alt || "").trim();
                const desc = head || cap || alt || "untitled";
                return { label: `Image \u2014 ${desc}`, isBlock: true };
              }
              return { label: `Text \u2014 ${snippet || "(empty)"}`, isBlock: true };
            }
            return { label: k, isBlock: false };
          };
          const move = (from, to) => {
            if (from === to) return;
            const next = [...fullOrder];
            const [m] = next.splice(from, 1);
            next.splice(to, 0, m);
            updateField("sectionOrder", next);
          };
          return /* @__PURE__ */ React.createElement("div", { style: { display: "flex", flexDirection: "column", gap: 6 } }, fullOrder.map((k, i) => {
            const enabled = content.sections?.[k] !== false;
            const { label, isBlock } = labelFor(k);
            const audienceHidden = isMember && (k === "sponsorTop" || k === "sponsorBottom");
            const audienceNote = audienceHidden ? "\xB7 hidden for paid" : k === "membership" ? `\xB7 showing ${isMember ? "member-thanks" : "CTA"}` : "";
            const isDragOver = sectionDragOver === i;
            return /* @__PURE__ */ React.createElement(
              "div",
              {
                key: k,
                draggable: true,
                onDragStart: (e) => {
                  e.dataTransfer.effectAllowed = "move";
                  e.dataTransfer.setData("text/plain", String(i));
                  e.currentTarget.style.opacity = "0.4";
                },
                onDragEnd: (e) => {
                  e.currentTarget.style.opacity = "1";
                  setSectionDragOver(null);
                },
                onDragOver: (e) => {
                  e.preventDefault();
                  e.dataTransfer.dropEffect = "move";
                  if (sectionDragOver !== i) setSectionDragOver(i);
                },
                onDragLeave: (e) => {
                  if (!e.currentTarget.contains(e.relatedTarget)) {
                    setSectionDragOver((c) => c === i ? null : c);
                  }
                },
                onDrop: (e) => {
                  e.preventDefault();
                  setSectionDragOver(null);
                  const from = parseInt(e.dataTransfer.getData("text/plain"), 10);
                  if (!Number.isNaN(from)) move(from, i);
                },
                style: {
                  display: "flex",
                  alignItems: "center",
                  gap: 10,
                  padding: "10px 12px",
                  background: enabled ? audienceHidden ? "#f0eadf" : "#fff" : "#f0eadf",
                  border: "1.5px solid " + (isDragOver ? "#ee7d51" : enabled ? isBlock ? "#c1593c" : "#2d2927" : "#d8c4a3"),
                  boxShadow: isDragOver ? "0 0 0 2px rgba(238,125,81,0.25)" : "none",
                  borderRadius: 10,
                  cursor: "grab",
                  fontFamily: '"Source Sans 3", Arial, sans-serif',
                  fontSize: 12,
                  color: enabled && !audienceHidden ? "#2d2927" : "#9a8773",
                  fontWeight: enabled && !audienceHidden ? 600 : 400,
                  opacity: audienceHidden ? 0.65 : 1,
                  userSelect: "none",
                  transition: "border-color 0.1s, box-shadow 0.1s"
                }
              },
              /* @__PURE__ */ React.createElement("span", { "aria-hidden": "true", style: { fontSize: 14, color: "#9a8773", cursor: "grab" } }, "\u22EE\u22EE"),
              /* @__PURE__ */ React.createElement("span", { style: { flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" } }, label, audienceNote && /* @__PURE__ */ React.createElement("span", { style: { marginLeft: 8, fontSize: 10, fontWeight: 400, color: "#9a8773", letterSpacing: "0.04em" } }, audienceNote)),
              /* @__PURE__ */ React.createElement(
                "input",
                {
                  type: "checkbox",
                  checked: enabled,
                  onChange: (e) => {
                    const sections = { ...content.sections || {} };
                    sections[k] = e.target.checked;
                    updateField("sections", sections);
                  },
                  onClick: (e) => e.stopPropagation(),
                  onDragStart: (e) => e.stopPropagation(),
                  style: { accentColor: "#ee7d51", width: 16, height: 16, flexShrink: 0, cursor: "pointer" }
                }
              )
            );
          }));
        })()), /* @__PURE__ */ React.createElement(Group, { title: "Body block" }, /* @__PURE__ */ React.createElement(Field, { label: "Title", value: content.editorTitle, onChange: (v) => updateField("editorTitle", v) }), /* @__PURE__ */ React.createElement(
          Field,
          {
            label: "Body \u2014 Markdown supported: **bold**, *italic*, __underline__, [link](url). Blank line = new paragraph.",
            value: content.editorBody != null ? content.editorBody : (content.editorParagraphs || []).join("\n\n"),
            multiline: true,
            rows: 14,
            onChange: (v) => updateField("editorBody", v)
          }
        ), /* @__PURE__ */ React.createElement("div", { style: { marginBottom: 12 } }, /* @__PURE__ */ React.createElement("label", { style: fieldStyles.label }, "Signature"), /* @__PURE__ */ React.createElement("div", { style: { display: "flex", gap: 8, marginTop: 4 } }, Object.entries(window.SIGNATURES || {}).map(([key, sig]) => {
          const isActive = content.signatureKey === key;
          return /* @__PURE__ */ React.createElement(
            "button",
            {
              key,
              onClick: () => {
                const next = JSON.parse(JSON.stringify(content));
                next.signatureKey = key;
                next.editorSignature = `\u2014 ${sig.name}, ${sig.title}`;
                onChange(next);
              },
              style: {
                flex: 1,
                display: "flex",
                alignItems: "center",
                gap: 10,
                padding: "10px 14px",
                background: isActive ? "#fbf3e3" : "#fff",
                border: "1.5px solid " + (isActive ? "#c1593c" : "#e8d9bd"),
                borderRadius: 10,
                cursor: "pointer",
                textAlign: "left",
                fontFamily: '"Source Sans 3", Arial, sans-serif'
              }
            },
            /* @__PURE__ */ React.createElement(
              "img",
              {
                src: sig.photo,
                alt: sig.name,
                width: "36",
                height: "36",
                style: {
                  width: 36,
                  height: 36,
                  borderRadius: "50%",
                  objectFit: "cover",
                  flexShrink: 0,
                  background: "#e8d9bd"
                }
              }
            ),
            /* @__PURE__ */ React.createElement("div", null, /* @__PURE__ */ React.createElement("div", { style: { fontSize: 13, fontWeight: 600, color: "#2d2927", lineHeight: 1.2 } }, sig.name), /* @__PURE__ */ React.createElement("div", { style: { fontSize: 10, color: "#9a8773", marginTop: 2, lineHeight: 1.2 } }, sig.title))
          );
        })))), /* @__PURE__ */ React.createElement(Group, { title: `Custom blocks (${(content.customBlocks || []).length})` }, /* @__PURE__ */ React.createElement("div", { style: {
          fontFamily: '"Source Sans 3", Arial, sans-serif',
          fontSize: 12,
          color: "#6b6258",
          lineHeight: 1.5,
          marginBottom: 12
        } }, "Free-form text, button, or image blocks. Each block appears as its own row in the Sections list above \u2014 drag it there to position it anywhere in the email (between essays and podcasts, before the membership CTA, etc.). Text blocks accept Markdown (", /* @__PURE__ */ React.createElement("code", { style: { fontFamily: "ui-monospace, monospace" } }, "**bold**"), ", ", /* @__PURE__ */ React.createElement("code", { style: { fontFamily: "ui-monospace, monospace" } }, "*italic*"), ", ", /* @__PURE__ */ React.createElement("code", { style: { fontFamily: "ui-monospace, monospace" } }, "__underline__"), ", ", /* @__PURE__ */ React.createElement("code", { style: { fontFamily: "ui-monospace, monospace" } }, "[link](url)"), "). Image blocks take a hosted image URL plus an optional headline (above the image), body text (below the image, Markdown), a link, and a caption that links below the image."), (content.customBlocks || []).map((block, i) => {
          const removeBlock = () => {
            const next = JSON.parse(JSON.stringify(content));
            next.customBlocks = (next.customBlocks || []).filter((_, j) => j !== i);
            if (Array.isArray(next.sectionOrder) && block.id) {
              next.sectionOrder = next.sectionOrder.filter((k) => k !== block.id);
            }
            if (next.sections && block.id && block.id in next.sections) {
              next.sections = { ...next.sections };
              delete next.sections[block.id];
            }
            onChange(next);
          };
          const reorderBlock = (from, to) => {
            if (from === to) return;
            const next = JSON.parse(JSON.stringify(content));
            const arr = [...next.customBlocks || []];
            const [m] = arr.splice(from, 1);
            arr.splice(to, 0, m);
            next.customBlocks = arr;
            onChange(next);
          };
          const blockIsDragOver = blockDragOver === i;
          return /* @__PURE__ */ React.createElement(
            "div",
            {
              key: block.id || i,
              onDragOver: (e) => {
                e.preventDefault();
                e.dataTransfer.dropEffect = "move";
                if (blockDragOver !== i) setBlockDragOver(i);
              },
              onDragLeave: (e) => {
                if (!e.currentTarget.contains(e.relatedTarget)) {
                  setBlockDragOver((c) => c === i ? null : c);
                }
              },
              onDrop: (e) => {
                e.preventDefault();
                setBlockDragOver(null);
                const from = parseInt(e.dataTransfer.getData("text/plain"), 10);
                if (!Number.isNaN(from)) reorderBlock(from, i);
              },
              style: {
                marginBottom: 14,
                padding: 12,
                background: "#fff",
                border: "1px solid " + (blockIsDragOver ? "#ee7d51" : "#e8d9bd"),
                boxShadow: blockIsDragOver ? "0 0 0 2px rgba(238,125,81,0.25)" : "none",
                transition: "border-color 0.1s, box-shadow 0.1s"
              }
            },
            /* @__PURE__ */ React.createElement(
              "div",
              {
                draggable: true,
                onDragStart: (e) => {
                  e.dataTransfer.effectAllowed = "move";
                  e.dataTransfer.setData("text/plain", String(i));
                },
                onDragEnd: () => setBlockDragOver(null),
                style: { display: "flex", alignItems: "center", gap: 8, marginBottom: 10, cursor: "grab", userSelect: "none" },
                title: "Drag to reorder"
              },
              /* @__PURE__ */ React.createElement("span", { "aria-hidden": "true", style: { fontSize: 14, color: "#9a8773" } }, "\u22EE\u22EE"),
              /* @__PURE__ */ React.createElement("div", { style: {
                fontFamily: '"Source Sans 3", sans-serif',
                fontSize: 10,
                fontWeight: 700,
                letterSpacing: "0.18em",
                textTransform: "uppercase",
                color: "#c1593c",
                flex: 1
              } }, block.type === "button" ? `Button \xB7 #${i + 1}` : block.type === "image" ? `Image \xB7 #${i + 1}` : `Text \xB7 #${i + 1}`),
              /* @__PURE__ */ React.createElement("button", { onClick: () => saveBlockToLibrary(block), style: { ...btnStyle("secondary"), padding: "4px 10px" }, title: "Save this block to your library" }, "Save"),
              /* @__PURE__ */ React.createElement("button", { onClick: removeBlock, style: { ...btnStyle("danger"), padding: "4px 10px" }, title: "Remove" }, "\xD7")
            ),
            block.type === "button" ? /* @__PURE__ */ React.createElement(React.Fragment, null, /* @__PURE__ */ React.createElement("div", { style: { display: "grid", gridTemplateColumns: "2fr 1fr", gap: 12 } }, /* @__PURE__ */ React.createElement(Field, { label: "Button text", value: block.text, onChange: (v) => {
              const arr = [...content.customBlocks || []];
              arr[i] = { ...arr[i], text: v };
              updateField("customBlocks", arr);
            } }), /* @__PURE__ */ React.createElement("div", null, /* @__PURE__ */ React.createElement("label", { style: fieldStyles.label }, "Style"), /* @__PURE__ */ React.createElement(
              "select",
              {
                value: block.variant || "primary",
                onChange: (e) => {
                  const arr = [...content.customBlocks || []];
                  arr[i] = { ...arr[i], variant: e.target.value };
                  updateField("customBlocks", arr);
                },
                style: { ...fieldStyles.input, height: 36 }
              },
              /* @__PURE__ */ React.createElement("option", { value: "primary" }, "Primary (filled)"),
              /* @__PURE__ */ React.createElement("option", { value: "secondary" }, "Secondary (outlined)")
            ))), /* @__PURE__ */ React.createElement(Field, { label: "Link", value: block.url, placeholder: "https://\u2026", onChange: (v) => {
              const arr = [...content.customBlocks || []];
              arr[i] = { ...arr[i], url: v };
              updateField("customBlocks", arr);
            } })) : block.type === "image" ? /* @__PURE__ */ React.createElement(React.Fragment, null, /* @__PURE__ */ React.createElement(
              Field,
              {
                label: "Headline (optional) \u2014 appears above the image",
                value: block.heading,
                placeholder: "e.g. Get the Journal",
                hint: "Markdown supported. Leave blank for no headline.",
                onChange: (v) => {
                  const arr = [...content.customBlocks || []];
                  arr[i] = { ...arr[i], heading: v };
                  updateField("customBlocks", arr);
                }
              }
            ), /* @__PURE__ */ React.createElement(ImageUrlField, { value: block.src, onChange: (v) => {
              const arr = [...content.customBlocks || []];
              arr[i] = { ...arr[i], src: v };
              updateField("customBlocks", arr);
            } }), /* @__PURE__ */ React.createElement(
              Field,
              {
                label: "Body text (optional) \u2014 appears below the image, Markdown supported",
                value: block.body,
                multiline: true,
                rows: 5,
                hint: "Leave blank for no body text.",
                onChange: (v) => {
                  const arr = [...content.customBlocks || []];
                  arr[i] = { ...arr[i], body: v };
                  updateField("customBlocks", arr);
                }
              }
            ), /* @__PURE__ */ React.createElement(Field, { label: "Link (optional) \u2014 where the image and caption point", value: block.url, placeholder: "https://\u2026", onChange: (v) => {
              const arr = [...content.customBlocks || []];
              arr[i] = { ...arr[i], url: v };
              updateField("customBlocks", arr);
            } }), /* @__PURE__ */ React.createElement(
              Field,
              {
                label: "Caption (appears below the image)",
                value: block.linkText,
                placeholder: "e.g. Read the full story \u2192",
                hint: (block.url || "").trim() ? "Shown as a clickable link to the URL above." : "Shown as a plain caption. Add a link above to make it clickable.",
                onChange: (v) => {
                  const arr = [...content.customBlocks || []];
                  arr[i] = { ...arr[i], linkText: v };
                  updateField("customBlocks", arr);
                }
              }
            ), /* @__PURE__ */ React.createElement(
              Field,
              {
                label: "Alt text (describes the image for accessibility)",
                value: block.alt,
                hint: (block.src || "").trim() && !(block.alt || "").trim() ? "No alt text \u2014 screen readers will skip this image. Add a description, or leave blank if it is purely decorative." : "",
                onChange: (v) => {
                  const arr = [...content.customBlocks || []];
                  arr[i] = { ...arr[i], alt: v };
                  updateField("customBlocks", arr);
                }
              }
            )) : /* @__PURE__ */ React.createElement(
              Field,
              {
                label: "Text \u2014 Markdown supported",
                value: block.text,
                multiline: true,
                rows: 6,
                onChange: (v) => {
                  const arr = [...content.customBlocks || []];
                  arr[i] = { ...arr[i], text: v };
                  updateField("customBlocks", arr);
                }
              }
            )
          );
        }), /* @__PURE__ */ React.createElement("div", { style: { display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" } }, /* @__PURE__ */ React.createElement(
          "button",
          {
            onClick: () => {
              const id = `b_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 7)}`;
              const next = JSON.parse(JSON.stringify(content));
              next.customBlocks = [...next.customBlocks || [], { id, type: "text", text: "" }];
              next.sectionOrder = Array.isArray(next.sectionOrder) ? [...next.sectionOrder, id] : [id];
              onChange(next);
            },
            style: btnStyle("primary")
          },
          "+ Add Text Box"
        ), /* @__PURE__ */ React.createElement(
          "button",
          {
            onClick: () => {
              const id = `b_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 7)}`;
              const next = JSON.parse(JSON.stringify(content));
              next.customBlocks = [...next.customBlocks || [], { id, type: "button", text: "Click here", url: "", variant: "primary" }];
              next.sectionOrder = Array.isArray(next.sectionOrder) ? [...next.sectionOrder, id] : [id];
              onChange(next);
            },
            style: btnStyle("secondary")
          },
          "+ Add Button"
        ), /* @__PURE__ */ React.createElement(
          "button",
          {
            onClick: () => {
              const id = `b_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 7)}`;
              const next = JSON.parse(JSON.stringify(content));
              next.customBlocks = [...next.customBlocks || [], { id, type: "image", heading: "", src: "", body: "", url: "", linkText: "", alt: "" }];
              next.sectionOrder = Array.isArray(next.sectionOrder) ? [...next.sectionOrder, id] : [id];
              onChange(next);
            },
            style: btnStyle("secondary")
          },
          "+ Add Image"
        )), renderBlockLibraryTools()), /* @__PURE__ */ React.createElement(Group, { title: "Membership CTA (free version)" }, /* @__PURE__ */ React.createElement(Field, { label: "Headline (use \\\\n for line break)", value: content.membership?.headline, multiline: true, rows: 2, onChange: (v) => updateField("membership.headline", v) }), /* @__PURE__ */ React.createElement(Field, { label: "Body", value: content.membership?.body, multiline: true, rows: 3, onChange: (v) => updateField("membership.body", v) }), /* @__PURE__ */ React.createElement("div", { style: { display: "grid", gridTemplateColumns: "2fr 1fr", gap: 12 } }, /* @__PURE__ */ React.createElement(Field, { label: "CTA text", value: content.membership?.cta, onChange: (v) => updateField("membership.cta", v) }), /* @__PURE__ */ React.createElement(Field, { label: "Link", value: content.membership?.href, onChange: (v) => updateField("membership.href", v) }))), /* @__PURE__ */ React.createElement(Group, { title: "Member thanks (paid version)" }, /* @__PURE__ */ React.createElement(Field, { label: "Headline", value: content.memberThanks?.headline, onChange: (v) => updateField("memberThanks.headline", v) }), /* @__PURE__ */ React.createElement(Field, { label: "Body", value: content.memberThanks?.body, multiline: true, rows: 2, onChange: (v) => updateField("memberThanks.body", v) }), /* @__PURE__ */ React.createElement("div", { style: { display: "grid", gridTemplateColumns: "2fr 1fr", gap: 12 } }, /* @__PURE__ */ React.createElement(Field, { label: "CTA text", value: content.memberThanks?.cta, onChange: (v) => updateField("memberThanks.cta", v) }), /* @__PURE__ */ React.createElement(Field, { label: "Link", value: content.memberThanks?.href, onChange: (v) => updateField("memberThanks.href", v) }))), ["sponsorTop", "sponsorBottom"].map((key) => /* @__PURE__ */ React.createElement(Group, { key, title: key === "sponsorTop" ? "Sponsor \u2014 top slot" : "Sponsor \u2014 bottom slot" }, renderSponsorTools(key), /* @__PURE__ */ React.createElement("div", { style: { display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 } }, /* @__PURE__ */ React.createElement(Field, { label: "Section label", value: content[key]?.label, onChange: (v) => updateField(`${key}.label`, v) }), /* @__PURE__ */ React.createElement(Field, { label: "Sponsor name", value: content[key]?.name, onChange: (v) => updateField(`${key}.name`, v) })), /* @__PURE__ */ React.createElement(ImageUrlField, { value: content[key]?.image, onChange: (v) => updateField(`${key}.image`, v) }), /* @__PURE__ */ React.createElement(Field, { label: "Headline", value: content[key]?.headline, onChange: (v) => updateField(`${key}.headline`, v) }), /* @__PURE__ */ React.createElement(Field, { label: "Body", value: content[key]?.body, multiline: true, rows: 3, onChange: (v) => updateField(`${key}.body`, v) }), /* @__PURE__ */ React.createElement("div", { style: { display: "grid", gridTemplateColumns: "2fr 1fr", gap: 12 } }, /* @__PURE__ */ React.createElement(Field, { label: "CTA text", value: content[key]?.cta, onChange: (v) => updateField(`${key}.cta`, v) }), /* @__PURE__ */ React.createElement(Field, { label: "Link", value: content[key]?.href, onChange: (v) => updateField(`${key}.href`, v) })))), /* @__PURE__ */ React.createElement(Group, { title: `Essays (${content.essays?.length || 0})` }, /* @__PURE__ */ React.createElement(Field, { label: "Section heading", value: content.essaysHeading, placeholder: "This Week's Essays", onChange: (v) => updateField("essaysHeading", v) }), /* @__PURE__ */ React.createElement("div", { style: { display: "flex", gap: 8, marginBottom: 12, alignItems: "center", flexWrap: "wrap" } }, /* @__PURE__ */ React.createElement(
          "button",
          {
            onClick: () => {
              const PUB_RX = /^(mere\s*orthodoxy|admin|editor|administrator)$/i;
              const next = (content.essays || []).map((e) => e.byline && PUB_RX.test(e.byline.trim()) ? { ...e, byline: "" } : e);
              updateField("essays", next);
            },
            style: btnStyle("secondary")
          },
          "Clear placeholder bylines"
        ), /* @__PURE__ */ React.createElement("span", { style: {
          fontFamily: '"Source Sans 3", Arial, sans-serif',
          fontSize: 11,
          color: "#9a8773"
        } }, 'Removes "by Mere Orthodoxy", "by admin", etc. from all essays.')), (() => {
          const essays = content.essays || [];
          const explicitFeaturedIdx = essays.findIndex((e) => e && e.featured);
          const featuredIdx = explicitFeaturedIdx >= 0 ? explicitFeaturedIdx : essays.length ? 0 : -1;
          const setFeatured = (idx) => {
            const next = essays.map((e, j) => {
              const copy = { ...e };
              if (j === idx) copy.featured = true;
              else delete copy.featured;
              return copy;
            });
            updateField("essays", next);
          };
          return essays.map((essay, i) => {
            const isFeatured = i === featuredIdx;
            return /* @__PURE__ */ React.createElement("div", { key: i, style: {
              marginBottom: 18,
              padding: 12,
              background: isFeatured ? "#fbf3e3" : "#fff",
              border: "1px solid " + (isFeatured ? "#c1593c" : "#e8d9bd")
            } }, /* @__PURE__ */ React.createElement("div", { style: { display: "flex", alignItems: "center", gap: 10, marginBottom: 8 } }, /* @__PURE__ */ React.createElement("div", { style: {
              fontFamily: '"Source Sans 3", sans-serif',
              fontSize: 10,
              fontWeight: 700,
              letterSpacing: "0.18em",
              textTransform: "uppercase",
              color: "#c1593c",
              flex: 1
            } }, isFeatured ? `Featured \xB7 Essay ${i + 1}` : `Essay ${i + 1}`), /* @__PURE__ */ React.createElement(
              "button",
              {
                onClick: () => setFeatured(i),
                disabled: isFeatured,
                style: {
                  background: isFeatured ? "#ee7d51" : "transparent",
                  color: isFeatured ? "#fff" : "#c1593c",
                  border: "1.5px solid " + (isFeatured ? "#ee7d51" : "#c1593c"),
                  padding: "4px 12px",
                  fontFamily: '"Source Sans 3", Arial, sans-serif',
                  fontSize: 10,
                  fontWeight: 700,
                  letterSpacing: "0.14em",
                  textTransform: "uppercase",
                  cursor: isFeatured ? "default" : "pointer",
                  borderRadius: 10
                },
                title: isFeatured ? "This is the featured essay" : "Make this the featured essay"
              },
              isFeatured ? "\u2605 Featured" : "\u2606 Make featured"
            )), /* @__PURE__ */ React.createElement("div", { style: { display: "grid", gridTemplateColumns: "1fr 2fr", gap: 12 } }, /* @__PURE__ */ React.createElement(Field, { label: "Kicker", value: essay.kicker, onChange: (v) => updateField(`essays.${i}.kicker`, v) }), /* @__PURE__ */ React.createElement(Field, { label: "Byline", value: essay.byline, onChange: (v) => updateField(`essays.${i}.byline`, v) })), /* @__PURE__ */ React.createElement(Field, { label: "Title", value: essay.title, onChange: (v) => updateField(`essays.${i}.title`, v) }), /* @__PURE__ */ React.createElement(Field, { label: "Summary", value: essay.summary, multiline: true, rows: 2, onChange: (v) => updateField(`essays.${i}.summary`, v) }), /* @__PURE__ */ React.createElement("div", { style: { display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 } }, /* @__PURE__ */ React.createElement(Field, { label: "Image (path or URL)", value: essay.img, onChange: (v) => updateField(`essays.${i}.img`, v) }), /* @__PURE__ */ React.createElement(Field, { label: "Link", value: essay.url, placeholder: "https://\u2026", onChange: (v) => updateField(`essays.${i}.url`, v) })));
          });
        })()), /* @__PURE__ */ React.createElement(Group, { title: `Podcasts (${content.podcasts?.length || 0})` }, /* @__PURE__ */ React.createElement(Field, { label: "Section heading", value: content.podcastsHeading, placeholder: "This Week's Podcasts", onChange: (v) => updateField("podcastsHeading", v) }), (content.podcasts || []).map((pod, i) => /* @__PURE__ */ React.createElement("div", { key: i, style: {
          marginBottom: 18,
          padding: 12,
          background: "#fff",
          border: "1px solid #e8d9bd"
        } }, /* @__PURE__ */ React.createElement("div", { style: {
          fontFamily: '"Source Sans 3", sans-serif',
          fontSize: 10,
          fontWeight: 700,
          letterSpacing: "0.18em",
          textTransform: "uppercase",
          color: "#c1593c",
          marginBottom: 8
        } }, "Podcast ", i + 1), /* @__PURE__ */ React.createElement("div", { style: { display: "grid", gridTemplateColumns: "2fr 1fr", gap: 12 } }, /* @__PURE__ */ React.createElement(Field, { label: "Show name", value: pod.label, onChange: (v) => updateField(`podcasts.${i}.label`, v) }), /* @__PURE__ */ React.createElement(Field, { label: "Episode", value: pod.episode, onChange: (v) => updateField(`podcasts.${i}.episode`, v) })), /* @__PURE__ */ React.createElement(Field, { label: "Title", value: pod.title, onChange: (v) => updateField(`podcasts.${i}.title`, v) }), /* @__PURE__ */ React.createElement(Field, { label: "Summary", value: pod.summary, multiline: true, rows: 2, onChange: (v) => updateField(`podcasts.${i}.summary`, v) }), /* @__PURE__ */ React.createElement("div", { style: { display: "grid", gridTemplateColumns: "2fr 1fr", gap: 12 } }, /* @__PURE__ */ React.createElement(Field, { label: "Image", value: pod.img, onChange: (v) => updateField(`podcasts.${i}.img`, v) }), /* @__PURE__ */ React.createElement(Field, { label: "CTA text", value: pod.cta, onChange: (v) => updateField(`podcasts.${i}.cta`, v) })), /* @__PURE__ */ React.createElement(Field, { label: "Link", value: pod.url, placeholder: "https://\u2026", onChange: (v) => updateField(`podcasts.${i}.url`, v) }))))),
        /* @__PURE__ */ React.createElement("div", { "data-mo-modal-footer": true, style: {
          padding: "14px 24px",
          borderTop: "1px solid #e8d9bd",
          background: "#f1e0c9",
          display: "flex",
          alignItems: "center",
          gap: 12
        } }, /* @__PURE__ */ React.createElement("div", { style: {
          fontFamily: '"Source Sans 3", sans-serif',
          fontSize: 11,
          color: "#6b6258",
          flex: 1
        } }, "Changes are saved automatically and will be there next time you open the app."), /* @__PURE__ */ React.createElement("button", { onClick: onClose, style: btnStyle("primary") }, "Done"))
      )
    );
  }
  Object.assign(window, { ContentEditor });
})();
