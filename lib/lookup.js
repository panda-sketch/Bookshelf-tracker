// Book lookup used by the Vercel function: asks Open Library and Google Books together,
// then merges their answers into one cover, author, page count and genre list.
const Genre = require("./genre.js");

const TIMEOUT_MS = 6000;
const MAX_COVER_BYTES = 1_500_000;

const clean = (s) => String(s || "").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();

async function getJson(fetchImpl, url) {
  const ctl = new AbortController();
  const timer = setTimeout(() => ctl.abort(), TIMEOUT_MS);
  try {
    const res = await fetchImpl(url, { signal: ctl.signal, headers: { "User-Agent": "BookshelfTracker/1.0" } });
    if (!res.ok) throw new Error("HTTP " + res.status);
    return await res.json();
  } finally {
    clearTimeout(timer);
  }
}

// Prefer the result whose title matches what the reader typed; otherwise the first one.
function pickBest(items, title, titleOf) {
  const want = clean(title);
  return items.find((it) => clean(titleOf(it)) === want) ||
    items.find((it) => clean(titleOf(it)).startsWith(want)) ||
    items[0] || null;
}

async function searchOpenLibrary(fetchImpl, title, author) {
  const params = new URLSearchParams({
    title, limit: "5", fields: "title,author_name,cover_i,subject,number_of_pages_median",
  });
  if (author) params.set("author", author);
  const data = await getJson(fetchImpl, "https://openlibrary.org/search.json?" + params);
  const docs = Array.isArray(data.docs) ? data.docs : [];
  const withCover = docs.filter((d) => d.cover_i);
  return pickBest(withCover.length ? withCover : docs, title, (d) => d.title);
}

async function searchGoogleBooks(fetchImpl, title, author, apiKey) {
  let q = 'intitle:"' + title.replace(/"/g, "") + '"';
  if (author) q += ' inauthor:"' + author.replace(/"/g, "") + '"';
  const params = new URLSearchParams({ q, maxResults: "5", printType: "books" });
  if (apiKey) params.set("key", apiKey);
  const data = await getJson(fetchImpl, "https://www.googleapis.com/books/v1/volumes?" + params);
  const items = (Array.isArray(data.items) ? data.items : []).map((i) => i.volumeInfo || {});
  return pickBest(items, title, (v) => v.title);
}

async function fetchCoverAsDataUrl(fetchImpl, url) {
  const ctl = new AbortController();
  const timer = setTimeout(() => ctl.abort(), TIMEOUT_MS);
  try {
    const res = await fetchImpl(url, { signal: ctl.signal });
    if (!res.ok) return null;
    const type = res.headers.get("content-type") || "image/jpeg";
    if (!type.startsWith("image/")) return null;
    const buf = Buffer.from(await res.arrayBuffer());
    if (buf.length < 200 || buf.length > MAX_COVER_BYTES) return null; // tiny = placeholder image
    return "data:" + type.split(";")[0] + ";base64," + buf.toString("base64");
  } catch (e) {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

async function lookup({ title, author }, { fetchImpl = fetch, apiKey } = {}) {
  title = String(title || "").trim().slice(0, 200);
  author = String(author || "").trim().slice(0, 120);
  if (!title) return { status: "bad-request", message: "Add a title to look up." };

  const [ol, gb] = await Promise.allSettled([
    searchOpenLibrary(fetchImpl, title, author),
    searchGoogleBooks(fetchImpl, title, author, apiKey),
  ]);
  const olDoc = ol.status === "fulfilled" ? ol.value : null;
  const gbVol = gb.status === "fulfilled" ? gb.value : null;
  if (ol.status === "rejected" && gb.status === "rejected") return { status: "unreachable" };
  if (!olDoc && !gbVol) return { status: "no-match" };

  // Google's categories are curated, so they count more than Open Library's long subject lists.
  const subjects = [
    ...((gbVol && gbVol.categories) || []).map((text) => ({ text, weight: 3 })),
    ...((olDoc && olDoc.subject) || []).slice(0, 30).map((text) => ({ text, weight: 1 })),
  ];
  const genres = Genre.classify(subjects);

  const coverUrls = [];
  if (olDoc && olDoc.cover_i) coverUrls.push("https://covers.openlibrary.org/b/id/" + olDoc.cover_i + "-L.jpg?default=false");
  const gbImage = gbVol && gbVol.imageLinks && (gbVol.imageLinks.thumbnail || gbVol.imageLinks.smallThumbnail);
  if (gbImage) coverUrls.push(gbImage.replace(/^http:/, "https:").replace(/&edge=curl/, ""));
  let cover = null;
  for (const url of coverUrls) {
    cover = await fetchCoverAsDataUrl(fetchImpl, url);
    if (cover) break;
  }

  return {
    status: "found",
    title: (olDoc && olDoc.title) || (gbVol && gbVol.title) || title,
    author: (olDoc && olDoc.author_name && olDoc.author_name[0]) || (gbVol && gbVol.authors && gbVol.authors[0]) || "",
    pages: (olDoc && olDoc.number_of_pages_median) || (gbVol && gbVol.pageCount) || null,
    genre: genres[0] || "",
    genres,
    cover,
    sources: { openLibrary: !!olDoc, googleBooks: !!gbVol },
  };
}

module.exports = { lookup };
