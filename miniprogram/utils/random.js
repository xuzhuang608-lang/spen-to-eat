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

module.exports = {
  filterDishes,
  weightedPick
};
