// Maps messy catalogue subjects ("Fiction, fantasy, epic", "FICTION / Science Fiction / General")
// to a short list of reader-facing genres. Shared by the Vercel lookup service and the page.
const Genre = (() => {
  // Order matters: more specific genres first; ties go to the earlier entry.
  const RULES = [
    ["Graphic Novel", /graphic novel|\bcomics?\b|\bmanga\b/],
    ["Poetry", /\bpoetry\b|\bpoems\b/],
    ["Science Fiction", /science fiction|sci-fi|space opera|dystopia|cyberpunk/],
    ["Fantasy", /fantasy|\bmagic\b|dragons|wizards/],
    ["Horror", /horror|ghost stor|vampires?\b|zombies?\b/],
    ["Mystery", /myster|detective|whodunit|crime fiction|\bcrime\b/],
    ["Thriller", /thriller|suspense|espionage|\bspy\b/],
    ["Romance", /romance|love stor/],
    ["Historical Fiction", /historical fiction|fiction,? historical|fiction \/ historical/],
    ["Young Adult", /young adult|\bteen/],
    ["Children's", /juvenile|children/],
    ["Classics", /\bclassics?\b/],
    ["Literary Fiction", /literary/],
    ["Biography & Memoir", /biograph|memoir/],
    ["History", /\bhistory\b/],
    ["Science", /\bscience(?! fiction)|physics|biology|chemistry|astronomy|mathemat|evolution/],
    ["Philosophy", /philosoph/],
    ["Psychology", /psycholog/],
    ["Business & Economics", /business|economics|management|finance|investing/],
    ["Self-Help", /self-help|personal development|self-improvement/],
    ["Religion & Spirituality", /religio|spiritual|theolog|buddhis|christian|islam/],
    ["Politics", /politic|government/],
    ["Travel", /\btravel/],
    ["Cooking", /cooking|recipes|cookbook/],
    ["Essays", /\bessays\b/],
    ["Nonfiction", /non-?fiction/],
    ["Fiction", /(?<!non-?)\bfiction\b|\bnovels?\b/],
  ];
  const FICTION_KINDS = new Set([
    "Graphic Novel", "Science Fiction", "Fantasy", "Horror", "Mystery", "Thriller", "Romance",
    "Historical Fiction", "Young Adult", "Children's", "Classics", "Literary Fiction",
  ]);
  const NAMES = RULES.map((r) => r[0]);

  // subjects: [{text, weight}] or strings. Returns up to `max` genres, best first.
  function classify(subjects, max = 3) {
    const scores = new Map();
    for (const s of subjects || []) {
      const text = String(typeof s === "string" ? s : s.text || "").toLowerCase();
      const weight = typeof s === "string" ? 1 : s.weight || 1;
      if (!text) continue;
      for (const [name, re] of RULES) if (re.test(text)) scores.set(name, (scores.get(name) || 0) + weight);
    }
    let ranked = [...scores.entries()]
      .sort((a, b) => b[1] - a[1] || NAMES.indexOf(a[0]) - NAMES.indexOf(b[0]))
      .map((e) => e[0]);
    // Drop the generic label when a specific one is known.
    if (ranked.some((g) => FICTION_KINDS.has(g))) ranked = ranked.filter((g) => g !== "Fiction");
    if (ranked.some((g) => !FICTION_KINDS.has(g) && g !== "Fiction" && g !== "Nonfiction"))
      ranked = ranked.filter((g) => g !== "Nonfiction");
    return ranked.slice(0, max);
  }

  return { classify, NAMES };
})();

if (typeof module !== "undefined" && module.exports) module.exports = Genre;
