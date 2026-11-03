import type { McpStatus } from "./mcp-types";
import type { Snapshot } from "@ledger/storage";
export const mcpAvailable = () => false;
export const mcpStatus = async (): Promise<McpStatus> => ({
  available: false,
  enabled: false,
  requests: 0,
});
export const mcpSetEnabled = async (_enabled: boolean): Promise<McpStatus> =>
  mcpStatus();
export const mcpRotateKey = mcpStatus;
export const mcpCopy = async (_text: string) => {
  throw new Error("请在桌面端复制连接配置");
};
export const startMcpBridge =
  async (_snapshot: () => Promise<Snapshot>): Promise<() => void> =>
  () => {};
