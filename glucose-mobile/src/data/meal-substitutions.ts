export type FoodRole = "staple" | "protein" | "vegetable" | "seasoning";
export interface SwapFood {
  id: string; name: string; label: string; role: FoodRole; group: string;
  allergens: string[]; exclusions: string[]; diet: "plant" | "egg-dairy" | "animal";
  minutes: number; amount?: string; preparation?: string;
}

function food(id: string, name: string, role: FoodRole, group: string, options: Partial<Omit<SwapFood, "id" | "name" | "role" | "group">> = {}): SwapFood {
  return { id, name, label: name, role, group, allergens: [], exclusions: [], diet: "plant", minutes: 0, ...options };
}

/** Explicitly described ingredients only. Portions are logging examples, not nutrient-equivalent exchanges. */
export const SWAP_FOODS: readonly SwapFood[] = [
  food("rice-white", "白米饭", "staple", "cooked-grain", { minutes: 5, preparation: "熟重" }),
  food("rice-brown", "糙米饭", "staple", "cooked-grain", { minutes: 5, preparation: "熟重" }),
  food("millet", "小米饭", "staple", "cooked-grain", { minutes: 5, preparation: "熟重" }),
  food("yam", "山药", "staple", "root", { minutes: 20, preparation: "生重，蒸熟后配餐" }),
  food("potato", "土豆", "staple", "root", { minutes: 20, preparation: "生重，蒸熟后配餐" }),
  food("sweet-potato", "红薯", "staple", "root", { minutes: 20, preparation: "生重，蒸熟后配餐" }),
  food("wheat-noodle", "干小麦挂面", "staple", "dry-noodle", { minutes: 10, allergens: ["小麦"], preparation: "干重，煮熟后配餐" }),
  food("buckwheat-noodle", "荞麦小麦面条（配料仅荞麦粉、小麦粉、水、盐）", "staple", "dry-noodle", { label: "荞麦小麦面条", minutes: 10, allergens: ["小麦"], preparation: "干重，煮熟后配餐；按实际包装核对配料" }),
  food("oats", "原味燕麦片", "staple", "oats"),
  food("bread", "全麦面包（配料仅全麦小麦粉、水、酵母、盐）", "staple", "bread", { label: "全麦面包", allergens: ["小麦"] }),
  food("flour", "全麦小麦粉", "staple", "flour", { allergens: ["小麦"] }),
  food("corn", "甜玉米粒", "staple", "corn"),
  food("egg", "鸡蛋", "protein", "main-protein", { diet: "egg-dairy", allergens: ["鸡蛋"], minutes: 10, amount: "1 个，煮熟后配餐" }),
  food("tofu", "原味豆腐", "protein", "main-protein", { allergens: ["大豆"], minutes: 15, amount: "150 克，单独蒸熟后配餐" }),
  food("chicken", "去皮鸡胸肉", "protein", "main-protein", { label: "鸡胸肉", diet: "animal", exclusions: ["鸡肉", "肉类"], minutes: 25, amount: "生重 100 克，单独蒸煮熟后配餐" }),
  food("fish", "鲈鱼去骨鱼肉", "protein", "main-protein", { label: "鱼肉", diet: "animal", allergens: ["鱼"], exclusions: ["鱼肉", "海鲜", "肉类"], minutes: 25, amount: "生重 120 克，单独蒸熟后配餐" }),
  food("shrimp", "原味虾仁", "protein", "main-protein", { label: "虾仁", diet: "animal", allergens: ["甲壳类"], exclusions: ["虾", "海鲜", "肉类"], minutes: 20, amount: "生重 100 克，单独煮熟后配餐" }),
  food("beef", "原味瘦牛肉", "protein", "main-protein", { label: "瘦牛肉", diet: "animal", exclusions: ["牛肉", "肉类"], minutes: 25, amount: "生重 80 克，单独煮熟后配餐" }),
  food("pork", "原味瘦猪肉", "protein", "main-protein", { label: "瘦猪肉", diet: "animal", exclusions: ["猪肉", "肉类"], minutes: 25, amount: "生重 80 克，单独煮熟后配餐" }),
  food("milk", "纯牛奶", "protein", "drink", { diet: "egg-dairy", allergens: ["牛奶"], amount: "200 毫升，核对配料后配餐" }),
  food("soymilk", "无糖豆浆", "protein", "drink", { allergens: ["大豆"], amount: "250 毫升，选用已煮熟豆浆并核对配料" }),
  food("yogurt", "原味无糖酸奶", "protein", "yogurt", { diet: "egg-dairy", allergens: ["牛奶"] }),
  food("chickpea", "鹰嘴豆", "protein", "cooked-legume", { minutes: 5, amount: "提前彻底煮熟后 100 克，不含调味" }),
  food("lentil", "食用小扁豆", "protein", "cooked-legume", { minutes: 5, amount: "提前彻底煮熟后 100 克；不是四季豆" }),
  food("cucumber", "黄瓜", "vegetable", "vegetable", { minutes: 5, preparation: "清洗后配餐" }),
  food("tomato", "番茄", "vegetable", "vegetable", { minutes: 5, preparation: "清洗后配餐" }),
  food("broccoli", "西兰花", "vegetable", "vegetable", { minutes: 10, preparation: "焯熟后配餐" }),
  food("spinach", "菠菜", "vegetable", "vegetable", { minutes: 10, preparation: "焯熟后配餐" }),
  food("bokchoy", "小白菜", "vegetable", "vegetable", { minutes: 10, preparation: "焯熟后配餐" }),
  food("carrot", "胡萝卜", "vegetable", "vegetable", { minutes: 10, preparation: "蒸熟后配餐" }),
  food("pepper", "彩椒", "vegetable", "vegetable", { minutes: 10, preparation: "蒸熟后配餐" }),
  food("zucchini", "西葫芦", "vegetable", "vegetable", { minutes: 10, preparation: "蒸熟后配餐" }),
  food("shiitake", "鲜香菇", "vegetable", "mushroom", { minutes: 10, preparation: "煮熟后配餐" }),
  food("mushroom", "口蘑", "vegetable", "mushroom", { minutes: 10, preparation: "煮熟后配餐" }),
  ...["菜籽油", "盐", "饮用水", "鲜姜", "蒜", "葱", "柠檬汁"].map((name, index) => food(`seasoning-${index}`, name, "seasoning", "seasoning")),
];

export const SWAP_FOOD_BY_ID = new Map(SWAP_FOODS.map(item => [item.id, item]));
export const SWAP_FOOD_BY_NAME = new Map(SWAP_FOODS.map(item => [item.name, item]));
export const ROLE_LABELS: Record<FoodRole, string> = { staple: "主食", protein: "蛋白质食物", vegetable: "蔬菜", seasoning: "调味与用水" };
