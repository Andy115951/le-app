import { invoke, isTauri } from "@tauri-apps/api/core";
import { openTauriLedger } from "@ledger/storage/tauri";
import { invariant } from "@ledger/core";
export const loadAppearance = async () =>
  globalThis.localStorage.getItem("ledger.appearance.font.v1");
export const saveAppearance = async (font: string) => {
  globalThis.localStorage.setItem("ledger.appearance.font.v1", font);
};
export const loadVaultPreference = async () =>
  globalThis.localStorage.getItem("ledger.appearance.vault.v1");
export const saveVaultPreference = async (enabled: boolean) => {
  globalThis.localStorage.setItem(
    "ledger.appearance.vault.v1",
    String(enabled),
  );
};
export const randomUUID = () => globalThis.crypto.randomUUID();
export const loadAssetVisibility = async () =>
  globalThis.localStorage.getItem("ledger.privacy.asset-visible.v1");
export const saveAssetVisibility = async (visible: boolean) => {
  globalThis.localStorage.setItem(
    "ledger.privacy.asset-visible.v1",
    String(visible),
  );
};
export async function openLedger() {
  invariant(
    isTauri(),
    "此 Web 输出供桌面应用使用。请运行 Android 应用或通过 Tauri 打开桌面端。",
  );
  return openTauriLedger(randomUUID);
}
export const saveBackup = (json: string) =>
  invoke<boolean>("backup_export", { json });
export const pickBackup = () => invoke<string | null>("backup_pick");
