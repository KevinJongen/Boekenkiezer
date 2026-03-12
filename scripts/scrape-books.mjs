import { mkdir, writeFile } from "node:fs/promises";

const BASE_URL = "https://www.jeugdbibliotheek.nl";
const START_URL =
  `${BASE_URL}/12-18-jaar/lezen-voor-de-lijst/12-15-jaar/alle-boeken.html`;

const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

function decodeHtml(value = "") {
  return value
    .replace(/&nbsp;/g, " ")
    .replace(/&#039;/g, "'")
    .replace(/&#034;/g, '"')
    .replace(/&quot;/g, '"')
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&#(\d+);/g, (_, code) => String.fromCharCode(Number(code)))
    .replace(/\s+/g, " ")
    .trim();
}

function stripTags(value = "") {
  return decodeHtml(value.replace(/<[^>]+>/g, " "));
}

function toAbsoluteUrl(path) {
  if (!path) return "";
  return path.startsWith("http") ? path : `${BASE_URL}${path}`;
}

async function fetchHtml(url) {
  const response = await fetch(url, {
    headers: {
      "user-agent": "Mozilla/5.0 (compatible; Codex scraper)",
    },
  });

  if (!response.ok) {
    throw new Error(`Request failed for ${url}: ${response.status}`);
  }

  return response.text();
}

function extractListItems(html) {
  const itemRegex =
    /<li[^>]*><div class="content">([\s\S]*?)<\/div><\/li>/g;
  const items = [];
  let match;

  while ((match = itemRegex.exec(html))) {
    const block = match[1];
    const urlMatch = block.match(
      /<h3>\s*<a href="([^"]+)">[\s\S]*?<span class="title">([\s\S]*?)<\/span>/,
    );

    if (!urlMatch) continue;

    const authorMatch = block.match(/<p class="additional">([\s\S]*?)<\/p>/);
    const descMatch = block.match(/<p class="maintext">([\s\S]*?)<\/p>/);
    const coverMatch = block.match(/<img src="([^"]+)"/);

    items.push({
      title: stripTags(urlMatch[2]),
      detailUrl: toAbsoluteUrl(urlMatch[1]),
      author: authorMatch ? stripTags(authorMatch[1]) : "",
      teaser: descMatch ? stripTags(descMatch[1]) : "",
      cover: coverMatch ? toAbsoluteUrl(coverMatch[1]) : "",
    });
  }

  const nextMatch = html.match(/<link rel="next" href="([^"]+)"/);

  return {
    items,
    nextUrl: nextMatch ? toAbsoluteUrl(nextMatch[1]) : null,
  };
}

function extractDdList(block, label) {
  const escaped = label.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const regex = new RegExp(
    `<dt>${escaped}<\\/dt>([\\s\\S]*?)(?=<dt>|<\\/dl>)`,
    "i",
  );
  const match = block.match(regex);
  if (!match) return [];

  return [...match[1].matchAll(/<dd>([\s\S]*?)<\/dd>/g)].map((entry) =>
    stripTags(entry[1]),
  );
}

function extractFirst(block, label) {
  return extractDdList(block, label)[0] || "";
}

