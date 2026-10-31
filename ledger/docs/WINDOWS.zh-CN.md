# Windows 测试构建

[English](./WINDOWS.md) | 简体中文

目标：Intel／AMD x64 的 Windows 10/11。桌面端显示名称仍为“简账”，移动端为“智账”。Windows 共用客户端和账务规则，包含月份／年份选择、自然光金库与记住资产数字眼睛选择。

构建状态（2026-10-31）：已生成安装包，校验值、PE 格式和依赖检查通过。尚未在原生 Windows 主机验证安装及交互。

## 安装与数据

运行 `ledger-0.1.0-windows-x64-setup.exe`。中英文 NSIS 安装向导面向当前 Windows 用户安装；缺少 Microsoft Edge WebView2 时下载其安装引导程序，记账本身为本地离线操作。当前为未签名的内部测试包，不是已签名的正式发行版。

首次运行使用独立本机账本。记录保存在当前 Windows 用户的应用数据目录下 `app.local.ledger` 中；安装包不包含财务记录、导出的账本或账户配置。若要从 Android 迁移数据，明确导出应用的 JSON 备份后在 Windows 导入。导入需要确认，替换目标账本前会创建本机自动备份，不合并或同步设备数据。

## 重新构建

从 `ledger/` 运行：

```sh
npm ci
npm run windows:build
```

Windows 本机需要安装 Tauri 前置工具（Rust MSVC 目标和 Visual Studio C++ 构建工具）；脚本指定 `x86_64-pc-windows-msvc` 并打包 NSIS。macOS／Linux 使用 `cargo-xwin`、Windows Rust 目标、LLVM／LLD 与 NSIS。环境步骤参照 [Tauri 的 Windows 安装包指南](https://v2.tauri.app/distribute/windows-installer/)和 [cargo-xwin 前置说明](https://github.com/rust-cross/cargo-xwin)。

可重复构建脚本将安装包及其 SHA-256 文件放到已忽略的 `artifacts/windows/`，交叉编译 SDK／缓存放在已忽略的 `artifacts/toolchains/`，Rust 产物放在已忽略的 `src-tauri/target/`。可执行文件采用 Tauri 的 Windows 运行库链接策略，并重映射包含用户信息的 Rust 源码路径。SDK／缓存、本机账本及签名材料均不应加入版本控制。

## Windows 验收

交叉构建成功不等于 Windows 运行验收。请使用隔离的合成账本验证安装／启动、字体与布局、月份选择、收支／转账、账户余额、金库绘制、眼睛偏好、重启保留及 JSON 迁移。完成原生 Windows 验收后再考虑正式发行。
