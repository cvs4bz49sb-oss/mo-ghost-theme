#!/usr/bin/env node
/**
 * scrape-bookshop.mjs
 * Fetches MO's Bookshop.org lists and outputs a JSON data file
 * for the /bookstore/ page.
 *
 * Usage: node scripts/scrape-bookshop.mjs
 * Output: data/bookstore.json
 */

import { writeFileSync, mkdirSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const OUT = join(__dirname, "..", "data", "bookstore.json");

const SHOP_URL = "https://bookshop.org/shop/mereorthodoxy";
const AFFILIATE_REF = "mereorthodoxy.com";

const CATEGORIES = [
  { slug: "mere-orthodoxy-contributors", label: "Mere Orthodoxy Contributors" },
  { slug: "introduction-to-mere-orthodoxy", label: "Introduction to Mere Orthodoxy" },
  { slug: "passages-nicaea", label: "Passages: Nicaea" },
  { slug: "featured-on-mere-o", label: "Featured on Mere O" },
  { slug: "children-s-literature-b6fa35d3-ccf8-4e89-879e-3a23c3a8c4b4", label: "Children's Literature" },
  { slug: "magisterial-protestantism", label: "Magisterial Protestantism" },
  { slug: "modern-politics-and-liberalism", label: "Modern Politics and Liberalism" },
  { slug: "political-economy-f5d2fe0c-f94e-4da8-8a11-5a12b6e0a2b7", label: "Political Economy" },
  { slug: "race-1738e9eb-b85e-4e47-92f4-a3e54e36f2ef", label: "Race" },
  { slug: "sexuality-be6f7413-c81f-4f69-982d-7b71a84bad4a", label: "Sexuality" },
];

/** Simple HTML text extraction */
function textOf(html) {
  return html.replace(/<[^>]+>/g, " ").replace(/&amp;/g, "&").replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/&#x27;/g, "'")
    .replace(/&nbsp;/g, " ").replace(/\s+/g, " ").trim();
}

async function fetchList(slug) {
  const url = `https://bookshop.org/lists/${slug}`;
  console.log(`  Fetching ${url} ...`);
  const res = await fetch(url, {
    headers: {
      "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36",
      "Accept": "text/html",
    },
  });
  if (!res.ok) {
    console.error(`    ❌ ${res.status} for ${slug}`);
    return [];
  }
  const html = await res.text();
  return parseBooks(html);
}

function parseBooks(html) {
  const books = [];
  // Match book cover image alt text to get titles
  // Pattern: <img alt="bookcover for TITLE" ... />
  const imgRegex = /alt="bookcover for ([^"]+)"/g;
  const titles = [];
  let m;
  while ((m = imgRegex.exec(html)) !== null) {
    titles.push(m[1]);
  }

  // Match book links: /p/books/SLUG
  const linkRegex = /href="(\/p\/books\/[^"]+)"/g;
  const slugs = [];
  const seenSlugs = new Set();
  while ((m = linkRegex.exec(html)) !== null) {
    const s = m[1];
    if (!seenSlugs.has(s)) {
      seenSlugs.add(s);
      slugs.push(s);
    }
  }

  // Match author names - they appear in specific patterns
  // Look for the book card structure in the HTML
  // Each book block contains title, author, format, prices

  // Let's use a more robust regex to find book data blocks
  // Pattern: book cover link -> title -> author -> format -> price
  const bookBlockRegex = /bookcover for ([^"]+)"[\s\S]*?href="(\/p\/books\/[^"]+)"[\s\S]*?<\/a>\s*<[^>]*>([^<]*)<\/[^>]*>\s*(?:<[^>]*>([^<]*)<\/[^>]*>)?\s*(?:<[^>]*>\s*(?:<[^>]*>)?\$?([\d.]+))?/g;

  // Simpler approach: pair up titles with their slugs
  // Since both appear in order, zip them
  for (let i = 0; i < Math.min(titles.length, slugs.length); i++) {
    const title = titles[i];
    const slug = slugs[i];

    // Try to extract author from context around the slug
    const slugIdx = html.indexOf(slug);
    // Look for author text after the title in nearby HTML
    const nearbyHtml = html.substring(slugIdx, slugIdx + 500);

    // Author usually appears after the title link in a separate element
    // Pattern varies but often: </a> ... author name ... Paperback|Hardcover
    const authorMatch = nearbyHtml.match(/>([A-Z][a-zA-Z\s,.'-]+?)(?:\s*<\/|(?:Paperback|Hardcover|Audio))/);
    let author = "";
    if (authorMatch) {
      author = textOf(authorMatch[1]).replace(/\s+/g, " ").trim();
      // Clean up common artifacts
      if (author.length > 80) author = "";
      if (author.match(/^\d/)) author = "";
    }

    books.push({
      title,
      author,
      slug,
      url: `https://bookshop.org${slug}?aid=mereorthodoxy`,
    });
  }

  return books;
}

async function main() {
  console.log("Scraping Mere Orthodoxy Bookshop.org lists...\n");

  const data = {
    generated: new Date().toISOString().split("T")[0],
    affiliate: AFFILIATE_REF,
    shopUrl: SHOP_URL,
    categories: [],
  };

  for (const cat of CATEGORIES) {
    const books = await fetchList(cat.slug);
    console.log(`    ✓ ${books.length} books in "${cat.label}"`);
    data.categories.push({
      id: cat.slug.replace(/-[a-f0-9]{4,}.*$/, "").replace(/-/g, "-"),
      label: cat.label,
      listUrl: `https://bookshop.org/lists/${cat.slug}`,
      books,
    });
    // Be polite
    await new Promise((r) => setTimeout(r, 500));
  }

  const total = data.categories.reduce((s, c) => s + c.books.length, 0);
  console.log(`\nTotal: ${total} books across ${data.categories.length} categories`);

  mkdirSync(dirname(OUT), { recursive: true });
  writeFileSync(OUT, JSON.stringify(data, null, 2));
  console.log(`Written to ${OUT}`);
}

main().catch(console.error);
