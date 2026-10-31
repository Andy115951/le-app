import React from "react";
import { registerRootComponent } from "expo";
import { View } from "react-native";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { emptyLedger, execute, type Command } from "@ledger/core";
import { LedgerApp, type LedgerViewRepository } from "../client/src/App";
import { AppearanceProvider, Text } from "../client/src/appearance";
import { colors, styles } from "../client/src/theme";

// Fixed fictional fixture, created through the same public rules as the app.
// This entry never calls openLedger or opens a database/IPC connection.
let sequence = 0;
const newId = () => `ui-qa-synthetic-${++sequence}`;
let ledger = emptyLedger(newId);
function seed(command: Command) {
  ledger = execute(ledger, command, {
    newId,
    operationId: newId(),
    source: "ui",
    now: "2026-10-01T08:00:00",
  }).state;
}
for (const [name, kind, openingMinor] of [
  ["示例银行卡", "cash", 2_000_000],
  ["示例理财", "investment", 3_000_000],
  ["示例信用卡", "credit", -80_000],
] as const)
  seed({
    type: "account.create",
    name,
    kind,
    openingMinor,
    openedAt: "2026-01-01T00:00:00",
  });
seed({
  type: "reconcile",
  accountId: ledger.accounts[0].id,
  actualMinor: 2_145_678,
  occurredAt: "2026-10-01T08:00:00",
  note: "合成盘点备注 1456.78",
});
const snapshot = { ledger, token: "synthetic-read-only-ui-qa" };
const rejectWrite = async (): Promise<never> => {
  throw new Error("只读界面预览，不能写入账本。");
};
const repo: LedgerViewRepository = {
  snapshot: async () => snapshot,
  run: rejectWrite,
  restore: rejectWrite,
  backups: async () => [],
  readBackup: rejectWrite,
};
function UiQa() {
  return (
    <SafeAreaProvider>
      <AppearanceProvider>
        <View style={{ flex: 1 }}>
          <View
            style={{
              backgroundColor: colors.soft,
              paddingHorizontal: 12,
              paddingVertical: 5,
            }}
          >
            <Text style={[styles.muted, { textAlign: "center" }]}>
              界面 QA · 虚构数据 · 只读预览
            </Text>
          </View>
          <LedgerApp repo={repo} initial={snapshot} />
        </View>
      </AppearanceProvider>
    </SafeAreaProvider>
  );
}
registerRootComponent(UiQa);
