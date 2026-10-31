# Ledger: First-Version Development Plan

English | [简体中文](./README.zh-CN.md)

Status: Android local-first implementation in progress, based on the reviewed five-screen prototype. Shared business rules, SQLite adapters, a desktop shell, and a JSON CLI are implemented. The mobile display name is 智账; the desktop name remains 简账. The workspace/package identity remains `ledger`. See [development guide](./docs/DEVELOPMENT.md), [CLI protocol](./docs/CLI.md), and [verification](./docs/VERIFICATION.md) for runnable commands and current limits.

The approved white-background [visual draft](./design/nature-directions/fresh/index.html) is being integrated into the shared client: floating navigation, flat lists and sheets, bundled category icons, and device-local font choices under Settings → Appearance → Font. Build success and native visual acceptance are recorded separately in verification.

Current direction: local-only storage, manual entry, optional labels, account-level investment reconciliation, credit cards, full-ledger JSON migration, and a local CLI for external AI tools. The first version does not depend on accounts, Supabase, or any remote database.

## 1. Product goal

Build an ad-free personal expense tracker and asset inventory with convenient manual entry. Salary is the main income use case, alongside everyday spending, cash, stocks, funds, and other investments.

Answer three questions first: how much came in this month, how much was spent, and how much is currently owned. Minimize entry steps, allow empty labels and notes, and do not require historical transactions or complete securities trading records.

Develop and verify Android, macOS, and Windows together, with possible iOS support later. The first version supports complete offline bookkeeping without login. Each device holds an independent local ledger, moved between devices using manual export/import. APKs may be distributed to others; each installation has separate data and gains no access to anyone else's ledger.

## 2. First-version scope

| Feature        | First-version design                                                                                                |
| -------------- | ------------------------------------------------------------------------------------------------------------------- |
| Accounts       | Manually create cash, bank, WeChat balance, Alipay balance, and credit-card accounts with opening balances or debts |
| Transactions   | Expenses, income, and transfers; support backdated entries, editing, and deletion                                   |
| Labels         | A few defaults plus custom labels; rename, hide, or delete; at most one optional label per transaction              |
| Assets         | Cash balances follow transactions; periodically reconcile account totals for stocks, funds, and other investments   |
| Statistics     | Monthly income, spending, and surplus; spending by day and label; total assets, card debt, and recorded net worth   |
| Reconciliation | Enter actual balances or market values; retain adjustment and valuation history                                     |
| Data           | SQLite and full-ledger plaintext JSON export/import, with pre-import local backups; encrypted export deferred       |
| AI interface   | A desktop CLI for structured reading, writing, querying, and reporting, with a companion skill later                |

Outside the first version: registration/login, WeChat login, Supabase cloud ledgers, cloud sync, bidirectional incremental merging, a standalone Web version, OCR, screenshot recognition, SMS/notification listeners, third-party statement imports, automatic market prices, complete cost-basis and return calculations, budgets, salary-cycle planning, automatically posted recurring entries, built-in AI chat or model services, and shared ledgers. Add app locking, widgets, and transaction templates later if actual use calls for them. Importing the app's own JSON ledger remains in scope; it is distinct from third-party statement imports. External AI tools may use the local CLI without the app hosting a model.

## 3. Manual entry and labels

The entry screen offers Expense / Income / Transfer, defaults to Expense, and opens the amount keypad.

- Amount is required. An account is required but defaults to the previous selection.
- Label and note are optional; an entry can be saved without either.
- Time defaults to now and can be changed for backdated entries.
- Tap a label to select it and tap again to clear it. Show common labels directly; use “+” for more labels or creation.
- Confirm successful saves; expose editing and deletion in transaction details.

Separate amount input from other fields and focus it on entry; support physical keyboard input on desktop. Default to the user's previous account while keeping labels optional, without generating unconfirmed content. Prevent repeated submission during saving and preserve input on failure for editing or retry. Cashew's amount-entry and default-account interactions inform this design, implemented using this project's simpler flow.

