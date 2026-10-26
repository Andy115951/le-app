// Independent public-data fallback. No account, provider key, or database needed.
function finite(value) {
  if (value === null || value === undefined || value === "") return null;
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

function parsePublicQuote(payload, symbol) {
  const result = payload?.chart?.result?.[0];
  const meta = result?.meta;
  const price = finite(meta?.regularMarketPrice);
  if (!meta || String(meta.symbol || "").toUpperCase() !== symbol || price === null || price <= 0) {
    throw new Error("Quote unavailable");
  }
  const previousClose = finite(meta.chartPreviousClose ?? meta.previousClose);
  const change = previousClose !== null && previousClose > 0 ? Number((price - previousClose).toFixed(3)) : null;
  const timestamps = result.timestamp || [];
  const closes = result.indicators?.quote?.[0]?.close || [];
  const marketTime = finite(meta.regularMarketTime);
  return {
    symbol,
    name: String(meta.longName || meta.shortName || symbol),
    market: "美股",
    price,
    change,
    changePercent: change !== null ? Number((change / previousClose * 100).toFixed(2)) : null,
    open: finite(meta.regularMarketOpen),
    high: finite(meta.regularMarketDayHigh),
    low: finite(meta.regularMarketDayLow),
    previousClose,
    marketAt: marketTime !== null ? new Date(marketTime * 1000).toISOString() : null,
    updatedAt: new Date().toISOString(),
    source: "Yahoo Finance",
    sparkline: closes.filter((value, index) => finite(timestamps[index]) !== null && finite(value) !== null && Number(value) > 0).map(Number)
  };
}

async function getPublicQuote(input, fetchImpl = fetch) {
  const symbol = String(input || "").trim().toUpperCase();
  if (!/^[A-Z][A-Z0-9.-]{0,9}$/.test(symbol)) throw new Error("Invalid symbol");
  const response = await fetchImpl("https://query1.finance.yahoo.com/v8/finance/chart/" + encodeURIComponent(symbol) + "?range=1d&interval=5m", {
    headers: { Accept: "application/json", "User-Agent": "Mozilla/5.0" },
    signal: AbortSignal.timeout(7000)
  });
  if (!response.ok) throw new Error("Quote unavailable");
  return parsePublicQuote(await response.json(), symbol);
}

module.exports = { getPublicQuote, parsePublicQuote };
