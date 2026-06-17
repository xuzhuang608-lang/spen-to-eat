const wheelSlotAngles = [0, 45, 90, 135, 180, 225, 270, 315];

function shuffle(list) {
  const copy = list.slice();
  for (let index = copy.length - 1; index > 0; index -= 1) {
    const target = Math.floor(Math.random() * (index + 1));
    const temp = copy[index];
    copy[index] = copy[target];
    copy[target] = temp;
  }
  return copy;
}

function uniqueByName(list) {
  const seen = {};
  return list.filter((dish) => {
    if (!dish || seen[dish.name]) return false;
    seen[dish.name] = true;
    return true;
  });
}

function getDishIcon(dish) {
  const tags = dish.tags || [];
  if (tags.includes("海鲜") || dish.name.includes("虾") || dish.name.includes("蟹")) return "🦐";
  if (tags.includes("牛肉") || dish.name.includes("牛")) return "🥩";
  if (tags.includes("粥品") || dish.name.includes("粥")) return "🥣";
  if (tags.includes("火锅") || dish.name.includes("锅")) return "🍲";
  if (tags.includes("面食") || tags.includes("汤粉") || tags.includes("米粉") || dish.name.includes("面") || dish.name.includes("粉")) return "🍜";
  if (tags.includes("糕点") || dish.category === "甜品") return "🍮";
  if (dish.category === "饮品") return "🥤";
  if (dish.category === "小吃") return "🥟";
  return "🍚";
}

function buildWheelItems(list) {
  return list.slice(0, 8).map((dish, index) => Object.assign({}, dish, {
    icon: getDishIcon(dish),
    shortName: String(dish.name || "").trim().slice(0, 6),
    posClass: `mini-pos-${index}`,
    chosenClass: "",
    slotIndex: index
  }));
}

function decorateAddWheelItems(items, chosenMap) {
  return (items || []).map((dish) => Object.assign({}, dish, {
    chosenClass: chosenMap && chosenMap[dish.id] ? "picked" : ""
  }));
}

function weightedPick(list) {
  if (!list.length) return null;
  const total = list.reduce((sum, dish) => sum + (dish.weight || 1), 0);
  let cursor = Math.random() * total;
  for (let index = 0; index < list.length; index += 1) {
    cursor -= list[index].weight || 1;
    if (cursor <= 0) return list[index];
  }
  return list[list.length - 1];
}

function getTargetWheelAngle(currentAngle, slotIndex) {
  const target = (360 - wheelSlotAngles[slotIndex]) % 360;
  const current = ((currentAngle % 360) + 360) % 360;
  const delta = (target - current + 360) % 360;
  return currentAngle + 2520 + delta;
}

module.exports = {
  shuffle,
  uniqueByName,
  buildWheelItems,
  decorateAddWheelItems,
  weightedPick,
  getTargetWheelAngle
};
