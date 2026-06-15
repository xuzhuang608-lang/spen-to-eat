const fs = require("fs");
const path = require("path");

const ROOT = path.resolve(__dirname, "..");
const SOURCE = path.join(ROOT, "project-prep", "food-import-ready-miniprogram.json");
const PROVINCE_DIR = path.join(ROOT, "miniprogram", "data", "provinces");
const INDEX_FILE = path.join(PROVINCE_DIR, "index.js");
const SELECTED_FILE = path.join(ROOT, "project-prep", "selected-meal-time-additions.json");
const SUMMARY_FILE = path.join(ROOT, "project-prep", "selected-meal-time-additions-summary.json");
const TARGET_ADDITIONS = 40;
const MAX_SELECTED_PER_CITY = 2;
const MAX_NATIONAL_TOTAL = 24;
const MAX_NATIONAL_PER_NAME = 5;
const MAX_NATIONAL_PER_PROVINCE = 4;

const provinceIndex = require("../miniprogram/data/provinces/index");
const { getCities, getDishesByCity } = require("../miniprogram/services/dish");

const dictionaries = provinceIndex.dictionaries;
const dictIndex = Object.keys(dictionaries).reduce((map, key) => {
  map[key] = dictionaries[key].reduce((inner, value, index) => {
    inner[value] = index;
    return inner;
  }, {});
  return map;
}, {});

const BREAKFAST = "早餐";
const SUPPER = "宵夜";

const genericNames = new Set([
  "海鲜", "本地鸡", "粥类", "火锅", "奶茶", "烧烤", "小吃", "甜品",
  "饮品", "家常菜", "炒饭", "干拌", "酿皮", "粉条"
]);

const riskTerms = [
  "狗肉", "蛇", "蝎", "野味", "生牛肉", "河豚", "活鱼", "田鸡", "牛蛙",
  "甲鱼", "鳖", "羊腥", "马肉", "驴肉", "全驴", "仙驴", "青蛙", "孔雀",
  "兔头", "血", "狗浇尿"
];

const nonDishTerms = [
  "首选", "推荐", "必吃", "最好", "做法", "锅底", "一绝", "拼盘", "全席",
  "宴", "爽滑", "顺滑", "绵滑", "细腻", "劲道", "柔顺", "爽口", "清香",
  "鲜美", "软烂", "浓郁", "可清蒸", "粉糯", "的"
];

const breakfastNameTerms = [
  "面", "粉", "粥", "包子", "花包", "油包子", "破酥包", "汤包", "烧麦",
  "饼", "糕", "馍", "馄饨", "汤", "茶", "豆", "粿", "粄", "油塔子",
  "大列巴", "卜粉", "煎饼", "藕粉", "油茶", "粉汤"
];

const breakfastCategories = new Set(["小吃", "甜品", "饮品"]);
const supperLightCategories = new Set(["小吃", "甜品", "饮品"]);

const breakfastRejectTerms = [
  "锅包肉", "锅包肘子", "狮子头", "烤全羊", "烤乳猪", "和乐蟹",
  "粉蒸肉", "粉蒸牛肉", "包公鱼", "鸭脚包", "馕包肉", "烤面筋",
  "烤年糕", "烤鸡翅", "烤鸡腿", "烤茄子", "烤韭菜", "烤辣椒",
  "烤馒头"
];

const supperNameTerms = [
  "串", "面", "粉", "饼", "包", "饺", "馄饨", "粥", "烧梅", "凉粉",
  "酿皮", "炒饭", "炒粉", "炒面", "河粉", "麻辣烫", "烤冷面", "小龙虾",
  "烤鱼", "烤鸡翅", "烤鸡腿", "烤茄子", "烤韭菜", "烤辣椒", "烤馒头",
  "烤面筋", "烤年糕", "羊肉串", "烤肉", "鸡架", "鸭货", "卤味"
];

const supperRejectTerms = [
  "烤全羊", "全羊", "烤乳猪", "香猪", "烤猪方", "烤羊腿", "羊排",
  "烤鸭", "火锅", "宴", "全席", "整只", "粉蒸肉", "粉蒸牛肉"
];

const sourceBucketScore = {
  cityExact: 100,
  regionalShared: 70,
  provinceShared: 45,
  nationalGeneral: 35
};

function splitList(value) {
  if (Array.isArray(value)) return value.map((item) => String(item).trim()).filter(Boolean);
  return String(value || "").split(/[\/,，]/).map((item) => item.trim()).filter(Boolean);
}

function normalizeDishName(name) {
  return String(name || "").trim().replace(/\s+/g, "");
}

function hasAnyTerm(name, terms) {
  return terms.some((term) => name.includes(term));
}

