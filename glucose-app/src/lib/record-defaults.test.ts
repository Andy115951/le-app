import assert from "node:assert/strict";
import test from "node:test";
import { initialRecordTime, suggestMealType } from "./record-defaults";

test("new records use the member's local date even when UTC is still yesterday", () => {
  const now = new Date("2026-10-19T16:08:59.789Z");
  assert.equal(initialRecordTime({ timezone: "Asia/Shanghai", now }), "2026-10-20T00:08");
  assert.equal(initialRecordTime({ timezone: "America/New_York", now }), "2026-10-19T12:08");
  assert.equal(initialRecordTime({ timezone: "UTC", now }), "2026-10-19T16:08");
});

test("editing keeps the stored instant instead of replacing it with selected day or now", () => {
  const input = { existingTime: "2026-10-18T23:42:16.000Z", selectedDay: "2026-10-20", now: new Date("2026-10-20T12:00:00Z") };
  assert.equal(initialRecordTime({ ...input, timezone: "Asia/Shanghai" }), "2026-10-19T07:42");
  assert.equal(initialRecordTime({ ...input, timezone: "America/New_York" }), "2026-10-18T19:42");
});

test("backdating and future selected dates inherit only the member-local clock and do not mutate now", () => {
  const now = new Date("2026-10-19T18:35:27.123Z");
  const original = now.toISOString();
  assert.equal(initialRecordTime({ selectedDay: "2026-10-18", timezone: "Asia/Shanghai", now }), "2026-10-18T02:35");
  assert.equal(initialRecordTime({ selectedDay: "2026-10-23", timezone: "Asia/Shanghai", now }), "2026-10-23T02:35");
  assert.equal(initialRecordTime({ selectedDay: "2026-10-19", timezone: "America/New_York", now }), "2026-10-19T14:35");
  assert.equal(now.toISOString(), original);
});

test("defaults use the actual DST offset rather than a fixed timezone offset", () => {
  assert.equal(initialRecordTime({ timezone: "America/New_York", now: new Date("2026-03-08T06:55:00Z") }), "2026-03-08T01:55");
  assert.equal(initialRecordTime({ timezone: "America/New_York", now: new Date("2026-03-08T07:05:00Z") }), "2026-03-08T03:05");
  assert.equal(initialRecordTime({ timezone: "America/New_York", now: new Date("2026-11-01T06:45:00Z") }), "2026-11-01T01:45");
  assert.equal(initialRecordTime({ timezone: "America/New_York", now: new Date("2026-01-01T02:15:00Z") }), "2025-12-31T21:15");
});

test("a selected date must be a real calendar day, including leap years", () => {
  const base = { timezone: "Asia/Shanghai", now: new Date("2026-10-19T04:00:00Z") };
  assert.equal(initialRecordTime({ ...base, selectedDay: "2024-02-29" }), "2024-02-29T12:00");
  for (const selectedDay of ["2026-02-29", "2026-02-30", "2026-13-01", "2026-00-10", "2026-10-32", "2026-1-2", "yesterday"]) {
    assert.throws(() => initialRecordTime({ ...base, selectedDay }), { name: "Error" }, selectedDay);
  }
});

test("an invalid recorded instant or timezone cannot silently create a plausible default", () => {
  assert.throws(() => initialRecordTime({ existingTime: "invalid", timezone: "Asia/Shanghai" }));
  assert.throws(() => initialRecordTime({ timezone: "Invalid/Timezone", now: new Date("2026-10-20T01:00:00Z") }));
});

test("meal suggestions change at breakfast, lunch, dinner and late-night boundaries", () => {
  const expected = {
    "00:00": "snack", "04:59": "snack", "05:00": "breakfast", "10:59": "breakfast",
    "11:00": "lunch", "15:59": "lunch", "16:00": "dinner", "21:59": "dinner", "22:00": "snack", "23:59": "snack",
  } as const;
  for (const [clock, meal] of Object.entries(expected)) assert.equal(suggestMealType(`2026-10-20T${clock}`), meal, clock);
});

test("meal suggestions follow the form's local clock across profile timezones", () => {
  const now = new Date("2026-10-19T23:30:00Z");
  assert.equal(suggestMealType(initialRecordTime({ timezone: "Asia/Shanghai", now })), "breakfast");
  assert.equal(suggestMealType(initialRecordTime({ timezone: "America/New_York", now })), "dinner");
  assert.equal(suggestMealType(initialRecordTime({ timezone: "UTC", now })), "snack");
});
