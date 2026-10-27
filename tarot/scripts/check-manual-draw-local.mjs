// Explicit end-to-end API check against a disposable LOCAL fixture only.
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
const base = new URL(process.env.TAROT_LOCAL_ORIGIN || "http://127.0.0.1:3127");
assert.ok(process.argv.includes("--run-local"), "Requires --run-local");
assert.ok(
  base.protocol === "http:" &&
    ["127.0.0.1", "localhost"].includes(base.hostname),
  "Cloud targets are forbidden",
);
const anon = `anon_local_api_${randomUUID()}`,
  key = randomUUID();
const headers = {
  "Content-Type": "application/json",
  Cookie: `ct_anon=${anon}`,
};
const body = {
  question: "Synthetic manual API regression",
  scene: "custom",
  spreadType: "three_card",
  detailLevel: "brief",
  ritualSpeed: "fast",
  silentReveal: true,
};
async function request(path, options = {}, status = 200) {
  const r = await fetch(new URL(path, base), {
    ...options,
    headers: { ...headers, ...options.headers },
  });
  const data = await r.json();
  assert.equal(r.status, status, `${path}: ${JSON.stringify(data)}`);
  return data;
}
const post = (path, value, status = 200, extra = {}) =>
  request(
    path,
    { method: "POST", body: JSON.stringify(value), headers: extra },
    status,
  );
const created = await post("/api/readings", body, 200, {
  "Idempotency-Key": key,
});
const id = created.reading.id,
  path = `/api/readings/${id}`;
assert.equal(created.reading.status, "drawing");
assert.deepEqual(created.reading.spreadResult.cards, []);
assert.ok(!JSON.stringify(created).includes('"deck"'));
assert.ok(!JSON.stringify(created).includes('"picked"'));
assert.ok(!JSON.stringify(created).includes('"cardId"'));
assert.equal(
  (await post("/api/readings", body, 200, { "Idempotency-Key": key })).reading
    .id,
  id,
);
await post("/api/readings", body, 429, { "Idempotency-Key": randomUUID() });
await post(`${path}/interpret`, {}, 409);
await post(`${path}/messages`, { content: "Synthetic pending follow-up" }, 409);
await request(
  path,
  { headers: { Cookie: "ct_anon=anon_different_local_user" } },
  404,
);
await post(`${path}/draw`, { action: "cut", revision: 0, cutIndex: 0 }, 400);
await post(`${path}/draw`, { action: "cut", revision: 0, cutIndex: 17 });
await post(`${path}/draw`, { action: "select", revision: 1, selected: [0, 8] });
await post(
  `${path}/draw`,
  { action: "select", revision: 1, selected: [2] },
  409,
);
const restored = await request(path);
assert.deepEqual(restored.reading.manualDraw.selected, [0, 8]);
assert.equal(restored.reading.manualDraw.cutIndex, 17);
assert.deepEqual(restored.reading.spreadResult.cards, []);
assert.ok(!JSON.stringify(restored).includes('"picked"'));
assert.ok(!JSON.stringify(restored).includes('"cardId"'));
await post(`${path}/draw`, { action: "confirm", revision: 2 }, 400);
await post(`${path}/draw`, {
  action: "select",
  revision: 2,
  selected: [0, 8, 77],
});
const result = await post(`${path}/draw`, { action: "confirm", revision: 3 });
assert.equal(result.reading.spreadResult.cards.length, 3);
assert.equal(result.reading.manualDraw, null);
assert.equal(result.reading.manuallyDrawn, true);
assert.ok(!JSON.stringify(result).includes('"deck"'));
assert.deepEqual(
  (await post(`${path}/draw`, { action: "confirm", revision: 3 })).reading
    .spreadResult,
  result.reading.spreadResult,
);
await post(
  `${path}/draw`,
  { action: "select", revision: 3, selected: [1, 2, 3] },
  400,
);
assert.equal((await request("/api/auth/me")).usage.readings, 1);
console.log(
  "PASS: local API creation, hidden DTO, ownership, quota, cut, restore, stale revision, confirmation and retry. No cloud or model calls.",
);
