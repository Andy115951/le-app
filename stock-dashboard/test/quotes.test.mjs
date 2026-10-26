import test from "node:test";
import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { fetchQuotes, missingQuoteSymbols } from "../quotes.js";
import { hasHoldingValue } from "../holding-display.mjs";
const require = createRequire(import.meta.url);
const { getPublicQuote, parsePublicQuote } = require("../lib/public-quote.js");
const handler = require("../api/global-stock/quote.js");
const json = value => ({ ok: true, json: async () => value });
const chart = { chart: { result: [{ meta: { symbol: "MAGS", regularMarketPrice: 70, chartPreviousClose: 68, regularMarketTime: 1792771200 }, timestamp: [1, 2, 3], indicators: { quote: [{ close: [69, null, 70] }] } }] } };

test("absent holdings do not produce zero-valued metadata", () => {
  for (const value of [null, undefined, "", "  ", NaN, Infinity, "bad", 0, -1]) assert.equal(hasHoldingValue(value), false);
  assert.equal(hasHoldingValue(12.5), true);
  assert.equal(hasHoldingValue("1.25"), true);
});
test("only missing quotes use the independent server fallback", async t => {
  const calls = [];
  t.mock.method(globalThis, "fetch", async url => {
    calls.push(url);
    if (url.includes("ulist")) return json({ data: { diff: [{ f12: "AAPL", f2: 123000, f3: 0, f4: 0, f13: 105 }] } });
    if (url.includes("trends2")) return json({ data: { trends: [] } });
    assert.equal(url, "./api/global-stock/quote?symbol=MAGS");
    return json({ quote: parsePublicQuote(chart, "MAGS") });
  });
  const quotes = await fetchQuotes(["AAPL", "MAGS"]);
  assert.equal(quotes.AAPL.price, 123);
  assert.equal(quotes.AAPL.changePercent, 0);
  assert.equal(quotes.MAGS.price, 70);
  assert.equal(quotes.MAGS.source, "Yahoo Finance");
  assert.deepEqual(quotes.MAGS.sparkline, [69, 70]);
  assert.deepEqual(missingQuoteSymbols(["AAPL", "MAGS"], quotes), []);
  assert.equal(calls.filter(url => url.startsWith("./api/")).length, 1);
});
test("unavailable sources preserve missing prices instead of inventing zeros", async t => {
  t.mock.method(globalThis, "fetch", async () => { throw new Error("offline"); });
  const quotes = await fetchQuotes(["MAGS"]);
  assert.equal(quotes.MAGS.price, null);
  assert.deepEqual(missingQuoteSymbols(["MAGS"], quotes), ["MAGS"]);
});
test("empty primary fields trigger fallback rather than becoming zero prices", async t => {
  t.mock.method(globalThis, "fetch", async url => {
    if (url.includes("ulist")) return json({ data: { diff: [{ f12: "MAGS", f2: null, f3: null, f13: 105 }] } });
    if (url.includes("trends2")) return json({});
    return json({ quote: parsePublicQuote(chart, "MAGS") });
  });
  assert.equal((await fetchQuotes(["MAGS"])).MAGS.price, 70);
});
test("fallback validates symbol, quote identity and real prices", async () => {
  assert.throws(() => parsePublicQuote(chart, "AAPL"), /unavailable/);
  for (const price of [null, "", 0, -1]) {
    const payload = structuredClone(chart); payload.chart.result[0].meta.regularMarketPrice = price;
    assert.throws(() => parsePublicQuote(payload, "MAGS"), /unavailable/);
  }
  let called = false;
  await assert.rejects(getPublicQuote("../../secret", async () => { called = true; }), /Invalid/);
  assert.equal(called, false);
});
test("public fallback never sends private credentials to its public source", async () => {
  const result = await getPublicQuote("mags", async (url, init) => {
    assert.ok(url.startsWith("https://query1.finance.yahoo.com/v8/finance/chart/MAGS?"));
    assert.deepEqual(Object.keys(init.headers).sort(), ["Accept", "User-Agent"]);
    return json(chart);
  });
  assert.equal(result.price, 70);
});
test("quote API errors contain no upstream error or key", async t => {
  t.mock.method(globalThis, "fetch", async () => { throw new Error("Authorization: Bearer synthetic-private-key"); });
  const res = { headers: {}, setHeader(k, v) { this.headers[k] = v; }, end(body) { this.body = body; } };
  await handler({ method: "GET", query: { symbol: "MAGS" } }, res);
  assert.equal(res.statusCode, 502);
  assert.deepEqual(JSON.parse(res.body), { error: "Quote unavailable" });
  assert.equal(res.headers["Cache-Control"], "no-store");
});
