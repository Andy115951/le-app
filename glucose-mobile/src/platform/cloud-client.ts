import "react-native-url-polyfill/auto";
import { createClient, processLock } from "@supabase/supabase-js";
import { authStorage } from "./auth-storage";
import { normalizePublicOrigin, readPublicCloudConfig, type PublicCloudConfig } from "../core/cloud-config";

export const WEB_ORIGIN = (() => {
  try {
    const value = process.env.EXPO_PUBLIC_WEB_ORIGIN;
    return value?.trim() ? normalizePublicOrigin(value) : null;
  } catch { return null; }
})();
export async function timedFetch(input: RequestInfo | URL, init: RequestInit = {}) {
  const controller = new AbortController();
  const abort = () => controller.abort();
  const timeout = setTimeout(abort, 20000);
  if (init.signal?.aborted) abort();
  init.signal?.addEventListener("abort", abort);
  try { return await fetch(input, { ...init, signal: controller.signal }); }
  finally { clearTimeout(timeout); init.signal?.removeEventListener("abort", abort); }
}
export async function fetchPublicConfig(): Promise<PublicCloudConfig> {
  // Build-time public subset works on both native and Web without cross-origin config requests.
  // Use direct env-property access so Expo can inline these public build values.
  return readPublicCloudConfig({
    url: process.env.EXPO_PUBLIC_SUPABASE_URL,
    anonKey: process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY,
    webOrigin: process.env.EXPO_PUBLIC_WEB_ORIGIN,
  });
}
export function createCloud(config: PublicCloudConfig) {
  if (!config.configured || !config.url || !config.anonKey) return null;
  return createClient(config.url, config.anonKey, {
    auth: { storage: authStorage, storageKey: "glucose-expo-auth-v1", persistSession: true, autoRefreshToken: true, detectSessionInUrl: false, lock: processLock },
    global: { fetch: timedFetch },
  });
}
