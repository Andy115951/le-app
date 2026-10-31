import { test } from "node:test";
import assert from "node:assert/strict";
import {
  LanPeer,
  decode64,
  encode64,
  pairCode,
  parsePairCode,
} from "../src/lan-protocol";
import { lanCrypto } from "../src/lan-crypto.web";
const pairing = () => ({
  host: "192.168.1.2",
  port: 12345,
  key: encode64(crypto.getRandomValues(new Uint8Array(32))),
  expiresAt: Date.now() + 600_000,
});
test("pairing accepts private IPv4 only and rejects invalid or expired codes", () => {
  const p = pairing();
  assert.deepEqual(parsePairCode(pairCode(p)), p);
  for (const change of [
    { host: "example.com" },
    { host: "8.8.8.8" },
    { host: "192.168.01.2" },
    { host: "192.168.1.256" },
    { host: 42 },
    { port: 0 },
    { port: 65536 },
    { key: "invalid" },
    { expiresAt: Date.now() - 1 },
  ])
    assert.throws(() =>
      parsePairCode(pairCode({ ...p, ...change } as typeof p)),
    );
  assert.throws(() => parsePairCode("https://example.com/"));
});
test("AES-GCM preserves Unicode, uses fresh nonces, authenticates direction and detects tampering", async () => {
  const key = decode64(pairing().key);
  const text = "Synthetic 账本 · €";
  const a = await lanCrypto.seal(key, text, "ledger-lan/v1/request");
  const b = await lanCrypto.seal(key, text, "ledger-lan/v1/request");
  assert.notEqual(a, b);
  assert.equal(await lanCrypto.open(key, a, "ledger-lan/v1/request"), text);
  await assert.rejects(() => lanCrypto.open(key, a, "ledger-lan/v1/response"));
  const altered = decode64(a);
  altered[15] ^= 1;
  await assert.rejects(() =>
    lanCrypto.open(key, encode64(altered), "ledger-lan/v1/request"),
  );
});
test("a validly encrypted response for another request is rejected", async () => {
  const p = pairing();
  const transport = (async () =>
    new Response(
      await lanCrypto.seal(
        decode64(p.key),
        JSON.stringify({
          requestId: crypto.randomUUID(),
          ok: true,
          data: { state: "waiting" },
        }),
        "ledger-lan/v1/response",
      ),
    )) as typeof fetch;
  await assert.rejects(
    () => new LanPeer(pairCode(p), lanCrypto, transport).request("inspect"),
    /响应不匹配/,
  );
});
