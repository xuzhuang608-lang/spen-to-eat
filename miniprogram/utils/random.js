function matchesList(value, selected) {
  if (!selected || selected === "不限") return true;
  if (Array.isArray(value)) return value.includes(selected);
  return value === selected;
}

function filterDishes(dishes, filters) {
  const avoidTags = filters.avoidTags || [];
  return dishes.filter((dish) => {
    const avoidHit = avoidTags.some((tag) => dish.avoidTags.includes(tag));
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

function iconRating(count, type) {
  const icons = {
    chili: "🌶",
    bowl: "🍚",
    flame: "🔥"
  };
  return new Array(count).fill(icons[type] || "🍚").join("");
}

function iconRatingItems(count, type) {
  const icon = {
    chili: "🌶",
    bowl: "🍚",
    flame: "🔥"
  }[type] || "🍚";
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
  iconRating,
  iconRatingItems
};
