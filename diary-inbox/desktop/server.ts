import { createServer, type IncomingMessage } from 'node:http';
import { randomBytes, timingSafeEqual } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { resolve, extname, sep } from 'node:path';
import { networkInterfaces } from 'node:os';
import { MAX_BYTES, parseBundle, validateBundle, packTransport, unpackTransport, type Bundle, type Store } from '../src/core.ts';

export function createDiaryServer(store: Store, webRoot: string) {
  const session = randomBytes(32).toString('hex');
  let pairing: { token: string; expires: number } | null = null;
  const seen = new Set<string>();
  const failures = new Map<string, { count: number; since: number }>();
  const equal = (a: string, b: string) => a.length === b.length && timingSafeEqual(Buffer.from(a), Buffer.from(b));
  const local = (req: IncomingMessage) => ['127.0.0.1', '::1', '::ffff:127.0.0.1'].includes(req.socket.remoteAddress ?? '');
  const read = async (req: IncomingMessage) => {
    let size = 0;
    const chunks: Buffer[] = [];
    for await (const chunk of req) {
      size += chunk.length;
      if (size > MAX_BYTES * 2 + 4096) throw new Error('请求过大');
      chunks.push(chunk);
    }
    return Buffer.concat(chunks).toString('utf8');
  };
  const root = resolve(webRoot);
  const server = createServer(async (req, res) => {
    res.setHeader('Cache-Control', 'no-store');
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Referrer-Policy', 'no-referrer');
    res.setHeader('Content-Security-Policy', "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; connect-src 'self'; font-src 'self' data:; frame-ancestors 'none'; base-uri 'none'");
    const reply = (status: number, data: unknown) => { res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8' }); res.end(JSON.stringify(data)); };
    try {
      const path = new URL(req.url ?? '/', 'http://localhost').pathname;
      const expectedHost = `127.0.0.1:${(server.address() as { port: number }).port}`;
      const trustedHost = req.headers.host === expectedHost;
      if (path === '/sync') {
        // Native clients do not send Origin. Never expose the LAN endpoint to browser scripts.
        if (req.headers.origin || req.method !== 'POST') return reply(403, { error: '仅接受已配对设备' });
        const address = req.socket.remoteAddress ?? '';
        const attempts = failures.get(address);
        if (attempts && Date.now() - attempts.since < 60000 && attempts.count >= 10) return reply(429, { error: '请稍后重试' });
        const badPair = () => {
          if (failures.size > 1024) failures.clear();
          failures.set(address, { count: attempts && Date.now() - attempts.since < 60000 ? attempts.count + 1 : 1, since: attempts?.since && Date.now() - attempts.since < 60000 ? attempts.since : Date.now() });
          return reply(401, { error: '配对码失效，请在电脑重新开启配对' });
        };
        if (!pairing || pairing.expires < Date.now()) return badPair();
        let payload: { requestId: string; bundle: Bundle | null };
        try {
          const envelope = JSON.parse(await read(req));
          payload = unpackTransport(pairing.token, envelope, 'request') as typeof payload;
          if (!/^[a-f0-9]{32}$/.test(payload.requestId) || seen.has(payload.requestId) || seen.size > 1000) return badPair();
          seen.add(payload.requestId);
        } catch { return badPair(); }
        const result = payload.bundle === null ? await store.load() : await store.merge(validateBundle(payload.bundle));
        return reply(200, packTransport(pairing.token, { requestId: payload.requestId, bundle: result }, n => randomBytes(n), 'response'));
      }
      // All UI and local APIs require both loopback and an exact Host header (DNS rebinding defense).
      if (!local(req) || !trustedHost) return reply(403, { error: '请在本机打开 127.0.0.1 地址' });
      const origin = req.headers.origin;
      if (origin && origin !== `http://${expectedHost}`) return reply(403, { error: '来源不受信任' });
      if (path === '/api/session' && req.method === 'GET') return reply(200, { session });
      if (path.startsWith('/api/')) {
        if (!equal(req.headers['x-diary-session']?.toString() ?? '', session)) return reply(401, { error: '请刷新本机页面' });
        if (path === '/api/store' && req.method === 'GET') return reply(200, await store.load());
        if (path === '/api/store' && req.method === 'POST') return reply(200, await store.merge(parseBundle(await read(req))));
        if (path === '/api/pair' && req.method === 'POST') {
          pairing = { token: randomBytes(32).toString('hex'), expires: Date.now() + 5 * 60000 };
          seen.clear();
          const urls = Object.values(networkInterfaces()).flatMap(list => list ?? []).filter(i => i.family === 'IPv4' && !i.internal).map(i => `http://${i.address}:${(server.address() as { port: number }).port}`);
          return reply(200, { ...pairing, urls });
        }
        if (path === '/api/pair' && req.method === 'DELETE') { pairing = null; return reply(200, { ok: true }); }
        return reply(404, { error: '接口不存在' });
      }
      if (req.method !== 'GET') return reply(405, { error: '方法不受支持' });
      const file = resolve(root, `.${decodeURIComponent(path === '/' ? '/index.html' : path)}`);
      if (!file.startsWith(root + sep)) return reply(403, { error: '路径不受支持' });
      const types: Record<string, string> = { '.html': 'text/html; charset=utf-8', '.js': 'application/javascript', '.css': 'text/css', '.png': 'image/png', '.svg': 'image/svg+xml', '.ttf': 'font/ttf', '.ico': 'image/x-icon', '.json': 'application/json' };
      const data = await readFile(file);
      res.writeHead(200, { 'Content-Type': types[extname(file)] ?? 'application/octet-stream' }); res.end(data);
    } catch { reply(400, { error: '操作失败：检查备份格式、日记本是否一致及容量限制' }); }
  });
  server.requestTimeout = 15000;
  server.headersTimeout = 10000;
  return server;
}
