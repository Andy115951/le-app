# 烛火塔罗 · Candle Taro

[English](./README.md) | 简体中文

以烛光、牌阵与对话为主题的塔罗 Web 应用。支持仪式抽牌、流式解读、追问和历史回看，使用 Next.js、React、TypeScript 与 Supabase。

## 功能

- 78 张牌面与牌义图鉴，多种牌阵和情境入口。
- 可调整揭晓速度、解读详略和静默模式。
- 流式解读、追问、象征牌与同题回看。
- 问题草稿恢复，历史分页、搜索、同题分组和本机收藏。
- 用户名密码登录，可选 GitHub / Google OAuth。
- 可关闭的公开分享链接、分享图、烛火信物和 PWA。

## 本地启动

使用 Node.js 22，在仓库根目录执行：

```sh
cd tarot
npm ci
cp .env.example .env.local
```

按[开发说明](./docs/public/DEVELOPMENT.zh-CN.md)初始化自己的 Supabase 数据库，并填写 `.env.local`。最小配置为：

```dotenv
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_ROLE_KEY=your-server-only-service-role-key
SESSION_SECRET=replace-with-a-random-secret
AI_PROVIDER=mock
```

```sh
npm run dev
```

打开 [http://localhost:3000](http://localhost:3000)。`mock` 不调用模型服务，但抽牌记录和账号仍依赖数据库。

## 验证

在 `tarot/` 执行：

```sh
npm run test:draft
npm run test:history
npm run test:config
npm run lint
npm run build
```

现有自动化测试覆盖草稿恢复与历史查询等规则；账号、模型流式响应和分享流程仍需在自己的测试环境联调。

## 项目结构

| 路径 | 内容 |
| --- | --- |
| `src/app/` | 页面与服务端 API |
| `src/components/` | 首页、牌阵、解读、历史与设置组件 |
| `src/lib/` | 账号、存储、模型调用和领域规则 |
| `src/data/` | 牌库、场景与牌面索引 |
| `public/cards/` | 随应用分发的牌面图片 |
| `supabase/migrations/` | 数据库结构迁移 |
| `test/` | 本地自动化测试 |

模型配置、OAuth、迁移顺序与部署方式见[开发说明](./docs/public/DEVELOPMENT.zh-CN.md)。

## 使用边界

解读用于娱乐与自我反思。问题、对话和账号信息属于用户数据，复现问题时使用合成内容。启用真实模型后，相关问题和上下文会发送到配置的模型服务。
