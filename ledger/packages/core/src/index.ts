/** All money is CNY minor units. No platform dependencies and no I/O. */
export type AccountKind = "cash" | "investment" | "credit";
export type Direction = "expense" | "income";
export type EntryKind = Direction | "transfer" | "refund";
export const labelIconKeys = [
  "tag",
  "food",
  "coffee",
  "train",
  "shopping",
  "home",
  "salary",
  "investment",
  "gift",
  "health",
  "sport",
  "entertainment",
  "travel",
  "education",
  "pets",
] as const;
export type LabelIcon = (typeof labelIconKeys)[number];
export function defaultLabelIcon(
  name: string,
  direction: Direction,
): LabelIcon {
  const icons: Record<string, LabelIcon> = {
    吃饭: "food",
    餐饮: "food",
    咖啡: "coffee",
    交通: "train",
    住房: "home",
    房租: "home",
    买东西: "shopping",
    购物: "shopping",
    日用: "shopping",
    娱乐: "entertainment",
    医疗: "health",
    工资: "salary",
    奖金: "salary",
    利息: "investment",
    理财: "investment",
    礼物: "gift",
    运动: "sport",
    旅行: "travel",
    学习: "education",
    宠物: "pets",
  };
  return Object.hasOwn(icons, name)
    ? icons[name]
    : direction === "income"
      ? "salary"
      : "tag";
}
export interface RecordBase {
  id: string;
  version: number;
}
export interface Account extends RecordBase {
  name: string;
  kind: AccountKind;
  openingMinor: number;
  openedAt: string;
}
export interface Label extends RecordBase {
  name: string;
  direction: Direction;
  hidden: boolean;
  icon?: LabelIcon;
}
export interface Entry extends RecordBase {
  kind: EntryKind;
  amountMinor: number;
  accountId: string;
  toAccountId?: string;
  labelId?: string;
  originalId?: string;
  occurredAt: string;
  note: string;
}
export interface Reconciliation extends RecordBase {
  accountId: string;
  actualMinor: number;
  occurredAt: string;
  note: string;
}
export interface Audit {
  revision: number;
  at: string;
  source: "ui" | "cli";
  action: string;
  recordId?: string;
}
export interface Receipt {
  operationId: string;
  fingerprint: string;
  resultId?: string;
  revision: number;
}
export interface Ledger {
  formatVersion: 1;
  id: string;
  name: string;
  currency: "CNY";
  timeZone: "Asia/Shanghai";
  revision: number;
  defaultAccountId?: string;
  accounts: Account[];
  labels: Label[];
  entries: Entry[];
  reconciliations: Reconciliation[];
  audit: Audit[];
  receipts: Receipt[];
}
export type Command =
  | {
      type: "account.create";
      name: string;
      kind: AccountKind;
      openingMinor: number;
      openedAt: string;
    }
  | {
      type: "account.rename";
      id: string;
      expectedVersion: number;
      name: string;
    }
  | {
      type: "label.create";
      name: string;
      direction: Direction;
      icon?: LabelIcon;
    }
  | {
      type: "label.update";
      id: string;
      expectedVersion: number;
      name: string;
      hidden: boolean;
      icon?: LabelIcon;
    }
  | { type: "label.delete"; id: string; expectedVersion: number }
  | { type: "entry.create"; entry: Omit<Entry, "id" | "version"> }
  | {
      type: "entry.update";
      id: string;
      expectedVersion: number;
      entry: Omit<Entry, "id" | "version">;
    }
  | { type: "entry.delete"; id: string; expectedVersion: number }
  | {
      type: "reconcile";
      accountId: string;
      actualMinor: number;
      occurredAt: string;
      note: string;
    }
  | { type: "reconciliation.delete"; id: string; expectedVersion: number };
