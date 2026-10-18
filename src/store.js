// U2 Storage: the viewer's private Artifact store when available, else localStorage.
const Store = (() => {
  const LS_KEY = "bookshelf-tracker.v1";
  const plain = (book) => JSON.parse(JSON.stringify(book));

  function localStore() {
    const listeners = [];
    let books = {};
    try {
      const raw = localStorage.getItem(LS_KEY);
      books = raw ? JSON.parse(raw).books || {} : {};
    } catch (e) {
      books = {};
    }
    const emit = () => listeners.forEach((fn) => fn(Object.values(books)));
    const persist = (next) => {
      try {
        localStorage.setItem(LS_KEY, JSON.stringify({ books: next }));
      } catch (e) {
        throw new Error("This browser didn't keep the change. Its storage may be full or blocked.");
      }
      books = next;
      emit();
    };
    return {
      kind: "local",
      subscribe(fn) {
        listeners.push(fn);
        fn(Object.values(books));
        return () => listeners.splice(listeners.indexOf(fn), 1);
      },
      async put(book) {
        persist({ ...books, [book.id]: plain(book) });
      },
      async remove(id) {
        const next = { ...books };
        delete next[id];
        persist(next);
      },
    };
  }

  async function artifactStore() {
    if (typeof window === "undefined" || !window.claude || typeof window.claude.use !== "function") return null;
    const giveUp = new Promise((resolve) => setTimeout(() => resolve([null, null]), 10000));
    const [db, user] = await Promise.race([
      Promise.all([window.claude.use("db"), window.claude.use("user")]),
      giveUp,
    ]);
    if (!db || !user) return null;
    const uid = await user.id();
    if (!uid) return null;
    const col = db.collection("data/users/" + uid);
    return {
      kind: "db",
      subscribe(fn, onError) {
        return col.onSnapshot(
          (snap) => fn(snap.docs.filter((d) => d.exists).map((d) => ({ ...d.data(), id: d.id }))),
          onError
        );
      },
      put: (book) => col.doc(book.id).set(plain(book)),
      remove: (id) => col.doc(id).delete(),
    };
  }

  async function open() {
    let store = null;
    try {
      store = await artifactStore();
    } catch (e) {
      store = null;
    }
    return store || localStore();
  }

  return { open };
})();
