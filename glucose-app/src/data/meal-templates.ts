import type { MealTemplate, MealType, Source } from "../lib/domain";

export const MEAL_GUIDANCE_SOURCE: Source = {
  title: "NIDDK：糖尿病健康生活与餐盘搭配",
  url: "https://www.niddk.nih.gov/health-information/diabetes/overview/healthy-living-with-diabetes",
  checkedAt: "2026-10-19",
  reuse: "餐盘原则的自写概述；以下食材、份量、搭配和文字为本应用原创，不是医疗处方。NIDDK 复用政策：https://www.niddk.nih.gov/copyright。未使用第三方图片或标志。",
};

type Ingredient = MealTemplate["ingredients"][number];
const ingredient = (name: string, amount: string, foodId?: string): Ingredient => ({ name, amount, ...(foodId ? { foodId } : {}) });
const baseSeasoning: Ingredient[] = [ingredient("菜籽油", "5 克"), ingredient("盐", "约 0.5 克，可按需减量")];

function template(id: string, name: string, mealTypes: MealType[], ingredients: Ingredient[], allergens: string[], tags: string[], minutes: number, reason: string, swaps: string[], excludedFor: string[] = []): MealTemplate {
  return {
    id, name, mealTypes, ingredients, allergens, allergensComplete: true, excludedFor, tags: ["均衡", "少油", "不辣", ...tags, ...(minutes <= 15 ? ["快手"] : [])], minutes, reason,
    swaps: [...swaps, "所列份量为一人搭配示例，可按饥饱及已有饮食计划调整。包装食材需核对配料与交叉接触提示；换食材后重新核对忌口。"],
    sources: [MEAL_GUIDANCE_SOURCE],
  };
}

