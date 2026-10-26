import type { Food, Source } from "../lib/domain";

export const DATA_CHECKED_AT = "2026-10-19";

export const GI_COMPENDIUM_SOURCE: Source = {
  title: "Henry 等，非西方食物 GI 汇编（2021），表 1",
  url: "https://www.nature.com/articles/s41387-020-00145-w/tables/1",
  checkedAt: DATA_CHECKED_AT,
  reuse: "CC BY 4.0：https://creativecommons.org/licenses/by/4.0/；Henry, C.J., Quek, R.Y.C., Kaur, B. et al. Nutrition & Diabetes 11, 2 (2021). DOI:10.1038/s41387-020-00145-w。中文名称为本应用翻译，按实验份量换算可利用碳水；仅选录少量条目。",
};

export const GI_EXPLANATION_SOURCE: Source = {
  title: "悉尼大学：GI 常见问题（仅用于概念说明）",
  url: "https://glycemicindex.com/faqs/",
  checkedAt: DATA_CHECKED_AT,
  reuse: "只链接并用自写文字说明 GI 适用范围；未复制该站 GI 数据库。",
};

const researchNote = "这是特定研究样品的平均 GI，不代表所有品种或做法。记录份量可调整；不能据此预测个人餐后血糖。";

function known(id: string, name: string, aliases: string[], category: string, preparation: string, gi: number, row: number, grams: number, experimentGrams?: number, experimentCarbs?: number): Food {
  return {
    id, name, aliases, category, preparation,
    portionLabel: `${grams} 克（称重记录示例）`, portionGrams: grams, gi, giStatus: "known",
    availableCarbsPer100g: experimentGrams !== undefined && experimentCarbs !== undefined ? experimentCarbs / experimentGrams * 100 : null,
    carbBasis: experimentGrams !== undefined && experimentCarbs !== undefined ? "available" : "unknown",
    sources: [{ ...GI_COMPENDIUM_SOURCE, detail: `表 1 第 ${row} 项；葡萄糖参照为 100。${experimentGrams !== undefined ? `研究中的实验份量 ${experimentGrams} 克含可利用碳水 ${experimentCarbs} 克；每 100 克数据据此换算。` : "未找到可与该样品匹配的每份可利用碳水，因此不计算 GL。"}` }],
    notes: researchNote,
  };
}

function missing(id: string, name: string, aliases: string[], category: string, preparation: string, grams: number, notApplicable = false): Food {
  return {
    id, name, aliases, category, preparation, portionLabel: `${grams} 克（称重记录示例）`, portionGrams: grams,
    gi: null, giStatus: notApplicable ? "not-applicable" : "unknown", availableCarbsPer100g: null, carbBasis: "unknown",
    sources: [GI_EXPLANATION_SOURCE],
    notes: notApplicable ? "此处指未裹粉、未加糖的原食材；碳水很少，通常不使用 GI 评价，不表示对血糖没有影响。" : "尚未核实适用于此品种、品牌或做法且可复用的 GI。此条供搜索与记餐使用，不填 0，也不计算 GL。",
  };
}

/**
 * Curated manually, not scraped from a proprietary database. Numerical facts come
 * only from the CC BY 4.0 table linked above; blank entries are deliberately blank.
 * Research weights and available carbohydrate must describe the same cooked food.
 * Catalog portions are logging examples, not prescribed serving sizes.
 */
