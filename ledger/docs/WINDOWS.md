# Windows test build

English | [简体中文](./WINDOWS.zh-CN.md)

Target: Windows 10/11 on Intel/AMD x64. The desktop display name remains 简账; mobile displays 智账. Windows uses the same client and business rules, including the month/year picker, natural-light vault and remembered numeric asset-eye choice.

Build status (2026-10-31): installer produced and checksum/PE/dependency inspection passed. Installation and interaction on a native Windows host have not yet been verified.

## Installation and data

Run `ledger-0.1.0-windows-x64-setup.exe`. The Chinese/English NSIS installer installs for the current Windows user. If Microsoft Edge WebView2 is missing, setup downloads its bootstrapper; bookkeeping itself is local and works offline. This is an unsigned internal test build, not a signed public release.

The app starts with an independent local ledger. Records remain in the Windows user's application-data directory under `app.local.ledger`; the installer contains no financial records, exported ledgers or account configuration. To move data from Android, explicitly export the app's JSON backup and import it on Windows. Import replaces the destination ledger after confirmation and creates a local pre-import backup; it does not merge or sync devices.

## Rebuild

From `ledger/`:

```sh
npm ci
npm run windows:build
```

On Windows, install the Tauri prerequisites (Rust MSVC target and Visual Studio C++ build tools). The script targets `x86_64-pc-windows-msvc` and packages NSIS. On macOS/Linux it uses `cargo-xwin` with the Windows Rust target, LLVM/LLD and NSIS. Follow [Tauri's Windows installer guide](https://v2.tauri.app/distribute/windows-installer/) and [cargo-xwin prerequisites](https://github.com/rust-cross/cargo-xwin).

The repeatable script places the installer and its SHA-256 file in ignored `artifacts/windows/`. Cross-compilation SDK/cache files stay in ignored `artifacts/toolchains/`; Rust output stays in ignored `src-tauri/target/`. The executable uses Tauri's Windows runtime linkage policy and remaps user-specific Rust source paths. Never add these SDK/cache directories, a local ledger or signing material to source control.

## Windows acceptance

A successful cross-build is not a Windows runtime test. On an isolated synthetic ledger, verify installation/launch, fonts and layout, month selection, income/expense/transfer, account balances, vault rendering, saved eye preferences, restart persistence and JSON migration. Native Windows acceptance is required before treating the build as a release.
