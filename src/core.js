// U1 Domain core: pure functions over Book records. No DOM, runs in Node for tests.
const Core = (() => {
  const MAX_TITLE = 200;
  const MAX_GENRE = 40;
  const cleanGenre = (g) => String(g || "").trim().replace(/\s+/g, " ").slice(0, MAX_GENRE);

  const nowIso = () => new Date().toISOString();
  const today = () => nowIso().slice(0, 10);
  const newId = (prefix) =>
    prefix + "_" + Date.now().toString(36) + Math.random().toString(36).slice(2, 7);

  function toPageNumber(v) {
    if (v === null || v === undefined || v === "") return null;
    const n = Math.floor(Number(v));
    return Number.isFinite(n) && n > 0 ? n : null;
  }

  function clampPage(page, pages) {
    let n = Math.floor(Number(page) || 0);
    if (n < 0) n = 0;
    if (pages && n > pages) n = pages;
    return n;
  }

  function clampRating(r) {
    const n = Math.round(Number(r) || 0);
    return Math.min(5, Math.max(0, n));
  }

  function validateBookInput(input) {
    const errors = {};
    const title = String(input.title || "").trim();
    if (!title) errors.title = "Add a title to save this book.";
    else if (title.length > MAX_TITLE) errors.title = "Keep the title under 200 characters.";
    if (input.pages !== undefined && input.pages !== "" && input.pages !== null && toPageNumber(input.pages) === null)
      errors.pages = "Pages should be a whole number above 0.";
    return errors;
  }

  function createBook(input, opts = {}) {
    const errors = validateBookInput(input);
    if (Object.keys(errors).length) {
      const e = new Error(Object.values(errors)[0]);
      e.fields = errors;
      throw e;
    }
    const pages = toPageNumber(input.pages);
    const stamp = opts.now || nowIso();
    return {
      id: opts.id || newId("b"),
      title: String(input.title).trim(),
      author: String(input.author || "").trim(),
      genre: cleanGenre(input.genre),
      status: "reading",
      pages,
      currentPage: clampPage(input.currentPage || 0, pages),
      cover: input.cover || null,
      coverSource: input.cover ? input.coverSource || "upload" : null,
      startedAt: input.startedAt || stamp.slice(0, 10),
      finishedAt: null,
      rating: 0,
      review: "",
      quotes: [],
      createdAt: stamp,
      updatedAt: stamp,
    };
  }

  // Fill gaps in a record read from storage so older or partial docs still render.
  function normalize(raw) {
    if (!raw || typeof raw !== "object" || !raw.id || !raw.title) return null;
    const pages = toPageNumber(raw.pages);
    const finished = raw.status === "finished";
    return {
      id: String(raw.id),
      title: String(raw.title),
      author: String(raw.author || ""),
      genre: cleanGenre(raw.genre),
      status: finished ? "finished" : "reading",
      pages,
      currentPage: clampPage(raw.currentPage, pages),
      cover: typeof raw.cover === "string" ? raw.cover : null,
      coverSource: raw.coverSource || null,
      startedAt: raw.startedAt || (raw.createdAt || nowIso()).slice(0, 10),
      finishedAt: finished ? raw.finishedAt || (raw.updatedAt || nowIso()).slice(0, 10) : null,
      rating: clampRating(raw.rating),
      review: String(raw.review || ""),
      quotes: Array.isArray(raw.quotes)
        ? raw.quotes.filter((q) => q && q.text).map((q) => ({
            id: String(q.id || newId("q")),
            text: String(q.text),
            page: toPageNumber(q.page),
            addedAt: q.addedAt || nowIso(),
          }))
        : [],
      createdAt: raw.createdAt || nowIso(),
      updatedAt: raw.updatedAt || raw.createdAt || nowIso(),
      example: raw.example === true || undefined,
    };
  }

  const touch = (book, changes) => ({ ...book, ...changes, updatedAt: nowIso() });

  function updateDetails(book, input) {
    const errors = validateBookInput({ title: input.title ?? book.title, pages: input.pages });
    if (Object.keys(errors).length) {
      const e = new Error(Object.values(errors)[0]);
      e.fields = errors;
      throw e;
    }
    const pages = input.pages === undefined ? book.pages : toPageNumber(input.pages);
    return touch(book, {
      title: String(input.title ?? book.title).trim(),
      author: String(input.author ?? book.author).trim(),
      genre: input.genre === undefined ? book.genre : cleanGenre(input.genre),
      pages,
      currentPage: clampPage(book.currentPage, pages),
    });
  }

  function setProgress(book, page) {
    return touch(book, { currentPage: clampPage(page, book.pages) });
  }

  function progressRatio(book) {
    if (!book.pages) return null;
    return Math.min(1, book.currentPage / book.pages);
  }

  function finishBook(book, { rating, review, date } = {}) {
    return touch(book, {
      status: "finished",
      finishedAt: date || today(),
      currentPage: book.pages ? book.pages : book.currentPage,
      rating: rating === undefined ? book.rating : clampRating(rating),
      review: review === undefined ? book.review : String(review).trim(),
    });
  }

  function reopenBook(book) {
    return touch(book, { status: "reading", finishedAt: null });
  }

  function setReview(book, { rating, review }) {
    return touch(book, {
      rating: rating === undefined ? book.rating : clampRating(rating),
      review: review === undefined ? book.review : String(review).trim(),
    });
  }

  function addQuote(book, { text, page }) {
    const clean = String(text || "").trim();
    if (!clean) throw new Error("Write the quote before adding it.");
    const quote = { id: newId("q"), text: clean, page: toPageNumber(page), addedAt: nowIso() };
    return touch(book, { quotes: [...book.quotes, quote] });
  }

  function removeQuote(book, quoteId) {
    return touch(book, { quotes: book.quotes.filter((q) => q.id !== quoteId) });
  }

  function tableBooks(books) {
    return books
      .filter((b) => b.status === "reading")
      .sort((a, b) => (b.startedAt + b.createdAt).localeCompare(a.startedAt + a.createdAt));
  }

  function shelfBooks(books) {
    return books
      .filter((b) => b.status === "finished")
      .sort((a, b) => (a.finishedAt + a.updatedAt).localeCompare(b.finishedAt + b.updatedAt));
  }

  // Genres on the shelf, most common first, for the shelf filter.
  function shelfGenres(books) {
    const counts = new Map();
    for (const b of shelfBooks(books)) if (b.genre) counts.set(b.genre, (counts.get(b.genre) || 0) + 1);
    return [...counts.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0])).map(([genre, count]) => ({ genre, count }));
  }

  // Stable colours for designed covers, picked from the title so a book keeps its look.
  const COVER_PALETTES = [
    ["#1f4e5f", "#e9c46a"], ["#6b2d3c", "#f2d0a9"], ["#2f4b2f", "#d8e2a7"],
    ["#3b3561", "#f4b860"], ["#7a3e1d", "#f6e7cb"], ["#163a5f", "#9ad1d4"],
    ["#4a4a48", "#f0c987"], ["#5c3b5e", "#c9e4ca"], ["#8a2f1d", "#ffd6a0"],
    ["#24504a", "#f7a072"],
  ];
  function hash(str) {
    let h = 2166136261;
    for (let i = 0; i < str.length; i++) h = Math.imul(h ^ str.charCodeAt(i), 16777619);
    return h >>> 0;
  }
  function coverPalette(title) {
    const [bg, ink] = COVER_PALETTES[hash(String(title).toLowerCase()) % COVER_PALETTES.length];
    return { bg, ink };
  }

  return {
    createBook, normalize, validateBookInput, updateDetails, setProgress, progressRatio,
    finishBook, reopenBook, setReview, addQuote, removeQuote, tableBooks, shelfBooks, shelfGenres,
    coverPalette, toPageNumber, clampRating,
  };
})();

if (typeof module !== "undefined" && module.exports) module.exports = Core;
