const app = getApp();
const { searchDishes } = require("../../services/dish");

function getSourceInfo(dish, currentCity) {
  if (dish.city === currentCity && dish.sourceBucket === "cityExact") {
    return { sourceLabel: "当前城市", sourceClass: "current" };
  }
  if (dish.sourceBucket === "cityExact") {
    return { sourceLabel: "本地特色", sourceClass: "local" };
  }
  if (dish.sourceBucket === "provinceShared" || dish.sourceBucket === "regionalShared") {
    return { sourceLabel: "省内参考", sourceClass: "province" };
  }
  if (dish.sourceBucket === "nationalGeneral") {
    return { sourceLabel: "常见菜", sourceClass: "common" };
  }
  return { sourceLabel: "推荐", sourceClass: "local" };
}

function getDishScore(dish, currentCity) {
  let score = 0;
  if (dish.city === currentCity) score += 1000;
  if (dish.sourceBucket === "cityExact") score += 400;
  if (dish.sourceBucket === "regionalShared") score += 220;
  if (dish.sourceBucket === "provinceShared") score += 180;
  if (dish.sourceBucket === "nationalGeneral") score -= 200;
  score += (dish.localIndex || 0) * 20;
  score += dish.weight || 0;
  return score;
}

function groupResults(list, currentCity) {
  const groups = {};
  list.forEach((dish) => {
    if (!groups[dish.name]) groups[dish.name] = [];
    groups[dish.name].push(dish);
  });

  return Object.keys(groups).map((name) => {
    const items = groups[name];
    const sorted = items.slice().sort((a, b) => {
      return getDishScore(b, currentCity) - getDishScore(a, currentCity);
    });
    const main = sorted[0];
    const cities = Array.from(new Set(items.map((dish) => dish.city)));
    return Object.assign({}, main, getSourceInfo(main, currentCity), {
      cityLabel: cities.length > 1 ? `${main.city}等${cities.length}地` : main.city,
      duplicateCount: cities.length,
      cityDisplay: cities.length > 1 ? `${main.city}\u7b49${cities.length}\u5730` : main.city,
      showDuplicate: cities.length > 1,
      score: getDishScore(main, currentCity)
    });
  }).sort((a, b) => b.score - a.score);
}

Page({
  data: {
    keyword: "",
    results: [],
    resultsEmpty: true,
    dishSheetVisible: false,
    detailDish: null,
    hotTags: ["火锅", "粥", "粉面", "海鲜", "早餐", "夜宵", "清淡", "重口"]
  },

  updateResults(keyword) {
    const currentCity = app.globalData.currentCity;
    const results = groupResults(searchDishes(keyword), currentCity);
    this.setData({
      keyword,
      results,
      resultsEmpty: !results.length
    });
  },

  onInput(event) {
    this.updateResults(event.detail.value);
  },

  onTapHot(event) {
    this.updateResults(event.currentTarget.dataset.value);
  },

  onOpenDish(event) {
    const { id } = event.currentTarget.dataset;
    const detailDish = this.data.results.find((dish) => dish.id === id);
    if (!detailDish) return;
    this.setData({
      detailDish,
      dishSheetVisible: true
    });
  },

  onCloseDishSheet() {
    this.setData({ dishSheetVisible: false });
  }
});
