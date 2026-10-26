export interface PublicCloudInput {
  url?: string | null;
  anonKey?: string | null;
  webOrigin?: string | null;
}

export interface PublicCloudConfig {
  configured: boolean;
  registrationAvailable: boolean;
  url: string | null;
  anonKey: string | null;
  webOrigin: string | null;
}

/** Accept deployment origins, with HTTP reserved for loopback development. */
export function normalizePublicOrigin(value: string): string {
  let url: URL;
  try { url = new URL(value.trim()); } catch { throw new Error("Invalid service origin."); }
  const loopback = ["localhost", "127.0.0.1", "[::1]"].includes(url.hostname);
  if ((url.protocol !== "https:" && !(loopback && url.protocol === "http:")) ||
      url.username || url.password || url.search || url.hash || url.pathname !== "/") {
    throw new Error("Use an HTTPS service origin without credentials, path, query, or fragment.");
  }
  return url.origin;
}

/** This checks public-key type, not JWT authenticity or user authentication. */
export function isPublicSupabaseKey(value: unknown): value is string {
  if (typeof value !== "string" || value !== value.trim()) return false;
  if (/^sb_publishable_[A-Za-z0-9_-]+$/.test(value)) return true;
  const parts = value.split(".");
  if (parts.length !== 3 || !parts.every(part => /^[A-Za-z0-9_-]+$/.test(part))) return false;
  try {
    const alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";
    let bits = 0; let count = 0; let decoded = "";
    for (const char of parts[1].replace(/-/g, "+").replace(/_/g, "/")) {
      bits = (bits << 6) | alphabet.indexOf(char);
      count += 6;
      if (count >= 8) { count -= 8; decoded += String.fromCharCode((bits >> count) & 255); }
    }
    return JSON.parse(decoded)?.role === "anon";
  } catch { return false; }
}

export function readPublicCloudConfig(input: PublicCloudInput): PublicCloudConfig {
  const rawUrl = input.url?.trim() || "";
  const key = input.anonKey?.trim() || "";
  const webOrigin = input.webOrigin?.trim() ? normalizePublicOrigin(input.webOrigin) : null;
  if (!rawUrl && !key) {
    return { configured: false, registrationAvailable: !!webOrigin, url: null, anonKey: null, webOrigin };
  }
  if (!rawUrl || !key) throw new Error("Set both the Supabase URL and public client key.");
  const url = normalizePublicOrigin(rawUrl);
  if (!isPublicSupabaseKey(key)) throw new Error("Supabase client configuration requires a public anon or publishable key.");
  return { configured: true, registrationAvailable: !!webOrigin, url, anonKey: key, webOrigin };
}

export function configFromWebPayload(payload: unknown, expectedUrl: string, webOrigin: string): PublicCloudConfig {
  const expected = normalizePublicOrigin(expectedUrl);
  if (!payload || typeof payload !== "object") throw new Error("Public cloud configuration is unavailable.");
  const candidate = payload as Record<string, unknown>;
  if (candidate.configured !== true || typeof candidate.url !== "string" || typeof candidate.anonKey !== "string") {
    throw new Error("Public cloud configuration is unavailable.");
  }
  const config = readPublicCloudConfig({ url: candidate.url, anonKey: candidate.anonKey, webOrigin });
  if (config.url !== expected) throw new Error("The returned Supabase target does not match the explicitly selected project.");
  return config;
}
