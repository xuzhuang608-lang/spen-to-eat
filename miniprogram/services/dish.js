const provinceIndex = require("../data/provinces/index");
const { cities, provinces } = require("../data/national-cities");
const { filterDishes, weightedPick } = require("../utils/random");

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
const SOURCE_BUCKET_PRIORITY = {
  cityExact: 4,
  regionalShared: 3,
  provinceShared: 2,
  nationalGeneral: 1
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
  return templates[hashText(dish.city + dish.name).charCodeAt(0) % templates.length];
}

function makeDescription(dish) {
  const meal = dish.mealTime.length ? dish.mealTime.join("、") : "正餐";
  const tags = dish.tags.length ? dish.tags.join("、") : dish.category;
  return `${dish.name}是${dish.city}菜单里的${tags}选择，口味偏${dish.taste}，适合${meal}来一份。本地特色指数${dish.localIndex}星，适合在不知道吃什么的时候交给转盘决定。`;
}

function makePollText(dish) {
  return `${dish.name}要不要进这轮饭局？投它一票，今晚少纠结一点。`;
}

function expandDish(compactDish, province, index) {
  const dishName = normalizeDishName(compactDish.n);
  const dish = {
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
  };
  dish.phrase = makePhrase(dish);
  dish.description = makeDescription(dish);
  dish.pollText = makePollText(dish);
  return dish;
}

function shouldDropSharedPlaceDish(dish) {
  if (INVALID_DISH_NAMES[dish.name]) {
    return true;
  }
  if (dish.sourceBucket === "cityExact" || dish.sourceBucket === "nationalGeneral") {
    return false;
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

function matchesCandidateFilters(dish, filters) {
  const avoidTags = filters.avoidTags || [];
  const avoidHit = avoidTags.some((tag) => dish.avoidTags.includes(tag));
  return (
    matchesValue(dish.mealTime, filters.mealTime) &&
    matchesValue(dish.category, filters.category) &&
    matchesValue(dish.taste, filters.taste) &&
    matchesValue(dish.scene, filters.scene) &&
    !avoidHit
  );
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
  return dish;
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
    if (!matchesCandidateFilters(dish, filters)) return;
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
  let pool = filterDishes(cityDishes, normalized);
  if (pool.length < MIN_CANDIDATE_COUNT) {
    const existingNames = cityDishes.reduce((map, dish) => {
      map[dish.name] = true;
      return map;
    }, {});
    const fallbackDishes = getNationalFallbackDishes(normalized, existingNames);
    pool = pool.concat(fallbackDishes).slice(0, MIN_CANDIDATE_COUNT);
  }
  if (!pool.length && (!normalized.category || normalized.category === ANY_FILTER)) {
    pool = cityDishes;
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
  return ensureAllDishes().filter((dish) => {
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
