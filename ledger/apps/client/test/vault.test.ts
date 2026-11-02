import { test } from "node:test";
import assert from "node:assert/strict";
import { vaultPresentation } from "../src/vault-model";

test("concealed vault exposes no value-dependent presentation", () => {
  for (const n of [-50000, 0, 4500, 13500, 10000000, 100000000, 9000000000000])
    assert.equal(vaultPresentation(n, false), null);
});
test("vault preserves exact cents across denomination boundaries", () => {
  for (const n of [
    0, 1, 999, 1000, 3500, 4500, 9999, 10000, 13500, 58000, 99999, 100000,
    113500, 999999, 1000000, 1113500, 4000000, 12888888, 9000000000000,
  ]) {
    const p = vaultPresentation(n, true)!;
    assert.equal(
      p.bars * 1000000 +
        p.rods * 100000 +
        p.coins * 10000 +
        p.grains * 1000 +
        p.dust,
      n,
    );
    assert.ok(p.shownBars <= p.max);
    for (const count of [p.rods, p.coins, p.grains])
      assert.ok(count >= 0 && count <= 9);
    assert.ok(p.dust >= 0 && p.dust < 1000);
  }
  assert.equal(vaultPresentation(4500, true)!.grains, 4);
  assert.equal(vaultPresentation(13500, true)!.coins, 1);
  assert.equal(vaultPresentation(13500, true)!.grains, 3);
  assert.equal(vaultPresentation(13500, true)!.dust, 500);
  assert.equal(vaultPresentation(113500, true)!.rods, 1);
  assert.equal(vaultPresentation(1113500, true)!.bars, 1);
  assert.equal(
    vaultPresentation(13500, true)!.description,
    "1 枚金币 · 3 颗金粒 · 5.00 元金粉",
  );
  assert.equal(vaultPresentation(4000000, true)!.shownBars, 4);
});
test("tiers follow current net assets in both directions with bounded rendering", () => {
  for (const [n, tier] of [
    [9999999, 0],
    [10000000, 1],
    [99999999, 1],
    [100000000, 2],
    [10000000, 1],
    [0, 0],
  ])
    assert.equal(vaultPresentation(n, true)!.tier, tier);
  const large = vaultPresentation(9000000000000, true)!;
  assert.equal(large.shownBars, 48);
  assert.match(large.note, /9000000/);
  const negative = vaultPresentation(-13500, true)!;
  assert.equal(
    negative.bars +
      negative.rods +
      negative.coins +
      negative.grains +
      negative.dust,
    0,
  );
  assert.match(negative.note, /负/);
});