function isBreakfastLike(row, name) {
  return breakfastCategories.has(row.category) &&
    breakfastNameTerms.some((term) => name.includes(term)) &&
    !breakfastRejectTerms.some((term) => name.includes(term));
}

function isSupperLike(row, name) {
  const tags = splitList(row.tags);
  const hasLightTag = tags.some((tag) => ["夜宵", "小吃", "粉面", "糕点", "甜品"].includes(tag));
  const hasSupperName = supperNameTerms.some((term) => name.includes(term));
  if (supperRejectTerms.some((term) => name.includes(term))) return false;
  return supperLightCategories.has(row.category) || hasLightTag || hasSupperName;
}

function withAdjustedMealTime(row, helpsBreakfast, helpsSupper) {
  return Object.assign({}, row, {
    mealTime: splitList(row.mealTime).filter((meal) => {
      if (meal === BREAKFAST) return helpsBreakfast;
      if (meal === SUPPER) return helpsSupper;
      return true;
    })
  });
}

function toNumber(value, fallback) {
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
}

function toCompactDish(row) {
  return {
    c: row.city,
    n: normalizeDishName(row.name),
    k: dictIndex.category[row.category] ?? 0,
    t: dictIndex.taste[row.taste] ?? 1,
    m: splitList(row.mealTime).map((item) => dictIndex.mealTime[item]).filter((item) => item !== undefined),
    s: splitList(row.scene).map((item) => dictIndex.scene[item]).filter((item) => item !== undefined),
    a: splitList(row.avoidTags).map((item) => dictIndex.avoidTag[item]).filter((item) => item !== undefined),
    g: splitList(row.tags),
    l: toNumber(row.localIndex, 3),
    i: dictIndex.iconType[row.iconType] ?? 0,
    w: toNumber(row.weight, 7),
    b: dictIndex.sourceBucket[row.sourceBucket] ?? 0
  };
}

function compactSelectedRow(row) {
  return {
    province: row.province,
    city: row.city,
    name: normalizeDishName(row.name),
    category: row.category,
    taste: row.taste,
    mealTime: Array.isArray(row.mealTime) ? row.mealTime.join("/") : row.mealTime,
    scene: Array.isArray(row.scene) ? row.scene.join("/") : row.scene,
    tags: Array.isArray(row.tags) ? row.tags.join("/") : row.tags,
    avoidTags: Array.isArray(row.avoidTags) ? row.avoidTags.join("/") : row.avoidTags,
    localIndex: String(row.localIndex),
    iconType: row.iconType,
    weight: String(row.weight),
    sourceBucket: row.sourceBucket
  };
}

function loadProvinceData() {
  return provinceIndex.provinces.reduce((map, province) => {
    const file = path.join(PROVINCE_DIR, province.file);
    delete require.cache[require.resolve(file)];
    map[province.province] = {
      slug: province.slug,
      file: province.file,
      data: require(file)
    };
    return map;
  }, {});
}

function loadPreviousSelectedRows() {
  if (!fs.existsSync(SELECTED_FILE)) return [];
  return JSON.parse(fs.readFileSync(SELECTED_FILE, "utf8")).rows || [];
}

function collectCurrentState(previousSelectedRows) {
  const existingKeys = new Set();
  const cityMealCounts = {};
  const previousKeys = new Set(previousSelectedRows.map((row) => (
    `${row.province}|${row.city}|${normalizeDishName(row.name)}`
  )));

  getCities().forEach((city) => {
    const dishes = getDishesByCity(city.name);
    const activeDishes = dishes.filter((dish) => !previousKeys.has(
      `${dish.province}|${dish.city}|${normalizeDishName(dish.name)}`
    ));
    cityMealCounts[city.name] = {
      breakfast: activeDishes.filter((dish) => dish.mealTime.includes(BREAKFAST)).length,
      supper: activeDishes.filter((dish) => dish.mealTime.includes(SUPPER)).length
    };
    activeDishes.forEach((dish) => {
      existingKeys.add(`${dish.province}|${dish.city}|${dish.name}`);
    });
  });
  return { existingKeys, cityMealCounts };
}

function getSelectableCityNames() {
  return getCities()
    .map((city) => city.name)
    .filter((name) => name && name.length >= 2)
    .sort((a, b) => b.length - a.length);
}

function hasOtherCityMarker(row, selectableCityNames) {
  if (row.sourceBucket === "cityExact" || row.sourceBucket === "nationalGeneral") return false;
  return selectableCityNames.some((cityName) => cityName !== row.city && row.name.includes(cityName));
}

