const { getDishById, getDishesByCity } = require("../../services/dish");
const { iconRating, iconRatingItems } = require("../../utils/random");
const storage = require("../../services/storage");

function hashIndex(text, length) {
  if (!length) return 0;
  let hash = 0;
  for (let index = 0; index < text.length; index += 1) {
    hash = ((hash << 5) - hash + text.charCodeAt(index)) >>> 0;
  }
  return hash % length;
}

function pickStable(list, seed) {
  return list[hashIndex(seed, list.length)];
}

function safeDecode(value) {
  try {
    return decodeURIComponent(value || "");
  } catch (error) {
    return value || "";
  }
}

function getSourceFilters(query) {
  const filters = {};
  ["mealTime", "category", "taste", "scene", "avoidLabels"].forEach((key) => {
    if (query && query[key]) {
      filters[key] = safeDecode(query[key]);
    }
  });
  return filters;
}

function buildSpinAgainUrl(dish, filters) {
  const params = [
    `city=${encodeURIComponent(dish.city)}`,
    `avoidDishId=${encodeURIComponent(dish.id)}`
  ];
  ["mealTime", "category", "taste", "scene", "avoidLabels"].forEach((key) => {
    const value = filters && filters[key];
    if (value && value !== "不限") {
      params.push(`${key}=${encodeURIComponent(value)}`);
    }
  });
  return `/pages/spin/spin?${params.join("&")}`;
}

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

function getCurrentMealTime() {
  const hour = new Date().getHours();
  if (hour >= 5 && hour < 10) return "早餐";
  if (hour >= 10 && hour < 15) return "午餐";
  if (hour >= 15 && hour < 21) return "晚餐";
  return "夜宵";
}

function normalizeMealTime(mealTime) {
  return mealTime === "夜宵" ? "宵夜" : mealTime;
}

function dishMatchesMealTime(dish, mealTime) {
  return (dish.mealTime || []).includes(normalizeMealTime(mealTime));
}

function decorateRelatedDish(item) {
  return Object.assign({}, item, {
    rating: iconRating(item.localIndex, item),
    ratingItems: iconRatingItems(item.localIndex, item).map((ratingItem) =>
      Object.assign({}, ratingItem, {
        className: ratingItem.active ? "active" : ""
      })
    )
  });
}

function buildRelatedDishes(dish) {
  const currentMeal = getCurrentMealTime();
  const sameCity = getDishesByCity(dish.city).filter((item) => (
    item.id !== dish.id &&
    item.sourceBucket === "cityExact"
  ));
  const mealMatched = sameCity.filter((item) => dishMatchesMealTime(item, currentMeal));
  const selected = shuffle(mealMatched)
    .concat(shuffle(sameCity.filter((item) => !dishMatchesMealTime(item, currentMeal))))
    .slice(0, 3);
  return selected.map(decorateRelatedDish);
}

function getDishFeature(dish) {
  const tags = dish.tags || [];
  const name = dish.name || "";
  if (/粥|汤|羹|盅/.test(name) || tags.includes("粥品") || tags.includes("汤粥") || tags.includes("汤羹")) return "热乎顺口";
  if (/粉|面|粿条|河粉|米线|馄饨|云吞|饺/.test(name) || tags.includes("粉面") || tags.includes("面食")) return "直接顶饱";
  if (/虾|蟹|蚝|鱼|贝|海参|螺|鱿/.test(name) || tags.includes("海鲜")) return "鲜味更足";
  if (/火锅|锅|煲|边炉/.test(name) || tags.includes("火锅")) return "适合慢慢吃";
  if (dish.category === "甜品" || dish.category === "饮品" || tags.includes("甜品") || tags.includes("饮品")) return "给这顿加点轻松感";
  if (/鸡|鸭|鹅|牛|羊|猪|肉|排骨|蹄|鸽/.test(name) || tags.includes("肉类")) return "吃起来更扎实";
  if (dish.category === "小吃") return "不想吃太正式时也合适";
  return "先把饭点定下来";
}

function buildNowReason(dish) {
  const meal = (dish.mealTime || []).slice(0, 2).join("、") || "这一顿";
  const taste = dish.taste || "顺口";
  const feature = getDishFeature(dish);
  return pickStable([
    `${meal}想吃点${taste}的，先选${dish.name}不绕。`,
    `这一顿如果想快点定下来，${dish.name}能给你一个明确方向。`,
    `${dish.name}${feature}，适合现在先拍板。`,
    `现在不想继续纠结的话，${dish.name}可以先接住这一顿。`,
    `胃口偏${taste}时，${dish.name}比随便点一份更稳。`,
    `${meal}没想好吃什么，先从${dish.name}开始也顺。`,
    `${dish.name}不算难选，适合把饭点从“再看看”拉回来。`,
    `想吃${dish.category || "本地味"}的时候，${dish.name}可以先定下来。`
  ], `${dish.city}|${dish.name}|now`);
}

