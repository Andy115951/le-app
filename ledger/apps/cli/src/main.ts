#!/usr/bin/env node
import { readFile, writeFile } from "node:fs/promises";
import { randomUUID } from "node:crypto";
import {
  assets,
  exportBackup,
  invariant,
  LedgerError,
  nowInLedger,
  parseBackup,
  report,
  type Command,
} from "@ledger/core";
import { openNodeLedger } from "@ledger/storage/node";
const API_VERSION = 1;
const HELP = {
  usage: "npm run cli -- <command> [options]",
  apiVersion: API_VERSION,
  commands: [
    "accounts",
    "labels",
    "transactions",
    "assets",
    "reports --month YYYY-MM",
    "audit",
    "apply --stdin [--commit]",
    "backup export --out FILE",
    "backup import --file FILE --token TOKEN [--commit]",
    "backup list",
    "backup export-saved --id ID --out FILE",
  ],
  options: [
    "--db PATH (otherwise uses the same OS app-data file as desktop)",
    "--account ID",
    "--label ID",
    "--kind expense|income|transfer|refund",
    "--from YYYY-MM-DD",
    "--to YYYY-MM-DD",
    "--offset N",
    "--limit N (default 50, max 500)",
  ],
  apply:
    "stdin JSON: { token, operationId, command }. Commands use the shared core union, integer CNY minor units, Shanghai wall time YYYY-MM-DDTHH:mm:ss. Every write is a preview unless --commit is supplied. --dry-run always previews.",
  concurrency:
    "Queries return token. Pass it to writes. Update/delete also require expectedVersion. Reuse the same operationId for retries; changed input requires a new operationId.",
  privacy:
    "Output is local but a calling AI may upload it. Query the minimum needed. Backups are plaintext. Do not place a real DB or backup inside the repository.",
};
function output(data: unknown) {
  process.stdout.write(
    JSON.stringify({ apiVersion: API_VERSION, ok: true, data }) + "\n",
  );
}
async function main() {
  const args = process.argv.slice(2);
  const positionals: string[] = [];
  const options = new Map<string, string | boolean>();
  const booleans = new Set(["stdin", "commit", "dry-run", "help"]);
  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (arg.startsWith("--")) {
      const key = arg.slice(2);
      if (booleans.has(key)) options.set(key, true);
      else {
        invariant(
          args[i + 1] && !args[i + 1].startsWith("--"),
          `--${key} 需要参数`,
        );
        options.set(key, args[++i]);
      }
    } else positionals.push(arg);
  }
  const option = (name: string) =>
    typeof options.get(name) === "string"
      ? (options.get(name) as string)
      : undefined;
  const [group, action] = positionals;
  if (!group || group === "help" || options.has("help")) {
    output(HELP);
    return;
  }
  if (group === "version") {
    output({
      version: "0.1.0",
      apiVersion: API_VERSION,
      backupVersion: 1,
      databaseVersion: 1,
    });
    return;
  }
  invariant(
    [
      "accounts",
      "labels",
      "transactions",
      "assets",
      "reports",
      "audit",
      "apply",
      "backup",
    ].includes(group),
    "未知命令",
  );
  const repo = await openNodeLedger(option("db"));
  try {
    const snapshot = await repo.snapshot();
    const { ledger, token } = snapshot;
    const commit = options.has("commit") && !options.has("dry-run");
    const context = {
      operationId: randomUUID(),
      source: "cli" as const,
      now: nowInLedger(),
      newId: randomUUID,
    };
    if (group === "apply") {
      invariant(options.has("stdin"), "写入需要 --stdin");
      let input = "";
      for await (const chunk of process.stdin) {
        input += chunk;
        invariant(input.length <= 100_000, "请求过大");
      }
      let request: { command: Command; token: string; operationId: string };
      try {
        request = JSON.parse(input);
      } catch {
        throw new LedgerError("INVALID_INPUT", "标准输入不是有效 JSON");
      }
      invariant(
        request &&
          typeof request.token === "string" &&
          typeof request.operationId === "string" &&
          request.command,
        "需要 token、operationId 和 command",
      );
      const result = await repo.run(
        request.command,
        { ...context, operationId: request.operationId },
        { token: request.token, dryRun: !commit },
      );
      output({
        committed: commit,
        baseToken: token,
        token: commit ? result.token : token,
        resultId: result.resultId,
        replayed: result.replayed,
        revision: result.ledger.revision,
        preview: assets(result.ledger),
      });
      return;
    }
    if (group === "backup") {
      if (action === "export" || action === "export-saved") {
        const path = option("out");
        invariant(path, "导出需要 --out FILE");
        const json =
          action === "export"
            ? exportBackup(ledger)
            : await repo.readBackup(option("id") || "");
        await writeFile(path, json, {
          encoding: "utf8",
          mode: 0o600,
          flag: "wx",
        });
        output({ exported: true, token });
        return;
      }
      if (action === "list") {
        output({ token, backups: await repo.backups() });
        return;
      }
      invariant(action === "import", "未知备份命令");
      const path = option("file");
      invariant(path && option("token"), "导入需要 --file 和 --token");
      const { stat } = await import("node:fs/promises");
      invariant((await stat(path)).size <= 20_000_000, "文件不能超过 20 MB");
      const json = await readFile(path, "utf8");
      const b = parseBackup(json);
      const result = await repo.restore(
        json,
        option("token")!,
        context,
        !commit,
      );
      output({
        committed: commit,
        token: result.token,
        backupId: result.backupId,
        name: b.ledger.name,
        accounts: b.ledger.accounts.length,
        entries: b.ledger.entries.length,
        exportedAt: b.exportedAt,
      });
      return;
    }
    if (group === "accounts") {
      output({ token, accounts: assets(ledger).accounts });
      return;
    }
    if (group === "labels") {
      output({ token, labels: ledger.labels });
      return;
    }
    if (group === "assets") {
      output({ token, ...assets(ledger) });
      return;
    }
    if (group === "reports") {
      output({
        token,
        ...report(ledger, option("month") || nowInLedger().slice(0, 7)),
      });
      return;
    }
    const offset = Number(option("offset") || 0);
    const limit = Number(option("limit") || 50);
    invariant(
      Number.isSafeInteger(offset) &&
        offset >= 0 &&
        Number.isSafeInteger(limit) &&
        limit > 0 &&
        limit <= 500,
      "分页参数无效",
    );
    if (group === "audit") {
      const rows = [...ledger.audit].reverse();
      output({
        token,
        total: rows.length,
        offset,
        limit,
        audit: rows.slice(offset, offset + limit),
      });
      return;
    }
    for (const key of ["from", "to"])
      if (option(key))
        invariant(
          /^\d{4}-\d{2}-\d{2}$/.test(option(key)!),
          `--${key} 格式应为 YYYY-MM-DD`,
        );
    const rows = ledger.entries
      .filter(
        (e) =>
          (!option("account") ||
            e.accountId === option("account") ||
            e.toAccountId === option("account")) &&
          (!option("label") || e.labelId === option("label")) &&
          (!option("kind") || e.kind === option("kind")) &&
          (!option("from") || e.occurredAt.slice(0, 10) >= option("from")!) &&
          (!option("to") || e.occurredAt.slice(0, 10) <= option("to")!),
      )
      .sort(
        (a, b) =>
          b.occurredAt.localeCompare(a.occurredAt) || b.id.localeCompare(a.id),
      );
    output({
      token,
      total: rows.length,
      offset,
      limit,
      entries: rows.slice(offset, offset + limit),
    });
  } finally {
    await repo.close();
  }
}
main().catch((error) => {
  const known = error instanceof LedgerError;
  process.stderr.write(
    JSON.stringify({
      apiVersion: API_VERSION,
      ok: false,
      error: {
        code: known ? error.code : "IO_ERROR",
        message: known
          ? error.message
          : "无法完成操作，请检查输入或本地文件权限",
      },
    }) + "\n",
  );
  process.exitCode = known && error.code === "CONFLICT" ? 3 : 1;
});
