# Timing Lite 开发说明

[English](./DEVELOPMENT.md) | 简体中文

本文中的命令均在 `timing-lite-tauri/` 执行。

## 工程结构

| 路径 | 内容 |
| --- | --- |
| `src/App.tsx` | 界面、数据查询和交互 |
| `src/statistics.ts` | 统计分桶与范围规则 |
| `src/Icon.tsx`、`src/styles.css` | 图标和样式 |
| `src-tauri/src/main.rs` | 活动采集、上下文解析与 Tauri 命令 |
| `src-tauri/src/storage.rs` | 数据迁移、保留和空间整理 |
| `src-tauri/src/tests.rs` | Rust 与 SQLite 回归测试 |
| `scripts/test-statistics.mjs` | 前端统计规则测试 |

## 开发环境

使用 Node.js 22 和 Rust 工具链。macOS 需要可用的 Xcode Command Line Tools。`package-lock.json` 固定前端依赖，桌面构建由 `src-tauri/Cargo.toml` 定义。

```sh
npm ci
npm run tauri dev
```

开发版和正式版共用单实例端口，启动开发版前先从菜单栏退出正在运行的正式版。开发构建使用独立数据库，不会自动复制正式历史。

## 开发数据

默认使用空开发库。需要测试空状态或重新验证迁移时：

```sh
npm run dev:seed:fresh
```

此命令会删除开发数据库及其 WAL/SHM 文件，不删除正式数据库。

`npm run dev:seed` 会把本机正式数据库复制为开发库，供维护者排查自己的数据问题。它不是合成 seed；复制后的开发库仍含真实活动信息，不能提交、打包或作为 Issue 附件。

## 存储策略

- 已结束的活动明细保留 30 天，随后聚合到日归档。
- 日归档保留 365 天。
- 主数据库采用 50 MiB 软预算，超额时优先删除最早的归档，再删除最早的已结束明细，目标约为 45 MiB。
- 规则与正在记录的活动保留；空间压力可能缩短通常的历史保留期。
- WAL 和压缩过程可能临时占用额外空间，因此预算不是整个目录的硬上限。

涉及存储变更时，应验证事务回滚、重复启动和正在记录的片段。应用启动后才会对对应数据库应用迁移与整理策略。

## 验证

```sh
npm test
npm run build
cargo test --manifest-path src-tauri/Cargo.toml
```

前端测试覆盖时间范围裁剪、跨日和夏令时；Rust 测试覆盖暂停、迁移、统计与存储整理。测试使用内存库和临时库，不读取个人活动数据库。

## 打包

```sh
npm run tauri:build:app
npm run build:dmg:silent
```

第二个命令也会先构建应用，无需为了 DMG 连续执行两次。输出目录分别为：

- `.app`：`src-tauri/target/release/bundle/macos/`。
- `.dmg`：`src-tauri/target/release/bundle/dmg/`。

DMG 脚本依赖 macOS 工具。正式分发时单独配置自己的应用标识、签名与公证；密钥和签名材料不进入源码仓库。

## 贡献约定

采集、暂停或统计规则变更应附带可复现的时间线与测试。示例应用名、窗口标题和文件路径使用虚构内容。提交前清除活动导出、数据库和构建产物。
