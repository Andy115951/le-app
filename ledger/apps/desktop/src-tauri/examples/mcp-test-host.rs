//! Test-only bridge: generated fixtures are handled by the Node integration harness.
#[path = "../src/mcp_host.rs"]
mod mcp_host;
use serde_json::{json, Value};
use std::{
    collections::HashMap,
    io::{self, BufRead, Write},
    sync::{mpsc, Arc, Mutex},
    time::Duration,
};
fn emit(value: Value) {
    let stdout = io::stdout();
    let mut out = stdout.lock();
    writeln!(out, "{value}").unwrap();
    out.flush().unwrap();
}
fn main() {
    let pending = Arc::new(Mutex::new(HashMap::<u64, mpsc::Sender<Value>>::new()));
    let sequence = Arc::new(Mutex::new(0u64));
    let shared = pending.clone();
    let host = mcp_host::McpHost::start(
        0,
        "synthetic-test-access-not-for-production".into(),
        Arc::new(move |request| {
            let mut counter = sequence.lock().unwrap();
            *counter += 1;
            let id = *counter;
            drop(counter);
            let (tx, rx) = mpsc::channel();
            shared.lock().unwrap().insert(id, tx);
            emit(json!({"event":"request","id":id,"request":request}));
            let result = rx
                .recv_timeout(Duration::from_secs(5))
                .map_err(|_| "Test bridge timed out".to_string());
            shared.lock().unwrap().remove(&id);
            result
        }),
    )
    .unwrap();
    emit(json!({"event":"ready","url":format!("http://127.0.0.1:{}/mcp",host.port)}));
    for line in io::stdin().lock().lines() {
        let value: Value = serde_json::from_str(&line.unwrap()).unwrap();
        if value["stop"] == true {
            host.stop();
            emit(json!({"event":"stopped"}));
            break;
        }
        if let Some(reply) = value["id"]
            .as_u64()
            .and_then(|id| pending.lock().unwrap().remove(&id))
        {
            let _ = reply.send(value["response"].clone());
        }
    }
    host.stop();
}
