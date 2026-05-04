#!/usr/bin/env node
/*
 * scripts/build-ebook-pdfs.mjs
 *
 * Extracts the article body from each of the three ebook read-page
 * Handlebars templates (page-ebook-<slug>-read.hbs), wraps it in a
 * standalone print-ready HTML document, then renders to PDF via
 * headless Chrome and to EPUB via pandoc. Outputs land in
 * assets/files/ebooks/ so they ship with theme deploys and can be
 * served as /assets/files/ebooks/<slug>.pdf and .epub.
 *
 * Run from the theme root:
 *   node scripts/build-ebook-pdfs.mjs
 *
 * Re-run any time the content of a read-page template changes.
 *
 * Dependencies (already on Ian's machine, no npm install needed):
 *   - Google Chrome at /Applications/Google Chrome.app
 *   - pandoc on PATH (homebrew install pandoc)
 *
 * The article body in each .hbs is pure HTML (no Handlebars
 * expressions inside <article>...</article>), so naive regex
 * extraction is safe. If that ever changes — or if a build script
 * starts injecting {{ }} into the article body — switch to a
 * Handlebars compile step here first.
 */

import { readFileSync, writeFileSync, mkdirSync, existsSync, rmSync } from "node:fs";
import { execSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const THEME_ROOT = resolve(__dirname, "..");
const BUILD_DIR = resolve(THEME_ROOT, "scripts/.ebook-build");
const OUT_DIR = resolve(THEME_ROOT, "assets/files/ebooks");
const CHROME =
  "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";

const BOOKS = [
  {
    slug: "navigating-the-fracture",
    src: "page-ebook-navigating-the-fracture-read.hbs",
    title: "Navigating the Fracture",
    subtitle: "A Pastor's Guide to Leading Through Cultural Division",
  },
  {
    slug: "blueprint-for-renewal",
    src: "page-ebook-blueprint-for-renewal-read.hbs",
    title: "Blueprint for Renewal",
    subtitle: "Protestant Catholicity and Solidarity Conservatism",
  },
  {
    slug: "spiritual-formation-for-the-family",
    src: "page-ebook-spiritual-formation-for-the-family-read.hbs",
    title: "Spiritual Formation for the Family",
    subtitle: "",
  },
];

function extractArticle(hbsPath) {
  const src = readFileSync(hbsPath, "utf8");
  const m = src.match(/<article>([\s\S]*?)<\/article>/);
  if (!m) throw new Error(`No <article> block found in ${hbsPath}`);
  return m[1].trim();
}

function buildHtml({ title, subtitle, body }) {
  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8" />
<title>${title}</title>
<link rel="preconnect" href="https://fonts.googleapis.com" />
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
<link href="https://fonts.googleapis.com/css2?family=IM+Fell+Great+Primer:ital@0;1&family=Source+Serif+Pro:ital,wght@0,400;0,600;0,700;1,400;1,600&display=swap" rel="stylesheet" />
<style>
  :root {
    --color-page: #f6f3f2;
    --color-primary: #ee7d51;
    --color-secondary: #c1593c;
    --color-dark: #2d2927;
    --color-rule: #e9dec8;
    --color-muted: #6b6359;
    --font-display: "IM Fell Great Primer", Georgia, serif;
    --font-body: "Source Serif Pro", Georgia, serif;
  }

  @page {
    size: 6in 9in;
    margin: 0.7in 0.6in 0.75in 0.6in;
    background: var(--color-page);
  }
  @page :first {
    margin: 0;
  }

  html, body {
    background: var(--color-page);
    color: var(--color-dark);
    font-family: var(--font-body);
    font-size: 11.5pt;
    line-height: 1.55;
    -webkit-print-color-adjust: exact;
    print-color-adjust: exact;
  }
  body { margin: 0; padding: 0; }

  /* Cover page — fills the first page edge-to-edge. */
  .cover {
    page-break-after: always;
    height: 9in;
    margin: 0;
    padding: 1in 0.8in;
    box-sizing: border-box;
    background: var(--color-dark);
    color: #f4ebd8;
    display: flex;
    flex-direction: column;
    justify-content: center;
    align-items: flex-start;
    position: relative;
  }
  .cover-eyebrow {
    font-family: var(--font-body);
    font-size: 9pt;
    letter-spacing: 0.32em;
    text-transform: uppercase;
    color: var(--color-primary);
    font-weight: 700;
    margin: 0 0 0.4in;
  }
  .cover-title {
    font-family: var(--font-display);
    font-style: italic;
    font-size: 42pt;
    line-height: 1.05;
    color: #f4ebd8;
    margin: 0 0 0.18in;
    font-weight: 400;
  }
  .cover-subtitle {
    font-family: var(--font-display);
    font-style: italic;
    font-size: 16pt;
    line-height: 1.3;
    color: rgba(244, 235, 216, 0.78);
    margin: 0;
    max-width: 4in;
  }
  .cover-rule {
    width: 1.4in;
    height: 1px;
    background: var(--color-primary);
    margin: 0.5in 0 0.4in;
  }
  .cover-mark {
    position: absolute;
    bottom: 0.7in;
    left: 0.8in;
    font-family: var(--font-display);
    font-style: italic;
    font-size: 13pt;
    color: rgba(244, 235, 216, 0.62);
    letter-spacing: 0.02em;
  }
  .cover-mark::before {
    content: "¶  ";
    color: var(--color-primary);
  }

  /* Body content. */
  article {
    padding: 0;
    max-width: 100%;
  }

  .content-section {
    page-break-before: always;
    padding-top: 0.4in;
  }
  .content-section:first-of-type { page-break-before: auto; }

  h1, h2, h3, h4 {
    font-family: var(--font-display);
    font-weight: 400;
    color: var(--color-dark);
    page-break-after: avoid;
  }
  .section-title {
    font-style: italic;
    font-size: 26pt;
    line-height: 1.15;
    margin: 0 0 0.18in;
  }
  .section-heading {
    font-style: italic;
    font-size: 16pt;
    line-height: 1.25;
    margin: 0.36in 0 0.12in;
    color: var(--color-secondary);
  }
  .subsection-heading {
    font-style: italic;
    font-size: 13.5pt;
    margin: 0.28in 0 0.08in;
    color: var(--color-dark);
  }

  .essay-author {
    font-family: var(--font-body);
    font-size: 10.5pt;
    color: var(--color-muted);
    margin: 0 0 0.3in;
    font-style: italic;
  }
  .essay-author a { color: var(--color-secondary); text-decoration: none; }

  p {
    margin: 0 0 0.16in;
    text-align: justify;
    hyphens: auto;
    orphans: 3;
    widows: 3;
  }

  /* Drop cap on the first paragraph after each section title. */
  .section-title + .essay-author + p::first-letter,
  .section-title + p::first-letter {
    font-family: var(--font-display);
    font-style: italic;
    font-size: 3.4em;
    line-height: 0.85;
    float: left;
    color: var(--color-secondary);
    padding: 0.05em 0.08em 0 0;
  }

  blockquote {
    margin: 0.18in 0.3in;
    padding: 0 0 0 0.18in;
    border-left: 2px solid var(--color-primary);
    color: var(--color-muted);
    font-style: italic;
  }
  blockquote p { margin: 0 0 0.12in; }
  blockquote p:last-child { margin-bottom: 0; }

  ol, ul {
    margin: 0.12in 0 0.18in 0;
    padding-left: 0.3in;
  }
  li { margin: 0 0 0.08in; }
  li strong { color: var(--color-dark); }

  a { color: var(--color-secondary); text-decoration: none; }

  hr {
    border: 0;
    height: 1px;
    background: var(--color-rule);
    margin: 0.36in auto;
    width: 1.4in;
  }

  /* Page break helpers — keep section openings tidy. */
  h2.section-title, h3.section-heading, h4.subsection-heading {
    break-after: avoid-page;
  }
  blockquote, ol, ul { break-inside: avoid-page; }

  /* Strip in-document UI artifacts that might have leaked into
     the article block (audio players, tooltips, etc.). */
  .audio-player, .download-popup, .icon-btn-row, [data-audio-trigger] {
    display: none !important;
  }
</style>
</head>
<body>

<section class="cover">
  <p class="cover-eyebrow">A Mere Orthodoxy Ebook</p>
  <h1 class="cover-title">${title.replace(/<br\s*\/?>/g, " ")}</h1>
  <div class="cover-rule"></div>
  ${subtitle ? `<p class="cover-subtitle">${subtitle}</p>` : ""}
  <p class="cover-mark">Mere Orthodoxy</p>
</section>

<article>
${body}
</article>

</body>
</html>`;
}

function ensureDir(d) {
  if (!existsSync(d)) mkdirSync(d, { recursive: true });
}

function renderPdf(htmlPath, pdfPath) {
  const cmd = [
    `"${CHROME}"`,
    "--headless=new",
    "--disable-gpu",
    "--no-sandbox",
    "--virtual-time-budget=10000",
    `--print-to-pdf="${pdfPath}"`,
    "--no-pdf-header-footer",
    `"file://${htmlPath}"`,
  ].join(" ");
  execSync(cmd, { stdio: "inherit" });
}

function renderEpub(htmlPath, epubPath, { title, subtitle }) {
  const author = "Mere Orthodoxy";
  const meta = [
    `--metadata=title:"${title.replace(/<br\s*\/?>/g, " ")}"`,
    subtitle ? `--metadata=subtitle:"${subtitle}"` : "",
    `--metadata=author:"${author}"`,
    `--metadata=publisher:"Mere Orthodoxy"`,
    `--metadata=lang:"en-US"`,
  ]
    .filter(Boolean)
    .join(" ");
  const cmd = `pandoc "${htmlPath}" -o "${epubPath}" -f html -t epub3 ${meta}`;
  execSync(cmd, { stdio: "inherit" });
}

function main() {
  ensureDir(BUILD_DIR);
  ensureDir(OUT_DIR);

  for (const book of BOOKS) {
    const srcPath = resolve(THEME_ROOT, book.src);
    if (!existsSync(srcPath)) {
      console.error(`SKIP ${book.slug}: ${book.src} not found`);
      continue;
    }
    console.log(`\n[${book.slug}]`);
    const body = extractArticle(srcPath);
    const html = buildHtml({ title: book.title, subtitle: book.subtitle, body });
    const htmlPath = resolve(BUILD_DIR, `${book.slug}.html`);
    writeFileSync(htmlPath, html, "utf8");
    console.log(`  wrote ${htmlPath} (${(html.length / 1024).toFixed(1)} KB)`);

    const pdfPath = resolve(OUT_DIR, `${book.slug}.pdf`);
    console.log(`  rendering PDF → ${pdfPath}`);
    renderPdf(htmlPath, pdfPath);

    const epubPath = resolve(OUT_DIR, `${book.slug}.epub`);
    console.log(`  rendering EPUB → ${epubPath}`);
    renderEpub(htmlPath, epubPath, book);
  }

  console.log("\nDone.");
}

main();
