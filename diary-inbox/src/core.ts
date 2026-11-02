import { gcm } from '@noble/ciphers/aes.js';
import { pbkdf2Async } from '@noble/hashes/pbkdf2.js';
import { sha256 } from '@noble/hashes/sha2.js';
import { bytesToHex, hexToBytes } from '@noble/hashes/utils.js';

export const MAX_BYTES = 16 * 1024 * 1024;
export const MAX_REVISIONS = 20000;
const ITERATIONS = 600000;
const enc = new TextEncoder();
const dec = new TextDecoder('utf-8', { fatal: true });
export type Random = (length: number) => Uint8Array;
export type Sealed = { nonce: string; ciphertext: string };
export type Header = { version: 1; vaultId: string; salt: string; iterations: number; check: Sealed };
export type Revision = { id: string; entryId: string; parents: string[]; sealed: Sealed };
export type Bundle = { format: 'diary-inbox'; header: Header; revisions: Revision[] };
export type Content = { date: string; text: string; updatedAt: string; deleted: boolean };
export type OpenRevision = Revision & { content: Content };
export type Entry = { id: string; heads: OpenRevision[] };
export interface Store {
  load(): Promise<Bundle | null>;
  merge(bundle: Bundle): Promise<Bundle>;
}

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}
function isHex(value: unknown, bytes?: number): value is string {
  return typeof value === 'string' && /^(?:[0-9a-f]{2})+$/.test(value) && (!bytes || value.length === bytes * 2);
}
function checkSealed(s: Sealed) {
  assert(s && isHex(s.nonce, 12) && isHex(s.ciphertext) && s.ciphertext.length >= 32 && s.ciphertext.length <= 450000, '加密记录格式错误');
}
export function validateBundle(value: unknown): Bundle {
  const b = value as Bundle;
  assert(b?.format === 'diary-inbox' && b.header?.version === 1, '不是受支持的日记备份');
  const h = b.header;
  assert(isHex(h.vaultId, 16) && isHex(h.salt, 32) && h.iterations === ITERATIONS, '日记本参数无效');
  checkSealed(h.check);
  assert(Array.isArray(b.revisions) && b.revisions.length <= MAX_REVISIONS, '记录数量超出限制');
  const ids = new Map<string, Revision>();
  for (const r of b.revisions) {
    assert(r && isHex(r.id, 16) && isHex(r.entryId, 16), '记录编号错误');
    assert(Array.isArray(r.parents) && r.parents.length <= 64 && r.parents.every(p => isHex(p, 16)), '记录版本错误');
    assert(!r.parents.includes(r.id) && new Set(r.parents).size === r.parents.length && !ids.has(r.id), '记录版本重复或循环');
    checkSealed(r.sealed);
    ids.set(r.id, r);
  }
  // Full-history bundles: every parent must be present, in the same entry, and acyclic.
  const state = new Map<string, number>();
  for (const start of b.revisions) {
    const stack: [Revision, boolean][] = [[start, false]];
    while (stack.length) {
      const [r, leaving] = stack.pop()!;
      if (leaving) { state.set(r.id, 2); continue; }
      assert(state.get(r.id) !== 1, '记录版本存在循环');
      if (state.get(r.id) === 2) continue;
      state.set(r.id, 1);
      stack.push([r, true]);
      for (const p of r.parents) {
        const parent = ids.get(p);
        assert(parent && parent.entryId === r.entryId, '缺少前序版本');
        stack.push([parent, false]);
      }
    }
  }
  assert(enc.encode(JSON.stringify(b)).byteLength <= MAX_BYTES, '备份超过 16 MB 限制');
  return b;
}
export function parseBundle(text: string): Bundle {
  assert(text.length <= MAX_BYTES, '备份过大');
  return validateBundle(JSON.parse(text));
}
function headerIdentity(h: Header) {
  return JSON.stringify([h.version, h.vaultId, h.salt, h.iterations, h.check.nonce, h.check.ciphertext]);
}
function revisionIdentity(r: Revision) {
  return JSON.stringify([r.id, r.entryId, r.parents, r.sealed.nonce, r.sealed.ciphertext]);
}
export function mergeBundles(local: Bundle | null, incoming: Bundle): Bundle {
  validateBundle(incoming);
  if (!local) return incoming;
  validateBundle(local);
  assert(headerIdentity(local.header) === headerIdentity(incoming.header), '这是另一个日记本。请在空白设备导入同一本日记，不要分别创建。');
  const revisions = new Map(local.revisions.map(r => [r.id, r]));
  for (const r of incoming.revisions) {
    const prior = revisions.get(r.id);
    assert(!prior || revisionIdentity(prior) === revisionIdentity(r), '版本编号冲突，已停止导入');
    revisions.set(r.id, r);
  }
  return validateBundle({ ...local, revisions: [...revisions.values()].sort((a, b) => a.id.localeCompare(b.id)) });
}
function aad(header: Header, id = 'check', entryId = '', parents: string[] = []) {
  return enc.encode(JSON.stringify(['diary-inbox-v1', header.vaultId, header.salt, header.iterations, id, entryId, parents]));
}
function seal(key: Uint8Array, bytes: Uint8Array, associated: Uint8Array, random: Random): Sealed {
  const nonce = random(12);
  return { nonce: bytesToHex(nonce), ciphertext: bytesToHex(gcm(key, nonce, associated).encrypt(bytes)) };
}
function open(key: Uint8Array, s: Sealed, associated: Uint8Array): Uint8Array {
  return gcm(key, hexToBytes(s.nonce), associated).decrypt(hexToBytes(s.ciphertext));
}
async function derive(password: string, header: Header) {
  return pbkdf2Async(sha256, enc.encode(password), hexToBytes(header.salt), { c: header.iterations, dkLen: 32, asyncTick: 10 });
}
export async function createVault(password: string, random: Random): Promise<{ bundle: Bundle; key: Uint8Array }> {
  assert(password.length >= 12, '请使用至少 12 个字符的独立长口令');
  const header: Header = { version: 1, vaultId: bytesToHex(random(16)), salt: bytesToHex(random(32)), iterations: ITERATIONS, check: { nonce: '', ciphertext: '' } };
  const key = await derive(password, header);
  header.check = seal(key, enc.encode('diary-inbox-key-check-v1'), aad(header), random);
  return { bundle: { format: 'diary-inbox', header, revisions: [] }, key };
}
export async function unlock(bundle: Bundle, password: string): Promise<Uint8Array> {
  validateBundle(bundle);
  const key = await derive(password, bundle.header);
  try {
    assert(dec.decode(open(key, bundle.header.check, aad(bundle.header))) === 'diary-inbox-key-check-v1', '口令错误');
    readRevisions(bundle, key);
    return key;
  } catch {
    key.fill(0);
    throw new Error('口令不正确，或备份已经损坏');
  }
}
export function validDate(date: string) {
  return /^\d{4}-\d{2}-\d{2}$/.test(date) && !Number.isNaN(Date.parse(`${date}T00:00:00Z`)) && new Date(`${date}T00:00:00Z`).toISOString().slice(0, 10) === date;
}
function validateContent(c: Content) {
  assert(c && validDate(c.date) && typeof c.text === 'string' && c.text.length <= 50000 && typeof c.deleted === 'boolean' && typeof c.updatedAt === 'string' && !Number.isNaN(Date.parse(c.updatedAt)), '日记内容格式错误');
}
export function readRevisions(bundle: Bundle, key: Uint8Array): OpenRevision[] {
  return bundle.revisions.map(r => {
    const content: Content = JSON.parse(dec.decode(open(key, r.sealed, aad(bundle.header, r.id, r.entryId, r.parents))));
    validateContent(content);
    return { ...r, content };
  });
}
export function entries(bundle: Bundle, key: Uint8Array): Entry[] {
  const revisions = readRevisions(bundle, key);
  const parents = new Set(revisions.flatMap(r => r.parents));
  const groups = new Map<string, OpenRevision[]>();
  for (const r of revisions) if (!parents.has(r.id)) groups.set(r.entryId, [...(groups.get(r.entryId) ?? []), r]);
  return [...groups].map(([id, heads]) => ({ id, heads: heads.sort((a, b) => a.id.localeCompare(b.id)) }))
    .sort((a, b) => b.heads[0].content.date.localeCompare(a.heads[0].content.date) || a.id.localeCompare(b.id));
}
export function append(bundle: Bundle, key: Uint8Array, random: Random, content: Content, entryId?: string, parents: string[] = []): Bundle {
  validateContent(content);
  const id = bytesToHex(random(16));
  const eid = entryId ?? bytesToHex(random(16));
  const sortedParents = [...parents].sort();
  const revision: Revision = { id, entryId: eid, parents: sortedParents, sealed: seal(key, enc.encode(JSON.stringify(content)), aad(bundle.header, id, eid, sortedParents), random) };
  return validateBundle({ ...bundle, revisions: [...bundle.revisions, revision] });
}
export function markdown(bundle: Bundle, key: Uint8Array): string {
  return entries(bundle, key).flatMap(e => e.heads.filter(h => !h.content.deleted).map((h, i) =>
    `# ${h.content.date}${e.heads.length > 1 ? ` (conflict ${i + 1})` : ''}\n\n${h.content.text}\n`
  )).join('\n---\n\n');
}
export function localDate(now = new Date()) {
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
}
export type Pairing = { url: string; token: string };
export function parsePairing(text: string): Pairing {
  const p = JSON.parse(text) as Pairing;
  const url = new URL(p.url);
  const octets = url.hostname.split('.').map(Number);
  assert(octets.length === 4 && octets.every(n => Number.isInteger(n) && n >= 0 && n <= 255) &&
    (octets[0] === 10 || octets[0] === 192 && octets[1] === 168 || octets[0] === 172 && octets[1] >= 16 && octets[1] <= 31 || url.hostname === '127.0.0.1'), '只允许局域网 IPv4 地址');
  assert(url.protocol === 'http:' && url.pathname === '/' && !url.username && !url.password && !url.search && !url.hash && isHex(p.token, 32), '配对信息无效');
  return { url: url.origin, token: p.token };
}
export function packTransport(token: string, payload: unknown, random: Random, direction: 'request' | 'response'): Sealed {
  return seal(hexToBytes(token), enc.encode(JSON.stringify(payload)), enc.encode(`diary-pair-v1-${direction}`), random);
}
export function unpackTransport(token: string, payload: unknown, direction: 'request' | 'response'): unknown {
  const s = payload as Sealed;
  assert(s && isHex(s.nonce, 12) && isHex(s.ciphertext) && s.ciphertext.length >= 32 && s.ciphertext.length <= MAX_BYTES * 2 + 4096, '同步消息格式错误');
  return JSON.parse(dec.decode(open(hexToBytes(token), s, enc.encode(`diary-pair-v1-${direction}`))));
}
export async function exchange(pairing: Pairing, bundle: Bundle | null, random: Random): Promise<Bundle | null> {
  const requestId = bytesToHex(random(16));
  const res = await fetch(`${pairing.url}/sync`, {
    method: 'POST', redirect: 'error', signal: AbortSignal.timeout(15000),
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(packTransport(pairing.token, { requestId, bundle }, random, 'request'))
  });
  if (!res.ok) throw new Error('同步失败：检查电脑服务、同一 Wi-Fi、防火墙及配对码有效期');
  const text = await res.text();
  assert(text.length <= MAX_BYTES * 2 + 4096, '同步响应过大');
  const result = unpackTransport(pairing.token, JSON.parse(text), 'response') as { requestId: string; bundle: Bundle | null };
  assert(result.requestId === requestId, '同步响应不匹配');
  return result.bundle === null ? null : validateBundle(result.bundle);
}
