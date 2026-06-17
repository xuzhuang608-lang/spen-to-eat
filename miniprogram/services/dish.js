const provinceIndex = require("../data/provinces/index");
const { cities, provinces } = require("../data/national-cities");
const { weightedPick } = require("../utils/random");

const provinceDataMap = {
  anhui: require("../data/provinces/anhui"),
  aomen: require("../data/provinces/aomen"),
  beijing: require("../data/provinces/beijing"),
  chongqing: require("../data/provinces/chongqing"),
  fujian: require("../data/provinces/fujian"),
  gansu: require("../data/provinces/gansu"),
  guangdong: require("../data/provinces/guangdong"),
  guangxi: require("../data/provinces/guangxi"),
  guizhou: require("../data/provinces/guizhou"),
  hainan: require("../data/provinces/hainan"),
  hebei: require("../data/provinces/hebei"),
  heilongjiang: require("../data/provinces/heilongjiang"),
  henan: require("../data/provinces/henan"),
  hubei: require("../data/provinces/hubei"),
  hunan: require("../data/provinces/hunan"),
  jiangsu: require("../data/provinces/jiangsu"),
  jiangxi: require("../data/provinces/jiangxi"),
  jilin: require("../data/provinces/jilin"),
  liaoning: require("../data/provinces/liaoning"),
  neimenggu: require("../data/provinces/neimenggu"),
  ningxia: require("../data/provinces/ningxia"),
  qinghai: require("../data/provinces/qinghai"),
  shaanxi: require("../data/provinces/shaanxi"),
  shandong: require("../data/provinces/shandong"),
  shanghai: require("../data/provinces/shanghai"),
  shanxi: require("../data/provinces/shanxi"),
  sichuan: require("../data/provinces/sichuan"),
  taiwan: require("../data/provinces/taiwan"),
  tianjin: require("../data/provinces/tianjin"),
  xianggang: require("../data/provinces/xianggang"),
  xinjiang: require("../data/provinces/xinjiang"),
  xizang: require("../data/provinces/xizang"),
  yunnan: require("../data/provinces/yunnan"),
  zhejiang: require("../data/provinces/zhejiang")
};

const dictionary = provinceIndex.dictionaries;
const slugByProvince = provinceIndex.provinces.reduce((map, province) => {
  map[province.province] = province.slug;
  return map;
}, {});

const NON_CITY_MARKERS = [
  "\u884c\u653f\u533a\u5212",
  "\u76f4\u8f96\u53bf\u7ea7",
  "\u7701\u76f4\u8f96",
  "\u81ea\u6cbb\u533a\u76f4\u8f96"
];

function isSelectableCity(city) {
  const text = [city.name, city.fullName].filter(Boolean).join("");
  return !NON_CITY_MARKERS.some((marker) => text.includes(marker));
}

function cleanProvince(province) {
  return Object.assign({}, province, {
    cities: province.cities.filter(isSelectableCity)
  });
}

const selectableCities = cities.filter(isSelectableCity);
const selectableProvinces = provinces
  .map(cleanProvince)
  .filter((province) => province.cities.length);

const cityByName = selectableCities.reduce((map, city) => {
  map[city.name] = city;
  map[city.fullName] = city;
  return map;
}, {});

const selectableCityNames = selectableCities
  .map((city) => city.name)
  .filter((name) => name && name.length >= 2)
  .sort((a, b) => b.length - a.length);

const citySlogans = {};
const dishesByCity = {};
const dishById = {};
let allDishes = null;