function buildFitText(dish) {
  const scenes = (dish.scene || []).filter(Boolean);
  if (scenes.length) {
    const sceneText = scenes.slice(0, 3).join("、");
    return pickStable([
      `适合${sceneText}，不用凑很复杂的一桌。`,
      `${sceneText}都能安排，点起来不太挑场景。`,
      `如果是${sceneText}，这道放进这一顿不突兀。`,
      `${sceneText}想少点纠结，可以先把它当作方向。`,
      `这道对${sceneText}比较友好，饭点不会太难收场。`
    ], `${dish.city}|${dish.name}|fit`);
  }
  return pickStable([
    "适合想快速定下一顿的人，先有一个选择就好办。",
    "不确定吃什么时，它可以先当一个稳妥答案。",
    "如果只是想让饭点快点有方向，这道够用了。",
    "不用把这顿想太复杂，先定它也说得过去。"
  ], `${dish.city}|${dish.name}|fit-default`);
}

function buildCautionText(dish) {
  const avoidTags = (dish.avoidTags || []).filter(Boolean);
  if (avoidTags.length) {
    const avoidText = avoidTags.slice(0, 3).join("、");
    return pickStable([
      `如果介意${avoidText}，点之前再确认一下做法。`,
      `有${avoidText}顾虑的话，先问清楚食材更稳。`,
      `不太吃${avoidText}的人，可以把它放到备选后面。`,
      `如果今天想避开${avoidText}，再转一次会更省心。`
    ], `${dish.city}|${dish.name}|caution`);
  }
  return pickStable([
    "没有明显避雷标签，口味还是以实际做法为准。",
    "忌口不多的话，可以放心把它放进选择里。",
    "如果没有特别忌口，这道不用太担心。",
    "点之前按个人口味确认一下就行。"
  ], `${dish.city}|${dish.name}|caution-default`);
}

function buildFitNotes(dish) {
  return [
    buildNowReason(dish),
    buildFitText(dish),
    buildCautionText(dish)
  ];
}

Page({
  data: {
    dish: null,
    rating: "",
    favorited: false,
    favoriteText: "\u6536\u85cf\u8d77\u6765",
    fitNotes: [],
    relatedDishes: [],
    dishSheetVisible: false,
    detailDish: null,
    sourceFilters: {}
  },

  onLoad(query) {
    this.setData({ sourceFilters: getSourceFilters(query || {}) });
    this.loadDish(query.id);
  },

  loadDish(id) {
    const dish = getDishById(id);
    if (!dish) {
      wx.showToast({ title: "结果不存在", icon: "none" });
      return;
    }
    const relatedDishes = buildRelatedDishes(dish);
    storage.addUnique("historyDishIds", dish.id);
    this.setData({
      dish,
      rating: iconRating(dish.localIndex, dish),
      favorited: storage.hasItem("favoriteDishIds", dish.id),
      favoriteText: storage.hasItem("favoriteDishIds", dish.id) ? "\u5df2\u7ecf\u6536\u597d" : "\u6536\u85cf\u8d77\u6765",
      fitNotes: buildFitNotes(dish),
      relatedDishes
    });
  },

  onFavorite() {
    const key = "favoriteDishIds";
    if (this.data.favorited) {
      storage.removeItem(key, this.data.dish.id);
    } else {
      storage.addUnique(key, this.data.dish.id);
    }
    const favorited = !this.data.favorited;
    this.setData({
      favorited,
      favoriteText: favorited ? "\u5df2\u7ecf\u6536\u597d" : "\u6536\u85cf\u8d77\u6765"
    });
  },

  onAcceptDish() {
    const dish = this.data.dish;
    if (!dish) return;
    wx.setClipboardData({
      data: dish.name,
      success: () => {
        wx.showToast({ title: "菜名已复制，去地图或外卖搜搜", icon: "none" });
      },
      fail: (error) => {
        console.error("复制菜名失败", error);
        wx.showToast({ title: "\u590d\u5236\u5931\u8d25", icon: "none" });
      }
    });
  },

  onSpinAgain() {
    const dish = this.data.dish;
    wx.redirectTo({
      url: buildSpinAgainUrl(dish, this.data.sourceFilters)
    });
  },

  onCreatePoll() {
    const dish = this.data.dish;
    wx.navigateTo({
      url: `/pages/poll-create/poll-create?ids=${encodeURIComponent(dish.id)}&city=${encodeURIComponent(dish.city)}`
    });
  },

  onOpenRelated(event) {
    const { id } = event.currentTarget.dataset;
    const detailDish = this.data.relatedDishes.find((item) => item.id === id) || getDishById(id);
    if (!detailDish) return;
    this.setData({
      detailDish,
      dishSheetVisible: true
    });
  },

  onCloseDishSheet() {
    this.setData({ dishSheetVisible: false });
  },

  onFeedback() {
    wx.navigateTo({ url: `/pages/feedback/feedback?dishId=${this.data.dish.id}` });
  },

  onShareAppMessage() {
    const dish = this.data.dish;
    return {
      title: `${dish.phrase} 我转到了${dish.name}`,
      path: `/pages/result/result?id=${dish.id}`
    };
  }
});
