import {
  emptyLedger,
  execute,
  exportBackup,
  invariant,
  LedgerError,
  parseBackup,
  validateLedger,
  type Command,
  type Context,
  type Ledger,
} from "@ledger/core";
export type Param = string | number | null;
export interface SqlConnection {
  exec(sql: string): Promise<void>;
  run(sql: string, params?: Param[]): Promise<void>;
  all<T>(sql: string, params?: Param[]): Promise<T[]>;
}
export interface SqlDriver extends SqlConnection {
  transaction<T>(task: (tx: SqlConnection) => Promise<T>): Promise<T>;
  close(): Promise<void>;
}
export interface Snapshot {
  ledger: Ledger;
  token: string;
}
const collections = [
  "accounts",
  "labels",
  "entries",
  "reconciliations",
  "audit",
  "receipts",
] as const;
const schema = `
CREATE TABLE IF NOT EXISTS ledger_meta (singleton INTEGER PRIMARY KEY CHECK(singleton=1), payload TEXT NOT NULL, epoch TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS ledger_records (collection TEXT NOT NULL, id TEXT NOT NULL, payload TEXT NOT NULL, PRIMARY KEY(collection,id));
CREATE TABLE IF NOT EXISTS ledger_backups (id TEXT PRIMARY KEY, created_at TEXT NOT NULL, payload TEXT NOT NULL);
`;
/** Typed JSON records in SQLite, atomic writes under the same database lock on every platform.
 * Schema v1 deliberately loads a full ledger: suitable for a personal ledger, not unlimited data.
 */
