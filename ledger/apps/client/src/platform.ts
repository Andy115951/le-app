// Metro chooses .native.ts / .web.ts. This fallback gives TypeScript the common contract.
export {
  openLedger,
  randomUUID,
  saveBackup,
  pickBackup,
  loadAppearance,
  saveAppearance,
  loadVaultPreference,
  saveVaultPreference,
  loadAssetVisibility,
  saveAssetVisibility,
} from "./platform.native";
