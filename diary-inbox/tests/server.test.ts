import { test } from 'node:test';
import assert from 'node:assert/strict';
import { randomBytes } from 'node:crypto';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { request } from 'node:http';
import { DesktopStore } from '../desktop/storage.ts';
import { createDiaryServer } from '../desktop/server.ts';
import { append, createVault, exchange, packTransport, unpackTransport } from '../src/core.ts';

test('SQLite persists ciphertext and merges simultaneous writers without losing history', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'diary-synthetic-test-'));
  const path = join(dir, 'fixture.sqlite');
  const store = new DesktopStore(path);
  try {
    const random = (n: number) => new Uint8Array(randomBytes(n));
    const { bundle, key } = await createVault('fictional-sqlite-passphrase', random);
    const marker = 'FICTIONAL_SENTINEL_NOT_IN_DATABASE';
    const a = append(bundle, key, random, { text: marker, date: '2026-02-01', updatedAt: new Date().toISOString(), deleted: false });
    const b = append(bundle, key, random, { text: marker, date: '2026-02-02', updatedAt: new Date().toISOString(), deleted: false });
    await Promise.all([store.merge(a), store.merge(b)]);
    assert.equal((await store.load())!.revisions.length, 2);
    key.fill(0);
    store.close();
    assert.equal((await readFile(path)).includes(Buffer.from(marker)), false);
    const reopened = new DesktopStore(path);
    assert.equal((await reopened.load())!.revisions.length, 2); reopened.close();
  } finally { store.close(); await rm(dir, { recursive: true, force: true }); }
});

test('LAN requires an encrypted pairing key; browser origins, replays and rebinding are denied', async () => {
  const store = new DesktopStore(':memory:');
  const server = createDiaryServer(store, '.');
  await new Promise<void>(resolve => server.listen(0, '127.0.0.1', resolve));
  const origin = `http://127.0.0.1:${(server.address() as { port: number }).port}`;
  try {
    assert.equal((await fetch(`${origin}/api/store`)).status, 401);
    assert.equal((await fetch(`${origin}/api/session`, { headers: { Origin: 'https://example.com' } })).status, 403);
    // Undici normalizes Host; use the raw HTTP API to actually exercise rebinding.
    const reboundStatus = await new Promise<number | undefined>((resolve, reject) => {
      const req = request(`${origin}/api/session`, { headers: { Host: 'example.com' } }, res => { res.resume(); resolve(res.statusCode); });
      req.on('error', reject); req.end();
    });
    assert.equal(reboundStatus, 403);
    assert.equal((await fetch(`${origin}/sync`, { method: 'POST', body: '{}' })).status, 401);
    const { session } = await (await fetch(`${origin}/api/session`)).json();
    const headers = { 'X-Diary-Session': session, 'Content-Type': 'application/json' };
    const pairing = await (await fetch(`${origin}/api/pair`, { method: 'POST', headers })).json();
    const random = (n: number) => new Uint8Array(randomBytes(n));
    const { bundle, key } = await createVault('fictional-network-passphrase', random);
    const pair = { url: origin, token: pairing.token };
    assert.equal(await exchange(pair, null, random), null);
    assert.deepEqual(await exchange(pair, bundle, random), bundle);
    assert.deepEqual(await exchange(pair, null, random), bundle);
    const body = JSON.stringify(packTransport(pair.token, { requestId: 'ab'.repeat(16), bundle: null }, random, 'request'));
    assert.equal((await fetch(`${origin}/sync`, { method: 'POST', headers: { Origin: origin }, body })).status, 403);
    const response = await fetch(`${origin}/sync`, { method: 'POST', body });
    assert.equal(response.status, 200);
    assert.equal((unpackTransport(pair.token, await response.json(), 'response') as any).requestId, 'ab'.repeat(16));
    assert.equal((await fetch(`${origin}/sync`, { method: 'POST', body })).status, 401);
    await fetch(`${origin}/api/pair`, { method: 'DELETE', headers });
    await assert.rejects(exchange(pair, null, random)); key.fill(0);
  } finally {
    server.closeAllConnections(); await new Promise<void>(resolve => server.close(() => resolve())); store.close();
  }
});