/** Original templates; every intentional ingredient, oil and seasoning is listed. */
export const MEAL_TEMPLATES: MealTemplate[] = [
  template("breakfast-oats", "燕麦牛奶碗 · 鸡蛋配黄瓜", ["breakfast"], [
    ingredient("原味燕麦片", "干重 35 克", "oats-plain"), ingredient("纯牛奶", "200 毫升", "milk-plain"), ingredient("鸡蛋", "1 个，煮熟", "egg"), ingredient("黄瓜", "100 克", "cucumber"), ingredient("饮用水", "100 毫升，煮燕麦用"),
  ], ["牛奶", "鸡蛋"], ["蛋奶素"], 12, "谷物、蛋白质食物和蔬菜各留一个位置，燕麦不额外加糖。", ["牛奶可换已核对配料的无糖豆浆；大豆过敏时不这样替换。"]),
  template("breakfast-yam", "蒸山药 · 豆浆和番茄", ["breakfast"], [
    ingredient("山药", "生重 120 克", "yam-steamed"), ingredient("无糖豆浆", "250 毫升", "soymilk-plain"), ingredient("原味豆腐", "100 克", "tofu"), ingredient("番茄", "150 克", "tomato"), ingredient("饮用水", "蒸制用，约 400 毫升"),
  ], ["大豆"], ["纯素"], 20, "山药作为主食的一部分，搭配豆制品与完整蔬菜。", ["山药可换适量蒸土豆，记录实际吃下的份量。"]),
  template("breakfast-toast", "全麦吐司 · 番茄煎蛋", ["breakfast"], [
    ingredient("全麦面包（配料仅全麦小麦粉、水、酵母、盐）", "50 克；若产品配料不同需重新核对过敏原", "bread-wholemeal"), ingredient("鸡蛋", "1 个", "egg"), ingredient("番茄", "150 克", "tomato"), ...baseSeasoning,
  ], ["小麦", "鸡蛋"], ["蛋奶素"], 10, "用完整番茄增加蔬菜，面包份量单独记录，煎蛋少放油。", ["鸡蛋可换豆腐；替换后含大豆。含奶面包须另外核对牛奶过敏限制。"]),
  template("breakfast-sweetpotato", "蒸红薯 · 酸奶黄瓜盘", ["breakfast"], [
    ingredient("红薯", "生重 120 克；蒸制，与食物库水煮样品不同"), ingredient("原味无糖酸奶", "150 克", "yogurt-plain"), ingredient("鸡蛋", "1 个，煮熟", "egg"), ingredient("黄瓜", "100 克", "cucumber"), ingredient("饮用水", "蒸制用，约 400 毫升"),
  ], ["牛奶", "鸡蛋"], ["蛋奶素"], 20, "红薯计入主食，配酸奶和鸡蛋，避免再叠加一份谷物主食而未记录。", ["红薯可换蒸山药。酸奶选择配料不额外加糖的产品。"]),
  template("breakfast-corn", "甜玉米 · 煎豆腐配青菜", ["breakfast"], [
    ingredient("甜玉米粒", "熟重 100 克", "corn-sweet"), ingredient("原味豆腐", "150 克", "tofu"), ingredient("小白菜", "150 克"), ...baseSeasoning, ingredient("饮用水", "焯青菜用，约 300 毫升"),
  ], ["大豆"], ["纯素"], 15, "玉米作为含碳水主食，搭配豆腐和青菜，保留咀嚼感。", ["小白菜可换西兰花或菠菜，按实际食材记录。"]),
  template("breakfast-pancake", "全麦蔬菜蛋饼", ["breakfast"], [
    ingredient("全麦小麦粉", "干重 40 克"), ingredient("鸡蛋", "1 个", "egg"), ingredient("胡萝卜", "50 克"), ingredient("小白菜", "100 克"), ingredient("饮用水", "约 60 毫升"), ...baseSeasoning,
  ], ["小麦", "鸡蛋"], ["蛋奶素"], 15, "面粉先称重，蛋饼里加蔬菜；不额外叠加甜酱。", ["胡萝卜可换西葫芦。调味只用所列盐，不另加成分不明的酱料。"]),
  template("lunch-chicken", "糙米饭 · 鸡胸西兰花", ["lunch"], [
    ingredient("糙米饭", "熟重 100 克", "rice-brown"), ingredient("去皮鸡胸肉", "生重 100 克", "chicken"), ingredient("西兰花", "200 克", "broccoli"), ingredient("胡萝卜", "50 克"), ingredient("鲜姜", "3 克"), ...baseSeasoning, ingredient("饮用水", "蒸煮用，约 300 毫升"),
  ], [], ["含肉"], 25, "饭、鸡肉和较多蔬菜组成一盘，主食与蛋白质的份量分开看。", ["鸡胸可换原味鱼肉，替换后需核对鱼过敏。"], ["鸡肉", "肉类"]),
  template("lunch-fish", "小米饭 · 清蒸鱼配菠菜", ["lunch"], [
    ingredient("小米饭", "熟重 100 克", "millet-cooked"), ingredient("鲈鱼去骨鱼肉", "生重 120 克", "fish"), ingredient("菠菜", "200 克", "spinach"), ingredient("鲜姜", "3 克"), ingredient("葱", "5 克"), ...baseSeasoning, ingredient("饮用水", "蒸煮用，约 400 毫升"),
  ], ["鱼"], ["含鱼"], 25, "用蒸制鱼肉搭配一份主食与蔬菜，不用甜味芡汁。", ["鱼肉可换豆腐，替换后含大豆。"], ["鱼肉", "海鲜", "肉类"]),
  template("lunch-tofu", "糙米饭 · 香菇豆腐青菜", ["lunch"], [
    ingredient("糙米饭", "熟重 100 克", "rice-brown"), ingredient("原味豆腐", "150 克", "tofu"), ingredient("鲜香菇", "80 克"), ingredient("小白菜", "200 克"), ingredient("蒜", "3 克"), ...baseSeasoning, ingredient("饮用水", "炖煮用，约 150 毫升"),
  ], ["大豆"], ["纯素"], 20, "豆腐提供植物蛋白食物的位置，香菇和青菜增加蔬菜种类。", ["香菇可换口蘑；不是把菌菇当成豆腐的蛋白质等量替代。"]),
  template("lunch-beef", "清汤牛肉蔬菜面", ["lunch"], [
    ingredient("干小麦挂面", "干重 50 克", "noodles-wheat"), ingredient("原味瘦牛肉", "生重 80 克"), ingredient("小白菜", "150 克"), ingredient("番茄", "100 克", "tomato"), ingredient("鲜姜", "3 克"), ...baseSeasoning, ingredient("饮用水", "约 500 毫升"),
  ], ["小麦"], ["含肉"], 20, "面条干重和蔬菜分别记录，用清水和原食材做汤底。", ["牛肉可换鸡胸；避免直接换用含糖、含大豆的复合汤料。"], ["牛肉", "肉类"]),
  template("lunch-pork", "土豆瘦肉片 · 双蔬小份饭", ["lunch"], [
    ingredient("土豆", "生重 80 克", "potato-steamed"), ingredient("原味瘦猪肉", "生重 80 克"), ingredient("白米饭", "熟重 60 克", "rice-white"), ingredient("西兰花", "150 克", "broccoli"), ingredient("彩椒", "80 克"), ingredient("鲜姜", "3 克"), ...baseSeasoning, ingredient("饮用水", "焖煮用，约 150 毫升"),
  ], [], ["含肉"], 25, "土豆也计入主食，搭配米饭时把两种主食都记录。", ["猪肉可换鸡胸；土豆增加时相应重新安排整餐主食份量。"], ["猪肉", "肉类"]),
  template("lunch-chickpea", "鹰嘴豆糙米碗", ["lunch"], [
    ingredient("鹰嘴豆", "提前煮熟后 100 克，不含调味"), ingredient("糙米饭", "熟重 70 克", "rice-brown"), ingredient("黄瓜", "100 克", "cucumber"), ingredient("番茄", "150 克", "tomato"), ingredient("柠檬汁", "现挤 5 毫升"), ...baseSeasoning,
  ], [], ["纯素"], 10, "豆类同时含碳水和蛋白质，搭配少量米饭与完整蔬菜。", ["使用罐装鹰嘴豆时核对配料并沥干冲洗；有豆类过敏需按实际品种避开。"]),
  template("dinner-egg-noodle", "番茄鸡蛋青菜面", ["dinner"], [
    ingredient("干小麦挂面", "干重 45 克", "noodles-wheat"), ingredient("鸡蛋", "1 个", "egg"), ingredient("番茄", "150 克", "tomato"), ingredient("菠菜", "150 克", "spinach"), ...baseSeasoning, ingredient("饮用水", "约 500 毫升"),
  ], ["小麦", "鸡蛋"], ["蛋奶素"], 15, "汤面也把面条和蔬菜分别称量，番茄不用额外加糖。", ["菠菜可换小白菜；用豆腐替换鸡蛋后含大豆。"]),
  template("dinner-fish", "清蒸鱼 · 米饭双蔬", ["dinner"], [
    ingredient("鲈鱼去骨鱼肉", "生重 120 克", "fish"), ingredient("白米饭", "熟重 100 克", "rice-white"), ingredient("西葫芦", "150 克"), ingredient("西兰花", "100 克", "broccoli"), ingredient("鲜姜", "3 克"), ...baseSeasoning, ingredient("饮用水", "蒸煮用，约 400 毫升"),
  ], ["鱼"], ["含鱼"], 25, "一份米饭搭配鱼肉和两种蔬菜，调味成分清楚可记录。", ["米饭可换熟小米饭，实际做法不同不直接套用研究中的 GI。"], ["鱼肉", "海鲜", "肉类"]),
  template("dinner-tofu-yam", "山药豆腐菌菇锅", ["dinner"], [
    ingredient("山药", "生重 120 克", "yam-steamed"), ingredient("原味豆腐", "150 克", "tofu"), ingredient("口蘑", "80 克"), ingredient("小白菜", "200 克"), ingredient("鲜姜", "3 克"), ...baseSeasoning, ingredient("饮用水", "约 400 毫升"),
  ], ["大豆"], ["纯素"], 20, "把山药当主食，豆腐和蔬菜一起煮，方便一次记全。", ["山药可换土豆；锅里不用另加成分不明的火锅底料。"]),
  template("dinner-shrimp", "虾仁玉米饭 · 清炒青菜", ["dinner"], [
    ingredient("原味虾仁", "生重 100 克"), ingredient("甜玉米粒", "熟重 50 克", "corn-sweet"), ingredient("白米饭", "熟重 70 克", "rice-white"), ingredient("小白菜", "200 克"), ingredient("胡萝卜", "50 克"), ingredient("鲜姜", "3 克"), ...baseSeasoning, ingredient("饮用水", "焯菜用，约 300 毫升"),
  ], ["甲壳类"], ["含海鲜"], 20, "玉米和米饭都计入主食，配虾仁与较多青菜。", ["虾仁可换鸡胸；有甲壳类过敏时也需避免共用锅具造成交叉接触。"], ["虾", "海鲜", "肉类"]),
  template("dinner-chicken-noodle", "鸡丝蔬菜清拌面", ["dinner"], [
    ingredient("干小麦挂面", "干重 45 克", "noodles-wheat"), ingredient("去皮鸡胸肉", "生重 100 克", "chicken"), ingredient("黄瓜", "100 克", "cucumber"), ingredient("胡萝卜", "80 克"), ingredient("柠檬汁", "现挤 5 毫升"), ...baseSeasoning, ingredient("饮用水", "煮面及鸡肉用，约 700 毫升"),
  ], ["小麦"], ["含肉"], 20, "用原味鸡丝和蔬菜拌面，面和油的用量各自明确。", ["不用芝麻酱或复合沙拉汁；若自行添加，记录配料并核对过敏原。"], ["鸡肉", "肉类"]),
  template("dinner-lentil", "扁豆蔬菜炖饭", ["dinner"], [
    ingredient("食用小扁豆", "提前彻底煮熟后 100 克；不是四季豆"), ingredient("糙米饭", "熟重 70 克", "rice-brown"), ingredient("番茄", "150 克", "tomato"), ingredient("西葫芦", "150 克"), ingredient("蒜", "3 克"), ...baseSeasoning, ingredient("饮用水", "约 150 毫升"),
  ], [], ["纯素"], 15, "豆类搭配少量谷物与蔬菜，采用炖煮，保留实际份量记录。", ["小扁豆可换提前煮熟的鹰嘴豆，豆类品种变化后重新核对过敏限制。"]),
];
