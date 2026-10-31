# 随包字体

[English](./README.md) | 简体中文

`LedgerSongti.ttf` 来自 Noto Serif SC，经改名、固定为 600 字重并按 GB2312 字符集与常用界面标点裁剪。`LedgerNumbers.ttf` 来自 Libre Baskerville，经改名、固定为 600 字重并裁剪为拉丁字符。二者均按附带的 SIL Open Font License 1.1 分发。这些开放字体保留草稿的衬线风格，并使用更扎实的笔画便于阅读，没有复制专有系统字体。

每份文件都注册为独立的单字重字体族。客户端样式与 Web FontFace 描述使用 normal 匹配，直接选择真实的 600 字重轮廓，不依赖从普通字体合成粗体。可读性改版替换了原先的 400 字重资源，已保存的字体选项 ID 保持不变。

来源、SHA-256、字符数量和许可证记录在 `sources.json`。将原字体和许可证文件放入指定目录后，可用 `scripts/prepare-fonts.py` 重建（需要 fontTools）。应用运行时不请求网络字体。正文与生僻中文使用平台字体回退。字体选择属于设备偏好，不随账本备份迁移。
