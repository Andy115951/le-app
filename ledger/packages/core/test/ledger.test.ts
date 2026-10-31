import { test } from "node:test";
import assert from "node:assert/strict";
import {
  assets,
  balance,
  emptyLedger,
  execute,
  exportBackup,
  parseBackup,
  parseMoney,
  money,
  report,
  validateLedger,
  defaultLabelIcon,
  type Command,
  type Ledger,
  type Entry,
} from "../src/index";
let seq = 0;
const newId = () => `synthetic-${++seq}`;
const time = "2026-01-01T00:00:00";
function run(s: Ledger, c: Command, op = newId()) {
  return execute(s, c, {
    newId,
    now: "2026-03-15T12:00:00",
    operationId: op,
    source: "ui",
  });
}
function fixture() {
  let s = emptyLedger(newId);
  for (const [name, kind, openingMinor] of [
    ["Test bank", "cash", 100_000],
    ["Test card", "credit", -10_000],
    ["Test fund", "investment", 50_000],
  ] as const)
    s = run(s, {
      type: "account.create",
      name,
      kind,
      openingMinor,
      openedAt: time,
    }).state;
  return s;
}
const entry = (
  accountId: string,
  kind: Entry["kind"],
  amountMinor: number,
  extra: Partial<Entry> = {},
): Omit<Entry, "id" | "version"> => ({
  accountId,
  kind,
  amountMinor,
  occurredAt: "2026-03-01T12:00:00",
  note: "Synthetic test",
  ...extra,
});
test("integer money rejects rounding, NaN and exponent inputs", () => {
  assert.equal(parseMoney("12.30"), 1230);
  assert.equal(parseMoney("-0.01"), -1);
  assert.equal(money(-123), "-1.23");
  for (const n of ["1.001", "1e3", "NaN", "", ".2", "1,000"])
    assert.throws(() => parseMoney(n));
});
test("optional built-in label icons survive backups and older label updates", () => {
  assert.equal(defaultLabelIcon("咖啡", "expense"), "coffee");
  assert.equal(defaultLabelIcon("constructor", "expense"), "tag");
  assert.equal(defaultLabelIcon("toString", "income"), "salary");
  const original = fixture();
  // Old v1 books without icon fields remain valid and unchanged.
  assert.ok(original.labels.every((l) => l.icon === undefined));
  assert.deepEqual(parseBackup(exportBackup(original)).ledger, original);
  let state = run(original, {
    type: "label.create",
    name: "Synthetic coffee",
    direction: "expense",
    icon: "coffee",
  }).state;
  let label = state.labels.find((l) => l.name === "Synthetic coffee")!;
  state = run(state, {
    type: "label.update",
    id: label.id,
    expectedVersion: label.version,
    name: "Synthetic cafe",
    hidden: false,
  }).state;
  label = state.labels.find((l) => l.id === label.id)!;
  assert.equal(
    label.icon,
    "coffee",
    "a client omitting icon preserves the existing choice",
  );
  const backup = parseBackup(exportBackup(state)).ledger;
  assert.equal(backup.labels.find((l) => l.id === label.id)?.icon, "coffee");
  const bad = structuredClone(backup);
  (bad.labels[0] as unknown as { icon: string }).icon = "external-icon-url";
  assert.throws(() => validateLedger(bad), /图标/);
  assert.deepEqual(state.accounts, original.accounts);
  assert.deepEqual(state.entries, original.entries);
  assert.equal(state.labels.find((l) => l.id === label.id)?.version, 2);
});
test("transfer create/edit/delete moves both accounts; repayment counts expense only once", () => {
  let s = fixture();
  const [bank, card, fund] = s.accounts;
  const net = assets(s, "2026-03-31T23:59:59").netMinor;
  s = run(s, {
    type: "entry.create",
    entry: entry(card.id, "expense", 2000),
  }).state;
  assert.equal(balance(s, card.id), -12000);
  assert.equal(report(s, "2026-03").expenseMinor, 2000);
  const transfer = run(s, {
    type: "entry.create",
    entry: entry(bank.id, "transfer", 5000, { toAccountId: card.id }),
  });
  s = transfer.state;
  assert.equal(balance(s, bank.id), 95000);
  assert.equal(balance(s, card.id), -7000);
  assert.equal(assets(s).netMinor, net - 2000);
  assert.equal(report(s, "2026-03").expenseMinor, 2000);
  const e = s.entries.find((e) => e.id === transfer.resultId)!;
  s = run(s, {
    type: "entry.update",
    id: e.id,
    expectedVersion: 1,
    entry: entry(bank.id, "transfer", 6000, { toAccountId: fund.id }),
  }).state;
  assert.equal(balance(s, card.id), -12000);
  assert.equal(balance(s, fund.id), 56000);
  assert.equal(assets(s).netMinor, net - 2000);
  s = run(s, { type: "entry.delete", id: e.id, expectedVersion: 2 }).state;
  assert.equal(balance(s, bank.id), 100000);
  assert.equal(balance(s, fund.id), 50000);
  assert.throws(() =>
    run(s, {
      type: "entry.create",
      entry: entry(bank.id, "transfer", 1, { toAccountId: bank.id }),
    }),
  );
});
test("opening values, overpaid card and reconciliation are not income", () => {
  let s = fixture();
  const card = s.accounts[1];
  s = run(s, {
    type: "reconcile",
    accountId: card.id,
    actualMinor: 3000,
    occurredAt: "2026-03-10T00:00:00",
    note: "",
  }).state;
  assert.equal(assets(s).debtMinor, 0);
  assert.equal(assets(s).assetMinor, 153000);
  assert.equal(report(s, "2026-03").incomeMinor, 0);
  s = run(s, {
    type: "entry.create",
    entry: entry(card.id, "expense", 1000, {
      occurredAt: "2026-03-02T00:00:00",
    }),
  }).state;
  assert.equal(
    balance(s, card.id),
    3000,
    "backdating before anchor does not rewrite actual balance",
  );
  s = run(s, {
    type: "entry.create",
    entry: entry(card.id, "expense", 500, {
      occurredAt: "2026-03-11T00:00:00",
    }),
  }).state;
  assert.equal(balance(s, card.id), 2500);
  s = run(s, {
    type: "reconciliation.delete",
    id: s.reconciliations[0].id,
    expectedVersion: 1,
  }).state;
  assert.equal(balance(s, card.id), -11500);
});
test("partial cross-month refunds reduce refund-month expense and cannot exceed purchase", () => {
  let s = fixture();
  const bank = s.accounts[0];
  let purchase = run(s, {
    type: "entry.create",
    entry: entry(bank.id, "expense", 5000, {
      occurredAt: "2026-02-28T12:00:00",
      labelId: s.labels[0].id,
    }),
  });
  s = purchase.state;
  s = run(s, {
    type: "entry.create",
    entry: entry(bank.id, "refund", 1200, { originalId: purchase.resultId }),
  }).state;
  assert.equal(report(s, "2026-02").expenseMinor, 5000);
  assert.equal(report(s, "2026-03").expenseMinor, -1200);
  assert.equal(report(s, "2026-03").incomeMinor, 0);
  assert.throws(() =>
    run(s, {
      type: "entry.create",
      entry: entry(bank.id, "refund", 4000, { originalId: purchase.resultId }),
    }),
  );
  assert.throws(() =>
    run(s, {
      type: "entry.delete",
      id: purchase.resultId!,
      expectedVersion: 1,
    }),
  );
  s = run(s, {
    type: "label.delete",
    id: s.labels[0].id,
    expectedVersion: 1,
  }).state;
  assert.equal(report(s, "2026-03").byLabel.unlabelled, -1200);
  assert.equal(s.entries[0].version, 2);
});
test("retry idempotency and stale record versions", () => {
  const s = fixture();
  const command: Command = {
    type: "entry.create",
    entry: entry(s.accounts[0].id, "income", 1000),
  };
  const first = run(s, command, "retry-op");
  const retry = run(first.state, command, "retry-op");
  assert.equal(retry.replayed, true);
  assert.equal(retry.state.entries.length, 1);
  assert.equal(retry.resultId, first.resultId);
  assert.throws(() =>
    run(
      first.state,
      { type: "entry.create", entry: entry(s.accounts[0].id, "income", 2000) },
      "retry-op",
    ),
  );
  assert.throws(() =>
    run(first.state, {
      type: "entry.delete",
      id: first.resultId!,
      expectedVersion: 3,
    }),
  );
});
test("backup roundtrip validates refs, IDs, integers, versions and calendar dates", () => {
  const s = fixture();
  assert.deepEqual(parseBackup(exportBackup(s)).ledger, s);
  for (const modify of [
    (x: Ledger) => {
      x.formatVersion = 2 as 1;
    },
    (x: Ledger) => {
      x.accounts.push({ ...x.accounts[0] });
    },
    (x: Ledger) => {
      x.accounts[0].openingMinor = 0.1;
    },
    (x: Ledger) => {
      x.accounts[0].openedAt = "2026-02-30T00:00:00";
    },
    (x: Ledger) => {
      x.defaultAccountId = "missing";
    },
  ]) {
    const copy = JSON.parse(JSON.stringify(s));
    modify(copy);
    assert.throws(() => validateLedger(copy));
  }
  assert.throws(() => parseBackup("{"));
  assert.throws(() =>
    parseBackup('{"kind":"ledger-backup","formatVersion":99}'),
  );
});
