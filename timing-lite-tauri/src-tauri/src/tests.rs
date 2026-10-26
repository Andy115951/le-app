use super::*;

fn database() -> Connection {
  let mut conn = Connection::open_in_memory().unwrap();
  initialize_database(&mut conn).unwrap();
  conn
}

fn insert_entry(conn: &Connection, start: i64, duration: i64, open: bool) -> i64 {
  let started = DateTime::from_timestamp(start, 0).unwrap().to_rfc3339();
  let last_seen = DateTime::from_timestamp(start + duration, 0).unwrap().to_rfc3339();
  conn.execute(
    "insert into activity_entries
       (app_name, window_title, started_at, ended_at, last_seen_at, duration_seconds)
     values ('TextEdit', 'Notes', ?1, ?2, ?3, ?4)",
    params![started, if open { None } else { Some(&last_seen) }, last_seen, duration],
  ).unwrap();
  conn.last_insert_rowid()
}

fn runtime(enabled: bool) -> SharedState {
  Arc::new(Mutex::new(RuntimeState {
    tracking_enabled: enabled,
    interval_ms: 5000,
    last_active: Some(ActiveWindow {
      app_name: "TextEdit".into(),
      window_title: "Notes".into(),
      bundle_id: None,
      activity_type: None,
      entity_name: None,
      detail: None,
      workspace: None,
      file_name: None,
      domain: None,
      captured_at: Utc::now().to_rfc3339(),
    }),
    last_warning: None,
    allow_window_close: false,
  }))
}

#[test]
fn statistics_include_more_than_one_thousand_entries_and_clip_boundaries() {
  let mut conn = database();
  let start = Utc::now().timestamp() - 10_000;
  let tx = conn.transaction().unwrap();
  for offset in 0..1505 {
    insert_entry(&tx, start + offset * 2, 1, false);
  }
  insert_entry(&tx, start - 10, 20, false); // overlaps the start by 10 seconds
  insert_entry(&tx, start - 20, 20, false); // ends exactly at the start
  insert_entry(&tx, start + 3600, 20, false); // starts exactly at the end
  insert_entry(&tx, start + 5, 0, false);
  tx.commit().unwrap();

  let rows = load_entries_overlapping_range(&conn, start, start + 3600, 15).unwrap();
  assert_eq!(rows.len(), 1506);
  let total: i64 = rows.iter().map(|row| {
    let (from, to) = entry_window_seconds(row).unwrap();
    overlap_seconds(from, to, start, start + 3600)
  }).sum();
  assert_eq!(total, 1515);
}

#[test]
fn context_migration_does_not_repeat_for_valid_null_fields_or_on_restart() {
  let mut conn = database();
  insert_entry(&conn, Utc::now().timestamp() - 60, 10, false);
  conn.execute("delete from app_meta where key = ?1", [META_CONTEXT_VERSION]).unwrap();
  backfill_structured_context_once(&mut conn).unwrap();
  let (entity, domain): (Option<String>, Option<String>) = conn.query_row(
    "select entity_name, domain from activity_entries", [], |row| Ok((row.get(0)?, row.get(1)?)),
  ).unwrap();
  assert!(entity.is_some());
  assert!(domain.is_none());
  conn.execute_batch(
    "create trigger reject_repeated_backfill before update on activity_entries
     begin select raise(abort, 'unexpected repeated backfill'); end;",
  ).unwrap();

  // Simulate two subsequent process starts, bypassing the in-process guard.
  initialize_database(&mut conn).unwrap();
  initialize_database(&mut conn).unwrap();
  assert_eq!(get_app_meta(&conn, META_CONTEXT_VERSION).unwrap().as_deref(), Some(CONTEXT_VERSION));
}

#[test]
fn failed_context_migration_rolls_back_and_can_retry() {
  let mut conn = database();
  let start = Utc::now().timestamp() - 60;
  insert_entry(&conn, start, 10, false);
  let second = insert_entry(&conn, start + 10, 10, false);
  conn.execute("delete from app_meta where key = ?1", [META_CONTEXT_VERSION]).unwrap();
  conn.execute_batch(&format!(
    "create trigger fail_context before update on activity_entries when old.id = {second}
     begin select raise(abort, 'simulated failure'); end;"
  )).unwrap();
  assert!(backfill_structured_context_once(&mut conn).is_err());
  assert!(get_app_meta(&conn, META_CONTEXT_VERSION).unwrap().is_none());
  let enriched: i64 = conn.query_row(
    "select count(*) from activity_entries where entity_name is not null", [], |row| row.get(0),
  ).unwrap();
  assert_eq!(enriched, 0);
  conn.execute_batch("drop trigger fail_context").unwrap();
  backfill_structured_context_once(&mut conn).unwrap();
  assert_eq!(get_app_meta(&conn, META_CONTEXT_VERSION).unwrap().as_deref(), Some(CONTEXT_VERSION));
}

