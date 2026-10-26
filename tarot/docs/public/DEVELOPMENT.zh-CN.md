# 烛火塔罗开发说明

[English](./DEVELOPMENT.md) | 简体中文

本文中的命令除特别说明外，均在 `tarot/` 执行。

## 环境与账号

依赖使用 `package-lock.json` 固定，通过 `npm ci` 安装。应用采用自定义 `tarot_users` 和 `tarot_sessions`，用户名密码登录不使用 Supabase Auth 的用户表。可选 OAuth 最终也接入本应用会话。

本地配置写入被 Git 忽略的 `.env.local`；部署时在服务端环境设置相同变量。

| 变量 | 用途 |
| --- | --- |
| `SUPABASE_URL` | 自己的 Supabase 项目 URL |
| `SUPABASE_SERVICE_ROLE_KEY` | 仅供服务端访问数据库的管理密钥 |
| `SESSION_SECRET` | OAuth 状态签名等会话相关用途，使用独立随机值 |
| `AI_PROVIDER` | 默认 `mock`，真实模型使用 `deepseek` |
| `DEEPSEEK_API_KEY` | 真实模型服务的服务端密钥 |
| `DEEPSEEK_API_URL` | HTTPS OpenAI 兼容的完整 chat-completions 地址 |
| `DEEPSEEK_MODEL` | 服务商支持的模型名 |

可以使用 `openssl rand -hex 32` 在本机生成随机值。管理密钥、模型密钥和会话密钥不加 `NEXT_PUBLIC_` 前缀。

## 初始化数据库

在自己的空 Supabase 项目中审阅并按文件名顺序执行以下迁移：

1. [基础表](../../supabase/migrations/20260910100000_candle_taro_init.sql)。
2. [OAuth 用户支持](../../supabase/migrations/20260911170000_oauth_users.sql)。
3. [静默揭晓](../../supabase/migrations/20260914090000_silent_reveal.sql)。
4. [公开分享令牌](../../supabase/migrations/20260915100000_public_share_token.sql)。

这些文件提供表结构，不包含账号、占卜记录或对话导出。已有数据库应核对已应用的迁移，再执行后续文件。

应用通过服务端管理客户端操作数据库，用户和访客的访问边界由服务端接口检查。新增 API 时需要保留记录归属校验，不能将管理客户端交给浏览器。

## 模型与 OAuth

先使用 `AI_PROVIDER=mock` 验证完整流程。启用真实模型时显式配置 `DEEPSEEK_API_URL` 和 `DEEPSEEK_MODEL`，并确认请求目标；默认地址为公开的 DeepSeek chat-completions 接口，使用其他兼容服务时可自行覆盖。模型请求失败时，应用会回退到 mock 内容。

OAuth 是可选项。按启用的登录方式设置：

- `GITHUB_OAUTH_CLIENT_ID`、`GITHUB_OAUTH_CLIENT_SECRET`。
- `GOOGLE_OAUTH_CLIENT_ID`、`GOOGLE_OAUTH_CLIENT_SECRET`。
- `OAUTH_BASE_URL`：自己的应用 origin，例如 `https://your-app.example`。

在对应 OAuth 应用登记回调 `{OAUTH_BASE_URL}/api/auth/oauth/callback`。本地使用 `http://localhost:3000/api/auth/oauth/callback`。未配置相应 OAuth 凭据时，页面隐藏该登录入口。

## 测试和调试

```sh
npm run test:draft
npm run test:history
npm run test:config
npm run lint
npm run build
```

草稿测试使用模拟 localStorage，历史测试使用模拟请求，不要求连接真实云项目。配置测试覆盖默认及自定义模型目标，并拒绝携带凭据的地址。

如果受限环境不允许 Turbopack 绑定内部工作端口，可使用 `npm run build -- --webpack`。原有全量 lint 问题见[验证记录](../../../docs/VALIDATION.zh-CN.md)。

项目内的 `scripts/smoke-deepseek.mts` 是额外的真实模型检查，普通测试不会执行。运行 `npm run test:ai:live` 显式开启：命令会加载 `.env.local`，使用锁定版本的 TypeScript 运行器。它会发送合成问题并产生模型调用费用，输出仅包含分块数和字符数。

## 部署

在 Vercel 创建自己的应用，Root Directory 选择 `tarot`，使用 Next.js 构建设置。配置服务端环境变量；启用 OAuth 时再登记正式站回调。

发布前在自己的测试环境检查：注册与退出、访客抽牌、解读失败重试、历史分页、分享开启和撤回。只有用户主动开启分享时才应提供分享链接。

## 贡献约定

- 纯逻辑变更优先增加对应草稿、历史或领域规则测试。
- 数据库变更新增迁移文件，并描述对已有数据的影响。
- 问题复现与截图使用合成内容，不提交真实问题、对话、会话或环境配置。
- Next.js 相关实现以当前依赖对应的仓库内文档为准。
