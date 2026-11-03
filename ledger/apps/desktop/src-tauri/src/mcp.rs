use crate::mcp_host::{Handler, McpHost};
use base64::{engine::general_purpose::URL_SAFE_NO_PAD, Engine};
use rand::RngCore;
use serde_json::{json, Value};
use std::{
    collections::HashMap,
    fs,
    io::Write,
    path::PathBuf,
    sync::{mpsc, Arc, Mutex},
    time::Duration,
};

type Reply = mpsc::Sender<Result<Value, String>>;
pub struct McpManager {
    directory: PathBuf,
    port: u16,
    host: Mutex<Option<Arc<McpHost>>>,
    pending: Mutex<HashMap<String, Reply>>,
    emit: Arc<dyn Fn(Value) -> bool + Send + Sync>,
}
fn random_key() -> String {
    let mut bytes = [0u8; 32];
    rand::thread_rng().fill_bytes(&mut bytes);
    URL_SAFE_NO_PAD.encode(bytes)
}
impl McpManager {
    pub fn new(
        directory: PathBuf,
        port: u16,
        emit: Arc<dyn Fn(Value) -> bool + Send + Sync>,
    ) -> Arc<Self> {
        Arc::new(Self {
            directory,
            port,
            host: Mutex::new(None),
            pending: Mutex::new(HashMap::new()),
            emit,
        })
    }
    fn key(&self, rotate: bool) -> Result<String, String> {
        let path = self.directory.join("mcp-access.json");
        if !rotate && path.exists() {
            #[cfg(unix)]
            {
                use std::os::unix::fs::PermissionsExt;
                fs::set_permissions(&path, fs::Permissions::from_mode(0o600))
                    .map_err(|_| "无法保护 AI 连接配置")?;
            }
            let value: Value =
                serde_json::from_slice(&fs::read(&path).map_err(|_| "无法读取 AI 连接配置")?)
                    .map_err(|_| "AI 连接配置损坏，请重新生成密钥")?;
            let key = value["key"]
                .as_str()
                .filter(|v| {
                    v.len() == 43
                        && v.bytes()
                            .all(|c| c.is_ascii_alphanumeric() || c == b'-' || c == b'_')
                })
                .ok_or("AI 连接配置损坏，请重新生成密钥")?;
            return Ok(key.to_owned());
        }
        let key = random_key();
        let temp = self
            .directory
            .join(format!("mcp-access-{}.tmp", random_key()));
        let save = || -> Result<(), std::io::Error> {
            let mut options = fs::OpenOptions::new();
            options.write(true).create_new(true);
            #[cfg(unix)]
            {
                use std::os::unix::fs::OpenOptionsExt;
                options.mode(0o600);
            }
            let mut file = options.open(&temp)?;
            file.write_all(json!({"key":key}).to_string().as_bytes())?;
            file.sync_all()?;
            #[cfg(windows)]
            if path.exists() {
                fs::remove_file(&path)?;
            }
            fs::rename(&temp, &path)?;
            Ok(())
        };
        if save().is_err() {
            let _ = fs::remove_file(&temp);
            return Err("无法保存 AI 连接密钥".into());
        }
        Ok(key)
    }
    pub fn status(&self) -> Result<Value, String> {
        let guard = self.host.lock().map_err(|_| "AI 连接不可用")?;
        if let Some(host) = guard.as_ref() {
            let url = format!("http://127.0.0.1:{}/mcp", host.port);
            let key = self.key(false)?;
            Ok(
                json!({"available":true,"enabled":true,"url":url,"requests":host.requests.load(std::sync::atomic::Ordering::Relaxed),
                "configuration":{"mcpServers":{"ledger":{"type":"http","url":url,"headers":{"Authorization":format!("Bearer {key}")}}}}}),
            )
        } else {
            Ok(json!({"available":true,"enabled":false,"requests":0}))
        }
    }
    pub fn set_enabled(self: &Arc<Self>, enabled: bool) -> Result<Value, String> {
        let mut guard = self.host.lock().map_err(|_| "AI 连接不可用")?;
        if enabled && guard.is_none() {
            let key = self.key(false)?;
            let weak = Arc::downgrade(self);
            let handler: Handler = Arc::new(move |request| {
                weak.upgrade()
                    .ok_or("AI 连接已关闭".to_owned())?
                    .forward(request)
            });
            *guard = Some(McpHost::start(self.port, key, handler)?);
        } else if !enabled {
            if let Some(host) = guard.take() {
                host.stop();
            }
            self.cancel_pending();
        }
        drop(guard);
        self.status()
    }
    pub fn rotate(self: &Arc<Self>) -> Result<Value, String> {
        let enabled = self.host.lock().map_err(|_| "AI 连接不可用")?.is_some();
        self.set_enabled(false)?;
        self.key(true)?;
        self.set_enabled(enabled)
    }
    fn cancel_pending(&self) {
        if let Ok(mut pending) = self.pending.lock() {
            for (_, reply) in pending.drain() {
                let _ = reply.send(Err("AI 连接已关闭".into()));
            }
        }
    }
    fn forward(&self, request: Value) -> Result<Value, String> {
        let id = random_key();
        let (tx, rx) = mpsc::channel();
        self.pending
            .lock()
            .map_err(|_| "AI 连接不可用")?
            .insert(id.clone(), tx);
        if !(self.emit)(json!({"id":id,"request":request})) {
            self.pending
                .lock()
                .map_err(|_| "AI 连接不可用")?
                .remove(&id);
            return Err("请保持简账运行".into());
        }
        let response = rx
            .recv_timeout(Duration::from_secs(15))
            .unwrap_or_else(|_| Err("查询超时，请保持简账运行后重试".into()));
        self.pending
            .lock()
            .map_err(|_| "AI 连接不可用")?
            .remove(&id);
        response
    }
    pub fn respond(&self, id: String, response: Value) {
        if let Ok(mut pending) = self.pending.lock() {
            if let Some(reply) = pending.remove(&id) {
                let _ = reply.send(Ok(response));
            }
        }
    }
}
impl Drop for McpManager {
    fn drop(&mut self) {
        if let Ok(mut host) = self.host.lock() {
            if let Some(host) = host.take() {
                host.stop();
            }
        }
        self.cancel_pending();
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::{
        io::{Read, Write},
        net::TcpStream,
        sync::Weak,
    };
    fn fixture() -> (Arc<McpManager>, PathBuf) {
        let directory = std::env::temp_dir().join(format!("ledger-mcp-synthetic-{}", random_key()));
        fs::create_dir(&directory).unwrap();
        let holder = Arc::new(Mutex::new(None::<Weak<McpManager>>));
        let target = holder.clone();
        let manager = McpManager::new(
            directory.clone(),
            0,
            Arc::new(move |request| {
                target
                    .lock()
                    .unwrap()
                    .as_ref()
                    .unwrap()
                    .upgrade()
                    .unwrap()
                    .respond(
                        request["id"].as_str().unwrap().into(),
                        json!({"status":200,"body":"{}"}),
                    );
                true
            }),
        );
        *holder.lock().unwrap() = Some(Arc::downgrade(&manager));
        (manager, directory)
    }
    fn request(status: &Value, authorization: &str) -> String {
        let port = status["url"]
            .as_str()
            .unwrap()
            .split(':')
            .nth(2)
            .unwrap()
            .split('/')
            .next()
            .unwrap();
        let mut stream = TcpStream::connect(format!("127.0.0.1:{port}")).unwrap();
        stream.write_all(format!("POST /mcp HTTP/1.1\r\nHost: 127.0.0.1:{port}\r\nAuthorization: {authorization}\r\nContent-Type: application/json\r\nContent-Length: 2\r\n\r\n{{}}").as_bytes()).unwrap();
        let mut response = String::new();
        stream.read_to_string(&mut response).unwrap();
        response
    }
    #[test]
    fn access_is_off_on_restart_and_rotation_revokes_old_key() {
        let (manager, directory) = fixture();
        assert_eq!(manager.status().unwrap()["enabled"], false);
        assert!(!directory.join("mcp-access.json").exists());
        let first = manager.set_enabled(true).unwrap();
        let old = first["configuration"]["mcpServers"]["ledger"]["headers"]["Authorization"]
            .as_str()
            .unwrap()
            .to_string();
        assert!(request(&first, &old).starts_with("HTTP/1.1 200"));
        #[cfg(unix)]
        {
            use std::os::unix::fs::PermissionsExt;
            assert_eq!(
                fs::metadata(directory.join("mcp-access.json"))
                    .unwrap()
                    .permissions()
                    .mode()
                    & 0o777,
                0o600
            );
        }
        let rotated = manager.rotate().unwrap();
        let new = rotated["configuration"]["mcpServers"]["ledger"]["headers"]["Authorization"]
            .as_str()
            .unwrap();
        assert!(old != new);
        assert!(request(&rotated, &old).starts_with("HTTP/1.1 401"));
        assert!(request(&rotated, new).starts_with("HTTP/1.1 200"));
        manager.set_enabled(false).unwrap();
        drop(manager);
        let restarted = McpManager::new(directory.clone(), 0, Arc::new(|_| true));
        assert_eq!(restarted.status().unwrap()["enabled"], false);
        assert_eq!(format!("Bearer {}", restarted.key(false).unwrap()), new);
        drop(restarted);
        fs::remove_dir_all(directory).unwrap();
    }
    #[test]
    fn disabling_cancels_queued_queries() {
        let directory = std::env::temp_dir().join(format!("ledger-mcp-synthetic-{}", random_key()));
        fs::create_dir(&directory).unwrap();
        let (tx, rx) = mpsc::channel();
        let tx = Mutex::new(tx);
        let manager = McpManager::new(
            directory.clone(),
            0,
            Arc::new(move |_| {
                tx.lock().unwrap().send(()).unwrap();
                true
            }),
        );
        manager.set_enabled(true).unwrap();
        let worker = manager.clone();
        let query = std::thread::spawn(move || worker.forward(json!({"body":"{}"})));
        rx.recv_timeout(Duration::from_secs(1)).unwrap();
        manager.set_enabled(false).unwrap();
        assert!(query.join().unwrap().is_err());
        assert_eq!(manager.status().unwrap()["enabled"], false);
        drop(manager);
        fs::remove_dir_all(directory).unwrap();
    }
}