const MIN_CANDIDATE_COUNT = 8;
const ANY_FILTER = "\u4e0d\u9650";
const DISH_NAME_REPLACEMENTS = {
  "\u5ba2\u5bb6\u76d0\u7117\u9e21\u9996\u9009": "\u5ba2\u5bb6\u76d0\u7117\u9e21"
};
const INVALID_DISH_NAMES = {
  "\u7c73\u7ca5\u505a\u9505\u5e95": true,
  "\u6d77\u9c9c": true,
  "\u672c\u5730\u9e21": true,
  "\u7ca5\u7c7b": true
};
const PLACE_NAME_ALLOWED_CITIES = {
  "\u5b9d\u5b89": ["\u6df1\u5733"],
  "\u987a\u5fb7": ["\u4f5b\u5c71"]
};
const DISH_FIELD_OVERRIDES = {
  "\u7092\u7cd5\u7cbf": {
    category: "\u5c0f\u5403",
    taste: "\u9c9c\u9999",
    mealTime: ["\u5348\u9910", "\u665a\u9910"],
    tags: ["\u5c0f\u5403", "\u4e0b\u996d"],
    iconType: "bowl"
  }
};
const SOURCE_BUCKET_PRIORITY = {
  cityExact: 4,
  regionalShared: 3,
  provinceShared: 2,
  nationalGeneral: 1
};
const FOOD_ILLUSTRATIONS = {
  meal: "/assets/food-categories/meal.png",
  snack: "/assets/food-categories/snack.png",
  dessert: "/assets/food-categories/dessert.png",
  drink: "/assets/food-categories/drink.png",
  seafood: "/assets/food-categories/seafood.png",
  noodle: "/assets/food-categories/noodle.png",
  hotpot: "/assets/food-categories/hotpot.png",
  meat: "/assets/food-categories/meat.png"
};
const NATIONAL_FALLBACK_TEMPLATES = [
  { name: "\u8c46\u6d46", category: "\u996e\u54c1", taste: "\u6e05\u6de1", mealTime: ["\u65e9\u9910", "\u5348\u9910"], scene: ["\u4e00\u4e2a\u4eba", "\u4e24\u4e2a\u4eba"], avoidTags: [], tags: ["\u65e9\u9910", "\u996e\u54c1"], iconType: "bowl", weight: 4 },
  { name: "\u6cb9\u6761", category: "\u5c0f\u5403", taste: "\u9c9c\u9999", mealTime: ["\u65e9\u9910", "\u5348\u9910"], scene: ["\u4e00\u4e2a\u4eba", "\u4e24\u4e2a\u4eba"], avoidTags: [], tags: ["\u65e9\u9910", "\u5c0f\u5403"], iconType: "bowl", weight: 4 },
  { name: "\u5305\u5b50", category: "\u5c0f\u5403", taste: "\u9c9c\u9999", mealTime: ["\u65e9\u9910", "\u5348\u9910"], scene: ["\u4e00\u4e2a\u4eba", "\u4e24\u4e2a\u4eba"], avoidTags: [], tags: ["\u65e9\u9910", "\u5c0f\u5403"], iconType: "bowl", weight: 4 },
  { name: "\u5c0f\u7b3c\u5305", category: "\u5c0f\u5403", taste: "\u9c9c\u9999", mealTime: ["\u65e9\u9910", "\u5348\u9910"], scene: ["\u4e00\u4e2a\u4eba", "\u4e24\u4e2a\u4eba"], avoidTags: [], tags: ["\u65e9\u9910", "\u5c0f\u5403"], iconType: "bowl", weight: 4 },
  { name: "\u767d\u7ca5", category: "\u5c0f\u5403", taste: "\u6e05\u6de1", mealTime: ["\u65e9\u9910", "\u5348\u9910"], scene: ["\u4e00\u4e2a\u4eba", "\u4e24\u4e2a\u4eba"], avoidTags: [], tags: ["\u65e9\u9910"], iconType: "bowl", weight: 4 },
  { name: "\u76ae\u86cb\u7626\u8089\u7ca5", category: "\u5c0f\u5403", taste: "\u9c9c\u9999", mealTime: ["\u65e9\u9910", "\u5348\u9910", "\u665a\u9910"], scene: ["\u4e00\u4e2a\u4eba", "\u4e24\u4e2a\u4eba"], avoidTags: ["\u8089\u7c7b"], tags: ["\u65e9\u9910", "\u8089\u7c7b"], iconType: "bowl", weight: 4 },
  { name: "\u80a0\u7c89", category: "\u5c0f\u5403", taste: "\u6e05\u6de1", mealTime: ["\u65e9\u9910", "\u5348\u9910"], scene: ["\u4e00\u4e2a\u4eba", "\u4e24\u4e2a\u4eba"], avoidTags: [], tags: ["\u65e9\u9910", "\u5c0f\u5403"], iconType: "bowl", weight: 4 },
  { name: "\u70e7\u5356", category: "\u5c0f\u5403", taste: "\u9c9c\u9999", mealTime: ["\u65e9\u9910", "\u5348\u9910"], scene: ["\u4e00\u4e2a\u4eba", "\u4e24\u4e2a\u4eba"], avoidTags: [], tags: ["\u65e9\u9910", "\u5c0f\u5403"], iconType: "bowl", weight: 4 },
  { name: "\u6c64\u9762", category: "\u5c0f\u5403", taste: "\u9c9c\u9999", mealTime: ["\u65e9\u9910", "\u5348\u9910", "\u665a\u9910", "\u5bb5\u591c"], scene: ["\u4e00\u4e2a\u4eba", "\u4e24\u4e2a\u4eba"], avoidTags: [], tags: ["\u5c0f\u5403"], iconType: "bowl", weight: 4 },
  { name: "\u9984\u9968", category: "\u5c0f\u5403", taste: "\u9c9c\u9999", mealTime: ["\u65e9\u9910", "\u5348\u9910", "\u665a\u9910", "\u5bb5\u591c"], scene: ["\u4e00\u4e2a\u4eba", "\u4e24\u4e2a\u4eba"], avoidTags: [], tags: ["\u5c0f\u5403"], iconType: "bowl", weight: 4 },
  { name: "\u86cb\u7092\u996d", category: "\u6b63\u9910", taste: "\u9c9c\u9999", mealTime: ["\u5348\u9910", "\u665a\u9910", "\u5bb5\u591c"], scene: ["\u4e00\u4e2a\u4eba", "\u4e24\u4e2a\u4eba"], avoidTags: [], tags: ["\u4e0b\u996d"], iconType: "bowl", weight: 4 },
  { name: "\u756a\u8304\u7092\u86cb", category: "\u6b63\u9910", taste: "\u9c9c\u9999", mealTime: ["\u5348\u9910", "\u665a\u9910"], scene: ["\u4e00\u4e2a\u4eba", "\u4e24\u4e2a\u4eba"], avoidTags: [], tags: ["\u4e0b\u996d"], iconType: "bowl", weight: 4 },
  { name: "\u5bb6\u5e38\u8c46\u8150", category: "\u6b63\u9910", taste: "\u9c9c\u9999", mealTime: ["\u5348\u9910", "\u665a\u9910"], scene: ["\u4e00\u4e2a\u4eba", "\u4e24\u4e2a\u4eba"], avoidTags: [], tags: ["\u4e0b\u996d"], iconType: "bowl", weight: 4 },
  { name: "\u9c7c\u9999\u8089\u4e1d", category: "\u6b63\u9910", taste: "\u9c9c\u9999", mealTime: ["\u5348\u9910", "\u665a\u9910"], scene: ["\u4e00\u4e2a\u4eba", "\u4e24\u4e2a\u4eba"], avoidTags: ["\u8089\u7c7b"], tags: ["\u8089\u7c7b"], iconType: "bowl", weight: 4 },
  { name: "\u5bab\u4fdd\u9e21\u4e01", category: "\u6b63\u9910", taste: "\u91cd\u53e3", mealTime: ["\u5348\u9910", "\u665a\u9910"], scene: ["\u4e24\u4e2a\u4eba", "\u670b\u53cb\u805a\u9910"], avoidTags: ["\u8fa3", "\u8089\u7c7b"], tags: ["\u8089\u7c7b"], iconType: "chili", weight: 4 },
  { name: "\u7ea2\u70e7\u6392\u9aa8", category: "\u6b63\u9910", taste: "\u9c9c\u9999", mealTime: ["\u5348\u9910", "\u665a\u9910"], scene: ["\u4e24\u4e2a\u4eba", "\u670b\u53cb\u805a\u9910"], avoidTags: ["\u8089\u7c7b"], tags: ["\u8089\u7c7b"], iconType: "flame", weight: 4 },
  { name: "\u7092\u6cb3\u7c89", category: "\u5c0f\u5403", taste: "\u9c9c\u9999", mealTime: ["\u5348\u9910", "\u665a\u9910", "\u5bb5\u591c"], scene: ["\u4e00\u4e2a\u4eba", "\u4e24\u4e2a\u4eba"], avoidTags: [], tags: ["\u5c0f\u5403"], iconType: "bowl", weight: 4 },
  { name: "\u725b\u8089\u9762", category: "\u6b63\u9910", taste: "\u9c9c\u9999", mealTime: ["\u5348\u9910", "\u665a\u9910", "\u5bb5\u591c"], scene: ["\u4e00\u4e2a\u4eba", "\u4e24\u4e2a\u4eba"], avoidTags: ["\u8089\u7c7b"], tags: ["\u8089\u7c7b"], iconType: "bowl", weight: 4 },
  { name: "\u4e91\u541e\u9762", category: "\u5c0f\u5403", taste: "\u9c9c\u9999", mealTime: ["\u65e9\u9910", "\u5348\u9910", "\u665a\u9910", "\u5bb5\u591c"], scene: ["\u4e00\u4e2a\u4eba", "\u4e24\u4e2a\u4eba"], avoidTags: [], tags: ["\u5c0f\u5403"], iconType: "bowl", weight: 4 },
  { name: "\u7802\u9505\u7ca5", category: "\u5c0f\u5403", taste: "\u6e05\u6de1", mealTime: ["\u65e9\u9910", "\u5348\u9910", "\u665a\u9910", "\u5bb5\u591c"], scene: ["\u4e00\u4e2a\u4eba", "\u4e24\u4e2a\u4eba"], avoidTags: [], tags: ["\u5c0f\u5403"], iconType: "bowl", weight: 4 },
  { name: "\u997a\u5b50", category: "\u5c0f\u5403", taste: "\u9c9c\u9999", mealTime: ["\u5348\u9910", "\u665a\u9910", "\u5bb5\u591c"], scene: ["\u4e00\u4e2a\u4eba", "\u4e24\u4e2a\u4eba"], avoidTags: [], tags: ["\u5c0f\u5403"], iconType: "bowl", weight: 4 },
  { name: "\u7172\u4ed4\u996d", category: "\u6b63\u9910", taste: "\u9c9c\u9999", mealTime: ["\u5348\u9910", "\u665a\u9910"], scene: ["\u4e24\u4e2a\u4eba", "\u670b\u53cb\u805a\u9910"], avoidTags: [], tags: ["\u4e0b\u996d"], iconType: "flame", weight: 4 },
  { name: "\u9178\u8fa3\u7c89", category: "\u5c0f\u5403", taste: "\u91cd\u53e3", mealTime: ["\u5348\u9910", "\u665a\u9910", "\u5bb5\u591c"], scene: ["\u4e00\u4e2a\u4eba", "\u4e24\u4e2a\u4eba"], avoidTags: ["\u8fa3"], tags: ["\u5c0f\u5403"], iconType: "chili", weight: 4 },
  { name: "\u9ebb\u8fa3\u70eb", category: "\u6b63\u9910", taste: "\u91cd\u53e3", mealTime: ["\u5348\u9910", "\u665a\u9910", "\u5bb5\u591c"], scene: ["\u4e24\u4e2a\u4eba", "\u670b\u53cb\u805a\u9910"], avoidTags: ["\u8fa3"], tags: ["\u5c0f\u5403"], iconType: "chili", weight: 4 },
  { name: "\u53cc\u76ae\u5976", category: "\u751c\u54c1", taste: "\u751c\u53e3", mealTime: ["\u5348\u9910", "\u665a\u9910", "\u5bb5\u591c"], scene: ["\u4e00\u4e2a\u4eba", "\u4e24\u4e2a\u4eba"], avoidTags: ["\u751c"], tags: ["\u751c\u54c1"], iconType: "bowl", weight: 4 },
  { name: "\u7eff\u8c46\u6c99", category: "\u751c\u54c1", taste: "\u751c\u53e3", mealTime: ["\u5348\u9910", "\u665a\u9910", "\u5bb5\u591c"], scene: ["\u4e00\u4e2a\u4eba", "\u4e24\u4e2a\u4eba"], avoidTags: ["\u751c"], tags: ["\u751c\u54c1"], iconType: "bowl", weight: 4 },
  { name: "\u9178\u6885\u6c64", category: "\u996e\u54c1", taste: "\u751c\u53e3", mealTime: ["\u5348\u9910", "\u665a\u9910", "\u5bb5\u591c"], scene: ["\u4e00\u4e2a\u4eba", "\u4e24\u4e2a\u4eba"], avoidTags: ["\u751c"], tags: ["\u996e\u54c1"], iconType: "bowl", weight: 4 },
  { name: "\u67e0\u6aac\u8336", category: "\u996e\u54c1", taste: "\u751c\u53e3", mealTime: ["\u5348\u9910", "\u665a\u9910", "\u5bb5\u591c"], scene: ["\u4e00\u4e2a\u4eba", "\u4e24\u4e2a\u4eba"], avoidTags: ["\u751c"], tags: ["\u996e\u54c1"], iconType: "bowl", weight: 4 },
  { name: "\u725b\u5976", category: "\u996e\u54c1", taste: "\u6e05\u6de1", mealTime: ["\u65e9\u9910"], scene: ["\u4e00\u4e2a\u4eba", "\u4e24\u4e2a\u4eba"], avoidTags: [], tags: ["\u65e9\u9910", "\u996e\u54c1"], iconType: "bowl", weight: 4 },
  { name: "\u71d5\u9ea6\u5976", category: "\u996e\u54c1", taste: "\u6e05\u6de1", mealTime: ["\u65e9\u9910"], scene: ["\u4e00\u4e2a\u4eba", "\u4e24\u4e2a\u4eba"], avoidTags: [], tags: ["\u65e9\u9910", "\u996e\u54c1"], iconType: "bowl", weight: 4 },
  { name: "\u7c73\u6d46", category: "\u996e\u54c1", taste: "\u6e05\u6de1", mealTime: ["\u65e9\u9910"], scene: ["\u4e00\u4e2a\u4eba", "\u4e24\u4e2a\u4eba"], avoidTags: [], tags: ["\u65e9\u9910", "\u996e\u54c1"], iconType: "bowl", weight: 4 },
  { name: "\u9ed1\u8c46\u6d46", category: "\u996e\u54c1", taste: "\u6e05\u6de1", mealTime: ["\u65e9\u9910"], scene: ["\u4e00\u4e2a\u4eba", "\u4e24\u4e2a\u4eba"], avoidTags: [], tags: ["\u65e9\u9910", "\u996e\u54c1"], iconType: "bowl", weight: 4 },
  { name: "\u7389\u7c73\u6c41", category: "\u996e\u54c1", taste: "\u751c\u53e3", mealTime: ["\u65e9\u9910", "\u5348\u9910"], scene: ["\u4e00\u4e2a\u4eba", "\u4e24\u4e2a\u4eba"], avoidTags: ["\u751c"], tags: ["\u65e9\u9910", "\u996e\u54c1"], iconType: "bowl", weight: 4 },
  { name: "\u82b1\u751f\u6c64", category: "\u996e\u54c1", taste: "\u751c\u53e3", mealTime: ["\u65e9\u9910", "\u5bb5\u591c"], scene: ["\u4e00\u4e2a\u4eba", "\u4e24\u4e2a\u4eba"], avoidTags: ["\u751c"], tags: ["\u65e9\u9910", "\u996e\u54c1"], iconType: "bowl", weight: 4 },
  { name: "\u94f6\u8033\u6c64", category: "\u996e\u54c1", taste: "\u751c\u53e3", mealTime: ["\u65e9\u9910", "\u5bb5\u591c"], scene: ["\u4e00\u4e2a\u4eba", "\u4e24\u4e2a\u4eba"], avoidTags: ["\u751c"], tags: ["\u996e\u54c1"], iconType: "bowl", weight: 4 },
  { name: "\u51c9\u8336", category: "\u996e\u54c1", taste: "\u6e05\u6de1", mealTime: ["\u5348\u9910", "\u665a\u9910", "\u5bb5\u591c"], scene: ["\u4e00\u4e2a\u4eba", "\u4e24\u4e2a\u4eba"], avoidTags: [], tags: ["\u996e\u54c1"], iconType: "bowl", weight: 4 },
  { name: "\u5976\u8336", category: "\u996e\u54c1", taste: "\u751c\u53e3", mealTime: ["\u5348\u9910", "\u665a\u9910", "\u5bb5\u591c"], scene: ["\u4e00\u4e2a\u4eba", "\u4e24\u4e2a\u4eba"], avoidTags: ["\u751c"], tags: ["\u996e\u54c1"], iconType: "bowl", weight: 4 }
];

