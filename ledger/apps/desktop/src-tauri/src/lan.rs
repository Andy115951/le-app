//! Ephemeral encrypted transport only. Never opens or mutates the ledger database.
use aes_gcm::{
    aead::{Aead, KeyInit, Payload},
    Aes256Gcm, Nonce,
};
use base64::{engine::general_purpose::STANDARD, Engine};
use rand::{rngs::OsRng, RngCore};
use serde_json::{json, Value};
use std::{
    collections::HashSet,
    io::{Read, Write},
    net::{Ipv4Addr, TcpListener, TcpStream},
    sync::{
        atomic::{AtomicBool, Ordering},
        Arc, Mutex,
    },
    thread,
    time::{Duration, Instant, SystemTime, UNIX_EPOCH},
};
const MAX_WIRE: usize = 28_100_000;
const MAX_BACKUP: usize = 20_000_000;
const REQUEST_AAD: &[u8] = b"ledger-lan/v1/request";
const RESPONSE_AAD: &[u8] = b"ledger-lan/v1/response";

#[derive(Default)]
pub struct LanManager(Mutex<Option<Arc<Session>>>);
struct Transfer {
    peer: Option<String>,
    nonces: HashSet<Vec<u8>>,
    phase: &'static str,
    id: Option<String>,
    direction: Option<&'static str>,
    outgoing: String,
    incoming: Option<String>,
    announced: bool,
}
struct Session {
    key: [u8; 32],
    expires: Instant,
    stopped: AtomicBool,
    transfer: Mutex<Transfer>,
}
impl Drop for Session {
    fn drop(&mut self) {
        self.key.fill(0);
    }
}
fn summary(backup: &str) -> Result<Value, String> {
    if backup.len() > MAX_BACKUP {
        return Err("账本超过 20 MB 限制".into());
    }
    let b: Value = serde_json::from_str(backup).map_err(|_| "备份格式无效")?;
    if b["kind"] != "ledger-backup" || b["formatVersion"] != 1 {
        return Err("备份格式无效".into());
    }
    let len = |key: &str| {
        b["ledger"][key]
            .as_array()
            .map(|a| a.len())
            .ok_or("备份格式无效")
    };
    Ok(
        json!({"accounts":len("accounts")?,"entries":len("entries")?,"reconciliations":len("reconciliations")?,"exportedAt":b["exportedAt"]}),
    )
}
fn valid_id(value: &Value) -> Result<&str, String> {
    let s = value.as_str().ok_or("请求无效")?;
    if !(16..=80).contains(&s.len())
        || !s
            .bytes()
            .all(|c| c.is_ascii_alphanumeric() || c == b'-' || c == b'_')
    {
        return Err("请求无效".into());
    }
    Ok(s)
}
fn seal(key: &[u8; 32], text: &[u8], aad: &[u8]) -> Result<String, String> {
    let mut iv = [0; 12];
    OsRng.fill_bytes(&mut iv);
    let cipher = Aes256Gcm::new_from_slice(key).map_err(|_| "加密失败")?;
    let encrypted = cipher
        .encrypt(Nonce::from_slice(&iv), Payload { msg: text, aad })
        .map_err(|_| "加密失败")?;
    let mut bytes = iv.to_vec();
    bytes.extend(encrypted);
    Ok(STANDARD.encode(bytes))
}
impl Session {
    fn live(&self) -> bool {
        !self.stopped.load(Ordering::Relaxed) && Instant::now() < self.expires
    }
    fn exchange(&self, wire: &[u8]) -> Result<String, String> {
        if !self.live() || wire.len() > MAX_WIRE {
            return Err("连接已失效".into());
        }
        let bytes = STANDARD.decode(wire).map_err(|_| "认证失败")?;
        if bytes.len() < 28 {
            return Err("认证失败".into());
        }
        let cipher = Aes256Gcm::new_from_slice(&self.key).map_err(|_| "认证失败")?;
        let plaintext = cipher
            .decrypt(
                Nonce::from_slice(&bytes[..12]),
                Payload {
                    msg: &bytes[12..],
                    aad: REQUEST_AAD,
                },
            )
            .map_err(|_| "认证失败")?;
        let req: Value = serde_json::from_slice(&plaintext).map_err(|_| "请求无效")?;
        let request_id = valid_id(&req["requestId"])?;
        let client = valid_id(&req["clientId"])?;
        let mut t = self.transfer.lock().map_err(|_| "连接不可用")?;
        if t.nonces.len() >= 600 || !t.nonces.insert(bytes[..12].to_vec()) {
            return Err("请求已使用".into());
        }
        let result = (|| -> Result<Value, String> {
            let action = req["action"].as_str().ok_or("请求无效")?;
            if let Some(peer) = &t.peer {
                if peer != client {
                    return Err("连接已被另一台设备使用".into());
                }
            } else if action == "inspect" {
                t.peer = Some(client.to_string());
            } else {
                return Err("请先连接设备".into());
            }
            match action {
                "inspect" => {
                    if t.phase != "waiting" {
                        return Err("本次传输已开始或已完成，请重新连接".into());
                    }
                    Ok(json!({"state":t.phase,"summary":summary(&t.outgoing)?}))
                }
                "upload" => {
                    let id = valid_id(&req["transferId"])?;
                    let backup = req["backup"].as_str().ok_or("备份格式无效")?;
                    summary(backup)?;
                    if t.phase == "waiting" {
                        t.id = Some(id.to_string());
                        t.direction = Some("upload");
                        t.incoming = Some(backup.to_string());
                        t.phase = "pending";
                    } else if t.id.as_deref() != Some(id)
                        || t.direction != Some("upload")
                        || t.incoming.as_deref() != Some(backup)
                    {
                        return Err("本次连接仅允许传输一次".into());
                    }
                    Ok(json!({"state":t.phase,"transferId":t.id}))
                }
                "download" => {
                    let id = valid_id(&req["transferId"])?;
                    if t.phase == "waiting" {
                        t.id = Some(id.to_string());
                        t.direction = Some("download");
                        t.phase = "downloaded";
                    }
                    if t.id.as_deref() != Some(id)
                        || t.direction != Some("download")
                        || t.phase != "downloaded"
                    {
                        return Err("本次连接仅允许传输一次".into());
                    }
                    Ok(json!({"state":t.phase,"transferId":t.id,"backup":t.outgoing}))
                }
                "status" => Ok(json!({"state":t.phase,"transferId":t.id})),
                "finish" => {
                    let id = valid_id(&req["transferId"])?;
                    if t.id.as_deref() != Some(id) || t.direction != Some("download") {
                        return Err("传输不匹配".into());
                    }
                    let phase = if req["success"].as_bool().ok_or("请求无效")? {
                        "applied"
                    } else {
                        "rejected"
                    };
                    if t.phase == "downloaded" {
                        t.phase = phase;
                    } else if t.phase != phase {
                        return Err("传输已经结束".into());
                    }
                    Ok(json!({"state":t.phase,"transferId":t.id}))
                }
                _ => Err("请求无效".into()),
            }
        })();
        let response = match result {
            Ok(data) => json!({"requestId":request_id,"ok":true,"data":data}),
            Err(error) => json!({"requestId":request_id,"ok":false,"error":error}),
        };
        seal(&self.key, response.to_string().as_bytes(), RESPONSE_AAD)
    }
}
impl LanManager {
    pub fn start(&self, backup: String) -> Result<Value, String> {
        self.start_on(backup, Ipv4Addr::UNSPECIFIED)
    }
    pub fn start_on(&self, backup: String, bind: Ipv4Addr) -> Result<Value, String> {
        summary(&backup)?;
        let mut slot = self.0.lock().map_err(|_| "连接不可用")?;
        if slot.is_some() {
            return Err("请先关闭当前连接".into());
        }
        let listener = TcpListener::bind((bind, 0)).map_err(|_| "无法开启局域网连接")?;
        let port = listener
            .local_addr()
            .map_err(|_| "无法读取连接地址")?
            .port();
        listener
            .set_nonblocking(true)
            .map_err(|_| "无法开启局域网连接")?;
        let mut key = [0; 32];
        OsRng.fill_bytes(&mut key);
        let session = Arc::new(Session {
            key,
            expires: Instant::now() + Duration::from_secs(600),
            stopped: AtomicBool::new(false),
            transfer: Mutex::new(Transfer {
                peer: None,
                nonces: HashSet::new(),
                phase: "waiting",
                id: None,
                direction: None,
                outgoing: backup,
                incoming: None,
                announced: false,
            }),
        });
        let addresses: Vec<String> = if bind.is_loopback() {
            vec![bind.to_string()]
        } else {
            if_addrs::get_if_addrs()
                .map_err(|_| "无法读取局域网地址")?
                .into_iter()
                .filter_map(|i| match i.ip() {
                    std::net::IpAddr::V4(ip) if ip.is_private() && !ip.is_loopback() => {
                        Some(ip.to_string())
                    }
                    _ => None,
                })
                .collect::<std::collections::BTreeSet<_>>()
                .into_iter()
                .collect()
        };
        if addresses.is_empty() {
            return Err("未找到局域网地址，请先连接 Wi-Fi 或有线网络".into());
        }
        let expires = SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .map_err(|_| "设备时间无效")?
            .as_millis()
            + 600_000;
        let result = json!({"addresses":addresses,"port":port,"key":STANDARD.encode(key),"expiresAt":expires});
        let worker = session.clone();
        thread::spawn(move || {
            while worker.live() {
                match listener.accept() {
                    Ok((mut stream, _)) => {
                        handle(&mut stream, &worker);
                    }
                    Err(e) if e.kind() == std::io::ErrorKind::WouldBlock => {
                        thread::sleep(Duration::from_millis(40))
                    }
                    Err(_) => break,
                }
            }
            worker.stopped.store(true, Ordering::Relaxed);
        });
        *slot = Some(session);
        Ok(result)
    }
    pub fn stop(&self) -> Result<(), String> {
        if let Some(s) = self.0.lock().map_err(|_| "连接不可用")?.take() {
            s.stopped.store(true, Ordering::Relaxed);
        }
        Ok(())
    }
    pub fn status(&self) -> Result<Value, String> {
        let slot = self.0.lock().map_err(|_| "连接不可用")?;
        let s = slot.as_ref().ok_or("连接已关闭")?;
        if !s.live() {
            return Err("连接已过期，请重新开启".into());
        }
        let mut t = s.transfer.lock().map_err(|_| "连接不可用")?;
        let incoming = if t.phase == "pending" && !t.announced {
            t.announced = true;
            t.incoming.clone()
        } else {
            None
        };
        Ok(json!({"state":t.phase,"paired":t.peer.is_some(),"transferId":t.id,"incoming":incoming}))
    }
    pub fn complete(&self, id: &str, success: bool) -> Result<(), String> {
        let slot = self.0.lock().map_err(|_| "连接不可用")?;
        let s = slot.as_ref().ok_or("连接已关闭")?;
        if !s.live() {
            return Err("连接已过期".into());
        }
        let mut t = s.transfer.lock().map_err(|_| "连接不可用")?;
        if t.id.as_deref() != Some(id) || t.direction != Some("upload") {
            return Err("传输不匹配".into());
        }
        let phase = if success { "applied" } else { "rejected" };
        if t.phase == "pending" {
            t.phase = phase;
        } else if t.phase != phase {
            return Err("传输已经结束".into());
        }
        Ok(())
    }
}
impl Drop for LanManager {
    fn drop(&mut self) {
        let _ = self.stop();
    }
}
fn read_request(stream: &mut TcpStream, session: &Session) -> Result<Vec<u8>, String> {
    stream
        .set_read_timeout(Some(Duration::from_secs(1)))
        .map_err(|_| "连接失败")?;
    stream
        .set_write_timeout(Some(Duration::from_secs(3)))
        .map_err(|_| "连接失败")?;
    let deadline = Instant::now() + Duration::from_secs(25);
    let mut header = Vec::new();
    let mut byte = [0; 1];
    while !header.ends_with(b"\r\n\r\n") {
        if header.len() >= 8192 || !session.live() || Instant::now() > deadline {
            return Err("请求无效".into());
        }
        stream.read_exact(&mut byte).map_err(|_| "请求无效")?;
        header.push(byte[0]);
    }
    let text = std::str::from_utf8(&header).map_err(|_| "请求无效")?;
    let mut lines = text.split("\r\n");
    if !matches!(
        lines.next(),
        Some("POST /v1/exchange HTTP/1.1") | Some("POST /v1/exchange HTTP/1.0")
    ) {
        return Err("请求无效".into());
    }
    let mut length = None;
    for line in lines.filter(|l| !l.is_empty()) {
        let (name, value) = line.split_once(':').ok_or("请求无效")?;
        if name.eq_ignore_ascii_case("origin") || name.eq_ignore_ascii_case("transfer-encoding") {
            return Err("请求无效".into());
        }
        if name.eq_ignore_ascii_case("content-length") {
            if length.is_some() {
                return Err("请求无效".into());
            }
            let n = value.trim().parse::<usize>().map_err(|_| "请求无效")?;
            if n > MAX_WIRE || n < 40 {
                return Err("请求过大或无效".into());
            }
            length = Some(n);
        }
    }
    let mut body = vec![0; length.ok_or("请求无效")?];
    let mut offset = 0;
    while offset < body.len() {
        if !session.live() || Instant::now() > deadline {
            return Err("连接已关闭".into());
        }
        let n = stream.read(&mut body[offset..]).map_err(|_| "请求无效")?;
        if n == 0 {
            return Err("请求无效".into());
        }
        offset += n;
    }
    Ok(body)
}
fn handle(stream: &mut TcpStream, session: &Session) {
    let result = read_request(stream, session).and_then(|body| session.exchange(&body));
    let (status, body) = match result {
        Ok(body) => ("200 OK", body),
        Err(_) => ("403 Forbidden", "Connection unavailable".to_string()),
    };
    let header=format!("HTTP/1.1 {status}\r\nContent-Type: application/octet-stream\r\nContent-Length: {}\r\nCache-Control: no-store\r\nConnection: close\r\nX-Content-Type-Options: nosniff\r\n\r\n",body.len());
    let _ = stream
        .write_all(header.as_bytes())
        .and_then(|_| stream.write_all(body.as_bytes()));
}

