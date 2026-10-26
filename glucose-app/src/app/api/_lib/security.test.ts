import assert from "node:assert/strict";
import { afterEach, beforeEach, test } from "node:test";
import { POST as register } from "../register/route";
import { POST as enroll } from "../enroll/route";
import { GET as publicConfig } from "../config/route";
import { serverConfig, validFamilyCode, verifyRequest } from "./server";

const originalFetch = globalThis.fetch;
const names = ["SUPABASE_URL", "SUPABASE_ANON_KEY", "SUPABASE_SERVICE_ROLE_KEY", "FAMILY_ACCESS_CODE", "NEXT_PUBLIC_SUPABASE_URL", "NEXT_PUBLIC_SUPABASE_ANON_KEY"] as const;
const previous = Object.fromEntries(names.map(name => [name, process.env[name]]));
const anon = `header.${Buffer.from(JSON.stringify({ role: "anon" })).toString("base64url")}.signature`;
const accessCode = "test-family-code-123456";
const createdId = "11111111-1111-4111-8111-111111111111";
let requestNumber = 0;

beforeEach(() => {
  process.env.SUPABASE_URL = "https://example.supabase.co";
  process.env.SUPABASE_ANON_KEY = anon;
  process.env.SUPABASE_SERVICE_ROLE_KEY = "test-server-secret";
  process.env.FAMILY_ACCESS_CODE = accessCode;
});
afterEach(() => {
  globalThis.fetch = originalFetch;
  for (const name of names) {
    if (previous[name] === undefined) delete process.env[name];
    else process.env[name] = previous[name];
  }
});

function request(body: Record<string, unknown>, headers: Record<string, string> = {}) {
  return new Request("https://app.example/api/register", {
    method: "POST", headers: {
      Host: "app.example", Origin: "https://app.example", "Content-Type": "application/json",
      "X-Forwarded-For": `test-${++requestNumber}`, ...headers,
    }, body: JSON.stringify(body),
  });
}
function response(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });
}

test("public config only exposes known public credentials and configuration flags", async () => {
  const result = await publicConfig().json();
  assert.deepEqual(Object.keys(result).sort(), ["anonKey", "configured", "registrationAvailable", "url"]);
  assert.equal(result.anonKey, anon);
  assert.equal(result.configured, true);
  for (const key of ["sb_secret_admin-credential", `header.${Buffer.from(JSON.stringify({ role: "service_role" })).toString("base64url")}.signature`, `header.${Buffer.from(JSON.stringify({ role: "authenticated" })).toString("base64url")}.signature`]) {
    process.env.SUPABASE_ANON_KEY = key;
    const rejected = serverConfig();
    assert.equal(rejected.configured, false);
    assert.equal(rejected.anonKey, "");
  }
});

test("same-origin verification uses external host behind Next bind address and rejects cross origin", () => {
  const valid = new Request("http://0.0.0.0:3100/api/register", {
    method: "POST", headers: { Host: "localhost:3100", Origin: "http://localhost:3100", "Content-Type": "application/json" }, body: "{}",
  });
  assert.equal(verifyRequest(valid, "test-origin"), null);
  assert.equal(verifyRequest(request({}, { Origin: "https://attacker.example" }), "test-origin")?.status, 403);
  assert.equal(verifyRequest(request({}, { "Content-Type": "text/plain" }), "test-origin")?.status, 415);
  assert.equal(verifyRequest(request({}, { "Content-Length": "9000" }), "test-origin")?.status, 413);
});

test("family code comparison is exact and rejects oversized or missing inputs", () => {
  assert.equal(validFamilyCode(accessCode, accessCode), true);
  for (const code of [null, undefined, 123, `${accessCode} `, "x".repeat(257)]) assert.equal(validFamilyCode(code, accessCode), false);
  assert.equal(validFamilyCode("", ""), false);
});

test("wrong family code never calls Supabase", async () => {
  globalThis.fetch = async () => { throw new Error("Supabase must not be contacted"); };
  const result = await register(request({ email: "family@example.com", password: "password123", code: "wrong" }));
  assert.equal(result.status, 403);
});

test("existing email cannot gain access or trigger deletion through registration", async () => {
  const calls: string[] = [];
  globalThis.fetch = async (input, init) => {
    calls.push(`${init?.method ?? "GET"} ${String(input)}`);
    return response({ msg: "A user with this email address has already been registered", code: "email_exists" }, 422);
  };
  const result = await register(request({ email: "existing@example.com", password: "password123", code: accessCode }));
  assert.equal(result.status, 400);
  assert.equal(calls.length, 1);
  assert.match(calls[0], /^POST .*\/auth\/v1\/admin\/users$/);
});

