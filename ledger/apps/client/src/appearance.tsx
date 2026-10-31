import React, {
  createContext,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import {
  Text as NativeText,
  type TextProps,
  type TextStyle,
  type StyleProp,
} from "react-native";
import { useLedgerFonts } from "./fonts";
import {
  loadAppearance,
  saveAppearance,
  loadVaultPreference,
  saveVaultPreference,
} from "./platform";

export type FontChoice = "sans" | "mixed" | "book";
export const fontChoices = [
  { id: "sans", name: "清爽", description: "清晰的无衬线标题与数字" },
  { id: "mixed", name: "雅致", description: "加厚宋体标题，搭配无衬线数字" },
  { id: "book", name: "书卷", description: "加厚宋体标题与衬线数字" },
] as const;
export function parseFontChoice(value: string | null): FontChoice {
  return value === "sans" || value === "mixed" || value === "book"
    ? value
    : "book";
}
type Appearance = {
  choice: FontChoice;
  ready: boolean;
  busy: boolean;
  fontsAvailable: boolean;
  error: string;
  heading?: string;
  amount?: string;
  setChoice: (choice: FontChoice) => Promise<void>;
  vaultEnabled: boolean;
  vaultBusy: boolean;
  vaultError: string;
  setVaultEnabled: (enabled: boolean) => Promise<void>;
};
const Context = createContext<Appearance>({
  choice: "book",
  ready: false,
  busy: false,
  fontsAvailable: false,
  error: "",
  setChoice: async () => {},
  vaultEnabled: true,
  vaultBusy: false,
  vaultError: "",
  setVaultEnabled: async () => {},
});
export const useAppearance = () => useContext(Context);
export function AppearanceProvider({ children }: { children: ReactNode }) {
  const [fontsLoaded, fontError] = useLedgerFonts();
  const [choice, setChoice] = useState<FontChoice>("book");
  const [loaded, setLoaded] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const lock = useRef(false);
  const [vaultEnabled, setVaultEnabled] = useState(true);
  const [vaultLoaded, setVaultLoaded] = useState(false);
  const [vaultBusy, setVaultBusy] = useState(false);
  const [vaultError, setVaultError] = useState("");
  const vaultLock = useRef(false);
  useEffect(() => {
    let active = true;
    void loadVaultPreference()
      .then((value) => {
        if (active) setVaultEnabled(value === null || value === "true");
      })
      .catch(() => {
        if (active) {
          setVaultEnabled(false);
          setVaultError("暂时无法读取小金库偏好，本次保持关闭。");
        }
      })
      .finally(() => {
        if (active) setVaultLoaded(true);
      });
    return () => {
      active = false;
    };
  }, []);
  async function changeVault(next: boolean) {
    if (!vaultLoaded || vaultLock.current) return;
    vaultLock.current = true;
    setVaultBusy(true);
    setVaultError("");
    try {
      await saveVaultPreference(next);
      setVaultEnabled(next);
    } catch {
      setVaultError("小金库偏好未能保存，请重试。");
    } finally {
      vaultLock.current = false;
      setVaultBusy(false);
    }
  }
  useEffect(() => {
    let active = true;
    void loadAppearance()
      .then((value) => {
        if (active) setChoice(parseFontChoice(value));
      })
      .catch(() => {
        if (active) setError("暂时无法读取外观偏好，本次使用书卷字体。");
      })
      .finally(() => {
        if (active) setLoaded(true);
      });
    return () => {
      active = false;
    };
  }, []);
  async function change(next: FontChoice) {
    if (lock.current) return;
    lock.current = true;
    setBusy(true);
    setError("");
    const previous = choice;
    setChoice(next);
    try {
      await saveAppearance(next);
    } catch {
      setChoice(previous);
      setError("外观偏好未能保存，请重试。");
    } finally {
      lock.current = false;
      setBusy(false);
    }
  }
  const enabled = fontsLoaded && !fontError;
  return (
    <Context.Provider
      value={{
        choice,
        ready: loaded && vaultLoaded && (fontsLoaded || !!fontError),
        busy,
        fontsAvailable: enabled,
        error: fontError
          ? "字体载入失败，暂用系统字体。请重新打开应用重试。"
          : error,
        heading: enabled && choice !== "sans" ? "LedgerSongti" : undefined,
        amount: enabled && choice === "book" ? "LedgerNumbers" : undefined,
        setChoice: change,
        vaultEnabled,
        vaultBusy: vaultBusy || !vaultLoaded,
        vaultError,
        setVaultEnabled: changeVault,
      }}
    >
      {children}
    </Context.Provider>
  );
}
export function Text({
  variant = "body",
  style,
  ...props
}: TextProps & {
  variant?: "body" | "heading" | "amount";
  style?: StyleProp<TextStyle>;
}) {
  const appearance = useAppearance();
  const family =
    variant === "heading"
      ? appearance.heading
      : variant === "amount"
        ? appearance.amount
        : undefined;
  return (
    <NativeText
      {...props}
      style={[
        style,
        // Each bundled family contains one real 600-weight face. Normal family
        // matching uses those outlines consistently without synthetic weights.
        family ? { fontFamily: family, fontWeight: "normal" } : undefined,
      ]}
    />
  );
}
