import { invoke, isTauri } from "@tauri-apps/api/core";
export interface LanHostInfo {
  addresses: string[];
  port: number;
  key: string;
  expiresAt: number;
}
export interface LanHostStatus {
  state: "waiting" | "pending" | "downloaded" | "applied" | "rejected";
  paired: boolean;
  transferId?: string;
  incoming?: string;
}
export const lanHostAvailable = () => isTauri();
export const lanHostStart = (backup: string) =>
  invoke<LanHostInfo>("lan_start", { backup });
export const lanHostStatus = () => invoke<LanHostStatus>("lan_status");
export const lanHostStop = () => invoke<void>("lan_stop");
export const lanHostComplete = (transferId: string, success: boolean) =>
  invoke<void>("lan_complete", { transferId, success });