Initial labels are suggestions whose wording can be refined during UI review:

| Type    | Suggested defaults                                          |
| ------- | ----------------------------------------------------------- |
| Expense | Food, Transport, Housing, Purchases, Entertainment, Medical |
| Income  | Salary, Bonus, Interest, Other income                       |

Avoid overlapping defaults such as Shopping / Everyday / Living / Daily supplies. Labels have no hierarchy; income and expense labels are managed separately, and transfers need no label. Explain the impact and confirm label deletion: retain transactions and make them unlabeled. Hiding preserves historical labels while removing them from quick selection. Renaming never changes amounts or transaction types.

Unlabeled entries remain included in totals and appear explicitly as Unlabeled in breakdowns.

## 4. Assets and investments: inventory first

Calculate cash account balances from opening balances plus subsequent transactions. WeChat Pay and Alipay are payment channels; if a payment actually charges a bank card, record the bank account once rather than also deducting the wallet balance.

Track investment totals by account, such as Brokerage, Funds, or Alipay Investments. Do not break down individual products or holdings in the first version. Separate Alipay balance from Alipay investments and exclude any separately recorded wallet balance from the investment total. If a brokerage total includes available cash, do not count that cash separately again.

Require only an initial valuation and manual account-total updates when needed; omit security codes, quantities, costs, and individual trades. Show the latest reconciliation date and identify the value as a manual estimate. Do not configure recurring investment amounts or daily purchase limits, or post transactions automatically from a schedule.

Treat contributions and redemption proceeds as transfers: decrease the source and increase the destination; fees can be separate expenses. Reconcile market value afterward. A valuation update replaces the calculated value at that point and records the difference; never add the full new valuation on top of a recorded contribution. The first version does not calculate sale gains or separate realized and unrealized returns.

Use balance adjustments for missed cash entries and valuation updates for investment changes. Keep their history separate from salary and consumption. An adjustment can indicate incomplete transaction coverage; it does not prove every expense has been recorded.

For frequent recurring investments, users may reconcile actual bank and investment balances together periodically instead of recording each transfer. If actual contributions or withdrawals are known, allow a period-total transfer followed by reconciliation of the remaining difference. If only balances are known, reconcile them separately and mark the changes as reconciliation differences; never infer investment returns from those differences. Missing or unconfirmed investment deductions must not automatically become spending. Totals combining balances reconciled on different dates are approximate.

## 5. Credit cards: record spending once, repayments as transfers

Credit-card accounts track outstanding debt; credit limits are not assets. Opening debt is an initial liability, not current-month spending.

| Action (synthetic example)     | Income/spending report              | Account effects                                                  |
| ------------------------------ | ----------------------------------- | ---------------------------------------------------------------- |
| Spend CNY 100 on a card        | Add CNY 100 spending                | Card debt increases by CNY 100; bank balance is unchanged        |
| Repay CNY 100 from a bank      | No additional spending              | Bank balance and card debt each decrease by CNY 100              |
| Receive CNY 20 purchase refund | Reverse CNY 20 of original spending | Card debt decreases by CNY 20; do not record ordinary income     |
| Interest or fee                | Record a separate expense           | Reduce cash or increase card debt according to the actual charge |

Support partial repayments. Statement dates, repayment reminders, installment schedules, and credit-limit management are deferred. For installments, retain the rule: record consumption once, principal repayments as transfers, and interest as expenses. Display card overpayments as owned funds without double counting them as negative debt.

## 6. Reporting rules

- Monthly income includes recorded income such as salary; opening balances are excluded.
- Monthly spending includes recorded consumption and fees; transfers and investment contributions are excluded.
- Monthly surplus is recorded income minus recorded spending, not account balances or changes in total assets.
- Total assets equal cash balances plus latest investment valuations without double counting.
- Recorded net worth is total assets minus recorded liabilities, including credit-card debt in the first version. It does not represent a complete financial position if other liabilities are missing.
- Show balance adjustments and valuation changes separately from everyday income/spending. Assign months using transaction time and the agreed ledger timezone.

