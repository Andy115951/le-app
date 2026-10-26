const { getPublicQuote } = require("../../lib/public-quote");

module.exports = async function handler(req, res) {
  const send = (status, payload) => {
    res.statusCode = status;
    res.setHeader("Content-Type", "application/json; charset=utf-8");
    res.end(JSON.stringify(payload));
  };
  if (req.method !== "GET") {
    res.setHeader("Allow", "GET");
    return send(405, { error: "Method not allowed" });
  }
  const symbol = String(req.query?.symbol || "").trim().toUpperCase();
  if (!/^[A-Z][A-Z0-9.-]{0,9}$/.test(symbol)) return send(400, { error: "Invalid symbol" });
  try {
    const quote = await getPublicQuote(symbol);
    res.setHeader("Cache-Control", "s-maxage=120, stale-while-revalidate=300");
    send(200, { quote });
  } catch {
    res.setHeader("Cache-Control", "no-store");
    send(502, { error: "Quote unavailable" });
  }
};
