// Vercel function: GET /api/lookup?title=…&author=… → cover (data URL), author, pages, genres.
const { lookup } = require("../lib/lookup.js");

module.exports = async (req, res) => {
  if (req.method !== "GET") {
    res.setHeader("Allow", "GET");
    return res.status(405).json({ status: "error", message: "Use GET." });
  }
  const { title, author } = req.query || {};
  try {
    const result = await lookup({ title, author }, { apiKey: process.env.GOOGLE_BOOKS_API_KEY });
    if (result.status === "bad-request") return res.status(400).json(result);
    // Cache only complete answers, so a catalogue that was down gets asked again next time.
    if ((result.status === "found" || result.status === "no-match") && !result.unavailable)
      res.setHeader("Cache-Control", "public, s-maxage=86400, stale-while-revalidate=604800");
    return res.status(200).json(result);
  } catch (e) {
    return res.status(500).json({ status: "error", message: "The lookup failed. Try again." });
  }
};
