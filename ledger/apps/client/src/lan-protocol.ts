import { fromByteArray, toByteArray } from "base64-js";
import { parseBackup, type Backup } from "@ledger/core";

export const LAN_MAX_WIRE = 28_100_000;
const encoder = new TextEncoder();
const decoder = new TextDecoder();
export const encode64 = (bytes: Uint8Array) => fromByteArray(bytes);
export function decode64(value: string): Uint8Array {
  if (!/^[A-Za-z0-9+/]*={0,2}$/.test(value) || value.length % 4 !== 0)
    throw new Error("连接数据无效");
  return toByteArray(value);
}
export interface Pairing {
  host: string;
  port: number;
  key: string;
  expiresAt: number;
}
export function privateIPv4(host: string): boolean {
  if (!/^\d{1,3}(\.\d{1,3}){3}$/.test(host)) return false;
  const p = host.split(".").map(Number);
  if (p.some((n) => n > 255) || p.map(String).join(".") !== host) return false;
  return (
    p[0] === 10 ||
    p[0] === 127 ||
    (p[0] === 192 && p[1] === 168) ||
    (p[0] === 172 && p[1] >= 16 && p[1] <= 31)
  );
}
export function pairCode(pair: Pairing): string {
  return (
    "ledgerlan://v1/" +
    encode64(encoder.encode(JSON.stringify(pair)))
      .replace(/=/g, "")
      .replace(/\+/g, "-")
      .replace(/\//g, "_")
  );
}
export function parsePairCode(code: string): Pairing {
  const text = code.trim();
  if (!/^ledgerlan:\/\/v1\/[A-Za-z0-9_-]{1,900}$/.test(text))
    throw new Error("请扫描或粘贴桌面端生成的连接码");
  const part = text
    .slice("ledgerlan://v1/".length)
    .replace(/-/g, "+")
    .replace(/_/g, "/");
  let p: Pairing;
  try {
    p = JSON.parse(
      decoder.decode(
        decode64(part.padEnd(Math.ceil(part.length / 4) * 4, "=")),
      ),
    );
  } catch {
    throw new Error("连接码无效，请重新获取");
  }
  if (
    !p ||
    !privateIPv4(p.host) ||
    !Number.isInteger(p.port) ||
    p.port < 1 ||
    p.port > 65535 ||
    typeof p.key !== "string" ||
    !/^[A-Za-z0-9+/]{43}=$/.test(p.key) ||
    decode64(p.key).length !== 32 ||
    !Number.isSafeInteger(p.expiresAt)
  )
    throw new Error("连接码无效，请重新获取");
  if (p.expiresAt <= Date.now())
    throw new Error("连接码已过期，请在桌面重新开启传输");
  return p;
}
export interface LanSummary {
  accounts: number;
  entries: number;
  reconciliations: number;
  exportedAt: string;
}
export function backupSummary(json: string): LanSummary {
  const b: Backup = parseBackup(json);
  return {
    accounts: b.ledger.accounts.length,
    entries: b.ledger.entries.length,
    reconciliations: b.ledger.reconciliations.length,
    exportedAt: b.exportedAt,
  };
}
export interface LanCrypto {
  id(): string;
  seal(key: Uint8Array, plaintext: string, aad: string): Promise<string>;
  open(key: Uint8Array, envelope: string, aad: string): Promise<string>;
}
export interface LanReply {
  state: "waiting" | "pending" | "downloaded" | "applied" | "rejected";
  summary?: LanSummary;
  backup?: string;
  transferId?: string;
}
export class LanPeer {
  private clientId: string;
  private pair: Pairing;
  constructor(
    code: string,
    private crypto: LanCrypto,
    private transport: typeof fetch = fetch,
  ) {
    this.pair = parsePairCode(code);
    this.clientId = crypto.id();
  }
  async request(
    action: "inspect" | "upload" | "download" | "status" | "finish",
    extra: { backup?: string; transferId?: string; success?: boolean } = {},
  ): Promise<LanReply> {
    if (Date.now() >= this.pair.expiresAt)
      throw new Error("连接已过期，请重新连接");
    if (extra.backup) backupSummary(extra.backup);
    const requestId = this.crypto.id();
    const key = decode64(this.pair.key);
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 30_000);
    try {
      const body = await this.crypto.seal(
        key,
        JSON.stringify({
          requestId,
          clientId: this.clientId,
          action,
          ...extra,
        }),
        "ledger-lan/v1/request",
      );
      if (body.length > LAN_MAX_WIRE) throw new Error("账本超过传输大小限制");
      const response = await this.transport(
        `http://${this.pair.host}:${this.pair.port}/v1/exchange`,
        {
          method: "POST",
          headers: { "Content-Type": "application/octet-stream" },
          body,
          signal: controller.signal,
          redirect: "error",
        },
      );
      if (
        !response.ok ||
        Number(response.headers.get("Content-Length") || 0) > LAN_MAX_WIRE
      )
        throw new Error("连接失败、已被其他设备使用或已失效，请重新连接");
      const wire = await response.text();
      if (wire.length > LAN_MAX_WIRE) throw new Error("接收内容超过大小限制");
      const result = JSON.parse(
        await this.crypto.open(key, wire, "ledger-lan/v1/response"),
      );
      if (result.requestId !== requestId)
        throw new Error("响应不匹配，请重新连接");
      if (!result.ok)
        throw new Error(
          typeof result.error === "string" ? result.error : "传输失败",
        );
      if (
        !result.data ||
        !["waiting", "pending", "downloaded", "applied", "rejected"].includes(
          result.data.state,
        )
      )
        throw new Error("响应格式无效");
      if (result.data.backup) backupSummary(result.data.backup);
      return result.data;
    } catch (e) {
      if (e instanceof Error && e.name === "AbortError")
        throw new Error("连接超时，请确认两台设备在同一局域网且防火墙允许连接");
      throw e;
    } finally {
      clearTimeout(timer);
      key.fill(0);
    }
  }
}
