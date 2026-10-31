export type { LanHostInfo, LanHostStatus } from "./lan-platform.web";
import type { LanHostInfo, LanHostStatus } from "./lan-platform.web";
export const lanHostAvailable = () => false;
const unavailable = async (): Promise<never> => {
  throw new Error("请在桌面端开启连接，手机扫码或粘贴连接码");
};
export const lanHostStart = (_backup: string): Promise<LanHostInfo> =>
  unavailable();
export const lanHostStatus = (): Promise<LanHostStatus> => unavailable();
export const lanHostStop = async (): Promise<void> => {};
export const lanHostComplete = (
  _id: string,
  _success: boolean,
): Promise<void> => unavailable();
