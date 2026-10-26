// Explicit, read-only cloud verification. Uses HEAD only; never reads row bodies.
// Example: node --env-file=.env.local scripts/check-database-security.mjs \
//   --run-live --expected-project-ref YOUR_REF \
//   --public-env-file ../glucose-mobile/.env.local
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { parseEnv } from "node:util";

async function main() {
  const args = process.argv.slice(2);
  const option = (name) =>
    args.includes(name) ? args[args.indexOf(name) + 1] : undefined;
  const expectedRef = option("--expected-project-ref");
  if (
    !args.includes("--run-live") ||
    !expectedRef ||
    !/^[a-z0-9]+$/.test(expectedRef)
  ) {
    throw new Error(
      "Requires --run-live and --expected-project-ref; ordinary tests never access the cloud.",
    );
  }
  const url = new URL(
    process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL || "",
  );
  assert.equal(
    url.href,
    `https://${expectedRef}.supabase.co/`,
    "Database target must match the explicitly expected project.",
  );
  const publicFile = option("--public-env-file");
  const publicEnv = publicFile
    ? parseEnv(await readFile(publicFile, "utf8"))
    : process.env;
  const publicUrl = new URL(
    publicEnv.EXPO_PUBLIC_SUPABASE_URL ||
      publicEnv.NEXT_PUBLIC_SUPABASE_URL ||
      publicEnv.SUPABASE_URL ||
      "",
  );
  assert.equal(
    publicUrl.origin,
    url.origin,
    "The public key must belong to the same database target.",
  );
  const anonKey =
    publicEnv.EXPO_PUBLIC_SUPABASE_ANON_KEY ||
    publicEnv.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
    publicEnv.SUPABASE_ANON_KEY;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  function keyRole(key) {
    if (key?.startsWith("sb_publishable_")) return "anon";
    if (key?.startsWith("sb_secret_")) return "service_role";
    try {
      const claims = JSON.parse(
        Buffer.from(key.split(".")[1], "base64url").toString(),
      );
      assert.equal(claims.ref, expectedRef);
      return claims.role;
    } catch {
      throw new Error(
        "Invalid or mismatched database key configuration; values are never logged.",
      );
    }
  }
  assert.equal(
    keyRole(anonKey),
    "anon",
    "The public test must never use an elevated key.",
  );
  assert.equal(
    keyRole(serviceKey),
    "service_role",
    "The server key must be explicitly configured.",
  );
  for (const table of [
    "tarot_users",
    "tarot_sessions",
    "tarot_readings",
    "tarot_messages",
    "tarot_usage_counters",
  ]) {
    const endpoint = new URL(`/rest/v1/${table}`, url);
    endpoint.searchParams.set(
      "select",
      table === "tarot_usage_counters" ? "subject_key" : "id",
    );
    for (const [role, key] of [
      ["anon", anonKey],
      ["service_role", serviceKey],
    ]) {
      const headers = {
        apikey: key,
        Prefer: "count=exact",
        "Range-Unit": "items",
        Range: "0-0",
      };
      if (!key.startsWith("sb_")) headers.Authorization = `Bearer ${key}`;
      const response = await fetch(endpoint, {
        method: "HEAD",
        headers,
        signal: AbortSignal.timeout(15000),
      });
      assert.equal(
        (await response.arrayBuffer()).byteLength,
        0,
        "Only bodyless HEAD responses are permitted.",
      );
      const expected = role === "anon" ? [401, 403] : [200, 206];
      assert.ok(
        expected.includes(response.status),
        `${table}: unexpected ${role} status ${response.status}`,
      );
      if (role === "anon")
        assert.equal(
          response.headers.get("content-range"),
          null,
          "Private record counts must not be returned.",
        );
      else
        assert.match(
          response.headers.get("content-range") || "",
          /\/\d+$/,
          "The server must retain count access.",
        );
      console.log(
        JSON.stringify({
          table,
          role,
          status: response.status,
          responseBytes: 0,
        }),
      );
    }
  }
  console.log(
    "PASS: all five tables deny the public key; server access is retained. No user content was read.",
  );
}
main().catch((error) => {
  console.error(
    error instanceof Error ? error.message : "Database security check failed.",
  );
  process.exitCode = 1;
});
