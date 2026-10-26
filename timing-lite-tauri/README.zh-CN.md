# Timing Lite

[English](./README.md) | 简体中文

基于 Tauri、React 和 Rust 的本地时间追踪应用。当前活动采集实现面向 macOS，记录前台应用与窗口上下文，并按项目和标签归类。

## 功能

- 后台采集活动，支持暂停、恢复和手动采集。
- 菜单栏入口、单实例运行，关闭窗口后继续后台记录。
- 规则分类，按应用、项目和标签查看活动。
- 6 小时、24 小时和 7 天统计，以及活动搜索与分页。
- 中英文、明暗主题和本地显示偏好。
- SQLite 本地存储，开发数据与正式数据分离。
- 自动归档、保留期限和数据库空间整理。

## 本地启动

准备 Node.js 22、Rust 工具链与 macOS 编译工具，然后在仓库根目录执行：

```sh
cd timing-lite-tauri
npm ci
npm run tauri dev
```

首次采集可能需要在 macOS「系统设置 → 隐私与安全性 → 辅助功能」为终端或应用授权。仅运行 `npm run dev` 会启动网页前端，完整的窗口采集需要 Tauri 宿主。

## 数据与隐私

活动历史保存在本机，不需要云账号：

| 构建 | 数据库 |
| --- | --- |
| 开发版 | `~/.timing-lite-dev/timing-lite.db` |
| 正式版 | `~/.timing-lite/timing-lite.db` |

窗口标题和活动详情可能包含文件名、网页标题等个人内容。提交问题时使用合成示例；数据库文件和真实活动截图不随源码分发。

## 验证与构建

```sh
npm test
npm run build
cargo test --manifest-path src-tauri/Cargo.toml
npm run tauri:build:app
```

应用产物位于 `src-tauri/target/release/bundle/macos/`。DMG 打包、开发数据库操作和当前功能限制见[开发说明](./docs/public/DEVELOPMENT.zh-CN.md)。

## 当前限制

活动列表展示最近 1,000 条明细，搜索和分页作用于这些明细；统计查询会处理所选范围内的完整数据。历史保留受归档策略和空间预算影响。

当前源码不代表 Windows 或 Linux 活动采集已适配，也不代表发布产物已经完成 macOS 签名和公证。
