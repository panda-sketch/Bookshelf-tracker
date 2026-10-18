// U6 Browser walk-through of the user stories against dist/bookshelf-local.html (localStorage mode).
// Run: NODE_PATH=$(npm root -g) node tests/e2e.mjs
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
const require = createRequire(import.meta.url);
const { chromium } = require("playwright");
const assert = require("node:assert/strict");

// BASE_URL=http://localhost:3000 runs it against the hosted (Vercel-style) build with the lookup service.
const page_url = process.env.BASE_URL || new URL("../dist/bookshelf-local.html", import.meta.url).href;
const hosted = !!process.env.BASE_URL;
const shots = fileURLToPath(new URL("./screens/", import.meta.url));
const browser = await chromium.launch();
const results = [];
const step = async (name, fn) => {
  try { await fn(); results.push("PASS " + name); } catch (e) { results.push("FAIL " + name + "\n     " + e.message.split("\n")[0]); }
};

for (const scheme of ["light", "dark"]) {
  const ctx = await browser.newContext({ viewport: { width: 1100, height: 900 }, colorScheme: scheme });
  const page = await ctx.newPage();
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto(page_url);
  await page.waitForSelector(".shelf-book");
  await page.screenshot({ path: shots + `examples-${scheme}.png`, fullPage: true });
  if (scheme === "dark") { assert.deepEqual(errors, []); await ctx.close(); continue; }

  await step("US-10 empty room shows labelled examples", async () => {
    assert.equal(await page.isVisible("#examplesNote"), true);
    assert.equal(await page.locator(".shelf-book").count(), 4);
    assert.equal(await page.locator(".table-book").count(), 2);
    await page.click('.shelf-book[aria-label^="Frankenstein"]');
    assert.match(await page.textContent("#bookBody"), /Beware; for I am fearless/);
    assert.equal(await page.locator("#bookBody form").count(), 0, "examples are read-only");
    await page.keyboard.press("Escape");
  });

  await step("US-1 blank title shows an error", async () => {
    await page.click("#addBtn");
    await page.click("#saveBookBtn");
    assert.equal(await page.textContent("#fTitleError"), "Add a title to save this book.");
  });

  await step("US-2 cover and genre lookup (found when hosted, degrades when unreachable)", async () => {
    await page.fill("#fTitle", "Piranesi");
    await page.fill("#fAuthor", "Susanna Clarke");
    await page.click("#findCoverBtn");
    await page.waitForFunction(() => document.getElementById("findCoverBtn").textContent === "Look up cover and genre", null, { timeout: 20000 });
    const hint = await page.textContent("#coverHint");
    if (hosted) {
      assert.match(hint, /Found the cover and genre/);
      assert.equal(await page.inputValue("#fGenre"), "Fantasy");
      await page.waitForSelector("#fCoverPreview img");
    } else {
      assert.match(hint, /Couldn't reach/);
      assert.equal(await page.locator("#fCoverPreview .designed-title").textContent(), "Piranesi");
      await page.fill("#fGenre", "Fantasy");
    }
  });

  await step("US-1/US-3 adding a book puts it on the table and examples disappear", async () => {
    await page.fill("#fPages", "272");
    await page.click("#saveBookBtn");
    await page.waitForSelector('.table-book:has-text("Piranesi")');
    assert.equal(await page.isVisible("#examplesNote"), false);
    assert.equal(await page.locator(".table-book").count(), 1);
    assert.match(await page.textContent(".shelf"), /Finish a book/);
    assert.match(await page.textContent("#tally"), /0 books finished · 1 on the table/);
  });

  await step("US-2 upload a cover image", async () => {
    await page.click('.table-book:has-text("Piranesi")');
    await page.click('[data-act="edit"]');
    const png = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAIAAAADCAIAAAA2iEnWAAAAFklEQVR4nGNkYPjPwMDAxMDAwMDAAAAhxwEGuvb3+gAAAABJRU5ErkJggg==", "base64");
    await page.setInputFiles("#fCoverFile", { name: "cover.png", mimeType: "image/png", buffer: png });
    await page.waitForSelector("#fCoverPreview img");
    await page.click("#saveBookBtn");
    await page.waitForSelector("#bookBody .cover img");
  });

  await step("US-4 progress saves and clamps", async () => {
    await page.fill("#dPage", "500");
    await page.click('form[data-form="progress"] button');
    assert.equal(await page.inputValue("#dPage"), "272");
    await page.fill("#dPage", "136");
    await page.click('form[data-form="progress"] button');
    assert.match(await page.textContent("#bookBody"), /of 272 · 50%/);
  });

  await step("US-6 collect quotes while reading", async () => {
    await page.click('form[data-form="quote"] button');
    assert.equal(await page.textContent("#dQuoteError"), "Write the quote before adding it.");
    await page.fill("#dQuote", "The Beauty of the House is immeasurable; its Kindness infinite.");
    await page.fill("#dQuotePage", "5");
    await page.click('form[data-form="quote"] button');
    await page.fill("#dQuote", "A second line worth keeping.");
    await page.click('form[data-form="quote"] button');
    assert.equal(await page.locator(".quote").count(), 2);
    await page.click('.quote:has-text("second line") [data-act="remove-quote"]');
    assert.equal(await page.locator(".quote").count(), 1);
  });

  await step("US-5 finishing puts the cover and title on the shelf", async () => {
    await page.click('[data-act="start-finish"]');
    await page.click('label[for="finishRating4"]');
    await page.fill("#dFinishReview", "Strange and kind. The House stays with me.");
    await page.click('form[data-form="finish"] button[type="submit"]');
    await page.keyboard.press("Escape");
    await page.waitForSelector('.shelf-book:has-text("Piranesi")');
    assert.equal(await page.locator(".table-book").count(), 0);
    assert.match(await page.textContent(".table-list"), /Nothing on the table/);
  });

  await step("US-7 clicking the shelf book shows review and quotes; review is editable", async () => {
    await page.click('.shelf-book:has-text("Piranesi")');
    const body = await page.textContent("#bookBody");
    assert.match(body, /On the shelf/);
    assert.match(body, /Kindness infinite/);
    assert.equal(await page.inputValue("#dReview"), "Strange and kind. The House stays with me.");
    assert.equal(await page.getAttribute(".stars-static", "aria-label"), "Rated 4 of 5");
    await page.click('label[for="reviewRating5"]');
    await page.fill("#dReview", "On reflection, a favourite.");
    await page.click('form[data-form="review"] button[type="submit"]');
    assert.equal(await page.getAttribute(".stars-static", "aria-label"), "Rated 5 of 5");
  });

  await step("US-1 add an already-finished book straight to the shelf, newest last", async () => {
    await page.keyboard.press("Escape");
    await page.click("#addBtn");
    await page.fill("#fTitle", "Klara and the Sun");
    await page.check("#fFinished");
    await page.click("#saveBookBtn");
    await page.waitForSelector('#bookDialog[open]');
    await page.keyboard.press("Escape");
    const titles = await page.locator(".shelf-title").allTextContents();
    assert.deepEqual(titles, ["Piranesi", "Klara and the Sun"]);
  });

  await step("Genre shows on the book and filters the shelf", async () => {
    await page.click('.shelf-book:has-text("Klara")');
    await page.click('[data-act="edit"]');
    await page.fill("#fGenre", "Science Fiction");
    await page.click("#saveBookBtn");
    assert.match(await page.textContent("#bookBody .genre-line"), /Science Fiction/);
    await page.keyboard.press("Escape");
    const chips = await page.locator(".genre-chip").allTextContents();
    assert.deepEqual(chips.map((c) => c.replace(/\s+/g, " ").trim()), ["All 2", "Fantasy 1", "Science Fiction 1"]);
    await page.click('.genre-chip[data-genre="Fantasy"]');
    assert.deepEqual(await page.locator(".shelf-title").allTextContents(), ["Piranesi"]);
    await page.click('.genre-chip[data-genre=""]');
    assert.equal(await page.locator(".shelf-book").count(), 2);
  });

  await step("US-9 everything survives a reload", async () => {
    await page.reload();
    await page.waitForSelector('.shelf-book:has-text("Piranesi")');
    await page.click('.shelf-book:has-text("Piranesi")');
    assert.equal(await page.inputValue("#dReview"), "On reflection, a favourite.");
    assert.equal(await page.locator(".quote").count(), 1);
    await page.screenshot({ path: shots + (hosted ? "hosted-" : "") + "detail-desktop.png" });
  });

  await step("US-8 put back on the table, then remove with confirmation", async () => {
    await page.click('[data-act="reopen"]');
    assert.match(await page.textContent("#bookBody"), /On the table/);
    await page.keyboard.press("Escape");
    assert.equal(await page.locator('.table-book:has-text("Piranesi")').count(), 1);
    await page.click('.shelf-book:has-text("Klara")');
    await page.click('[data-act="ask-remove"]');
    assert.match(await page.textContent(".confirm"), /can't be undone/);
    await page.click('[data-act="remove"]');
    assert.equal(await page.locator('.shelf-book:has-text("Klara")').count(), 0);
  });

  await step("NFR-3 phone width has no horizontal scroll", async () => {
    await page.setViewportSize({ width: 390, height: 844 });
    const over = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    assert.equal(over, 0);
    await page.screenshot({ path: shots + (hosted ? "hosted-" : "") + "phone.png", fullPage: true });
  });

  await step("no script errors", async () => assert.deepEqual(errors, []));
  await ctx.close();
}
await browser.close();
console.log(results.join("\n"));
process.exit(results.some((r) => r.startsWith("FAIL")) ? 1 : 0);