function hashText(text) {
  let hash = 0;
  for (let index = 0; index < text.length; index += 1) {
    hash = ((hash << 5) - hash + text.charCodeAt(index)) >>> 0;
  }
  return hash.toString(36);
}

function hashIndex(text, length) {
  if (!length) return 0;
  let hash = 0;
  for (let index = 0; index < text.length; index += 1) {
    hash = ((hash << 5) - hash + text.charCodeAt(index)) >>> 0;
  }
  return hash % length;
}

function pickText(list, index, fallback) {
  return list[index] || fallback;
}

function normalizeDishName(name) {
  return DISH_NAME_REPLACEMENTS[name] || name;
}

function makePhrase(dish) {
  const templates = [
    `${dish.city}这一轮，${dish.name}先来露个脸。`,
    `别纠结了，今天让${dish.name}把饭点安排上。`,
    `${dish.name}已就位，适合认真吃一顿。`,
    `这一口交给${dish.name}，饭点刚刚好。`
  ];
  return templates[hashIndex(dish.city + dish.name, templates.length)];
}

function getDishFeature(dish) {
  const tags = dish.tags || [];
  const name = dish.name || "";
  if (/粥|汤|羹|盅/.test(name) || tags.includes("粥品") || tags.includes("汤粥") || tags.includes("汤羹")) {
    return "热乎顺口";
  }
  if (/粉|面|粿条|河粉|米线|馄饨|云吞|饺/.test(name) || tags.includes("粉面") || tags.includes("面食")) {
    return "直接顶饱";
  }
  if (/虾|蟹|蚝|鱼|贝|海参|螺|鱿/.test(name) || tags.includes("海鲜")) {
    return "鲜味更足";
  }
  if (/火锅|锅|煲|边炉/.test(name) || tags.includes("火锅")) {
    return "适合慢慢吃";
  }
  if (dish.category === "甜品" || dish.category === "饮品" || tags.includes("甜品") || tags.includes("饮品")) {
    return "给这顿加点轻松感";
  }
  if (/鸡|鸭|鹅|牛|羊|猪|肉|排骨|蹄|鸽/.test(name) || tags.includes("肉类")) {
    return "吃起来更扎实";
  }
  if (dish.category === "小吃") {
    return "不想吃太正式时也合适";
  }
  return "先把饭点定下来";
}

