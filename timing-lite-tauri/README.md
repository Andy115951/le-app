# Timing Lite

English | [简体中文](./README.zh-CN.md)

A local time tracker built with Tauri, React, and Rust. Activity capture currently targets macOS, recording the frontmost app and window context and organizing it by project and tag.

## Features

- Background activity capture with pause, resume, and manual capture.
- A menu-bar entry point and single-instance operation; recording continues after the window closes.
- Rule-based classification and activity views by app, project, and tag.
- 6-hour, 24-hour, and 7-day statistics, plus activity search and pagination.
- Chinese and English UI, light and dark themes, and local display preferences.
- Local SQLite storage, with separate development and production databases.
- Automatic archiving, retention policies, and database space management.

## Run locally

Install Node.js 22, the Rust toolchain, and macOS build tools. From the repository root:

```sh
cd timing-lite-tauri
npm ci
npm run tauri dev
```

On first capture, you may need to grant Accessibility access to your terminal or the app in macOS System Settings → Privacy & Security. Running only `npm run dev` starts the web frontend; window capture requires the Tauri host.

## Data and privacy

Activity history stays on your machine and requires no cloud account:

| Build | Database |
| --- | --- |
| Development | `~/.timing-lite-dev/timing-lite.db` |
| Production | `~/.timing-lite/timing-lite.db` |

Window titles and activity details may contain personal filenames or page titles. Use synthetic examples in issue reports. Database files and screenshots of real activity are excluded from source distribution.

## Validation and builds

```sh
npm test
npm run build
cargo test --manifest-path src-tauri/Cargo.toml
npm run tauri:build:app
```

The app bundle is written to `src-tauri/target/release/bundle/macos/`. See the [developer guide](./docs/public/DEVELOPMENT.md) for DMG packaging, development database operations, and current limitations.

## Current limitations

The activity list displays the latest 1,000 detail records; search and pagination operate on those records. Statistics process all data within the selected range. Retention is subject to archiving policies and storage budgets.

Windows and Linux activity capture are not currently supported by this implementation. Build outputs are not guaranteed to be signed or notarized for macOS distribution.