#[test]
fn pause_closes_current_segment_and_resume_excludes_short_pause() {
  let conn = database();
  let start = Utc::now().timestamp() - 60;
  let id = insert_entry(&conn, start, 10, true);
  let state = runtime(true);
  let paused_at = DateTime::from_timestamp(start + 12, 0).unwrap().to_rfc3339();
  let paused = update_tracking_state(&state, &conn, false, &paused_at).unwrap();
  assert!(!paused.tracking_enabled);
  assert!(paused.last_active.is_none());
  let (ended_at, duration): (String, i64) = conn.query_row(
    "select ended_at, duration_seconds from activity_entries where id = ?1", [id],
    |row| Ok((row.get(0)?, row.get(1)?)),
  ).unwrap();
  assert_eq!(ended_at, paused_at);
  assert_eq!(duration, 12);

  let resumed_at = DateTime::from_timestamp(start + 14, 0).unwrap().to_rfc3339();
  assert!(update_tracking_state(&state, &conn, true, &resumed_at).unwrap().tracking_enabled);
  insert_entry(&conn, start + 14, 2, false);
  let gap = load_entries_overlapping_range(&conn, start + 12, start + 14, 15).unwrap();
  assert!(gap.is_empty(), "the two paused seconds must not belong to either segment");
}

#[test]
fn pausing_a_stale_segment_does_not_add_sleep_time() {
  let conn = database();
  let start = Utc::now().timestamp() - 7200;
  insert_entry(&conn, start, 10, true);
  let now = DateTime::from_timestamp(start + 3600, 0).unwrap().to_rfc3339();
  update_tracking_state(&runtime(true), &conn, false, &now).unwrap();
  let duration: i64 = conn.query_row("select duration_seconds from activity_entries", [], |row| row.get(0)).unwrap();
  assert_eq!(duration, 10);
}

#[test]
fn manual_capture_while_paused_does_not_read_the_window_or_open_database() {
  let result = capture_once(&runtime(false)).unwrap();
  assert!(result.active.is_none());
  assert!(result.warning.is_none());
}

#[test]
fn statistics_range_rejects_reversed_oversized_and_overflowing_ranges() {
  assert!(validate_statistics_range(0, 7 * 86400).is_ok());
  assert!(validate_statistics_range(0, 0).is_err());
  assert!(validate_statistics_range(10, 0).is_err());
  assert!(validate_statistics_range(0, 32 * 86400).is_err());
  assert!(validate_statistics_range(i64::MIN, i64::MAX).is_err());
}

fn insert_archive(conn: &Connection, day: &str, name: &str) {
  conn.execute(
    "insert into activity_archive_daily
       (archive_day, app_name, entity_name, total_duration_seconds, segment_count, archived_at)
     values (?1, 'TextEdit', ?2, 10, 1, ?3)",
    params![day, name, Utc::now().to_rfc3339()],
  ).unwrap();
}

#[test]
fn retention_expires_year_old_archives_and_only_archives_finished_month_old_entries() {
  let mut conn = database();
  let now = Utc::now();
  let raw_start = (now - chrono::Duration::days(31)).timestamp();
  insert_entry(&conn, raw_start, 10, false);
  insert_entry(&conn, (now - chrono::Duration::days(400)).timestamp(), 10, false);
  let recent_id = insert_entry(&conn, (now - chrono::Duration::days(29)).timestamp(), 10, false);
  let running_id = insert_entry(&conn, raw_start, 10, true);
  let archive_boundary = (now - chrono::Duration::days(ARCHIVE_RETENTION_DAYS))
    .format("%Y-%m-%d").to_string();
  let expired_day = (now - chrono::Duration::days(ARCHIVE_RETENTION_DAYS + 1))
    .format("%Y-%m-%d").to_string();
  insert_archive(&conn, &archive_boundary, "Boundary archive");
  insert_archive(&conn, &expired_day, "Expired archive");
  // A policy upgrade must not be skipped because the previous policy ran today.
  set_app_meta(&conn, "retention_last_run_day", &now.format("%Y-%m-%d").to_string()).unwrap();
  conn.execute("delete from app_meta where key = ?1", [META_RETENTION_LAST_RUN_DAY]).unwrap();
  run_retention_maintenance_at(&mut conn, now).unwrap();

  let remaining: Vec<i64> = conn.prepare("select id from activity_entries order by id").unwrap()
    .query_map([], |row| row.get(0)).unwrap().map(Result::unwrap).collect();
  assert_eq!(remaining, vec![recent_id, running_id]);
  let (groups, seconds): (i64, i64) = conn.query_row(
    "select count(*), sum(total_duration_seconds) from activity_archive_daily", [],
    |row| Ok((row.get(0)?, row.get(1)?)),
  ).unwrap();
  assert_eq!((groups, seconds), (2, 20));
  run_retention_maintenance_at(&mut conn, now).unwrap();
  let groups_after_retry: i64 = conn.query_row(
    "select count(*) from activity_archive_daily", [], |row| row.get(0),
  ).unwrap();
  assert_eq!(groups_after_retry, groups);
}