function makeDescription(dish) {
  const meal = dish.mealTime.length ? dish.mealTime.slice(0, 2).join("、") : "这一顿";
  const taste = dish.taste || "顺口";
  const feature = getDishFeature(dish);
  const templates = [
    `${meal}想吃点${taste}的，${dish.name}可以先放进选择里，${feature}。`,
    `如果这一顿不想再来回选，${dish.name}是个省心方向，${feature}。`,
    `${dish.city}这一口不绕，${dish.name}适合先把饭点定下来。`,
    `想吃${dish.category || "本地味"}，又不想纠结太久，${dish.name}可以先试试。`,
    `${dish.name}不需要想太复杂，${meal}来一份，饭点就顺了。`,
    `今天胃口偏${taste}的话，${dish.name}比随便点一份更有方向。`,
    `还没想好吃什么时，先从${dish.name}开始也不亏，${feature}。`,
    `${dish.name}适合当作这一轮的答案，简单、明确，不拖饭点。`,
    `想吃得稳一点，${dish.name}可以先上桌，${feature}。`,
    `${dish.city}这一顿可以从${dish.name}开始，先有一个选择就好办。`,
    `不想把饭点耗在选择上，${dish.name}能给这一顿一个落点。`,
    `${dish.name}适合想快点定下来的人，${feature}。`
  ];
  return templates[hashIndex(`${dish.city}|${dish.name}|description`, templates.length)];
}

