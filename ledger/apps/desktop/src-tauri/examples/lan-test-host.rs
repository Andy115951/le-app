//! Loopback-only transport harness. Receives synthetic fixtures through stdin;
//! never opens a database or the production application data directory.
#[path = "../src/lan.rs"]
mod lan;
use serde_json::{json, Value};
use std::io::{self, BufRead, Write};
fn main() {
    let manager = lan::LanManager::default();
    for line in io::stdin().lock().lines() {
        let request: Value = serde_json::from_str(&line.unwrap()).unwrap();
        let result = match request["action"].as_str().unwrap() {
            "start" => manager.start_on(
                request["backup"].as_str().unwrap().into(),
                std::net::Ipv4Addr::LOCALHOST,
            ),
            "status" => manager.status(),
            "complete" => manager
                .complete(
                    request["id"].as_str().unwrap(),
                    request["success"].as_bool().unwrap(),
                )
                .map(|_| Value::Null),
            "stop" => manager.stop().map(|_| Value::Null),
            _ => Err("Unknown harness action".into()),
        };
        println!(
            "{}",
            match result {
                Ok(data) => json!({"ok":true,"data":data}),
                Err(error) => json!({"ok":false,"error":error}),
            }
        );
        io::stdout().flush().unwrap();
    }
}
