#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]
use rusqlite::{params_from_iter, types::Value as SqlValue, Connection};
use serde_json::{Map, Value};
use std::{fs, sync::Mutex, time::Duration};
use tauri::{Manager, State};
use tauri_plugin_dialog::DialogExt;
mod lan;
#[tauri::command]
fn lan_start(state: State<lan::LanManager>, backup: String) -> Result<Value, String> {
    state.start(backup)
}
#[tauri::command]
fn lan_status(state: State<lan::LanManager>) -> Result<Value, String> {
    state.status()
}
#[tauri::command]
fn lan_stop(state: State<lan::LanManager>) -> Result<(), String> {
    state.stop()
}
#[tauri::command]
fn lan_complete(
    state: State<lan::LanManager>,
    transfer_id: String,
    success: bool,
) -> Result<(), String> {
    state.complete(&transfer_id, success)
}
struct Database(Mutex<Connection>);
fn db_error(e: rusqlite::Error) -> String {
    if matches!(
        e.sqlite_error_code(),
        Some(rusqlite::ErrorCode::DatabaseBusy | rusqlite::ErrorCode::DatabaseLocked)
    ) {
        "database is busy".into()
    } else {
        "Local database operation failed".into()
    }
}
fn parameters(values: Vec<Value>) -> Result<Vec<SqlValue>, String> {
    values
        .into_iter()
        .map(|v| match v {
            Value::Null => Ok(SqlValue::Null),
            Value::String(s) => Ok(SqlValue::Text(s)),
            Value::Number(n) => n
                .as_i64()
                .map(SqlValue::Integer)
                .ok_or("Invalid integer".into()),
            _ => Err("Invalid SQL parameter".into()),
        })
        .collect()
}
#[tauri::command]
fn db_exec(state: State<Database>, sql: String) -> Result<(), String> {
    state
        .0
        .lock()
        .map_err(|_| "Database unavailable")?
        .execute_batch(&sql)
        .map_err(db_error)
}
#[tauri::command]
fn db_run(state: State<Database>, sql: String, params: Vec<Value>) -> Result<(), String> {
    state
        .0
        .lock()
        .map_err(|_| "Database unavailable")?
        .execute(&sql, params_from_iter(parameters(params)?))
        .map_err(db_error)?;
    Ok(())
}
#[tauri::command]
fn db_all(state: State<Database>, sql: String, params: Vec<Value>) -> Result<Vec<Value>, String> {
    let conn = state.0.lock().map_err(|_| "Database unavailable")?;
    let mut statement = conn.prepare(&sql).map_err(db_error)?;
    let names: Vec<String> = statement
        .column_names()
        .iter()
        .map(|s| s.to_string())
        .collect();
    let rows = statement
        .query_map(params_from_iter(parameters(params)?), |row| {
            let mut map = Map::new();
            for (index, name) in names.iter().enumerate() {
                let value: SqlValue = row.get(index)?;
                map.insert(
                    name.clone(),
                    match value {
                        SqlValue::Null => Value::Null,
                        SqlValue::Integer(n) => Value::from(n),
                        SqlValue::Real(n) => Value::from(n),
                        SqlValue::Text(s) => Value::from(s),
                        SqlValue::Blob(_) => Value::Null,
                    },
                );
            }
            Ok(Value::Object(map))
        })
        .map_err(db_error)?;
    rows.collect::<Result<Vec<_>, _>>().map_err(db_error)
}
#[tauri::command]
async fn backup_export(app: tauri::AppHandle, json: String) -> Result<bool, String> {
    tauri::async_runtime::spawn_blocking(move || {
        if json.len() > 20_000_000 {
            return Err("Backup exceeds 20 MB".into());
        }
        if let Some(file) = app
            .dialog()
            .file()
            .add_filter("Ledger JSON", &["json"])
            .set_file_name("ledger-backup.json")
            .blocking_save_file()
        {
            let path = file.into_path().map_err(|_| "Invalid path")?;
            fs::write(path, json).map_err(|_| "Unable to save backup")?;
            Ok(true)
        } else {
            Ok(false)
        }
    })
    .await
    .map_err(|_| "File picker failed")?
}
#[tauri::command]
async fn backup_pick(app: tauri::AppHandle) -> Result<Option<String>, String> {
    tauri::async_runtime::spawn_blocking(move || {
        if let Some(file) = app
            .dialog()
            .file()
            .add_filter("Ledger JSON", &["json"])
            .blocking_pick_file()
        {
            let path = file.into_path().map_err(|_| "Invalid path")?;
            if fs::metadata(&path)
                .map_err(|_| "Unable to read file")?
                .len()
                > 20_000_000
            {
                return Err("Backup exceeds 20 MB".into());
            }
            Ok(Some(
                fs::read_to_string(path).map_err(|_| "Unable to read backup")?,
            ))
        } else {
            Ok(None)
        }
    })
    .await
    .map_err(|_| "File picker failed")?
}
fn main() {
    tauri::Builder::default()
        .manage(lan::LanManager::default())
        .plugin(tauri_plugin_dialog::init())
        .setup(|app| {
            let directory = app.path().app_data_dir()?;
            fs::create_dir_all(&directory)?;
            #[cfg(unix)]
            {
                use std::os::unix::fs::PermissionsExt;
                fs::set_permissions(&directory, fs::Permissions::from_mode(0o700))?;
            }
            let db = Connection::open(directory.join("ledger.sqlite"))?;
            #[cfg(unix)]
            {
                use std::os::unix::fs::PermissionsExt;
                fs::set_permissions(
                    directory.join("ledger.sqlite"),
                    fs::Permissions::from_mode(0o600),
                )?;
            }
            db.busy_timeout(Duration::from_secs(3))?;
            app.manage(Database(Mutex::new(db)));
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            db_exec,
            db_run,
            db_all,
            backup_export,
            backup_pick,
            lan_start,
            lan_status,
            lan_stop,
            lan_complete
        ])
        .run(tauri::generate_context!())
        .expect("Unable to start local ledger");
}
