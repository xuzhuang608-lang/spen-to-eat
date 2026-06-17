function matchesList(value, selected) {
  if (!selected || selected === "不限") return true;
  if (Array.isArray(value)) return value.includes(selected);
  return value === selected;
}

function filterDishes(dishes, filters) {
  const avoidTags = filters.avoidTags || [];
  return dishes.filter((dish) => {
    const dishAvoidTags = dish.avoidTags || [];
    const avoidHit = avoidTags.some((tag) => dishAvoidTags.includes(tag));
    return (
      dish.city === filters.city &&
      matchesList(dish.mealTime, filters.mealTime) &&
      matchesList(dish.category, filters.category) &&
      matchesList(dish.taste, filters.taste) &&
      matchesList(dish.scene, filters.scene) &&
      !avoidHit
    );
  });
}

function weightedPick(list) {
  if (!list.length) return null;
  const total = list.reduce((sum, item) => sum + (item.weight || 1), 0);
  let cursor = Math.random() * total;
  for (let i = 0; i < list.length; i += 1) {
    cursor -= list[i].weight || 1;
    if (cursor <= 0) return list[i];
  }
  return list[list.length - 1];
}

function getDishRatingIcon(dishOrType) {
  const baseIcons = {
    chili: "🌶",
    bowl: "🍚",
    flame: "🔥"
  };

  if (!dishOrType || typeof dishOrType === "string") {
    return baseIcons[dishOrType] || "🍚";
  }

  const dish = dishOrType;
  const text = [
    dish.name,
    dish.category,
    dish.taste,
    (dish.tags || []).join(""),
    (dish.avoidTags || []).join("")
  ].filter(Boolean).join("");
  const category = dish.category || "";

  if (category === "饮品" || /奶茶|糖水|豆浆|米浆|饮|汁|酒|咖啡|凉茶|酸梅|牛奶|燕麦奶/.test(text)) return "🥤";
  if (category === "甜品") return "🍮";
  if (/汤圆|糕|糖|甜|奶|布丁|双皮奶|冰|酥|粿|粑|月饼/.test(text)) return "🍮";
  if (/粉蒸肉/.test(text)) return "🥩";
  if (/火锅|砂锅|锅|煲|炖|焖|烩|汤/.test(text)) return "🍲";
  if (/肠粉|粿条|河粉|米线|宽粉|汤粉|炒粉|米粉|面|粉/.test(text)) return "🍜";
  if (/饺|包|饼|馄饨|云吞|烧卖|馍|馕/.test(text)) return "🥟";
  if (/饭|煲仔|盖浇|炒饭|拌饭/.test(text)) return "🍛";
  if (/虾|蟹|鱼|蚝|螺|贝|鲍|海|鱿|蛤|蛏|水产/.test(text)) return "🦐";
  if (/鸡|鸭|鹅|鸽|禽/.test(text)) return "🍗";
  if (/牛|羊|猪|肉|排骨|扣肉|肘|腊肠|香肠|腊|熏/.test(text)) return "🥩";
  if (/面|粉|米线|河粉|粿条|馄饨|云吞|饺|包|饼|馍|馕|宽粉/.test(text)) return "🍜";
  if (/粥|羹|糊|浆/.test(text)) return "🥣";
  if (/辣|麻|酸辣|重口/.test(text)) return "🌶";
  if (/烧|烤|煎|炸|炒|爆|焗|烙|炕/.test(text)) return "🔥";
  return baseIcons[dish.iconType] || "🍚";
}

function iconRating(count, dishOrType) {
  return new Array(count).fill(getDishRatingIcon(dishOrType)).join("");
}

function iconRatingItems(count, dishOrType) {
  const icon = getDishRatingIcon(dishOrType);
  const activeCount = Math.max(0, Math.min(5, Number(count) || 0));
  return [0, 1, 2, 3, 4].map((index) => ({
    key: index,
    icon,
    active: index < activeCount
  }));
}

module.exports = {
  filterDishes,
  weightedPick,
  getDishRatingIcon,
  iconRating,
  iconRatingItems
};
