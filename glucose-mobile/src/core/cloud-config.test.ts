import test from "node:test";
import assert from "node:assert/strict";
import { configFromWebPayload, isPublicSupabaseKey, normalizePublicOrigin, readPublicCloudConfig } from "./cloud-config";

const key = "sb_publishable_test_public_key";
const jwt = (role: string) => `${Buffer.from("{}").toString("base64url")}.${Buffer.from(JSON.stringify({ role })).toString("base64url")}.signature`;

test("different Supabase projects work without changing source or enabling registration", () => {
  for (const url of ["https://project-a.supabase.co", "https://database.example.com"]) {
    const config = readPublicCloudConfig({ url, anonKey: key });
    assert.equal(config.url, url);
    assert.equal(config.configured, true);
    assert.equal(config.registrationAvailable, false);
    assert.equal(config.webOrigin, null);
  }
  assert.equal(readPublicCloudConfig({ url: "https://project-a.supabase.co/", anonKey: jwt("anon"), webOrigin: "https://journal.example.com/" }).webOrigin, "https://journal.example.com");
});

test("an empty configuration supports demo mode and incomplete cloud settings fail", () => {
  assert.equal(readPublicCloudConfig({}).configured, false);
  assert.equal(readPublicCloudConfig({ webOrigin: "http://localhost:3100" }).registrationAvailable, true);
  assert.throws(() => readPublicCloudConfig({ url: "https://db.example.com" }));
  assert.throws(() => readPublicCloudConfig({ anonKey: key }));
});

test("private keys, service-role JWTs, and malformed keys cannot become client config", () => {
  for (const candidate of ["sb_secret_do_not_bundle", jwt("service_role"), jwt("authenticated"), "not-a-public-key", "e30.bm90LWpzb24.signature", "sb_publishable_"]) {
    assert.equal(isPublicSupabaseKey(candidate), false);
    assert.throws(() => readPublicCloudConfig({ url: "https://db.example.com", anonKey: candidate }));
  }
  assert.equal(isPublicSupabaseKey(jwt("anon")), true);
});

test("origins reject credential leakage and remote HTTP, but allow loopback development", () => {
  for (const value of ["http://db.example.com", "https://user:password@db.example.com", "https://db.example.com/path", "https://db.example.com?key=secret", "https://db.example.com#token", "javascript:alert(1)"]) {
    assert.throws(() => normalizePublicOrigin(value));
    assert.throws(() => readPublicCloudConfig({ webOrigin: value }));
  }
  assert.equal(normalizePublicOrigin("http://127.0.0.1:54321/"), "http://127.0.0.1:54321");
});

test("downloaded configuration must match the explicitly pinned project and public key type", () => {
  const payload = { configured: true, url: "https://db.example.com/", anonKey: key };
  assert.equal(configFromWebPayload(payload, "https://db.example.com", "https://journal.example.com").url, "https://db.example.com");
  assert.throws(() => configFromWebPayload(payload, "https://other.example.com", "https://journal.example.com"));
  for (const invalid of [null, { ...payload, configured: false }, { ...payload, anonKey: jwt("service_role") }]) {
    assert.throws(() => configFromWebPayload(invalid, "https://db.example.com", "https://journal.example.com"));
  }
});