test("failed access insert compensates only the newly created auth identity", async () => {
  const calls: { method: string; url: string; body: string }[] = [];
  globalThis.fetch = async (input, init) => {
    const call = { method: init?.method ?? "GET", url: String(input), body: String(init?.body ?? "") };
    calls.push(call);
    if (call.url.endsWith("/auth/v1/admin/users") && call.method === "POST") return response({ id: createdId, email: "new@example.com" });
    if (call.url.includes("/rest/v1/glucose_accounts")) return response({ code: "42501", message: "denied" }, 403);
    if (call.url.endsWith(`/auth/v1/admin/users/${createdId}`) && call.method === "DELETE") return response({ id: createdId });
    throw new Error("Unexpected operation");
  };
  const result = await register(request({ email: "new@example.com", password: "password123", code: accessCode, user_id: "existing-victim" }));
  assert.equal(result.status, 503);
  assert.equal(calls.length, 3);
  assert.ok(calls[1].body.includes(createdId));
  assert.doesNotMatch(calls.map(call => call.body + call.url).join(""), /existing-victim/);
  assert.equal(calls[2].method, "DELETE");
});

test("successful registration grants only the id returned by admin createUser", async () => {
  const calls: string[] = [];
  globalThis.fetch = async (input, init) => {
    const url = String(input);
    calls.push(url);
    if (url.endsWith("/auth/v1/admin/users")) return response({ id: createdId, email: "new@example.com" });
    assert.match(url, /\/rest\/v1\/glucose_accounts$/);
    assert.deepEqual(JSON.parse(String(init?.body)), { user_id: createdId, status: "active" });
    return new Response(null, { status: 201 });
  };
  const result = await register(request({ email: "new@example.com", password: "password123", code: accessCode, user_id: "victim" }));
  assert.equal(result.status, 200);
  assert.deepEqual(await result.json(), { ok: true });
  assert.equal(calls.length, 2);
});

test("an invalid bearer token cannot write application access", async () => {
  let calls = 0;
  globalThis.fetch = async (input) => {
    calls += 1;
    assert.match(String(input), /\/auth\/v1\/user$/);
    return response({ msg: "Invalid JWT", code: "bad_jwt" }, 401);
  };
  const result = await enroll(request({ code: accessCode, user_id: "victim" }, { Authorization: "Bearer invalid-token" }));
  assert.equal(result.status, 401);
  assert.equal(calls, 1);
});

test("existing-account enrollment uses the verified bearer identity and ignores submitted identity", async () => {
  const inserts: string[] = [];
  globalThis.fetch = async (input, init) => {
    const url = String(input);
    const method = init?.method ?? "GET";
    if (url.endsWith("/auth/v1/user")) {
      assert.equal(new Headers(init?.headers).get("authorization"), "Bearer authenticated-token");
      return response({ id: "verified-user", email: "verified@example.com" });
    }
    if (url.includes("/rest/v1/glucose_accounts") && method === "POST") {
      inserts.push(String(init?.body));
      return new Response(null, { status: 201 });
    }
    if (url.includes("/rest/v1/glucose_accounts") && method === "GET") {
      assert.ok(url.includes("user_id=eq.verified-user"));
      return response(inserts.length ? { status: "active" } : []);
    }
    throw new Error("Unexpected operation");
  };
  const result = await enroll(request({ code: accessCode, user_id: "victim", email: "victim@example.com" }, { Authorization: "Bearer authenticated-token" }));
  assert.equal(result.status, 200);
  assert.equal(inserts.length, 1);
  assert.match(inserts[0], /verified-user/);
  assert.doesNotMatch(inserts[0], /victim/);
});

test("suspended users cannot reactivate themselves with the family code", async () => {
  let calls = 0;
  globalThis.fetch = async (input, init) => {
    calls += 1;
    const url = String(input);
    if (url.endsWith("/auth/v1/user")) return response({ id: "suspended-user" });
    assert.equal(init?.method ?? "GET", "GET");
    return response([{ status: "suspended" }]);
  };
  const result = await enroll(request({ code: accessCode }, { Authorization: "Bearer authenticated-token" }));
  assert.equal(result.status, 403);
  assert.equal(calls, 2);
});

test("per-instance limiter rejects repeated account attempts", () => {
  for (let attempt = 0; attempt < 12; attempt++) assert.equal(verifyRequest(request({}, { "X-Forwarded-For": "rate-test" }), "rate-test"), null);
  assert.equal(verifyRequest(request({}, { "X-Forwarded-For": "rate-test" }), "rate-test")?.status, 429);
});
