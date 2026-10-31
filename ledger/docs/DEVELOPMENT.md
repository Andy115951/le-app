# Development

English | [简体中文](./DEVELOPMENT.zh-CN.md)

Run commands from `ledger/`. Requirements: Node 22.13+, npm, Android SDK and JDK 21 for Android; Rust and the platform's Tauri build prerequisites for desktop. This is a nested npm workspace; other repository apps are unchanged.

```sh
npm ci
npm test
npm run typecheck
npm run start
npm run android
```

`npm run android:build` generates an arm64 test APK at `artifacts/ledger-0.1.0-test.apk`. The bundle works without Metro or a network. Set `LEDGER_ANDROID_ARCHS` for other architectures. Native projects are generated and ignored. The generated development signing key is for internal testing; configure private release signing before public distribution. Use `adb -d install -r artifacts/ledger-0.1.0-test.apk` to target a physical device, excluding emulators. Do not clear an existing user's app data to test a new build.

`npm run android:build:qa` builds `artifacts/ledger-0.1.0-qa.apk` as **智账 QA / `app.local.ledger.qa`**. It installs alongside the regular app with a separate Android database/cache sandbox. Use only generated synthetic fixtures there for destructive restore and sharing tests. Never export/import a user's regular ledger merely to obtain a test fixture. Switching between QA and regular packages requires prebuild; the build script rejects `--skip-prebuild` when the generated application ID does not match the requested package.

```sh
npm run desktop
npm run build -w @ledger/desktop
npm run build:qa -w @ledger/desktop -- --bundles app
npm run windows:build
npm run check -w @ledger/desktop
npm run cli -- help
```

Windows x64 NSIS packaging and data migration instructions are in [Windows test build](./WINDOWS.md). Native Windows builds use the MSVC toolchain; macOS/Linux cross-builds use `cargo-xwin`, LLVM/LLD and NSIS. Installers and checksums are copied into ignored `artifacts/windows/`.

Desktop renders the same RN Web UI inside Tauri, with a Rust SQLite connection. `export:web` creates desktop assets; opening those assets in an ordinary browser intentionally does not create a separate ledger. Android uses Expo SQLite. Node CLI and Tauri use the same `ledger.sqlite` in the OS application-data directory under `app.local.ledger` (macOS Application Support, Windows Roaming AppData, Linux XDG data). Android is a separate device-local database; migrate through JSON or manual local-network transfer. CLI supports `--db` for a synthetic test database outside the repository. A custom `--db` does not redirect the desktop app.

The desktop QA overlay creates **简账 QA / `app.local.ledger.uiqa`**, with a separate app-data directory and an initially unfocused window (`focus:false`). The `--bundles app` example targets macOS. Builds, type checks, CLI/repository tests and ADB run without activating a Mac window. On macOS, launching a QA bundle with `open -g -n` requests background app activation as well. Native desktop clicks and keyboard shortcuts still require foreground interaction; defer them while the user is working. Do not repeatedly reactivate QA after the user switches away. Before Android input or screenshots, verify that the QA package is foreground and stop if it is not; never collect another app's screen as test evidence.

## Shared boundaries

- `packages/core`: platform-independent commands, validation, exact integer money, balances, reports, versioned backups.
- `packages/storage`: SQLite schema v1, typed JSON record rows and optimistic concurrency. Expo / Node / Tauri drivers use the same repository. Each mutation takes a write lock, reads a consistent snapshot, checks versions, validates, then commits record differences atomically.
- `apps/client`: five RN screens, native file picker/share, import preview and UI confirmations.
- `apps/desktop`: local Tauri shell and SQLite/file-dialog bridge; no remote content.
- `apps/cli`: versioned JSON input/output, minimum queries, explicit `--commit`, and stable errors.

Account names are user data, not translated interface strings. In Assets, click an account name / Rename to edit it or choose a common Chinese name. The shared `account.rename` command preserves the account ID, opening value, balances and all transaction links; there is no automatic replacement of English account names.

