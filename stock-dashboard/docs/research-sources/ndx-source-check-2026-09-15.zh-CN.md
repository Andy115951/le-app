# NDX 官方来源历史核查：2026-09-15

[English](./ndx-source-check-2026-09-15.md) | 简体中文

## 范围

这是一次发生在 2026-09-15 的历史、只读来源可用性记录。它不代表当前访问情况或当前指数成分，也不是候选文件，不能用于导入。

## 当时观察到的官方页面

- [Nasdaq NDX 权重页](https://indexes.nasdaq.com/Index/Weighting/NDX) 展示了公开的指数层信息，但完整成分与权重数据需要授权访问。
- [Nasdaq NDX 行业分布页](https://indexes.nasdaq.com/Index/Breakdown/NDX) 同样没有提供完整的公开逐证券导出。
- [Nasdaq NDX 概览页](https://indexes.nasdaq.com/Index/Overview/NDX) 确认了指数层信息，但不是完整的成分与权重导出。

## 历史结论

本次核查没有创建候选、写入数据库、使用授权访问或自动抓取来源。公开可见页面不满足项目对可审计完整成分与权重快照的要求。

## 安全后续步骤

1. 通过授权访问取得完整官方导出，并保留生效日期和发布时间。
2. 按仓库 schema 创建候选 JSON 文件。
3. 运行现有 review 命令并人工检查输出。
4. 只通过独立的显式批准步骤导入。

如需当前结果，运行 `npm run ndx:source-check` 并查看相关开发文档。不要把这份带日期记录当作实时来源可用性结论。