function makePollText(dish) {
  return `${dish.name}要不要进这轮饭局？投它一票，今晚少纠结一点。`;
}

function getDishIllustrationKey(dish) {
  const tags = dish.tags || [];
  const name = dish.name || "";
  if (/早茶/.test(name)) return "snack";
  if (/粥|饭/.test(name)) return "meal";
  if (dish.category === "饮品") return "drink";
  if (dish.category === "甜品" || tags.includes("甜品") || tags.includes("糕点")) return "dessert";
  if (tags.includes("海鲜") || /虾|蟹|鱼|蚝|贝|海参|螺/.test(name)) return "seafood";
  if (tags.includes("火锅") || /火锅|汤锅|锅子|煲/.test(name)) return "hotpot";
  if (tags.includes("面食") || tags.includes("汤粉") || tags.includes("米粉") || tags.includes("粉面") || /面|粉|米线|河粉|馄饨|饺/.test(name)) return "noodle";
  if (tags.includes("肉类") || /鸡|鸭|鹅|牛|羊|猪|肉|排骨|蹄|肘/.test(name)) return "meat";
  if (dish.category === "小吃") return "snack";
  return "meal";
}

function attachIllustration(dish) {
  const illustrationKey = getDishIllustrationKey(dish);
  dish.illustrationKey = illustrationKey;
  dish.illustrationSrc = FOOD_ILLUSTRATIONS[illustrationKey] || FOOD_ILLUSTRATIONS.meal;
  return dish;
}

