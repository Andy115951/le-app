import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import ts from "typescript";

const source = await readFile(new URL("../src/statistics.ts", import.meta.url), "utf8");
const { outputText } = ts.transpileModule(source, {
  compilerOptions: { target: ts.ScriptTarget.ES2020, module: ts.ModuleKind.ESNext }
});
const { buildDashboardBuckets } = await import(`data:text/javascript;base64,${Buffer.from(outputText).toString("base64")}`);
const seconds = (iso) => new Date(iso).getTime() / 1000;
const entry = (start, duration) => ({ started_at: new Date(start * 1000).toISOString(), duration_seconds: duration });
const sum = (buckets) => buckets.reduce((total, bucket) => total + bucket.sec, 0);

test("6h / 24h / 7d charts include the partial leading bucket and match the range total", () => {
  process.env.TZ = "Asia/Shanghai";
  const end = seconds("2026-10-19T14:35:00+08:00");
  for (const hours of [6, 24, 168]) {
    const start = end - hours * 3600;
    const rows = [entry(start - 600, hours * 3600 + 1200)];
    const buckets = buildDashboardBuckets(rows, start, end, hours <= 24);
    assert.equal(sum(buckets), hours * 3600);
    assert.equal(buckets[0].sec, hours <= 24 ? 25 * 60 : (9 * 60 + 25) * 60);
    assert.equal(new Set(buckets.map((bucket) => bucket.startSec)).size, buckets.length);
  }
});

test("midnight segments split between days and more than 1,000 entries are retained", () => {
  process.env.TZ = "Asia/Shanghai";
  const start = seconds("2026-10-18T00:00:00+08:00");
  const midnight = start + 86400;
  const rows = Array.from({ length: 1505 }, () => entry(midnight - 60, 120));
  const buckets = buildDashboardBuckets(rows, start, midnight + 86400, false);
  assert.deepEqual(buckets.map((bucket) => bucket.sec), [1505 * 60, 1505 * 60]);
});

test("out-of-range, invalid, zero-length, and negative-length entries contribute nothing", () => {
  const start = seconds("2026-10-19T00:00:00Z");
  const rows = [entry(start - 10, 10), entry(start + 3600, 10), entry(start, 0), entry(start, -5),
    { started_at: "invalid", duration_seconds: 10 }];
  assert.equal(sum(buildDashboardBuckets(rows, start, start + 3600, true)), 0);
});

test("daily buckets follow 23-hour and 25-hour days across daylight saving transitions", () => {
  process.env.TZ = "America/New_York";
  try {
    for (const [from, to, hours] of [
      ["2026-03-08T00:00:00-05:00", "2026-03-09T00:00:00-04:00", 23],
      ["2026-11-01T00:00:00-04:00", "2026-11-02T00:00:00-05:00", 25]
    ]) {
      const start = seconds(from);
      const end = seconds(to);
      const buckets = buildDashboardBuckets([entry(start, end - start)], start, end, false);
      assert.equal(buckets.length, 1);
      assert.equal(sum(buckets), hours * 3600);
    }
  } finally {
    process.env.TZ = "Asia/Shanghai";
  }
});
