# Bookshelf Tracker

A reading room: books you're reading sit **on the table**; when you finish one, its cover and title go **on the shelf**. Click a shelf book to see your rating, review and collected quotes. Each book has a genre, and the shelf can be filtered by genre.

- In Claude: https://claude.ai/artifact/A6VfxCAyo2C9FoWSv93qpG (type genres yourself; cover lookup can't reach the web from inside Claude)
- On Vercel: full cover and genre lookup (see "Deploy to Vercel")
- From disk: open `dist/bookshelf-local.html`

## Deploy to Vercel (free)
1. Push this folder to a GitHub repository.
2. On vercel.com, choose **Add New → Project**, import the repository and press **Deploy**. `vercel.json` already sets the build (`node build.mjs`) and output (`public/`); no other settings are needed.
3. Optional: add an environment variable `GOOGLE_BOOKS_API_KEY` (free from Google Cloud) if lookups start returning fewer genres. Without a key, Google Books limits requests per server, and Open Library still answers.

Books saved on the Vercel copy live in that browser's storage, separate from the Claude version.

## Develop
```
npm run build     # writes dist/ (Claude Artifact + local file) and public/ (Vercel)
npm test          # unit tests
npm run dev       # local stand-in for Vercel at http://localhost:3000
NODE_PATH=$(npm root -g) npm run e2e   # browser walk-through (Playwright)
```

## AI-DLC docs
1. [Intent and requirements](docs/01-intent-and-requirements.md)
2. [User stories](docs/02-user-stories.md)
3. [Design: domain model and units of work](docs/03-design.md)
4. [Construction and test log](docs/04-construction-and-tests.md)
