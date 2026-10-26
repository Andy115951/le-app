# Nasdaq 市场看板开发说明

[English](./DEVELOPMENT.md) | 简体中文

本文中的命令除特别说明外，均在 `stock-dashboard/` 执行。工程不是 npm workspace；根目录依赖用于 Vercel CLI，项目使用自己的测试和维护命令。

## 环境与运行

使用 Node.js 22。在仓库根目录执行 `npm ci` 安装 Vercel CLI，再进入本项目运行：

```sh
node ../node_modules/vercel/dist/index.js dev
```

Node.js 测试和大多数维护脚本不依赖前端构建。修改静态模块时，同时检查 PWA 壳缓存是否覆盖新增的本地模块。

## 数据与配置

个人自选、偏好和日志默认保存在浏览器。云同步的 Supabase URL 与公开 key 由页面配置，登录会话也在浏览器保存。服务端密钥只用于 API 和维护任务。

复制 `.env.example` 为 `.env.local`，按需要填写：

| 变量 | 用途 |
| --- | --- |
| `SUPABASE_URL` | 服务端连接的 Supabase URL |
| `SUPABASE_SECRET_KEY` | 仅供服务端的数据库 Secret Key |
| `CRON_SECRET` | 定时采集及受控维护接口的鉴权值 |
| `SEC_USER_AGENT` | 可选 SEC 采集标识，使用自己的应用名和联系邮箱 |
| `FRED_API_KEY` | 可选宏观数据采集密钥 |
| `DEEPSEEK_API_KEY`、`DEEPSEEK_API_URL`、`DEEPSEEK_MODEL` | 可选模型服务配置 |

`CRON_SECRET` 使用独立随机值。通过本机环境或 Vercel Development 环境提供变量，不在终端输出、截图或代码中保存真实值。

### 可选模型功能

`.env.example` 中各开关控制不同能力，不能用其中一个代替其他开关：

- `DEEPSEEK_RESEARCH_ENABLED` 与 `DEEPSEEK_RESEARCH_DATA_APPROVED`：研究叙事调用及研究包出站许可。
- `DEEPSEEK_MAX_DAILY_REQUESTS`：研究叙事的每日请求上限。
- `DEEPSEEK_GATEWAY_COMPATIBILITY_ENABLED`：固定探针的网关兼容性检查。
- `DEEPSEEK_BEGINNER_READING_ENABLED`：页面手动触发的说明文字生成；不使用上述研究叙事每日额度。

独立部署时显式确认模型 URL、模型名和启用范围。默认保持这些开关关闭，基础行情页面与模型服务分开验证。

## 数据库初始化

完整结构在 [supabase/migrations/](../../supabase/migrations/) 中，包含个人状态、公共行情、采集记录、事件与研究归档。

新安装使用自己的空 Supabase 项目，按文件名时间顺序审阅并执行迁移。已有数据库核对迁移记录后仅应用缺少的文件。不要将某个运行环境的表数据、账号或采集日志当作初始化 seed。

- 个人状态表按 `auth.uid()` 隔离。
- 服务端行情、采集和研究表按迁移中的授权访问。
- 页面云同步使用 Supabase Auth 邮件登录，需要在自己的 Auth 配置中允许应用回跳地址。

初始迁移之后还有观察记录、决策日志等增量字段；仅创建初始状态表不足以覆盖全部功能。

## 测试与维护命令

```sh
npm test
```

以下命令属于可选维护流程，执行前确认目标环境和输入范围：

| 命令 | 用途 |
| --- | --- |
| `npm run backfill:qqq`、`npm run backfill:ndx` | 获取并回填历史价格 |
| `npm run fred:macro`、`npm run sec:filings` | 宏观数据与公开文件采集 |
| `npm run research:rebuild-derived` | 预览派生数据重建，实际写入需显式参数 |
| `npm run ndx:discover`、`npm run ndx:source-check` | 成分候选发现与来源检查 |
| `npm run ndx:review` | 检查成分变动 |
| `npm run ndx:import`、`npm run earnings:import` | 经过审核后的资料导入 |