Account creation labels the opening timestamp as “开始记账时间” (start tracking time) and the opening value as the balance, valuation or debt at that time. It defaults to the start of today; earlier entries require an earlier start time and the corresponding balance. These existing amounts are not new income or spending. This wording does not change `openedAt`, `openingMinor`, calculations or stored records.

The five screens share a warm near-white background, white operation sheets and floating navigation, dark text and restrained green accents. Overview uses a two-column layout on wider windows. Android's entry form includes a decimal keypad; notes still use the system keyboard, which hides the bottom navigation while open. Account, label and time choices open bottom sheets on narrow screens and centered dialogs on wider windows. Financial commands and existing storage remain shared with the CLI.

Settings starts with five compact entries: labels, appearance, backup/migration, local history, and about. Controls and record lists render only after opening the corresponding subpage. Automatic backups are nested inside backup/migration and load on request. Font selection is under Appearance → Font, with sans, mixed and book choices; book is the default. Header back controls and Android hardware Back return one settings level; selecting the Settings tab opens its home list. Backup disclosure and replacement confirmation remain at the relevant actions.

Font files are bundled for offline use, with source/license information under `apps/client/assets/fonts/`. The readability pass uses real weight-600 serif outlines, medium-weight system body text, 13-point secondary text and 12-point navigation labels. Primary/secondary text on the main background measure approximately 13.7:1 / 6.1:1 contrast; text colors also exceed 4.5:1 on the white, soft and selected surfaces. Saved font choices are preserved. Heading and amount text can use the bundled serif fonts; body text retains the system font and uncommon characters can fall back to platform fonts. Preferences use a separate Expo SQLite key/value store on Android and localStorage in the desktop webview. A font change does not mutate financial records, advance the ledger revision, or enter JSON backups. Font-load failure falls back to system fonts. About includes the bundled license texts.

Labels support an optional built-in SVG `icon` identifier. Missing icons are inferred for display without rewriting old records. UI edits save the selected icon; older CLI updates that omit it preserve the existing choice. JSON format v1 and SQLite schema v1 remain compatible; label icon metadata travels with backups. See [CLI](./CLI.md) for accepted identifiers.

No stored balance cache is authoritative. Balances derive from openings, entries and reconciliation anchors. A reconciliation is the actual value **after every entry at that same second**. Earlier backdated entries still change reports but do not rewrite a later observed balance. Delete the reconciliation to return to purely calculated balances. Credit card balances are negative debt; positive balances are overpayment. Opening debt and repayments do not count as expenses. Refunds use the original account and label, reduce spending in the refund month, and cannot exceed the linked purchase. Delete refunds before deleting the purchase. Every wall-clock timestamp uses `Asia/Shanghai`, independently of device timezone.

Each successful command records an operation receipt and source (`ui` / `cli`). Retry the same operation ID with identical input to get the original result. Writes require the snapshot token; changes/imports invalidate old tokens. Updates/deletes also check record versions. Reads refresh when the app regains focus; another process's write is rejected on stale submission. No background polling is required. Failed writes preserve the current draft.

Import validates the full backup before writing, previews counts, checks the original token again, stores the pre-import ledger in SQLite, and replaces the current book in one transaction. Saved pre-import backups can be previewed/restored in settings or exported by CLI. Reimporting replaces instead of appending. Backup files include local operation/audit history, but not earlier automatic backups. Exports are **plaintext**; app storage is not application-level encrypted. Android OS cloud backup is disabled. No database/export/real logs belong in Git.

The optional natural-light little vault is under Settings → Appearance, on by default when unset; an explicit saved off choice is preserved. It renders from computed net assets with bundled offline PNGs and React Native SVG. Its separate local key/value preference never enters ledger JSON. The vault has a separate eye and session visibility from numeric amounts. Its concealed output is a fixed closed cabinet with no tier or inventory; vault contents reset on leaving Assets or backgrounding, while numeric visibility follows its saved local preference. See [vault design](./VAULT_DESIGN.md) for denominations, thresholds and native acceptance limits.

