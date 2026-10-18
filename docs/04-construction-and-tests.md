# 04 · Construction and test log (AI-DLC Construction)

Built 2026-10-18. Playable version: https://claude.ai/artifact/A6VfxCAyo2C9FoWSv93qpG

## What was built
| Unit | Result |
|------|--------|
| U1 Domain core (`src/core.js`) | Done. Pure functions, 11 unit tests. |
| U2 Storage (`src/store.js`) | Done. Artifact: per-viewer private `db` path. Local file: `localStorage`. |
| U3 Covers (`src/covers.js`) | Done. Open Library lookup (8 s timeout), upload resized to ≤320px JPEG, designed cover fallback. |
| U4 Room UI (`src/app.js`, `styles.css`, `index.html`) | Done. Shelf, table, add/edit dialog, detail dialog with progress, finish flow, review, quotes, remove-with-confirm, example books. |
| U5 Build (`build.mjs`) | `node build.mjs` writes `dist/bookshelf.html` (Artifact body) and `dist/bookshelf-local.html` (open from disk). |

## How to run the tests
```
node --test tests/core.test.cjs                      # unit tests
node build.mjs && NODE_PATH=$(npm root -g) node tests/e2e.mjs   # browser walk-through (needs Playwright)
```

## Results (2026-10-18)
- Unit: 11/11 pass.
- Browser walk-through (Chromium, light + dark, desktop + 390px phone): 14/14 steps pass, covering US-1 to US-10, no horizontal scroll at phone width, no script errors. Screenshots in `tests/screens/`.

## Known limits
- Inside the Claude Artifact, the browser blocks calls to other sites, so **Find cover** reports it couldn't reach Open Library; upload or the designed cover is used instead. Find cover works when `dist/bookshelf-local.html` is opened from disk with internet access (not verified from the build machine, whose network also blocks Open Library).
- The Artifact store path is private to each viewer, so Claude cannot read or seed a viewer's books. The Artifact's save path (`db`) was not exercised by the automated tests, which run the local-file version.
- Books saved in the local file version and in the Artifact are separate collections.

## Iteration 2 (2026-10-18): genre + Vercel lookup service
- Added U7 genre rules, U8 lookup service, `genre` on Book, genre field with suggestions in the add/edit form, genre on table cards and book detail, genre filter chips on the shelf.
- `vercel.json` builds with `node build.mjs` and serves `public/` plus `api/lookup.js`. `npm run dev` runs a local stand-in (`tests/serve.mjs`).
- Tests: 22/22 unit tests (core, genre rules, lookup service with faked Open Library / Google Books, HTTP handler). Browser walk-through 15/15 steps against the local file **and** against the hosted build with the lookup service (upstream sites faked, because this build machine can't reach Open Library).
- Live check on https://bookshelf-tracker-1x3f.vercel.app (2026-10-18): page loads; real lookups returned cover + genre for Piranesi (Fantasy), Dune (Science Fiction), Gone Girl (Mystery, Thriller), Educated (Biography & Memoir). Educated also got a stray "Children's" from a subject about the author's family; the Children's rule was tightened.
- Claude Artifact republished (version 2) with the genre field and filter; its lookup still can't reach the catalogues.
