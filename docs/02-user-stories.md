# 02 · User stories (AI-DLC Inception)

Persona: **the Reader** (Thanh), who reads a few books at a time and likes keeping lines that stuck.

| ID | Story | Acceptance criteria | Covers |
|----|-------|---------------------|--------|
| US-1 | As a Reader, I want to add a book I've started so it sits on my table. | Given the add form, when I enter a title and save, the book appears on the table with a cover. A blank title shows "Add a title to save this book." | FR-1, FR-3 |
| US-2 | As a Reader, I want my book to have its real cover without hunting for an image. | "Find cover" searches Open Library by title/author and fills cover, author and pages when found. If it can't reach Open Library or finds nothing, it says so and a designed cover is used. I can upload my own image instead. | FR-2 |
| US-3 | As a Reader, I want to see all books I'm reading at once. | Every book with status *reading* is on the table, each with title, author and progress bar when pages are known. | FR-3 |
| US-4 | As a Reader, I want to log where I am in a book. | In the book's detail I can set the current page; progress updates on the table; the page can't exceed total pages or go below 0. | FR-4 |
| US-5 | As a Reader, when I finish a book I want it placed on my bookshelf. | "I finished it" asks for an optional rating (1–5) and review, then the book leaves the table and appears on the shelf, face-out with cover and title, as the newest book. | FR-5 |
| US-6 | As a Reader, I want to keep quotes from a book. | In the detail of any book I can add a quote (text required, page optional) and delete one. Quotes are listed in the order added. | FR-6 |
| US-7 | As a Reader, I want to click a book on my shelf and see what I thought of it. | Clicking (or Enter on) a shelf book opens its detail with cover, title, author, started/finished dates, rating, review and quotes. I can edit the review and rating and save. | FR-7 |
| US-8 | As a Reader, I want to fix mistakes. | From a shelf book I can "Put back on the table"; from any book I can "Remove book", which asks me to confirm in the page before deleting. | FR-8 |
| US-9 | As a Reader, I want my shelf to be there next time. | Reloading the page shows the same table and shelf, reviews and quotes. | FR-9 |
| US-10 | As a first-time visitor, I want to understand the app at a glance. | With no books, the room shows example books marked "Example" and a note saying they disappear when I add my own. | — |
| US-11 | As a Reader, I want a book's genre filled in for me. | On the hosted (Vercel) copy, "Look up cover and genre" fills cover, author, pages and genre, and lists other likely genres. I can type or change the genre (suggestions offered). Where the lookup can't reach the catalogues, it says so and I can type a genre. | FR-10 |
| US-12 | As a Reader, I want to see only my fantasy (or any genre) books on the shelf. | Genre chips above the shelf show each genre with a count; choosing one shows only those books; "All" shows everything. | FR-11 |
