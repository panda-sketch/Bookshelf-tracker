// U4 Room UI: renders the shelf and table, and drives the add/edit and book detail dialogs.
(() => {
  const $ = (id) => document.getElementById(id);
  const esc = Covers.esc;

  let store = null;
  let books = [];
  let showExamples = false;
  let openId = null;
  let detailMode = null; // null | "finish" | "confirm-remove"
  let draft = null; // {mode, id, cover, coverSource}
  let shelfFilter = ""; // genre the shelf is filtered to, "" for all

  const EXAMPLES = [
    { id: "ex-austen", title: "Pride and Prejudice", author: "Jane Austen", genre: "Classics", status: "finished", pages: 432,
      startedAt: "2026-06-02", finishedAt: "2026-06-20", rating: 5,
      review: "Funnier than I remembered. Elizabeth's letter scene still lands.",
      quotes: [{ id: "exq1", text: "It is a truth universally acknowledged, that a single man in possession of a good fortune, must be in want of a wife.", page: 1 }] },
    { id: "ex-shelley", title: "Frankenstein", author: "Mary Shelley", genre: "Horror", status: "finished", pages: 280,
      startedAt: "2026-06-25", finishedAt: "2026-07-15", rating: 4,
      review: "The creature's chapters are the heart of it.",
      quotes: [{ id: "exq2", text: "Beware; for I am fearless, and therefore powerful." }] },
    { id: "ex-melville", title: "Moby-Dick", author: "Herman Melville", genre: "Classics", status: "finished", pages: 635,
      startedAt: "2026-07-18", finishedAt: "2026-08-30", rating: 3,
      review: "Loved the voice, skimmed the whale anatomy.",
      quotes: [{ id: "exq3", text: "Call me Ishmael.", page: 1 }] },
    { id: "ex-leguin", title: "The Left Hand of Darkness", author: "Ursula K. Le Guin", genre: "Science Fiction", status: "finished", pages: 304,
      startedAt: "2026-09-04", finishedAt: "2026-09-28", rating: 5,
      review: "The crossing of the ice is one of the best things I've read.",
      quotes: [{ id: "exq4", text: "Light is the left hand of darkness, and darkness the right hand of light." }] },
    { id: "ex-eliot", title: "Middlemarch", author: "George Eliot", genre: "Classics", status: "reading", pages: 880, currentPage: 312,
      startedAt: "2026-10-01",
      quotes: [{ id: "exq5", text: "What do we live for, if it is not to make life less difficult to each other?" }] },
    { id: "ex-homer", title: "The Odyssey", author: "Homer", genre: "Poetry", status: "reading", pages: 541, currentPage: 120,
      startedAt: "2026-10-10" },
  ].map((b) => Core.normalize({ ...b, example: true, createdAt: b.startedAt + "T09:00:00Z", updatedAt: (b.finishedAt || b.startedAt) + "T09:00:00Z" }));

  const allBooks = () => (showExamples ? EXAMPLES : books);
  const findBook = (id) => allBooks().find((b) => b.id === id);
  const plural = (n, word) => n + " " + word + (n === 1 ? "" : "s");
  const today = () => new Date().toISOString().slice(0, 10);

  function fmtDate(iso) {
    if (!iso) return "";
    const d = new Date(iso + "T00:00:00");
    return isNaN(d) ? iso : d.toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" });
  }

  let toastTimer = null;
  function toast(msg) {
    const el = $("toast");
    el.textContent = msg;
    el.hidden = false;
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => (el.hidden = true), 2800);
  }

  function coverWithTag(book) {
    const html = Covers.coverHtml(book);
    return book.example ? html.replace('<span class="cover">', '<span class="cover"><span class="tag">Example</span>') : html;
  }

  // ---------- Room ----------
  function renderRoom() {
    const list = allBooks();
    const shelf = Core.shelfBooks(list);
    const table = Core.tableBooks(list);
    $("examplesNote").hidden = !showExamples;
    $("tally").textContent = showExamples
      ? "Example shelf"
      : plural(shelf.length, "book") + " finished · " + table.length + " on the table";

    const genres = Core.shelfGenres(list);
    if (shelfFilter && !genres.some((g) => g.genre === shelfFilter)) shelfFilter = "";
    $("genreFilter").hidden = genres.length === 0;
    $("genreFilter").innerHTML = genres.length
      ? '<button type="button" class="genre-chip" data-genre="" aria-pressed="' + !shelfFilter + '">All <span>' + shelf.length + "</span></button>" +
        genres.map((g) =>
          '<button type="button" class="genre-chip" data-genre="' + esc(g.genre) + '" aria-pressed="' + (g.genre === shelfFilter) + '">' +
          esc(g.genre) + " <span>" + g.count + "</span></button>").join("")
      : "";
    const shown = shelfFilter ? shelf.filter((b) => b.genre === shelfFilter) : shelf;

    $("shelf").innerHTML = shown.length
      ? shown.map((b) =>
          '<li><button class="shelf-book" type="button" data-open="' + esc(b.id) + '" aria-label="' +
          esc(b.title + (b.author ? " by " + b.author : "") + (b.genre ? ", " + b.genre : "") + ", finished " + fmtDate(b.finishedAt)) + '">' +
          coverWithTag(b) + '<span class="shelf-title">' + esc(b.title) + "</span></button></li>"
        ).join("")
      : '<li class="shelf-empty">Finish a book and its cover lands here.</li>';

    $("table").innerHTML = table.length
      ? table.map((b) => {
          const ratio = Core.progressRatio(b);
          const progress = ratio === null
            ? '<span class="progress-text">' + (b.currentPage ? "On page " + b.currentPage : "Just started") + "</span>"
            : '<span class="progress" aria-hidden="true"><span style="width:' + Math.round(ratio * 100) + '%"></span></span>' +
              '<span class="progress-text">p. ' + b.currentPage + " of " + b.pages + " · " + Math.round(ratio * 100) + "%</span>";
          return '<li><button class="table-book" type="button" data-open="' + esc(b.id) + '">' + coverWithTag(b) +
            '<span class="table-meta"><strong>' + esc(b.title) + "</strong>" +
            (b.author || b.genre ? '<span class="by">' + esc([b.author, b.genre].filter(Boolean).join(" · ")) + "</span>" : "") + progress + "</span></button></li>";
        }).join("")
      : '<li><p class="table-empty">Nothing on the table. Add the book you\'re reading.</p></li>';
  }

  function onBooks(raw) {
    books = raw.map(Core.normalize).filter(Boolean);
    showExamples = books.length === 0;
    renderRoom();
    if (openId && !findBook(openId) && $("bookDialog").open) $("bookDialog").close();
  }

  async function save(book, message) {
    try {
      await store.put(book);
    } catch (e) {
      toast(e && e.message ? "Couldn't save: " + e.message : "Couldn't save that change. Try again.");
      return false;
    }
    const i = books.findIndex((b) => b.id === book.id);
    if (i >= 0) books[i] = book; else books.push(book);
    showExamples = false;
    renderRoom();
    if (message) toast(message);
    return true;
  }

  // ---------- Book detail ----------
  function starsHtml(name, value) {
    let html = '<fieldset class="stars"><legend class="label" style="width:100%;margin-bottom:4px">Rating</legend>';
    for (let n = 1; n <= 5; n++) {
      html += '<input type="radio" name="' + name + '" id="' + name + n + '" value="' + n + '"' + (value === n ? " checked" : "") + ">" +
        '<label class="star' + (n <= value ? " on" : "") + '" for="' + name + n + '" title="' + plural(n, "star") + '"><span aria-hidden="true">★</span><span class="sr">' + plural(n, "star") + "</span></label>";
    }
    return html + '<button type="button" class="btn quiet clear" data-act="clear-stars">No rating</button></fieldset>';
  }
  const staticStars = (r) =>
    r ? '<span class="stars-static" role="img" aria-label="Rated ' + r + ' of 5">' + "★".repeat(r) + "☆".repeat(5 - r) + "</span>" : "";

  function progressPanel(b, ex) {
    const ratio = Core.progressRatio(b);
    return '<section class="panel"><h3>Progress</h3>' +
      '<form class="row" novalidate data-form="progress">' +
      '<div class="field" style="flex:0 1 150px"><label for="dPage">Current page</label>' +
      '<input type="number" id="dPage" min="0"' + (b.pages ? ' max="' + b.pages + '"' : "") + ' value="' + b.currentPage + '"' + (ex ? " disabled" : "") + "></div>" +
      '<span class="progress-text" style="padding-bottom:10px">' + (b.pages ? "of " + b.pages + " · " + Math.round(ratio * 100) + "%" : "Add total pages in Edit details for a progress bar") + "</span>" +
      (ex ? "" : '<button class="btn" type="submit">Save page</button>') + "</form>" +
      (b.pages ? '<span class="progress" aria-hidden="true"><span style="width:' + Math.round(ratio * 100) + '%"></span></span>' : "") +
      (ex || detailMode === "finish" ? "" : '<div class="actions"><button class="btn primary" type="button" data-act="start-finish">I finished it</button></div>') +
      "</section>";
  }

  function finishPanel(b) {
    return '<section class="panel"><h3>Put it on the shelf</h3>' +
      '<form class="panel-form" novalidate data-form="finish">' + starsHtml("finishRating", b.rating) +
      '<div class="field"><label for="dFinishReview">Your review</label><textarea id="dFinishReview" placeholder="What did you think? You can write this later.">' + esc(b.review) + "</textarea></div>" +
      '<div class="field" style="max-width:200px"><label for="dFinishDate">Finished on</label><input type="date" id="dFinishDate" value="' + today() + '"></div>' +
      '<div class="actions"><button class="btn primary" type="submit">Put it on the shelf</button><button class="btn quiet" type="button" data-act="cancel-finish">Not yet</button></div>' +
      "</form></section>";
  }

  function reviewPanel(b, ex) {
    if (ex) {
      return '<section class="panel"><h3>Review</h3>' + staticStars(b.rating) +
        (b.review ? '<p class="review-text">' + esc(b.review) + "</p>" : '<p class="hint">No review written.</p>') + "</section>";
    }
    return '<section class="panel"><h3>Review</h3><form class="panel-form" novalidate data-form="review">' + starsHtml("reviewRating", b.rating) +
      '<div class="field"><label for="dReview">Your review</label><textarea id="dReview" placeholder="What did you think of it?">' + esc(b.review) + "</textarea></div>" +
      '<div class="actions"><button class="btn primary" type="submit">Save review</button></div></form></section>';
  }

  function quotesPanel(b, ex) {
    let html = '<section class="panel"><h3>Quotes' + (b.quotes.length ? " (" + b.quotes.length + ")" : "") + "</h3>";
    html += b.quotes.length
      ? '<ol class="quotes">' + b.quotes.map((q) =>
          '<li class="quote"><blockquote>' + esc(q.text) + "</blockquote>" +
          (q.page ? '<span class="page">p. ' + q.page + "</span>" : "") +
          (ex ? "" : '<button class="btn quiet" type="button" data-act="remove-quote" data-quote="' + esc(q.id) + '" aria-label="Remove this quote">Remove</button>') +
          "</li>").join("") + "</ol>"
      : '<p class="hint">No quotes yet. Keep the lines that stay with you.</p>';
    if (!ex) {
      html += '<form class="panel-form" novalidate data-form="quote">' +
        '<div class="field"><label for="dQuote">New quote</label><textarea id="dQuote" rows="3"></textarea><p class="error" id="dQuoteError" hidden></p></div>' +
        '<div class="row"><div class="field" style="flex:0 1 120px"><label for="dQuotePage">Page</label><input type="number" id="dQuotePage" min="1"></div>' +
        '<button class="btn" type="submit">Add quote</button></div></form>';
    }
    return html + "</section>";
  }

  function actionsPanel(b) {
    if (detailMode === "confirm-remove") {
      return '<section class="panel"><div class="confirm"><p>Remove “' + esc(b.title) + "” with its review and " + plural(b.quotes.length, "quote") + "? This can't be undone.</p>" +
        '<button class="btn quiet" type="button" data-act="cancel-remove">Keep it</button>' +
        '<button class="btn danger" type="button" data-act="remove">Remove book</button></div></section>';
    }
    return '<section class="panel"><div class="actions">' +
      '<button class="btn" type="button" data-act="edit">Edit details</button>' +
      (b.status === "finished" ? '<button class="btn" type="button" data-act="reopen">Put back on the table</button>' : "") +
      '<span class="spacer"></span><button class="btn quiet danger" type="button" data-act="ask-remove">Remove book</button></div></section>';
  }

  function renderDetail() {
    const b = findBook(openId);
    if (!b) {
      $("bookDialog").close();
      return;
    }
    const ex = !!b.example;
    const reading = b.status === "reading";
    let html = '<div class="dlg-head"><h2 id="bookTitle">' + esc(b.title) + '</h2><button class="close" type="button" data-close aria-label="Close">×</button></div>' +
      '<div class="detail-top">' + Covers.coverHtml(b) + '<div class="detail-info">' +
      '<span class="chip' + (reading ? "" : " finished") + '">' + (reading ? "On the table" : "On the shelf") + "</span>" +
      (b.author ? '<p class="by">by ' + esc(b.author) + "</p>" : "") +
      (b.genre ? '<p class="genre-line"><span class="label">Genre</span> ' + esc(b.genre) + "</p>" : "") +
      '<p class="dates">Started ' + fmtDate(b.startedAt) + (b.finishedAt ? "<br>Finished " + fmtDate(b.finishedAt) : "") + (b.pages ? "<br>" + b.pages + " pages" : "") + "</p>" +
      (reading ? "" : staticStars(b.rating)) +
      (ex ? '<p class="hint">This is an example book. Add your own to start your shelf.</p>' : "") +
      "</div></div>";
    if (reading) html += progressPanel(b, ex) + (detailMode === "finish" ? finishPanel(b) : "");
    else html += reviewPanel(b, ex);
    html += quotesPanel(b, ex);
    if (!ex) html += actionsPanel(b);
    $("bookBody").innerHTML = html;
  }

  function openDetail(id) {
    openId = id;
    detailMode = null;
    renderDetail();
    const dlg = $("bookDialog");
    if (!dlg.open) dlg.showModal();
    dlg.querySelector(".close").focus();
  }

  function checkedRating(form) {
    const r = form.querySelector(".stars input:checked");
    return r ? Number(r.value) : 0;
  }

  $("bookBody").addEventListener("change", (e) => {
    if (e.target.matches(".stars input")) paintStars(e.target.closest(".stars"));
  });
  function paintStars(fs) {
    const value = checkedRating(fs);
    fs.querySelectorAll("label.star").forEach((l, i) => l.classList.toggle("on", i < value));
  }

  $("bookBody").addEventListener("click", async (e) => {
    const btn = e.target.closest("[data-act]");
    if (!btn) return;
    const b = findBook(openId);
    if (!b) return;
    switch (btn.dataset.act) {
      case "start-finish":
        detailMode = "finish";
        renderDetail();
        $("dFinishReview").focus();
        break;
      case "cancel-finish":
      case "cancel-remove":
        detailMode = null;
        renderDetail();
        break;
      case "clear-stars": {
        const fs = btn.closest(".stars");
        fs.querySelectorAll("input").forEach((i) => (i.checked = false));
        paintStars(fs);
        break;
      }
      case "remove-quote":
        if (await save(Core.removeQuote(b, btn.dataset.quote), "Quote removed.")) renderDetail();
        break;
      case "reopen":
        if (await save(Core.reopenBook(b), "“" + b.title + "” is back on the table.")) renderDetail();
        break;
      case "edit":
        openEditor("edit", b);
        break;
      case "ask-remove":
        detailMode = "confirm-remove";
        renderDetail();
        break;
      case "remove":
        try {
          await store.remove(b.id);
        } catch (err) {
          toast("Couldn't remove that book. Try again.");
          return;
        }
        books = books.filter((x) => x.id !== b.id);
        showExamples = books.length === 0;
        renderRoom();
        $("bookDialog").close();
        toast("Removed “" + b.title + "”.");
        break;
    }
  });

  $("bookBody").addEventListener("submit", async (e) => {
    e.preventDefault();
    const form = e.target;
    const b = findBook(openId);
    if (!b || b.example) return;
    switch (form.dataset.form) {
      case "progress": {
        const updated = Core.setProgress(b, $("dPage").value);
        if (await save(updated, "Saved: page " + updated.currentPage + ".")) renderDetail();
        break;
      }
      case "finish": {
        const updated = Core.finishBook(b, {
          rating: checkedRating(form),
          review: $("dFinishReview").value,
          date: $("dFinishDate").value || today(),
        });
        if (await save(updated, "“" + b.title + "” is on the shelf.")) {
          detailMode = null;
          renderDetail();
        }
        break;
      }
      case "review":
        if (await save(Core.setReview(b, { rating: checkedRating(form), review: $("dReview").value }), "Review saved.")) renderDetail();
        break;
      case "quote": {
        let updated;
        try {
          updated = Core.addQuote(b, { text: $("dQuote").value, page: $("dQuotePage").value });
        } catch (err) {
          $("dQuoteError").textContent = err.message;
          $("dQuoteError").hidden = false;
          $("dQuote").focus();
          return;
        }
        if (await save(updated, "Quote added.")) {
          renderDetail();
          $("dQuote").focus();
        }
        break;
      }
    }
  });

  // ---------- Add / edit dialog ----------
  const DEFAULT_HINT = "Looks up the title and author on Open Library and Google Books. Without a cover image, the book gets a designed cover.";

  function renderCoverPreview() {
    $("fCoverPreview").innerHTML = Covers.coverHtml({
      title: $("fTitle").value.trim() || "Untitled",
      author: $("fAuthor").value.trim(),
      cover: draft.cover,
    });
    $("clearCoverBtn").hidden = !draft.cover;
  }

  function setFieldError(id, msg) {
    $(id).textContent = msg || "";
    $(id).hidden = !msg;
  }

  function openEditor(mode, book) {
    draft = { mode, id: book ? book.id : null, cover: book ? book.cover : null, coverSource: book ? book.coverSource : null };
    $("editTitle").textContent = mode === "add" ? "Add a book" : "Edit details";
    $("fTitle").value = book ? book.title : "";
    $("fAuthor").value = book ? book.author : "";
    $("fPages").value = book && book.pages ? book.pages : "";
    $("fGenre").value = book ? book.genre : "";
    $("genreOptions").innerHTML = [...new Set([...books.map((b) => b.genre).filter(Boolean), ...Genre.NAMES])]
      .map((g) => '<option value="' + esc(g) + '"></option>').join("");
    $("finishedRow").hidden = mode !== "add";
    $("fFinished").checked = false;
    $("saveBookBtn").textContent = mode === "add" ? "Put it on the table" : "Save changes";
    setFieldError("fTitleError", "");
    setFieldError("fPagesError", "");
    $("coverHint").textContent = DEFAULT_HINT;
    renderCoverPreview();
    $("editDialog").showModal();
    $("fTitle").focus();
  }

  $("addBtn").addEventListener("click", () => openEditor("add", null));
  $("fTitle").addEventListener("input", renderCoverPreview);
  $("fAuthor").addEventListener("input", renderCoverPreview);
  $("fFinished").addEventListener("change", (e) => {
    $("saveBookBtn").textContent = e.target.checked ? "Put it on the shelf" : "Put it on the table";
  });
  $("clearCoverBtn").addEventListener("click", () => {
    draft.cover = null;
    draft.coverSource = null;
    renderCoverPreview();
  });

  $("fCoverFile").addEventListener("change", async (e) => {
    const file = e.target.files && e.target.files[0];
    e.target.value = "";
    if (!file) return;
    try {
      draft.cover = await Covers.toDataUrl(file);
      draft.coverSource = "upload";
      $("coverHint").textContent = "Using your image.";
      renderCoverPreview();
    } catch (err) {
      $("coverHint").textContent = "That file couldn't be opened as an image. Try a JPG or PNG.";
    }
  });

  $("findCoverBtn").addEventListener("click", async () => {
    const title = $("fTitle").value.trim();
    if (!title) {
      setFieldError("fTitleError", "Add a title first, then find its cover.");
      $("fTitle").focus();
      return;
    }
    const btn = $("findCoverBtn");
    btn.disabled = true;
    btn.textContent = "Looking up…";
    $("coverHint").textContent = "Searching Open Library and Google Books…";
    const r = await Covers.lookup(title, $("fAuthor").value);
    btn.disabled = false;
    btn.textContent = "Look up cover and genre";
    if (!$("editDialog").open) return;
    if (r.status === "unreachable") {
      $("coverHint").textContent = "Couldn't reach the book catalogues from here. Upload an image and type the genre, or keep the designed cover.";
      return;
    }
    if (r.status === "no-match") {
      $("coverHint").textContent = "No match for that title. Check the spelling, or upload an image and type the genre.";
      return;
    }
    if (!$("fAuthor").value.trim() && r.author) $("fAuthor").value = r.author;
    if (!$("fPages").value && r.pages) $("fPages").value = r.pages;
    if (!$("fGenre").value.trim() && r.genre) $("fGenre").value = r.genre;
    const also = r.genres && r.genres.length > 1 ? " Other fits: " + r.genres.slice(1).join(", ") + "." : "";
    if (r.cover) {
      draft.cover = r.cover;
      draft.coverSource = "lookup";
      $("coverHint").textContent = "Found the cover" + (r.genre ? " and genre." : ". No genre was listed, so type one if you like.") + also;
    } else {
      $("coverHint").textContent = "Found the book, but no cover image. It will get a designed cover." + (r.genre ? " Genre filled in." : "") + also;
    }
    renderCoverPreview();
  });

  $("editForm").addEventListener("submit", async (e) => {
    e.preventDefault();
    const input = { title: $("fTitle").value, author: $("fAuthor").value, pages: $("fPages").value, genre: $("fGenre").value };
    const errors = Core.validateBookInput(input);
    setFieldError("fTitleError", errors.title);
    setFieldError("fPagesError", errors.pages);
    if (errors.title) return $("fTitle").focus();
    if (errors.pages) return $("fPages").focus();

    if (draft.mode === "add") {
      let book = Core.createBook({ ...input, cover: draft.cover, coverSource: draft.coverSource });
      const finished = $("fFinished").checked;
      if (finished) book = Core.finishBook(book);
      if (await save(book, "“" + book.title + "” is " + (finished ? "on the shelf." : "on the table."))) {
        $("editDialog").close();
        if (finished) openDetail(book.id); // straight to the review
      }
    } else {
      const current = findBook(draft.id);
      if (!current) return $("editDialog").close();
      const updated = { ...Core.updateDetails(current, input), cover: draft.cover, coverSource: draft.coverSource };
      if (await save(updated, "Details saved.")) {
        $("editDialog").close();
        renderDetail();
      }
    }
  });

  // ---------- Shared wiring ----------
  document.addEventListener("click", (e) => {
    const chip = e.target.closest("[data-genre]");
    if (chip) {
      shelfFilter = chip.dataset.genre;
      return renderRoom();
    }
    const opener = e.target.closest("[data-open]");
    if (opener) return openDetail(opener.dataset.open);
    const closer = e.target.closest("[data-close]");
    if (closer) return closer.closest("dialog").close();
    if (e.target instanceof HTMLDialogElement) e.target.close(); // click on the backdrop
  });
  $("bookDialog").addEventListener("close", () => {
    openId = null;
    detailMode = null;
  });

  async function init() {
    store = await Store.open();
    $("whereSaved").textContent = store.kind === "db"
      ? "Your books are saved privately to your account. Only you can see them."
      : "Your books are saved in this browser.";
    store.subscribe(onBooks, () => toast("Lost the connection to your saved books. Reload the page to reconnect."));
  }
  init();
})();
