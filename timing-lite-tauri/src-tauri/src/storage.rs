use rusqlite::Connection;

const RECLAIM_THRESHOLD_BYTES: i64 = 4 * 1024 * 1024;
const PRUNE_BATCH_SIZE: i64 = 512;

fn page_bytes(conn: &Connection) -> Result<(i64, i64), String> {
  let pages: i64 = conn.query_row("pragma page_count", [], |row| row.get(0))
    .map_err(|e| format!("read database page count failed: {e}"))?;
  let free: i64 = conn.query_row("pragma freelist_count", [], |row| row.get(0))
    .map_err(|e| format!("read free database pages failed: {e}"))?;
  let size: i64 = conn.query_row("pragma page_size", [], |row| row.get(0))
    .map_err(|e| format!("read database page size failed: {e}"))?;
  Ok(((pages - free) * size, free * size))
}

pub(super) fn enforce_budget(conn: &mut Connection, budget_bytes: i64) -> Result<(), String> {
  let (used, free) = page_bytes(conn)?;
  if used <= budget_bytes {
    // Also compact old files that are physically over budget but mostly empty.
    if used + free > budget_bytes {
      reclaim_space(conn, true)?;
    }
    return Ok(());
  }

  // Leave headroom to avoid deleting and compacting on every capture tick.
  let target_bytes = budget_bytes * 9 / 10;
  let tx = conn.transaction().map_err(|e| format!("start storage cleanup failed: {e}"))?;
  while page_bytes(&tx)?.0 > target_bytes {
    let archives = tx.execute(
      "delete from activity_archive_daily where id in (
         select id from activity_archive_daily order by archive_day asc, id asc limit ?1
       )",
      [PRUNE_BATCH_SIZE],
    ).map_err(|e| format!("prune oldest archives failed: {e}"))?;
    if archives > 0 {
      continue;
    }
    let entries = tx.execute(
      "delete from activity_entries where id in (
         select id from activity_entries where ended_at is not null
         order by started_at asc, id asc limit ?1
       )",
      [PRUNE_BATCH_SIZE],
    ).map_err(|e| format!("prune oldest entries failed: {e}"))?;
    if entries == 0 {
      return Err("database exceeds its storage budget; rules and running activities were preserved".to_string());
    }
  }
  tx.commit().map_err(|e| format!("commit storage cleanup failed: {e}"))?;
  reclaim_space(conn, true)
}

pub(super) fn reclaim_space(conn: &Connection, force: bool) -> Result<(), String> {
  let (_, free) = page_bytes(conn)?;
  if free == 0 || (!force && free < RECLAIM_THRESHOLD_BYTES) {
    return Ok(());
  }
  // DELETE alone only makes pages reusable; VACUUM returns those pages to the OS.
  // It runs after the cleanup transaction, never during normal reads/writes.
  conn.execute_batch("vacuum")
    .map_err(|e| format!("reclaim database space failed: {e}"))?;
  // WAL can temporarily exceed the budget while readers hold a snapshot. A busy
  // checkpoint is safe: SQLite retries through its normal checkpoint mechanism.
  conn.query_row("pragma wal_checkpoint(truncate)", [], |row| row.get::<_, i64>(0))
    .map_err(|e| format!("checkpoint compacted database failed: {e}"))?;
  Ok(())
}
