import React from "react";
import { Text } from "./appearance";
import { styles as s } from "./theme";
export function LanScanner(_props: {
  onRead: (code: string) => void;
  onClose: () => void;
}) {
  return <Text style={s.muted}>请在手机上扫码，或直接粘贴连接码。</Text>;
}
