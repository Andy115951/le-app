# Timing Lite developer guide

English | [简体中文](./DEVELOPMENT.zh-CN.md)

Run commands from `timing-lite-tauri/`.

## Project structure

| Path | Contents |
| --- | --- |
| `src/App.tsx` | UI, data queries, and interactions |
| `src/statistics.ts` | Statistics buckets and range rules |
| `src/Icon.tsx`, `src/styles.css` | Icons and styling |
| `src-tauri/src/main.rs` | Activity capture, context parsing, and Tauri commands |
| `src-tauri/src/storage.rs` | Migrations, retention, and storage cleanup |
| `src-tauri/src/tests.rs` | Rust and SQLite regression tests |
| `scripts/test-statistics.mjs` | Frontend statistics tests |

## Development environment

Use Node.js 22 and the Rust toolchain. macOS needs working Xcode Command Line Tools. Frontend dependencies are pinned in `package-lock.json`; `src-tauri/Cargo.toml` defines the desktop build.

```sh
npm ci
npm run tauri dev
```

Development and production builds share a single-instance port. Quit the installed app from its menu-bar entry before starting the development build. Development uses a separate database and does not automatically copy production history.

## Development data

Start with an empty development database. To test the empty state or recheck migrations:

```sh
npm run dev:seed:fresh
```

This deletes the development database and its WAL/SHM files, leaving the production database intact.

`npm run dev:seed` copies the local production database to the development database for investigating your own data. It is not synthetic seed data: the copy still contains real activity and must not be committed, packaged, or attached to issues.

## Storage policies

- Completed activity details are retained for 30 days, then aggregated into daily archives.
- Daily archives are retained for 365 days.
- The main database has a 50 MiB soft budget. Cleanup removes the oldest archives first, then the oldest completed details, aiming for roughly 45 MiB.
- Rules and the running activity are preserved. Storage pressure can shorten normal retention periods.
- WAL files and compaction can temporarily require extra space, so the budget is not a hard limit for the entire directory.

Validate rollback, repeated startup, and the running segment when changing storage behavior. Migrations and cleanup policies take effect when the application opens the corresponding database.

## Validation

```sh
npm test
npm run build
cargo test --manifest-path src-tauri/Cargo.toml
```

Frontend tests cover range clipping, midnight boundaries, and daylight-saving transitions. Rust tests cover pause behavior, migrations, statistics, and storage cleanup. Tests use in-memory and temporary databases, not personal activity databases.

## Packaging

```sh
npm run tauri:build:app
npm run build:dmg:silent
```

The second command also builds the app; you do not need to run both to obtain a DMG. Outputs are placed in:

- `.app`: `src-tauri/target/release/bundle/macos/`.
- `.dmg`: `src-tauri/target/release/bundle/dmg/`.

The DMG script depends on macOS tools. Configure your own application identifier, signing, and notarization before distribution. Keep signing keys and materials out of the source repository.

## Contributing

Include a reproducible timeline and tests when changing capture, pause, or statistics rules. Use fictional app names, window titles, and file paths. Exclude activity exports, databases, and build outputs from commits.
