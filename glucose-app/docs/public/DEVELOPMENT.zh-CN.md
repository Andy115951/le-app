# 糖记 Web 开发说明

[English](./DEVELOPMENT.md) | 简体中文

本文中的命令除特别说明外，均在 `glucose-app/` 执行。

## 工程结构

| 路径 | 内容 |
| --- | --- |
| `src/app/` | 页面、布局和账号相关服务端接口 |
| `src/components/` | 状态管理、记录表单和页面组件 |
| `src/lib/` | 领域规则、数据映射和自动化测试 |
| `src/data/` | 食物、搭配、来源与合成演示数据 |
| `public/images/foods/` | 随应用分发的食物图片 |
| `assets/food-images/` | 图片生成说明与元数据 |
| `supabase/migrations/` | 数据库结构与权限迁移 |
| `scripts/` | 本地数据库验证、配置与部署工具 |

## 环境与运行

使用 Node.js 22，通过 `npm ci` 安装依赖。

```sh
npm run dev
```

开发和生产服务均使用 3100 端口。生产版本先 `npm run build`，再 `npm start`。

未配置 Supabase 时保留食物查询与内存演示；真实账号与记录需要云配置。

## 数据库初始化

在自己的空 Supabase 项目中按顺序审阅并执行：

1. [初始迁移](../../supabase/migrations/202610190001_glucose_initial.sql)。
2. [常吃组合迁移](../../supabase/migrations/202610200001_glucose_meal_presets.sql)。

初始迁移创建准入、成员、餐饮、测量和收藏表；第二份新增常吃组合。表名统一使用 `glucose_` 前缀，公共食物资料仍由源码维护。

也可以执行 `node scripts/cloud-setup.mjs --sql` 打印初始 SQL。`--apply` 需要本机 `psql` 与环境变量 `GLUCOSE_DATABASE_URL`，且只处理初始迁移；执行后仍需单独应用常吃组合迁移。初始迁移不是可反复重放的初始化命令。

应用沿用 Supabase Auth，另用 `glucose_accounts` 管理准入。常规读写使用用户 JWT，RLS 与复合外键共同检查账号、成员和餐食归属。

| 表 | 用途 |
| --- | --- |
| `glucose_accounts` | 账号准入和停用状态 |
| `glucose_profiles` | 成员、时区、单位与饮食偏好 |
| `glucose_meals` | 用餐时间、食物与份量快照 |
| `glucose_readings` | 原始读数、单位、场景与餐食关联 |
| `glucose_favorites` | 成员收藏 |
| `glucose_meal_presets` | 可复用的常吃组合 |

## 环境变量与开通

按 `.env.example` 在 `.env.local` 填入自己的配置。`SUPABASE_ANON_KEY` 必须是公开客户端 key；管理密钥和家庭码只保存在服务端。

首次使用通过页面输入家庭码注册新账号。已有账号先登录，再申请开通。重复邮箱注册不会给现有账号直接增加准入；停用账号不能用家庭码自行恢复。

每个账号可创建多位成员，当前不提供跨账号共享成员。删除成员或账号会级联影响其关联记录，维护操作需要确认对象。

## 验证

```sh
npm run typecheck
npm test
npm run test:db
npm run build
```

- `npm test`：领域规则和模拟的账号接口安全测试。
- `npm run test:db`：在临时 PGlite 中检查两份迁移、约束和权限规则。
- 构建与单元测试不替代真实浏览器、Supabase Auth 和移动设备验收。

`scripts/test-database.mjs` 与 `scripts/test-meal-presets-cloud.mjs` 是额外的云端写入测试，都要求 `GLUCOSE_RUN_CLOUD_TESTS=1`，以及独立提供、与数据库 origin 一致的 `GLUCOSE_EXPECTED_SUPABASE_URL`。它们会创建和清理合成账号，不属于日常本地测试步骤。`npm run test:config` 无需连接云端，即可检查目标确认和部署选择。

## 部署

在自己的 Vercel 项目设置 Root Directory 为 `glucose-app`，配置四项应用环境变量后使用 Next.js 构建。先验证测试环境的注册、准入、成员隔离、保存和导出，再发布正式版本。

项目还提供 `npm run deploy:preview` 和 `npm run deploy:prod`。使用这些脚本前：

1. 在仓库根目录执行 `npm ci`，安装脚本所需的 Vercel CLI。
2. 在本应用目录关联自己的 Vercel 项目，生成本地 `.vercel/project.json`。
3. 预期项目名默认为 `glucose-app`，其他名称通过 `--project-name` 或 `GLUCOSE_VERCEL_PROJECT_NAME` 指定；选择的名称必须与本地绑定一致。
4. 用 `node scripts/deploy.mjs --dry-run --project-name your-project` 验证 staging。

例如，自定义项目使用 `npm run deploy:preview -- --project-name your-project`。部署命令会加载已有的 `.env.local`；由 shell 提供配置时不要求环境文件。

部署脚本只复制构建必需文件，排除环境文件、项目绑定和依赖目录。自己的 `.vercel/` 不提交到仓库。

## 贡献约定

- 保留原始血糖单位与 `HI` / `LO`，缺失数值不补零。
- 新增记录、组合与再次应用后的记录保留独立 ID 和快照。
- 变更成员、日期、时区或餐食关联时补充对应规则测试。
- 食物数值需附来源与口径；复现数据、截图和云端验收使用合成资料。
