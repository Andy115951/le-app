import { invoke } from "@tauri-apps/api/core";
import {
  LedgerRepository,
  type SqlConnection,
  type SqlDriver,
  type Param,
} from "./index";
export async function openTauriLedger(
  newId: () => string,
): Promise<LedgerRepository> {
  const connection: SqlConnection = {
    exec: (sql) => invoke<void>("db_exec", { sql }),
    run: (sql, params: Param[] = []) => invoke<void>("db_run", { sql, params }),
    all: <T>(sql: string, params: Param[] = []) =>
      invoke<T[]>("db_all", { sql, params }),
  };
  const driver: SqlDriver = {
    ...connection,
    async transaction<T>(task: (tx: SqlConnection) => Promise<T>) {
      await connection.exec("BEGIN IMMEDIATE");
      try {
        const result = await task(connection);
        await connection.exec("COMMIT");
        return result;
      } catch (e) {
        await connection.exec("ROLLBACK");
        throw e;
      }
    },
    async close() {
      /* Rust owns the process-lifetime connection. */
    },
  };
  const repo = new LedgerRepository(driver, newId);
  await repo.initialize();
  return repo;
}
