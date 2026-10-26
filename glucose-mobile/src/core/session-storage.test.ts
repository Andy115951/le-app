import test from "node:test";
import assert from "node:assert/strict";
import { chunkedStorage, type KeyValueStorage } from "./session-storage";
function memory() {
  const data = new Map<string, string>();
  let failure: string | null = null;
  const store: KeyValueStorage = {
    async getItem(key) { return data.get(key) ?? null; },
    async setItem(key, value) { if (key.includes(failure || "never-fail")) throw new Error("injected failure"); data.set(key, new TextDecoder().decode(new TextEncoder().encode(value))); },
    async removeItem(key) { data.delete(key); },
  };
  return { data, store, failOn: (value: string | null) => { failure = value; } };
}
test("encrypted-storage adapter restores long Unicode sessions and cleans old generations on overwrite and sign-out", async () => {
  const memoryStore = memory(); let generation = 0;
  const adapter = chunkedStorage(memoryStore.store, () => `g${++generation}`);
  const value = JSON.stringify({ token: "x".repeat(7000), name: "家人🌿".repeat(100) });
  await adapter.setItem("session", value);
  assert.equal(await adapter.getItem("session"), value);
  for (const [key, part] of memoryStore.data) if (key !== "session") assert.ok(new TextEncoder().encode(part).length <= 1920);
  await adapter.setItem("session", "replacement");
  assert.equal(await adapter.getItem("session"), "replacement");
  assert.ok(![...memoryStore.data.keys()].some(key => key.includes("g1")));
  await adapter.removeItem("session");
  assert.equal(await adapter.getItem("session"), null);
  assert.equal(memoryStore.data.size, 0);
});
test("failed chunk writes retain the previous complete session instead of committing partial data", async () => {
  const memoryStore = memory(); let generation = 0;
  const adapter = chunkedStorage(memoryStore.store, () => `g${++generation}`);
  await adapter.setItem("session", "original");
  memoryStore.failOn("g2.1");
  await assert.rejects(adapter.setItem("session", "x".repeat(2000)));
  assert.equal(await adapter.getItem("session"), "original");
  assert.ok(![...memoryStore.data.keys()].some(key => key.includes("g2")));
});
test("concurrent refresh and sign-out are serialized in request order", async () => {
  const memoryStore = memory(); let generation = 0;
  const adapter = chunkedStorage(memoryStore.store, () => `g${++generation}`);
  await Promise.all([adapter.setItem("session", "first"), adapter.setItem("session", "refresh"), adapter.removeItem("session")]);
  assert.equal(await adapter.getItem("session"), null);
});
