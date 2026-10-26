# le-app

[English](./README.md) | 简体中文

一组日常使用的应用，包含塔罗、时间追踪、市场看板和健康记录。各项目独立安装依赖、启动与部署。

| 项目 | 平台与用途 | 开发说明 |
| --- | --- | --- |
| [烛火塔罗](./tarot/README.zh-CN.md) | Web：牌阵、解读与历史回看 | [开发文档](./tarot/docs/public/DEVELOPMENT.zh-CN.md) |
| [Timing Lite](./timing-lite-tauri/README.zh-CN.md) | macOS：本地活动与时间追踪 | [开发文档](./timing-lite-tauri/docs/public/DEVELOPMENT.zh-CN.md) |
| [Nasdaq 市场看板](./stock-dashboard/README.zh-CN.md) | Web：行情、公开资讯与研究记录 | [开发文档](./stock-dashboard/docs/public/DEVELOPMENT.zh-CN.md) |
| [糖记 Web](./glucose-app/README.zh-CN.md) | Web：血糖、饮食与成员记录 | [开发文档](./glucose-app/docs/public/DEVELOPMENT.zh-CN.md) |
| [糖记 Mobile](./glucose-mobile/README.zh-CN.md) | Android / Web：跨端健康记录 | [开发文档](./glucose-mobile/docs/public/DEVELOPMENT.zh-CN.md) |

## 开始开发

使用 Node.js 22，进入对应目录后按项目 README 安装与启动。根目录不是 npm workspace，执行根目录的 `npm ci` 只安装共享的 Vercel CLI，不会安装全部项目依赖。

桌面端还需要 Rust 和 macOS 编译环境；手机端的 Android 构建需要 Java 与 Android SDK。网页端可在支持的范围内先通过本地演示或 mock 体验，再配置自己的云服务。

## 配置与数据

环境模板只提供变量名和示例值。每位开发者使用自己的本地 `.env.local`，部署关联保存在本机 `.vercel/`。用户数据、数据库导出、签名文件和真实环境配置不随源码分发。

模型与云连接目标由各部署自行配置，项目开发文档说明了配置方式和目标校验要求。真实模型、云端写入和生产部署不作为默认测试的一部分。

## 参与开发

提交 Issue 时说明项目、复现步骤和预期结果，使用合成数据与已脱敏截图。PR 尽量围绕一个项目或一项共享变更，说明验证方式；数据库变化新增迁移，并说明对已有数据和其他客户端的影响。

公开文档以英文为主版。修改功能、命令或配置说明时，同步更新简体中文翻译。

食物数值、新闻和市场资料保留原始来源；第三方资源与依赖保留相应声明。

## 许可证

原创代码采用 [MIT](./LICENSE) 许可证。保留的第三方及资料来源声明见[第三方说明](./THIRD_PARTY_NOTICES.zh-CN.md)。

验证结果及已知限制见[迁移验证记录](./docs/VALIDATION.zh-CN.md)。
