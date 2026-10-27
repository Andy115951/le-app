import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { PGlite } from "@electric-sql/pglite";
import {
  createDrawCandidates,
  positionsFor,
  drawSpread,
} from "../src/lib/draw.ts";
import {
  parseDrawAction,
  publicDrawState,
  isReadingDrawn,
} from "../src/lib/manual-draw.ts";

const uuid = (n) => `30000000-0000-4000-8000-${String(n).padStart(12, "0")}`;
const user = uuid(900),
  other = uuid(901);
const input = (n, patch = {}) => ({
  id: uuid(n),
  user_id: null,
  anonymous_id: `anon_synthetic_${n}`,
  question: "Synthetic manual draw",
  scene: "custom",
  spread_type: "three_card",
  detail_level: "brief",
  ritual_speed: "fast",
  silent_reveal: true,
  positions: positionsFor("three_card"),
  ...patch,
});
const migration = await readFile(
  new URL(
    "../supabase/migrations/202610270001_manual_draw.sql",
    import.meta.url,
  ),
  "utf8",
);

test("fresh click-time candidates and public progress never reveal card identities", () => {
  const deck = createDrawCandidates();
  assert.equal(deck.length, 78);
  assert.equal(new Set(deck.map((c) => c.cardId)).size, 78);
  const state = publicDrawState({
    version: 1,
    picked: [{ ...deck[0], index: 0 }],
    positions: positionsFor("three_card"),
    cutIndex: null,
    selected: [],
    revision: 0,
  });
  assert.deepEqual(
    Object.keys(state).sort(),
    ["cardCount", "revision", "cutIndex", "selected", "positions"].sort(),
  );
  assert.ok(!JSON.stringify(state).includes(deck[0].cardId));
  assert.ok(!JSON.stringify(state).includes("reversed"));
  assert.equal(publicDrawState(null), null);
  assert.equal(publicDrawState({ version: 1, completed: true }), null);
  for (const spread of [
    "single",
    "three_card",
    "five_cross",
    "relation_dual",
    "choice_fork",
    "moon_triad",
    "celtic_cross",
  ]) {
    const legacy = drawSpread(spread);
    assert.equal(legacy.cards.length, positionsFor(spread).length);
    assert.equal(
      isReadingDrawn({ status: "revealed", spreadResult: legacy }),
      true,
    );
  }
  assert.equal(
    isReadingDrawn({ status: "drawing", spreadResult: { cards: [] } }),
    false,
  );
});
test("manual API action validation rejects duplicate, out-of-range and malformed selections", () => {
  for (const raw of [
    null,
    [],
    {},
    { action: "cut", revision: 0, cutIndex: 0 },
    { action: "cut", revision: 0, cutIndex: 78 },
    { action: "select", revision: 0, selected: [0, 0] },
    { action: "select", revision: 0, selected: [-1] },
    { action: "select", revision: 0, selected: [78] },
    { action: "select", revision: 0, selected: [1.5] },
    { action: "select", revision: -1, selected: [] },
    { action: "confirm", revision: "0" },
  ])
    assert.equal(parseDrawAction(raw), null);
  assert.deepEqual(
    parseDrawAction({ action: "confirm", revision: 2, deck: ["spoof"] }),
    { action: "confirm", revision: 2 },
  );
  assert.deepEqual(
    parseDrawAction({ action: "select", revision: 1, selected: [0, 77] }),
    { action: "select", revision: 1, selected: [0, 77] },
  );
});

