import { test } from "node:test";
import assert from "node:assert/strict";
import { vaultPresentation } from "../src/vault-model";

test("concealed vault exposes no value-dependent presentation", () => {
  for (const n of [-50000, 0, 4500, 13500, 10000000, 100000000, 9000000000000])
    assert.equal(vaultPresentation(n, false), null);
});
test("vault preserves exact cents across denomination boundaries", () => {
  for (const n of [
    0, 1, 4500, 9999, 10000, 13500, 99999, 100000, 999999, 1000000, 4000000,
    12888888, 9000000000000,
  ]) {
    const p = vaultPresentation(n, true)!;
    assert.equal(
      p.bars * 1000000 + p.coins * 100000 + p.grains * 10000 + p.dust,
      n,
    );
    assert.ok(p.shownBars <= p.max);
  }
  assert.equal(vaultPresentation(4500, true)!.grains, 0);
  assert.equal(vaultPresentation(13500, true)!.grains, 1);
  assert.equal(vaultPresentation(13500, true)!.dust, 3500);
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
    negative.bars + negative.coins + negative.grains + negative.dust,
    0,
  );
  assert.match(negative.note, /负/);
});
