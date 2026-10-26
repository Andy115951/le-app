import { writeFile } from "node:fs/promises";
import { configFromWebPayload, normalizePublicOrigin } from "../src/core/cloud-config.ts";

const values = new Map();
for (let index = 2; index < process.argv.length; index += 2) {
  const flag = process.argv[index];
  const value = process.argv[index + 1];
  if (!["--web-origin", "--supabase-url"].includes(flag) || !value || value.startsWith("--") || values.has(flag)) {
    throw new Error("Usage: npm run configure -- --web-origin <origin> --supabase-url <expected-origin>");
  }
  values.set(flag, value);
}
const selectedOrigin = values.get("--web-origin") || process.env.EXPO_PUBLIC_WEB_ORIGIN;
const selectedUrl = values.get("--supabase-url") || process.env.GLUCOSE_EXPECTED_SUPABASE_URL;
if (!selectedOrigin || !selectedUrl) {
  throw new Error("Select both the web origin and expected Supabase origin before requesting public configuration.");
}
const origin = normalizePublicOrigin(selectedOrigin);
const expected = normalizePublicOrigin(selectedUrl);
let config;
try {
  const response = await fetch(`${origin}/api/config`, { signal: AbortSignal.timeout(20000), redirect: "error" });
  if (!response.ok) throw new Error("Public configuration request failed.");
  config = configFromWebPayload(await response.json(), expected, origin);
} catch {
  throw new Error("Public configuration could not be verified. Check the selected origins and public key type.");
}
const output = [
  "# Public client configuration for the explicitly selected deployment.",
  `EXPO_PUBLIC_SUPABASE_URL=${JSON.stringify(config.url)}`,
  `EXPO_PUBLIC_SUPABASE_ANON_KEY=${JSON.stringify(config.anonKey)}`,
  `EXPO_PUBLIC_WEB_ORIGIN=${JSON.stringify(config.webOrigin)}`,
  "",
].join("\n");
await writeFile(new URL("../.env.local", import.meta.url), output, { mode: 0o600 });
console.log("Public client configuration prepared. No private server variables were copied or printed.");
