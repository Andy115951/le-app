import { test } from "node:test";
import assert from "node:assert/strict";
import { shiftMonth, yearPageStart } from "../src/month-navigation";

test("month arrows cross year boundaries and clamp to ledger date support", () => {
  assert.equal(shiftMonth("2026-01", -1), "2025-12");
  assert.equal(shiftMonth("2026-12", 1), "2027-01");
  assert.equal(shiftMonth("1900-01", -1), "1900-01");
  assert.equal(shiftMonth("2199-12", 1), "2199-12");
});
test("year pages contain their selected year and align to the first supported year", () => {
  for (const year of [1900, 1901, 1911, 1912, 2026, 2199]) {
    const start = yearPageStart(year);
    assert.ok(start <= year && year < start + 12);
    assert.ok(start >= 1900 && start <= 2199);
    assert.equal((start - 1900) % 12, 0);
  }
});