test("actual manual-draw migration: ownership, hidden state, quota, cut and immutable confirmation", async (t) => {
  const db = new PGlite();
  const rows = async (sql, params = []) => (await db.query(sql, params)).rows;
  const create = async (value) =>
    (
      await rows(
        "select * from public.tarot_create_manual_reading($1::jsonb)",
        [JSON.stringify(value)],
      )
    )[0];
  const act = async (
    value,
    action,
    revision,
    cut = null,
    selected = null,
    owner = { user: null, anon: value.anonymous_id },
    candidates = createDrawCandidates(),
  ) =>
    (
      await rows(
        "select * from public.tarot_apply_draw($1,$2,$3,$4,$5,$6,$7::integer[],$8::jsonb)",
        [
          value.id,
          owner.user,
          owner.anon,
          action,
          revision,
          cut,
          selected,
          action === "select" ? JSON.stringify(candidates) : null,
        ],
      )
    )[0];
  const denied = async (promise, code) =>
    assert.rejects(promise, (e) => e.code === code);
  let value = input(1),
    progress;
  try {
    await db.exec(
      "create role anon;create role authenticated;create role service_role bypassrls;grant usage on schema public to public;",
    );
    for (const file of [
      "20260910100000_candle_taro_init.sql",
      "20260911170000_oauth_users.sql",
      "20260914090000_silent_reveal.sql",
      "20260915100000_public_share_token.sql",
      "202610260001_private_tarot_tables.sql",
    ]) {
      const sql = await readFile(
        new URL(`../supabase/migrations/${file}`, import.meta.url),
        "utf8",
      );
      await db.exec(
        sql.replace(/^create extension if not exists pgcrypto;\s*$/m, ""),
      );
    }
    await db.exec(migration);
    await db.exec(migration);
    await rows(
      "insert into public.tarot_users(id,username,password_hash) values($1,'synthetic_manual_user','hash'),($2,'synthetic_other','hash')",
      [user, other],
    );
    await t.test(
      "browser roles cannot read the added column or invoke either function",
      async () => {
        for (const role of ["anon", "authenticated"]) {
          await db.exec(`set role ${role}`);
          await denied(
            rows("select draw_state from public.tarot_readings"),
            "42501",
          );
          await denied(create(value), "42501");
          await denied(act(value, "cut", 0, 20), "42501");
          await db.exec("reset role");
        }
        await db.exec("set role service_role");
      },
    );
    await t.test(
      "creation does not draw cards in advance and charges exactly once on retry",
      async () => {
        progress = await create(value);
        assert.equal(progress.status, "drawing");
        assert.deepEqual(progress.spread_result.cards, []);
        assert.deepEqual(progress.draw_state.picked, []);
        assert.equal("deck" in progress.draw_state, false);
        const retry = await create(value);
        assert.deepEqual(retry.draw_state, progress.draw_state);
        assert.equal(
          (
            await rows(
              "select readings_count from public.tarot_usage_counters where subject_key=$1",
              [`anon:${value.anonymous_id}`],
            )
          )[0].readings_count,
          1,
        );
        await denied(
          create(input(2, { anonymous_id: value.anonymous_id })),
          "P0001",
        );
      },
    );
    await t.test(
      "unknown, logged-in foreign and foreign guest owners cannot operate on the saved deck",
      async () => {
        for (const owner of [
          { user: null, anon: "other_guest" },
          { user, anon: null },
          { user: null, anon: null },
        ])
          await denied(act(value, "cut", 0, 20, null, owner), "P0002");
        await denied(act({ ...value, id: uuid(999) }, "cut", 0, 20), "P0002");
      },
    );
    await t.test(
      "cut is a ritual step and click-time draws persist without exposing cards",
      async () => {
        await denied(act(value, "select", 0, null, [1]), "22023");
        progress = await act(value, "cut", 0, 25);
        assert.equal(progress.draw_state.cutIndex, 25);
        assert.equal(progress.draw_state.revision, 1);
        await denied(act(value, "cut", 1, 30), "22023");
        await denied(act(value, "select", 1, null, [2, 2]), "22023");
        await denied(act(value, "select", 1, null, [78]), "22023");
        progress = await act(value, "select", 1, null, [0, 4]);
        assert.deepEqual(progress.draw_state.selected, [0, 4]);
        const saved = (
          await rows(
            "select draw_state from public.tarot_readings where id=$1",
            [value.id],
          )
        )[0].draw_state;
        assert.deepEqual(saved, progress.draw_state);
        assert.deepEqual(progress.spread_result.cards, []);
        await denied(act(value, "confirm", 2), "22023");
        await denied(act(value, "select", 1, null, [3]), "40001");
        progress = await act(value, "select", 2, null, [0]);
        assert.deepEqual(progress.draw_state.selected, [0]);
        progress = await act(value, "select", 3, null, [0, 4, 77]);
      },
    );
    await t.test(
      "confirmation reveals already-sampled cards and never rerolls or charges again",
      async () => {
        const picked = progress.draw_state.picked;
        progress = await act(value, "confirm", 4);
        assert.equal(progress.status, "revealed");
        assert.equal("deck" in progress.draw_state, false);
        assert.deepEqual(
          progress.spread_result.cards.map((c) => c.cardId),
          picked.map((c) => c.cardId),
        );
        assert.deepEqual(
          progress.spread_result.cards.map((c) => c.reversed),
          picked.map((c) => c.reversed),
        );
        assert.deepEqual(
          (await act(value, "confirm", 4)).spread_result,
          progress.spread_result,
        );
        await denied(act(value, "select", 4, null, [2, 3, 4]), "22023");
        assert.equal(
          (
            await rows(
              "select readings_count from public.tarot_usage_counters where subject_key=$1",
              [`anon:${value.anonymous_id}`],
            )
          )[0].readings_count,
          1,
        );
      },
    );
    await t.test(
      "every spread supports exactly its required count, including Celtic Cross",
      async () => {
        let n = 10;
        for (const spread of [
          "single",
          "three_card",
          "five_cross",
          "relation_dual",
          "choice_fork",
          "moon_triad",
          "celtic_cross",
        ]) {
          const next = input(n++, {
            spread_type: spread,
            positions: positionsFor(spread),
          });
          await create(next);
          await act(next, "cut", 0, 1);
          const picks = Array.from(
            { length: next.positions.length },
            (_, i) => i * 2,
          );
          await act(next, "select", 1, null, picks);
          const result = await act(next, "confirm", 2);
          assert.equal(result.spread_result.cards.length, picks.length);
          assert.equal(
            new Set(result.spread_result.cards.map((c) => c.cardId)).size,
            picks.length,
          );
        }
      },
    );
    await t.test(
      "user quota and idempotency serialize duplicate creates and roll back quota on errors",
      async () => {
        const base = input(40, { user_id: user, anonymous_id: null });
        const results = await Promise.all([create(base), create(base)]);
        assert.equal(results[0].id, results[1].id);
        for (let i = 41; i < 50; i++)
          await create(input(i, { user_id: user, anonymous_id: null }));
        await denied(
          create(input(50, { user_id: user, anonymous_id: null })),
          "P0001",
        );
        await denied(create({ ...base, question: "different" }), "40001");
        assert.equal(
          (
            await rows(
              "select readings_count from public.tarot_usage_counters where subject_key=$1",
              [`user:${user}`],
            )
          )[0].readings_count,
          10,
        );
        const bad = input(90);
        bad.positions = [];
        await denied(create(bad), "22023");
        assert.equal(
          (
            await rows(
              "select * from public.tarot_usage_counters where subject_key=$1",
              [`anon:${bad.anonymous_id}`],
            )
          ).length,
          0,
        );
      },
    );
    await t.test(
      "a guest draw follows the reading safely after account merge; old guest access ends",
      async () => {
        await db.exec("reset role");
        const next = input(100);
        await create(next);
        await rows(
          "update public.tarot_readings set user_id=$1,anonymous_id=null where id=$2",
          [user, next.id],
        );
        await db.exec("set role service_role");
        await denied(act(next, "cut", 0, 1), "P0002");
        const moved = await act(next, "cut", 0, 1, null, { user, anon: null });
        assert.equal(moved.draw_state.cutIndex, 1);
      },
    );
    await t.test(
      "message increments preserve a reading reservation instead of writing a stale count",
      async () => {
        const next = input(110);
        await create(next);
        await rows(
          "select * from public.tarot_increment_usage($1,'message',3)",
          [`anon:${next.anonymous_id}`],
        );
        const [counter] = await rows(
          "select readings_count,messages_count from public.tarot_usage_counters where subject_key=$1",
          [`anon:${next.anonymous_id}`],
        );
        assert.deepEqual(counter, { readings_count: 1, messages_count: 3 });
      },
    );
    await t.test(
      "fan position and visual cut do not decide the face: sampling happens at selection",
      async () => {
        const candidates = createDrawCandidates();
        const a = input(120, {
          spread_type: "single",
          positions: positionsFor("single"),
        });
        const b = input(121, {
          spread_type: "single",
          positions: positionsFor("single"),
        });
        await create(a);
        await create(b);
        await act(a, "cut", 0, 1);
        await act(b, "cut", 0, 77);
        const first = await act(
          a,
          "select",
          1,
          null,
          [0],
          undefined,
          candidates,
        );
        const second = await act(
          b,
          "select",
          1,
          null,
          [77],
          undefined,
          candidates,
        );
        assert.equal(first.draw_state.picked[0].cardId, candidates[0].cardId);
        assert.equal(second.draw_state.picked[0].cardId, candidates[0].cardId);
        const saved = first.draw_state.picked[0];
        const same = await act(a, "select", 2, null, [0]);
        assert.deepEqual(same.draw_state.picked[0], saved);
      },
    );
  } finally {
    await db.close();
  }
});
