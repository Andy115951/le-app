import { test } from "node:test";
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { createInterface } from "node:readline";
import { fileURLToPath } from "node:url";
import { randomUUID } from "node:crypto";
import { openNodeLedger } from "../../../packages/storage/src/node";
import { exportBackup, nowInLedger } from "@ledger/core";
import { LanPeer, pairCode, decode64 } from "../../client/src/lan-protocol";
import { lanCrypto } from "../../client/src/lan-crypto.web";
const ctx = () => ({
  operationId: randomUUID(),
  source: "ui" as const,
  now: nowInLedger(),
  newId: randomUUID,
});
test(
  "real Rust HTTP host and TS peer: both overwrite directions, backups, rejection, conflicts, replay and closure",
  { timeout: 60_000 },
  async () => {
    const child = spawn(
      fileURLToPath(
        new URL(
          "../src-tauri/target/debug/examples/lan-test-host",
          import.meta.url,
        ),
      ),
      [],
      { stdio: ["pipe", "pipe", "pipe"] },
    );
    const lines = createInterface({ input: child.stdout });
    const iterator = lines[Symbol.asyncIterator]();
    const command = async (value: object) => {
      child.stdin.write(JSON.stringify(value) + "\n");
      const line = await iterator.next();
      assert.equal(line.done, false, "host must answer");
      const r = JSON.parse(line.value!);
      assert.equal(r.ok, true, r.error);
      return r.data;
    };
    const desktop = await openNodeLedger(":memory:");
    const phone = await openNodeLedger(":memory:");
    try {
      for (const [repo, name, amount] of [
        [desktop, "Synthetic desktop", 120000],
        [phone, "Synthetic phone", 340000],
      ] as const) {
        const s = await repo.snapshot();
        await repo.run(
          {
            type: "account.create",
            name,
            kind: "cash",
            openingMinor: amount,
            openedAt: "2026-01-01T00:00:00",
          },
          ctx(),
          { token: s.token },
        );
      }
      const desktopInitial = await desktop.snapshot();
      const phoneInitial = await phone.snapshot();
      let info = await command({
        action: "start",
        backup: exportBackup(desktopInitial.ledger),
      });
      const peer = new LanPeer(
        pairCode({ host: "127.0.0.1", ...info }),
        lanCrypto,
      );
      assert.equal((await peer.request("inspect")).summary?.accounts, 1);
      // A second valid client cannot take over this connection.
      await assert.rejects(() =>
        new LanPeer(
          pairCode({ host: "127.0.0.1", ...info }),
          lanCrypto,
        ).request("inspect"),
      );
      const transferId = randomUUID();
      const incoming = exportBackup(phoneInitial.ledger);
      await peer.request("upload", { backup: incoming, transferId });
      await peer.request("upload", { backup: incoming, transferId });
      assert.equal(
        (await desktop.snapshot()).token,
        desktopInitial.token,
        "transport alone cannot mutate a ledger",
      );
      const status = await command({ action: "status" });
      assert.equal(status.incoming, incoming);
      await desktop.restore(status.incoming, desktopInitial.token, ctx());
      await command({ action: "complete", id: transferId, success: true });
      await command({ action: "complete", id: transferId, success: true });
      assert.equal((await peer.request("status")).state, "applied");
      await peer.request("upload", { backup: incoming, transferId });
      assert.equal(
        (await desktop.backups()).length,
        1,
        "retried transport and acknowledgement never restore again",
      );
      assert.equal(
        JSON.parse(await desktop.readBackup((await desktop.backups())[0].id))
          .ledger.accounts[0].name,
        "Synthetic desktop",
      );
      await assert.rejects(() =>
        peer.request("download", { transferId: randomUUID() }),
      );
      await command({ action: "stop" });
      await assert.rejects(() => peer.request("status"));
      // Download preserves the receiving phone until explicit restore, and keeps its original backup.
      info = await command({
        action: "start",
        backup: exportBackup(desktopInitial.ledger),
      });
      const reader = new LanPeer(
        pairCode({ host: "127.0.0.1", ...info }),
        lanCrypto,
      );
      await reader.request("inspect");
      const downloadId = randomUUID();
      const downloaded = await reader.request("download", {
        transferId: downloadId,
      });
      assert.equal((await phone.snapshot()).token, phoneInitial.token);
      await phone.restore(downloaded.backup!, phoneInitial.token, ctx());
      await reader.request("finish", { transferId: downloadId, success: true });
      await reader.request("finish", { transferId: downloadId, success: true });
      assert.equal((await phone.backups()).length, 1);
      assert.equal(
        (await phone.snapshot()).ledger.accounts[0].name,
        "Synthetic desktop",
      );
      assert.equal(
        JSON.parse(await phone.readBackup((await phone.backups())[0].id)).ledger
          .accounts[0].name,
        "Synthetic phone",
      );
      await command({ action: "stop" });
      // Rejection, stale destination token, malformed data and replay protection.
      info = await command({
        action: "start",
        backup: exportBackup(desktopInitial.ledger),
      });
      const code = pairCode({ host: "127.0.0.1", ...info });
      let captured = "";
      const recording = (async (url: any, options: any) => {
        captured = options.body;
        return fetch(url, options);
      }) as typeof fetch;
      const sender = new LanPeer(code, lanCrypto, recording);
      await sender.request("inspect");
      const endpoint = `http://127.0.0.1:${info.port}/v1/exchange`;
      assert.equal(
        (await fetch(endpoint, { method: "POST", body: captured })).status,
        403,
        "replayed nonce rejected",
      );
      assert.equal(
        (await fetch(endpoint, { method: "POST", body: "x".repeat(44) }))
          .status,
        403,
      );
      const bad = await lanCrypto.seal(
        decode64(info.key),
        JSON.stringify({
          requestId: randomUUID(),
          clientId: randomUUID(),
          action: "inspect",
        }),
        "ledger-lan/v1/response",
      );
      assert.equal(
        (await fetch(endpoint, { method: "POST", body: bad })).status,
        403,
        "direction reflection rejected",
      );
      const rejectedId = randomUUID();
      await sender.request("upload", {
        backup: incoming,
        transferId: rejectedId,
      });
      const before = await desktop.snapshot();
      await desktop.run(
        {
          type: "account.rename",
          id: before.ledger.accounts[0].id,
        expectedVersion: before.ledger.accounts[0].version,
          name: "Synthetic changed",
        },
        ctx(),
        { token: before.token },
      );
      const changed = await desktop.snapshot();
      await assert.rejects(
        () => desktop.restore(incoming, before.token, ctx()),
        /账本已变化/,
      );
      assert.equal((await desktop.snapshot()).token, changed.token);
      assert.equal((await desktop.backups()).length, 1);
      await command({ action: "complete", id: rejectedId, success: false });
      assert.equal((await sender.request("status")).state, "rejected");
      await command({ action: "stop" });
    } finally {
      await desktop.close();
      await phone.close();
      child.stdin.end();
      child.kill();
      lines.close();
    }
  },
);
