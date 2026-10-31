import { DatabaseSync } from "node:sqlite";
import { mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { homedir } from "node:os";
import { randomUUID } from "node:crypto";
import {
  LedgerRepository,
  type SqlConnection,
  type SqlDriver,
  type Param,
} from "./index";
export function defaultDatabasePath(): string {
  const dir =
    process.platform === "win32"
      ? join(
          process.env.APPDATA || join(homedir(), "AppData", "Roaming"),
          "app.local.ledger",
        )
      : process.platform === "darwin"
        ? join(homedir(), "Library", "Application Support", "app.local.ledger")
        : join(
            process.env.XDG_DATA_HOME || join(homedir(), ".local", "share"),
            "app.local.ledger",
          );
  return join(dir, "ledger.sqlite");
}
export function nodeDriver(path: string): SqlDriver {
  if (path !== ":memory:")
    mkdirSync(dirname(path), { recursive: true, mode: 0o700 });
  const db = new DatabaseSync(path);
  db.exec("PRAGMA busy_timeout=3000;");
  const connection: SqlConnection = {
    async exec(sql) {
      db.exec(sql);
    },
    async run(sql, params: Param[] = []) {
      db.prepare(sql).run(...params);
    },
    async all<T>(sql: string, params: Param[] = []) {
      return db.prepare(sql).all(...params) as T[];
    },
  };
  return {
    ...connection,
    async transaction<T>(task: (tx: SqlConnection) => Promise<T>) {
      db.exec("BEGIN IMMEDIATE");
      try {
        const result = await task(connection);
        db.exec("COMMIT");
        return result;
      } catch (e) {
        db.exec("ROLLBACK");
        throw e;
      }
    },
    async close() {
      db.close();
    },
  };
}
export async function openNodeLedger(
  path = defaultDatabasePath(),
): Promise<LedgerRepository> {
  const repo = new LedgerRepository(nodeDriver(path), randomUUID);
  try {
    await repo.initialize();
    return repo;
  } catch (e) {
    await repo.close();
    throw e;
  }
}
