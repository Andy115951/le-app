import React, { useEffect, useRef, useState } from "react";
import { Platform, Pressable, TextInput, View } from "react-native";
import QRCode from "react-native-qrcode-svg";
import { exportBackup, parseBackup } from "@ledger/core";
import type { Snapshot } from "@ledger/storage";
import { Text } from "./appearance";
import { colors as c, styles as s } from "./theme";
import { randomUUID } from "./platform";
import { lanCrypto } from "./lan-crypto";
import {
  LanPeer,
  backupSummary,
  pairCode,
  parsePairCode,
  type LanSummary,
} from "./lan-protocol";
import {
  lanHostAvailable,
  lanHostStart,
  lanHostStatus,
  lanHostStop,
  lanHostComplete,
  type LanHostInfo,
} from "./lan-platform";
import { LanScanner } from "./lan-scanner";

function Action({
  children,
  onPress,
  disabled = false,
  danger = false,
}: {
  children: string;
  onPress: () => void;
  disabled?: boolean;
  danger?: boolean;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      disabled={disabled}
      onPress={onPress}
      style={[
        s.button,
        danger && { backgroundColor: c.danger },
        disabled && { opacity: 0.45 },
      ]}
    >
      <Text style={s.buttonText}>{children}</Text>
    </Pressable>
  );
}
function Summary({ title, summary }: { title: string; summary: LanSummary }) {
  return (
    <View style={{ gap: 4, paddingVertical: 8 }}>
      <Text style={s.heading}>{title}</Text>
      <Text style={s.text}>
        {summary.accounts} 个账户 · {summary.entries} 笔流水 ·{" "}
        {summary.reconciliations} 条盘点
      </Text>
      <Text style={s.muted}>
        快照时间 {summary.exportedAt.replace("T", " ")}
      </Text>
    </View>
  );
}
export function LanTransfer({
  snapshot,
  onReceive,
}: {
  snapshot: () => Promise<Snapshot>;
  onReceive: (json: string, token: string) => Promise<void>;
}) {
  const host = lanHostAvailable();
  const [info, setInfo] = useState<LanHostInfo>();
  const [address, setAddress] = useState("");
  const [code, setCode] = useState("");
  const [scanning, setScanning] = useState(false);
  const [summary, setSummary] = useState<LanSummary>();
  const [local, setLocal] = useState<LanSummary>();
  const [pending, setPending] = useState<{
    json: string;
    token: string;
    id: string;
  }>();
  const [state, setState] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const peer = useRef<LanPeer | undefined>(undefined);
  const base = useRef<Snapshot | undefined>(undefined);
  const hostOn = useRef(false);
  const lock = useRef(false);
  const alive = useRef(true);
  const scanned = useRef(false);
  const activeId = useRef("");
  const committed = useRef(false);
  const stop = async () => {
    hostOn.current = false;
    peer.current = undefined;
    base.current = undefined;
    activeId.current = "";
    setInfo(undefined);
    setPending(undefined);
    setSummary(undefined);
    setLocal(undefined);
    setCode("");
    setState("");
    committed.current = false;
    if (host) await lanHostStop();
  };
  useEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
      peer.current = undefined;
      base.current = undefined;
      if (hostOn.current) {
        hostOn.current = false;
        void lanHostStop().catch(() => {});
      }
    };
  }, [host]);
  useEffect(() => {
    if (!info) return;
    let running = false;
    const timer = setInterval(() => {
      if (running || !hostOn.current) return;
      running = true;
      void lanHostStatus()
        .then((status) => {
          if (!alive.current) return;
          if (status.incoming && status.transferId) {
            backupSummary(status.incoming);
            setPending({
              json: status.incoming,
              token: base.current!.token,
              id: status.transferId,
            });
            setState("手机已发送账本，等待你在这台桌面确认覆盖");
          } else if (status.state === "applied")
            setState("传输完成，接收方已备份原账本并完成覆盖");
          else if (status.state === "rejected")
            setState("接收方已取消，或覆盖失败；请重新开启连接后再试");
          else if (status.state === "downloaded")
            setState("手机已收到快照，等待手机确认是否覆盖");
          else if (status.state === "pending")
            setState("手机已发送账本，等待本机确认覆盖");
          else if (status.paired) setState("手机已连接，请在手机选择覆盖方向");
        })
        .catch((e) => {
          if (alive.current) {
            setError(String(e));
            void stop().catch(() => {});
          }
        })
        .finally(() => {
          running = false;
        });
    }, 1500);
    return () => clearInterval(timer);
  }, [info]);
  async function run(task: () => Promise<void>) {
    if (lock.current) return;
    lock.current = true;
    setBusy(true);
    setError("");
    try {
      await task();
    } catch (e) {
      if (alive.current) setError(e instanceof Error ? e.message : String(e));
    } finally {
      lock.current = false;
      if (alive.current) setBusy(false);
    }
  }
  async function start() {
    await run(async () => {
      const current = await snapshot();
      const json = exportBackup(current.ledger);
      const next = await lanHostStart(json);
      if (!alive.current) {
        await lanHostStop();
        return;
      }
      base.current = current;
      hostOn.current = true;
      setInfo(next);
      setAddress(next.addresses[0]);
      setLocal(backupSummary(json));
      setState("等待手机扫码或粘贴连接码，10 分钟内有效");
    });
  }
  async function connect() {
    await run(async () => {
      const next = new LanPeer(code, lanCrypto);
      const reply = await next.request("inspect");
      const current = await snapshot();
      peer.current = next;
      base.current = current;
      setSummary(reply.summary);
      setLocal(backupSummary(exportBackup(current.ledger)));
      setState("已连接，请选择哪台设备覆盖另一台");
    });
  }
  async function send() {
    await run(async () => {
      const current = base.current!;
      const latest = await snapshot();
      if (latest.token !== current.token)
        throw new Error("本机账本已变化，请关闭连接后重新连接并核对账本摘要");
      const json = exportBackup(current.ledger);
      activeId.current ||= randomUUID();
      const reply = await peer.current!.request("upload", {
        backup: json,
        transferId: activeId.current,
      });
      setState(
        reply.state === "applied"
          ? "桌面已完成覆盖"
          : "已发送，等待桌面确认覆盖。请保持两端在此页面。",
      );
    });
  }
  async function receive() {
    await run(async () => {
      const current = await snapshot();
      const id = (activeId.current ||= randomUUID());
      const reply = await peer.current!.request("download", { transferId: id });
      if (!reply.backup) throw new Error("未收到有效账本");
      parseBackup(reply.backup);
      setPending({ json: reply.backup, token: current.token, id });
      setState("已接收桌面快照，请确认是否覆盖这台手机");
    });
  }
  async function poll() {
    await run(async () => {
      const reply = await peer.current!.request("status");
      setState(
        reply.state === "applied"
          ? "传输完成，桌面已自动备份并完成覆盖"
          : reply.state === "rejected"
            ? "桌面已拒绝或覆盖失败，请重新连接"
            : "桌面尚未完成覆盖，请在桌面查看确认提示",
      );
    });
  }
  async function apply() {
    if (!pending) return;
    await run(async () => {
      // Mark committed before acknowledging: an acknowledgement failure must never repeat restore.
      if (!committed.current) {
        await onReceive(pending.json, pending.token);
        committed.current = true;
      }
      try {
        if (host) await lanHostComplete(pending.id, true);
        else
          await peer.current!.request("finish", {
            transferId: pending.id,
            success: true,
          });
        setState("本机已覆盖完成，原账本已自动备份");
        setPending(undefined);
      } catch {
        setState(
          "本机已覆盖并保留原账本备份，但对端确认未送达；可点下方按钮重发完成通知。",
        );
        throw new Error("完成通知未送达，重试只发送通知，不会再次覆盖账本");
      }
    });
  }
  async function reject() {
    if (!pending) return;
    await run(async () => {
      if (host) await lanHostComplete(pending.id, false);
      else
        await peer.current!.request("finish", {
          transferId: pending.id,
          success: false,
        });
      setPending(undefined);
      setState("已取消覆盖，本机账本未改变");
    });
  }
  const pairing =
    info && address
      ? pairCode({
          host: address,
          port: info.port,
          key: info.key,
          expiresAt: info.expiresAt,
        })
      : "";
  return (
    <View style={{ gap: 18 }}>
      <Text style={s.text}>
        两台设备连接同一局域网，选择一个账本完整覆盖另一个。每次只传一份，不合并、不自动同步。
      </Text>
      {host ? (
        !info ? (
          <Action onPress={() => void start()} disabled={busy}>
            开启一次性连接
          </Action>
        ) : (
          <>
            <Text style={s.heading}>手机扫码连接这台桌面</Text>
            <View
              style={{
                alignItems: "center",
                padding: 16,
                backgroundColor: "white",
                borderRadius: 16,
              }}
            >
              <QRCode value={pairing} size={200} />
            </View>
            {info.addresses.length > 1 && (
              <View style={s.wrap}>
                {info.addresses.map((ip) => (
                  <Pressable
                    key={ip}
                    accessibilityRole="button"
                    onPress={() => setAddress(ip)}
                    style={[s.chip, ip === address && s.selected]}
                  >
                    <Text style={s.text}>{ip}</Text>
                  </Pressable>
                ))}
              </View>
            )}
            <Text style={s.muted}>
              连接码包含一次性访问密钥，只交给你要连接的设备。连接关闭或 10
              分钟后失效。
            </Text>
            <TextInput
              accessibilityLabel="桌面连接码"
              value={pairing}
              editable={false}
              multiline
              selectTextOnFocus
              style={[s.input, { fontSize: 12 }]}
            />
          </>
        )
      ) : !peer.current ? (
        <>
          {scanning ? (
            <LanScanner
              onClose={() => setScanning(false)}
              onRead={(value) => {
                if (scanned.current) return;
                scanned.current = true;
                setScanning(false);
                try {
                  parsePairCode(value);
                  setCode(value);
                  setError("");
                } catch {
                  setError("这不是有效的账本连接码，请重新扫码");
                }
              }}
            />
          ) : (
            <>
              {Platform.OS !== "web" && (
                <Action
                  disabled={busy}
                  onPress={() => {
                    scanned.current = false;
                    setScanning(true);
                  }}
                >
                  扫描桌面连接码
                </Action>
              )}
              <TextInput
                accessibilityLabel="粘贴连接码"
                placeholder="粘贴桌面端的连接码"
                autoCapitalize="none"
                autoCorrect={false}
                value={code}
                onChangeText={setCode}
                multiline
                style={s.input}
              />
              <Action
                disabled={busy || !code.trim()}
                onPress={() => void connect()}
              >
                连接桌面
              </Action>
            </>
          )}
        </>
      ) : null}
      {local && (
        <Summary
          title={host ? "这台桌面的账本" : "这台手机的账本"}
          summary={local}
        />
      )}
      {summary && <Summary title="对端桌面账本" summary={summary} />}
      {state !== "" && (
        <Text accessibilityLiveRegion="polite" style={s.text}>
          {state}
        </Text>
      )}
      {!host && peer.current && !pending && (
        <>
          {!activeId.current && (
            <>
              <Action disabled={busy} onPress={() => void send()}>
                手机 → 桌面：发送本机账本
              </Action>
              <Action disabled={busy} onPress={() => void receive()}>
                桌面 → 手机：接收桌面账本
              </Action>
            </>
          )}
          {activeId.current && (
            <Action disabled={busy} onPress={() => void poll()}>
              查看对端完成状态
            </Action>
          )}
        </>
      )}
      {pending && (
        <View style={[s.card, { borderTopWidth: 1, borderColor: c.line }]}>
          <Summary
            title="将要接收的账本"
            summary={backupSummary(pending.json)}
          />
          <Text style={s.text}>
            将完整替换{host ? "这台桌面" : "这台手机"}
            的账本。确认后先自动备份原账本，再覆盖；已有记录不会合并。
          </Text>
          <Action danger disabled={busy} onPress={() => void apply()}>
            {committed.current ? "重发完成通知" : "备份原账本并覆盖本机"}
          </Action>
          {!committed.current && (
            <Action disabled={busy} onPress={() => void reject()}>
              取消覆盖
            </Action>
          )}
        </View>
      )}
      {error !== "" && (
        <Text accessibilityRole="alert" style={s.error}>
          {error}
        </Text>
      )}
      {(info || peer.current) && (
        <Action disabled={busy} onPress={() => void run(stop)}>
          关闭连接并清除连接码
        </Action>
      )}
      <Text style={s.muted}>
        离开本页会断开连接。不要同时在两台设备记账；覆盖前会校验接收方账本是否已变化。
      </Text>
    </View>
  );
}