function applyDishOverrides(dish) {
  const override = DISH_FIELD_OVERRIDES[dish.name];
  if (!override) return dish;
  return Object.assign(dish, override, {
    mealTime: override.mealTime ? override.mealTime.slice() : dish.mealTime,
    tags: override.tags ? override.tags.slice() : dish.tags
  });
}

function expandDish(compactDish, province, index) {
  const dishName = normalizeDishName(compactDish.n);
  const dish = applyDishOverrides({
    id: `dish_${hashText(`${province}|${compactDish.c}|${dishName}`)}`,
    city: compactDish.c,
    province,
    name: dishName,
    category: pickText(dictionary.category, compactDish.k, "正餐"),
    taste: pickText(dictionary.taste, compactDish.t, "鲜香"),
    mealTime: (compactDish.m || []).map((item) => pickText(dictionary.mealTime, item, "")).filter(Boolean),
    scene: (compactDish.s || []).map((item) => pickText(dictionary.scene, item, "")).filter(Boolean),
    avoidTags: (compactDish.a || []).map((item) => pickText(dictionary.avoidTag, item, "")).filter(Boolean),
    tags: compactDish.g || [],
    localIndex: compactDish.l || 3,
    iconType: pickText(dictionary.iconType, compactDish.i, "bowl"),
    weight: compactDish.w || 10,
    sourceBucket: pickText(dictionary.sourceBucket, compactDish.b, "cityExact"),
    order: index
  });
  dish.phrase = makePhrase(dish);
  dish.description = makeDescription(dish);
  dish.pollText = makePollText(dish);
  return attachIllustration(dish);
}

function hasDisallowedPlaceName(dish) {
  return Object.keys(PLACE_NAME_ALLOWED_CITIES).some((placeName) => (
    dish.name.includes(placeName) &&
    !PLACE_NAME_ALLOWED_CITIES[placeName].includes(dish.city)
  ));
}

function shouldDropSharedPlaceDish(dish) {
  if (INVALID_DISH_NAMES[dish.name]) {
    return true;
  }
  if (dish.sourceBucket === "cityExact" || dish.sourceBucket === "nationalGeneral") {
    return false;
  }
  if (hasDisallowedPlaceName(dish)) {
    return true;
  }
  return selectableCityNames.some((cityName) => (
    cityName !== dish.city && dish.name.includes(cityName)
  ));
}

function shouldReplaceDuplicateDish(existing, dish) {
  const existingPriority = SOURCE_BUCKET_PRIORITY[existing.sourceBucket] || 0;
  const nextPriority = SOURCE_BUCKET_PRIORITY[dish.sourceBucket] || 0;
  if (nextPriority !== existingPriority) {
    return nextPriority > existingPriority;
  }
  if ((dish.localIndex || 0) !== (existing.localIndex || 0)) {
    return (dish.localIndex || 0) > (existing.localIndex || 0);
  }
  return (dish.weight || 0) > (existing.weight || 0);
}

