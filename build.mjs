// U5 Build: inline the units into one self-contained page, dist/bookshelf.html.
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
const here = new URL(".", import.meta.url);
const read = (p) => readFileSync(new URL(p, here), "utf8");
const parts = { STYLES: "src/styles.css", GENRE: "lib/genre.js", CORE: "src/core.js", STORE: "src/store.js", COVERS: "src/covers.js", APP: "src/app.js" };
let html = read("src/index.html");
for (const [key, file] of Object.entries(parts)) {
  const body = read(file).replace(/^if \(typeof module.*$/m, "");
  html = html.replace("/*" + key + "*/", () => body);
}
mkdirSync(new URL("dist/", here), { recursive: true });
// bookshelf.html is the Artifact body (the publisher adds the document skeleton);
// bookshelf-local.html is the same page wrapped to open straight from disk.
writeFileSync(new URL("dist/bookshelf.html", here), html);
const local = '<!doctype html><html lang="en"><head><meta charset="utf-8">' +
  '<meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">' +
  "<style>[hidden]{display:none!important}body{margin:0}img{max-width:100%}</style></head><body>" + html + "</body></html>";
writeFileSync(new URL("dist/bookshelf-local.html", here), local);
mkdirSync(new URL("public/", here), { recursive: true });
writeFileSync(new URL("public/index.html", here), local); // what Vercel serves
console.log("Built dist/bookshelf.html and dist/bookshelf-local.html (" + html.length + " bytes)");
