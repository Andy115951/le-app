# 糖记 Mobile 开发说明

[English](./DEVELOPMENT.md) | 简体中文

本文中的命令除特别说明外，均在 `glucose-mobile/` 执行。

## 环境与结构

使用 Node.js 22、`package-lock.json` 对应依赖和 `app.json` 定义的 Expo 配置。本机 Android 构建脚本以 Java 21 和 Android SDK 36 为开发基线。

| 路径 | 内容 |
| --- | --- |
| `src/app/` | Expo Router 页面 |
| `src/components/` | 原生组件、图表、表单与确认交互 |
| `src/state/` | 登录、成员、记录与准入状态 |
| `src/core/` | 领域规则、云端映射与纯逻辑测试 |
| `src/data/` | 食物、模板、来源和合成数据 |
| `src/platform/` | 云客户端、会话存储与平台适配 |
| `assets/` | 图标与随包食物图片 |
| `scripts/` | 配置、预览和构建工具 |

`.native.ts(x)` 与 `.web.tsx` 用于平台差异，业务规则放入 `src/core/`，避免分别维护两套业务页面。新增原生依赖使用 `npx expo install`，并核对当前 Expo 版本对应的接口。

## 连接自己的后端

演示模式不要求云配置。真实账号与数据需要先部署糖记 Web 的数据库和账号开通接口。

配置自己的部署目标：

| 变量 | 用途 |
| --- | --- |
| `EXPO_PUBLIC_SUPABASE_URL` | 自己的 Supabase 服务 origin |
| `EXPO_PUBLIC_SUPABASE_ANON_KEY` | 公开 anon 或 publishable key |
| `EXPO_PUBLIC_WEB_ORIGIN` | 可选的注册和开通网页 |

`src/core/cloud-config.ts` 校验地址和公开 key 类型。远程服务要求 HTTPS，仅本机回环开发允许 HTTP。未配置网页入口时隐藏注册和网站链接。

可以手动填写公开值，也可以显式从自己的网页读取：

```sh
npm run configure -- --web-origin https://your-web.example --supabase-url https://your-project.supabase.co
```

脚本要求同时提供来源和预期数据库 origin，拒绝重定向及目标不一致，只将公开客户端值写入 `.env.local`。也可在进程环境提供 `EXPO_PUBLIC_WEB_ORIGIN` 和 `GLUCOSE_EXPECTED_SUPABASE_URL` 替代命令行参数，不会自动选择连接目标。

公开客户端配置写入本机 `.env.local`：

```dotenv
EXPO_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
EXPO_PUBLIC_SUPABASE_ANON_KEY=your-public-anon-or-publishable-key
EXPO_PUBLIC_WEB_ORIGIN=https://your-web.example
```

`EXPO_PUBLIC_` 会进入客户端产物，只能存放可公开值。管理密钥、家庭码、会话签名口令和签名文件不放在手机端。账号注册与开通由网页端服务处理，日常数据请求使用登录用户 JWT。

## 开发与预览

```sh
npm ci
npm start
```

也可以按平台运行 `npm run web` 或 `npm run android`。当前依赖包含原生模块，原生联调使用自己的开发构建。

Web 静态预览：

```sh
npm run export:web
npm run preview:web
```

输出位于 `dist/`，默认预览地址为 [http://localhost:8089](http://localhost:8089)，窄屏预览入口为 [http://localhost:8089/_preview](http://localhost:8089/_preview)。修改页面后重新导出。

预览入口由本机工具提供，不包含在应用路由中。部署 Web SPA 时需要把页面路径回退到 `index.html`。

## 验证

```sh
npm test
npm run typecheck
npm run lint
npm run export:web
```

自动化测试覆盖单位、时区、餐食关联、组合、替换、推荐、会话分片、私密 key 拒绝和目标校验等规则。真机仍需分别验证登录重启、退出清理、软键盘、系统返回、日期控件与弱网保存重试。

## Android 构建

本机设置可用的 Java 与 Android SDK 环境后执行：

```sh
npm run android:build
```

脚本使用 Expo 生成 `android/`，再构建 arm64 release 测试包，并在 `artifacts/` 写入 APK 与 SHA-256。原生目录和产物被 Git 忽略。

只有原生目录已存在，且 `app.json`、插件及原生依赖未变化时，才使用 `npm run android:build -- --skip-prebuild` 恢复增量构建。

当前脚本产出使用生成的测试签名。正式分发前单独配置持久签名、包标识和版本升级流程；签名文件不提交到仓库。`android/` 和 `ios/` 由 Expo 生成，配置变更优先写入 `app.json` 或 config plugin。

## 贡献约定

- 核心规则修改优先在 `src/core/` 补充测试，并核对网页端兼容范围。
- 敏感输入不落入日志和截图，会话存储变更验证失败回滚与退出清理。
- 复现与云端联调使用合成账号，不提交真实健康记录。
- 改变数据结构时通过网页端维护数据库迁移，并说明两端版本兼容性。
