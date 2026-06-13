const cloud = require("wx-server-sdk");

cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });

const db = cloud.database();
const _ = db.command;

exports.main = async (event) => {
  const { city, filters = {} } = event;
  const where = {
    city,
    isOnline: true
  };

  if (filters.category && filters.category !== "不限") where.category = filters.category;
  if (filters.taste && filters.taste !== "不限") where.taste = filters.taste;
  if (filters.mealTime && filters.mealTime !== "不限") where.mealTime = filters.mealTime;
  if (filters.scene && filters.scene !== "不限") where.scene = filters.scene;

  const avoidTags = filters.avoidTags || [];
  const result = await db.collection("dishes").where(where).limit(100).get();
  const items = result.data.filter((dish) => {
    const dishAvoidTags = dish.avoidTags || [];
    return !avoidTags.some((tag) => dishAvoidTags.includes(tag));
  });

  return { items };
};