Overview and Details share a quick month picker in the header. Tap the date to open a twelve-month grid, tap the year to choose from paginated twelve-year groups, or return directly to the current Shanghai ledger month. Selection applies immediately; closing without selection changes no period. Narrow screens use a bottom sheet and wide screens a dialog. This is transient view state, not a financial write or saved preference. Month/year navigation is bounded by the supported 1900–2199 recording dates.

## Verification and limits

Asset amounts are concealed until a local choice is saved. The eye remembers the chosen visible/hidden state across navigation and restarts using a separate device-local key/value preference; no amounts are stored and the preference never enters ledger data or JSON backups. Hold the net-assets area for 250 ms to peek; release/cancel hides a temporary peek without changing that preference. Leaving Assets cancels only a peek. Backgrounding or desktop blur temporarily conceals values; returning restores the saved choice. Net worth on Overview remains concealed outside Assets. Income/spending amounts remain unchanged. Preference-load failure starts hidden; save failure keeps the current session choice and reports that it could not be saved.

Net assets, assets, liabilities, account balances, account-sheet balances, reconciliation values/differences and reconciliation notes share this display state. Hidden values are replaced with a fixed four-dot string rather than blurred or opacity-hidden text, including their accessibility labels. Reconciliation inputs appear only after explicitly pinning display; hiding removes the inputs while retaining their unsaved component draft. This is a display control, not database or backup encryption.

`npm run ui:qa:build` and `npm run ui:qa` provide a background-friendly, read-only synthetic preview of the production UI for narrow desktop-browser checks. See [UI QA](../apps/ui-qa/README.md) for scope. This is a component/view test environment, not a native Tauri/SQLite integration test or Android acceptance substitute.

Desktop style bootstrap: `apps/client/public/index.html` must contain the empty `react-native-stylesheet` element before the application script runs. Tauri adds a response-specific CSP nonce to existing style elements, and RN Web reuses that authorized sheet. Without it, a newly created nonce-less style element is blocked in the release app. Desktop fonts load from bundled asset URLs through the browser FontFace API, avoiding the Expo stylesheet/FontFaceObserver path that timed out in the release WKWebView. Android retains Expo Font loading. Keep CSP enabled. After desktop builds, inspect actual screenshots of text, navigation and dialogs; accessibility text and successful database interaction alone do not validate rendering.

`npm test` exercises transfer edits/deletes, credit repayments/overpayments, refunds, reconciliation/backdating, invalid backups, idempotency, two SQLite clients, restart persistence, injected restore failure, and CLI subprocess behavior. Fixtures are entirely synthetic. Run `typecheck`, Android export, and desktop Web export after relevant changes. Native verification should cover account creation, income/expense, transfer, edit/delete, asset reconciliation, restart, and JSON export/import with synthetic data.

First implementation limits: SQLite rows contain typed JSON rather than normalized financial tables; each operation loads and validates the whole ledger. This is intended for small personal books, not large imports or multiuser service workloads. Storage migration uses `PRAGMA user_version`; unknown future versions are refused. No automatic merge, encryption at rest, login, cloud, automatic investment prices, or securities positions. Windows/iOS require their own native acceptance pass. Desktop packaging and Android interaction checks are distinct from core tests.

Dependency audit currently reports a Zod advisory through the Expo development CLI's Zod 3 dependency. Application code does not import Zod; forcing Zod 4 would violate the upstream major-version contract. Keep the Expo toolchain local and reassess when upstream ships a compatible fix; do not apply `npm audit fix --force` to downgrade the whole SDK.

Local-network transfer is under Settings → Backup and migration, with a desktop one-time encrypted host and phone-selected overwrite direction. It reuses the existing atomic restore with full validation, token checks and pre-restore backup. See [Local-network transfer](./LAN_TRANSFER.md) for lifecycle, protocol and isolated test commands.