function registerDish(dish, dishIndexByCityName) {
  const key = `${dish.city}|${dish.name}`;
  if (Object.prototype.hasOwnProperty.call(dishIndexByCityName, key)) {
    const existingIndex = dishIndexByCityName[key];
    const existingDish = allDishes[existingIndex];
    if (!shouldReplaceDuplicateDish(existingDish, dish)) return;

    allDishes[existingIndex] = dish;
    delete dishById[existingDish.id];
    dishById[dish.id] = dish;

    const cityDishes = dishesByCity[dish.city] || [];
    const cityIndex = cityDishes.findIndex((item) => item.id === existingDish.id);
    if (cityIndex >= 0) {
      cityDishes[cityIndex] = dish;
    }
    return;
  }

  dishIndexByCityName[key] = allDishes.length;
  allDishes.push(dish);
  dishById[dish.id] = dish;
  if (!dishesByCity[dish.city]) dishesByCity[dish.city] = [];
  dishesByCity[dish.city].push(dish);
}

function ensureAllDishes() {
  if (allDishes) return allDishes;

  allDishes = [];
  const dishIndexByCityName = {};
  Object.keys(provinceDataMap).forEach((slug) => {
    const provinceData = provinceDataMap[slug];
    const province = provinceData.province;
    provinceData.cities.forEach((city) => {
      citySlogans[city] = `${city}饭点灵感，等你来转。`;
    });
    provinceData.dishes.forEach((compactDish, index) => {
      const dish = expandDish(compactDish, province, index);
      if (shouldDropSharedPlaceDish(dish)) return;
      registerDish(dish, dishIndexByCityName);
    });
  });

  registerNationalFallbackDishes();

  return allDishes;
}

function normalizeFilter(value) {
  if (value === "夜宵") return "宵夜";
  return value;
}

function normalizeFilters(filters) {
  return Object.assign({}, filters, {
    mealTime: normalizeFilter(filters.mealTime),
    category: normalizeFilter(filters.category),
    taste: normalizeFilter(filters.taste),
    scene: normalizeFilter(filters.scene)
  });
}

function getCities() {
  return selectableCities;
}

function getProvinces() {
  return selectableProvinces;
}

function getCity(name) {
  const city = cityByName[name] || selectableCities[0];
  const slogan = citySlogans[city.name] || city.slogan || `${city.name}饭点灵感，等你来转。`;
  return Object.assign({}, city, { slogan });
}

function getDishById(id) {
  ensureAllDishes();
  return dishById[id];
}

function getDishesByCity(city) {
  ensureAllDishes();
  const cityDishes = dishesByCity[city] || [];
  if (cityDishes.length >= MIN_CANDIDATE_COUNT) {
    return cityDishes;
  }
  const existingNames = cityDishes.reduce((map, dish) => {
    map[dish.name] = true;
    return map;
  }, {});
  const fallbackDishes = getNationalFallbackDishes({
    city,
    mealTime: ANY_FILTER,
    category: ANY_FILTER,
    taste: ANY_FILTER,
    scene: ANY_FILTER,
    avoidTags: []
  }, existingNames);
  return cityDishes.concat(fallbackDishes).slice(0, MIN_CANDIDATE_COUNT);
}

function getProvinceDishes(provinceName) {
  const slug = slugByProvince[provinceName];
  if (!slug || !provinceDataMap[slug]) return [];
  ensureAllDishes();
  return allDishes.filter((dish) => dish.province === provinceName);
}

function matchesValue(value, selected) {
  if (!selected || selected === ANY_FILTER) return true;
  if (Array.isArray(value)) return value.includes(selected);
  return value === selected;
}

function dishText(dish) {
  return [
    dish.name,
    dish.category,
    dish.taste,
    (dish.tags || []).join(""),
    (dish.avoidTags || []).join("")
  ].filter(Boolean).join("");
}

function dishMatchesAvoidTag(dish, tag) {
  if (!tag) return false;
  const avoidTags = dish.avoidTags || [];
  const tags = dish.tags || [];
  if (avoidTags.includes(tag) || tags.includes(tag)) return true;

  const text = dishText(dish);
  if (tag === "辣") return dish.taste === "重口" && /辣|麻|椒|酸辣/.test(text);
  if (tag === "海鲜") return /海鲜|虾|蟹|鱼|蚝|螺|贝|鲍|鱿|蛤|蛏|鳝|泥鳅/.test(text);
  if (tag === "甜") return dish.category === "甜品" || dish.taste === "甜口" || /糖|甜|糕|奶|酥|月饼|凉果|汤圆|双皮奶/.test(text);
  if (tag === "肉类") return /肉类|鸡|鸭|鹅|鸽|牛|羊|猪|肉|排骨|扣肉|蹄|肘|腊|熏|丸|兔/.test(text);
  if (tag === "牛肉") return /牛|牦牛/.test(text);
  if (tag === "猪肉") return /猪|扣肉|排骨|蹄|肘|五花|叉烧|肉燕|肉松|肉糕|肉丸|肉饼/.test(text);
  if (tag === "内脏") return /肝|肠|肚|腰|心|肺|杂|舌|肫|胗|蹄筋/.test(text);
  if (tag === "生冷") return /生腌|生炊|刺身|凉拌|冷吃|冰|凉粉|冷面/.test(text);
  return false;
}