export class LedgerRepository {
  private queue: Promise<unknown> = Promise.resolve();
  constructor(
    private driver: SqlDriver,
    private newId: () => string,
  ) {}
  private serial<T>(fn: () => Promise<T>): Promise<T> {
    const task = this.queue.then(fn).catch((error) => {
      if (/locked|busy/i.test(String(error)))
        throw new LedgerError("BUSY", "账本正被其他操作使用，请稍后重试");
      throw error;
    });
    this.queue = task.catch(() => {});
    return task;
  }
  async initialize(): Promise<void> {
    await this.serial(async () => {
      const rows = await this.driver.all<{ user_version: number }>(
        "PRAGMA user_version",
      );
      invariant(
        rows[0]?.user_version === 0 || rows[0]?.user_version === 1,
        "数据库版本比应用新",
        "UNSUPPORTED_VERSION",
      );
      await this.driver.exec(
        "PRAGMA journal_mode=WAL; PRAGMA busy_timeout=3000;",
      );
      await this.driver.transaction(async (tx) => {
        await tx.exec(schema);
        const meta = await tx.all("SELECT singleton FROM ledger_meta");
        if (!meta.length)
          await this.write(tx, emptyLedger(this.newId), this.newId());
        await tx.exec("PRAGMA user_version=1;");
      });
    });
  }
  private async load(tx: SqlConnection): Promise<Snapshot> {
    const [row] = await tx.all<{ payload: string; epoch: string }>(
      "SELECT payload,epoch FROM ledger_meta WHERE singleton=1",
    );
    invariant(row, "账本尚未初始化");
    const ledger = JSON.parse(row.payload) as Ledger;
    for (const key of collections) (ledger[key] as unknown[]) = [];
    for (const r of await tx.all<{
      collection: (typeof collections)[number];
      payload: string;
    }>("SELECT collection,payload FROM ledger_records ORDER BY rowid")) {
      invariant(collections.includes(r.collection), "数据库记录类型无效");
      (ledger[r.collection] as unknown[]).push(JSON.parse(r.payload));
    }
    validateLedger(ledger);
    return { ledger, token: `${row.epoch}:${ledger.revision}` };
  }
  private async write(
    tx: SqlConnection,
    ledger: Ledger,
    epoch: string,
  ): Promise<void> {
    const meta = { ...ledger } as Record<string, unknown>;
    for (const key of collections) delete meta[key];
    await tx.run(
      "INSERT INTO ledger_meta(singleton,payload,epoch) VALUES(1,?,?) ON CONFLICT(singleton) DO UPDATE SET payload=excluded.payload,epoch=excluded.epoch",
      [JSON.stringify(meta), epoch],
    );
    // Diff each collection; unchanged rows do not incur writes.
    const old = new Map(
      (
        await tx.all<{ collection: string; id: string; payload: string }>(
          "SELECT collection,id,payload FROM ledger_records",
        )
      ).map((r) => [r.collection + ":" + r.id, r]),
    );
    for (const key of collections)
      for (const item of ledger[key]) {
        const recordId =
          "id" in item
            ? item.id
            : "operationId" in item
              ? item.operationId
              : String(item.revision);
        const payload = JSON.stringify(item);
        const composite = key + ":" + recordId;
        if (old.get(composite)?.payload !== payload)
          await tx.run(
            "INSERT INTO ledger_records(collection,id,payload) VALUES(?,?,?) ON CONFLICT(collection,id) DO UPDATE SET payload=excluded.payload",
            [key, recordId, payload],
          );
        old.delete(composite);
      }
    for (const r of old.values())
      await tx.run("DELETE FROM ledger_records WHERE collection=? AND id=?", [
        r.collection,
        r.id,
      ]);
  }
  snapshot(): Promise<Snapshot> {
    return this.serial(() => this.driver.transaction((tx) => this.load(tx)));
  }
  run(
    command: Command,
    ctx: Context,
    options: { token: string; dryRun?: boolean },
  ): Promise<Snapshot & { resultId?: string; replayed: boolean }> {
    return this.serial(() =>
      this.driver.transaction(async (tx) => {
        const current = await this.load(tx);
        // Check receipts first so a network/tool retry can use its original token.
        const receipt = current.ledger.receipts.find(
          (r) => r.operationId === ctx.operationId,
        );
        invariant(
          receipt || options.token === current.token,
          "账本已发生变化，请刷新后重试",
          "CONFLICT",
        );
        const result = execute(current.ledger, command, ctx);
        const epoch = current.token.split(":")[0];
        if (!options.dryRun && !result.replayed)
          await this.write(tx, result.state, epoch);
        return {
          ledger: result.state,
          token: `${epoch}:${result.state.revision}`,
          resultId: result.resultId,
          replayed: result.replayed,
        };
      }),
    );
  }
  async restore(
    json: string,
    expectedToken: string,
    ctx: Context,
    dryRun = false,
  ): Promise<Snapshot & { backupId?: string }> {
    const backup = parseBackup(json);
    return this.serial(() =>
      this.driver.transaction(async (tx) => {
        const current = await this.load(tx);
        invariant(
          current.token === expectedToken,
          "账本已变化，请重新预览导入",
          "CONFLICT",
        );
        if (dryRun) return { ledger: backup.ledger, token: current.token };
        const backupId = this.newId();
        await tx.run(
          "INSERT INTO ledger_backups(id,created_at,payload) VALUES(?,?,?)",
          [backupId, ctx.now, exportBackup(current.ledger, ctx.now)],
        );
        const restored: Ledger = JSON.parse(JSON.stringify(backup.ledger));
        restored.revision++;
        restored.audit.push({
          revision: restored.revision,
          at: ctx.now,
          source: ctx.source,
          action: "backup.restore",
        });
        validateLedger(restored);
        const epoch = this.newId();
        await this.write(tx, restored, epoch);
        return {
          ledger: restored,
          token: `${epoch}:${restored.revision}`,
          backupId,
        };
      }),
    );
  }
  backups(): Promise<{ id: string; created_at: string }[]> {
    return this.serial(() =>
      this.driver.all(
        "SELECT id,created_at FROM ledger_backups ORDER BY created_at DESC",
      ),
    );
  }
  readBackup(id: string): Promise<string> {
    return this.serial(async () => {
      const [r] = await this.driver.all<{ payload: string }>(
        "SELECT payload FROM ledger_backups WHERE id=?",
        [id],
      );
      invariant(r, "备份不存在", "NOT_FOUND");
      return r.payload;
    });
  }
  close(): Promise<void> {
    return this.serial(() => this.driver.close());
  }
}
