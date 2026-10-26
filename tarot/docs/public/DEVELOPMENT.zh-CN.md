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
5. **必须执行的安全边界：**[Tarot 私有表权限](../../supabase/migrations/202610260001_private_tarot_tables.sql)。

这些文件提供表结构，不包含账号、占卜记录或对话导出。已有数据库应核对已应用的迁移，再执行后续文件。

应用通过服务端管理客户端操作数据库，用户和访客的访问边界由服务端接口检查。新增 API 时需要保留记录归属校验，不能将管理客户端交给浏览器。仅靠接口归属检查，无法保护经 Supabase Data API 暴露的数据库表。

5 张 `tarot_*` 表仅供服务端访问：启用 RLS、不提供客户端策略，撤销 `PUBLIC`、`anon`、`authenticated` 的表级和独立列级权限，保留 `service_role` 的增删改查。其他应用的 Supabase 登录身份并不是 Tarot 应用会话。公开分享由服务端按不透明令牌解析，不需要数据库匿名读取权限。

安全迁移使用事务，可以重复执行，不改动用户记录，也不改动其他应用的表、策略、schema 授权或默认权限。即使前 4 个迁移已安装，已有数据库也必须执行这一安全迁移。审阅后通过 SQL Editor 或已认证的管理连接仅执行该文件，不要在共享项目上批量推送无关的待执行迁移。权限修改立即在数据库生效，重新部署前端不能代替修复。

[private-tables.sql](../../supabase/checks/private-tables.sql) 提供纯元数据检查：应有 5 张表启用 RLS，无客户端策略，`anon` / `authenticated` 无表级和列级权限，服务端仍有增删改查权限。迁移前后对比其他应用权限指纹，应保持一致。检查不查询用户记录。

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
npm run test:quota
npm run test:privacy
npm run test:database
npm run lint
npm run build
```

草稿测试使用模拟 localStorage，历史测试使用模拟请求，不要求连接真实云项目。配置测试覆盖默认及自定义模型目标，并拒绝携带凭据的地址。

`test:database` 在内存 PostgreSQL 中用虚构数据执行实际迁移，检查匿名及普通登录角色拒绝访问、列级授权、RLS 纵深防护、服务端登录 / 会话 / 历史 / 分享 / 额度访问、重复执行和其他表不受影响。它不会连接云数据库。

需要显式授权的云端只读检查时，加载本机服务端配置并明确指定预期项目。可选用共享数据库的另一应用的公开配置验证：

```sh
node --env-file=.env.local scripts/check-database-security.mjs \
  --run-live --expected-project-ref YOUR_PROJECT_REF \
  --public-env-file ../glucose-mobile/.env.local
```

不传 `--public-env-file` 时使用本应用本机公开 Key 配置。脚本只发送 HEAD 请求，要求公开访问被拒绝、服务端访问成功，不输出密钥、记录内容或记录计数。不要用管理 Key 替代公开 Key，让匿名测试虚假通过。

如果受限环境不允许 Turbopack 绑定内部工作端口，可使用 `npm run build -- --webpack`。原有全量 lint 问题见[验证记录](../../../docs/VALIDATION.zh-CN.md)。

项目内的 `scripts/smoke-deepseek.mts` 是额外的真实模型检查，普通测试不会执行。运行 `npm run test:ai:live` 显式开启：命令会加载 `.env.local`，使用锁定版本的 TypeScript 运行器。它会发送合成问题并产生模型调用费用，输出仅包含分块数和字符数。

## 部署

在 Vercel 创建自己的应用，Root Directory 选择 `tarot`，使用 Next.js 构建设置。配置服务端环境变量；启用 OAuth 时再登记正式站回调。

发布前在自己的测试环境检查：注册与退出、访客抽牌、解读失败重试、历史分页、分享开启和撤回。只有用户主动开启分享时才应提供分享链接。

## Vercel 环境变量

1. 打开该应用对应的 Vercel 项目，进入 **Settings → Environment Variables**，逐项添加变量名和值。Root Directory 使用 `tarot`；测试账号和占卜之前，先按上文初始化数据库。
2. 数据库与账号功能需要 `SUPABASE_URL`、`SUPABASE_SERVICE_ROLE_KEY` 和单独生成的随机 `SESSION_SECRET`，均使用自己后端的配置。
3. 使用真实模型时，配置以下变量。替换 key 和模型名占位值；如果使用其他服务商，地址改为服务商提供的 HTTPS chat-completions 接口：

```dotenv
AI_PROVIDER=deepseek
DEEPSEEK_API_KEY=replace-with-your-model-key
DEEPSEEK_API_URL=https://api.deepseek.com/chat/completions
DEEPSEEK_MODEL=your-supported-model
```

4. 按用途选择 **Production**（正式站）、**Preview**（预览部署）和 **Development**（Vercel 本地开发）。Preview 和 Development 优先使用独立测试数据库与模型 key；只勾选 Production 的变量不会出现在 Preview。
5. 保存后创建新部署或重新部署。变量修改不会更新已经构建的部署。启用 OAuth 时，再配置上文列出的可选变量与回调地址。

普通 Next.js 本地开发在首次配置时复制 `.env.example` 为 `.env.local`，填写相同变量名；修改后重启 `npm run dev`。已有本地文件应保留，不用模板覆盖。本地文件由 Git 忽略；Vercel 的变量单独管理，复制仓库不会把变量自动带到新建的 Vercel 项目。

`DEEPSEEK_API_KEY`、`SUPABASE_SERVICE_ROLE_KEY`、`SESSION_SECRET` 和 OAuth client secret 只放服务端，不添加 `NEXT_PUBLIC_` 前缀。Vercel 的值输入框只填值，不填整行 `NAME=value`。本文和环境模板只有占位值。

`AI_PROVIDER=mock` 不调用付费模型，但账号和占卜存储仍需 Supabase。公开源码不提供维护者的模型 key，每个部署自行配置；如果公开站配置了真实 key，访客模型调用会消耗该 key 的额度。

Vercel 参考：[环境变量文档](https://vercel.com/docs/environment-variables)。

## 贡献约定

- 纯逻辑变更优先增加对应草稿、历史或领域规则测试。
- 数据库变更新增迁移文件，并描述对已有数据的影响。
- 问题复现与截图使用合成内容，不提交真实问题、对话、会话或环境配置。
- Next.js 相关实现以当前依赖对应的仓库内文档为准。

## CSS 原生依赖缺失

如果启动时报 Lightning CSS 或 Tailwind 原生模块缺失，可能是可选包下载失败，即使 npm 已返回成功。重新安装可选依赖，并在重启服务前确认模块可以加载：

```sh
npm install --include=optional
node -e "require('lightningcss'); require('@tailwindcss/oxide')"
```

锁文件已包含支持的平台包，不要为所有开发者强制添加某个平台专用的必需依赖。