export interface Context {
  operationId: string;
  source: "ui" | "cli";
  now: string;
  newId: () => string;
}
export class LedgerError extends Error {
  constructor(
    public code: string,
    message: string,
  ) {
    super(message);
    this.name = "LedgerError";
  }
}
export function invariant(
  value: unknown,
  message: string,
  code = "INVALID_INPUT",
): asserts value {
  if (!value) throw new LedgerError(code, message);
}
export const MAX_MINOR = 9_000_000_000_000;
export function minor(value: unknown): asserts value is number {
  invariant(
    typeof value === "number" &&
      Number.isSafeInteger(value) &&
      Math.abs(value) <= MAX_MINOR,
    "金额必须为有效的整数分",
  );
}
export function parseMoney(input: string): number {
  invariant(
    /^-?\d{1,11}(\.\d{1,2})?$/.test(input.trim()),
    "请输入金额，最多两位小数",
  );
  const s = input.trim();
  const [whole, fraction = ""] = s.replace("-", "").split(".");
  const value =
    (Number(whole) * 100 + Number(fraction.padEnd(2, "0"))) *
    (s.startsWith("-") ? -1 : 1);
  minor(value);
  return value;
}
export function money(value: number): string {
  minor(value);
  return `${value < 0 ? "-" : ""}${Math.floor(Math.abs(value) / 100)}.${String(Math.abs(value) % 100).padStart(2, "0")}`;
}
/** Fixed ledger wall time: all clients use Asia/Shanghai, without a machine-local offset. */
export function nowInLedger(date = new Date()): string {
  return new Date(date.getTime() + 8 * 3600_000).toISOString().slice(0, 19);
}
export function validTime(value: unknown): asserts value is string {
  invariant(
    typeof value === "string" &&
      /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}$/.test(value),
    "时间格式应为 YYYY-MM-DDTHH:mm:ss",
  );
  const d = new Date(value + "Z");
  invariant(
    Number.isFinite(d.getTime()) &&
      d.toISOString().slice(0, 19) === value &&
      value >= "1900-01-01T00:00:00" &&
      value < "2200-01-01T00:00:00",
    "日期或时间无效",
  );
}
function text(
  value: unknown,
  max: number,
  required = true,
): asserts value is string {
  invariant(
    typeof value === "string" &&
      value.length <= max &&
      (!required || value.trim().length > 0),
    `文本长度应为 ${required ? "1" : "0"}～${max} 个字符`,
  );
}
function id(value: unknown): asserts value is string {
  invariant(
    typeof value === "string" && /^[a-zA-Z0-9_-]{1,100}$/.test(value),
    "记录 ID 无效",
  );
}
function version(v: unknown): asserts v is number {
  invariant(Number.isSafeInteger(v) && Number(v) >= 1, "记录版本无效");
}
function checked<T extends RecordBase>(
  items: T[],
  key: string,
  expectedVersion: number,
): T {
  const item = items.find((x) => x.id === key);
  invariant(item, "记录不存在", "NOT_FOUND");
  invariant(
    item.version === expectedVersion,
    "记录已被修改，请刷新后重试",
    "CONFLICT",
  );
  return item;
}
function canonical(value: unknown): string {
  if (Array.isArray(value)) return "[" + value.map(canonical).join(",") + "]";
  if (value && typeof value === "object")
    return (
      "{" +
      Object.entries(value)
        .filter(([, v]) => v !== undefined)
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([k, v]) => JSON.stringify(k) + ":" + canonical(v))
        .join(",") +
      "}"
    );
  return JSON.stringify(value);
}
export function emptyLedger(newId: () => string): Ledger {
  const labels: Label[] = [];
  for (const [direction, names] of [
    ["expense", ["吃饭", "交通", "住房", "买东西", "娱乐", "医疗"]],
    ["income", ["工资", "奖金", "利息", "其他收入"]],
  ] as const)
    for (const name of names)
      labels.push({ id: newId(), version: 1, direction, name, hidden: false });
  return {
    formatVersion: 1,
    id: newId(),
    name: "我的账本",
    currency: "CNY",
    timeZone: "Asia/Shanghai",
    revision: 0,
    accounts: [],
    labels,
    entries: [],
    reconciliations: [],
    audit: [],
    receipts: [],
  };
}
/** Strictly validate imported state before any database writes. */
export function validateLedger(data: unknown): asserts data is Ledger {
  invariant(data && typeof data === "object", "账本格式无效");
  const s = data as Ledger;
  invariant(
    s.formatVersion === 1,
    "不支持此备份格式版本",
    "UNSUPPORTED_VERSION",
  );
  id(s.id);
  text(s.name, 80);
  invariant(
    s.currency === "CNY" && s.timeZone === "Asia/Shanghai",
    "此版本只支持人民币和上海账本时区",
  );
  invariant(
    Number.isSafeInteger(s.revision) && s.revision >= 0,
    "账本版本无效",
  );
  for (const list of [
    s.accounts,
    s.labels,
    s.entries,
    s.reconciliations,
    s.audit,
    s.receipts,
  ])
    invariant(
      Array.isArray(list) && list.length <= 100_000,
      "记录列表无效或过大",
    );
  const all = new Set<string>();
  for (const r of [
    ...s.accounts,
    ...s.labels,
    ...s.entries,
    ...s.reconciliations,
  ]) {
    invariant(r && typeof r === "object", "记录无效");
    id(r.id);
    version(r.version);
    invariant(!all.has(r.id), "存在重复记录 ID");
    all.add(r.id);
  }
  const accounts = new Map(s.accounts.map((a) => [a.id, a]));
  for (const a of s.accounts) {
    text(a.name, 40);
    invariant(
      ["cash", "investment", "credit"].includes(a.kind),
      "账户类型无效",
    );
    minor(a.openingMinor);
    validTime(a.openedAt);
  }
  for (const l of s.labels) {
    text(l.name, 20);
    invariant(
      l.icon === undefined || labelIconKeys.includes(l.icon),
      "标签图标无效",
    );
    invariant(
      ["income", "expense"].includes(l.direction) &&
        typeof l.hidden === "boolean",
      "标签格式无效",
    );
  }
  if (s.defaultAccountId !== undefined)
    invariant(accounts.has(s.defaultAccountId), "默认账户不存在");
  for (const e of s.entries) {
    invariant(
      ["expense", "income", "transfer", "refund"].includes(e.kind),
      "流水类型无效",
    );
    minor(e.amountMinor);
    invariant(e.amountMinor > 0, "金额应大于零");
    const a = accounts.get(e.accountId);
    invariant(a, "流水账户不存在");
    validTime(e.occurredAt);
    invariant(e.occurredAt >= a.openedAt, "流水时间不能早于账户的开始记账时间");
    text(e.note, 300, false);
    if (e.kind === "transfer") {
      const to = accounts.get(e.toAccountId ?? "");
      invariant(to && to.id !== a.id, "请选择不同的转入账户");
      invariant(
        e.occurredAt >= to.openedAt,
        "转账时间不能早于转入账户的开始记账时间",
      );
      invariant(!e.labelId && !e.originalId, "转账不使用标签或退款关联");
    } else {
      invariant(!e.toAccountId, "非转账不能指定转入账户");
    }
    if (e.kind === "refund") {
      const original = s.entries.find((x) => x.id === e.originalId);
      invariant(original?.kind === "expense", "退款应关联一笔支出");
      invariant(e.occurredAt >= original.occurredAt, "退款不能早于原支出");
      invariant(
        e.accountId === original.accountId && !e.labelId,
        "退款使用原支出账户及标签",
      );
    } else {
      invariant(!e.originalId, "只有退款可以关联原支出");
    }
    if (e.labelId)
      invariant(
        s.labels.some((l) => l.id === e.labelId && l.direction === e.kind),
        "标签类型与流水不匹配",
      );
  }
  for (const e of s.entries.filter((e) => e.kind === "expense"))
    invariant(
      s.entries
        .filter((r) => r.originalId === e.id)
        .reduce((n, r) => n + r.amountMinor, 0) <= e.amountMinor,
      "累计退款不能超过原支出",
    );
  const anchors = new Set<string>();
  for (const r of s.reconciliations) {
    const a = accounts.get(r.accountId);
    invariant(a, "盘点账户不存在");
    minor(r.actualMinor);
    validTime(r.occurredAt);
    text(r.note, 300, false);
    invariant(r.occurredAt >= a.openedAt, "盘点时间不能早于账户的开始记账时间");
    const key = r.accountId + r.occurredAt;
    invariant(!anchors.has(key), "同一账户同一秒只能盘点一次");
    anchors.add(key);
  }
  for (const a of s.audit) {
    invariant(
      Number.isSafeInteger(a.revision) &&
        a.revision >= 1 &&
        a.revision <= s.revision,
      "审计版本无效",
    );
    validTime(a.at);
    invariant(["ui", "cli"].includes(a.source), "审计来源无效");
    text(a.action, 80);
    if (a.recordId) id(a.recordId);
  }
  const operations = new Set<string>();
  for (const r of s.receipts) {
    id(r.operationId);
    text(r.fingerprint, 4000);
    invariant(
      Number.isSafeInteger(r.revision) &&
        r.revision >= 1 &&
        r.revision <= s.revision,
      "操作版本无效",
    );
    if (r.resultId) id(r.resultId);
    invariant(!operations.has(r.operationId), "操作 ID 重复");
    operations.add(r.operationId);
  }
  // A malformed backup must not introduce balances beyond exact integer arithmetic.
  for (const a of s.accounts) minor(balance(s, a.id, "2199-12-31T23:59:59"));
}
export function execute(
  state: Ledger,
  command: Command,
  ctx: Context,
): { state: Ledger; resultId?: string; replayed: boolean } {
  invariant(
    command && typeof command === "object" && typeof command.type === "string",
    "命令格式无效",
  );
  if (
    [
      "account.create",
      "account.rename",
      "label.create",
      "label.update",
    ].includes(command.type)
  )
    text(
      (command as { name: unknown }).name,
      command.type.startsWith("account") ? 40 : 20,
    );
  id(ctx.operationId);
  validTime(ctx.now);
  invariant(["ui", "cli"].includes(ctx.source), "来源无效");
  const fingerprint = canonical(command);
  const previous = state.receipts.find(
    (r) => r.operationId === ctx.operationId,
  );
  if (previous) {
    invariant(
      previous.fingerprint === fingerprint,
      "操作 ID 已用于其他请求",
      "IDEMPOTENCY_CONFLICT",
    );
    return { state, resultId: previous.resultId, replayed: true };
  }
  const s: Ledger = JSON.parse(JSON.stringify(state));
  let resultId: string | undefined;
  switch (command.type) {
    case "account.create": {
      const a = {
        id: ctx.newId(),
        version: 1,
        name: command.name.trim(),
        kind: command.kind,
        openingMinor: command.openingMinor,
        openedAt: command.openedAt,
      };
      s.accounts.push(a);
      s.defaultAccountId ??= a.id;
      resultId = a.id;
      break;
    }
    case "account.rename": {
      const a = checked(s.accounts, command.id, command.expectedVersion);
      a.name = command.name.trim();
      a.version++;
      resultId = a.id;
      break;
    }
    case "label.create": {
      const l: Label = {
        id: ctx.newId(),
        version: 1,
        name: command.name.trim(),
        direction: command.direction,
        hidden: false,
        icon: command.icon,
      };
      invariant(
        !s.labels.some((x) => x.direction === l.direction && x.name === l.name),
        "已有同名标签",
      );
      s.labels.push(l);
      resultId = l.id;
      break;
    }
    case "label.update": {
      const l = checked(s.labels, command.id, command.expectedVersion);
      invariant(
        !s.labels.some(
          (x) =>
            x.id !== l.id &&
            x.direction === l.direction &&
            x.name === command.name.trim(),
        ),
        "已有同名标签",
      );
      l.name = command.name.trim();
      l.hidden = command.hidden;
      if (command.icon !== undefined) l.icon = command.icon;
      l.version++;
      resultId = l.id;
      break;
    }
    case "label.delete": {
      checked(s.labels, command.id, command.expectedVersion);
      s.labels = s.labels.filter((l) => l.id !== command.id);
      for (const e of s.entries)
        if (e.labelId === command.id) {
          delete e.labelId;
          e.version++;
        }
      resultId = command.id;
      break;
    }
    case "entry.create": {
      const e = { ...command.entry, id: ctx.newId(), version: 1 };
      s.entries.push(e);
      s.defaultAccountId = e.accountId;
      resultId = e.id;
      break;
    }
    case "entry.update": {
      const e = checked(s.entries, command.id, command.expectedVersion);
      invariant(e.kind === command.entry.kind, "修改流水时不能更改交易类型");
      Object.assign(e, {
        ...command.entry,
        id: e.id,
        version: e.version + 1,
        toAccountId: command.entry.toAccountId,
        labelId: command.entry.labelId,
        originalId: command.entry.originalId,
      });
      s.defaultAccountId = e.accountId;
      resultId = e.id;
      break;
    }
    case "entry.delete": {
      checked(s.entries, command.id, command.expectedVersion);
      invariant(
        !s.entries.some((e) => e.originalId === command.id),
        "请先删除关联退款",
      );
      s.entries = s.entries.filter((e) => e.id !== command.id);
      resultId = command.id;
      break;
    }
    case "reconcile": {
      const r = {
        id: ctx.newId(),
        version: 1,
        accountId: command.accountId,
        actualMinor: command.actualMinor,
        occurredAt: command.occurredAt,
        note: command.note,
      };
      s.reconciliations.push(r);
      resultId = r.id;
      break;
    }
    case "reconciliation.delete":
      checked(s.reconciliations, command.id, command.expectedVersion);
      s.reconciliations = s.reconciliations.filter((r) => r.id !== command.id);
      resultId = command.id;
      break;
    default:
      throw new LedgerError("INVALID_COMMAND", "不支持的操作");
  }
  s.revision++;
  s.audit.push({
    revision: s.revision,
    source: ctx.source,
    at: ctx.now,
    action: command.type,
    recordId: resultId,
  });
  s.receipts.push({
    operationId: ctx.operationId,
    fingerprint,
    resultId,
    revision: s.revision,
  });
  validateLedger(s);
  return { state: s, resultId, replayed: false };
}
export function effect(e: Entry, accountId: string): number {
  if (e.kind === "transfer")
    return e.accountId === accountId
      ? -e.amountMinor
      : e.toAccountId === accountId
        ? e.amountMinor
        : 0;
  return e.accountId === accountId
    ? e.amountMinor * (e.kind === "expense" ? -1 : 1)
    : 0;
}
/** Reconciliation is the actual balance AFTER all entries at that wall-clock second. */
export function balance(
  s: Ledger,
  accountId: string,
  asOf = nowInLedger(),
  beforeAnchor?: string,
): number {
  const a = s.accounts.find((a) => a.id === accountId);
  invariant(a, "账户不存在", "NOT_FOUND");
  if (asOf < a.openedAt) return 0;
  const anchors = s.reconciliations
    .filter(
      (r) =>
        r.accountId === accountId &&
        r.occurredAt <= asOf &&
        (!beforeAnchor || r.occurredAt < beforeAnchor),
    )
    .sort((a, b) => b.occurredAt.localeCompare(a.occurredAt));
  const anchor = anchors[0];
  let value = anchor ? anchor.actualMinor : a.openingMinor;
  for (const e of s.entries)
    if (e.occurredAt <= asOf && (!anchor || e.occurredAt > anchor.occurredAt)) {
      value += effect(e, accountId);
      minor(value);
    }
  return value;
}
export function assets(s: Ledger, asOf = nowInLedger()) {
  const accounts = s.accounts.map((a) => ({
    ...a,
    balanceMinor: balance(s, a.id, asOf),
    lastReconciledAt: s.reconciliations
      .filter((r) => r.accountId === a.id && r.occurredAt <= asOf)
      .map((r) => r.occurredAt)
      .sort()
      .at(-1),
  }));
  const assetMinor = accounts.reduce(
    (n, a) => n + Math.max(0, a.balanceMinor),
    0,
  );
  const debtMinor = accounts.reduce(
    (n, a) => n + Math.max(0, -a.balanceMinor),
    0,
  );
  minor(assetMinor);
  minor(debtMinor);
  return {
    asOf,
    assetMinor,
    debtMinor,
    netMinor: assetMinor - debtMinor,
    accounts,
  };
}
export function report(s: Ledger, month: string) {
  invariant(/^\d{4}-(0[1-9]|1[0-2])$/.test(month), "月份格式应为 YYYY-MM");
  let incomeMinor = 0,
    expenseMinor = 0;
  const byLabel: Record<string, number> = {};
  for (const e of s.entries.filter((e) => e.occurredAt.startsWith(month))) {
    if (e.kind === "income") incomeMinor += e.amountMinor;
    if (e.kind === "expense" || e.kind === "refund") {
      const amount = e.kind === "refund" ? -e.amountMinor : e.amountMinor;
      const labelId =
        e.kind === "refund"
          ? s.entries.find((x) => x.id === e.originalId)?.labelId
          : e.labelId;
      expenseMinor += amount;
      const key = labelId || "unlabelled";
      byLabel[key] = (byLabel[key] || 0) + amount;
    }
  }
  minor(incomeMinor);
  minor(expenseMinor);
  return {
    month,
    timeZone: s.timeZone,
    incomeMinor,
    expenseMinor,
    surplusMinor: incomeMinor - expenseMinor,
    byLabel,
    refundPolicy: "refund-month" as const,
  };
}
export interface Backup {
  kind: "ledger-backup";
  formatVersion: 1;
  exportedAt: string;
  ledger: Ledger;
}
export function exportBackup(s: Ledger, at = nowInLedger()): string {
  validateLedger(s);
  return JSON.stringify(
    {
      kind: "ledger-backup",
      formatVersion: 1,
      exportedAt: at,
      ledger: s,
    } satisfies Backup,
    null,
    2,
  );
}
export function parseBackup(json: string): Backup {
  invariant(json.length <= 20_000_000, "备份超过 20 MB 限制");
  let b: Backup;
  try {
    b = JSON.parse(json);
  } catch {
    throw new LedgerError("INVALID_BACKUP", "备份不是有效的 JSON");
  }
  invariant(
    b && b.kind === "ledger-backup" && b.formatVersion === 1,
    "不支持此备份格式",
    "UNSUPPORTED_VERSION",
  );
  validTime(b.exportedAt);
  validateLedger(b.ledger);
  return b;
}
