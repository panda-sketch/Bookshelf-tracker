# 03 · Design: domain model and units of work (AI-DLC Construction, design step)

## Domain model
```
Book
  id            string   (b_<time36><rand>)
  title         string   required, trimmed, ≤ 200 chars
  author        string
  genre         string   ≤ 40 chars, "" when unknown
  status        "reading" | "finished"
  pages         number | null   total pages
  currentPage   number          0 … pages
  cover         string | null   data: URL (JPEG ≤ 320px wide) or null → designed cover
  coverSource   "openlibrary" | "upload" | null
  startedAt     ISO date (yyyy-mm-dd)
  finishedAt    ISO date | null
  rating        0 … 5 (0 = unrated)
  review        string
  quotes        Quote[]
  createdAt / updatedAt  ISO timestamps

Quote
  id     string (q_…)
  text   string, required
  page   number | null
  addedAt ISO timestamp
```
Invariants (enforced in `core.js`):
- `status = finished` ⇔ `finishedAt` set; finishing sets `currentPage = pages` when pages are known.
- `0 ≤ currentPage ≤ pages` when pages known; rating clamped to 0–5 integers.
- Re-shelving to the table clears `finishedAt` but keeps review, rating, quotes.

Views (derived, never stored):
- **Table** = books with `status = reading`, newest started first.
- **Shelf** = books with `status = finished`, ordered by `finishedAt` then `updatedAt`, oldest first, so a newly finished book lands at the end of the shelf.

## Storage
One document per book. In the Artifact: `db.collection("data/users/<viewer id>").doc(<book id>)`, private per viewer, live via a single `onSnapshot`. As a local file: `localStorage["bookshelf-tracker.v1"]` holding `{books: {id: Book}}`. Both sit behind one `Store` interface (`subscribe(cb)`, `put(book)`, `remove(id)`), so the UI doesn't know which it uses.

## Units of work
| Unit | File | Responsibility | Stories |
|------|------|----------------|---------|
| U1 Domain core | `src/core.js` | Pure functions: create/validate book, finish, reopen, progress, quotes, review, ordering, designed-cover palette. No DOM. Runs in Node for tests. | US-1,3,4,5,6,8 |
| U2 Storage | `src/store.js` | `db` store with per-viewer path; `localStorage` fallback. | US-9 |
| U3 Covers | `src/covers.js` | Open Library lookup with timeout, image→resized data URL, designed cover markup. | US-2 |
| U4 Room UI | `src/app.js`, `src/styles.css`, `src/index.html` | Shelf, table, add dialog, book detail dialog, finish flow, examples state. | US-1…10 |
| U7 Genre rules | `lib/genre.js` | Turns catalogue subjects/categories into reader genres (≈27 genres, specific beats generic, Google categories weighted ×3). Shared by server and page. | US-11 |
| U8 Lookup service | `lib/lookup.js`, `api/lookup.js` | Vercel function. Queries Open Library + Google Books in parallel (6 s timeout each), picks the best title match, returns cover as a data URL, author, pages, genres. Optional `GOOGLE_BOOKS_API_KEY`. Cached 1 day at Vercel's edge. | US-2, US-11 |
| U5 Build | `build.mjs` | Inlines the units into `dist/bookshelf.html` (one self-contained page). | NFR-1 |
| U6 Tests | `tests/core.test.mjs`, `tests/e2e.mjs` | Unit tests for U1; browser walk-through of the stories with Playwright. | all |

## Screen layout
```
┌─────────────────────── Bookshelf ───────────────────────┐
│ [cover][cover][cover][cover]…   ← face-out, title below │
│ ═══════════════ plank ═══════════════════════════════════│
│ [cover][cover]…                                          │
│ ═══════════════ plank ═══════════════════════════════════│
└──────────────────────────────────────────────────────────┘
┌──────────────────────── On the table ──── [+ Add a book] ┐
│  [cover  Title / Author / ▓▓▓▓░░ p.312 of 880 ]  …       │
└──────────────────────────────────────────────────────────┘
Book detail (dialog): cover · title · author · dates
  reading  → progress, quotes, "I finished it"
  finished → rating, review, quotes, "Put back on the table"
```

## Lookup flow (added 2026-10-18)
```
Page "Look up cover and genre"
  ├─ hosted (http/https): GET /api/lookup?title=&author=  ──► Vercel function
  │                                                          ├─ openlibrary.org/search.json  (cover_i, subject, pages)
  │                                                          └─ googleapis.com/books/v1      (categories, imageLinks)
  │                                                          → merge, classify genre, fetch cover → JSON
  └─ no service (local file): Open Library directly from the browser
  └─ inside the Claude Artifact: both blocked → "couldn't reach", type the genre
```
Each place keeps its own books: Claude Artifact (account store), Vercel copy and local file (that browser's storage).
