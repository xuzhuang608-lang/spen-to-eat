const cloud = require("wx-server-sdk");

cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });

const db = cloud.database();

function weightedPick(list) {
  if (!list.length) return null;
  const total = list.reduce((sum, item) => sum + (item.weight || 1), 0);
  let cursor = Math.random() * total;
  for (const item of list) {
    cursor -= item.weight || 1;
    if (cursor <= 0) return item;
  }
  return list[list.length - 1];
}

exports.main = async (event, context) => {
  const wxContext = cloud.getWXContext();
  const { city, filters = {} } = event;
  const where = { city, isOnline: true };

  if (filters.category && filters.category !== "不限") where.category = filters.category;
  if (filters.taste && filters.taste !== "不限") where.taste = filters.taste;
  if (filters.mealTime && filters.mealTime !== "不限") where.mealTime = filters.mealTime;
  if (filters.scene && filters.scene !== "不限") where.scene = filters.scene;

  const avoidTags = filters.avoidTags || [];
  const result = await db.collection("dishes").where(where).limit(100).get();
  let pool = result.data.filter((dish) => {
    const dishAvoidTags = dish.avoidTags || [];
    return !avoidTags.some((tag) => dishAvoidTags.includes(tag));
  });

  if (!pool.length) {
    const fallback = await db.collection("dishes").where({ city, isOnline: true }).limit(100).get();
    pool = fallback.data;
  }

  const dish = weightedPick(pool);
  if (dish) {
    await db.collection("spin_logs").add({
      data: {
        openid: wxContext.OPENID,
        city,
        filters,
        resultDishId: dish._id,
        createdAt: Date.now()
      }
    });
  }

  return { dish };
};