function isEligible(row, state, selectableCityNames, selectableCitySet) {
  const name = normalizeDishName(row.name);
  const mealTime = Array.isArray(row.mealTime) ? row.mealTime : splitList(row.mealTime);
  const cityCounts = state.cityMealCounts[row.city] || { breakfast: 0, supper: 0 };

  if (!row.province || !row.city || !name || !selectableCitySet.has(row.city)) return false;
  if (state.existingKeys.has(`${row.province}|${row.city}|${name}`)) return false;
  if (!["cityExact", "regionalShared", "provinceShared", "nationalGeneral"].includes(row.sourceBucket)) return false;
  if (!mealTime.includes(BREAKFAST) && !mealTime.includes(SUPPER)) return false;
  if (genericNames.has(name) || hasAnyTerm(name, riskTerms) || hasAnyTerm(name, nonDishTerms)) return false;
  if (hasOtherCityMarker(row, selectableCityNames)) return false;
  if (name.length > 10) return false;
  const minLocalIndex = row.sourceBucket === "nationalGeneral" ? 2 : 3;
  const minWeight = row.sourceBucket === "nationalGeneral" ? 4 : 6;
  if (toNumber(row.localIndex, 0) < minLocalIndex || toNumber(row.weight, 0) < minWeight) return false;

  const helpsBreakfast = mealTime.includes(BREAKFAST) && cityCounts.breakfast < 8 && isBreakfastLike(row, name);
  const helpsSupper = mealTime.includes(SUPPER) && cityCounts.supper < 6 && isSupperLike(row, name);
  return helpsBreakfast || helpsSupper;
}

function scoreRow(row, state) {
  const mealTime = Array.isArray(row.mealTime) ? row.mealTime : splitList(row.mealTime);
  const cityCounts = state.cityMealCounts[row.city] || { breakfast: 0, supper: 0 };
  const breakfastDeficit = mealTime.includes(BREAKFAST) ? Math.max(0, 8 - cityCounts.breakfast) : 0;
  const supperDeficit = mealTime.includes(SUPPER) ? Math.max(0, 6 - cityCounts.supper) : 0;
  const categoryBonus = row.category === "小吃" ? 8 : row.category === "甜品" ? 5 : 0;
  return (
    (sourceBucketScore[row.sourceBucket] || 0) +
    breakfastDeficit * 8 +
    supperDeficit * 6 +
    toNumber(row.localIndex, 0) * 5 +
    toNumber(row.weight, 0) +
    categoryBonus
  );
}

function selectRows(rows, state) {
  const selectableCityNames = getSelectableCityNames();
  const selectableCitySet = new Set(selectableCityNames);
  const selected = [];
  const selectedKeys = new Set();
  const selectedCityCounts = {};
  const selectedNameCounts = {};
  const selectedNationalProvinceCounts = {};
  let selectedNationalCount = 0;
  const candidates = rows
    .filter((row) => isEligible(row, state, selectableCityNames, selectableCitySet))
    .sort((a, b) => scoreRow(b, state) - scoreRow(a, state));

  candidates.forEach((row) => {
    if (selected.length >= TARGET_ADDITIONS) return;
    const name = normalizeDishName(row.name);
    const key = `${row.province}|${row.city}|${name}`;
    const cityNameKey = `${row.city}|${name}`;
    const mealTime = Array.isArray(row.mealTime) ? row.mealTime : splitList(row.mealTime);
    const cityCounts = state.cityMealCounts[row.city];
    const helpsBreakfast = mealTime.includes(BREAKFAST) && cityCounts.breakfast < 8 && isBreakfastLike(row, name);
    const helpsSupper = mealTime.includes(SUPPER) && cityCounts.supper < 6 && isSupperLike(row, name);

    if (selectedKeys.has(cityNameKey) || (!helpsBreakfast && !helpsSupper)) return;
    if ((selectedCityCounts[row.city] || 0) >= MAX_SELECTED_PER_CITY) return;
    if (row.sourceBucket === "nationalGeneral") {
      if (selectedNationalCount >= MAX_NATIONAL_TOTAL) return;
      if ((selectedNameCounts[name] || 0) >= MAX_NATIONAL_PER_NAME) return;
      if ((selectedNationalProvinceCounts[row.province] || 0) >= MAX_NATIONAL_PER_PROVINCE) return;
    }

    selected.push(withAdjustedMealTime(row, helpsBreakfast, helpsSupper));
    selectedKeys.add(cityNameKey);
    selectedCityCounts[row.city] = (selectedCityCounts[row.city] || 0) + 1;
    selectedNameCounts[name] = (selectedNameCounts[name] || 0) + 1;
    if (row.sourceBucket === "nationalGeneral") {
      selectedNationalCount += 1;
      selectedNationalProvinceCounts[row.province] = (selectedNationalProvinceCounts[row.province] || 0) + 1;
    }
    state.existingKeys.add(key);
    if (helpsBreakfast) cityCounts.breakfast += 1;
    if (helpsSupper) cityCounts.supper += 1;
  });

  return selected;
}