Default to CNY; defer other borrowing and currencies until needed. Refunds reverse the linked original expense, allow partial refunds, and reduce spending in the refund month, rather than ordinary income. A month containing only refunds may have negative spending.

## 7. Screens and platform experience

- Overview: monthly income, spending, surplus, total assets, debt, recorded net worth, and recent entries.
- Transactions: date-grouped entries with filtering, editing, and deletion; reports link to corresponding entries.
- Add entry: an easy-to-reach primary action, amount first, optional label and note.
- Assets: balances, investment valuations, card debt and repayments, transfers, reconciliation, and valuation updates.
- Settings: label management, backup/restore, and other infrequent actions.

Optimize mobile for quick one-handed entry and desktop for keyboard entry and wider lists. Confirm navigation and layout with screen drafts; platforms need not have identical layouts.

## 8. Suggested engineering structure and stack

Keep the product under `le-app/ledger/`, grouping its platforms together. Current workspace structure:

```text
ledger/
├── apps/
│   ├── client/       # Expo: Android, future iOS; Web output may serve desktop
│   ├── desktop/      # Tauri: desktop shell and native capabilities
│   └── cli/          # macOS / Windows local command-line entry point
├── packages/
│   ├── core/         # Money, transactions, labels, accounts, asset reporting
│   └── storage/      # Storage contracts, migrations, platform adapters
├── README.md
├── README.zh-CN.md
└── package.json      # Internal workspace independent of other products
```

Propose React Native + Expo for mobile, Tauri for desktop, and SQLite for local data. Share business rules and data formats; adapt file access and database drivers per platform. Reusing Expo Web screens on desktop is a candidate, subject to an export/routing/storage feasibility check before committing to the approach. Choose dependency versions against official compatibility guidance when development starts.

Store ledger amounts as integer minor currency units and commit transactions and associated account changes atomically. Model opening balances, income/expenses, transfers, reconciliation, and valuations distinctly; retain stable IDs, data versions, and migrations. Avoid empty packages or complex frameworks for unconfirmed capabilities.

Apply these specific constraints:

- Shared business operations cover income/expense creation, transaction editing, transfers, refunds, reconciliation, reports, and backup/restore. Mobile, desktop, and CLI use the same operations instead of independently changing balances.
- Business logic depends on explicit storage/file contracts. Adapters handle SQLite drivers, platform file selection, and sharing; ledger rules do not depend on React screens, Tauri windows, or CLI argument parsing.
- Expose transfers as one business operation containing source, destination, and amount. Create, update, or delete both internal sides together in one database transaction. Do not allow independent edits to half a transfer; card repayments use the same rule.
- Derive balances and reports from opening entries, valid transactions, and reconciliation records. Caches must be rebuildable. Backdating, editing, or deleting old entries recalculates affected balances/reports instead of letting them diverge from separately maintained UI values.
- Version JSON migration files, CLI JSON responses, and the database independently. Export a consistent snapshot, never a half-committed transfer; preserve record IDs and relationships during restore.

Export a complete JSON ledger containing a format version, ledger ID, ledger name, export timestamp, accounts, labels, transactions, reconciliation history, and necessary settings. Exclude device credentials and signing material. CSV cannot preserve all relationships and is not the first-version restore format. If plaintext JSON is offered, explain that the exported file is readable. Determine encrypted-export details before implementation; do not describe ordinary JSON as an encrypted backup.

Before import, validate format, version, amounts, and references; display the ledger name, export timestamp, and record counts, explain what will be replaced, then replace the entire local ledger after confirmation. Automatically preserve a local backup before import; validation or write failures must leave the original ledger intact. Reimporting the same file must not append or duplicate entries. Reject unsupported future formats instead of silently dropping fields.