export const FOODS: Food[] = [
  known("rice-white", "白米饭（煮 30 分钟）", ["米饭", "白饭", "大米"], "米面杂粮", "中国研究样品，煮 30 分钟，熟重", 83, 478, 100, 230, 50),
  known("rice-brown", "糙米饭（台粳 9 号）", ["糙米", "杂粮饭"], "米面杂粮", "台湾研究样品，台粳 9 号；家庭混合杂粮饭不能直接套用", 49.8, 496, 100),
  known("bread-wholemeal", "全麦面包（研究样品）", ["全麦吐司", "面包"], "米面杂粮", "中国研究中的全麦面包，配方未完整给出；品牌不同需另查", 69, 432, 50),
  known("noodles-wheat", "干小麦面条（研究样品）", ["挂面", "面条"], "粥粉面", "中国研究的干制小麦面条；汇编未给出具体烹煮时长", 46, 434, 100),
  known("potato-steamed", "蒸土豆", ["马铃薯", "洋芋", "土豆"], "薯类豆类", "中国研究样品，蒸制；不套用于土豆泥或油炸薯条", 62, 441, 100),
  known("yam-steamed", "蒸山药", ["山药", "淮山"], "薯类豆类", "中国研究样品，蒸制；品种和蒸制时间未完整给出", 51, 443, 100),
  known("corn-sweet", "熟甜玉米", ["玉米", "甜玉米"], "米面杂粮", "中国研究样品，熟甜玉米；不适用于糯玉米", 55, 428, 100),
  known("millet-cooked", "小米饭（研究样品）", ["熟小米", "小米"], "米面杂粮", "中国研究样品，熟重；与小米粥分开记录", 64.4, 451, 100, 169, 50),
  known("millet-porridge", "小米粥（研究样品）", ["小米稀饭", "粥"], "粥粉面", "中国研究样品，粥的稀稠度影响每份碳水；家庭做法需另核对", 93.6, 452, 200, 550, 50),
  known("adzuki-boiled", "红小豆（煮 40 分钟）", ["红豆", "赤小豆"], "薯类豆类", "中国研究样品，煮 40 分钟，不加糖，熟重", 21, 489, 100, 230, 50),
  known("apple-red", "红苹果（研究样品）", ["苹果"], "水果", "菲律宾研究样品，红苹果可食部分；不适用于果汁或苹果干", 42, 301, 100, 181, 25),
  known("watermelon-red", "红瓤西瓜（研究样品）", ["西瓜"], "水果", "马来西亚研究样品，红瓤品种可食部分", 55, 67, 150, 893, 50),
  known("sweet-potato-boiled", "水煮红薯（研究样品）", ["红薯", "番薯", "地瓜"], "薯类豆类", "西印度地区研究样品，水煮，熟重；与烘烤样品分开", 46, 582, 100, 234.63, 50),
  known("sweet-potato-baked", "烘烤红薯（研究样品）", ["烤红薯", "烤地瓜"], "薯类豆类", "西印度地区研究样品，烘烤，熟重；品种与烘烤条件影响结果", 94, 584, 100, 167.79, 50),
  missing("oats-plain", "原味燕麦片", ["燕麦", "燕麦粥"], "米面杂粮", "未加糖燕麦片；即食、压片、整粒分别核对包装", 40),
  missing("bun-wholemeal", "全麦馒头", ["馒头", "杂粮馒头"], "米面杂粮", "不同全麦比例与配方差异大，熟重", 60),
  missing("milk-plain", "纯牛奶", ["牛奶", "鲜奶"], "乳制品", "未加糖纯牛奶；脂肪含量及品牌请查包装", 200),
  missing("yogurt-plain", "原味无糖酸奶", ["酸奶", "乳酪"], "乳制品", "配料不额外加糖；原味不一定无糖，请查营养标签", 150),
  missing("soymilk-plain", "无糖豆浆", ["豆浆", "豆奶"], "饮料", "不加糖；家庭豆水比例和商业配方差异大", 200),
  missing("banana", "香蕉", ["芭蕉"], "水果", "可食部分；品种和成熟度影响结果", 100),
  missing("orange", "橙子", ["橙", "甜橙"], "水果", "完整果肉可食部分，不适用于橙汁", 100),
  missing("mung-bean", "水煮绿豆", ["绿豆"], "薯类豆类", "不加糖，熟重；不是绿豆甜汤", 100),
  missing("noodles-buckwheat", "荞麦面", ["荞麦面条"], "粥粉面", "检查荞麦及小麦比例；品牌、配方与生熟重分开", 100),
  missing("cucumber", "黄瓜", ["青瓜"], "蔬菜", "新鲜可食部分，不含蘸酱", 100),
  missing("broccoli", "西兰花", ["青花菜"], "蔬菜", "清蒸或焯水，不加勾芡汁", 150),
  missing("spinach", "菠菜", ["叶菜"], "蔬菜", "焯水后沥干，不加调味汁", 150),
  missing("egg", "鸡蛋", ["水煮蛋", "鸡子"], "肉蛋鱼豆", "水煮鸡蛋可食部分，不加糖、不裹粉", 50, true),
  missing("chicken", "去皮鸡胸肉", ["鸡肉", "鸡胸"], "肉蛋鱼豆", "原味蒸煮，不裹粉、不加糖汁", 100, true),
  missing("fish", "原味鱼肉", ["鲈鱼", "鱼"], "肉蛋鱼豆", "原味蒸煮，不裹粉、不加糖汁", 100, true),
  missing("walnut", "原味核桃", ["核桃", "坚果"], "坚果零食", "核桃仁，不加糖、不裹粉", 15, true),
  missing("tofu", "原味豆腐", ["北豆腐", "南豆腐"], "肉蛋鱼豆", "大豆制品；老嫩、品牌与凝固方式不同，核对包装", 100),
  missing("tomato", "番茄", ["西红柿"], "蔬菜", "新鲜可食部分，不加糖", 100),
];

export const FOOD_BY_ID = Object.fromEntries(FOODS.map((food) => [food.id, food])) as Record<string, Food>;
