import { randomUUID } from "expo-crypto";
import { File, Paths } from "expo-file-system";
import * as DocumentPicker from "expo-document-picker";
import * as Sharing from "expo-sharing";
import { openExpoLedger } from "@ledger/storage/expo";
import { invariant } from "@ledger/core";
import Storage from "expo-sqlite/kv-store";
export const loadAppearance = () =>
  Storage.getItemAsync("ledger.appearance.font.v1");
export const saveAppearance = (font: string) =>
  Storage.setItemAsync("ledger.appearance.font.v1", font);
export const loadVaultPreference = () =>
  Storage.getItemAsync("ledger.appearance.vault.v1");
export const saveVaultPreference = (enabled: boolean) =>
  Storage.setItemAsync("ledger.appearance.vault.v1", String(enabled));
export const loadAssetVisibility = () =>
  Storage.getItemAsync("ledger.privacy.asset-visible.v1");
export const saveAssetVisibility = (visible: boolean) =>
  Storage.setItemAsync("ledger.privacy.asset-visible.v1", String(visible));
export { randomUUID };
export const openLedger = () => openExpoLedger(randomUUID);
export async function saveBackup(json: string): Promise<boolean> {
  invariant(await Sharing.isAvailableAsync(), "此设备暂不支持分享备份文件");
  const file = new File(Paths.cache, `ledger-${Date.now()}.json`);
  file.create();
  await file.write(json);
  await Sharing.shareAsync(file.uri, {
    mimeType: "application/json",
    dialogTitle: "保存账本备份",
    UTI: "public.json",
  });
  return true;
}
export async function pickBackup(): Promise<string | null> {
  const result = await DocumentPicker.getDocumentAsync({
    type: ["application/json", "text/plain", "application/octet-stream"],
    copyToCacheDirectory: true,
  });
  if (result.canceled) return null;
  const file = new File(result.assets[0].uri);
  try {
    invariant(file.size <= 20_000_000, "文件不能超过 20 MB");
    return await file.text();
  } finally {
    if (file.exists) file.delete();
  }
}
