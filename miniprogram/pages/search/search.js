const app = getApp();
const { getCity, searchDishes } = require("../../services/dish");

const nearbyCityMap = {
  广州: ["佛山", "东莞", "中山", "清远", "肇庆", "深圳"],
  深圳: ["东莞", "惠州", "广州", "珠海", "佛山"],
  佛山: ["广州", "中山", "江门", "肇庆", "东莞"],
  东莞: ["广州", "深圳", "惠州", "佛山", "中山"],
  汕尾: ["揭阳", "汕头", "惠州", "深圳", "潮州"],
  汕头: ["潮州", "揭阳", "汕尾", "梅州"],
  潮州: ["汕头", "揭阳", "汕尾", "梅州"],
  揭阳: ["汕头", "潮州", "汕尾", "梅州"],
  惠州: ["深圳", "东莞", "汕尾", "广州", "河源"],
  珠海: ["中山", "江门", "深圳", "广州", "佛山"],
  中山: ["珠海", "江门", "佛山", "广州", "东莞"],
  江门: ["中山", "珠海", "佛山", "阳江", "广州"],
  肇庆: ["佛山", "广州", "云浮", "清远", "江门"],
  清远: ["广州", "韶关", "肇庆", "佛山"],
  韶关: ["清远", "广州", "河源"],
  河源: ["惠州", "梅州", "韶关", "东莞"],
  梅州: ["河源", "揭阳", "潮州", "汕头"],
  阳江: ["江门", "茂名", "云浮", "肇庆"],
  茂名: ["湛江", "阳江", "云浮"],
  湛江: ["茂名", "阳江"],
  云浮: ["肇庆", "阳江", "茂名", "佛山"]
};

function getNearbyIndex(cityName, targetCity) {
  const nearby = nearbyCityMap[cityName] || [];
  const index = nearby.indexOf(targetCity);
  return index >= 0 ? index : -1;
}

function getSearchTier(dish, currentCity, currentProvince) {
  if (dish.city === currentCity && dish.sourceBucket === "cityExact") return 5;
  if (dish.sourceBucket === "cityExact" && getNearbyIndex(currentCity, dish.city) >= 0) return 4;
  if (dish.sourceBucket === "cityExact" && dish.province === currentProvince) return 3;
  if (
    dish.province === currentProvince &&
    (dish.sourceBucket === "regionalShared" || dish.sourceBucket === "provinceShared")
  ) return 2;
  if (dish.sourceBucket === "cityExact") return 1;
  return 0;
}

function getSourceInfo(dish, currentCity) {
  if (dish.city === currentCity && dish.sourceBucket === "cityExact") {
    return { sourceLabel: "本地特色", sourceClass: "current" };
  }
  if (dish.sourceBucket === "cityExact" && getNearbyIndex(currentCity, dish.city) >= 0) {
    return { sourceLabel: "附近可试", sourceClass: "nearby" };
  }
  const currentProvince = getCity(currentCity).province;
  if (dish.sourceBucket === "cityExact" && dish.province === currentProvince) {
    return { sourceLabel: "省内风味", sourceClass: "local" };
  }
  if (
    dish.province === currentProvince &&
    (dish.sourceBucket === "provinceShared" || dish.sourceBucket === "regionalShared")
  ) {
    return { sourceLabel: "周边参考", sourceClass: "province" };
  }
  if (dish.sourceBucket === "cityExact") {
    return { sourceLabel: "外地风味", sourceClass: "common" };
  }
  if (dish.sourceBucket === "nationalGeneral") {
    return { sourceLabel: "常见菜", sourceClass: "common" };
  }
  return { sourceLabel: "外地参考", sourceClass: "common" };
}

function getDishScore(dish, currentCity) {
  const currentProvince = getCity(currentCity).province;
  const tier = getSearchTier(dish, currentCity, currentProvince);
  const nearbyIndex = getNearbyIndex(currentCity, dish.city);
  let score = 0;
  score += tier * 1000;
  if (nearbyIndex >= 0) score += 160 - nearbyIndex * 18;
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
    const currentCity = app.globalData.currentCity || "广州";
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
