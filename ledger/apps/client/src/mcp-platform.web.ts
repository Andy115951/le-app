import { invoke, isTauri } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import { writeText } from "@tauri-apps/plugin-clipboard-manager";
import {
  handleMcpRequest,
  type McpRequest,
  type SnapshotReader,
} from "./mcp-server";
import type { McpStatus } from "./mcp-types";

export const mcpAvailable = () => isTauri();
export const mcpStatus = () => invoke<McpStatus>("mcp_status");
export const mcpSetEnabled = (enabled: boolean) =>
  invoke<McpStatus>("mcp_set_enabled", { enabled });
export const mcpRotateKey = () => invoke<McpStatus>("mcp_rotate_key");
export async function mcpCopy(text: string) {
  if (isTauri()) {
    await writeText(text);
    return;
  }
  try {
    await navigator.clipboard.writeText(text);
  } catch {
    const textarea = document.createElement("textarea");
    textarea.value = text;
    textarea.style.position = "fixed";
    textarea.style.opacity = "0";
    document.body.appendChild(textarea);
    textarea.select();
    const copied = document.execCommand("copy");
    textarea.remove();
    if (!copied) throw new Error("复制失败，请重试");
  }
}
export async function startMcpBridge(
  snapshot: SnapshotReader,
): Promise<() => void> {
  if (!isTauri()) return () => {};
  const unlisten = await listen<{ id: string; request: McpRequest }>(
    "ledger-mcp-request",
    async ({ payload }) => {
      let response;
      try {
        const status = await mcpStatus();
        if (!status.enabled) throw new Error("disabled");
        response = await handleMcpRequest(payload.request, async () => {
          if (!(await mcpStatus()).enabled) throw new Error("disabled");
          return snapshot();
        });
      } catch {
        response = {
          status: 503,
          body: '{"error":"Ledger query unavailable"}',
        };
      }
      await invoke("mcp_respond", { id: payload.id, response }).catch(() => {});
    },
  );
  return () => {
    unlisten();
    void mcpSetEnabled(false).catch(() => {});
  };
}
