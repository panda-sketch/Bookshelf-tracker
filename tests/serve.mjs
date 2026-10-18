// Local stand-in for Vercel: serves public/ and routes /api/lookup to the real function.
// MOCK_UPSTREAM=1 swaps Open Library / Google Books for canned answers (used by the e2e test).
import http from "node:http";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
const require = createRequire(import.meta.url);
if (process.env.MOCK_UPSTREAM) globalThis.fetch = require("./fixtures.cjs").fakeFetch("ok");
const handler = require("../api/lookup.js");
const port = Number(process.env.PORT || 3000);

http.createServer(async (req, res) => {
  const url = new URL(req.url, "http://localhost");
  if (url.pathname === "/api/lookup") {
    const vres = {
      status(c) { res.statusCode = c; return vres; },
      json(b) { res.setHeader("Content-Type", "application/json"); res.end(JSON.stringify(b)); return vres; },
      setHeader: (k, v) => res.setHeader(k, v),
    };
    return handler({ method: req.method, query: Object.fromEntries(url.searchParams) }, vres);
  }
  if (url.pathname === "/" || url.pathname === "/index.html") {
    res.setHeader("Content-Type", "text/html; charset=utf-8");
    return res.end(readFileSync(new URL("../public/index.html", import.meta.url)));
  }
  res.statusCode = 404;
  res.end("Not found");
}).listen(port, () => console.log("Bookshelf on http://localhost:" + port));
