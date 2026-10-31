import { test } from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { assets, exportBackup, nowInLedger, type Command } from "@ledger/core";
import { openNodeLedger, nodeDriver } from "../src/node";
import { LedgerRepository, type SqlDriver } from "../src/index";
const ctx = () => ({
  operationId: randomUUID(),
  source: "cli" as const,
  now: nowInLedger(),
  newId: randomUUID,
});
test("SQLite restart, concurrent client conflict, idempotency and whole-book restore", async () => {
  const directory = await mkdtemp(join(tmpdir(), "ledger-synthetic-"));
  const path = join(directory, "test.sqlite");
  let a = await openNodeLedger(path);
  let b = await openNodeLedger(path);
  try {
    const first = await a.snapshot();
    const command: Command = {
      type: "account.create",
      name: "Synthetic bank",
      kind: "cash",
      openingMinor: 10000,
      openedAt: "2026-01-01T00:00:00",
    };
    const context = ctx();
    const next = await a.run(command, context, { token: first.token });
    assert.equal((await b.snapshot()).ledger.accounts.length, 1);
    await assert.rejects(
      () => b.run(command, ctx(), { token: first.token }),
      /刷新/,
    );
    assert.equal(
      (await b.run(command, context, { token: first.token })).replayed,
      true,
    );
    const preview = await a.run({ ...command, name: "Preview only" }, ctx(), {
      token: next.token,
      dryRun: true,
    });
    assert.equal(preview.ledger.accounts.length, 2);
    assert.equal((await a.snapshot()).ledger.accounts.length, 1);
    const backup = exportBackup(next.ledger);
    await a.close();
    a = await openNodeLedger(path);
    assert.deepEqual((await a.snapshot()).ledger, next.ledger);
    let current = await a.snapshot();
    const restored = await a.restore(backup, current.token, ctx());
    assert.notEqual(restored.token, current.token);
    assert.deepEqual(
      assets(restored.ledger).accounts,
      assets(current.ledger).accounts,
    );
    assert.equal((await a.backups()).length, 1);
    assert.equal(
      JSON.parse(await a.readBackup(restored.backupId!)).ledger.accounts.length,
      1,
    );
    current = await a.snapshot();
    await a.restore(backup, current.token, ctx());
    assert.equal(
      (await a.snapshot()).ledger.accounts.length,
      1,
      "repeated restore replaces, never appends",
    );
    current = await a.snapshot();
    await assert.rejects(() => a.restore('{"bad":true}', current.token, ctx()));
    assert.equal((await a.snapshot()).token, current.token);
    await assert.rejects(() => a.run(command, ctx(), { token: first.token }));
  } finally {
    await a.close();
    await b.close();
    await rm(directory, { recursive: true, force: true });
  }
});
test("restore failure rolls back both replacement and pre-import backup", async () => {
  const base = nodeDriver(":memory:");
  let fail = false;
  const driver: SqlDriver = {
    ...base,
    transaction: (fn) =>
      base.transaction((tx) =>
        fn({
          ...tx,
          async run(sql, params) {
            if (fail && sql.startsWith("INSERT INTO ledger_meta"))
              throw new Error("Injected synthetic write failure");
            await tx.run(sql, params);
          },
        }),
      ),
  };
  const repo = new LedgerRepository(driver, randomUUID);
  await repo.initialize();
  const snapshot = await repo.snapshot();
  fail = true;
  await assert.rejects(
    () => repo.restore(exportBackup(snapshot.ledger), snapshot.token, ctx()),
    /Injected/,
  );
  fail = false;
  assert.deepEqual(await repo.snapshot(), snapshot);
  assert.deepEqual(await repo.backups(), []);
  await repo.close();
});
