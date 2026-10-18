// U6 Unit tests for the domain core (node --test tests/).
const test = require("node:test");
const assert = require("node:assert/strict");
const Core = require("../src/core.js");

const base = () => Core.createBook({ title: "  Middlemarch ", author: "George Eliot", pages: "880" }, { now: "2026-10-01T10:00:00.000Z" });

test("US-1 createBook trims, defaults to reading, starts on page 0", () => {
  const b = base();
  assert.equal(b.title, "Middlemarch");
  assert.equal(b.status, "reading");
  assert.equal(b.pages, 880);
  assert.equal(b.currentPage, 0);
  assert.equal(b.startedAt, "2026-10-01");
  assert.deepEqual(b.quotes, []);
});

test("US-1 blank title and bad pages are rejected with readable messages", () => {
  assert.throws(() => Core.createBook({ title: "   " }), /Add a title/);
  assert.deepEqual(Core.validateBookInput({ title: "x", pages: "-3" }), { pages: "Pages should be a whole number above 0." });
  assert.deepEqual(Core.validateBookInput({ title: "x", pages: "" }), {});
});

test("US-4 progress is clamped to 0..pages", () => {
  const b = base();
  assert.equal(Core.setProgress(b, 312).currentPage, 312);
  assert.equal(Core.setProgress(b, 5000).currentPage, 880);
  assert.equal(Core.setProgress(b, -4).currentPage, 0);
  assert.equal(Core.progressRatio(Core.setProgress(b, 440)), 0.5);
  assert.equal(Core.progressRatio(Core.createBook({ title: "No pages" })), null);
});

test("US-5 finishing moves the book from table to shelf with rating and review", () => {
  const b = Core.finishBook(Core.setProgress(base(), 700), { rating: 4.6, review: " Loved it ", date: "2026-10-17" });
  assert.equal(b.status, "finished");
  assert.equal(b.finishedAt, "2026-10-17");
  assert.equal(b.currentPage, 880);
  assert.equal(b.rating, 5);
  assert.equal(b.review, "Loved it");
  assert.equal(Core.tableBooks([b]).length, 0);
  assert.equal(Core.shelfBooks([b]).length, 1);
});

test("US-5 shelf order puts the newest finished book last; table shows newest started first", () => {
  const a = Core.finishBook(Core.createBook({ title: "A" }), { date: "2026-05-01" });
  const c = Core.finishBook(Core.createBook({ title: "C" }), { date: "2026-09-01" });
  const bb = Core.finishBook(Core.createBook({ title: "B" }), { date: "2026-07-01" });
  assert.deepEqual(Core.shelfBooks([c, a, bb]).map((x) => x.title), ["A", "B", "C"]);
  const r1 = Core.createBook({ title: "R1", startedAt: "2026-01-01" });
  const r2 = Core.createBook({ title: "R2", startedAt: "2026-02-01" });
  assert.deepEqual(Core.tableBooks([r1, r2, a]).map((x) => x.title), ["R2", "R1"]);
});

test("US-6 quotes are added in order, need text, and can be removed", () => {
  let b = Core.addQuote(base(), { text: "First", page: "12" });
  b = Core.addQuote(b, { text: "Second" });
  assert.deepEqual(b.quotes.map((q) => [q.text, q.page]), [["First", 12], ["Second", null]]);
  assert.throws(() => Core.addQuote(b, { text: "  " }), /Write the quote/);
  b = Core.removeQuote(b, b.quotes[0].id);
  assert.deepEqual(b.quotes.map((q) => q.text), ["Second"]);
});

test("US-7 review and rating can be edited after finishing; rating clamps to 0..5", () => {
  let b = Core.finishBook(base(), { rating: 3, review: "ok" });
  b = Core.setReview(b, { rating: 9, review: "Better on reflection." });
  assert.equal(b.rating, 5);
  assert.equal(b.review, "Better on reflection.");
  assert.equal(Core.setReview(b, { rating: -1 }).rating, 0);
});

test("US-8 putting a book back on the table keeps its review and quotes", () => {
  let b = Core.addQuote(Core.finishBook(base(), { rating: 4, review: "Good" }), { text: "Q" });
  b = Core.reopenBook(b);
  assert.equal(b.status, "reading");
  assert.equal(b.finishedAt, null);
  assert.equal(b.review, "Good");
  assert.equal(b.quotes.length, 1);
});

test("updateDetails re-clamps progress when pages shrink", () => {
  const b = Core.updateDetails(Core.setProgress(base(), 800), { title: "Middlemarch", pages: "500" });
  assert.equal(b.pages, 500);
  assert.equal(b.currentPage, 500);
});

test("US-9 normalize repairs partial stored records and drops junk", () => {
  assert.equal(Core.normalize(null), null);
  assert.equal(Core.normalize({ id: "x" }), null);
  const n = Core.normalize({ id: "x", title: "T", status: "finished", rating: "7", quotes: [{ text: "" }, { text: "keep" }] });
  assert.equal(n.status, "finished");
  assert.ok(n.finishedAt);
  assert.equal(n.rating, 5);
  assert.equal(n.quotes.length, 1);
});

test("designed cover colours are stable per title", () => {
  assert.deepEqual(Core.coverPalette("Dune"), Core.coverPalette("dune"));
  assert.match(Core.coverPalette("Dune").bg, /^#[0-9a-f]{6}$/);
});

test("shelfGenres counts finished books per genre, most common first", () => {
  const f = (title, genre) => Core.finishBook(Core.createBook({ title, genre }));
  const list = [f("A", "Fantasy"), f("B", "Poetry"), f("C", "Fantasy"), f("D", ""), Core.createBook({ title: "E", genre: "Horror" })];
  assert.deepEqual(Core.shelfGenres(list), [{ genre: "Fantasy", count: 2 }, { genre: "Poetry", count: 1 }]);
  assert.equal(Core.createBook({ title: "x", genre: "  Science   Fiction " }).genre, "Science Fiction");
});
