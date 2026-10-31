# 小金库素材

[English](./README.md) | 简体中文

四张透明 PNG 由 OpenAI imagegen 为本项目生成，导入前已进行视觉检查，不含客户记录、铭文或截图。保留生成来源元数据。文件随包内置，用于 Android 和桌面离线渲染。

- `safe-small.png`、`safe-reinforced.png`、`safe-vault.png`：空的正面暖白／灰绿柜体，右侧可见打开的门边，采用水粉／油画笔触。
- `gold-natural-atlas.png`：1536 × 1024 六格素材，每格 512 像素。首行为三种细微金块变化，次行为平放金币、倚靠金币与金粒。哑光蜜金色、左上光照与灰绿反射阴影。

`little-vault.tsx` 直接在父 SVG 场景中定位和裁切素材分格，使用接触阴影、稳定摆放和内腔裁切。避免用嵌套 SVG 视口定位物件，因为 Android 对其 x/y 原点的处理与浏览器不同。不要以财务截图替换素材。面额与隐私行为见[小金库设计](../../../../docs/VAULT_DESIGN.zh-CN.md)。
