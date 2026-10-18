# 01 · Intent and requirements (AI-DLC Inception)

## Intent
> "I want to build an app that will track what I'm currently reading and what I have read. When I finish a book, the book cover with title should be added to the bookshelf. The book(s) I'm reading should be on the table. If I click into a book on the bookshelf, I should be able to see my review and collected quotes." (Thanh, 2026-10-18)

A personal reading tracker drawn as a room: a **table** holds the books in progress, a **bookshelf** holds finished books face-out (cover + title). Each book carries a review and a collection of quotes.

## Functional requirements
| ID | Requirement |
|----|-------------|
| FR-1 | Add a book I'm starting: title (required), author, total pages (optional). It goes on the table. |
| FR-2 | Get a cover for the book: look it up on Open Library by title/author, or upload an image, or fall back to a designed cover drawn from the title. |
| FR-3 | The table shows every book currently being read, more than one allowed, with reading progress. |
| FR-4 | Update progress (current page) for a book on the table. |
| FR-5 | Mark a book finished: it leaves the table and its cover with title is placed on the bookshelf, newest at the end. Rating and review can be written at that moment or later. |
| FR-6 | Collect quotes (text + optional page) on any book, while reading or after. |
| FR-7 | Clicking a book on the shelf opens its detail: cover, title, author, dates, rating, review, collected quotes. Review and quotes are editable there. |
| FR-8 | Move a finished book back to the table (re-reading, or finished by mistake), and remove a book entirely, with an in-page confirmation. |
| FR-9 | Data persists between visits. |
| FR-10 | Each book has a genre (e.g. Fantasy, Science Fiction). Looking a book up fills the genre from Open Library and Google Books; I can type or change it. *(added 2026-10-18)* |
| FR-11 | The shelf can be filtered by genre. *(added 2026-10-18)* |

## Non-functional requirements
| ID | Requirement |
|----|-------------|
| NFR-1 | Self-contained single web page, no server to run. Opens from a file or as a published Claude Artifact. |
| NFR-2 | Persistence: inside the Artifact, the viewer's own private store (`db` capability, `data/users/<id>/…`, private even from the owner); as a local file, browser `localStorage`. |
| NFR-3 | Works at phone width (≈400px) and desktop; light and dark themes. |
| NFR-4 | Keyboard accessible: every book and control reachable and operable with the keyboard; visible focus. |
| NFR-6 | The cover and genre lookup runs as a free Vercel serverless function (`/api/lookup`) next to a hosted copy of the page, so the browser never has to reach other sites itself. *(added 2026-10-18)* |
| NFR-5 | Covers stored inline, resized to ≤ 320px wide JPEG so a book document stays far under the 256 KiB store limit. |

## Constraints and decisions
- No repository attached, so the app lives in the project folder (`/mnt/project-files/bookshelf-tracker/`).
- Inside a Claude Artifact the browser blocks requests to other sites, so Open Library lookup only works when the page is opened as a local file. The Artifact falls back to designed covers and uploads. (Decision: keep lookup, degrade quietly.)
- When the shelf and table are empty, the app shows clearly labelled example books so the first view explains itself; examples are never saved and disappear once the first real book is added.

## Follow-up intent (2026-10-18)
> "What if I want the app to scrape the web to find the cover art and the book classification?" … "I would like to use a free web server like Vercel. And yes, I mean genre."

Decision: use book catalogue APIs (Open Library, Google Books) from a Vercel function rather than scraping sites such as Goodreads or Amazon, which block it and forbid it in their terms.

## Out of scope (for now)
Wishlist / to-read pile, reading statistics, multiple shelves, sharing a shelf with others, import from Goodreads, syncing books between the Claude Artifact and the Vercel copy.
