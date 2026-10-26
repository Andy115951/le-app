import test from "node:test";
import assert from "node:assert/strict";
import { isQuotaExhausted } from "../src/lib/quota-state.ts";

const empty = { loading: false, error: null, remaining: { readings: 0, messages: 0 } };
test("request failure with zero placeholders is unavailable, not exhausted", () => {
  for (const bucket of ["readings", "messages"]) {
    assert.equal(isQuotaExhausted({ ...empty, error: "unavailable" }, bucket), false);
    assert.equal(isQuotaExhausted({ ...empty, loading: true }, bucket), false);
    assert.equal(isQuotaExhausted(empty, bucket), true);
  }
});
test("successful responses preserve single-message and three-message limits", () => {
  const state = { ...empty, remaining: { readings: 1, messages: 2 } };
  assert.equal(isQuotaExhausted(state, "readings"), false);
  assert.equal(isQuotaExhausted(state, "messages"), false);
  assert.equal(isQuotaExhausted(state, "messages", 3), true);
  assert.equal(isQuotaExhausted({ ...state, error: "offline" }, "messages", 3), false);
});
