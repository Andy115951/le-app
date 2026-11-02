import { before, test } from 'node:test';
import assert from 'node:assert/strict';
import { randomBytes, pbkdf2Sync, createDecipheriv } from 'node:crypto';
import { append, createVault, entries, mergeBundles, readRevisions, unlock, validateBundle, parsePairing, packTransport, unpackTransport, type Bundle } from '../src/core.ts';
import { Session } from '../src/session.ts';

const random = (n: number) => new Uint8Array(randomBytes(n));
const password = 'fictional-test-passphrase-only';
let base: Bundle;
let key: Uint8Array;
before(async () => { ({ bundle: base, key } = await createVault(password, random)); });
const content = (text: string, deleted = false) => ({ date: '2026-01-15', text, updatedAt: '2026-01-15T12:00:00.000Z', deleted });
function fixture() { return append(base, key, random, content('Fictional entry: a walk in an imaginary park.')); }

test('AES-GCM and PBKDF2 interoperate with the platform implementation', () => {
  const h = base.header;
  const derived = pbkdf2Sync(password, Buffer.from(h.salt, 'hex'), h.iterations, 32, 'sha256');
  assert.deepEqual(derived, Buffer.from(key));
  const cipher = Buffer.from(h.check.ciphertext, 'hex');
  const decipher = createDecipheriv('aes-256-gcm', derived, Buffer.from(h.check.nonce, 'hex'));
  decipher.setAAD(Buffer.from(JSON.stringify(['diary-inbox-v1', h.vaultId, h.salt, h.iterations, 'check', '', []])));
  decipher.setAuthTag(cipher.subarray(-16));
  assert.equal(Buffer.concat([decipher.update(cipher.subarray(0, -16)), decipher.final()]).toString(), 'diary-inbox-key-check-v1');
});
test('wrong passphrases and modified ciphertext are rejected', async () => {
  await assert.rejects(unlock(fixture(), 'incorrect-fictional-password'));
  const valid = await unlock(fixture(), password); valid.fill(0);
  const bad = structuredClone(fixture());
  const cipher = bad.revisions[0].sealed.ciphertext;
  bad.revisions[0].sealed.ciphertext = (cipher[0] === '0' ? '1' : '0') + cipher.slice(1);
  assert.throws(() => readRevisions(bad, key));
});
test('offline edits converge, retain both heads, resolve and propagate deletion', () => {
  const start = fixture(); const first = start.revisions[0];
  const phone = append(start, key, random, content('Fictional phone edit'), first.entryId, [first.id]);
  const desktop = append(start, key, random, content('Fictional desktop edit'), first.entryId, [first.id]);
  const merged = mergeBundles(phone, desktop);
  assert.deepEqual(merged, mergeBundles(desktop, phone));
  assert.deepEqual(merged, mergeBundles(merged, phone));
  assert.equal(entries(merged, key)[0].heads.length, 2);
  const resolved = append(merged, key, random, content('Fictional merged text'), first.entryId, entries(merged, key)[0].heads.map(h => h.id));
  assert.equal(entries(resolved, key)[0].heads.length, 1);
  const last = resolved.revisions.at(-1)!;
  const deleted = append(resolved, key, random, content('', true), first.entryId, [last.id]);
  assert.equal(entries(mergeBundles(deleted, phone), key)[0].heads[0].content.deleted, true);
});
test('malformed histories, metadata tampering, ID collisions and other vaults are rejected', async () => {
  const start = fixture();
  const missing = structuredClone(start); missing.revisions[0].parents = ['ab'.repeat(16)];
  assert.throws(() => validateBundle(missing));
  const cycle = structuredClone(start); cycle.revisions[0].parents = [cycle.revisions[0].id];
  assert.throws(() => validateBundle(cycle));
  const changed = structuredClone(start); changed.revisions[0].entryId = 'cd'.repeat(16);
  assert.throws(() => readRevisions(changed, key));
  assert.throws(() => mergeBundles(start, changed));
  const other = await createVault(password, random);
  assert.throws(() => mergeBundles(start, other.bundle)); other.key.fill(0);
});
test('failed authenticated import never reaches persistent storage', async () => {
  const start = fixture(); let persisted = start;
  const memory = { load: async () => persisted, merge: async (b: Bundle) => (persisted = mergeBundles(persisted, b)) };
  const ss = await Session.open(start, password, memory, random);
  const bad = append(start, key, random, content('Fictional incoming record'));
  bad.revisions.at(-1)!.sealed.ciphertext = '00'.repeat(32);
  await assert.rejects(ss.import(bad));
  assert.deepEqual(persisted, start); ss.lock();
});
test('deleted-vs-edited offline conflict is preserved', () => {
  const start = fixture(), r = start.revisions[0];
  const deleted = append(start, key, random, content('', true), r.entryId, [r.id]);
  const edited = append(start, key, random, content('Fictional offline edit'), r.entryId, [r.id]);
  assert.equal(entries(mergeBundles(deleted, edited), key)[0].heads.length, 2);
});
test('pairing validates private IPv4 and encrypts in both directions', () => {
  const token = 'ef'.repeat(32);
  assert.equal(parsePairing(JSON.stringify({ url: 'http://192.168.1.2:47831', token })).token, token);
  for (const url of ['http://example.com', 'http://8.8.8.8', 'http://user:password@192.168.1.2', 'http://192.168.1.2/sync', 'file:///etc/passwd']) {
    assert.throws(() => parsePairing(JSON.stringify({ url, token })));
  }
  const sealed = packTransport(token, { text: 'fictional transport' }, random, 'request');
  assert.equal(JSON.stringify(sealed).includes(token), false);
  assert.deepEqual(unpackTransport(token, sealed, 'request'), { text: 'fictional transport' });
  assert.throws(() => unpackTransport(token, sealed, 'response'));
});