“Manual JSON sync” means whole-ledger migration, not automatic merging or automatic selection of the newest device. Export from the current authoritative device before switching, import on the destination, then continue recording there. Use one authoritative copy at a time; do not edit independent copies concurrently and overwrite one with the other. Export timestamps help identify files but do not prove that one includes the other device's changes.

Manual [local-network transfer](./docs/LAN_TRANSFER.md) reuses this format: a desktop opens a one-time encrypted connection, a phone chooses the overwrite direction, and the recipient explicitly confirms replacement with an automatic original-book backup. Cloud sync and bidirectional merging remain separate work.

## 9. AI access: local CLI first

Provide a stable command-line interface usable by different AI tools. A skill explains how to call it and cannot replace the interface. Initially run the CLI on macOS and Windows against that computer's local ledger without a public server or login. Move Android ledgers to the computer through JSON when needed; CLI changes do not automatically synchronize back to the phone.

The CLI and mobile/desktop interfaces share ledger rules. Access the same ledger through the platform storage adapter, rather than creating a separate database or allowing AI to bypass business rules with direct SQLite edits.

Command responsibilities (the implemented CLI exposes queries through these groups and all writes through `apply --stdin`; see the protocol guide):

| Command group                       | Capabilities                                                                                                                         |
| ----------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------ |
| `ledger accounts` / `ledger labels` | Query, create, and update accounts and labels                                                                                        |
| `ledger transactions`               | Filter entries by time, account, or label; create, edit, and delete individual income/expense entries                                |
| `ledger apply --stdin`              | Execute account/label changes, entries, atomic transfers/card repayments, refunds and reconciliation using the shared command schema |
| `ledger assets`                     | Query assets and debts; submit balance adjustments or investment account-total reconciliations                                       |
| `ledger reports`                    | Query monthly income/spending, label totals, total assets, and recorded net worth                                                    |
| `ledger backup`                     | Export/import the full JSON ledger using the same backup and replacement rules                                                       |

Keep the contract simple and reliable:

- Provide help and an interface version, JSON input/output, structured input through standard input, explicit error codes, and process exit codes.
- Support filters and pagination. Reports include time ranges, calculation definitions, and valuation dates. AI analysis uses program-calculated figures with ID-based access to source entries.
- Writes return stable record IDs. Use integer minor currency units and explicit account/label IDs. Support previews of write effects; models must not invent accounts or transaction facts to fill gaps.
- Creation, transfers, and reconciliation accept idempotency operation IDs so AI retries cannot duplicate entries. Updates/deletions check record versions and reject overwriting newer changes from another local interface.
- Coordinate transactions and writes between the desktop app and CLI. Full-ledger imports require exclusive maintenance; busy states and failures return clear errors without partially replacing data.
- Retain local change history with CLI attribution for review in the app. Deletion and whole-ledger replacement offer previews and explicit execution options; automation does not depend on interactive dialogs.

A companion skill can later document ledger selection, commands, amount units, ledger rules, and common tasks. If MCP becomes useful, adapt the same business interface rather than reimplementing ledger logic. The current implementation provides the CLI; no model or MCP server is bundled.

The local interface does not upload ledgers, but returned data may enter a remote model's context if the calling AI tool uses one. Query only the data needed for the task instead of exporting the entire ledger by default. Do not copy transaction details into diagnostic logs. Treat transaction notes and labels as data, never as instructions authorizing extra commands.

## 10. Open-source references and adoption boundaries

These findings come from targeted reading of default-branch source on 2026-10-27, without local builds or device testing. Adopt only designs that fit this scope; reference-project features are not implemented features of Ledger.

