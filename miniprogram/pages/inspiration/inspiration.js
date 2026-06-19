const app = getApp();
const { getCity, getDishesByCity, ensureProvinceLoaded, attachDishIllustration } = require("../../services/dish");
const homeMealPools = require("../../data/home-meal-pools");

const mealOptions = [
  { key: "早餐", icon: "🥟", title: "早餐" },
  { key: "午餐", icon: "🍚", title: "午餐" },
  { key: "晚餐", icon: "🍲", title: "晚餐" },
  { key: "夜宵", icon: "🌙", title: "宵夜" }
];

const heroCopies = {
  早餐: "早上先找顺口、热乎、能垫住的一口。",
  午餐: "中午别把时间都花在纠结上，先看能吃饱的。",
  晚餐: "晚上可以慢慢挑，但先让胃口有个方向。",
  夜宵: "夜里想解馋，先看轻松一点的选择。"
};

function normalizeMeal(meal) {
  return meal === "夜宵" ? "宵夜" : meal;
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

function buildMealOptions(selectedMeal) {
  return mealOptions.map((item) => Object.assign({}, item, {
    className: item.key === selectedMeal ? "active" : ""
  }));
}

function dishMatchesMeal(dish, selectedMeal) {
  return (dish.mealTime || []).includes(normalizeMeal(selectedMeal));
}

function isGenericNightSnack(dish) {
  const name = dish.name || "";
  const meals = dish.mealTime || [];
  if (!meals.includes("宵夜") && !meals.includes("夜宵")) return false;
  if (/^(烤|炸|凉拌|卤|香辣|爆炒|蛋炒|扬州炒|腊肠炒)/.test(name)) return true;
  return /烤茄子|凉拌青瓜|凉拌黄瓜|烤韭菜|烤玉米|烤金针菇|烤面筋|炸豆腐|炸薯条|关东煮|麻辣拌/.test(name);
}

function sourceLabel(dish) {
  if (dish.sourceBucket === "mealPool" || isGenericNightSnack(dish)) return "餐段灵感";
  if (dish.sourceBucket === "cityExact") return "本地美食";
  if (dish.sourceBucket === "nationalGeneral") return "常见美食";
  return "省内美食";
}

function normalizeMealDishKey(name) {
  return String(name || "")
    .replace(/[\s·・,，。.（）()【】[\]“”"']/g, "")
    .replace(/^(广东|广式|港式|老式|传统|特色|鲜虾|虾仁|猪肉|牛肉|鸡蛋)/, "")
    .replace(/皇$/, "");
}

function hashText(text) {
  let hash = 0;
  for (let index = 0; index < text.length; index += 1) {
    hash = ((hash << 5) - hash + text.charCodeAt(index)) >>> 0;
  }
  return hash.toString(36);
}

function getMealPoolKey(selectedMeal) {
  if (selectedMeal === "早餐") return "breakfast";
  if (selectedMeal === "夜宵") return "lateNight";
  return "";
}

function makeMealPoolDish(item, selectedMeal, cityName, index) {
  const normalizedMeal = normalizeMeal(selectedMeal);
  const tags = item.tags || [];
  const avoidTags = item.avoidTags || [];
  return attachDishIllustration({
    id: `inspiration_${getMealPoolKey(selectedMeal)}_${hashText(`${cityName}|${item.name}`)}`,
    city: cityName,
    province: "",
    name: item.name,
    category: item.category || "小吃",
    taste: item.taste || "鲜香",
    mealTime: [normalizedMeal],
    scene: ["一个人", "两个人"],
    avoidTags: avoidTags.slice(),
    tags: tags.slice(),
    localIndex: 0,
    iconType: "bowl",
    weight: item.weight || 6,
    sourceBucket: "mealPool",
    order: index,
    phrase: item.phrase || (selectedMeal === "早餐" ? `${item.name}适合早上先垫一口。` : `${item.name}适合夜里解个馋。`),
    description: item.description || `${normalizedMeal}想吃点顺口的，可以看看${item.name}。`,
    truthNotes: [
      item.description || `${item.name}适合${normalizedMeal}。`,
      avoidTags.length ? `介意${avoidTags.slice(0, 3).join("、")}的话，换一个更稳。` : "具体口味和分量看店家做法。",
      selectedMeal === "早餐" ? "早餐专属备选" : "宵夜专属备选"
    ],
    pollText: `${item.name}要不要放进这顿？想吃就投一票。`
  });
}

function decorateDish(dish, index) {
  const tags = [];
  if ((dish.mealTime || []).length) tags.push((dish.mealTime || [])[0]);
  if ((dish.scene || []).includes("一个人")) tags.push("一人也行");
  if ((dish.scene || []).includes("朋友聚餐")) tags.push("聚餐可点");
  (dish.tags || []).slice(0, 3).forEach((tag) => {
    if (!tags.includes(tag)) tags.push(tag);
  });
  return Object.assign({}, dish, {
    sourceLabel: sourceLabel(dish),
    displayTags: tags.slice(0, 4),
    cardClass: index === 0 ? "large" : ""
  });
}

function getLocalMealDishes(cityName, selectedMeal) {
  const city = getCity(cityName);
  return getDishesByCity(city.name).filter((dish) => (
    dish.sourceBucket === "cityExact" &&
    dish.city === city.name &&
    dishMatchesMeal(dish, selectedMeal)
  ));
}

function getFallbackMealDishes(cityName, selectedMeal) {
  const city = getCity(cityName);
  return getDishesByCity(city.name).filter((dish) => (
    dish.sourceBucket !== "cityExact" &&
    dishMatchesMeal(dish, selectedMeal) &&
    (dish.city === city.name || dish.province === city.province)
  ));
}

function getMealPoolDishes(selectedMeal, cityName) {
  const pool = homeMealPools[getMealPoolKey(selectedMeal)] || [];
  return shuffle(pool).map((item, index) => makeMealPoolDish(item, selectedMeal, cityName, index));
}

function takeUnique(target, list, limit) {
  const used = {};
  target.forEach((dish) => {
    used[normalizeMealDishKey(dish.name)] = true;
  });
  list.forEach((dish) => {
    const key = normalizeMealDishKey(dish.name);
    if (target.length >= limit || !dish || used[key]) return;
    used[key] = true;
    target.push(dish);
  });
}

function recentStorageKey(cityName, selectedMeal) {
  return `recentInspiration:${cityName}:${selectedMeal}`;
}

function getRecentInspirationNames(cityName, selectedMeal) {
  const list = wx.getStorageSync(recentStorageKey(cityName, selectedMeal));
  return Array.isArray(list) ? list : [];
}

function saveRecentInspirationNames(cityName, selectedMeal, dishes) {
  const previous = getRecentInspirationNames(cityName, selectedMeal);
  const names = dishes.map((dish) => dish.name).filter(Boolean).concat(previous);
  const used = {};
  const next = [];
  names.forEach((name) => {
    if (used[name] || next.length >= 18) return;
    used[name] = true;
    next.push(name);
  });
  wx.setStorageSync(recentStorageKey(cityName, selectedMeal), next);
}

function orderByRecentWeight(list, recentNames) {
  const recentMap = recentNames.reduce((map, name, index) => {
    map[name] = index + 1;
    return map;
  }, {});
  return shuffle(list).sort((a, b) => {
    const aPenalty = recentMap[a.name] || 0;
    const bPenalty = recentMap[b.name] || 0;
    return aPenalty - bPenalty;
  });
}

function buildDishes(cityName, selectedMeal) {
  const selected = [];
  const recentNames = getRecentInspirationNames(cityName, selectedMeal);
  takeUnique(selected, orderByRecentWeight(getLocalMealDishes(cityName, selectedMeal), recentNames), 5);
  if (selectedMeal === "早餐" || selectedMeal === "夜宵") {
    takeUnique(selected, orderByRecentWeight(getMealPoolDishes(selectedMeal, cityName), recentNames), 5);
  } else {
    takeUnique(selected, orderByRecentWeight(getFallbackMealDishes(cityName, selectedMeal), recentNames), 5);
  }
  const dishes = selected.slice(0, 5).map(decorateDish);
  saveRecentInspirationNames(cityName, selectedMeal, dishes);
  return dishes;
}

Page({
  data: {
    city: "广州",
    selectedMeal: "午餐",
    mealOptions: buildMealOptions("午餐"),
    heroCopy: heroCopies["午餐"],
    dishes: [],
    emptyVisible: true,
    dishSheetVisible: false,
    detailDish: null
  },

  onShow() {
    if (this.__citySelectionHandled) {
      this.__citySelectionHandled = false;
      return;
    }
    const city = app.globalData.currentCity || this.data.city || "广州";
    this.refresh(city, this.data.selectedMeal);
  },

  refresh(cityName, selectedMeal) {
    const city = getCity(cityName);
    const requestId = (this.__cityLoadRequestId || 0) + 1;
    this.__cityLoadRequestId = requestId;
    return ensureProvinceLoaded(city.province).then(() => {
      if (requestId !== this.__cityLoadRequestId) return;
      const dishes = buildDishes(city.name, selectedMeal);
      this.setData({
        city: city.name,
        selectedMeal,
        mealOptions: buildMealOptions(selectedMeal),
        heroCopy: heroCopies[selectedMeal] || heroCopies["午餐"],
        dishes,
        emptyVisible: !dishes.length
      });
    });
  },

  onSelectMeal(event) {
    this.refresh(this.data.city, event.currentTarget.dataset.meal);
  },

  onChooseCity() {
    wx.navigateTo({ url: "/pages/city/city" });
  },

  onOpenDish(event) {
    const detailDish = this.data.dishes.find((dish) => dish.id === event.currentTarget.dataset.id);
    if (!detailDish) return;
    this.setData({
      dishSheetVisible: false,
      detailDish
    }, () => {
      this.setData({ dishSheetVisible: true });
    });
  },

  onCloseDishSheet() {
    this.setData({ dishSheetVisible: false });
  },

  onStartSpin() {
    const spinDishes = this.data.dishes.map((dish) => {
      const copy = Object.assign({}, dish);
      delete copy.cardClass;
      delete copy.displayTags;
      delete copy.sourceLabel;
      return copy;
    });
    const inspirationSpinKey = `inspiration-${Date.now()}`;
    wx.setStorageSync("inspirationSpinDishes", {
      key: inspirationSpinKey,
      city: this.data.city,
      mealTime: this.data.selectedMeal,
      dishes: spinDishes
    });
    wx.navigateTo({
      url: `/pages/spin/spin?city=${encodeURIComponent(this.data.city)}&mealTime=${encodeURIComponent(this.data.selectedMeal)}&inspirationKey=${encodeURIComponent(inspirationSpinKey)}`
    });
  }
});
