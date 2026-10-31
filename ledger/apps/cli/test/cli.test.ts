import { test } from "node:test";
import assert from "node:assert/strict";
import { spawn, spawnSync } from "node:child_process";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
test("CLI JSON protocol previews writes, requires commit and replays safely", () => {
  const dir = mkdtempSync(join(tmpdir(), "ledger-cli-synthetic-"));
  const db = join(dir, "test.sqlite");
  function cli(args: string[], input?: unknown) {
    const r = spawnSync(
      process.execPath,
      [
        "--disable-warning=ExperimentalWarning",
        "--import",
        "tsx",
        resolve("apps/cli/src/main.ts"),
        ...args,
        "--db",
        db,
      ],
      { encoding: "utf8", input: input ? JSON.stringify(input) : undefined },
    );
    return { status: r.status, body: JSON.parse(r.stdout || r.stderr) };
  }
  try {
    const first = cli(["accounts"]).body.data;
    const request = {
      token: first.token,
      operationId: "synthetic-operation",
      command: {
        type: "account.create",
        name: "Synthetic bank",
        kind: "cash",
        openingMinor: 12345,
        openedAt: "2026-01-01T00:00:00",
      },
    };
    assert.equal(cli(["apply", "--stdin"], request).body.data.committed, false);
    assert.equal(cli(["accounts"]).body.data.accounts.length, 0);
    assert.equal(cli(["apply", "--stdin", "--commit"], request).status, 0);
    assert.equal(
      cli(["apply", "--stdin", "--commit"], request).body.data.replayed,
      true,
    );
    assert.equal(cli(["assets"]).body.data.netMinor, 12345);
    assert.equal(cli(["accounts"]).body.data.accounts.length, 1);
    assert.equal(
      cli(["apply", "--stdin", "--commit"], {
        ...request,
        operationId: "new-operation",
      }).status,
      3,
    );
    assert.equal(
      cli(["apply", "--stdin", "--commit"], {
        ...request,
        command: { ...request.command, openingMinor: 123.45 },
      }).status,
      1,
    );
    assert.equal(
      cli(["backup", "export", "--out", join(dir, "backup.json")]).status,
      0,
    );
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("two CLI processes racing with the same snapshot commit at most once", async () => {
  const dir = mkdtempSync(join(tmpdir(), "ledger-cli-race-synthetic-"));
  const db = join(dir, "test.sqlite");
  const common = [
    "--disable-warning=ExperimentalWarning",
    "--import",
    "tsx",
    resolve("apps/cli/src/main.ts"),
  ];
  try {
    const initial = spawnSync(
      process.execPath,
      [...common, "accounts", "--db", db],
      { encoding: "utf8" },
    );
    const token = JSON.parse(initial.stdout).data.token;
    const write = (index: number) =>
      new Promise<number | null>((resolveStatus, reject) => {
        const child = spawn(
          process.execPath,
          [...common, "apply", "--stdin", "--commit", "--db", db],
          { stdio: ["pipe", "ignore", "pipe"] },
        );
        child.on("error", reject);
        child.stderr.resume();
        child.on("close", resolveStatus);
        child.stdin.end(
          JSON.stringify({
            token,
            operationId: `synthetic-race-${index}`,
            command: {
              type: "account.create",
              name: `Synthetic bank ${index}`,
              kind: "cash",
              openingMinor: 100,
              openedAt: "2026-01-01T00:00:00",
            },
          }),
        );
      });
    const statuses = await Promise.all([write(1), write(2)]);
    assert.deepEqual(statuses.sort(), [0, 3]);
    const after = spawnSync(
      process.execPath,
      [...common, "accounts", "--db", db],
      { encoding: "utf8" },
    );
    assert.equal(JSON.parse(after.stdout).data.accounts.length, 1);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});
