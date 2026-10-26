# 首批资料与复用说明

核验日：2026-10-19。此目录不整库复制第三方 GI 查询站，也不抓取用户资料。

- GI 数值：Henry, C.J., Quek, R.Y.C., Kaur, B. et al. *A glycaemic index compendium of non-western foods*. Nutrition & Diabetes 11, 2 (2021). [论文](https://www.nature.com/articles/s41387-020-00145-w)，[表 1](https://www.nature.com/articles/s41387-020-00145-w/tables/1)。论文 Rights and permissions 明确采用 [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/)。应用仅人工选取 14 条常见食物，翻译名称、标明实验条件、按相同实验份量换算可利用碳水；每条记录保留表中行号、署名、原文链接与修改说明。
- 32 条食物中，其余 18 条仅作为记餐目录。4 条原味少碳水食材标为 `not-applicable`，14 条标为 `unknown`；两者均不填 `0`。[悉尼大学 FAQ](https://glycemicindex.com/faqs/) 仅链接用于 GI 适用范围说明，没有复制其受版权保护的数据库。
- `availableCarbsPer100g` 只在表内实验份量（克）和对应可利用碳水同时明确、且与条目做法相符时填写：`可利用碳水 / 实验克数 × 100`。这不代表家庭烹调的含水量完全相同；家庭份量变化产生的 GL 只能作估算。缺失时不跨来源拼接，也不把总碳水直接当作可利用碳水。
- GI 研究样品不能代表同类食物的所有品种、品牌、熟度与做法，数值也不能预测个人血糖。食物库的称重份量是记录示例，未声称为统一推荐量。
- 18 个餐饮模板是原创组合，食材、调味料与份量均自行编写；参考 [NIDDK 的餐盘搭配原则](https://www.niddk.nih.gov/health-information/diabetes/overview/healthy-living-with-diabetes)，没有照抄食谱。该站的[复用政策](https://www.niddk.nih.gov/copyright)允许多数信息免费复用；这里未使用第三方图片和标志，也不暗示机构认可本应用。
- 食材过敏信息覆盖模板有意使用的全部食材与调味料。仍需用户核对具体产品标签、外食配方和交叉接触；替换食材之后重新核对。`allergensComplete` 为缺资料时保守过滤的开关，不是无过敏风险的承诺。
- 血糖换算采用常用近似因子 `18`；保留原始输入。NIDDK 的 [Diabetes in America 换算附录](https://www.niddk.nih.gov/-/media/Files/Strategic-Plans/Diabetes-in-America-3rd-Edition/DIA_Conversions.pdf) 提供 mg/dL 与 mmol/L 对照及换算。显示层可舍入，原始记录不应被显示精度覆盖。
- `demo.ts` 为明确标注的合成数据，非患者、非测量，也不是目标范围。只供内存演示，不自动同步到真实账号。

维护时新增数值前，重新核对授权和原始条件；不能为了凑数量补造 GI、可利用碳水或家用量换算。
