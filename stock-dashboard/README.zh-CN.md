# Nasdaq 市场看板

[English](./README.md) | 简体中文

围绕 Nasdaq-100、核心科技股、行情历史和公开新闻的市场信息看板。前端使用原生 JavaScript、HTML 与 CSS；可选 Supabase 云同步和 Vercel 服务端采集。

## 功能

- 独立于个人自选的核心市场雷达、行情与新闻聚合。
- NDX / QQQ 日线、交易日历、财报和成分变化查看。
- 公开证据链接、历史事件、特征与相似交易日研究。
- 自选、分组、持仓上下文、目标价和回撤规则。
- 个人观察与决策日志，以及可选账号云同步。
- PWA、本地持久化和可选的模型文字解读。

看板用于组织公开信息和记录个人决定，不自动下单。新闻线索、历史相似度和模型解读不能证明价格变化的因果关系。

## 本地启动

完整联调使用仓库根目录提供的 Vercel CLI。使用 Node.js 22，在仓库根目录执行：

```sh
npm ci
cd stock-dashboard
node ../node_modules/vercel/dist/index.js dev
```

首次使用按 CLI 提示关联自己的 Vercel 项目，以终端输出地址为准。自选和基础浏览器状态可以保存在本机；公共归档、研究接口和定时采集需要额外配置服务端与数据库。

如果只检查静态布局，可在 `stock-dashboard/` 执行 `python3 -m http.server 8080`，打开 [http://localhost:8080](http://localhost:8080)。静态服务器不执行 `api/`，不能替代完整行情接口联调。

## 配置方式

- 仅本地使用：无需个人云账号；行情请求仍需要可用网络及相应服务端接口。
- 个人云同步：在页面填写自己的 Supabase URL 与公开 anon key，使用邮件登录。
- 公共历史和采集：在服务端配置自己的数据库管理密钥与 Cron 密钥。
- 模型解读：按需开启，默认不发送研究包到模型服务。

详细步骤和变量用途见[开发说明](./docs/public/DEVELOPMENT.zh-CN.md)。

## 验证

在 `stock-dashboard/` 执行：

```sh
npm test
```

测试使用 Node.js 内置测试运行器。实际行情源、云数据库、定时任务和浏览器交互需分别联调。

## 项目结构

| 路径 | 内容 |
| --- | --- |
| `app.js`、`index.html`、`styles.css` | 页面与交互 |
| `quotes.js`、`chart.js`、`storage.js`、`cloud.js` | 行情、图表、本地状态与云同步 |
| `api/` | 行情、研究、日历与定时任务接口 |
| `lib/` | 采集、证据、研究与校验规则 |
| `scripts/` | 导入、回填、评估及维护命令 |
| `supabase/migrations/` | 数据库结构及权限迁移 |
| `data/` | 带来源的市场资料、候选与评估文件 |
| `test/` | 自动化测试 |

个人持仓、决策日志和云端导出不随源码分发。反馈问题时使用虚构账户和数值。
