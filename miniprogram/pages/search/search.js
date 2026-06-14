const app = getApp();
const { searchDishes } = require("../../services/dish");

function groupResults(list, currentCity) {
  const groups = {};
  list.forEach((dish) => {
    if (!groups[dish.name]) groups[dish.name] = [];
    groups[dish.name].push(dish);
  });

  return Object.keys(groups).map((name) => {
    const items = groups[name];
    const sorted = items.slice().sort((a, b) => {
      if (a.city === currentCity && b.city !== currentCity) return -1;
      if (a.city !== currentCity && b.city === currentCity) return 1;
      if (a.sourceBucket === "cityExact" && b.sourceBucket !== "cityExact") return -1;
      if (a.sourceBucket !== "cityExact" && b.sourceBucket === "cityExact") return 1;
      return (b.localIndex || 0) - (a.localIndex || 0);
    });
    const main = sorted[0];
    const cities = Array.from(new Set(items.map((dish) => dish.city)));
    return Object.assign({}, main, {
      cityLabel: cities.length > 1 ? `${main.city}等${cities.length}地` : main.city,
      duplicateCount: cities.length,
      cityDisplay: cities.length > 1 ? `${main.city}\u7b49${cities.length}\u5730` : main.city,
      showDuplicate: cities.length > 1
    });
  });
}

Page({
  data: {
    keyword: "",
    results: [],
    resultsEmpty: true,
    dishSheetVisible: false,
    detailDish: null,
    hotTags: ["宵夜", "甜品", "不吃辣", "海鲜", "早餐", "牛肉"]
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
