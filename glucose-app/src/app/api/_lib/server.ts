import "server-only";
import { createHash, timingSafeEqual } from "node:crypto";
import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";

const attempts = new Map<string, { count: number; expires: number }>();
const WINDOW_MS = 15 * 60 * 1000;

export function serverConfig() {
  const url = process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
  const anonKey = process.env.SUPABASE_ANON_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "";
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY ?? "";
  const familyCode = process.env.FAMILY_ACCESS_CODE ?? "";
  let validUrl = false;
  try { const parsed = new URL(url); validUrl = parsed.protocol === "https:" || (parsed.protocol === "http:" && ["localhost", "127.0.0.1"].includes(parsed.hostname)); } catch { /* unconfigured */ }
  // Never publish a service-role JWT accidentally placed into the anon-key variable.
  let publicKey = anonKey.startsWith("sb_publishable_") ? anonKey : "";
  try {
    const payload = JSON.parse(Buffer.from(anonKey.split(".")[1] ?? "", "base64url").toString());
    if (payload.role === "anon") publicKey = anonKey;
  } catch { /* new publishable keys do not use JWT encoding */ }
  if (anonKey.startsWith("sb_secret_") || (serviceRoleKey && anonKey === serviceRoleKey)) publicKey = "";
  return { url, anonKey: publicKey, serviceRoleKey, familyCode, configured: validUrl && !!publicKey };
}

export function jsonError(message: string, status = 400) {
  return NextResponse.json({ error: message }, { status, headers: { "Cache-Control": "no-store" } });
}

export function verifyRequest(request: Request, operation: string): Response | null {
  const origin = request.headers.get("origin");
  const requestUrl = new URL(request.url);
  // Next's internal request URL may use its bind address (0.0.0.0) or proxy protocol.
  // Host identifies the page actually requested by the browser; browsers cannot override it.
  const host = (request.headers.get("host") ?? requestUrl.host).toLowerCase();
  const protocol = request.headers.get("x-forwarded-proto")?.split(",")[0]?.trim() ?? requestUrl.protocol.slice(0, -1);
  let sameOrigin = false;
  try {
    const parsedOrigin = new URL(origin ?? "");
    sameOrigin = origin === parsedOrigin.origin && parsedOrigin.host === host && parsedOrigin.protocol === `${protocol}:`;
  } catch { /* absent or invalid Origin */ }
  if (!sameOrigin) return jsonError("请求来源未通过校验，请从本网页重试。", 403);
  if (!request.headers.get("content-type")?.toLowerCase().startsWith("application/json")) return jsonError("请使用网页表单提交。", 415);
  if (Number(request.headers.get("content-length") ?? 0) > 8192) return jsonError("提交内容过长。", 413);
  const now = Date.now();
  for (const [key, value] of attempts) if (value.expires < now) attempts.delete(key);
  // Vercel provides the request IP. This is a small per-instance abuse guard, not a global quota.
  const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
  const key = createHash("sha256").update(`${operation}:${ip}`).digest("hex");
  if (attempts.size >= 5000 && !attempts.has(key)) return jsonError("服务暂忙，请稍后重试。", 429);
  const current = attempts.get(key) ?? { count: 0, expires: now + WINDOW_MS };
  if (current.count >= 12) return jsonError("尝试次数较多，请 15 分钟后重试。", 429);
  current.count += 1;
  if (attempts.size < 5000 || attempts.has(key)) attempts.set(key, current);
  return null;
}

export async function requestBody(request: Request): Promise<Record<string, unknown> | null> {
  try {
    const reader = request.body?.getReader();
    if (!reader) return null;
    const chunks: Uint8Array[] = [];
    let size = 0;
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > 8192) { await reader.cancel(); return null; }
      chunks.push(value);
    }
    const bytes = new Uint8Array(size);
    let offset = 0;
    for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.byteLength; }
    const raw = new TextDecoder("utf-8", { fatal: true }).decode(bytes);
    const value: unknown = JSON.parse(raw);
    return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : null;
  } catch { return null; }
}

export function validFamilyCode(submitted: unknown, expected: string) {
  if (typeof submitted !== "string" || submitted.length > 256 || !expected) return false;
  const providedHash = createHash("sha256").update(submitted).digest();
  const expectedHash = createHash("sha256").update(expected).digest();
  return timingSafeEqual(providedHash, expectedHash);
}

export function adminCloud() {
  const config = serverConfig();
  if (!config.configured || !config.serviceRoleKey || !config.familyCode) return null;
  return createClient(config.url, config.serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false, detectSessionInUrl: false },
    global: { fetch: (input, init) => fetch(input, { ...init, signal: AbortSignal.timeout(20000) }) },
  });
}
