# 糖记 · Web

[English](./README.md) | 简体中文

手机优先的血糖与饮食记录网页，使用 Next.js、React、TypeScript 和 Supabase。支持食物查询、家人成员档案、餐饮记录和同餐回看。

## 功能

- 食物 GI 查询、来源说明，以及按数据完整性展示的 GL。
- 血糖记录，支持 `mmol/L`、`mg/dL` 与 `HI` / `LO`。
- 饮食新增、补记、修改、删除及明确的餐后测量关联。
- 同餐回看、常吃组合保存与再次带入。
- 按过敏、忌口、偏好和做饭时间筛选的餐饮搭配。
- 成员切换、时区、历史趋势、CSV 导出与未保存提醒。
- 邮箱密码登录、家庭开通码与账号数据隔离。

## 本地体验

使用 Node.js 22，在仓库根目录执行：

```sh
cd glucose-app
npm ci
npm run dev
```

打开 [http://localhost:3100](http://localhost:3100)。不配置云服务也可以查询食物，并从「我的」进入演示模式。

演示资料为合成数据，修改只保存在页面内存中，刷新或退出后清空，不会自动转成真实记录。

## 启用自己的云端记录

先在自己的 Supabase 项目应用迁移，再复制 `.env.example` 为 `.env.local`，填写：

| 变量 | 用途 |
| --- | --- |
| `SUPABASE_URL` | 自己的 Supabase URL |
| `SUPABASE_ANON_KEY` | 可公开的 anon / publishable key |
| `SUPABASE_SERVICE_ROLE_KEY` | 仅供服务端账号开通的管理密钥 |
| `FAMILY_ACCESS_CODE` | 自己生成并私下分发的开通码 |

通过「我的 → 开通账号」注册。已有同一 Supabase 项目的账号可先登录，再输入开通码。每个账号管理自己的成员与记录。

初始化顺序、权限说明和部署方式见[开发说明](./docs/public/DEVELOPMENT.zh-CN.md)。

## 验证

在 `glucose-app/` 执行：

```sh
npm run typecheck
npm test
npm run test:db
npm run build
```

`test:db` 使用临时 PGlite 数据库，不连接真实云项目。

## 资料与数据

食物与餐饮模板随源码维护，数值来源见 [src/data/SOURCES.md](./src/data/SOURCES.md)。缺少可靠数据的项目明确留空，应用不生成默认医疗目标，也不预测个人血糖。

健康记录使用登录账号保存在自行配置的云数据库中；浏览器持久保存认证会话，记录和未保存输入保留在当前页面内存。应用用于信息查询与记录。

## 与手机端的关系

[糖记手机端](../glucose-mobile/README.zh-CN.md)使用 Expo，同时支持 Android 与 Web。两端可连接同一个自行部署的 Supabase 项目，复用账号和表结构；当前仍是两个独立工程，功能范围不完全相同。
