import * as SQLite from "expo-sqlite";
import { LedgerRepository, type SqlConnection, type SqlDriver } from "./index";
export async function openExpoLedger(
  newId: () => string,
): Promise<LedgerRepository> {
  const db = await SQLite.openDatabaseAsync("ledger.sqlite");
  const wrap = (d: SQLite.SQLiteDatabase): SqlConnection => ({
    exec: (sql) => d.execAsync(sql),
    async run(sql, params = []) {
      await d.runAsync(sql, params);
    },
    all: (sql, params = []) => d.getAllAsync(sql, params),
  });
  const driver: SqlDriver = {
    ...wrap(db),
    async transaction<T>(task: (tx: SqlConnection) => Promise<T>) {
      let result!: T;
      await db.withExclusiveTransactionAsync(async (tx) => {
        // Acquire the write lock before reading so other processes cannot race the snapshot.
        await tx.execAsync(
          "CREATE TABLE IF NOT EXISTS ledger_lock (singleton INTEGER PRIMARY KEY CHECK(singleton=1), value INTEGER NOT NULL); INSERT OR IGNORE INTO ledger_lock VALUES(1,0); UPDATE ledger_lock SET value=0 WHERE singleton=1;",
        );
        result = await task(wrap(tx));
      });
      return result;
    },
    close: () => db.closeAsync(),
  };
  const repo = new LedgerRepository(driver, newId);
  await repo.initialize();
  return repo;
}
