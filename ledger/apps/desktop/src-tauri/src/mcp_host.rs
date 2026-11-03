//! Authenticated loopback HTTP adapter. Financial queries run in the shared TS core.
use serde_json::{json, Value};
use std::{
    collections::BTreeMap,
    io::{BufRead, BufReader, Read, Write},
    net::{Ipv4Addr, TcpListener, TcpStream},
    sync::{
        atomic::{AtomicBool, AtomicUsize, Ordering},
        Arc,
    },
    thread,
    time::Duration,
};

pub type Handler = Arc<dyn Fn(Value) -> Result<Value, String> + Send + Sync>;
pub struct McpHost {
    pub port: u16,
    pub requests: AtomicUsize,
    stopped: AtomicBool,
    closed: AtomicBool,
    active: AtomicUsize,
    token: String,
}
impl McpHost {
    pub fn start(port: u16, token: String, handler: Handler) -> Result<Arc<Self>, String> {
        let listener = TcpListener::bind((Ipv4Addr::LOCALHOST, port))
            .map_err(|_| "无法开启本机 AI 连接，请检查连接端口是否被占用")?;
        listener
            .set_nonblocking(true)
            .map_err(|_| "无法开启本机连接")?;
        let host = Arc::new(Self {
            port: listener.local_addr().map_err(|_| "连接地址不可用")?.port(),
            requests: AtomicUsize::new(0),
            stopped: AtomicBool::new(false),
            closed: AtomicBool::new(false),
            active: AtomicUsize::new(0),
            token,
        });
        let shared = host.clone();
        thread::spawn(move || {
            while !shared.stopped.load(Ordering::Acquire) {
                match listener.accept() {
                    Ok((stream, _)) => {
                        if shared.active.fetch_add(1, Ordering::AcqRel) >= 8 {
                            shared.active.fetch_sub(1, Ordering::AcqRel);
                            continue;
                        }
                        let host = shared.clone();
                        let handler = handler.clone();
                        thread::spawn(move || {
                            host.handle(stream, &handler);
                            host.active.fetch_sub(1, Ordering::AcqRel);
                        });
                    }
                    Err(_) => thread::sleep(Duration::from_millis(15)),
                }
            }
            drop(listener);
            shared.closed.store(true, Ordering::Release);
        });
        Ok(host)
    }
    pub fn stop(&self) {
        self.stopped.store(true, Ordering::Release);
        for _ in 0..250 {
            if self.closed.load(Ordering::Acquire) {
                break;
            }
            thread::sleep(Duration::from_millis(2));
        }
    }
    fn authenticated(&self, value: &str) -> bool {
        let expected = format!("Bearer {}", self.token);
        value.len() == expected.len()
            && value
                .bytes()
                .zip(expected.bytes())
                .fold(0u8, |difference, (a, b)| difference | (a ^ b))
                == 0
    }
    fn handle(&self, mut stream: TcpStream, handler: &Handler) {
        // macOS/BSD can inherit the listener's nonblocking flag. A request may
        // arrive over several TCP packets; read_line must wait for the rest.
        if stream.set_nonblocking(false).is_err() {
            return;
        }
        let _ = stream.set_read_timeout(Some(Duration::from_secs(3)));
        let _ = stream.set_write_timeout(Some(Duration::from_secs(3)));
        let response = self.read_request(&mut stream).and_then(|request| {
            if self.stopped.load(Ordering::Acquire) {
                return Err(503);
            }
            self.requests.fetch_add(1, Ordering::Relaxed);
            let response = handler(request).map_err(|_| 503u16)?;
            if self.stopped.load(Ordering::Acquire) {
                return Err(503);
            }
            Ok(response)
        });
        let (status, body) = match response {
            Ok(value) => {
                let status = value["status"].as_u64().unwrap_or(500) as u16;
                let body = value["body"].as_str().unwrap_or("").to_owned();
                if body.len() > 2_000_000 || !(200..=599).contains(&status) {
                    (500, json!({"error":"Response unavailable"}).to_string())
                } else {
                    (status, body)
                }
            }
            Err(status) => (
                status,
                json!({"error": match status {
                    401 => "Access key required or invalid", 403 => "Browser origin not allowed",
                    404 => "Not found", 405 => "Only POST is supported", 413 => "Request too large",
                    503 => "Open Ledger and enable AI connection", _ => "Invalid request",
                }})
                .to_string(),
            ),
        };
        let allow = if status == 405 { "Allow: POST\r\n" } else { "" };
        let head = format!("HTTP/1.1 {status} Response\r\nContent-Type: application/json\r\nContent-Length: {}\r\nConnection: close\r\nCache-Control: no-store\r\nX-Content-Type-Options: nosniff\r\n{allow}\r\n", body.len());
        let _ = stream.write_all(head.as_bytes());
        let _ = stream.write_all(body.as_bytes());
    }
    fn read_request(&self, stream: &mut TcpStream) -> Result<Value, u16> {
        let mut reader = BufReader::new(stream);
        let mut total = 0;
        let mut line = String::new();
        let read_line = |reader: &mut BufReader<&mut TcpStream>,
                         line: &mut String,
                         total: &mut usize|
         -> Result<(), u16> {
            line.clear();
            let n = reader.take(8193).read_line(line).map_err(|_| 400u16)?;
            *total += n;
            if n == 0 || n > 8192 || *total > 16384 || !line.ends_with("\r\n") {
                return Err(400);
            }
            Ok(())
        };
        read_line(&mut reader, &mut line, &mut total)?;
        let pieces: Vec<_> = line.trim_end().split(' ').collect();
        if pieces.len() != 3 || pieces[2] != "HTTP/1.1" {
            return Err(400);
        }
        let method = pieces[0].to_owned();
        if pieces[1] != "/mcp" {
            return Err(404);
        }
        let mut headers = BTreeMap::<String, String>::new();
        loop {
            read_line(&mut reader, &mut line, &mut total)?;
            if line == "\r\n" {
                break;
            }
            let (name, value) = line.trim_end().split_once(':').ok_or(400u16)?;
            if !name.bytes().all(|c| c.is_ascii_alphanumeric() || c == b'-') {
                return Err(400);
            }
            if headers
                .insert(name.to_ascii_lowercase(), value.trim().to_owned())
                .is_some()
            {
                return Err(400);
            }
        }
        if headers.contains_key("origin") {
            return Err(403);
        }
        if !matches!(headers.get("host"), Some(host) if host == &format!("127.0.0.1:{}", self.port) || host == &format!("localhost:{}", self.port))
        {
            return Err(403);
        }
        if !self.authenticated(
            headers
                .get("authorization")
                .map(String::as_str)
                .unwrap_or(""),
        ) {
            return Err(401);
        }
        if method != "POST" {
            return Err(405);
        }
        if headers.contains_key("transfer-encoding") {
            return Err(400);
        }
        if !headers
            .get("content-type")
            .is_some_and(|v| v.split(';').next() == Some("application/json"))
        {
            return Err(400);
        }
        let length: usize = headers
            .get("content-length")
            .ok_or(400u16)?
            .parse()
            .map_err(|_| 400u16)?;
        if length > 65536 {
            return Err(413);
        }
        let mut bytes = vec![0; length];
        reader.read_exact(&mut bytes).map_err(|_| 400u16)?;
        let body = String::from_utf8(bytes).map_err(|_| 400u16)?;
        // Never forward the credential, cookies or arbitrary headers to the WebView/SDK.
        headers.retain(|key, _| {
            matches!(
                key.as_str(),
                "accept" | "content-type" | "mcp-protocol-version"
            )
        });
        Ok(json!({"body":body,"headers":headers}))
    }
}
