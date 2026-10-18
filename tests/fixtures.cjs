// Canned Open Library / Google Books responses so the lookup can be tested offline.
const PNG = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAIAAAADCAIAAAA2iEnWAAAAFklEQVR4nGNkYPjPwMDAxMDAwMDAAAAhxwEGuvb3+gAAAABJRU5ErkJggg==", "base64");
const COVER = Buffer.concat([PNG, Buffer.alloc(400)]); // padded past the "tiny placeholder" cutoff

function jsonRes(body, status = 200) {
  return { ok: status < 400, status, headers: { get: () => "application/json" }, json: async () => body };
}
function imgRes(buf) {
  return { ok: true, status: 200, headers: { get: () => "image/png" }, arrayBuffer: async () => buf };
}

// mode: "ok" (both answer), "ol-down" (Open Library fails), "none" (no matches), "down" (both fail)
function fakeFetch(mode = "ok") {
  const calls = [];
  const fn = async (url) => {
    calls.push(String(url));
    const u = String(url);
    if (mode === "down") throw new Error("network down");
    if (u.startsWith("https://openlibrary.org/search.json")) {
      if (mode === "ol-down") throw new Error("ol down");
      if (mode === "none") return jsonRes({ docs: [] });
      return jsonRes({ docs: [
        { title: "Piranesi (Large print)", author_name: ["Someone Else"], subject: ["Large type books"] },
        { title: "Piranesi", author_name: ["Susanna Clarke"], cover_i: 10594763, number_of_pages_median: 272,
          subject: ["Fiction", "Fantasy fiction", "Labyrinths", "Fiction, fantasy, general"] },
      ] });
    }
    if (u.startsWith("https://www.googleapis.com/books/v1/volumes")) {
      if (mode === "none") return jsonRes({ totalItems: 0 });
      return jsonRes({ items: [{ volumeInfo: { title: "Piranesi", authors: ["Susanna Clarke"], pageCount: 245,
        categories: ["Fiction / Fantasy / Contemporary"], imageLinks: { thumbnail: "http://books.google.com/books/content?id=x&zoom=1&edge=curl" } } }] });
    }
    if (u.startsWith("https://covers.openlibrary.org/") || u.startsWith("https://books.google.com/")) return imgRes(COVER);
    throw new Error("unexpected url " + u);
  };
  fn.calls = calls;
  return fn;
}

module.exports = { fakeFetch };
