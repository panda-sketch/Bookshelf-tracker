// Tests for the Vercel lookup service (lib/lookup.js, api/lookup.js) with faked upstream sites.
const test = require("node:test");
const assert = require("node:assert/strict");
const { lookup } = require("../lib/lookup.js");
const { fakeFetch } = require("./fixtures.cjs");

test("merges both catalogues: exact-title match, cover as data URL, genre from categories", async () => {
  const r = await lookup({ title: "piranesi", author: "Susanna Clarke" }, { fetchImpl: fakeFetch("ok") });
  assert.equal(r.status, "found");
  assert.equal(r.title, "Piranesi");
  assert.equal(r.author, "Susanna Clarke");
  assert.equal(r.pages, 272);
  assert.equal(r.genre, "Fantasy");
  assert.match(r.cover, /^data:image\/png;base64,/);
  assert.deepEqual(r.sources, { openLibrary: true, googleBooks: true });
});

test("falls back to Google Books when Open Library is down, using https for its image", async () => {
  const f = fakeFetch("ol-down");
  const r = await lookup({ title: "Piranesi" }, { fetchImpl: f });
  assert.equal(r.status, "found");
  assert.equal(r.pages, 245);
  assert.equal(r.genre, "Fantasy");
  assert.ok(r.cover);
  assert.ok(f.calls.some((u) => u.startsWith("https://books.google.com/") && !u.includes("edge=curl")));
});

test("reports no-match, unreachable, and a missing title", async () => {
  assert.equal((await lookup({ title: "zzzz" }, { fetchImpl: fakeFetch("none") })).status, "no-match");
  assert.equal((await lookup({ title: "Piranesi" }, { fetchImpl: fakeFetch("down") })).status, "unreachable");
  assert.equal((await lookup({ title: "  " }, { fetchImpl: fakeFetch("ok") })).status, "bad-request");
});

test("passes the Google Books key when configured", async () => {
  const f = fakeFetch("ok");
  await lookup({ title: "Piranesi" }, { fetchImpl: f, apiKey: "k123" });
  assert.ok(f.calls.some((u) => u.includes("googleapis") && u.includes("key=k123")));
});

test("the HTTP handler answers 400 without a title and 405 for POST", async () => {
  const handler = require("../api/lookup.js");
  const res = () => {
    const r = { code: 0, body: null, headers: {} };
    r.status = (c) => ((r.code = c), r);
    r.json = (b) => ((r.body = b), r);
    r.setHeader = (k, v) => (r.headers[k] = v);
    return r;
  };
  const a = res();
  await handler({ method: "GET", query: {} }, a);
  assert.equal(a.code, 400);
  const b = res();
  await handler({ method: "POST", query: {} }, b);
  assert.equal(b.code, 405);
});