这些命令不属于启动应用的必需步骤。回填、采集和导入可能访问外部数据源或写数据库；先查看对应 `scripts/` 实现与参数，不批量执行所有 npm scripts。

成分和财报候选需保留原始来源和审核状态；缺失值保持缺失，未经确认的事项不能当作已经发生的事实。

## 部署

在自己的 Vercel 项目中把 Root Directory 设为 `stock-dashboard`，保留项目内 `vercel.json` 的函数及 Cron 配置。

当前 Cron 表达式为 `0 22 * * 1-5`，按 UTC 调度。若调整为本地市场收盘逻辑，需同时考虑交易日与夏令时。项目中有只读覆盖状态和采集运行查询，可用于检查任务结果。

部署前先运行本地测试，再分别验证公共行情、个人云同步和受控采集接口。部署代码本身不等于历史已经回填或候选已经导入。

## Vercel 环境变量

1. 打开该应用对应的 Vercel 项目，Root Directory 使用 `stock-dashboard`，进入 **Settings → Environment Variables**。只添加实际启用功能所需的变量。
2. 基础公开行情、缺失行情回退和公开新闻不需要个人 API key。浏览器云同步在页面填写自己的 Supabase URL 与公开 anon key，不要在该表单填数据库管理密钥。
3. 数据库历史、日历和研究功能先按上文初始化表结构，再在服务端设置 `SUPABASE_URL` 和 `SUPABASE_SECRET_KEY`。定时采集与受控维护接口另配独立随机 `CRON_SECRET`；`FRED_API_KEY` 和 `SEC_USER_AGENT` 只在使用对应可选采集器时配置。
4. 启用页面的可选模型解读时，配置以下变量。替换 key 和模型名占位值；如果使用其他服务商，改为其 HTTPS chat-completions 接口。该功能还需要已配置的数据库来保存审计记录：

```dotenv
DEEPSEEK_API_KEY=replace-with-your-model-key
DEEPSEEK_API_URL=https://api.deepseek.com/chat/completions
DEEPSEEK_MODEL=your-supported-model
DEEPSEEK_BEGINNER_READING_ENABLED=true
```

5. 研究叙事和网关检查有独立开关，无意启用时继续关闭，页面解读开关不会自动启用它们。研究请求上限及数据出站开关见上文的功能开关说明。
6. 按用途选择 **Production**、**Preview** 和 **Development**，尽量使用独立测试资源；只勾选 Production 的变量不会出现在 Preview。保存后部署或重新部署，使新值生效。

本地配置放在被 Git 忽略的 `.env.local`，或通过 shell / Vercel Development 环境提供。模板列出所需变量名，已有本地文件应保留，不要直接覆盖。复制仓库不会把 Vercel 项目变量及绑定自动带到新部署项目。

模型 key、`SUPABASE_SECRET_KEY` 和 `CRON_SECRET` 只能放服务端，不添加 `NEXT_PUBLIC_`、`EXPO_PUBLIC_` 或 `VITE_` 前缀。控制台分别填写变量名和值，不要把整行 `NAME=value` 粘到值输入框。公开站配置了你的模型 key 后，用户请求已开启的解读功能会消耗你的模型额度。

Vercel 参考：[环境变量文档](https://vercel.com/docs/environment-variables)。

## 贡献约定

- 为规则变化增加能区分新旧行为的测试，注明市场日期与时区。
- 保留新闻、财报和成分信息的来源，避免用采集时间冒充发布时间。
- 不在测试、截图或导出里使用真实持仓、邮箱、个人日志或密钥。
- 新增客户端模块时更新相关 PWA 壳缓存与测试。

## 行情可用性

浏览器直接请求公开 Eastmoney 行情和趋势，不需要个人 key。缺失美股行情会回退到 `/api/global-stock/quote`，由只读服务端处理器请求公开 Yahoo 图表数据。两条链路都设置超时，回退处理器会校验代码并仅返回行情字段。在 Vercel 部署静态页面时需保留该处理器，纯静态预览不能执行回退接口。

仍缺失的标的会标注为部分结果，不用零价格替代。PWA 发布修改客户端模块时，需要同时更新缓存清单和版本。
