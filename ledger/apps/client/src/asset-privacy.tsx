import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
} from "react";
import {
  AppState,
  Platform,
  Pressable,
  View,
  type StyleProp,
  type TextStyle,
} from "react-native";
import { Eye, EyeOff } from "lucide-react-native";
import { Text } from "./appearance";
import { colors as c, styles as s } from "./theme";
import { loadAssetVisibility, saveAssetVisibility } from "./platform";

type AssetPrivacy = {
  visible: boolean;
  pinned: boolean;
  busy: boolean;
  error: string;
  beginPress: () => void;
  peek: () => void;
  endPress: () => void;
  toggle: () => void;
};
const noop = () => {};
const Context = createContext<AssetPrivacy>({
  visible: false,
  pinned: false,
  busy: false,
  error: "",
  beginPress: noop,
  peek: noop,
  endPress: noop,
  toggle: noop,
});
export const AssetPrivacyProvider = Context.Provider;
export const useAssetPrivacy = () => useContext(Context);

/** Optional local display preference; never stores amounts or enters a backup. */
export function useAssetPrivacyController(
  active: boolean,
  remember = false,
): AssetPrivacy {
  const [pinned, setPinned] = useState(false);
  const [peeking, setPeeking] = useState(false);
  const [loaded, setLoaded] = useState(!remember);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const saveLock = useRef(false);
  const onAssets = useRef(active);
  const gesture = useRef(false);
  const foreground = useRef(
    AppState.currentState !== "background" &&
      AppState.currentState !== "inactive",
  );
  const [isForeground, setIsForeground] = useState(foreground.current);
  useEffect(() => {
    if (!remember) return;
    let mounted = true;
    void loadAssetVisibility()
      .then((value) => {
        if (mounted) setPinned(value === "true");
      })
      .catch(() => {
        if (mounted) setError("暂时无法读取金额显示偏好，本次保持隐藏。");
      })
      .finally(() => {
        if (mounted) setLoaded(true);
      });
    return () => {
      mounted = false;
    };
  }, [remember]);
  const hide = useCallback(() => {
    gesture.current = false;
    if (!remember) setPinned(false);
    setPeeking(false);
  }, [remember]);
  const endPress = useCallback(() => {
    gesture.current = false;
    setPeeking(false);
  }, []);
  useLayoutEffect(() => {
    onAssets.current = active;
    hide();
  }, [active, hide]);
  useEffect(() => {
    const background = () => {
      foreground.current = false;
      setIsForeground(false);
      hide();
    };
    const focus = () => {
      foreground.current = true;
      setIsForeground(true);
    };
    const app = AppState.addEventListener("change", (state) => {
      if (state === "active") focus();
      else background();
    });
    // Native dialogs also blur the Activity. Cancel a held gesture there, but
    // keep an explicit pin while using our sheets; AppState handles app exit.
    const androidBlur =
      Platform.OS === "android"
        ? AppState.addEventListener("blur", endPress)
        : undefined;
    const visibility = () => {
      if (document.hidden) background();
      else if (document.hasFocus()) focus();
      else background();
    };
    if (Platform.OS === "web") {
      foreground.current = !document.hidden && document.hasFocus();
      setIsForeground(foreground.current);
      globalThis.addEventListener("blur", background);
      globalThis.addEventListener("focus", focus);
      document.addEventListener("visibilitychange", visibility);
    }
    return () => {
      app.remove();
      androidBlur?.remove();
      if (Platform.OS === "web") {
        globalThis.removeEventListener("blur", background);
        globalThis.removeEventListener("focus", focus);
        document.removeEventListener("visibilitychange", visibility);
      }
    };
  }, [hide, endPress]);
  return {
    visible: active && isForeground && loaded && (pinned || peeking),
    pinned: active && isForeground && loaded && pinned,
    busy: !loaded || saving,
    error,
    beginPress: () => {
      gesture.current = onAssets.current && foreground.current;
    },
    peek: () => {
      if (onAssets.current && foreground.current && gesture.current)
        setPeeking(true);
    },
    endPress,
    toggle: () => {
      if (
        !onAssets.current ||
        !foreground.current ||
        !loaded ||
        saveLock.current
      )
        return;
      gesture.current = false;
      setPeeking(false);
      const next = !pinned;
      setPinned(next);
      if (!remember) return;
      saveLock.current = true;
      setSaving(true);
      setError("");
      void saveAssetVisibility(next)
        .catch(() => {
          // Keep this session's explicit choice, especially a request to hide.
          setError(
            "金额显示偏好未能保存，本次选择仍有效，重启后可能恢复原设置。请重试。",
          );
        })
        .finally(() => {
          saveLock.current = false;
          setSaving(false);
        });
    },
  };
}

/** Replace the text itself: hidden values never enter native text or its AX label. */
export function AssetValue({
  value,
  ...props
}: Omit<React.ComponentProps<typeof Text>, "children"> & { value: string }) {
  const { visible } = useAssetPrivacy();
  return (
    <Text
      {...props}
      accessibilityLabel={visible ? props.accessibilityLabel : "金额已隐藏"}
    >
      {visible ? value : "••••"}
    </Text>
  );
}

export function AssetPeekAmount({
  label,
  value,
  style,
}: {
  label: string;
  value: string;
  style?: StyleProp<TextStyle>;
}) {
  const privacy = useAssetPrivacy();
  const Icon = privacy.visible ? Eye : EyeOff;
  return (
    <View style={{ gap: 2 }}>
      <View style={s.between}>
        <Text style={s.muted}>{label}</Text>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={
            privacy.pinned ? "隐藏资产金额" : "持续显示资产金额"
          }
          accessibilityState={{ selected: privacy.pinned }}
          accessibilityHint="记住显示或隐藏选择，切换页面后保留"
          disabled={privacy.busy}
          hitSlop={8}
          onPress={privacy.toggle}
          style={s.assetEye}
        >
          <Icon size={21} color={privacy.pinned ? c.brand : c.muted} />
        </Pressable>
      </View>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="按住临时查看资产金额"
        accessibilityHint="松开即隐藏，也可以点旁边的小眼睛持续显示"
        delayLongPress={250}
        onPressIn={privacy.beginPress}
        onLongPress={privacy.peek}
        onPressOut={privacy.endPress}
        onTouchCancel={privacy.endPress}
        onBlur={privacy.endPress}
        style={({ pressed }) => [
          s.assetPeekArea,
          pressed && !privacy.pinned && { backgroundColor: c.soft },
        ]}
      >
        <AssetValue
          value={value}
          variant="amount"
          style={[s.assetAmount, style]}
          numberOfLines={1}
          adjustsFontSizeToFit
          minimumFontScale={0.55}
        />
        <Text style={s.muted}>
          {privacy.pinned
            ? "点眼睛隐藏 · 已记住显示选择"
            : privacy.visible
              ? "松开即隐藏"
              : "按住看一眼 · 点眼睛持续显示"}
        </Text>
      </Pressable>
      {privacy.error !== "" && (
        <Text accessibilityRole="alert" style={s.error}>
          {privacy.error}
        </Text>
      )}
    </View>
  );
}