#[test]
fn storage_budget_removes_oldest_archive_groups_before_recent_history() {
  let mut conn = database();
  let start = Utc::now().timestamp() - 60;
  let recent = insert_entry(&conn, start, 10, false);
  let running = insert_entry(&conn, start + 10, 10, true);
  conn.execute(
    "insert into rules (name, created_at) values ('Keep this rule', ?1)",
    [Utc::now().to_rfc3339()],
  ).unwrap();
  let baseline: i64 = conn.query_row("pragma page_count", [], |row| row.get(0)).unwrap();
  let page_size: i64 = conn.query_row("pragma page_size", [], |row| row.get(0)).unwrap();
  let budget = baseline * page_size + 128 * 1024;
  let tx = conn.transaction().unwrap();
  for index in 0..600 {
    insert_archive(&tx, "2025-01-01", &format!("{index}:{}", "a".repeat(2048)));
  }
  insert_archive(&tx, "2026-10-01", "Newer archive survives");
  tx.commit().unwrap();
  storage::enforce_budget(&mut conn, budget).unwrap();

  let oldest_left: i64 = conn.query_row(
    "select count(*) from activity_archive_daily where archive_day = '2025-01-01'", [], |row| row.get(0),
  ).unwrap();
  assert!(oldest_left < 600);
  for id in [recent, running] {
    assert_eq!(conn.query_row("select count(*) from activity_entries where id = ?1", [id], |row| row.get::<_, i64>(0)).unwrap(), 1);
  }
  assert_eq!(conn.query_row("select count(*) from rules", [], |row| row.get::<_, i64>(0)).unwrap(), 1);
  let pages: i64 = conn.query_row("pragma page_count", [], |row| row.get(0)).unwrap();
  assert!(pages * page_size <= budget);
}

#[test]
fn storage_budget_reclaims_real_file_space_and_preserves_running_entry() {
  let path = std::env::temp_dir().join(format!(
    "timing-lite-storage-{}-{}.db", std::process::id(), Utc::now().timestamp_nanos_opt().unwrap()
  ));
  let mut conn = Connection::open(&path).unwrap();
  conn.pragma_update(None, "journal_mode", "WAL").unwrap();
  initialize_database(&mut conn).unwrap();
  let start = Utc::now().timestamp() - 60;
  let running = insert_entry(&conn, start, 10, true);
  let tx = conn.transaction().unwrap();
  for index in 0..600 {
    let id = insert_entry(&tx, start + index, 10, false);
    tx.execute("update activity_entries set window_title = ?1 where id = ?2", params!["x".repeat(2048), id]).unwrap();
  }
  tx.commit().unwrap();
  conn.execute_batch("pragma wal_checkpoint(truncate)").unwrap();
  let before = fs::metadata(&path).unwrap().len();
  let budget = 128 * 1024;
  storage::enforce_budget(&mut conn, budget).unwrap();
  let after = fs::metadata(&path).unwrap().len();
  assert!(before > budget as u64);
  assert!(after <= budget as u64, "file should shrink from {before} to at most {budget}, got {after}");
  let wal = PathBuf::from(format!("{}-wal", path.display()));
  assert_eq!(fs::metadata(&wal).unwrap().len(), 0);
  assert_eq!(conn.query_row(
    "select count(*) from activity_entries where id = ?1 and ended_at is null", [running], |row| row.get::<_, i64>(0),
  ).unwrap(), 1);
  // Running activities are protected even when they alone exceed a tiny budget.
  conn.execute("update activity_entries set window_title = ?1 where id = ?2", params!["z".repeat(256 * 1024), running]).unwrap();
  assert!(storage::enforce_budget(&mut conn, budget).is_err());
  assert_eq!(conn.query_row("select count(*) from activity_entries where id = ?1", [running], |row| row.get::<_, i64>(0)).unwrap(), 1);
  drop(conn);
  fs::remove_file(path).unwrap();
}

#[test]
fn failed_storage_cleanup_rolls_back_both_archive_and_raw_deletions() {
  let mut conn = database();
  insert_archive(&conn, "2025-01-01", "Preserve archive if cleanup fails");
  let start = Utc::now().timestamp() - 60;
  for index in 0..30 {
    let id = insert_entry(&conn, start + index, 10, false);
    conn.execute("update activity_entries set window_title = ?1 where id = ?2", params!["x".repeat(8192), id]).unwrap();
  }
  conn.execute_batch(
    "create trigger fail_cleanup before delete on activity_entries
     begin select raise(abort, 'simulated cleanup failure'); end;"
  ).unwrap();
  assert!(storage::enforce_budget(&mut conn, 128 * 1024).is_err());
  assert_eq!(conn.query_row("select count(*) from activity_entries", [], |row| row.get::<_, i64>(0)).unwrap(), 30);
  assert_eq!(conn.query_row("select count(*) from activity_archive_daily", [], |row| row.get::<_, i64>(0)).unwrap(), 1);
}