function matchesCandidateFilters(dish, filters) {
  const avoidTags = filters.avoidTags || [];
  const avoidHit = avoidTags.some((tag) => dishMatchesAvoidTag(dish, tag));
  return (
    dish.city === filters.city &&
    !isMealTimeMismatch(dish, filters.mealTime) &&
    matchesValue(dish.mealTime, filters.mealTime) &&
    matchesValue(dish.category, filters.category) &&
    matchesValue(dish.taste, filters.taste) &&
    matchesValue(dish.scene, filters.scene) &&
    !avoidHit
  );
}

function isMealTimeMismatch(dish, mealTime) {
  if (mealTime !== "午餐" && mealTime !== "晚餐") return false;
  const tags = dish.tags || [];
  const isGenericBreakfast = (
    dish.sourceBucket === "nationalGeneral" &&
    tags.includes("早餐") &&
    (dish.localIndex || 0) <= 2
  );
  return isGenericBreakfast;
}

function createNationalFallbackDish(template, city, province) {
  const dish = Object.assign({}, template, {
    id: `fallback_${hashText(`${province}|${city}|${template.name}`)}`,
    city,
    province,
    localIndex: 2,
    sourceBucket: "nationalGeneral"
  });
  dish.phrase = makePhrase(dish);
  dish.description = makeDescription(dish);
  dish.pollText = makePollText(dish);
  return attachIllustration(dish);
}

function registerNationalFallbackDishes() {
  selectableCities.forEach((city) => {
    const province = city.province || city.provinceFullName || "";
    NATIONAL_FALLBACK_TEMPLATES.forEach((template) => {
      const dish = createNationalFallbackDish(template, city.name, province);
      dishById[dish.id] = dish;
    });
  });
}

function getNationalFallbackDishes(filters, existingNames) {
  const city = getCity(filters.city);
  const province = city.province || city.provinceFullName || "";
  const names = existingNames || {};
  const fallbackDishes = [];

  NATIONAL_FALLBACK_TEMPLATES.forEach((template) => {
    if (names[template.name]) return;
    const dish = createNationalFallbackDish(template, filters.city, province);
    if (!matchesCandidateFilters(dish, Object.assign({}, filters, { city: filters.city }))) return;
    dishById[dish.id] = dish;
    fallbackDishes.push(dish);
  });

  return fallbackDishes;
}

function uniqueDishesByName(list) {
  const byName = {};
  list.filter(Boolean).forEach((dish) => {
    if (!byName[dish.name]) byName[dish.name] = dish;
  });
  return Object.keys(byName).map((name) => byName[name]);
}

function getProposalDishes(cityName, scope) {
  const city = getCity(cityName);
  const cityDishes = getDishesByCity(city.name);
  const localDishes = cityDishes.filter((dish) => dish.sourceBucket === "cityExact");
  const commonDishes = () => getNationalFallbackDishes({
    city: city.name,
    mealTime: ANY_FILTER,
    category: ANY_FILTER,
    taste: ANY_FILTER,
    scene: ANY_FILTER,
    avoidTags: []
  }, {});
  if (scope === "province") {
    const provinceDishes = uniqueDishesByName(getProvinceDishes(city.province).filter((dish) => (
      dish.sourceBucket === "provinceShared" || dish.sourceBucket === "regionalShared"
    )));
    return provinceDishes;
  }
  if (scope === "common") {
    return commonDishes();
  }
  return localDishes;
}

function getCandidateDishes(filters) {
  const normalized = normalizeFilters(filters);
  const cityDishes = getDishesByCity(normalized.city);
  let pool = cityDishes.filter((dish) => matchesCandidateFilters(dish, normalized));
  if (pool.length < MIN_CANDIDATE_COUNT) {
    const existingNames = cityDishes.reduce((map, dish) => {
      map[dish.name] = true;
      return map;
    }, {});
    const fallbackDishes = getNationalFallbackDishes(normalized, existingNames);
    pool = pool.concat(fallbackDishes).slice(0, MIN_CANDIDATE_COUNT);
  }
  return pool;
}

function spinDish(filters) {
  const pool = getCandidateDishes(filters);
  return weightedPick(pool);
}

function searchDishes(keyword) {
  const text = String(keyword || "").trim().toLowerCase();
  if (!text) return [];
  ensureAllDishes();
  return Object.keys(dishById).map((id) => dishById[id]).filter((dish) => {
    const haystack = [
      dish.city,
      dish.province,
      dish.name,
      dish.category,
      dish.taste,
      ...dish.tags,
      ...dish.mealTime,
      ...dish.scene
    ].join(" ").toLowerCase();
    return haystack.includes(text);
  });
}

module.exports = {
  getCities,
  getProvinces,
  getCity,
  getDishById,
  getDishesByCity,
  getProvinceDishes,
  getProposalDishes,
  getCandidateDishes,
  spinDish,
  searchDishes
};