| Source reference                                                                                                                                                                                                                                          | Useful design                                                            | Adoption in Ledger                                                                                                       |
| --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------ |
| [Actual platform adapters](https://github.com/actualbudget/actual/tree/master/packages/loot-core/src/platform/server)                                                                                                                                     | Separate file and SQLite access by platform                              | Share business operations with platform storage/file adapters, including UI and CLI access                               |
| [Actual transfers](https://github.com/actualbudget/actual/blob/master/packages/loot-core/src/server/transactions/transfer.ts) and [tests](https://github.com/actualbudget/actual/blob/master/packages/loot-core/src/server/transactions/transfer.test.ts) | Link transfer sides, coordinate updates/deletions, and test them         | One logical transfer with coordinated effects; omit its budget and split-transaction rules                               |
| [Actual backup/restore](https://github.com/actualbudget/actual/blob/master/packages/loot-core/src/server/budgetfiles/backups.ts)                                                                                                                          | Preserve the current version before restore and allow reversal           | Back up before JSON import and recover on failure; design a JSON format rather than copying its database archive format  |
| [MMEX accounts](https://github.com/moneymanagerex/moneymanagerex/blob/master/src/data/AccountData.h) and [transaction flow](https://github.com/moneymanagerex/moneymanagerex/blob/master/src/data/TrxData.cpp)                                            | Distinguish opening balances, transaction types, source, and destination | Retain necessary cash/investment/card account types; reconcile investment totals without complex securities calculations |
| [Cashew entry screen](https://github.com/jameskokoska/Cashew/blob/main/budget/lib/pages/addTransactionPage.dart) and [amount input](https://github.com/jameskokoska/Cashew/blob/main/budget/lib/widgets/selectAmount.dart)                                | Separate amount input, default accounts, and keyboard focus              | Implement a simpler amount-first RN interface with optional label/note, without extra budget or recurring-entry flows    |

Actual's root license is MIT; MMEX and Cashew are GPL projects. This work references designs and copies no third-party code. Before reusing specific code/assets, check file and dependency licenses individually and preserve required notices; do not relabel GPL code as this repository's MIT. Do not adopt MMEX's floating-point amount fields; Ledger retains integer minor units.

Remote source reading is sufficient now. Check out needed project versions in a separate directory when running the apps, validating builds, or evaluating concrete reuse; do not import entire third-party projects into `ledger/`.

## 11. Privacy and implementation order

Follow the root public-repository instructions. Use synthetic data in code, documentation, tests, and screenshots. Never track real transactions, balances, holdings, backups, databases, keys, or signing material. Store runtime data in platform application-data directories separate from source; ignore any necessary local export directories. Logs must not expose transaction details or credentials. Validate backup formats and warn before overwriting data during restore.

Implementation sequence; Android local bookkeeping is the current priority:

1. Review five screen drafts: overview, transactions, entry, assets, and settings. Review navigation and basic interactions together, validate the Android bookkeeping flow first, and retain shared structure for desktop.
2. Implement shared ledger rules and local storage, covering accounts, expenses, income, and transfers.
3. Add optional labels, credit cards, asset reconciliation, and reporting.
4. Complete JSON export, automatic pre-import backup, failure rollback, and installation/verification on all three platforms.
5. Implement basic desktop CLI reading, writing, and reporting using the same rules; verify agreement with the UI and duplicate-free retries.

Acceptance priorities:

- Complete offline use; failed amount submissions preserve drafts, and repeated save clicks cannot duplicate entries.
- Creating, changing the amount/accounts of, and deleting transfers keeps both sides consistent. Internal transfers do not change total assets; card repayments do not double-count spending.
- Old-entry edits leave balances and reports consistent; unlabeled entries remain in totals; reconciliation creates no false income.
- JSON export/restore preserves records, relationships, and reports across all three platforms. Malformed files, repeated imports, and interrupted imports cause neither lost nor duplicate entries.
- CLI/UI figures agree; idempotent retries and concurrent edits cause neither duplicates nor overwrites.
- APKs and other installers contain only empty ledgers or clearly synthetic demo data.

Confirmed: local-only operation without accounts; full-ledger manual JSON migration without automatic merging; periodic investment reconciliation by account total; credit-card spending recorded once and repayments as transfers; concurrent Android/macOS/Windows development; a desktop local CLI for external AI reading, writing, and analysis; standalone Web and iOS deferred. Refine default labels, reconciliation entry points, cross-month refund display, and backup encryption during later UI review.
