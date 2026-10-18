// U3 Covers: Open Library lookup, image resizing, and designed covers for books without an image.
const Covers = (() => {
  const MAX_W = 320;

  function loadImage(src) {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => resolve(img);
      img.onerror = () => reject(new Error("That image couldn't be opened."));
      img.src = src;
    });
  }

  // Shrinks an uploaded or fetched image to a small JPEG data URL so it fits in one stored record.
  async function toDataUrl(blob) {
    const url = URL.createObjectURL(blob);
    try {
      const img = await loadImage(url);
      const scale = Math.min(1, MAX_W / img.naturalWidth);
      const canvas = document.createElement("canvas");
      canvas.width = Math.max(1, Math.round(img.naturalWidth * scale));
      canvas.height = Math.max(1, Math.round(img.naturalHeight * scale));
      canvas.getContext("2d").drawImage(img, 0, 0, canvas.width, canvas.height);
      return canvas.toDataURL("image/jpeg", 0.82);
    } finally {
      URL.revokeObjectURL(url);
    }
  }

  async function fetchWithTimeout(url, ms) {
    const ctl = new AbortController();
    const timer = setTimeout(() => ctl.abort(), ms);
    try {
      const res = await fetch(url, { signal: ctl.signal });
      if (!res.ok) throw new Error("HTTP " + res.status);
      return res;
    } finally {
      clearTimeout(timer);
    }
  }

  // The lookup service lives next to the page when it's hosted on Vercel (/api/lookup).
  // Returns null when there is no service here, so the caller can try Open Library directly.
  async function lookupViaService(title, author) {
    if (!/^https?:$/.test(location.protocol)) return null;
    const params = new URLSearchParams({ title: title.trim() });
    if (author && author.trim()) params.set("author", author.trim());
    try {
      const res = await fetchWithTimeout((window.BOOKSHELF_API || "/api/lookup") + "?" + params, 15000);
      const data = await res.json();
      return data && data.status ? data : null;
    } catch (e) {
      return null;
    }
  }

  async function lookupDirect(title, author) {
    const params = new URLSearchParams({
      title: title.trim(),
      limit: "5",
      fields: "title,author_name,cover_i,subject,number_of_pages_median",
    });
    if (author && author.trim()) params.set("author", author.trim());
    let data;
    try {
      const res = await fetchWithTimeout("https://openlibrary.org/search.json?" + params, 8000);
      data = await res.json();
    } catch (e) {
      return { status: "unreachable" };
    }
    const docs = Array.isArray(data.docs) ? data.docs : [];
    const doc = docs.find((d) => d.cover_i) || docs[0];
    if (!doc) return { status: "no-match" };
    const genres = Genre.classify((doc.subject || []).slice(0, 30));
    const result = {
      status: "found",
      author: (doc.author_name && doc.author_name[0]) || "",
      pages: doc.number_of_pages_median || null,
      genre: genres[0] || "",
      genres,
      cover: null,
    };
    if (doc.cover_i) {
      const coverUrl = "https://covers.openlibrary.org/b/id/" + doc.cover_i + "-L.jpg";
      try {
        const img = await fetchWithTimeout(coverUrl, 8000);
        result.cover = await toDataUrl(await img.blob());
      } catch (e) {
        result.cover = coverUrl; // keep the link; the page falls back to a designed cover if it can't load
      }
    }
    return result;
  }

  // Returns {status: "found"|"no-match"|"unreachable", cover?, author?, pages?, genre?, genres?}.
  async function lookup(title, author) {
    const viaService = await lookupViaService(title, author);
    if (viaService && viaService.status !== "error") {
      // Shrink service covers too, so every stored record stays small.
      if (viaService.cover && viaService.cover.startsWith("data:")) {
        try {
          viaService.cover = await toDataUrl(await (await fetch(viaService.cover)).blob());
        } catch (e) {
          viaService.cover = null;
        }
      }
      return viaService;
    }
    return lookupDirect(title, author);
  }

  const esc = (s) =>
    String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

  function designedCover(book) {
    const { bg, ink } = Core.coverPalette(book.title);
    return (
      '<span class="designed" style="--c-bg:' + bg + ";--c-ink:" + ink + '">' +
      '<span class="designed-rule"></span>' +
      '<span class="designed-title">' + esc(book.title) + "</span>" +
      (book.author ? '<span class="designed-author">' + esc(book.author) + "</span>" : "") +
      "</span>"
    );
  }

  // Cover markup: the stored image when there is one, with the designed cover underneath as fallback.
  function coverHtml(book) {
    const img = book.cover
      ? '<img alt="" loading="lazy" src="' + esc(book.cover) + '">'
      : "";
    return '<span class="cover">' + designedCover(book) + img + "</span>";
  }

  // A cover image that fails to load is removed, revealing the designed cover beneath it.
  if (typeof document !== "undefined") {
    document.addEventListener(
      "error",
      (e) => {
        if (e.target instanceof HTMLImageElement && e.target.parentElement?.classList.contains("cover")) e.target.remove();
      },
      true
    );
  }

  return { lookup, toDataUrl, coverHtml, esc };
})();
