# 糖记 · Mobile

[English](./README.md) | 简体中文

基于 React Native 与 Expo 的血糖和饮食记录应用。Android 优先，同一套路由、页面与业务规则也支持 Web，通过平台文件适配日期控件与会话存储。

## 功能

- 登录、成员切换与档案维护。
- 血糖和饮食新增、补记、修改、删除，以及 `HI` / `LO`。
- 明确餐食关联、同餐回看、常吃组合与未保存提醒。
- 食物查询、来源、图片与收藏。
- 单餐搭配、按偏好筛选、单项食材替换及记餐草稿。
- 日期与场景筛选、实测点图和合成演示模式。

## 本地体验

使用 Node.js 22，在仓库根目录执行：

```sh
cd glucose-mobile
npm ci
npm run web
```

按终端提示打开网页，从界面进入演示模式即可使用合成数据。静态食物资料随应用分发；演示修改只保存在当前会话内存。

## 云端与网页端

手机端可以与[糖记网页端](../glucose-app/README.zh-CN.md)连接同一个自行部署的 Supabase 项目，复用账号和 `glucose_` 表。

复制 `.env.example` 为 `.env.local`，客户端只接收公开值，其中网页入口可选：

```dotenv
EXPO_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
EXPO_PUBLIC_SUPABASE_ANON_KEY=your-public-anon-or-publishable-key
EXPO_PUBLIC_WEB_ORIGIN=https://your-web.example
```

云连接和注册入口使用自己的配置。客户端密钥必须是公开的 anon 或 publishable key；地址使用 HTTPS，仅本机回环开发允许 HTTP。未设置网页入口时隐藏注册和网站链接。具体说明见[开发说明](./docs/public/DEVELOPMENT.zh-CN.md)。

## 验证

在 `glucose-mobile/` 执行：

```sh
npm test
npm run typecheck
npm run lint
npm run export:web
```

原生调试和 APK 构建还需要 Android SDK 与 Java 环境，步骤见[开发说明](./docs/public/DEVELOPMENT.zh-CN.md)。Web 与单元测试通过不能替代真机验收。

## 数据边界与当前范围

Android 使用 SecureStore 保存认证会话，Web 使用本应用 origin 的 localStorage。健康记录和未保存输入保留在进程内存中，云端读取及保存需要网络；静态食物资料可离线查询。

手机端目前不包含完整离线写入、冲突同步、导出、目标编辑和系统提醒；注册与账号开通转到配置的网页端。iOS 正式构建与应用商店发布不在当前已验证范围。

食物数值与来源见 [src/data/SOURCES.md](./src/data/SOURCES.md)。应用用于查询与记录，不生成个人医疗目标或血糖预测。