function writeProvinceFiles(provinceMap, selectedRows, previousSelectedRows) {
  const previousKeys = new Set(previousSelectedRows.map((row) => (
    `${row.city}|${normalizeDishName(row.name)}`
  )));

  Object.values(provinceMap).forEach((province) => {
    province.data.dishes = province.data.dishes.filter((dish) => !previousKeys.has(
      `${dish.c}|${normalizeDishName(dish.n)}`
    ));
  });

  selectedRows.forEach((row) => {
    const province = provinceMap[row.province];
    if (!province) return;
    const key = `${row.city}|${normalizeDishName(row.name)}`;
    const exists = province.data.dishes.some((dish) => `${dish.c}|${normalizeDishName(dish.n)}` === key);
    if (!exists) province.data.dishes.push(toCompactDish(row));
  });

  const generatedAt = new Date().toISOString();
  const summaries = Object.values(provinceMap)
    .sort((a, b) => a.slug.localeCompare(b.slug))
    .map(({ data, slug, file }) => {
      const output = path.join(PROVINCE_DIR, file);
      const content = [
        "// Generated compact province data with selected meal-time additions. Do not edit manually.",
        `// Generated at ${generatedAt}.`,
        `module.exports = ${JSON.stringify(data)};`,
        ""
      ].join("\n");
      fs.writeFileSync(output, content, "utf8");
      return {
        province: data.province,
        slug,
        file,
        cityCount: data.cities.length,
        dishCount: data.dishes.length,
        sizeKB: Number((Buffer.byteLength(content) / 1024).toFixed(2))
      };
    });

  const indexContent = [
    "// Generated compact province data index. Do not edit manually.",
    `// Generated at ${generatedAt}.`,
    `module.exports = ${JSON.stringify({ dictionaries, provinces: summaries })};`,
    ""
  ].join("\n");
  fs.writeFileSync(INDEX_FILE, indexContent, "utf8");

  return { generatedAt, summaries };
}

function summarize(selectedRows, provinceSummaries, generatedAt) {
  const byProvince = {};
  const byBucket = {};
  const byMealTime = {};
  selectedRows.forEach((row) => {
    byProvince[row.province] = (byProvince[row.province] || 0) + 1;
    byBucket[row.sourceBucket] = (byBucket[row.sourceBucket] || 0) + 1;
    splitList(row.mealTime).forEach((meal) => {
      byMealTime[meal] = (byMealTime[meal] || 0) + 1;
    });
  });

  const miniprogramFiles = [];
  function walk(dir) {
    fs.readdirSync(dir, { withFileTypes: true }).forEach((entry) => {
      const file = path.join(dir, entry.name);
      if (entry.isDirectory()) walk(file);
      else miniprogramFiles.push(file);
    });
  }
  walk(path.join(ROOT, "miniprogram"));
  const totalBytes = miniprogramFiles.reduce((sum, file) => sum + fs.statSync(file).size, 0);

  const summary = {
    generatedAt,
    source: path.relative(ROOT, SOURCE).replace(/\\/g, "/"),
    targetAdditions: TARGET_ADDITIONS,
    selectedCount: selectedRows.length,
    byProvince,
    byBucket,
    byMealTime,
    packageSize: {
      fileCount: miniprogramFiles.length,
      totalBytes,
      totalMB: Number((totalBytes / 1024 / 1024).toFixed(3))
    },
    provinceFiles: provinceSummaries
  };
  fs.writeFileSync(SUMMARY_FILE, `${JSON.stringify(summary, null, 2)}\n`, "utf8");
  return summary;
}

function main() {
  const sourceRows = JSON.parse(fs.readFileSync(SOURCE, "utf8")).dishes;
  const previousSelectedRows = loadPreviousSelectedRows();
  const state = collectCurrentState(previousSelectedRows);
  const selectedRows = selectRows(sourceRows, state).map(compactSelectedRow);
  fs.writeFileSync(SELECTED_FILE, `${JSON.stringify({
    generatedAt: new Date().toISOString(),
    source: path.relative(ROOT, SOURCE).replace(/\\/g, "/"),
    targetAdditions: TARGET_ADDITIONS,
    rows: selectedRows
  }, null, 2)}\n`, "utf8");

  const provinceMap = loadProvinceData();
  const { generatedAt, summaries } = writeProvinceFiles(provinceMap, selectedRows, previousSelectedRows);
  const summary = summarize(selectedRows, summaries, generatedAt);
  console.log(JSON.stringify({
    selectedCount: summary.selectedCount,
    byBucket: summary.byBucket,
    byMealTime: summary.byMealTime,
    packageSize: summary.packageSize
  }, null, 2));
}

main();
