import React, { useEffect, useRef, useState } from "react";
import { Pressable, Switch, View } from "react-native";
import { Text } from "./appearance";
import { colors as c, styles as s } from "./theme";
import {
  mcpAvailable,
  mcpCopy,
  mcpRotateKey,
  mcpSetEnabled,
  mcpStatus,
} from "./mcp-platform";
import type { McpStatus } from "./mcp-types";
import { mcpInstructions } from "./mcp-instructions";

export function McpSettings() {
  const [status, setStatus] = useState<McpStatus>({
    available: mcpAvailable(),
    enabled: false,
    requests: 0,
  });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [rotateConfirm, setRotateConfirm] = useState(false);
  const [advanced, setAdvanced] = useState(false);
  const operation = useRef(0);
  const locked = useRef(false);
  useEffect(() => {
    if (!mcpAvailable()) return;
    let alive = true;
    const refresh = () => {
      if (locked.current) return;
      const version = operation.current;
      void mcpStatus()
        .then((value) => {
          if (alive && version === operation.current) setStatus(value);
        })
        .catch(() => {
          if (alive && version === operation.current)
            setError("无法读取连接状态，请重新打开此页");
        });
    };
    refresh();
    const timer = setInterval(refresh, 1500);
    return () => {
      alive = false;
      clearInterval(timer);
    };
  }, []);
  const update = async (action: () => Promise<McpStatus>) => {
    if (locked.current) return;
    locked.current = true;
    operation.current++;
    setBusy(true);
    setError("");
    setNotice("");
    try {
      setStatus(await action());
      setRotateConfirm(false);
    } catch (e) {
      setError(e instanceof Error ? e.message : "连接操作失败，请重试");
    } finally {
      locked.current = false;
      setBusy(false);
    }
  };
  const copy = async (text: string) => {
    try {
      await mcpCopy(text);
      setNotice("已复制，请粘贴到你信任的 AI 客户端");
      setError("");
    } catch {
      setError("复制失败，请重试");
    }
  };
  const copyForAi = () =>
    update(async () => {
      const current = await mcpStatus();
      // Copying must never grant access; recheck instead of trusting polled UI state.
      setStatus(current);
      await mcpCopy(mcpInstructions(current));
      setNotice("已复制，粘贴给同一台电脑上的 AI，让它帮你完成连接");
      return current;
    });
  const button = (
    label: string,
    action: () => void,
    primary = false,
    disabled = false,
  ) => (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      disabled={busy || disabled}
      onPress={action}
      style={[
        s.button,
        !primary && s.secondary,
        (busy || disabled) && { opacity: 0.45 },
      ]}
    >
      <Text style={[s.buttonText, !primary && s.secondaryText]}>{label}</Text>
    </Pressable>
  );
  return (
    <View style={{ gap: 20 }}>
      <Text style={s.text}>让外部 AI 查询你的本机账本</Text>
      <Text style={s.muted}>
        可查询账户、净资产、标签、月度收支和筛选流水。此版本只读，不会通过 MCP
        新增、修改、删除或覆盖账本。
      </Text>
      {status.available ? (
        <>
          <View style={s.between}>
            <View style={{ flex: 1, gap: 5 }}>
              <Text style={s.heading}>允许 AI 只读访问</Text>
              <Text style={s.muted}>
                {status.enabled ? "已开启 · 仅限这台电脑" : "已关闭"}
              </Text>
            </View>
            <Switch
              accessibilityLabel="允许 AI 只读访问"
              value={status.enabled}
              disabled={busy}
              onValueChange={(enabled) =>
                void update(() => mcpSetEnabled(enabled))
              }
              trackColor={{ true: c.brand }}
            />
          </View>
          <Text style={s.muted}>
            每次启动简账默认关闭。连接时请保持应用运行，离开设置页仍可查询；关闭开关或退出简账后立即停止服务。
          </Text>
          {button(
            "一键复制给 AI",
            () => void copyForAi(),
            true,
            !status.enabled,
          )}
          <Text style={s.muted}>
            先打开“允许 AI 只读访问”，再复制接入说明，粘贴给同一台电脑上的 AI。
            复制只提供连接信息，不会开启访问。内容含访问密钥，请只交给你信任的
            AI。
          </Text>
          {notice !== "" && (
            <Text accessibilityRole="alert" style={{ color: c.brand }}>
              {notice}
            </Text>
          )}
          {error !== "" && (
            <Text accessibilityRole="alert" style={s.error}>
              {error}
            </Text>
          )}
          {status.enabled &&
            status.configuration &&
            button(advanced ? "收起高级连接信息" : "高级连接信息", () =>
              setAdvanced(!advanced),
            )}
          {status.enabled && status.configuration && advanced && (
            <View style={{ gap: 12 }}>
              <Text style={s.sectionLabel}>本机连接地址</Text>
              <Text selectable style={s.text}>
                {status.url}
              </Text>
              <Text style={s.muted}>
                连接方式：Streamable
                HTTP。访问密钥随配置一起复制，请只交给你信任的 AI 客户端。
              </Text>
              {button(
                "复制 MCP 配置",
                () => void copy(JSON.stringify(status.configuration, null, 2)),
              )}
              <View style={s.wrap}>
                {button("复制连接地址", () => void copy(status.url!))}
                {button(
                  "复制 Authorization 值",
                  () =>
                    void copy(
                      status.configuration!.mcpServers.ledger.headers
                        .Authorization,
                    ),
                )}
              </View>
              <Text style={s.muted}>
                本次已处理 {status.requests} 个连接请求
              </Text>
              {button(
                rotateConfirm ? "确认重新生成密钥" : "重新生成访问密钥",
                () =>
                  rotateConfirm
                    ? void update(mcpRotateKey)
                    : setRotateConfirm(true),
              )}
              {rotateConfirm && (
                <Text style={s.muted}>
                  旧密钥会立即失效，需要重新点击“一键复制给 AI”，让 AI
                  更新连接。
                </Text>
              )}
            </View>
          )}
          <View style={{ gap: 10 }}>
            <Text style={s.heading}>连接方法</Text>
            <Text style={s.text}>
              1. 打开“允许 AI 只读访问”，再点击“一键复制给 AI”。
            </Text>
            <Text style={s.text}>
              2. 将复制的内容粘贴给
              AI，让它完成连接；如有权限确认，按客户端提示确认。
            </Text>
            <Text style={s.text}>
              3. 连接后可以问：“本月支出多少？”“最近十笔支出是什么？”
            </Text>
            <Text style={s.muted}>
              AI 需要具备添加本机 MCP 连接的能力。无法自行配置的客户端仍需在其
              MCP 设置中添加连接，可展开“高级连接信息”获取配置。
            </Text>
          </View>
        </>
      ) : (
        <>
          <Text style={s.heading}>请在 Mac 或 Windows 简账中开启</Text>
          <Text style={s.text}>
            MCP 连接由电脑端提供。手机账本可先通过“备份与迁移 →
            局域网传输”传到电脑，再在电脑设置中打开“AI 连接”。
          </Text>
        </>
      )}
      <Text style={s.heading}>数据与隐私</Text>
      <Text style={s.muted}>
        查询结果会交给你所连接的
        AI。使用云端模型时，结果可能被发送到它的服务端。优先查询汇总或限定日期范围，避免不必要地分享明细和备注。金额小眼睛只控制屏幕显示，不会限制已经授权的
        MCP 查询。
      </Text>
    </View>
  );
}