#[cfg(test)]
mod tests {
    use super::*;
    fn session() -> Session {
        Session {
            key: [7; 32], expires: Instant::now()+Duration::from_secs(600),
            stopped: AtomicBool::new(false),
            transfer: Mutex::new(Transfer {peer:None,nonces:HashSet::new(),phase:"waiting",id:None,direction:None,outgoing:json!({"kind":"ledger-backup","formatVersion":1,"exportedAt":"2026-01-01T00:00:00","ledger":{"accounts":[],"entries":[],"reconciliations":[]}}).to_string(),incoming:None,announced:false})
        }
    }
    #[test]
    fn expired_and_stopped_sessions_reject_authenticated_requests() {
        let mut s = session();
        let req = json!({"requestId":"synthetic-request-0001","clientId":"synthetic-client-0001","action":"inspect"});
        let wire = seal(&s.key, req.to_string().as_bytes(), REQUEST_AAD).unwrap();
        s.expires = Instant::now() - Duration::from_secs(1);
        assert!(s.exchange(wire.as_bytes()).is_err());
        s.expires = Instant::now() + Duration::from_secs(10);
        s.stopped.store(true, Ordering::Relaxed);
        assert!(s.exchange(wire.as_bytes()).is_err());
    }
    #[test]
    fn malformed_oversized_backups_and_oversized_envelopes_are_rejected() {
        assert!(summary("{}").is_err());
        assert!(summary(&" ".repeat(MAX_BACKUP + 1)).is_err());
        assert!(session().exchange(&vec![b'A'; MAX_WIRE + 1]).is_err());
    }
}
