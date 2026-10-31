import React, {
  useCallback,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import {
  AppState,
  ActivityIndicator,
  BackHandler,
  Keyboard,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  Switch,
  TextInput,
  View,
  useWindowDimensions,
} from "react-native";
import {
  SafeAreaProvider,
  SafeAreaView,
  useSafeAreaInsets,
} from "react-native-safe-area-context";
import { StatusBar } from "expo-status-bar";
import {
  ArrowDownLeft,
  ArrowLeftRight,
  ArrowUpRight,
  ChevronLeft,
  ChevronRight,
  ChevronDown,
  Home,
  Download,
  Upload,
  RotateCcw,
  Wifi,
  Tag,
  History,
  Info,
  List,
  Plus,
  Settings,
  Wallet,
  Check,
  Search,
  SlidersHorizontal,
  Type,
  Delete,
  X,
  type LucideIcon,
} from "lucide-react-native";
import {
  assets,
  balance,
  exportBackup,
  money,
  nowInLedger,
  parseBackup,
  parseMoney,
  report,
  validTime,
  labelIconKeys,
  defaultLabelIcon,
  type Account,
  type AccountKind,
  type Command,
  type Direction,
  type Entry,
  type Ledger,
  type Label,
  type Reconciliation,
  type LabelIcon,
} from "@ledger/core";
import type { LedgerRepository, Snapshot } from "@ledger/storage";
import { openLedger, pickBackup, randomUUID, saveBackup } from "./platform";
import { colors as c, styles as s } from "./theme";
import {
  AppearanceProvider,
  Text,
  useAppearance,
  fontChoices,
} from "./appearance";
import { SmallIcon, LabelGlyph, AccountGlyph, iconNames } from "./icons";
import { LanTransfer } from "./lan-transfer";
import { LittleVault } from "./little-vault";
import {
  FIRST_YEAR,
  LAST_YEAR,
  shiftMonth,
  yearPageStart,
} from "./month-navigation";
import {
  AssetPrivacyProvider,
  AssetValue,
  AssetPeekAmount,
  useAssetPrivacy,
  useAssetPrivacyController,
} from "./asset-privacy";

const appName = Platform.OS === "web" ? "简账" : "智账";
type Tab = "overview" | "details" | "add" | "assets" | "settings";
type SettingsPage =
  | "home"
  | "labels"
  | "backup"
  | "savedBackups"
  | "lan"
  | "history"
  | "appearance"
  | "fonts"
  | "about";
const settingsTitles: Record<SettingsPage, string> = {
  home: "设置",
  labels: "标签管理",
  backup: "备份与迁移",
  lan: "局域网传输",
  savedBackups: "自动备份",
  history: "变更记录",
  appearance: "外观",
  fonts: "字体",
  about: `关于${appName}`,
};
const auditNames: Record<string, string> = {
  "account.create": "新增账户",
  "account.rename": "账户改名",
  "label.create": "新增标签",
  "label.update": "修改标签",
  "label.delete": "删除标签",
  "entry.create": "新增流水",
  "entry.update": "修改流水",
  "entry.delete": "删除流水",
  reconcile: "账户盘点",
  "reconciliation.delete": "删除盘点",
  "backup.restore": "恢复账本",
};
type Submit = (
  command: Command,
  operationId: string,
  token?: string,
) => Promise<void>;
type EntryPreset = {
  kind: Entry["kind"];
  accountId: string;
  toAccountId?: string;
};
const kindName = {
  expense: "支出",
  income: "收入",
  transfer: "转账",
  refund: "退款",
};
const accountName = {
  cash: "现金 / 银行 / 钱包",
  investment: "股票 / 基金 / 理财",
  credit: "信用卡",
};
const errorText = (e: unknown) =>
  e instanceof Error ? e.message : "操作失败，请重试";
const amountText = (minor: number) =>
  money(minor).replace(/\B(?=(\d{3})+(?!\d))/g, ",");
function Segments({
  options,
  value,
  onChange,
}: {
  options: [string, string][];
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <View style={s.segmentRow}>
      {options.map(([key, name]) => (
        <Pressable
          key={key}
          accessibilityRole="button"
          accessibilityState={{ selected: key === value }}
          style={[s.segment, key === value && s.segmentActive]}
          onPress={() => onChange(key)}
        >
          <Text style={[s.segmentText, key === value && { color: c.brand }]}>
            {name}
          </Text>
        </Pressable>
      ))}
    </View>
  );
}
function SelectionRow({
  title,
  description,
  selected,
  onPress,
  children,
}: {
  title: string;
  description?: string;
  selected: boolean;
  onPress: () => void;
  children?: ReactNode;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={title}
      accessibilityState={{ selected }}
      onPress={onPress}
      style={[s.selectionRow, selected && { backgroundColor: c.brandSoft }]}
    >
      {children}
      <View style={{ flex: 1, gap: 4 }}>
        <Text style={s.text}>{title}</Text>
        {description && <Text style={s.muted}>{description}</Text>}
      </View>
      <View
        style={[
          s.selectionCircle,
          selected && { backgroundColor: c.brand, borderColor: c.brand },
        ]}
      >
        {selected && <Check size={13} color="white" />}
      </View>
    </Pressable>
  );
}
function DayHeading({ date }: { date: string }) {
  const today = nowInLedger().slice(0, 10);
  const yesterday = nowInLedger(new Date(Date.now() - 86400_000)).slice(0, 10);
  return (
    <View style={s.between}>
      <Text style={s.dateHeading}>
        {date === today
          ? "今天"
          : date === yesterday
            ? "昨天"
            : `${Number(date.slice(5, 7))}月${Number(date.slice(8))}日`}
      </Text>
      <Text style={s.muted}>{date.slice(5).replace("-", " / ")}</Text>
    </View>
  );
}
function Button({
  children,
  onPress,
  secondary = false,
  disabled = false,
  danger = false,
}: {
  children: ReactNode;
  onPress: () => void;
  secondary?: boolean;
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
        secondary && s.secondary,
        disabled && { opacity: 0.45 },
        danger && { backgroundColor: c.danger },
      ]}
    >
      <Text style={[s.buttonText, secondary && s.secondaryText]}>
        {children}
      </Text>
    </Pressable>
  );
}
function SettingsRow({
  title,
  description,
  icon: Icon,
  onPress,
  disabled = false,
}: {
  title: string;
  description: string;
  icon: LucideIcon;
  onPress: () => void;
  disabled?: boolean;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={title}
      disabled={disabled}
      accessibilityState={{ disabled }}
      onPress={onPress}
      style={({ pressed }) => [
        s.settingsRow,
        pressed && !disabled && { backgroundColor: c.soft },
        disabled && { opacity: 0.45 },
      ]}
    >
      <View style={s.settingsIcon}>
        <Icon size={20} color={c.brand} />
      </View>
      <View style={{ flex: 1, gap: 4, minWidth: 0 }}>
        <Text variant="heading" style={s.heading}>
          {title}
        </Text>
        <Text style={s.muted}>{description}</Text>
      </View>
      <ChevronRight size={18} color={c.muted} />
    </Pressable>
  );
}
function Chip({
  children,
  selected,
  onPress,
}: {
  children: ReactNode;
  selected?: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected: !!selected }}
      onPress={onPress}
      style={[s.chip, selected && s.selected]}
    >
      {React.isValidElement(children) ? (
        children
      ) : (
        <Text
          style={[
            s.text,
            { fontSize: 14, color: selected ? c.brand : c.muted },
          ]}
        >
          {children}
        </Text>
      )}
    </Pressable>
  );
}
function Field({
  label,
  ...props
}: React.ComponentProps<typeof TextInput> & { label: string }) {
  return (
    <View style={{ gap: 6 }}>
      <Text style={s.muted}>{label}</Text>
      <TextInput
        accessibilityLabel={label}
        placeholderTextColor={c.muted}
        {...props}
        style={[s.input, props.style]}
      />
    </View>
  );
}
function Sheet({
  title,
  close,
  children,
}: {
  title: string;
  close: () => void;
  children: ReactNode;
}) {
  const wide = useWindowDimensions().width >= 760;
  const insets = useSafeAreaInsets();
  return (
    <Modal transparent animationType="fade" visible onRequestClose={close}>
      <KeyboardAvoidingView
        style={[s.overlay, wide && { justifyContent: "center", padding: 24 }]}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="关闭弹窗遮罩"
          style={{ position: "absolute", top: 0, bottom: 0, left: 0, right: 0 }}
          onPress={close}
        />
        <View
          style={[
            s.sheet,
            wide && { borderRadius: 22 },
            { paddingBottom: wide ? 0 : insets.bottom },
          ]}
        >
          <ScrollView
            keyboardShouldPersistTaps="handled"
            contentContainerStyle={s.sheetContent}
          >
            {!wide && <View style={s.sheetHandle} />}
            <View style={s.between}>
              <Text variant="heading" style={s.heading}>
                {title}
              </Text>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="关闭弹窗"
                onPress={close}
                hitSlop={12}
              >
                <X color={c.muted} size={24} />
              </Pressable>
            </View>
            {children}
          </ScrollView>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}
function Empty({ text, action }: { text: string; action?: () => void }) {
  return (
    <View style={s.empty}>
      <Wallet color={c.muted} size={28} />
      <Text style={s.muted}>{text}</Text>
      {action && <Button onPress={action}>添加第一个账户</Button>}
    </View>
  );
}
function MonthPicker({
  month,
  setMonth,
}: {
  month: string;
  setMonth: (m: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [year, setYear] = useState(Number(month.slice(0, 4)));
  const [choosingYear, setChoosingYear] = useState(false);
  const [yearPage, setYearPage] = useState(yearPageStart(year));
  const current = nowInLedger().slice(0, 7);
  function show() {
    const selectedYear = Number(month.slice(0, 4));
    setYear(selectedYear);
    setYearPage(yearPageStart(selectedYear));
    setChoosingYear(false);
    setOpen(true);
  }
  function choose(next: string) {
    setMonth(next);
    setOpen(false);
  }
  return (
    <>
      <View style={s.monthPicker}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="上个月"
          disabled={month === `${FIRST_YEAR}-01`}
          onPress={() => setMonth(shiftMonth(month, -1))}
          style={s.monthArrow}
        >
          <ChevronLeft color={c.muted} size={15} />
        </Pressable>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`选择月份，当前 ${month.replace("-", " 年 ")} 月`}
          accessibilityState={{ expanded: open }}
          onPress={show}
          style={s.monthTrigger}
        >
          <Text style={s.muted}>{month.replace("-", " / ")}</Text>
          <ChevronDown color={c.muted} size={13} />
        </Pressable>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="下个月"
          disabled={month === `${LAST_YEAR}-12`}
          onPress={() => setMonth(shiftMonth(month, 1))}
          style={s.monthArrow}
        >
          <ChevronRight color={c.muted} size={15} />
        </Pressable>
      </View>
      {open && (
        <Sheet title="选择月份" close={() => setOpen(false)}>
          <View style={s.between}>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={choosingYear ? "前12年" : "上一年"}
              disabled={
                choosingYear ? yearPage <= FIRST_YEAR : year <= FIRST_YEAR
              }
              onPress={() =>
                choosingYear
                  ? setYearPage((p) => Math.max(FIRST_YEAR, p - 12))
                  : setYear((y) => y - 1)
              }
              style={s.calendarArrow}
            >
              <ChevronLeft
                size={20}
                color={
                  (choosingYear ? yearPage <= FIRST_YEAR : year <= FIRST_YEAR)
                    ? c.line
                    : c.brand
                }
              />
            </Pressable>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={choosingYear ? "返回月份选择" : "选择年份"}
              onPress={() => {
                setYearPage(yearPageStart(year));
                setChoosingYear(!choosingYear);
              }}
              style={s.row}
            >
              <Text variant="heading" style={s.heading}>
                {choosingYear
                  ? `${yearPage} — ${Math.min(LAST_YEAR, yearPage + 11)}`
                  : `${year} 年`}
              </Text>
              <ChevronDown size={16} color={c.muted} />
            </Pressable>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={choosingYear ? "后12年" : "下一年"}
              disabled={
                choosingYear ? yearPage + 12 > LAST_YEAR : year >= LAST_YEAR
              }
              onPress={() =>
                choosingYear
                  ? setYearPage((p) =>
                      Math.min(yearPageStart(LAST_YEAR), p + 12),
                    )
                  : setYear((y) => y + 1)
              }
              style={s.calendarArrow}
            >
              <ChevronRight
                size={20}
                color={
                  (choosingYear ? yearPage + 12 > LAST_YEAR : year >= LAST_YEAR)
                    ? c.line
                    : c.brand
                }
              />
            </Pressable>
          </View>
          <View style={s.calendarGrid}>
            {Array.from({ length: 12 }, (_, index) => {
              const value = choosingYear ? yearPage + index : index + 1;
              if (choosingYear && value > LAST_YEAR)
                return <View key={value} style={s.calendarCell} />;
              const next = `${year}-${String(value).padStart(2, "0")}`;
              const selected = choosingYear
                ? value === Number(month.slice(0, 4))
                : next === month;
              const today = choosingYear
                ? value === Number(current.slice(0, 4))
                : next === current;
              return (
                <Pressable
                  key={value}
                  accessibilityRole="button"
                  accessibilityLabel={
                    choosingYear ? `${value} 年` : `${year} 年 ${value} 月`
                  }
                  accessibilityState={{ selected }}
                  onPress={() => {
                    if (choosingYear) {
                      setYear(value);
                      setChoosingYear(false);
                    } else choose(next);
                  }}
                  style={({ pressed }) => [
                    s.calendarCell,
                    selected && s.calendarSelected,
                    pressed && { opacity: 0.75 },
                  ]}
                >
                  <Text
                    variant="amount"
                    style={[s.calendarNumber, selected && { color: c.paper }]}
                  >
                    {value}
                    {choosingYear ? "" : "月"}
                  </Text>
                  <Text
                    style={[s.calendarHint, selected && { color: c.paper }]}
                  >
                    {today
                      ? choosingYear
                        ? "今年"
                        : "本月"
                      : selected
                        ? "已选"
                        : " "}
                  </Text>
                </Pressable>
              );
            })}
          </View>
          <View style={s.separator} />
          <Pressable
            accessibilityRole="button"
            onPress={() => choose(current)}
            style={s.calendarToday}
          >
            <RotateCcw size={16} color={c.brand} />
            <Text style={[s.text, { color: c.brand }]}>回到本月</Text>
          </Pressable>
        </Sheet>
      )}
    </>
  );
}
function EntryRow({
  e,
  ledger,
  onPress,
}: {
  e: Entry;
  ledger: Ledger;
  onPress: () => void;
}) {
  const account = ledger.accounts.find((a) => a.id === e.accountId)?.name;
  const tag = ledger.labels.find((l) => l.id === e.labelId)?.name;
  const original =
    e.kind === "refund"
      ? ledger.entries.find((x) => x.id === e.originalId)
      : undefined;
  const label = ledger.labels.find(
    (l) => l.id === (original?.labelId || e.labelId),
  );
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${kindName[e.kind]} ${money(e.amountMinor)} ${e.note || tag || account}`}
      onPress={onPress}
      style={s.entryRow}
    >
      <View style={[s.row, { flex: 1 }]}>
        <View style={s.entryIcon}>
          {e.kind === "transfer" ? (
            <ArrowLeftRight size={18} color={c.brand} />
          ) : (
            <LabelGlyph label={label} />
          )}
        </View>
        <View style={{ flex: 1 }}>
          <Text style={[s.text, { fontWeight: "600" }]} numberOfLines={1}>
            {e.note || tag || kindName[e.kind]}
          </Text>
          <Text style={s.muted} numberOfLines={1}>
            {account}
            {e.kind === "transfer"
              ? ` → ${ledger.accounts.find((a) => a.id === e.toAccountId)?.name}`
              : ` · ${tag || (e.kind === "refund" ? "冲减原支出" : "未标记")}`}{" "}
            · {e.occurredAt.slice(5, 16).replace("T", " ")}
          </Text>
        </View>
      </View>
      <Text
        variant="amount"
        style={[
          s.entryAmount,
          {
            color:
              e.kind === "income" || e.kind === "refund" ? c.positive : c.ink,
          },
        ]}
      >
        {e.kind === "transfer" ? "" : e.kind === "expense" ? "-" : "+"}
        {amountText(e.amountMinor)}
      </Text>
    </Pressable>
  );
}
function EntryForm({
  ledger,
  token,
  submit,
  initial,
  preset,
  onDone,
  onDelete,
}: {
  ledger: Ledger;
  token: string;
  submit: Submit;
  initial?: Entry;
  preset?: EntryPreset;
  onDone: (entry: Omit<Entry, "id" | "version">) => void;
  onDelete?: (e: Entry) => void;
}) {
  const [kind, setKind] = useState<Entry["kind"]>(
    initial?.kind || preset?.kind || "expense",
  );
  const [amount, setAmount] = useState(
    initial ? money(initial.amountMinor) : "",
  );
  const [accountId, setAccount] = useState(
    initial?.accountId ||
      preset?.accountId ||
      ledger.defaultAccountId ||
      ledger.accounts[0]?.id ||
      "",
  );
  const [toAccountId, setTo] = useState(
    initial?.toAccountId ||
      preset?.toAccountId ||
      ledger.accounts.find((a) => a.id !== accountId)?.id ||
      "",
  );
  const [labelId, setLabel] = useState(initial?.labelId);
  const [note, setNote] = useState(initial?.note || "");
  const [time, setTime] = useState(initial?.occurredAt || nowInLedger());
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const saving = useRef(false);
  const operation = useRef(randomUUID());
  const baseToken = useRef(token);
  const lastFingerprint = useRef("");
  const appearance = useAppearance();
  const compact = Platform.OS !== "web";
  const [picker, setPicker] = useState<"account" | "to" | "labels" | "time">();
  const [pendingTime, setPendingTime] = useState(time);
  const [timeError, setTimeError] = useState("");
  const replaceAmount = useRef(!!initial);
  const selectedAccount = ledger.accounts.find((a) => a.id === accountId);
  const selectedTo = ledger.accounts.find((a) => a.id === toAccountId);
  const visibleLabels = ledger.labels.filter(
    (l) => l.direction === kind && (!l.hidden || l.id === labelId),
  );
  function moneyKey(key: string) {
    if (saving.current) return;
    const replace = replaceAmount.current;
    replaceAmount.current = false;
    setAmount((current) => {
      const value = replace ? "" : current;
      if (key === "⌫") return value.slice(0, -1);
      if (key === ".")
        return value.includes(".") ? value : (value || "0") + ".";
      if (
        value.length >= 14 ||
        (value.includes(".") && value.split(".")[1].length >= 2)
      )
        return value;
      return (value === "0" ? "" : value) + key;
    });
  }
  useEffect(() => {
    if (!initial && !saving.current) baseToken.current = token;
  }, [token, initial, busy]);
  async function save() {
    if (saving.current) return;
    saving.current = true;
    setBusy(true);
    setError("");
    try {
      const entry = {
        kind,
        amountMinor: parseMoney(amount),
        accountId,
        toAccountId: kind === "transfer" ? toAccountId : undefined,
        labelId: kind === "expense" || kind === "income" ? labelId : undefined,
        originalId: initial?.originalId,
        occurredAt: time,
        note: note.trim(),
      };
      const command: Command = initial
        ? {
            type: "entry.update",
            id: initial.id,
            expectedVersion: initial.version,
            entry,
          }
        : { type: "entry.create", entry };
      const fp = JSON.stringify(command);
      if (lastFingerprint.current && lastFingerprint.current !== fp)
        operation.current = randomUUID();
      lastFingerprint.current = fp;
      await submit(command, operation.current, baseToken.current);
      onDone(entry);
    } catch (e) {
      setError(errorText(e));
    } finally {
      saving.current = false;
      setBusy(false);
    }
  }
  return (
    <View
      style={{ gap: compact ? 6 : 18 }}
      pointerEvents={busy ? "none" : "auto"}
    >
      {!initial && (
        <Segments
          value={kind}
          options={[
            ["expense", "支出"],
            ["income", "收入"],
            ["transfer", "转账"],
          ]}
          onChange={(value) => {
            setKind(value as Entry["kind"]);
            setLabel(undefined);
          }}
        />
      )}
      <View style={{ gap: 4 }}>
        {!compact && <Text style={s.muted}>金额（元）</Text>}
        <View style={s.row}>
          <Text style={[s.text, { fontSize: 25 }]}>¥</Text>
          <TextInput
            accessibilityLabel="金额（元）"
            value={amount}
            onChangeText={(value) => {
              replaceAmount.current = false;
              setAmount(value);
            }}
            onFocus={() => {
              replaceAmount.current = true;
            }}
            showSoftInputOnFocus={Platform.OS === "web"}
            selectTextOnFocus={Platform.OS !== "web"}
            keyboardType="decimal-pad"
            placeholder="0.00"
            placeholderTextColor={c.muted}
            returnKeyType="done"
            onSubmitEditing={() => void save()}
            style={[
              s.amountInput,
              compact && { fontSize: 46, lineHeight: 58, minHeight: 60 },
              appearance.amount && {
                fontFamily: appearance.amount,
                fontWeight: "normal",
              },
            ]}
          />
          {amount !== "" && (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="清空金额"
              hitSlop={10}
              onPress={() => {
                setAmount("");
                replaceAmount.current = false;
              }}
            >
              <X size={18} color={c.muted} />
            </Pressable>
          )}
        </View>
      </View>
      <View style={s.row}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={kind === "transfer" ? "选择转出账户" : "选择账户"}
          disabled={kind === "refund"}
          style={[
            s.option,
            compact && { minHeight: 56, paddingVertical: 3, gap: 3 },
          ]}
          onPress={() => setPicker("account")}
        >
          <Text style={s.muted}>
            {kind === "transfer" ? "转出账户" : "账户"}
          </Text>
          <View style={s.between}>
            <Text style={[s.optionValue, { flex: 1 }]} numberOfLines={1}>
              {selectedAccount?.name || "请选择账户"}
            </Text>
            {kind !== "refund" && <ChevronRight size={14} color={c.muted} />}
          </View>
        </Pressable>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="选择日期与时间"
          style={[
            s.option,
            compact && { minHeight: 56, paddingVertical: 3, gap: 3 },
          ]}
          onPress={() => {
            setPendingTime(time);
            setTimeError("");
            setPicker("time");
          }}
        >
          <Text style={s.muted}>日期</Text>
          <View style={s.between}>
            <Text style={s.optionValue}>
              {time.slice(5, 10).replace("-", "月")}日 {time.slice(11, 16)}
            </Text>
            <ChevronRight size={14} color={c.muted} />
          </View>
        </Pressable>
      </View>
      {kind === "transfer" && (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="选择转入账户"
          style={s.option}
          onPress={() => setPicker("to")}
        >
          <Text style={s.muted}>转入账户 · 信用卡还款也选这里</Text>
          <View style={s.between}>
            <Text style={s.optionValue}>
              {selectedTo?.name || "请选择不同的转入账户"}
            </Text>
            <ChevronRight size={14} color={c.muted} />
          </View>
        </Pressable>
      )}
      {compact ? (
        <TextInput
          accessibilityLabel="备注（选填）"
          value={note}
          onChangeText={setNote}
          maxLength={300}
          placeholder="备注（选填）"
          placeholderTextColor={c.muted}
          style={[s.input, { minHeight: 44, paddingVertical: 8, fontSize: 14 }]}
        />
      ) : (
        <Field
          label="备注（选填）"
          value={note}
          onChangeText={setNote}
          maxLength={300}
          placeholder="想写点什么？"
        />
      )}
      {(kind === "expense" || kind === "income") && (
        <View style={{ gap: 10 }}>
          {!compact && (
            <View style={s.between}>
              <Text style={s.muted}>标签，可不选</Text>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="全部标签"
                onPress={() => setPicker("labels")}
                hitSlop={8}
              >
                <Text style={s.muted}>全部</Text>
              </Pressable>
            </View>
          )}
          <View style={s.wrap}>
            {visibleLabels
              .filter((l, i) => i < 3 || l.id === labelId)
              .map((l) => (
                <Chip
                  key={l.id}
                  selected={labelId === l.id}
                  onPress={() => setLabel(l.id === labelId ? undefined : l.id)}
                >
                  <View style={[s.row, { gap: 5 }]}>
                    <LabelGlyph
                      label={l}
                      size={15}
                      color={labelId === l.id ? c.brand : c.muted}
                    />
                    <Text
                      style={[s.muted, labelId === l.id && { color: c.brand }]}
                    >
                      {l.name}
                    </Text>
                  </View>
                </Chip>
              ))}
            {compact ? (
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="全部标签"
                onPress={() => setPicker("labels")}
                style={s.chip}
              >
                <Text style={s.muted}>全部 ›</Text>
              </Pressable>
            ) : (
              <Chip selected={!labelId} onPress={() => setLabel(undefined)}>
                不选
              </Chip>
            )}
          </View>
        </View>
      )}
      {Platform.OS !== "web" && (
        <View style={s.keypad}>
          {["1", "2", "3", "4", "5", "6", "7", "8", "9", ".", "0", "⌫"].map(
            (key) => (
              <Pressable
                key={key}
                accessibilityRole="button"
                accessibilityLabel={key === "⌫" ? "删除末位" : key}
                onPress={() => moneyKey(key)}
                style={[s.key, compact && { minHeight: 40 }]}
              >
                {key === "⌫" ? (
                  <Delete size={22} color={c.muted} />
                ) : (
                  <Text variant="amount" style={s.keyText}>
                    {key}
                  </Text>
                )}
              </Pressable>
            ),
          )}
        </View>
      )}
      {kind === "refund" && (
        <Text style={s.muted}>退款冲减关联支出，并退回原账户。</Text>
      )}
      {error !== "" && (
        <Text accessibilityRole="alert" style={s.error}>
          {error}
        </Text>
      )}
      <Button
        disabled={busy || !ledger.accounts.length}
        onPress={() => void save()}
      >
        {busy ? "保存中…" : initial ? "保存修改" : "记好了"}
      </Button>
      {initial && onDelete && (
        <Button secondary disabled={busy} onPress={() => onDelete(initial)}>
          删除这笔{kindName[initial.kind]}
        </Button>
      )}
      {(picker === "account" || picker === "to") && (
        <Sheet
          title={picker === "to" ? "选择转入账户" : "选择账户"}
          close={() => setPicker(undefined)}
        >
          {ledger.accounts
            .filter((a) => picker !== "to" || a.id !== accountId)
            .map((a) => (
              <SelectionRow
                key={a.id}
                title={a.name}
                description={`${a.kind === "credit" ? "账面余额 " : "余额 "}¥ ${amountText(balance(ledger, a.id))}`}
                selected={a.id === (picker === "to" ? toAccountId : accountId)}
                onPress={() => {
                  if (picker === "to") setTo(a.id);
                  else {
                    setAccount(a.id);
                    if (toAccountId === a.id)
                      setTo(
                        ledger.accounts.find((x) => x.id !== a.id)?.id || "",
                      );
                  }
                  setPicker(undefined);
                }}
              >
                <AccountGlyph kind={a.kind} />
              </SelectionRow>
            ))}
        </Sheet>
      )}
      {picker === "labels" && (
        <Sheet title="选择标签" close={() => setPicker(undefined)}>
          <Text style={s.muted}>标签是可选的，只留下自己常用的。</Text>
          <SelectionRow
            title="不选标签"
            selected={!labelId}
            onPress={() => {
              setLabel(undefined);
              setPicker(undefined);
            }}
          />
          {visibleLabels.map((l) => (
            <SelectionRow
              key={l.id}
              title={l.name}
              selected={l.id === labelId}
              onPress={() => {
                setLabel(l.id);
                setPicker(undefined);
              }}
            >
              <LabelGlyph label={l} />
            </SelectionRow>
          ))}
        </Sheet>
      )}
      {picker === "time" && (
        <Sheet title="日期与时间" close={() => setPicker(undefined)}>
          <Text style={s.muted}>
            可以补记之前的流水，账本统一使用上海时间。
          </Text>
          <Field
            label="发生时间 · 上海时间"
            value={pendingTime.replace("T", " ")}
            onChangeText={(v) => setPendingTime(v.replace(" ", "T"))}
            placeholder="YYYY-MM-DD HH:mm:ss"
            autoCapitalize="none"
          />
          {timeError !== "" && (
            <Text accessibilityRole="alert" style={s.error}>
              {timeError}
            </Text>
          )}
          <Button
            onPress={() => {
              try {
                validTime(pendingTime);
                setTime(pendingTime);
                setPicker(undefined);
              } catch (e) {
                setTimeError(errorText(e));
              }
            }}
          >
            确定时间
          </Button>
        </Sheet>
      )}
    </View>
  );
}

function AccountForm({
  submit,
  token,
  close,
}: {
  submit: Submit;
  token: string;
  close: () => void;
}) {
  const [name, setName] = useState("");
  const [kind, setKind] = useState<AccountKind>("cash");
  const [opening, setOpening] = useState("0");
  const [time, setTime] = useState(nowInLedger().slice(0, 10) + "T00:00:00");
  const [busy, setBusy] = useState(false);
  const saving = useRef(false);
  const [error, setError] = useState("");
  async function save() {
    if (saving.current) return;
    saving.current = true;
    setBusy(true);
    try {
      await submit(
        {
          type: "account.create",
          name,
          kind,
          openingMinor: parseMoney(opening) * (kind === "credit" ? -1 : 1),
          openedAt: time,
        },
        randomUUID(),
        token,
      );
      close();
    } catch (e) {
      setError(errorText(e));
    } finally {
      saving.current = false;
      setBusy(false);
    }
  }
  return (
    <Sheet title="添加账户" close={close}>
      <Field
        label="账户名称"
        value={name}
        onChangeText={setName}
        maxLength={40}
        placeholder="例如：银行卡、支付宝余额、现金"
        autoFocus
      />
      <View style={s.wrap}>
        {(Object.keys(accountName) as AccountKind[]).map((k) => (
          <Chip key={k} selected={kind === k} onPress={() => setKind(k)}>
            {accountName[k]}
          </Chip>
        ))}
      </View>
      <Field
        label={
          kind === "credit"
            ? "开始时的欠款（元，负数表示溢缴款）"
            : kind === "investment"
              ? "开始时的总估值（元）"
              : "开始时的余额（元）"
        }
        value={opening}
        onChangeText={setOpening}
        keyboardType="numbers-and-punctuation"
      />
      <Field
        label="开始记账时间"
        value={time.replace("T", " ")}
        onChangeText={(v) => setTime(v.replace(" ", "T"))}
      />
      <Text style={s.muted}>
        默认从今天开始，填写开始时已有的金额，不算新增收支。想补记更早的账，可把时间往前调整，并填写那时的金额。每个账户只填它自己的金额。
      </Text>
      {error && <Text style={s.error}>{error}</Text>}
      <Button disabled={busy} onPress={() => void save()}>
        保存账户
      </Button>
    </Sheet>
  );
}
function AccountNameForm({
  account,
  token,
  submit,
  close,
}: {
  account: Account;
  token: string;
  submit: Submit;
  close: () => void;
}) {
  const [name, setName] = useState(account.name);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const saving = useRef(false);
  const operationId = useRef(randomUUID());
  const names =
    account.kind === "credit"
      ? ["信用卡"]
      : account.kind === "investment"
        ? ["股票账户", "基金账户", "理财账户"]
        : ["银行卡", "微信余额", "支付宝余额", "现金"];
  function dismiss() {
    if (!saving.current) close();
  }
  async function save() {
    if (saving.current) return;
    saving.current = true;
    setBusy(true);
    setError("");
    try {
      await submit(
        {
          type: "account.rename",
          id: account.id,
          expectedVersion: account.version,
          name,
        },
        operationId.current,
        token,
      );
      close();
    } catch (e) {
      setError(errorText(e));
    } finally {
      saving.current = false;
      setBusy(false);
    }
  }
  return (
    <Sheet title="修改账户名称" close={dismiss}>
      <Field
        label="账户名称"
        value={name}
        onChangeText={setName}
        maxLength={40}
        autoFocus
        returnKeyType="done"
        onSubmitEditing={() => void save()}
      />
      <Text style={s.muted}>常用名称，也可以自行输入</Text>
      <View style={s.wrap}>
        {names.map((value) => (
          <Chip
            key={value}
            selected={name === value}
            onPress={() => setName(value)}
          >
            {value}
          </Chip>
        ))}
      </View>
      <Text style={s.muted}>只修改名称，余额和历史流水保持不变。</Text>
      {error !== "" && (
        <Text accessibilityRole="alert" style={s.error}>
          {error}
        </Text>
      )}
      <Button disabled={busy || !name.trim()} onPress={() => void save()}>
        {busy ? "保存中…" : "保存名称"}
      </Button>
    </Sheet>
  );
}
function ReconcileForm({
  account,
  ledger,
  token,
  submit,
  close,
}: {
  account: Account;
  ledger: Ledger;
  token: string;
  submit: Submit;
  close: () => void;
}) {
  const assetPrivacy = useAssetPrivacy();
  const [actual, setActual] = useState(
    money(balance(ledger, account.id) * (account.kind === "credit" ? -1 : 1)),
  );
  const [note, setNote] = useState("");
  const [time, setTime] = useState(nowInLedger());
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const saving = useRef(false);
  async function save() {
    if (saving.current || !assetPrivacy.pinned) return;
    saving.current = true;
    setBusy(true);
    try {
      await submit(
        {
          type: "reconcile",
          accountId: account.id,
          actualMinor:
            parseMoney(actual) * (account.kind === "credit" ? -1 : 1),
          occurredAt: time,
          note,
        },
        randomUUID(),
        token,
      );
      close();
    } catch (e) {
      setError(errorText(e));
    } finally {
      saving.current = false;
      setBusy(false);
    }
  }
  return (
    <Sheet
      title={`${account.name} · ${account.kind === "investment" ? "更新估值" : "余额盘点"}`}
      close={close}
    >
      <AssetPeekAmount
        label="当前账面余额"
        value={`¥ ${amountText(balance(ledger, account.id))}`}
      />
      {assetPrivacy.pinned ? (
        <>
          <Field
            label={
              account.kind === "credit"
                ? "实际欠款（元，负数表示溢缴款）"
                : "实际余额 / 市值（元）"
            }
            value={actual}
            onChangeText={setActual}
            keyboardType="numbers-and-punctuation"
            autoFocus
          />
          <Field
            label="盘点时间 · 上海时间"
            value={time.replace("T", " ")}
            onChangeText={(v) => setTime(v.replace(" ", "T"))}
          />
          <Field
            label="备注（选填）"
            value={note}
            onChangeText={setNote}
            maxLength={300}
          />
        </>
      ) : (
        <Text style={s.muted}>点小眼睛显示金额后，再填写盘点。</Text>
      )}
      <Text style={s.muted}>
        记录此刻的实际金额，差额不算收入或支出。盘点包含同一秒内的全部流水；以后补记更早的流水不会改变这次盘点的实际金额。
      </Text>
      {error && assetPrivacy.pinned && <Text style={s.error}>{error}</Text>}
      <Button
        disabled={busy || !assetPrivacy.pinned}
        onPress={() => void save()}
      >
        确认盘点
      </Button>
    </Sheet>
  );
}
function LabelForm({
  initial,
  direction,
  submit,
  token,
  close,
  onDelete,
}: {
  initial?: Label;
  direction: Direction;
  submit: Submit;
  token: string;
  close: () => void;
  onDelete?: (l: Label) => void;
}) {
  const [name, setName] = useState(initial?.name || "");
  const [icon, setIcon] = useState<LabelIcon | undefined>(
    initial
      ? initial.icon || defaultLabelIcon(initial.name, initial.direction)
      : undefined,
  );
  const selectedIcon = icon || defaultLabelIcon(name, direction);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  async function save(hidden = initial?.hidden || false) {
    if (busy) return;
    setBusy(true);
    try {
      await submit(
        initial
          ? {
              type: "label.update",
              id: initial.id,
              expectedVersion: initial.version,
              name,
              hidden,
              icon: selectedIcon,
            }
          : { type: "label.create", name, direction, icon: selectedIcon },
        randomUUID(),
        token,
      );
      close();
    } catch (e) {
      setError(errorText(e));
    } finally {
      setBusy(false);
    }
  }
  return (
    <Sheet
      title={initial ? "管理标签" : `新增${kindName[direction]}标签`}
      close={close}
    >
      <Field
        label="标签名称"
        value={name}
        onChangeText={setName}
        maxLength={20}
        autoFocus
      />
      <Text style={s.muted}>选择图标 · 随应用内置，离线可用</Text>
      <View style={[s.wrap, { gap: 8 }]}>
        {labelIconKeys.map((key) => (
          <Pressable
            key={key}
            accessibilityRole="button"
            accessibilityLabel={`图标：${iconNames[key]}`}
            accessibilityState={{ selected: key === selectedIcon }}
            disabled={busy}
            onPress={() => setIcon(key)}
            style={[s.iconChoice, key === selectedIcon && s.selected]}
          >
            <SmallIcon
              name={key}
              color={key === selectedIcon ? c.brand : c.muted}
            />
            <Text style={s.muted}>{iconNames[key]}</Text>
          </Pressable>
        ))}
      </View>
      {error && <Text style={s.error}>{error}</Text>}
      <Button disabled={busy} onPress={() => void save()}>
        保存标签
      </Button>
      {initial && (
        <>
          <Button
            secondary
            disabled={busy}
            onPress={() => void save(!initial.hidden)}
          >
            {initial.hidden ? "恢复显示" : "隐藏快捷标签"}
          </Button>
          <Button secondary disabled={busy} onPress={() => onDelete?.(initial)}>
            删除标签
          </Button>
        </>
      )}
    </Sheet>
  );
}
function RefundForm({
  entry,
  ledger,
  token,
  submit,
  close,
}: {
  entry: Entry;
  ledger: Ledger;
  token: string;
  submit: Submit;
  close: () => void;
}) {
  const remaining =
    entry.amountMinor -
    ledger.entries
      .filter((e) => e.originalId === entry.id)
      .reduce((n, e) => n + e.amountMinor, 0);
  const [amount, setAmount] = useState(money(remaining));
  const [time, setTime] = useState(nowInLedger());
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const lock = useRef(false);
  async function save() {
    if (lock.current) return;
    lock.current = true;
    setBusy(true);
    try {
      await submit(
        {
          type: "entry.create",
          entry: {
            kind: "refund",
            amountMinor: parseMoney(amount),
            accountId: entry.accountId,
            originalId: entry.id,
            occurredAt: time,
            note: "退款",
          },
        },
        randomUUID(),
        token,
      );
      close();
    } catch (e) {
      setError(errorText(e));
    } finally {
      lock.current = false;
      setBusy(false);
    }
  }
  return (
    <Sheet title="记录退款" close={close}>
      <Text style={s.muted}>
        最多可退 ¥{money(remaining)}，退回原账户。跨月退款冲减退款当月支出。
      </Text>
      <Field
        label="退款金额（元）"
        value={amount}
        onChangeText={setAmount}
        keyboardType="decimal-pad"
        autoFocus
      />
      <Field
        label="退款时间 · 上海时间"
        value={time.replace("T", " ")}
        onChangeText={(v) => setTime(v.replace(" ", "T"))}
      />
      {error && <Text style={s.error}>{error}</Text>}
      <Button disabled={busy} onPress={() => void save()}>
        保存退款
      </Button>
    </Sheet>
  );
}

function FontSettings() {
  const appearance = useAppearance();
  return (
    <View style={{ gap: 8 }}>
      <Text style={s.muted}>
        三种字体都已加厚，正文保持系统字体。选择后立即生效，下次打开继续沿用，字号跟随系统。
      </Text>
      {fontChoices.map((option) => (
        <Pressable
          key={option.id}
          accessibilityRole="button"
          accessibilityLabel={`字体：${option.name}`}
          accessibilityState={{
            selected: appearance.choice === option.id,
            disabled: appearance.busy,
          }}
          disabled={appearance.busy}
          onPress={() => void appearance.setChoice(option.id)}
          style={s.fontOption}
        >
          <View style={s.between}>
            <View style={{ gap: 6, flex: 1 }}>
              <Text
                style={[
                  s.heading,
                  appearance.fontsAvailable &&
                    option.id !== "sans" && {
                      fontFamily: "LedgerSongti",
                      fontWeight: "normal",
                    },
                ]}
              >
                {option.name} · {appName}
              </Text>
              <Text style={s.muted}>{option.description}</Text>
            </View>
            <View
              style={[
                s.selectionCircle,
                appearance.choice === option.id && {
                  backgroundColor: c.brand,
                  borderColor: c.brand,
                },
              ]}
            >
              {appearance.choice === option.id && (
                <Check size={13} color="white" />
              )}
            </View>
          </View>
          <Text
            style={[
              s.stat,
              appearance.fontsAvailable &&
                option.id === "book" && {
                  fontFamily: "LedgerNumbers",
                  fontWeight: "normal",
                },
            ]}
          >
            ¥ 12,345.67
          </Text>
        </Pressable>
      ))}
      {appearance.error !== "" && (
        <Text accessibilityRole="alert" style={s.error}>
          {appearance.error}
        </Text>
      )}
      <Text style={s.muted}>
        字体已随应用打包，无需联网。此偏好只保存在本机，不影响账本或 JSON 备份。
      </Text>
    </View>
  );
}
export type LedgerViewRepository = Pick<
  LedgerRepository,
  "snapshot" | "run" | "restore" | "backups" | "readBackup"
>;
export function LedgerApp({
  repo,
  initial,
}: {
  repo: LedgerViewRepository;
  initial: Snapshot;
}) {
  const [snap, setSnap] = useState(initial);
  const ledger = snap.ledger;
  const [tab, setTab] = useState<Tab>("overview");
  const assetPrivacy = useAssetPrivacyController(tab === "assets", true);
  const [month, setMonth] = useState(nowInLedger().slice(0, 7));
  const [notice, setNotice] = useState("");
  const [addAccount, setAddAccount] = useState(false);
  const [renamingAccount, setRenamingAccount] = useState<Account>();
  const [editing, setEditing] = useState<Entry>();
  const [reconciling, setReconciling] = useState<Account>();
  const [refunding, setRefunding] = useState<Entry>();
  const [labelEdit, setLabelEdit] = useState<{
    initial?: Label;
    direction: Direction;
  }>();
  const [labelDirection, setLabelDirection] = useState<Direction>("expense");
  const [filter, setFilter] = useState("all");
  const [accountFilter, setAccountFilter] = useState("");
  const [tagFilter, setTagFilter] = useState("");
  const [search, setSearch] = useState("");
  const [confirm, setConfirm] = useState<{
    title: string;
    text: string;
    action: () => Promise<void>;
  }>();
  const [confirmError, setConfirmError] = useState("");
  const [confirmBusy, setConfirmBusy] = useState(false);
  const confirmLock = useRef(false);
  const [pendingImport, setPendingImport] = useState<{
    json: string;
    token: string;
  }>();
  const [backups, setBackups] = useState<{ id: string; created_at: string }[]>(
    [],
  );
  const [backupBusy, setBackupBusy] = useState(false);
  const [formKey, setFormKey] = useState(0);
  const [formPreset, setFormPreset] = useState<EntryPreset>();
  const [settingsPage, setSettingsPage] = useState<SettingsPage>("home");
  const appearance = useAppearance();
  const insets = useSafeAreaInsets();
  const [keyboardVisible, setKeyboardVisible] = useState(false);
  const [detailFilters, setDetailFilters] = useState(false);
  const [activeAccount, setActiveAccount] = useState<Account>();
  const [reconciliationListOpen, setReconciliationListOpen] = useState(false);
  const [spendingBreakdownOpen, setSpendingBreakdownOpen] = useState(false);
  const [fontLicenseOpen, setFontLicenseOpen] = useState(false);
  useEffect(() => {
    const show = Keyboard.addListener("keyboardDidShow", () =>
      setKeyboardVisible(true),
    );
    const hide = Keyboard.addListener("keyboardDidHide", () =>
      setKeyboardVisible(false),
    );
    return () => {
      show.remove();
      hide.remove();
    };
  }, []);
  const [backupListLoading, setBackupListLoading] = useState(false);
  const [backupListError, setBackupListError] = useState("");
  const backFromSettings = useCallback(() => {
    setSettingsPage((page) =>
      page === "savedBackups" || page === "lan"
        ? "backup"
        : page === "fonts"
          ? "appearance"
          : "home",
    );
  }, []);
  useEffect(() => {
    if (Platform.OS !== "android") return;
    const subscription = BackHandler.addEventListener(
      "hardwareBackPress",
      () => {
        if (tab !== "settings" || settingsPage === "home") return false;
        backFromSettings();
        return true;
      },
    );
    return () => subscription.remove();
  }, [tab, settingsPage, backFromSettings]);
  const wide = useWindowDimensions().width >= 760;
  const refresh = useCallback(async () => {
    setSnap(await repo.snapshot());
  }, [repo]);
  useEffect(() => {
    const sub = AppState.addEventListener("change", (state) => {
      if (state === "active")
        void refresh().catch((e) => setNotice(errorText(e)));
    });
    const focus = () => void refresh().catch((e) => setNotice(errorText(e)));
    if (Platform.OS === "web") globalThis.addEventListener("focus", focus);
    return () => {
      sub.remove();
      if (Platform.OS === "web") globalThis.removeEventListener("focus", focus);
    };
  }, [refresh]);
  useEffect(() => {
    if (!notice) return;
    const timer = setTimeout(() => setNotice(""), 4500);
    return () => clearTimeout(timer);
  }, [notice]);
  const submit: Submit = async (command, operationId, token = snap.token) => {
    try {
      const next = await repo.run(
        command,
        { operationId, source: "ui", now: nowInLedger(), newId: randomUUID },
        { token },
      );
      setSnap(next);
    } catch (e) {
      await refresh();
      throw e;
    }
  };
  const summary = report(ledger, month);
  const wealth = assets(ledger);
  const sorted = [...ledger.entries].sort(
    (a, b) =>
      b.occurredAt.localeCompare(a.occurredAt) || b.id.localeCompare(a.id),
  );
  function showConfirm(
    title: string,
    text: string,
    action: () => Promise<void>,
  ) {
    setConfirmError("");
    setConfirm({ title, text, action });
  }
  async function confirmAction() {
    if (!confirm || confirmLock.current) return;
    confirmLock.current = true;
    setConfirmBusy(true);
    try {
      await confirm.action();
      setConfirm(undefined);
      setNotice("已完成");
    } catch (e) {
      setConfirmError(errorText(e));
    } finally {
      confirmLock.current = false;
      setConfirmBusy(false);
    }
  }
  function deleteEntry(e: Entry) {
    showConfirm(
      "删除流水",
      `${kindName[e.kind]} ¥${money(e.amountMinor)} 将从账本移除，关联账户余额一起重算。`,
      async () => {
        await submit(
          { type: "entry.delete", id: e.id, expectedVersion: e.version },
          randomUUID(),
        );
        setEditing(undefined);
      },
    );
  }
  function deleteLabel(l: Label) {
    showConfirm(
      "删除标签",
      `“${l.name}”关联的账目会保留，变为未标记。`,
      async () => {
        await submit(
          { type: "label.delete", id: l.id, expectedVersion: l.version },
          randomUUID(),
        );
        setLabelEdit(undefined);
      },
    );
  }
  async function exportFile() {
    setBackupBusy(true);
    try {
      const current = await repo.snapshot();
      if (await saveBackup(exportBackup(current.ledger)))
        setNotice("已打开备份保存窗口");
    } catch (e) {
      setNotice(errorText(e));
    } finally {
      setBackupBusy(false);
    }
  }
  async function openSavedBackups() {
    setSettingsPage("savedBackups");
    setBackupListLoading(true);
    setBackupListError("");
    setBackups([]);
    try {
      setBackups(await repo.backups());
    } catch (e) {
      setBackupListError(errorText(e));
    } finally {
      setBackupListLoading(false);
    }
  }
  async function previewImport(json?: string) {
    setBackupBusy(true);
    try {
      const text = json ?? (await pickBackup());
      if (text) {
        parseBackup(text);
        const current = await repo.snapshot();
        setPendingImport({ json: text, token: current.token });
      }
    } catch (e) {
      setNotice(errorText(e));
    } finally {
      setBackupBusy(false);
    }
  }
  async function receiveLan(json: string, token: string) {
    const next = await repo.restore(json, token, {
      operationId: randomUUID(),
      source: "ui",
      now: nowInLedger(),
      newId: randomUUID,
    });
    setSnap(next);
    setBackups([]);
    setEditing(undefined);
    setFormKey((k) => k + 1);
    setFilter("all");
    setAccountFilter("");
    setTagFilter("");
    setSearch("");
    setMonth(nowInLedger().slice(0, 7));
  }
  async function restore() {
    if (!pendingImport) return;
    setBackupBusy(true);
    try {
      const next = await repo.restore(pendingImport.json, pendingImport.token, {
        operationId: randomUUID(),
        source: "ui",
        now: nowInLedger(),
        newId: randomUUID,
      });
      setSnap(next);
      setPendingImport(undefined);
      setBackups(await repo.backups());
      setEditing(undefined);
      setFormKey((k) => k + 1);
      setFilter("all");
      setAccountFilter("");
      setTagFilter("");
      setSearch("");
      setMonth(nowInLedger().slice(0, 7));
      setNotice("账本已恢复，原账本已自动备份");
    } catch (e) {
      setNotice(errorText(e));
    } finally {
      setBackupBusy(false);
    }
  }
  const tabs: [Tab, string, LucideIcon][] = [
    ["overview", "总览", Home],
    ["details", "明细", List],
    ["add", "记一笔", Plus],
    ["assets", "资产", Wallet],
    ["settings", "设置", Settings],
  ];
  const effectiveLabel = (e: Entry) =>
    e.kind === "refund"
      ? ledger.entries.find((original) => original.id === e.originalId)?.labelId
      : e.labelId;
  const list = sorted.filter(
    (e) =>
      e.occurredAt.startsWith(month) &&
      (filter === "all" ||
        e.kind === filter ||
        (filter === "expense" && e.kind === "refund")) &&
      (!accountFilter ||
        e.accountId === accountFilter ||
        e.toAccountId === accountFilter) &&
      (!tagFilter ||
        (tagFilter === "unlabelled"
          ? !effectiveLabel(e)
          : effectiveLabel(e) === tagFilter)) &&
      (!search ||
        e.note.includes(search) ||
        ledger.accounts
          .find((a) => a.id === e.accountId)
          ?.name.includes(search) ||
        ledger.accounts
          .find((a) => a.id === e.toAccountId)
          ?.name.includes(search) ||
        ledger.labels
          .find((l) => l.id === effectiveLabel(e))
          ?.name.includes(search)),
  );
  return (
    <AssetPrivacyProvider value={assetPrivacy}>
      <SafeAreaView style={s.root} edges={["top", "left", "right"]}>
        <StatusBar style="dark" />
        {notice !== "" && (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="关闭提示"
            onPress={() => setNotice("")}
            style={s.notice}
          >
            <Text accessibilityRole="alert" style={s.text}>
              {notice}
            </Text>
          </Pressable>
        )}
        <KeyboardAvoidingView
          style={{ flex: 1 }}
          behavior={Platform.OS === "ios" ? "padding" : undefined}
        >
          <ScrollView
            key={tab === "settings" ? `settings:${settingsPage}` : tab}
            keyboardShouldPersistTaps="handled"
            contentContainerStyle={[
              s.content,
              tab === "settings" && s.settingsContent,
              tab === "add" && {
                maxWidth: 660,
                ...(Platform.OS !== "web" ? { paddingTop: 8, gap: 12 } : {}),
              },
              { paddingBottom: keyboardVisible ? 28 : 124 + insets.bottom },
            ]}
          >
            {tab === "settings" && settingsPage !== "home" && (
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={
                  settingsPage === "savedBackups" || settingsPage === "lan"
                    ? "返回备份与迁移"
                    : settingsPage === "fonts"
                      ? "返回外观"
                      : "返回设置"
                }
                onPress={backFromSettings}
                style={[s.row, { alignSelf: "flex-start", minHeight: 30 }]}
              >
                <ChevronLeft color={c.brand} size={17} />
                <Text style={[s.muted, { color: c.brand }]}>
                  {settingsPage === "savedBackups" || settingsPage === "lan"
                    ? "备份与迁移"
                    : settingsPage === "fonts"
                      ? "外观"
                      : "设置"}
                </Text>
              </Pressable>
            )}
            <View style={s.between}>
              <View style={s.row}>
                {tab === "overview" && (
                  <SmallIcon name="leaf" color={c.brand} size={25} />
                )}
                <Text variant="heading" style={s.title}>
                  {tab === "overview"
                    ? appName
                    : tab === "settings"
                      ? settingsTitles[settingsPage]
                      : tabs.find((t) => t[0] === tab)?.[1]}
                </Text>
              </View>
              {tab === "overview" || tab === "details" ? (
                <MonthPicker month={month} setMonth={setMonth} />
              ) : tab === "assets" ? (
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel="添加账户"
                  onPress={() => setAddAccount(true)}
                  style={{ padding: 8 }}
                >
                  <Plus size={23} color={c.muted} />
                </Pressable>
              ) : null}
            </View>
            {tab === "overview" && (
              <>
                <View
                  style={[
                    { gap: 26 },
                    wide && {
                      flexDirection: "row",
                      alignItems: "flex-start",
                      gap: 48,
                    },
                  ]}
                >
                  <View
                    style={[
                      { gap: 24, width: "100%", minWidth: 0 },
                      wide && { flex: 1 },
                    ]}
                  >
                    <View style={s.hero}>
                      <Text style={s.sectionLabel}>本月支出</Text>
                      <Text
                        variant="amount"
                        style={s.amount}
                        numberOfLines={1}
                        adjustsFontSizeToFit
                        minimumFontScale={0.55}
                      >
                        ¥ {amountText(summary.expenseMinor)}
                      </Text>
                      <View style={s.summaryRow}>
                        <View style={s.summaryCell}>
                          <Text style={s.muted}>本月收入</Text>
                          <Text
                            variant="amount"
                            style={s.stat}
                            numberOfLines={1}
                            adjustsFontSizeToFit
                          >
                            {amountText(summary.incomeMinor)}
                          </Text>
                        </View>
                        <View style={s.summaryCell}>
                          <Text style={s.muted}>本月结余</Text>
                          <Text
                            variant="amount"
                            style={[s.stat, { color: c.positive }]}
                            numberOfLines={1}
                            adjustsFontSizeToFit
                          >
                            {amountText(summary.surplusMinor)}
                          </Text>
                        </View>
                      </View>
                    </View>
                    <Pressable
                      accessibilityRole="button"
                      accessibilityLabel="查看资产"
                      onPress={() => setTab("assets")}
                      style={s.assetPeek}
                    >
                      <View style={s.row}>
                        <Wallet size={18} color={c.muted} />
                        <Text style={s.muted}>净资产</Text>
                      </View>
                      <View style={[s.row, { flexShrink: 1 }]}>
                        <AssetValue
                          value={amountText(wealth.netMinor)}
                          variant="amount"
                          style={s.stat}
                          numberOfLines={1}
                          adjustsFontSizeToFit
                        />
                        <ChevronRight size={15} color={c.muted} />
                      </View>
                    </Pressable>
                  </View>
                  <View
                    style={[
                      { gap: 8, width: "100%", minWidth: 0 },
                      wide && { flex: 1 },
                    ]}
                  >
                    <View style={s.between}>
                      <Text variant="heading" style={s.heading}>
                        最近记了这些
                      </Text>
                      <Pressable
                        accessibilityRole="button"
                        onPress={() => {
                          setFilter("all");
                          setAccountFilter("");
                          setTagFilter("");
                          setSearch("");
                          setTab("details");
                        }}
                      >
                        <Text style={s.muted}>全部 →</Text>
                      </Pressable>
                    </View>
                    {!ledger.accounts.length ? (
                      <Empty
                        text="从一个账户开始，不用补齐过去的流水"
                        action={() => setAddAccount(true)}
                      />
                    ) : sorted.filter((e) => e.occurredAt.startsWith(month))
                        .length ? (
                      sorted
                        .filter((e) => e.occurredAt.startsWith(month))
                        .slice(0, 3)
                        .map((e, i, rows) => (
                          <View key={e.id}>
                            {(!i ||
                              rows[i - 1].occurredAt.slice(0, 10) !==
                                e.occurredAt.slice(0, 10)) && (
                              <DayHeading date={e.occurredAt.slice(0, 10)} />
                            )}
                            <EntryRow
                              e={e}
                              ledger={ledger}
                              onPress={() => setEditing(e)}
                            />
                          </View>
                        ))
                    ) : (
                      <Empty text="这个月还没有流水，记下第一笔吧。" />
                    )}
                  </View>
                </View>
                <Pressable
                  accessibilityRole="button"
                  accessibilityState={{ expanded: spendingBreakdownOpen }}
                  onPress={() =>
                    setSpendingBreakdownOpen(!spendingBreakdownOpen)
                  }
                  style={[s.between, { paddingVertical: 10 }]}
                >
                  <Text variant="heading" style={s.heading}>
                    支出去向
                  </Text>
                  <Text style={s.muted}>
                    {spendingBreakdownOpen ? "收起" : "展开"}
                  </Text>
                </Pressable>
                {spendingBreakdownOpen && (
                  <View style={{ gap: 16 }}>
                    {Object.entries(summary.byLabel).length ? (
                      Object.entries(summary.byLabel)
                        .sort(([, a], [, b]) => b - a)
                        .map(([key, value]) => (
                          <Pressable
                            key={key}
                            accessibilityRole="button"
                            onPress={() => {
                              setTagFilter(key);
                              setAccountFilter("");
                              setSearch("");
                              setFilter("expense");
                              setTab("details");
                            }}
                            style={s.between}
                          >
                            <View style={s.row}>
                              <LabelGlyph
                                label={ledger.labels.find((l) => l.id === key)}
                                size={19}
                              />
                              <Text style={s.text}>
                                {ledger.labels.find((l) => l.id === key)
                                  ?.name || "未标记"}
                              </Text>
                            </View>
                            <Text variant="amount" style={s.text}>
                              {amountText(value)}
                            </Text>
                          </Pressable>
                        ))
                    ) : (
                      <Text style={s.muted}>
                        记录后，标签和未标记支出都会出现在这里。
                      </Text>
                    )}
                  </View>
                )}
                <Text style={[s.muted, { textAlign: "center" }]}>
                  本机账本 · 每一笔，都由你记录
                </Text>
              </>
            )}
            {tab === "details" && (
              <>
                <View style={s.flowSummary}>
                  <View style={s.summaryCell}>
                    <Text style={s.muted}>本月收入</Text>
                    <Text
                      variant="amount"
                      style={[s.stat, { color: c.positive }]}
                      adjustsFontSizeToFit
                      numberOfLines={1}
                    >
                      ＋{amountText(summary.incomeMinor)}
                    </Text>
                  </View>
                  <View style={s.summaryCell}>
                    <Text style={s.muted}>本月支出</Text>
                    <Text
                      variant="amount"
                      style={s.stat}
                      adjustsFontSizeToFit
                      numberOfLines={1}
                    >
                      {summary.expenseMinor < 0 ? "＋" : "−"}
                      {amountText(Math.abs(summary.expenseMinor))}
                    </Text>
                  </View>
                </View>
                <View style={s.searchBox}>
                  <Search size={17} color={c.muted} />
                  <TextInput
                    accessibilityLabel="搜索备注、标签或账户"
                    value={search}
                    onChangeText={setSearch}
                    placeholder="搜索备注、标签或账户"
                    placeholderTextColor={c.muted}
                    style={s.searchInput}
                  />
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel="筛选账户与标签"
                    onPress={() => setDetailFilters(true)}
                    style={{ padding: 6 }}
                  >
                    <SlidersHorizontal
                      size={18}
                      color={accountFilter || tagFilter ? c.brand : c.muted}
                    />
                  </Pressable>
                </View>
                <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                  <Segments
                    value={filter}
                    options={[
                      ["all", "全部"],
                      ["expense", "支出"],
                      ["income", "收入"],
                      ["transfer", "转账"],
                      ["refund", "退款"],
                    ]}
                    onChange={setFilter}
                  />
                </ScrollView>
                {(accountFilter || tagFilter) && (
                  <View style={s.wrap}>
                    {accountFilter && (
                      <Chip selected onPress={() => setAccountFilter("")}>
                        {ledger.accounts.find((a) => a.id === accountFilter)
                          ?.name || "账户筛选"}{" "}
                        ×
                      </Chip>
                    )}
                    {tagFilter && (
                      <Chip selected onPress={() => setTagFilter("")}>
                        {ledger.labels.find((l) => l.id === tagFilter)?.name ||
                          "未标记"}{" "}
                        ×
                      </Chip>
                    )}
                  </View>
                )}
                <View>
                  {list.length ? (
                    list.map((e, i) => (
                      <View key={e.id}>
                        {(!i ||
                          list[i - 1].occurredAt.slice(0, 10) !==
                            e.occurredAt.slice(0, 10)) && (
                          <DayHeading date={e.occurredAt.slice(0, 10)} />
                        )}
                        <EntryRow
                          e={e}
                          ledger={ledger}
                          onPress={() => setEditing(e)}
                        />
                      </View>
                    ))
                  ) : (
                    <Empty text="这个范围里还没有流水" />
                  )}
                </View>
                <Text style={[s.muted, { textAlign: "center" }]}>
                  当前筛选 · 共 {list.length} 笔
                </Text>
              </>
            )}
            {tab === "add" && (
              <View style={{ gap: 18 }}>
                {ledger.accounts.length ? (
                  <EntryForm
                    key={formKey}
                    preset={formPreset}
                    ledger={ledger}
                    token={snap.token}
                    submit={submit}
                    onDone={(entry) => {
                      setFormKey((k) => k + 1);
                      setNotice("已记下这一笔");
                      setTab("details");
                      setMonth(entry.occurredAt.slice(0, 7));
                      setFilter("all");
                      setAccountFilter("");
                      setTagFilter("");
                      setSearch("");
                    }}
                  />
                ) : (
                  <Empty
                    text="先添加钱所在的账户，比如银行卡、支付宝余额或现金，记账时就能选这笔钱从哪里出、到哪里去。"
                    action={() => setAddAccount(true)}
                  />
                )}
              </View>
            )}
            {tab === "assets" && (
              <>
                <View style={s.hero}>
                  <AssetPeekAmount
                    label="净资产"
                    value={`¥ ${amountText(wealth.netMinor)}`}
                  />
                  {appearance.vaultEnabled && (
                    <LittleVault netMinor={wealth.netMinor} />
                  )}
                  <View style={s.summaryRow}>
                    <View style={s.summaryCell}>
                      <Text style={s.muted}>总资产</Text>
                      <AssetValue
                        value={amountText(wealth.assetMinor)}
                        variant="amount"
                        style={s.stat}
                        numberOfLines={1}
                        adjustsFontSizeToFit
                      />
                    </View>
                    <View style={s.summaryCell}>
                      <Text style={s.muted}>总负债</Text>
                      <AssetValue
                        value={amountText(wealth.debtMinor)}
                        variant="amount"
                        style={s.stat}
                        numberOfLines={1}
                        adjustsFontSizeToFit
                      />
                    </View>
                  </View>
                </View>
                {!wealth.accounts.length && (
                  <Empty
                    text="现金、银行卡、理财和信用卡，都可以单独记"
                    action={() => setAddAccount(true)}
                  />
                )}
                <View
                  style={[
                    { gap: 24 },
                    wide && {
                      flexDirection: "row",
                      alignItems: "flex-start",
                      gap: 40,
                    },
                  ]}
                >
                  {[
                    [
                      "日常账户",
                      wealth.accounts.filter((a) => a.kind === "cash"),
                    ],
                    [
                      "理财与待还款",
                      wealth.accounts.filter((a) => a.kind !== "cash"),
                    ],
                  ].map(([title, rows]) => (
                    <View
                      key={title as string}
                      style={[
                        { width: "100%", minWidth: 0, gap: 6 },
                        wide && { flex: 1 },
                      ]}
                    >
                      <Text style={s.muted}>{title as string}</Text>
                      {(rows as typeof wealth.accounts).map((a) => (
                        <View key={a.id} style={s.accountRow}>
                          <Pressable
                            accessibilityRole="button"
                            accessibilityLabel={`账户：${a.name}`}
                            onPress={() => setActiveAccount(a)}
                            style={[
                              s.row,
                              { flex: 1, minWidth: 0, minHeight: 44 },
                            ]}
                          >
                            <AccountGlyph kind={a.kind} />
                            <View style={{ flex: 1, gap: 4 }}>
                              <Text
                                style={[s.text, { fontWeight: "600" }]}
                                numberOfLines={2}
                              >
                                {a.name}
                              </Text>
                              <Text style={s.muted}>
                                {a.kind === "credit"
                                  ? !assetPrivacy.visible
                                    ? "信用卡"
                                    : a.balanceMinor < 0
                                      ? "待还款"
                                      : "溢缴款"
                                  : a.kind === "investment"
                                    ? a.lastReconciledAt
                                      ? `最近盘点 ${a.lastReconciledAt.slice(0, 10)}`
                                      : `开始记录 ${a.openedAt.slice(0, 10)}`
                                    : "日常收支"}
                              </Text>
                            </View>
                          </Pressable>
                          <View style={{ maxWidth: "47%", minWidth: 90 }}>
                            <AssetValue
                              value={`${a.kind === "credit" && a.balanceMinor < 0 ? "−" : ""}${amountText(a.kind === "credit" ? Math.abs(a.balanceMinor) : a.balanceMinor)}`}
                              variant="amount"
                              style={s.accountBalance}
                              adjustsFontSizeToFit
                              minimumFontScale={0.65}
                              numberOfLines={1}
                            />
                            {a.kind === "investment" && (
                              <Pressable
                                accessibilityRole="button"
                                accessibilityLabel={`盘点：${a.name}`}
                                style={s.inlineAction}
                                onPress={() => setReconciling(a)}
                              >
                                <Text
                                  style={[
                                    s.muted,
                                    { color: c.brand, textAlign: "right" },
                                  ]}
                                >
                                  盘点 ›
                                </Text>
                              </Pressable>
                            )}
                          </View>
                        </View>
                      ))}
                    </View>
                  ))}
                </View>
                <Text style={s.muted}>
                  信用卡消费记支出，还款记银行卡 →
                  信用卡转账。理财按最近一次盘点显示。
                </Text>
                <Pressable
                  accessibilityRole="button"
                  accessibilityState={{ expanded: reconciliationListOpen }}
                  style={s.between}
                  onPress={() =>
                    setReconciliationListOpen(!reconciliationListOpen)
                  }
                >
                  <Text variant="heading" style={s.heading}>
                    盘点记录
                  </Text>
                  <Text style={s.muted}>
                    {reconciliationListOpen
                      ? "收起"
                      : `${ledger.reconciliations.length} 条 · 展开`}
                  </Text>
                </Pressable>
                {reconciliationListOpen && (
                  <View style={{ gap: 20 }}>
                    {[...ledger.reconciliations]
                      .sort((a, b) => b.occurredAt.localeCompare(a.occurredAt))
                      .map((r: Reconciliation) => (
                        <View key={r.id} style={{ gap: 6 }}>
                          <View style={s.between}>
                            <Text style={[s.text, { flex: 1 }]}>
                              {
                                ledger.accounts.find(
                                  (a) => a.id === r.accountId,
                                )?.name
                              }{" "}
                              · <AssetValue value={money(r.actualMinor)} />
                            </Text>
                            <Pressable
                              accessibilityRole="button"
                              onPress={() =>
                                showConfirm(
                                  "删除盘点",
                                  "删除后，账户将按之前的盘点和流水重新计算。",
                                  async () => {
                                    await submit(
                                      {
                                        type: "reconciliation.delete",
                                        id: r.id,
                                        expectedVersion: r.version,
                                      },
                                      randomUUID(),
                                    );
                                  },
                                )
                              }
                            >
                              <Text style={s.error}>删除</Text>
                            </Pressable>
                          </View>
                          <Text style={s.muted}>
                            {r.occurredAt.replace("T", " ")} · 盘点差额{" "}
                            <AssetValue
                              value={money(
                                r.actualMinor -
                                  balance(
                                    ledger,
                                    r.accountId,
                                    r.occurredAt,
                                    r.occurredAt,
                                  ),
                              )}
                            />
                            {r.note
                              ? assetPrivacy.visible
                                ? ` · ${r.note}`
                                : " · 备注已隐藏"
                              : ""}
                          </Text>
                        </View>
                      ))}
                    {!ledger.reconciliations.length && (
                      <Text style={s.muted}>
                        没有盘点记录。盘点差额不会混入收支。
                      </Text>
                    )}
                  </View>
                )}
              </>
            )}
            {tab === "settings" && (
              <>
                {settingsPage === "home" && (
                  <>
                    <Text style={s.muted}>账本偏好</Text>
                    <View style={s.settingsList}>
                      <SettingsRow
                        title="标签管理"
                        description="只留下自己常用的标签"
                        icon={Tag}
                        onPress={() => setSettingsPage("labels")}
                      />
                      <View style={s.settingsDivider} />
                      <SettingsRow
                        title="外观"
                        description="字体与本机显示偏好"
                        icon={Type}
                        onPress={() => setSettingsPage("appearance")}
                      />
                    </View>
                    <Text style={s.muted}>数据与备份</Text>
                    <View style={s.settingsList}>
                      <SettingsRow
                        title="备份与迁移"
                        description="导出、导入和恢复账本"
                        icon={Download}
                        onPress={() => setSettingsPage("backup")}
                      />
                      <View style={s.settingsDivider} />
                      <SettingsRow
                        title="变更记录"
                        description="回看最近的本地操作"
                        icon={History}
                        onPress={() => setSettingsPage("history")}
                      />
                    </View>
                    <SettingsRow
                      title={`关于${appName}`}
                      description="版本与本地数据说明"
                      icon={Info}
                      onPress={() => setSettingsPage("about")}
                    />
                    <View
                      style={{ alignItems: "center", gap: 10, marginTop: 12 }}
                    >
                      <SmallIcon name="leaf" size={28} />
                      <Text style={s.muted}>
                        数据仅保存在本机 · {appName} 0.1.0
                      </Text>
                    </View>
                  </>
                )}
                {settingsPage === "appearance" && (
                  <>
                    <View style={s.between}>
                      <View style={{ flex: 1, gap: 4, paddingRight: 12 }}>
                        <Text style={s.text}>小金库</Text>
                        <Text style={s.muted}>
                          把净资产化作金子，随积累升级保险柜
                        </Text>
                      </View>
                      <Switch
                        accessibilityLabel="小金库"
                        value={appearance.vaultEnabled}
                        disabled={appearance.vaultBusy}
                        onValueChange={(enabled) =>
                          void appearance.setVaultEnabled(enabled)
                        }
                        trackColor={{ true: c.brand }}
                      />
                    </View>
                    <Text style={s.muted}>
                      1 万元一块金块，1 千元一枚金币，100
                      元一颗金粒，零头为金粉。金库有独立的小眼睛，离页或进入后台自动合上。
                    </Text>
                    {appearance.vaultError !== "" && (
                      <Text style={s.error}>{appearance.vaultError}</Text>
                    )}
                    <SettingsRow
                      title="字体"
                      description={`${fontChoices.find((f) => f.id === appearance.choice)?.name} · 点击选择`}
                      icon={Type}
                      onPress={() => setSettingsPage("fonts")}
                    />
                    <Text style={s.muted}>
                      暖灰底、深色文字与绿色强调，辅助信息也保持清晰。字号跟随系统设置。
                    </Text>
                    {appearance.error !== "" && (
                      <Text style={s.error}>{appearance.error}</Text>
                    )}
                  </>
                )}
                {settingsPage === "fonts" && <FontSettings />}
                {settingsPage === "labels" && (
                  <>
                    <Segments
                      value={labelDirection}
                      options={[
                        ["expense", "支出"],
                        ["income", "收入"],
                      ]}
                      onChange={(v) => setLabelDirection(v as Direction)}
                    />
                    <View style={s.wrap}>
                      {ledger.labels
                        .filter((l) => l.direction === labelDirection)
                        .map((l) => (
                          <Chip
                            key={l.id}
                            onPress={() =>
                              setLabelEdit({
                                initial: l,
                                direction: l.direction,
                              })
                            }
                          >
                            <View style={[s.row, { gap: 7 }]}>
                              <LabelGlyph label={l} size={19} />
                              <Text style={s.text}>
                                {l.name}
                                {l.hidden ? " · 已隐藏" : ""}
                              </Text>
                            </View>
                          </Chip>
                        ))}
                      <Chip
                        onPress={() =>
                          setLabelEdit({ direction: labelDirection })
                        }
                      >
                        ＋ 新标签
                      </Chip>
                    </View>
                    <Text style={s.muted}>
                      点击标签可改名、选择图标、隐藏或删除。每笔最多选一个，也可以不选。
                    </Text>
                  </>
                )}
                {settingsPage === "backup" && (
                  <>
                    <View style={s.settingsList}>
                      <SettingsRow
                        title="导出 JSON 备份"
                        description="保存完整账本，用于备份或迁移"
                        icon={Download}
                        disabled={backupBusy}
                        onPress={() => void exportFile()}
                      />
                      <View style={s.settingsDivider} />
                      <SettingsRow
                        title="选择 JSON 并预览导入"
                        description="先预览，再确认是否替换本机账本"
                        icon={Upload}
                        disabled={backupBusy}
                        onPress={() => void previewImport()}
                      />
                      <View style={s.settingsDivider} />
                      <SettingsRow
                        title="局域网传输"
                        description="手机与电脑连接后，选择整本覆盖方向"
                        icon={Wifi}
                        onPress={() => setSettingsPage("lan")}
                      />
                      <View style={s.settingsDivider} />
                      <SettingsRow
                        title="自动备份"
                        description="导入前保留的账本版本"
                        icon={RotateCcw}
                        disabled={backupBusy}
                        onPress={() => void openSavedBackups()}
                      />
                    </View>
                    <Text style={s.muted}>
                      各设备保存独立账本，通过 JSON
                      整本迁移。备份是明文，拿到文件的人可以读取；导入会替换本机整本账，不做合并。
                    </Text>
                  </>
                )}
                {settingsPage === "lan" && (
                  <LanTransfer
                    snapshot={() => repo.snapshot()}
                    onReceive={receiveLan}
                  />
                )}
                {settingsPage === "savedBackups" && (
                  <View style={s.card}>
                    <Text style={s.muted}>
                      导入前会自动保存当时的本机账本，恢复前可以先预览。
                    </Text>
                    {backupListLoading && (
                      <ActivityIndicator
                        accessibilityLabel="正在读取自动备份"
                        color={c.brand}
                      />
                    )}
                    {backupListError !== "" && (
                      <>
                        <Text accessibilityRole="alert" style={s.error}>
                          {backupListError}
                        </Text>
                        <Button
                          secondary
                          onPress={() => void openSavedBackups()}
                        >
                          重新读取
                        </Button>
                      </>
                    )}
                    {!backupListLoading &&
                      !backupListError &&
                      !backups.length && (
                        <Text style={s.muted}>还没有自动备份</Text>
                      )}
                    {backups.map((b) => (
                      <View key={b.id} style={s.between}>
                        <Text style={s.muted}>
                          {b.created_at.replace("T", " ")}
                        </Text>
                        <Button
                          secondary
                          disabled={backupBusy}
                          onPress={() =>
                            void repo
                              .readBackup(b.id)
                              .then((json) => previewImport(json))
                              .catch((e) => setNotice(errorText(e)))
                          }
                        >
                          预览恢复
                        </Button>
                      </View>
                    ))}
                  </View>
                )}
                {settingsPage === "history" && (
                  <View style={s.card}>
                    <Text style={s.muted}>
                      最近 20 次操作，保留操作来源，便于核对。
                    </Text>
                    {ledger.audit
                      .slice(-20)
                      .reverse()
                      .map((a) => (
                        <View
                          key={a.revision}
                          style={{ gap: 4, paddingVertical: 8 }}
                        >
                          <View style={s.between}>
                            <Text style={s.text}>
                              {auditNames[a.action] || "其他操作"}
                            </Text>
                            <Text style={s.muted}>
                              {a.source === "cli" ? "CLI" : "界面"}
                            </Text>
                          </View>
                          <Text style={s.muted}>{a.at.replace("T", " ")}</Text>
                        </View>
                      ))}
                    {!ledger.audit.length && (
                      <Text style={s.muted}>还没有变更记录</Text>
                    )}
                  </View>
                )}
                {settingsPage === "about" && (
                  <View style={s.card}>
                    <View style={s.row}>
                      <SmallIcon name="leaf" size={29} color={c.brand} />
                      <Text variant="heading" style={s.title}>
                        {appName}
                      </Text>
                    </View>
                    <Text style={s.text}>纯本地 · 无需登录 · 无广告</Text>
                    <Text style={s.muted}>
                      账目保存在这台设备上，不会自动同步。卸载应用前请先导出备份。
                    </Text>
                    <Text style={s.muted}>
                      版本 0.1.0 · 人民币 ·
                      上海时间。退款冲减退款发生月份的支出。
                    </Text>
                    <Button secondary onPress={() => setFontLicenseOpen(true)}>
                      查看字体许可
                    </Button>
                  </View>
                )}
              </>
            )}
          </ScrollView>
        </KeyboardAvoidingView>
        {!keyboardVisible && (
          <View
            pointerEvents="box-none"
            style={[s.navDock, { bottom: 12 + insets.bottom }]}
          >
            <View style={s.tabbar}>
              {tabs.map(([key, name, Icon]) => (
                <Pressable
                  key={key}
                  accessibilityRole="tab"
                  accessibilityLabel={name}
                  accessibilityState={{ selected: tab === key }}
                  onPress={() => {
                    setTab(key);
                    if (key === "settings") setSettingsPage("home");
                    if (key === "add") {
                      setFormPreset(undefined);
                      setFormKey((k) => k + 1);
                    }
                    void refresh().catch((e) => setNotice(errorText(e)));
                  }}
                  style={s.tab}
                >
                  <View style={key === "add" ? s.tabAdd : undefined}>
                    <Icon
                      size={key === "add" ? 23 : 20}
                      color={
                        key === "add"
                          ? "white"
                          : tab === key
                            ? c.brand
                            : c.muted
                      }
                    />
                  </View>
                  <Text style={[s.tabText, tab === key && { color: c.brand }]}>
                    {name}
                  </Text>
                  {tab === key && key !== "add" && <View style={s.tabDot} />}
                </Pressable>
              ))}
            </View>
          </View>
        )}
        {detailFilters && (
          <Sheet title="筛选流水" close={() => setDetailFilters(false)}>
            <Text variant="heading" style={s.heading}>
              账户
            </Text>
            <View style={s.wrap}>
              <Chip
                selected={!accountFilter}
                onPress={() => setAccountFilter("")}
              >
                全部账户
              </Chip>
              {ledger.accounts.map((a) => (
                <Chip
                  key={a.id}
                  selected={accountFilter === a.id}
                  onPress={() => setAccountFilter(a.id)}
                >
                  {a.name}
                </Chip>
              ))}
            </View>
            <Text variant="heading" style={s.heading}>
              标签
            </Text>
            <View style={s.wrap}>
              <Chip selected={!tagFilter} onPress={() => setTagFilter("")}>
                全部标签
              </Chip>
              <Chip
                selected={tagFilter === "unlabelled"}
                onPress={() => setTagFilter("unlabelled")}
              >
                未标记
              </Chip>
              {ledger.labels.map((l) => (
                <Chip
                  key={l.id}
                  selected={tagFilter === l.id}
                  onPress={() => setTagFilter(l.id)}
                >
                  {l.name}
                </Chip>
              ))}
            </View>
            <Button onPress={() => setDetailFilters(false)}>完成筛选</Button>
          </Sheet>
        )}
        {activeAccount && (
          <Sheet
            title={activeAccount.name}
            close={() => setActiveAccount(undefined)}
          >
            <AssetPeekAmount
              label="账户余额"
              value={`¥ ${amountText(balance(ledger, activeAccount.id))}`}
            />
            <SettingsRow
              title="修改账户名称"
              description="余额与历史流水保持不变"
              icon={Settings}
              onPress={() => {
                setRenamingAccount(activeAccount);
                setActiveAccount(undefined);
              }}
            />
            <SettingsRow
              title={
                activeAccount.kind === "investment" ? "更新估值" : "盘点余额"
              }
              description="记录实际金额，差额不计入收支"
              icon={Wallet}
              onPress={() => {
                setReconciling(activeAccount);
                setActiveAccount(undefined);
              }}
            />
            <SettingsRow
              title={activeAccount.kind === "credit" ? "信用卡还款" : "转账"}
              description="账户间转账不计入收支"
              icon={ArrowLeftRight}
              onPress={() => {
                const other =
                  ledger.accounts.find(
                    (a) => a.id !== activeAccount.id && a.kind !== "credit",
                  ) || ledger.accounts.find((a) => a.id !== activeAccount.id);
                setFormPreset(
                  activeAccount.kind === "credit"
                    ? {
                        kind: "transfer",
                        accountId: other?.id || "",
                        toAccountId: activeAccount.id,
                      }
                    : {
                        kind: "transfer",
                        accountId: activeAccount.id,
                        toAccountId: other?.id,
                      },
                );
                setFormKey((k) => k + 1);
                setTab("add");
                setActiveAccount(undefined);
              }}
            />
          </Sheet>
        )}
        {fontLicenseOpen && (
          <Sheet title="字体许可" close={() => setFontLicenseOpen(false)}>
            {(
              require("../assets/fonts/licenses.json") as {
                name: string;
                text: string;
              }[]
            ).map((license) => (
              <View key={license.name} style={{ gap: 12 }}>
                <Text variant="heading" style={s.heading}>
                  {license.name}
                </Text>
                <Text style={s.muted}>{license.text}</Text>
              </View>
            ))}
          </Sheet>
        )}
        {addAccount && (
          <AccountForm
            token={snap.token}
            submit={submit}
            close={() => setAddAccount(false)}
          />
        )}
        {renamingAccount && (
          <AccountNameForm
            account={renamingAccount}
            token={snap.token}
            submit={submit}
            close={() => setRenamingAccount(undefined)}
          />
        )}
        {reconciling && (
          <ReconcileForm
            account={reconciling}
            ledger={ledger}
            token={snap.token}
            submit={submit}
            close={() => setReconciling(undefined)}
          />
        )}
        {editing && (
          <Sheet
            title={`${kindName[editing.kind]}详情`}
            close={() => setEditing(undefined)}
          >
            <EntryForm
              ledger={ledger}
              token={snap.token}
              submit={submit}
              initial={editing}
              onDone={() => {
                setEditing(undefined);
                setNotice("修改已保存");
              }}
              onDelete={deleteEntry}
            />
            {editing.kind === "expense" && (
              <Button
                secondary
                onPress={() => {
                  setRefunding(editing);
                  setEditing(undefined);
                }}
              >
                记录部分 / 全额退款
              </Button>
            )}
          </Sheet>
        )}
        {refunding && (
          <RefundForm
            entry={refunding}
            ledger={ledger}
            token={snap.token}
            submit={submit}
            close={() => setRefunding(undefined)}
          />
        )}
        {labelEdit && (
          <LabelForm
            {...labelEdit}
            token={snap.token}
            submit={submit}
            close={() => setLabelEdit(undefined)}
            onDelete={deleteLabel}
          />
        )}
        {confirm && (
          <Sheet
            title={confirm.title}
            close={() => {
              if (!confirmBusy) setConfirm(undefined);
            }}
          >
            <Text style={s.text}>{confirm.text}</Text>
            {confirmError && <Text style={s.error}>{confirmError}</Text>}
            <Button
              danger
              disabled={confirmBusy}
              onPress={() => void confirmAction()}
            >
              {confirmBusy ? "处理中…" : "确认执行"}
            </Button>
            <Button
              secondary
              disabled={confirmBusy}
              onPress={() => setConfirm(undefined)}
            >
              取消
            </Button>
          </Sheet>
        )}
        {pendingImport && (
          <Sheet
            title="确认替换本机账本"
            close={() => {
              if (!backupBusy) setPendingImport(undefined);
            }}
          >
            <Text style={s.text}>
              {parseBackup(pendingImport.json).ledger.name}
            </Text>
            <Text style={s.muted}>
              导出于{" "}
              {parseBackup(pendingImport.json).exportedAt.replace("T", " ")}\n
              {parseBackup(pendingImport.json).ledger.accounts.length} 个账户 ·{" "}
              {parseBackup(pendingImport.json).ledger.entries.length} 笔流水 ·{" "}
              {parseBackup(pendingImport.json).ledger.reconciliations.length}{" "}
              条盘点
            </Text>
            <Text style={s.text}>
              导入不会合并两端数据。当前账本会先自动备份，再整体替换。
            </Text>
            <Button danger disabled={backupBusy} onPress={() => void restore()}>
              {backupBusy ? "恢复中…" : "备份当前账本并替换"}
            </Button>
            <Button
              secondary
              disabled={backupBusy}
              onPress={() => setPendingImport(undefined)}
            >
              取消
            </Button>
          </Sheet>
        )}
      </SafeAreaView>
    </AssetPrivacyProvider>
  );
}
function LedgerBoot() {
  const appearance = useAppearance();
  const [ready, setReady] = useState<{
    repo: LedgerRepository;
    snapshot: Snapshot;
  }>();
  const [error, setError] = useState("");
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    let disposed = false;
    let opened: LedgerRepository | undefined;
    void openLedger()
      .then(async (repo) => {
        opened = repo;
        const snapshot = await repo.snapshot();
        if (!disposed) setReady({ repo, snapshot });
        else await repo.close();
      })
      .catch((e) => {
        if (!disposed) setError(errorText(e));
      });
    return () => {
      disposed = true;
      if (opened) void opened.close();
    };
  }, [attempt]);
  return (
    <>
      {ready && appearance.ready ? (
        <LedgerApp repo={ready.repo} initial={ready.snapshot} />
      ) : (
        <SafeAreaView
          style={[s.root, { justifyContent: "center", padding: 30, gap: 20 }]}
        >
          <Text variant="heading" style={s.title}>
            {appName}
          </Text>
          {error ? (
            <>
              <Text style={s.error}>{error}</Text>
              <Button
                onPress={() => {
                  setError("");
                  setAttempt((x) => x + 1);
                }}
              >
                重试打开账本
              </Button>
            </>
          ) : (
            <>
              <ActivityIndicator color={c.brand} />
              <Text style={s.muted}>正在打开本地账本…</Text>
            </>
          )}
        </SafeAreaView>
      )}
    </>
  );
}
export default function App() {
  return (
    <SafeAreaProvider>
      <AppearanceProvider>
        <LedgerBoot />
      </AppearanceProvider>
    </SafeAreaProvider>
  );
}
