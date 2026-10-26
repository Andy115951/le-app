import type { KeyValueStorage } from "../core/session-storage";

/** Web persists authentication only. Native resolves auth-storage.native.ts. */
export const authStorage: KeyValueStorage = {
  async getItem(key) { return typeof localStorage === "undefined" ? null : localStorage.getItem(key); },
  async setItem(key, value) { localStorage.setItem(key, value); },
  async removeItem(key) { if (typeof localStorage !== "undefined") localStorage.removeItem(key); },
};
