const provinceIndex = require("../data/provinces/index");
const dishFacts = require("../data/dish-facts");
const homeMealPools = require("../data/home-meal-pools");
const { cities, provinces } = require("../data/national-cities");
const { weightedPick } = require("../utils/random");

const coreProvinceDataMap = {
  guangdong: require("../data/provinces/guangdong")
};
const provinceDataCache = Object.assign({}, coreProvinceDataMap);
const provinceLoadPromises = {};
let packageDataLoadPromise = null;
const PROVINCE_LOAD_TIMEOUT_MS = 3500;

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
let dishIndexByCityName = {};

const MIN_CANDIDATE_COUNT = 8;
const MAX_MEAL_POOL_MIX_COUNT = 16;
const ANY_FILTER = "\u4e0d\u9650";
const DISH_NAME_REPLACEMENTS = {
  "\u5ba2\u5bb6\u76d0\u7117\u9e21\u9996\u9009": "\u5ba2\u5bb6\u76d0\u7117\u9e21"
};
const INVALID_DISH_NAMES = {
  "\u7c73\u7ca5\u505a\u9505\u5e95": true,
  "\u6d77\u9c9c": true,
  "\u672c\u5730\u9e21": true,
  "\u7ca5\u7c7b": true,
  "\u997c\u8272\u91d1\u9ec4": true,
  "\u7d27\u5b9e\u9999\u7cef": true,
  "\u706b\u9505": true,
  "\u5976\u8336": true,
  "\u70e7\u70e4": true,
  "\u5173\u4e1c\u716e": true,
  "\u9ebb\u8fa3\u70eb": true,
  "\u6c34\u716e\u9c7c": true,
  "\u5c0f\u9f99\u867e": true,
  "\u4e32\u4e32\u9999": true,
  "\u5e7f\u5f0f\u65e9\u8336": true,
  "\u679c\u4e61\u7279\u8272\u9762\u70b9": true,
  "\u5e9e\u5404\u5e84\u74dc\u679c\u5bb4": true,
  "\u957f\u5b81\u897f\u5f0f\u7cd5\u70b9": true,
  "\u4f20\u7edf\u751c\u6c64": true,
  "\u6e05\u6de1\u751c\u6c64": true
};
const LOW_CONFIDENCE_GENERIC_NAMES = {
  "\u70e4\u9c7c": true,
  "\u9178\u83dc\u9c7c": true
};
const BREAKFAST_LABEL_BLOCK_PATTERNS = [
  /月饼|老婆饼|老公饼|凉果|糕干|饼干|杏仁饼|腐乳饼/,
  /糖水|甜汤|西米露|烧仙草|龟苓膏|冰粉|绿豆沙|红豆沙/,
  /烧鹅|烧鸭|烧鸡|烧肉|烧乳猪|乳鸽|扣肉|红烧|焖|炖|煲|火锅|边炉|盆菜/,
  /膏蟹|花蟹|鲍鱼|海参|龙虾|生蚝|鱼生|虾籽|鲮鱼|鳝|螺|鱼包/,
  /麻辣|酸辣|泡椒|香辣|干锅|串串|烧烤|烤鱼/,
  /猪头粽|裹蒸粽|粥底火锅|啫啫煲|下酒|拼盘|宴/
];
const BREAKFAST_STAPLE_PATTERNS = [
  /粥|糊|豆浆|米浆|牛奶|燕麦|鸡蛋|油条|茶汤|面茶|油茶/,
  /粉$|米粉|汤粉|肠粉|河粉|濑粉|米线|线粉/,
  /面$|汤面|拌面|云吞面|馄饨面|炸酱面|热干面|面线糊/,
  /包子|小笼|烧麦|馄饨|云吞|抄手|蒸饺|煎饺|锅贴|馒头|蒸馍/,
  /煎饼|烧饼|大饼|蛋饼|葱油饼|粢饭|饭团|糯米饭/,
  /蒸山药|蒸芋头|蒸红薯|蒸玉米|山药|芋头|红薯|番薯|地瓜|玉米/
];
const BREAKFAST_HARD_DISH_PATTERNS = [
  /粉蒸肉|蒸肉|扣肉|锅包肉|烧肉|烧鹅|烧鸭|烧鸡|烧乳猪|乳鸽/,
  /排骨|猪蹄|羊排|牛排|肘子|猪头|包山羊|肉夹馍/,
  /火锅|边炉|干锅|烧烤|烤鱼|烤肉|卤味|卤肉|卤鸭|卤鹅/,
  /麻辣|酸辣|泡椒|香辣|辣椒|辣糊|面辣子|辣炒|水煮|下酒|拼盘|盆菜|宴/,
  /膏蟹|花蟹|鲍鱼|海参|龙虾|生蚝|鱼生|虾籽|鳝|螺/
];
const BREAKFAST_SWEET_SNACK_PATTERNS = [
  /糕点|绿豆糕|喜饼|酥饼|奶油|玫瑰饼|鲜花饼|麦芽饼|糖糕|凉糕|扒糕/,
  /糖水|甜汤|西米露|烧仙草|龟苓膏|冰粉|红豆沙|绿豆沙|零食/
];
const BREAKFAST_HEAVY_MEAT_PATTERN = /鸡|鸭|鹅|猪|牛|羊|鱼|虾|蟹|排骨|肉|肠|腊/;
const LATE_NIGHT_KEEP_PATTERNS = [
  /粉|面|粥|粿条|河粉|濑粉|米线|云吞|馄饨|抄手/,
  /炒粉|炒面|炒河粉|炒牛河|煲仔饭|砂锅/,
  /糖水|甜汤|双皮奶|姜撞奶|豆花|凉粉|烧仙草|龟苓膏/,
  /烤生蚝|烤串|烧烤|小龙虾|卤味|卤鸭|卤鸡|关东煮|麻辣烫|酸辣粉/
];
const LATE_NIGHT_BLOCK_PATTERNS = [
  /月饼|老婆饼|老公饼|杏仁饼|腐乳饼|喜饼|酥饼|米饼|炒米饼|糕干|年糕|绿豆糕/,
  /马拉糕|九层糕|棉花糕|云片糕|糖葱薄饼|朥饼|麦芽糖饼|冬瓜糖|陈皮糖|手信|特产/,
  /茶点|茶果|煎堆|蹦砂|蛋卷|薄撑|艾糍|艾粄|鼠曲粿|鲎粿|粉果|金吒|清明仔/,
  /粽|裹蒸粽|粽球|盆菜|宴|全鸭|整鸡|烧乳猪|烤乳猪|扣肉|粉蒸肉|锅包肉/,
  /白切鸡|盐焗鸡|烧鹅|烧鸭|乳鸽|火锅|边炉|牛肉火锅|海鲜火锅|鸡火锅/
];
const LATE_NIGHT_STRONG_BLOCK_PATTERNS = [
  /茶点|茶果|煎堆|蹦砂|蛋卷|薄撑|艾糍|艾粄|鼠曲粿|鲎粿|粉果|金吒|清明仔/
];
const MEAL_LABEL_KEEP_PATTERNS = [
  /饭|粉|面|粥|汤|羹|煲|锅|火锅|边炉|砂锅|云吞|馄饨|抄手|米线|粿条|河粉|濑粉/,
  /肉|鸡|鸭|鹅|鱼|虾|蟹|蚝|猪|牛|羊|排骨|豆腐|丸|烧麦|包子|小笼|饺|锅贴/,
  /烧饼夹|肉饼|馅饼|锅盔|夹馍|肉夹馍|豆花饭|钵钵鸡|麻辣烫|酸辣粉|炒糕粿/
];
const MEAL_LABEL_BLOCK_PATTERNS = [
  /月饼|老婆饼|老公饼|杏仁饼|腐乳饼|喜饼|酥饼|米饼|炒米饼|糕干|绿豆糕|鲜花饼/,
  /云片糕|马拉糕|九层糕|棉花糕|伦教糕|年糕|米糕|糖糕|凉糕|绿豆糕|麦芽饼/,
  /糖葱薄饼|朥饼|冬瓜糖|陈皮糖|龙须糖|麦芽糖|酥糖|凉果|饼干|鸡仔饼|手信|特产/,
  /茶点|茶果|煎堆|油角|蛋散|鸡仔饼|蛋卷|蹦砂|薄撑|艾糍|艾粄|杨枝甘露/,
  /奶茶|柠檬茶|凉茶|酸梅汤|玉米汁|牛奶|豆浆|饮品/,
  /糖水|甜汤|西米露|双皮奶|姜撞奶|烧仙草|龟苓膏|冰粉|红豆沙|绿豆沙|豆花/
];
const MEAL_LABEL_STRONG_BLOCK_PATTERNS = [
  /鸡仔饼/,
  /^(?!.*炒糕粿)(?!.*粿条)(?!.*粿汁).*粿/,
  /^(?!.*馃条)(?!.*馃汁).*馃/
];
const PLACE_NAME_ALLOWED_CITIES = {
  "\u5b9d\u5b89": ["\u6df1\u5733"],
  "\u987a\u5fb7": ["\u4f5b\u5c71"],
  "\u5317\u4eac": ["\u5317\u4eac"],
  "\u4e0a\u6d77": ["\u4e0a\u6d77"],
  "\u5929\u6d25": ["\u5929\u6d25"],
  "\u91cd\u5e86": ["\u91cd\u5e86"]
};
const DISH_FIELD_OVERRIDES = {
  "\u7092\u7cd5\u7cbf": {
    category: "\u6b63\u9910",
    taste: "\u9c9c\u9999",
    mealTime: ["\u5348\u9910", "\u665a\u9910"],
    tags: ["\u4e3b\u98df", "\u4e0b\u996d"],
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
  noodle: "/assets/dish-illustrations/noodle.png",
  hotpot: "/assets/food-categories/hotpot.png",
  meat: "/assets/food-categories/meat.png",
  congee: "/assets/dish-illustrations/congee.png",
  dimsum: "/assets/dish-illustrations/dimsum.png",
  soup: "/assets/dish-illustrations/soup.png",
  roast: "/assets/dish-illustrations/roast.png",
  fish: "/assets/dish-illustrations/fish.png",
  soupnoodle: "/assets/dish-illustrations/soupnoodle.png",
  cold: "/assets/dish-illustrations/cold.png",
  fried: "/assets/dish-illustrations/fried.png",
  ricecake: "/assets/dish-illustrations/ricecake.png",
  ricebowl: "/assets/dish-illustrations/ricebowl.png",
  skewer: "/assets/dish-illustrations/skewer.png",
  stirfry: "/assets/dish-illustrations/stirfry.png",
  dumpling: "/assets/dish-illustrations/dumpling.png",
  bbq: "/assets/dish-illustrations/bbq.png",
  poultry: "/assets/dish-illustrations/poultry.png",
  sweetSoup: "/assets/dish-illustrations/sweet-soup.png",
  bread: "/assets/dish-illustrations/bun-pancake.png"
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
  { name: "\u767d\u5207\u9e21", category: "\u6b63\u9910", taste: "\u6e05\u6de1", mealTime: ["\u5348\u9910", "\u665a\u9910"], scene: ["\u4e24\u4e2a\u4eba", "\u670b\u53cb\u805a\u9910"], avoidTags: ["\u8089\u7c7b"], tags: ["\u8089\u7c7b"], iconType: "bowl", weight: 4 },
  { name: "\u53e3\u6c34\u9e21", category: "\u6b63\u9910", taste: "\u91cd\u53e3", mealTime: ["\u5348\u9910", "\u665a\u9910"], scene: ["\u4e24\u4e2a\u4eba", "\u670b\u53cb\u805a\u9910"], avoidTags: ["\u8fa3", "\u8089\u7c7b"], tags: ["\u8089\u7c7b", "\u4e0b\u996d"], iconType: "chili", weight: 4 },
  { name: "\u56de\u9505\u8089", category: "\u6b63\u9910", taste: "\u91cd\u53e3", mealTime: ["\u5348\u9910", "\u665a\u9910"], scene: ["\u4e24\u4e2a\u4eba", "\u670b\u53cb\u805a\u9910"], avoidTags: ["\u8fa3", "\u8089\u7c7b"], tags: ["\u8089\u7c7b", "\u4e0b\u996d"], iconType: "chili", weight: 4 },
  { name: "\u9ebb\u5a46\u8c46\u8150", category: "\u6b63\u9910", taste: "\u91cd\u53e3", mealTime: ["\u5348\u9910", "\u665a\u9910"], scene: ["\u4e00\u4e2a\u4eba", "\u4e24\u4e2a\u4eba"], avoidTags: ["\u8fa3"], tags: ["\u4e0b\u996d"], iconType: "chili", weight: 4 },
  { name: "\u6c34\u716e\u8089\u7247", category: "\u6b63\u9910", taste: "\u91cd\u53e3", mealTime: ["\u5348\u9910", "\u665a\u9910"], scene: ["\u4e24\u4e2a\u4eba", "\u670b\u53cb\u805a\u9910"], avoidTags: ["\u8fa3", "\u8089\u7c7b"], tags: ["\u8089\u7c7b", "\u4e0b\u996d"], iconType: "chili", weight: 4 },
  { name: "\u7ea2\u70e7\u6392\u9aa8", category: "\u6b63\u9910", taste: "\u9c9c\u9999", mealTime: ["\u5348\u9910", "\u665a\u9910"], scene: ["\u4e24\u4e2a\u4eba", "\u670b\u53cb\u805a\u9910"], avoidTags: ["\u8089\u7c7b"], tags: ["\u8089\u7c7b"], iconType: "flame", weight: 4 },
  { name: "\u70e4\u9c7c", category: "\u6b63\u9910", taste: "\u91cd\u53e3", mealTime: ["\u5348\u9910", "\u665a\u9910", "\u5bb5\u591c"], scene: ["\u4e24\u4e2a\u4eba", "\u670b\u53cb\u805a\u9910"], avoidTags: ["\u8fa3", "\u6d77\u9c9c"], tags: ["\u6d77\u9c9c", "\u4e0b\u996d"], iconType: "flame", weight: 4 },
  { name: "\u7092\u6cb3\u7c89", category: "\u5c0f\u5403", taste: "\u9c9c\u9999", mealTime: ["\u5348\u9910", "\u665a\u9910", "\u5bb5\u591c"], scene: ["\u4e00\u4e2a\u4eba", "\u4e24\u4e2a\u4eba"], avoidTags: [], tags: ["\u5c0f\u5403"], iconType: "bowl", weight: 4 },
  { name: "\u5e72\u7092\u725b\u6cb3", category: "\u5c0f\u5403", taste: "\u9c9c\u9999", mealTime: ["\u5348\u9910", "\u665a\u9910", "\u5bb5\u591c"], scene: ["\u4e00\u4e2a\u4eba", "\u4e24\u4e2a\u4eba"], avoidTags: ["\u8089\u7c7b"], tags: ["\u5c0f\u5403", "\u7c89\u9762", "\u8089\u7c7b"], iconType: "bowl", weight: 4 },
  { name: "\u725b\u8089\u9762", category: "\u6b63\u9910", taste: "\u9c9c\u9999", mealTime: ["\u5348\u9910", "\u665a\u9910", "\u5bb5\u591c"], scene: ["\u4e00\u4e2a\u4eba", "\u4e24\u4e2a\u4eba"], avoidTags: ["\u8089\u7c7b"], tags: ["\u8089\u7c7b"], iconType: "bowl", weight: 4 },
  { name: "\u4e91\u541e\u9762", category: "\u5c0f\u5403", taste: "\u9c9c\u9999", mealTime: ["\u65e9\u9910", "\u5348\u9910", "\u665a\u9910", "\u5bb5\u591c"], scene: ["\u4e00\u4e2a\u4eba", "\u4e24\u4e2a\u4eba"], avoidTags: [], tags: ["\u5c0f\u5403"], iconType: "bowl", weight: 4 },
  { name: "\u7802\u9505\u7ca5", category: "\u5c0f\u5403", taste: "\u6e05\u6de1", mealTime: ["\u65e9\u9910", "\u5348\u9910", "\u665a\u9910", "\u5bb5\u591c"], scene: ["\u4e00\u4e2a\u4eba", "\u4e24\u4e2a\u4eba"], avoidTags: [], tags: ["\u5c0f\u5403"], iconType: "bowl", weight: 4 },
  { name: "\u997a\u5b50", category: "\u5c0f\u5403", taste: "\u9c9c\u9999", mealTime: ["\u5348\u9910", "\u665a\u9910", "\u5bb5\u591c"], scene: ["\u4e00\u4e2a\u4eba", "\u4e24\u4e2a\u4eba"], avoidTags: [], tags: ["\u5c0f\u5403"], iconType: "bowl", weight: 4 },
  { name: "\u7172\u4ed4\u996d", category: "\u6b63\u9910", taste: "\u9c9c\u9999", mealTime: ["\u5348\u9910", "\u665a\u9910"], scene: ["\u4e24\u4e2a\u4eba", "\u670b\u53cb\u805a\u9910"], avoidTags: [], tags: ["\u4e0b\u996d"], iconType: "flame", weight: 4 },
  { name: "\u9178\u8fa3\u7c89", category: "\u5c0f\u5403", taste: "\u91cd\u53e3", mealTime: ["\u5348\u9910", "\u665a\u9910", "\u5bb5\u591c"], scene: ["\u4e00\u4e2a\u4eba", "\u4e24\u4e2a\u4eba"], avoidTags: ["\u8fa3"], tags: ["\u5c0f\u5403"], iconType: "chili", weight: 4 },
  { name: "\u9ebb\u8fa3\u70eb", category: "\u6b63\u9910", taste: "\u91cd\u53e3", mealTime: ["\u5348\u9910", "\u665a\u9910", "\u5bb5\u591c"], scene: ["\u4e24\u4e2a\u4eba", "\u670b\u53cb\u805a\u9910"], avoidTags: ["\u8fa3"], tags: ["\u5c0f\u5403"], iconType: "chili", weight: 4 },
  { name: "\u4e32\u4e32\u9999", category: "\u6b63\u9910", taste: "\u91cd\u53e3", mealTime: ["\u5348\u9910", "\u665a\u9910", "\u5bb5\u591c"], scene: ["\u4e24\u4e2a\u4eba", "\u670b\u53cb\u805a\u9910"], avoidTags: ["\u8fa3"], tags: ["\u5c0f\u5403", "\u4e0b\u996d"], iconType: "chili", weight: 4 },
  { name: "\u5c0f\u9f99\u867e", category: "\u6b63\u9910", taste: "\u91cd\u53e3", mealTime: ["\u665a\u9910", "\u5bb5\u591c"], scene: ["\u4e24\u4e2a\u4eba", "\u670b\u53cb\u805a\u9910"], avoidTags: ["\u8fa3", "\u6d77\u9c9c"], tags: ["\u6d77\u9c9c", "\u4e0b\u996d"], iconType: "chili", weight: 4 },
  { name: "\u70e4\u9e21\u7fc5", category: "\u5c0f\u5403", taste: "\u9c9c\u9999", mealTime: ["\u665a\u9910", "\u5bb5\u591c"], scene: ["\u4e00\u4e2a\u4eba", "\u4e24\u4e2a\u4eba"], avoidTags: ["\u8089\u7c7b"], tags: ["\u5c0f\u5403", "\u8089\u7c7b"], iconType: "flame", weight: 4 },
  { name: "\u70e4\u9e21\u817f", category: "\u5c0f\u5403", taste: "\u9c9c\u9999", mealTime: ["\u665a\u9910", "\u5bb5\u591c"], scene: ["\u4e00\u4e2a\u4eba", "\u4e24\u4e2a\u4eba"], avoidTags: ["\u8089\u7c7b"], tags: ["\u5c0f\u5403", "\u8089\u7c7b"], iconType: "flame", weight: 4 },
  { name: "\u70e4\u8304\u5b50", category: "\u5c0f\u5403", taste: "\u9c9c\u9999", mealTime: ["\u665a\u9910", "\u5bb5\u591c"], scene: ["\u4e00\u4e2a\u4eba", "\u4e24\u4e2a\u4eba"], avoidTags: [], tags: ["\u5c0f\u5403"], iconType: "flame", weight: 4 },
  { name: "\u70e4\u9762\u7b4b", category: "\u5c0f\u5403", taste: "\u91cd\u53e3", mealTime: ["\u5348\u9910", "\u665a\u9910", "\u5bb5\u591c"], scene: ["\u4e00\u4e2a\u4eba", "\u4e24\u4e2a\u4eba"], avoidTags: ["\u8fa3"], tags: ["\u5c0f\u5403", "\u7c89\u9762"], iconType: "chili", weight: 4 },
  { name: "\u51c9\u62cc\u9ec4\u74dc", category: "\u6b63\u9910", taste: "\u6e05\u6de1", mealTime: ["\u5348\u9910", "\u665a\u9910"], scene: ["\u4e00\u4e2a\u4eba", "\u4e24\u4e2a\u4eba"], avoidTags: [], tags: ["\u5bb6\u5e38\u83dc"], iconType: "bowl", weight: 4 },
  { name: "\u51c9\u62cc\u6728\u8033", category: "\u6b63\u9910", taste: "\u6e05\u6de1", mealTime: ["\u5348\u9910", "\u665a\u9910"], scene: ["\u4e00\u4e2a\u4eba", "\u4e24\u4e2a\u4eba"], avoidTags: [], tags: ["\u5bb6\u5e38\u83dc"], iconType: "bowl", weight: 4 },
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

function shuffleList(list) {
  const copy = list.slice();
  for (let index = copy.length - 1; index > 0; index -= 1) {
    const target = hashIndex(`${copy[index].name || index}|${Date.now()}|${index}`, index + 1);
    const temp = copy[index];
    copy[index] = copy[target];
    copy[target] = temp;
  }
  return copy;
}

function normalizeDishName(name) {
  return DISH_NAME_REPLACEMENTS[name] || name;
}

function normalizeMealDishKey(name) {
  return normalizeDishName(name)
    .replace(/[\s·・,，。.（）()【】[\]“”"']/g, "")
    .replace(/^(广东|广式|港式|老式|传统|特色|鲜虾|虾仁|猪肉|牛肉|鸡蛋)/, "")
    .replace(/皇$/, "");
}

function makePhrase(dish) {
  const name = dish.name || "";
  const tags = dish.tags || [];
  const templates = [
    `${dish.city}这一顿，可以先从${dish.name}看起。`,
    `先把${dish.name}摆出来，胃口会更有方向。`,
    `不想继续翻菜单的话，${dish.name}可以先上桌。`,
    `${dish.name}在候选里，今天这顿不算难选。`,
    `这一口交给${dish.name}，饭点就有了落点。`,
    `先记下${dish.name}，等会儿再纠结也不迟。`,
    `${dish.name}挺适合当这一轮的开场。`,
    `如果想快点定下来，${dish.name}是个清楚的方向。`,
    `今天先看看${dish.name}，不用一上来想太复杂。`,
    `${dish.city}这一桌，${dish.name}可以占一个位置。`
  ];

  if (/粥|汤|羹|盅/.test(name) || tags.includes("粥品") || tags.includes("汤粥") || tags.includes("汤羹")) {
    templates.push(
      `${name}走热乎路线，先接住这一顿。`,
      `想吃点顺口的，${name}可以先放前面。`,
      `${name}比较稳，适合不想吃太干的时候。`,
      `这一顿想暖一点，${name}可以考虑。`
    );
  }

  if (/粉|面|粿条|河粉|米线|馄饨|云吞|饺/.test(name) || tags.includes("粉面") || tags.includes("面食")) {
    templates.push(
      `${name}主食感明确，适合快速解决一顿。`,
      `想吃得利落点，${name}可以先上候选。`,
      `${name}不绕弯，饿的时候很省心。`,
      `今天想吃粉面这一口，${name}刚好能接上。`
    );
  }

  if (/虾|蟹|蚝|鱼|贝|海参|螺|鱿/.test(name) || tags.includes("海鲜")) {
    templates.push(
      `${name}鲜味更明显，适合想换个口味的时候。`,
      `想吃点鲜的，${name}可以先看。`,
      `${name}这一口偏鲜，别急着划走。`,
      `今天胃口想清亮一点，${name}可以试试。`
    );
  }

  if (/鸡|鸭|鹅|牛|羊|猪|肉|排骨|蹄|鸽/.test(name) || tags.includes("肉类")) {
    templates.push(
      `${name}更扎实，适合想认真吃一顿。`,
      `想吃点有满足感的，${name}可以排前面。`,
      `${name}这一口比较顶，饭点不容易落空。`,
      `今天想吃肉香一点，${name}可以考虑。`
    );
  }

  if (/烤|烧|煎|炸|炒|爆|焗/.test(name)) {
    templates.push(
      `${name}香气会更直接，适合现在提提胃口。`,
      `想吃点香口的，${name}可以先定个方向。`,
      `${name}看着就不寡淡，今天可以试试。`,
      `这一轮想来点有锅气的，${name}挺合适。`
    );
  }

  if (dish.category === "甜品" || tags.includes("甜品") || tags.includes("糕点")) {
    templates.push(
      `${name}更轻松一点，适合给这顿收个尾。`,
      `想吃点甜口的，${name}可以先留着。`,
      `${name}不算正经大菜，但很适合解馋。`,
      `今天想轻一点，${name}也能当个答案。`
    );
  }

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

function getDishKindText(dish) {
  const category = dish.category || "本地菜";
  const feature = getDishFeature(dish);
  if (feature === "先把饭点定下来") return category;
  return `${category}，${feature}`;
}

function getMealText(dish) {
  const mealTime = dish.mealTime || [];
  if (!mealTime.length) return "这一顿";
  return mealTime.slice(0, 2).join("、");
}

function getSourceText(dish) {
  if (dish.sourceBucket === "mealPool") return (dish.mealTime || []).includes("早餐") ? "早餐专属备选" : "宵夜专属备选";
  if (dish.sourceBucket === "cityExact") return `${dish.city}本地美食`;
  if (dish.sourceBucket === "regionalShared") return `${dish.province || dish.city}省内美食`;
  if (dish.sourceBucket === "provinceShared") return `${dish.province || dish.city}省内美食`;
  return "常见美食";
}

function getMainIngredientText(dish) {
  const name = dish.name || "";
  const tags = dish.tags || [];
  if (/油条/.test(name)) return "面粉和油";
  if (/肉夹馍/.test(name)) return "馍和卤肉";
  if (/泡馍/.test(name)) return "馍、肉汤和配菜";
  if (/卤水|卤味|打冷|拼盘/.test(name)) return "卤味或熟食配料";
  if (/酿三宝|酿苦瓜|酿/.test(name)) return "肉馅和蔬菜";
  if (/素菜|上素|罗汉斋|清炒|时蔬|番薯叶|通菜|芥菜|秋葵|毛豆|笋|竹笋|苦麦菜/.test(name)) return "时令蔬菜";
  if (/粽|裹蒸/.test(name)) return "糯米和馅料";
  if (/肠粉|卷粉|粿|粄|糕/.test(name)) return "米浆或米制皮";
  if (/煲仔饭|炒饭|盖饭|饭/.test(name)) return "米饭和配菜";
  if (/粥|白粥|砂锅粥/.test(name)) return "米粥和配料";
  if (/糯米鸡|珍珠鸡/.test(name)) return "糯米和鸡肉";
  if (/牛杂|萝卜牛杂|牛百叶|金钱肚/.test(name)) return "牛杂和配菜";
  const ingredients = [];

  [
    [/牛奶|奶茶|酸奶|奶昔|乳酪/, "奶类"],
    [/鸡蛋|鸭蛋|皮蛋|咸蛋|水煮蛋|荷包蛋|蛋饼|蛋炒|蒸蛋|蛋/, "蛋类"],
    [/面包|吐司|欧包|贝果/, "面包"],
    [/燕麦|麦片|全麦/, "谷物"],
    [/鸡翅|鸡腿|鸡爪|鸡胗|鸡肉|鸡排|鸡块|鸡汤|鸡煲|鸡丁|鸡/, "鸡肉"],
    [/烤鸭|鸭|鸭脖|鸭翅|鸭血|老鸭/, "鸭肉"],
    [/鹅/, "鹅肉"],
    [/牛腩|牛杂|牛肉|牛百叶|牛排|牛丸|牛筋|牛肚|牛蹄|牛骨|牛(?!奶)/, "牛肉或牛杂"],
    [/羊/, "羊肉"],
    [/猪|排骨|五花肉|猪杂|猪肝|猪蹄|猪脚|里脊|瘦肉|肥肠|肉丸|酥肉|咕咾肉|咕噜肉/, "猪肉或猪杂"],
    [/虾|大虾|河虾|对虾/, "虾"],
    [/蟹|花蟹|膏蟹/, "蟹"],
    [/蚝|生蚝/, "生蚝"],
    [/鱼|马鲛|鲫鱼|鳝|鱿鱼|花甲|田螺|贝|海鲜/, "鱼鲜或贝类"],
    [/豆腐|豆干|腐竹|豆花/, "豆制品"],
    [/茄子|青瓜|黄瓜|韭菜|土豆|玉米|金针菇|香菇|娃娃菜|青椒|藕/, "蔬菜"],
    [/酸辣粉|螺蛳粉|热干面|粉|河粉|米粉|濑粉|粿条|粉丝|面条|汤面|拌面|炒面|小面|拉面|米线|馄饨|云吞|水饺|饺/, "粉面或面皮"],
    [/包|馒头|饼|糕|粿|粄|糍|烧卖|烧麦|虾饺|点心/, "面点或米制点心"],
    [/糖水|双皮奶|姜撞奶|西米露|龟苓膏|烧仙草|豆沙|芝麻糊|芋圆/, "糖水或甜品料"],
    [/茶|凉茶|柠檬茶|豆浆|牛奶|饮|汁/, "饮品原料"]
  ].forEach(([pattern, label]) => {
    if ((pattern.test(name) || tags.includes(label)) && !ingredients.includes(label)) {
      ingredients.push(label);
    }
  });

  if (ingredients.length) return ingredients.slice(0, 2).join("、");
  if (tags.includes("海鲜")) return "海鲜";
  if (tags.includes("肉类")) return "肉类食材";
  if (tags.includes("粉面")) return "粉面主食";
  if (tags.includes("汤羹") || tags.includes("汤粥")) return "汤粥底料";
  if (dish.category === "甜品") return "甜品原料";
  if (dish.category === "饮品") return "饮品原料";
  return dish.category === "小吃" ? "常见小吃食材" : "家常食材";
}

function getCookingText(dish) {
  const name = dish.name || "";
  if (/油条/.test(name)) return "通常把发面面坯下锅炸到蓬松";
  if (/肉夹馍/.test(name)) return "通常把卤肉剁碎夹进热馍里";
  if (/泡馍/.test(name)) return "常把馍掰碎后用肉汤煮透";
  if (/面包|吐司|欧包|贝果|燕麦|麦片|全麦/.test(name)) return "通常作为早餐主食，吃起来比较方便";
  if (/牛奶|酸奶|奶茶|奶昔|豆浆|米浆|汁|饮/.test(name)) return "以饮用为主，适合搭配主食或解腻";
  if (/鸡蛋|鸭蛋|皮蛋|咸蛋|水煮蛋|荷包蛋|蒸蛋|蛋饼/.test(name)) return "做法相对简单，蛋香和饱腹感比较明确";
  if (/包子|小笼包|馒头|烧卖|烧麦|虾饺|蒸饺|点心/.test(name)) return "多用蒸制做熟，热吃时香气更明显";
  if (/糯米鸡|珍珠鸡/.test(name)) return "通常用荷叶或蒸笼把糯米和馅料蒸透";
  if (/牛杂|牛百叶|金钱肚/.test(name)) return "常用卤汁或汤底慢煮，让牛杂吸足味道";
  if (/豉油|豉汁/.test(name)) return "多用豉油或豆豉调味，咸香会更清楚";
  if (/蒜蓉|蒜香/.test(name)) return "常用蒜蓉提香，入口会更开胃";
  if (/姜醋|糖醋|咕咾|咕噜/.test(name)) return "常用酸甜汁或姜醋调味，味道更醒口";
  if (/凉拌|冷盘/.test(name)) return "多用凉拌方式处理，调味直接清爽";
  if (/白切|白灼|清蒸|清炖|清汤/.test(name)) return "做法偏清爽，突出食材本味";
  if (/粽|裹蒸/.test(name)) return "通常包好后长时间蒸煮，让糯米吸足香味";
  if (/蒸/.test(name)) return "多用蒸制保留原味，香气比较干净";
  if (/煲仔饭/.test(name)) return "通常用砂煲把米饭和配料焗熟";
  if (/啫啫/.test(name)) return "常见做法是砂锅猛火收汁，酱香和锅气会更明显";
  if (/砂锅|煲|锅|火锅|边炉/.test(name)) return "多用热锅或汤底慢慢煮出味道";
  if (/粥/.test(name)) return "通常和米粥同煮，热乎软润";
  if (/肠粉|卷粉/.test(name)) return "通常把米浆蒸成薄皮，再配酱汁或馅料";
  if (/酸辣粉|螺蛳粉|汤粉|汤面|粿条汤|濑粉|云吞面|馄饨面|米线/.test(name)) return "多用热汤搭配粉面和配料";
  if (/粉|面|米线|河粉|粿条|馄饨|云吞|饺/.test(name)) return "多是干拌、快炒或汤煮，主食感比较明确";
  if (/烤鸭/.test(name)) return "通常烤到皮香肉嫩，再配饼皮或蘸料";
  if (/烤|烧|炭烤/.test(name)) return "常见做法是烤到带焦香，再配调味料";
  if (/臭豆腐/.test(name)) return "通常炸到外层成壳，再配酱汁或蘸料";
  if (/炸|煎|酥/.test(name)) return "做法偏香口，外层通常更酥脆";
  if (/炒|爆|干炒/.test(name)) return "多用旺火快炒，香气会更直接";
  if (/卤|酱|焖|炆|扣/.test(name)) return "通常靠酱汁或卤汁慢慢入味";
  if (/酿三宝|酿苦瓜|酿/.test(name)) return "常把馅料酿进蔬菜或豆制品里再煎焖";
  if (/汤|羹/.test(name)) return "以汤水为主，入口更暖和";
  if (dish.taste === "重口") return "调味会更明显，适合想吃有味道的时候";
  if (dish.taste === "清淡") return "调味相对轻，吃起来负担不重";
  if (dish.taste === "甜口") return "甜味更突出，适合当作轻松一点的选择";
  return "具体做法看店家习惯，通常会按当地口味处理";
}

function getMouthfeelText(dish) {
  const name = dish.name || "";
  if (/油条/.test(name)) return "外层酥香，里面松软，适合配粥或豆浆";
  if (/肉夹馍/.test(name)) return "馍香配肉香，吃起来扎实顶饱";
  if (/泡馍/.test(name)) return "汤味厚实，馍粒吸汤后更有饱腹感";
  if (/包子|小笼包|烧卖|烧麦|虾饺|蒸饺/.test(name)) return "外皮软热，馅料香气和汁水更明显";
  if (/糯米鸡|珍珠鸡/.test(name)) return "糯米软糯带肉香，吃起来很有饱腹感";
  if (/牛杂|牛百叶|金钱肚/.test(name)) return "口感有嚼劲，汤汁或卤香会更明显";
  if (/豉油|豉汁/.test(name)) return "咸鲜感更直接，配饭时尤其顺口";
  if (/蒜蓉|蒜香/.test(name)) return "蒜香明显，鲜味会被衬得更突出";
  if (/姜醋|糖醋|咕咾|咕噜/.test(name)) return "酸甜感更明显，吃起来更开胃";
  if (/凉拌|冷盘/.test(name)) return "入口清爽，调味轻快不拖沓";
  if (/白切|白灼|清蒸|清汤|老火|炖汤|例汤/.test(name)) return "口感清爽，鲜味更靠食材本身";
  if (/煲仔饭/.test(name)) return "米饭带锅巴香，吃起来更顶饱";
  if (/啫啫|砂锅|煲|锅/.test(name)) return "入口热乎，酱香或汤香会更集中";
  if (/粥/.test(name)) return "入口温和，适合想吃热乎一点的时候";
  if (/酸辣粉|螺蛳粉|汤粉|汤面|粿条汤|濑粉|云吞面|馄饨面|米线/.test(name)) return "粉面滑顺，汤底通常比较鲜";
  if (/热干面|炒粉|炒面|干炒|捞粉|捞面|腌面/.test(name)) return "拌料香气更明显，主食感强";
  if (/肠粉|卷粉|粿|粄|糕/.test(name)) return "米香和软滑感明显，吃起来比较顺口";
  if (/烧鹅|烧鸭|烧腊|叉烧|乳猪|红烧乳鸽|烤|烧/.test(name)) return "外层香口，油脂和肉香更突出";
  if (/卤|酱|焖|炆|扣/.test(name)) return "咸香感比较足，越嚼越有味道";
  if (/酿三宝|酿苦瓜|酿/.test(name)) return "馅料香和蔬菜清香会混在一起，层次更足";
  if (/粽|裹蒸/.test(name)) return "糯香紧实，吃起来更有饱腹感";
  if (/臭豆腐/.test(name)) return "外脆内软，酱香和发酵香更有辨识度";
  if (/炸|煎|酥|脆/.test(name)) return "外层更香脆，吃起来偏解馋";
  if (/炒|爆/.test(name)) return "香气直接，口味通常更利落";
  if (/糖水|甜汤|双皮奶|姜撞奶|豆沙|芝麻糊|龟苓膏|西米露/.test(name)) return "甜润顺口，适合饭后或想吃轻甜时";
  if (dish.taste === "清淡") return "整体偏清爽，负担不重";
  if (dish.taste === "重口") return "调味更足，吃起来更有存在感";
  if (dish.taste === "甜口") return "甜味更明显，适合当作轻松一点的选择";
  return "整体以顺口耐吃为主，具体轻重看店家调味";
}

function makeStructuredDescription(dish) {
  const ingredientText = getMainIngredientText(dish);
  const cookingText = getCookingText(dish);
  const mouthfeelText = getMouthfeelText(dish);
  return `主要用${ingredientText}，${cookingText}，${mouthfeelText}。`;
}

function isTemplateDishFact(text) {
  return /是.*类选择/.test(text || "") ||
    /属于.*类/.test(text || "") ||
    /热乎、份量感较强/.test(text || "") ||
    /适合.*或多人慢慢吃/.test(text || "");
}

function makeDescription(dish) {
  return makeStructuredDescription(dish);
}

function buildDishTruthNotes(dish) {
  const notes = [];
  const meal = getMealText(dish);
  const source = getSourceText(dish);
  const avoidTags = (dish.avoidTags || []).filter(Boolean);
  const used = {};
  const addNote = (note) => {
    if (!note || used[note] || note === dish.description || notes.length >= 3) return;
    used[note] = true;
    notes.push(note);
  };

  addNote(`${dish.name}属于${getDishKindText(dish)}，适合${meal}。`);

  if (avoidTags.length) {
    addNote(`介意${avoidTags.slice(0, 3).join("、")}的话，点之前先确认食材或做法。`);
  } else if (/虾|蟹|蚝|鱼|贝|海参|螺|鱿/.test(dish.name) || (dish.tags || []).includes("海鲜")) {
    addNote("带海鲜属性，不吃海鲜的人建议换一个。");
  } else if (/鸡翅|鸡腿|鸡爪|鸡胗|鸡肉|鸡排|鸡块|鸭|鹅|牛腩|牛杂|牛肉|牛百叶|牛排|牛丸|牛筋|牛肚|牛蹄|羊|猪|肉|排骨|蹄|鸽/.test(dish.name) || (dish.tags || []).includes("肉类")) {
    addNote("肉类存在感比较强，素食或忌口肉类的人不适合。");
  } else {
    addNote(`更适合${meal}，具体分量和口味看店家做法。`);
  }

  addNote(source);
  return notes;
}

function makePollText(dish) {
  return `${dish.name}要不要进这轮饭局？投它一票，今晚少纠结一点。`;
}

function getDishIllustrationKey(dish) {
  const tags = dish.tags || [];
  const name = dish.name || "";
  if (/叉烧包|小笼包|鲜肉大包|包子|肉包|蒸包|菜包|青菜包|豆沙包|奶黄包|馒头|蒸馍|花卷|包$/.test(name)) return "bread";
  if (/煎饼|手抓饼|葱油饼|鸡蛋饼|灌饼|烧饼|油饼|土豆丝饼|玉米饼|南瓜饼|麦饼|饼$/.test(name)) return "bread";
  if (/蒸山药|蒸芋头|蒸红薯|蒸玉米|山药|芋头|红薯|番薯|地瓜|玉米/.test(name)) return "bread";
  if (/面包|吐司|三明治|汉堡/.test(name)) return "bread";
  if (/肠粉|猪肠粉|布拉肠粉|石磨肠粉|圆盘肠粉|卷粉/.test(name)) return "ricecake";
  if (/汤粉|汤面|汤河粉|汤米粉|粿条汤|汤粿条|河粉汤|米粉汤|濑粉|粉汤|面汤|米线|云吞面|馄饨面|牛肉面|羊肉面|拉面/.test(name)) return "soupnoodle";
  if (tags.includes("面食") || tags.includes("汤粉") || tags.includes("米粉") || tags.includes("粉面") || /濑粉|面|米线|河粉|粿条|捞粉|捞面|炒粉|炒面/.test(name)) return "noodle";
  if (/早茶|茶点|点心|烧卖|烧麦|虾饺|叉烧包|奶黄包|流沙包|小笼包|包子|馒头|蒸饺/.test(name)) return "dimsum";
  if (/饺|水饺|煎饺|蒸饺|锅贴|云吞|馄饨|抄手/.test(name)) return "dumpling";
  if (/糖水|甜汤|绿豆沙|红豆沙|银耳汤|桃胶|双皮奶|姜撞奶|芝麻糊|甜品汤/.test(name)) return "sweetSoup";
  if (/粥|糊|汤羹|羹|豆花/.test(name)) return "congee";
  if (/老火汤|炖汤|例汤|汤|鸡汤|鸭汤|骨汤|排骨汤|羊汤|牛杂汤|鱼汤|肉丸汤/.test(name)) return "soup";
  if (/草仔粿|肉圆|粿|糕粿|米粿|粄|肠粉|卷粉|米糕|萝卜糕|芋头糕|年糕/.test(name)) return "ricecake";
  if (/饭|煲仔饭|盖浇|盖饭|拌饭|炒饭|烩饭|捞饭|焗饭/.test(name)) return "ricebowl";
  if (/烧烤|烤串|烤肉|烤生蚝|烤茄子|烤面筋|烤鸡翅|烤鸡腿|烧烤拼盘/.test(name)) return "bbq";
  if (/烧烤|烤串|串串|羊肉串|牛肉串|鸡翅|鸡腿|烤茄子|烤面筋|烤生蚝|烤鱼|烤肉/.test(name)) return "skewer";
  if (dish.category === "饮品") return "drink";
  if (/盐酥鸡|炸鸡|鸡排|蚵仔煎|菜脯蛋|铁蛋/.test(name)) return "fried";
  if (/芋圆|绿豆糕|草仔粿/.test(name)) return "sweetSoup";
  if (/卤肉饭|滷肉饭/.test(name)) return "ricebowl";
  if (/肉圆/.test(name)) return "ricecake";
  if (dish.category === "甜品" || tags.includes("甜品") || tags.includes("糕点")) return "dessert";
  if (/白切鸡|豉油鸡|盐焗鸡|烧鸡|烧鹅|烧鸭|卤鹅|卤鸭|卤鸡|乳鸽|鸭|鹅|鸡/.test(name)) return "poultry";
  if (/烧鹅|烧鸭|烧鸡|烧腊|叉烧|白切鸡|豉油鸡|盐焗鸡|卤鹅|卤鸭|卤鸡|卤肉|卤味|卤水|酱鸭|酱牛肉/.test(name)) return "roast";
  if (/鱼|鲫|鲤|鲈|鳜|草鱼|黑鱼|酸菜鱼|水煮鱼|清蒸鱼|红烧鱼|鱼片|鱼头/.test(name)) return "fish";
  if (/凉拌|凉皮|凉面|冷面|冷盘|捞粉|捞面|拍黄瓜|沙拉|拌黄瓜|拌木耳|口水鸡/.test(name)) return "cold";
  if (/炸|煎|锅贴|春卷|油条|酥|脆皮|天妇罗|椒盐/.test(name)) return "fried";
  if (tags.includes("海鲜") || /虾|蟹|鱼|蚝|贝|海参|螺/.test(name)) return "seafood";
  if (/火锅|边炉|汤锅|锅子/.test(name)) return "hotpot";
  if (/煲|砂锅|啫啫/.test(name)) {
    if (tags.includes("面食") || tags.includes("汤粉") || tags.includes("米粉") || tags.includes("粉面") || /面|粉|米线|河粉|粿条/.test(name)) return "noodle";
    if (tags.includes("肉类") || /鸡|鸭|鹅|牛|羊|猪|肉|排骨|蹄|肘|腩|杂/.test(name)) return "meat";
    if (tags.includes("海鲜") || /虾|蟹|蚝|贝|海参|螺|泥虫/.test(name)) return "seafood";
    return "soup";
  }
  if (tags.includes("面食") || tags.includes("汤粉") || tags.includes("米粉") || tags.includes("粉面") || /面|粉|米线|河粉|馄饨|饺/.test(name)) return "noodle";
  if (tags.includes("肉类") || /鸡|鸭|鹅|牛|羊|猪|肉|排骨|蹄|肘/.test(name)) return "meat";
  if (/炒|爆|煎|焖|烧|炖|卤|扣|蒸|拌|煮|酸菜|豆腐|青菜|茄子|土豆|番茄|鸡蛋/.test(name)) return "stirfry";
  if (dish.category === "小吃") return "snack";
  return "meal";
}

function attachIllustration(dish) {
  const illustrationKey = getDishIllustrationKey(dish);
  dish.illustrationKey = illustrationKey;
  dish.illustrationSrc = FOOD_ILLUSTRATIONS[illustrationKey] || FOOD_ILLUSTRATIONS.meal;
  return dish;
}

function attachDishIllustration(dish) {
  return attachIllustration(Object.assign({}, dish));
}

function applyDishOverrides(dish) {
  const override = DISH_FIELD_OVERRIDES[dish.name];
  if (override) {
    return Object.assign(dish, override, {
      mealTime: override.mealTime ? override.mealTime.slice() : dish.mealTime,
      tags: override.tags ? override.tags.slice() : dish.tags
    });
  }

  if ((dish.name || "").includes("\u8c46\u8150\u82b1")) {
    return Object.assign(dish, {
      category: "\u751c\u54c1",
      tags: mergeTags(dish.tags, ["\u751c\u54c1"])
    });
  }

  if (shouldTreatAsMealDish(dish)) {
    return Object.assign(dish, {
      category: "\u6b63\u9910",
      taste: dish.taste === "\u751c\u53e3" ? "\u9c9c\u9999" : dish.taste,
      tags: mergeTags(dish.tags, ["\u4e0b\u996d"]),
      iconType: /鸡|鸭|鹅|牛|羊|猪|肉|排骨|蹄|鸽/.test(dish.name) ? "flame" : dish.iconType
    });
  }

  if (shouldTreatAsSavorySnack(dish)) {
    return Object.assign(dish, {
      category: "\u5c0f\u5403",
      taste: dish.taste === "\u751c\u53e3" ? "\u9c9c\u9999" : dish.taste,
      tags: mergeTags(dish.tags, ["\u5c0f\u5403"]),
      iconType: "bowl"
    });
  }

  return dish;
}

function removeUnfitBreakfastLabel(dish) {
  if (!dish.mealTime || !dish.mealTime.includes("\u65e9\u9910")) return dish;
  const text = [
    dish.name,
    dish.category,
    dish.taste,
    ...(dish.tags || [])
  ].filter(Boolean).join("");
  const name = dish.name || "";
  const isStapleBreakfast = BREAKFAST_STAPLE_PATTERNS.some((pattern) => pattern.test(name));
  const isSweetSnack = (dish.category === "\u751c\u54c1" || (dish.tags || []).includes("\u96f6\u98df")) &&
    BREAKFAST_SWEET_SNACK_PATTERNS.some((pattern) => pattern.test(text)) &&
    !/粥|粢饭|煎饼|烧饼|大饼|油条/.test(name);
  const isBlocked = BREAKFAST_LABEL_BLOCK_PATTERNS.some((pattern) => pattern.test(text)) ||
    BREAKFAST_HARD_DISH_PATTERNS.some((pattern) => pattern.test(name)) ||
    isSweetSnack ||
    (BREAKFAST_HEAVY_MEAT_PATTERN.test(name) && !isStapleBreakfast);
  if (!isBlocked) return dish;
  dish.mealTime = dish.mealTime.filter((meal) => meal !== "\u65e9\u9910");
  return dish;
}

function removeUnfitLateNightLabel(dish) {
  if (!dish.mealTime || !dish.mealTime.includes("\u5bb5\u591c")) return dish;
  const text = [
    dish.name,
    dish.category,
    dish.taste,
    ...(dish.tags || [])
  ].filter(Boolean).join("");
  const name = dish.name || "";
  const isLateNightKeep = LATE_NIGHT_KEEP_PATTERNS.some((pattern) => pattern.test(name));
  const isStrongBlocked = LATE_NIGHT_STRONG_BLOCK_PATTERNS.some((pattern) => pattern.test(text));
  const isSweetSnack = (dish.category === "\u751c\u54c1" || (dish.tags || []).includes("\u7cd5\u70b9")) && !isLateNightKeep;
  const isBlocked = isStrongBlocked || isSweetSnack || LATE_NIGHT_BLOCK_PATTERNS.some((pattern) => pattern.test(text));
  if (isStrongBlocked) {
    dish.mealTime = dish.mealTime.filter((meal) => meal !== "\u5bb5\u591c");
    return dish;
  }
  if (!isBlocked || isLateNightKeep) return dish;
  dish.mealTime = dish.mealTime.filter((meal) => meal !== "\u5bb5\u591c");
  return dish;
}

function removeUnfitMealLabels(dish) {
  if (!dish.mealTime || (!dish.mealTime.includes("\u5348\u9910") && !dish.mealTime.includes("\u665a\u9910"))) return dish;
  const text = [
    dish.name,
    dish.category,
    dish.taste,
    ...(dish.tags || [])
  ].filter(Boolean).join("");
  const name = dish.name || "";
  const isMealKeep = MEAL_LABEL_KEEP_PATTERNS.some((pattern) => pattern.test(name));
  const isStrongBlocked = MEAL_LABEL_STRONG_BLOCK_PATTERNS.some((pattern) => pattern.test(text));
  const isSweetSnack = (dish.category === "\u751c\u54c1" || (dish.tags || []).includes("\u96f6\u98df") || (dish.tags || []).includes("\u7cd5\u70b9")) &&
    !isMealKeep;
  const isBlocked = isStrongBlocked || isSweetSnack || MEAL_LABEL_BLOCK_PATTERNS.some((pattern) => pattern.test(text));
  if (isStrongBlocked) {
    dish.mealTime = dish.mealTime.filter((meal) => meal !== "\u5348\u9910" && meal !== "\u665a\u9910");
    return dish;
  }
  if (!isBlocked || isMealKeep) return dish;
  dish.mealTime = dish.mealTime.filter((meal) => meal !== "\u5348\u9910" && meal !== "\u665a\u9910");
  return dish;
}

function mergeTags(tags, extraTags) {
  const map = {};
  (tags || []).concat(extraTags || []).forEach((tag) => {
    if (tag) map[tag] = true;
  });
  return Object.keys(map);
}

function shouldTreatAsSavorySnack(dish) {
  const name = dish.name || "";
  if (dish.category !== "\u751c\u54c1") return false;
  if (/糖|甜|奶|酥糖|凉果|双皮奶|姜撞奶|汤圆|青团|糕|糍|粿|月饼|老婆饼|老公饼|钵仔糕|马拉糕/.test(name)) {
    return false;
  }
  return /大饼|葱油饼|鸡蛋饼|煎饼|肉饼|春饼|贴饼|麦饼|粢饭|粽子|烧饼|油条|锅贴|包|面点/.test(name);
}

function shouldTreatAsMealDish(dish) {
  const name = dish.name || "";
  if (dish.category !== "\u751c\u54c1" && dish.category !== "\u5c0f\u5403") return false;
  if (/糖|甜|糕|饼干|凉果|汤圆|青团|米糕|酥糖|麦芽糖/.test(name)) return false;
  return /鸡|鸭|鹅|鱼|虾|蟹|蚝|猪|牛|羊|排骨|扣肉|烧鹅|乳鸽|汤锅|煲|盆菜|全鸭/.test(name);
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
  removeUnfitBreakfastLabel(dish);
  removeUnfitLateNightLabel(dish);
  removeUnfitMealLabels(dish);
  dish.phrase = makePhrase(dish);
  dish.description = makeDescription(dish);
  dish.truthNotes = buildDishTruthNotes(dish);
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
  if (shouldDropLowConfidenceGenericDish(dish)) {
    return true;
  }
  if (hasDisallowedPlaceName(dish)) {
    return true;
  }
  if (dish.sourceBucket === "cityExact" || dish.sourceBucket === "nationalGeneral") {
    return false;
  }
  return selectableCityNames.some((cityName) => (
    cityName !== dish.city && dish.name.includes(cityName)
  ));
}

function shouldDropLowConfidenceGenericDish(dish) {
  return (
    dish.sourceBucket === "cityExact" &&
    LOW_CONFIDENCE_GENERIC_NAMES[dish.name] &&
    !dishFacts[dish.name]
  );
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

function registerProvinceData(provinceData) {
  if (!provinceData || !provinceData.province || !Array.isArray(provinceData.dishes)) return;
  const province = provinceData.province;
  (provinceData.cities || []).forEach((city) => {
    citySlogans[city] = `${city}饭点灵感，等你来转。`;
  });
  provinceData.dishes.forEach((compactDish, index) => {
    const dish = expandDish(compactDish, province, index);
    if (shouldDropSharedPlaceDish(dish)) return;
    registerDish(dish, dishIndexByCityName);
  });
}

function ensureAllDishes() {
  if (allDishes) return allDishes;

  allDishes = [];
  dishIndexByCityName = {};
  Object.keys(coreProvinceDataMap).forEach((slug) => {
    registerProvinceData(coreProvinceDataMap[slug]);
  });

  registerNationalFallbackDishes();

  return allDishes;
}

function requireProvinceData(slug) {
  let cleanup = null;
  const loadPromise = new Promise((resolve, reject) => {
    if (typeof wx === "undefined") {
      try {
        const provinceLoader = require("../package-data/province-loader");
        const provinceData = provinceLoader.getProvinceData(slug);
        if (!provinceData) {
          reject(new Error(`Missing province data: ${slug}`));
          return;
        }
        resolve(provinceData);
      } catch (error) {
        reject(error);
      }
      return;
    }

    const app = getApp();
    app.globalData.__provinceDataBySlug = app.globalData.__provinceDataBySlug || {};
    app.globalData.__provinceLoadCallbacks = app.globalData.__provinceLoadCallbacks || {};
    if (app.globalData.__provinceDataBySlug[slug]) {
      resolve(app.globalData.__provinceDataBySlug[slug]);
      return;
    }

    const requestId = `${slug}_${Date.now()}_${Math.floor(Math.random() * 100000)}`;
    cleanup = () => {
      delete app.globalData.__provinceLoadCallbacks[requestId];
    };
    app.globalData.__provinceLoadCallbacks[requestId] = (provinceData) => {
      cleanup();
      if (!provinceData) {
        reject(new Error(`Missing province data: ${slug}`));
        return;
      }
      resolve(provinceData);
    };

    wx.navigateTo({
      url: `/package-data/pages/loader/loader?slug=${encodeURIComponent(slug)}&requestId=${encodeURIComponent(requestId)}`,
      fail: (error) => {
        cleanup();
        reject(error);
      }
    });
  });
  return withTimeout(loadPromise, PROVINCE_LOAD_TIMEOUT_MS, `Load province data timeout: ${slug}`, cleanup);
}

function ensurePackageDataLoaded() {
  packageDataLoadPromise = packageDataLoadPromise || Promise.resolve();
  return packageDataLoadPromise;
}

function withTimeout(promise, timeoutMs, message, onTimeout) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      if (onTimeout) onTimeout();
      reject(new Error(message));
    }, timeoutMs);
    promise.then((value) => {
      clearTimeout(timer);
      resolve(value);
    }, (error) => {
      clearTimeout(timer);
      reject(error);
    });
  });
}

function ensureProvinceLoaded(provinceName) {
  const slug = slugByProvince[provinceName];
  if (!slug || provinceDataCache[slug]) return Promise.resolve(provinceDataCache[slug] || null);
  if (provinceLoadPromises[slug]) return provinceLoadPromises[slug];
  ensureAllDishes();
  provinceLoadPromises[slug] = ensurePackageDataLoaded()
    .then(() => requireProvinceData(slug))
    .then((provinceData) => {
      provinceDataCache[slug] = provinceData;
      registerProvinceData(provinceData);
      return provinceData;
    })
    .catch((error) => {
      delete provinceLoadPromises[slug];
      console.error("省份菜品分包加载失败", provinceName, slug, error);
      return null;
    });
  return provinceLoadPromises[slug];
}

function normalizeFilter(value) {
  if (value === "夜宵") return "宵夜";
  return value;
}

function normalizeSearchKeyword(value) {
  const text = String(value || "").trim();
  if (text === "夜宵") return "宵夜";
  return text;
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
  const city = cityByName[name] ||
    selectableCities.find((item) => item.name === name || item.fullName === name) ||
    selectableCities[0];
  const slogan = citySlogans[city.name] || city.slogan || `${city.name}饭点灵感，等你来转。`;
  return Object.assign({}, city, { slogan });
}

function resolveMealPoolDishById(id) {
  const text = String(id || "");
  const match = /^meal_(breakfast|lateNight)_/.exec(text);
  if (!match) return null;
  const poolKey = match[1];
  const mealTime = poolKey === "breakfast" ? "早餐" : "夜宵";
  const pool = homeMealPools[poolKey] || [];
  for (let cityIndex = 0; cityIndex < selectableCities.length; cityIndex += 1) {
    const city = selectableCities[cityIndex];
    for (let itemIndex = 0; itemIndex < pool.length; itemIndex += 1) {
      const item = pool[itemIndex];
      const expectedId = `meal_${poolKey}_${hashText(`${city.name}|${item.name}`)}`;
      if (expectedId === text) {
        const dish = makeMealPoolDish(item, city.name, mealTime, itemIndex);
        dishById[dish.id] = dish;
        return dish;
      }
    }
  }
  return null;
}

function getDishById(id) {
  ensureAllDishes();
  return dishById[id] || resolveMealPoolDishById(id);
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
  if (!slug) return [];
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
  dish.truthNotes = buildDishTruthNotes(dish);
  dish.pollText = makePollText(dish);
  return attachIllustration(dish);
}

function getMealPoolKey(mealTime) {
  if (mealTime === "早餐") return "breakfast";
  if (mealTime === "夜宵" || mealTime === "宵夜") return "lateNight";
  return "";
}

function normalizeMealPoolAvoidTags(name, avoidTags) {
  const tags = (avoidTags || []).filter(Boolean);
  const hasRealMeat = /鸡翅|鸡腿|鸡爪|鸡胗|鸡肉|鸡排|鸡块|鸭|鹅|牛腩|牛杂|牛肉|牛百叶|牛排|牛丸|牛筋|牛肚|牛蹄|羊|猪|排骨|五花肉|猪杂|猪肝|猪蹄|里脊|瘦肉|肥肠|肉丸|酥肉/.test(name);
  if (!hasRealMeat && /牛奶|奶茶|酸奶|奶昔|鸡蛋|鸭蛋|皮蛋|咸蛋|水煮蛋|荷包蛋|蒸蛋|蛋饼/.test(name)) {
    return tags.filter((tag) => tag !== "肉类");
  }
  return tags;
}

function normalizeMealPoolTags(name, tags) {
  return normalizeMealPoolAvoidTags(name, tags);
}

function makeMealPoolDish(item, city, mealTime, index) {
  const normalizedMeal = normalizeFilter(mealTime);
  const tags = normalizeMealPoolTags(item.name, item.tags);
  const avoidTags = normalizeMealPoolAvoidTags(item.name, item.avoidTags);
  const dish = {
    id: `meal_${getMealPoolKey(normalizedMeal)}_${hashText(`${city}|${item.name}`)}`,
    city,
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
    order: index
  };
  dish.phrase = item.phrase || (normalizedMeal === "早餐" ? `${dish.name}适合早上先垫一口。` : `${dish.name}适合夜里解个馋。`);
  dish.description = makeDescription(dish);
  dish.truthNotes = buildDishTruthNotes(dish);
  dish.pollText = `${dish.name}要不要放进这顿？想吃就投一票。`;
  return attachIllustration(dish);
}

function matchesMealPoolFilters(dish, filters) {
  const avoidTags = filters.avoidTags || [];
  return (
    !avoidTags.some((tag) => dishMatchesAvoidTag(dish, tag)) &&
    matchesValue(dish.mealTime, filters.mealTime) &&
    matchesValue(dish.category, filters.category) &&
    matchesValue(dish.taste, filters.taste) &&
    matchesValue(dish.scene, filters.scene)
  );
}

function getMealPoolCandidateDishes(filters, existingKeys) {
  const poolKey = getMealPoolKey(filters.mealTime);
  const source = homeMealPools[poolKey] || [];
  const dishes = source.map((item, index) => makeMealPoolDish(item, filters.city, filters.mealTime, index));
  const usedKeys = existingKeys || {};
  const matched = dishes.filter((dish) => {
    if (!matchesMealPoolFilters(dish, filters)) return false;
    const key = normalizeMealDishKey(dish.name);
    if (usedKeys[key]) return false;
    usedKeys[key] = true;
    return true;
  });
  matched.forEach((dish) => {
    dishById[dish.id] = dish;
  });
  return matched;
}

function getMealMixedCandidateDishes(filters) {
  const cityDishes = getDishesByCity(filters.city);
  const usedKeys = {};
  const localPool = cityDishes.filter((dish) => (
    dish.sourceBucket === "cityExact" &&
    matchesCandidateFilters(dish, filters)
  )).filter((dish) => {
    const key = normalizeMealDishKey(dish.name);
    if (usedKeys[key]) return false;
    usedKeys[key] = true;
    return true;
  }).map((dish) => Object.assign({}, dish, {
    weight: Math.max(dish.weight || 0, 10)
  }));

  const mealPool = getMealPoolCandidateDishes(filters, usedKeys);
  if (!localPool.length) return mealPool;
  const mixedMealPool = shuffleList(mealPool).slice(0, MAX_MEAL_POOL_MIX_COUNT);
  return localPool.concat(mixedMealPool.map((dish) => Object.assign({}, dish, {
    weight: Math.min(dish.weight || 5, 5)
  })));
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
  const mealPoolKey = getMealPoolKey(normalized.mealTime);
  if (mealPoolKey) {
    return getMealMixedCandidateDishes(normalized);
  }
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
  const text = normalizeSearchKeyword(keyword).toLowerCase();
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
  ensureProvinceLoaded,
  attachDishIllustration,
  getProposalDishes,
  getCandidateDishes,
  spinDish,
  searchDishes
};
