// Unit tests for genre classification (lib/genre.js).
const test = require("node:test");
const assert = require("node:assert/strict");
const Genre = require("../lib/genre.js");

test("Google-style categories map to the specific genre", () => {
  assert.deepEqual(Genre.classify(["Fiction / Science Fiction / General"]), ["Science Fiction"]);
  assert.deepEqual(Genre.classify(["Fiction / Fantasy / Epic"]), ["Fantasy"]);
});

test("generic Fiction is dropped when a specific kind is known", () => {
  const g = Genre.classify(["Fiction", "Fiction, fantasy, general", "Magic", "Dragons"]);
  assert.equal(g[0], "Fantasy");
  assert.ok(!g.includes("Fiction"));
});

test("science fiction does not count as Science, nonfiction does not count as Fiction", () => {
  assert.ok(!Genre.classify(["Science fiction"]).includes("Science"));
  assert.deepEqual(Genre.classify(["Nonfiction"]), ["Nonfiction"]);
  assert.deepEqual(Genre.classify(["Biography & Autobiography / Personal Memoirs", "Nonfiction"]), ["Biography & Memoir"]);
});

test("weights decide between candidates", () => {
  const g = Genre.classify([{ text: "Fiction / Mystery & Detective / General", weight: 3 }, { text: "Romance", weight: 1 }]);
  assert.equal(g[0], "Mystery");
});

test("plain novels fall back to Fiction; nothing known gives an empty list", () => {
  assert.deepEqual(Genre.classify(["Novels"]), ["Fiction"]);
  assert.deepEqual(Genre.classify(["Accessible book", "Protected DAISY"]), []);
});