function makeSlug(text) {
  return text
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

function mapReadingLength(pageCount) {
  if (!pageCount) return { id: "onbekend", label: "Onbekend" };
  if (pageCount < 180) return { id: "kort", label: "Kort" };
  if (pageCount < 320) return { id: "middel", label: "Gemiddeld" };
  return { id: "lang", label: "Lang" };
}

function mapLevelBucket(level) {
  if (!level) return { id: "onbekend", label: "Onbekend" };
  const normalized = level.toLowerCase();
  if (normalized.includes("start") || normalized.includes("1") || normalized.includes("2")) {
    return { id: "toegankelijk", label: "Toegankelijk" };
  }
  if (normalized.includes("3")) {
    return { id: "uitdagend", label: "Best uitdagend" };
  }
  return { id: "verdiepend", label: "Verdiepend" };
}

function classifyBook(book) {
  const tags = [
    book.genre,
    ...(book.genres || []),
    ...(book.subjects || []),
    book.description,
    book.teaser,
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();

  const categories = [];
  const rules = [
    {
      id: "spannend",
      label: "Spannend",
      match: [
        "thriller",
        "detective",
        "misdaad",
        "oorlog",
        "overleven",
        "vlucht",
        "gevaar",
        "mysterie",
        "spanning",
        "dystopie",
      ],
    },
    {
      id: "fantasie",
      label: "Fantasie & magie",
      match: [
        "fantasy",
        "fantasie",
        "magie",
        "sprook",
        "mythe",
        "bovennatuurlijk",
        "geest",
        "monster",
        "draak",
      ],
    },
    {
      id: "liefde",
      label: "Liefde & opgroeien",
      match: [
        "verliefd",
        "liefde",
        "puberteit",
        "opgroeien",
        "vriend",
        "vriendin",
        "familie",
        "broers en zussen",
        "relatie",
        "identiteit",
      ],
    },
    {
      id: "maatschappij",
      label: "Wereld & maatschappij",
      match: [
        "armoede",
        "maatschapp",
        "vluchteling",
        "klimaat",
        "discrimin",
        "racisme",
        "politiek",
        "maatschappelijk",
        "probleemboek",
        "actueel",
      ],
    },
    {
      id: "verleden",
      label: "Verleden & oorlog",
      match: [
        "historisch",
        "geschiedenis",
        "tweede wereldoorlog",
        "oorlog",
        "verleden",
        "slavernij",
      ],
    },
    {
      id: "grappig",
      label: "Humor & eigenzinnig",
      match: ["humor", "grappig", "komisch", "absurd", "satire"],
    },
  ];

  for (const rule of rules) {
    if (rule.match.some((needle) => tags.includes(needle))) {
      categories.push({ id: rule.id, label: rule.label });
    }
  }

  if (!categories.length) {
    categories.push({ id: "echt", label: "Echte levensverhalen" });
  }

  return categories;
}

function extractDescription(html) {
  const paragraphs = [...html.matchAll(/<p>([\s\S]*?)<\/p>/g)]
    .map((match) => stripTags(match[1]))
    .filter(Boolean);

  return paragraphs.find((entry) => entry.length > 160) || paragraphs[0] || "";
}

function extractDetailBlock(html) {
  const match = html.match(
    /<div class="metatag metadata">[\s\S]*?<dl class="meta cq-placeholder">([\s\S]*?)<\/dl>/,
  );
  return match ? match[1] : "";
}

async function scrapeDetail(seed) {
  const html = await fetchHtml(seed.detailUrl);
  const detailBlock = extractDetailBlock(html);
  const pageCount = Number.parseInt(extractFirst(html, "Aantal pagina's"), 10) || null;
  const level = extractFirst(detailBlock, "Niveau");
  const genres = extractDdList(detailBlock, "Genre");
  const subjects = extractDdList(detailBlock, "Onderwerp");
  const originalYear =
    Number.parseInt(extractFirst(detailBlock, "Jaar van oorspronkelijke uitgave"), 10) ||
    null;

  const coverMatch = html.match(/<meta property="og:image" content="([^"]+)"/);
  const description = extractDescription(html);

  const enriched = {
    ...seed,
    description: description || seed.teaser,
    cover: coverMatch ? toAbsoluteUrl(coverMatch[1]) : seed.cover,
    pageCount,
    level,
    levelBucket: mapLevelBucket(level),
    genres,
    genre: genres[0] || "",
    subjects,
    subject: subjects[0] || "",
    originalYear,
    originalLanguage: extractFirst(detailBlock, "Oorspronkelijke taal"),
  };

  enriched.lengthBucket = mapReadingLength(enriched.pageCount);
  enriched.categories = classifyBook(enriched);
  enriched.slug = makeSlug(enriched.title);

  return enriched;
}

async function mapLimit(items, limit, mapper) {
  const results = new Array(items.length);
  let index = 0;

  async function worker() {
    while (index < items.length) {
      const currentIndex = index++;
      results[currentIndex] = await mapper(items[currentIndex], currentIndex);
      await delay(100);
    }
  }

  await Promise.all(Array.from({ length: limit }, () => worker()));
  return results;
}

async function collectAllSeeds() {
  const seen = new Set();
  const seeds = [];
  let nextUrl = START_URL;

  while (nextUrl) {
    const html = await fetchHtml(nextUrl);
    const { items, nextUrl: upcoming } = extractListItems(html);

    for (const item of items) {
      if (!seen.has(item.detailUrl)) {
        seen.add(item.detailUrl);
        seeds.push(item);
      }
    }

    nextUrl = upcoming;
    await delay(120);
  }

  return seeds;
}

async function main() {
  console.log("Collecting overview pages...");
  const seeds = await collectAllSeeds();
  console.log(`Found ${seeds.length} books.`);

  console.log("Collecting detail pages...");
  const books = await mapLimit(seeds, 8, async (seed, index) => {
    const book = await scrapeDetail(seed);
    console.log(`${index + 1}/${seeds.length} ${book.title}`);
    return book;
  });

  books.sort((a, b) => a.title.localeCompare(b.title, "nl"));

  const subjects = [...new Set(books.flatMap((book) => book.subjects))].sort((a, b) =>
    a.localeCompare(b, "nl"),
  );
  const genres = [...new Set(books.flatMap((book) => book.genres))].sort((a, b) =>
    a.localeCompare(b, "nl"),
  );

  const payload = {
    generatedAt: new Date().toISOString(),
    source: START_URL,
    total: books.length,
    genres,
    subjects,
    books,
  };

  await mkdir("data", { recursive: true });
  await writeFile("data/books.json", JSON.stringify(payload, null, 2));
  await writeFile(
    "books-data.js",
    `window.BOOK_DATA = ${JSON.stringify(payload, null, 2)};\n`,
  );

  console.log("Done. Wrote data/books.json and books-data.js");
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
