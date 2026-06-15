const fs = require("fs");
const path = require("path");
const childProcess = require("child_process");

const ROOT = path.resolve(__dirname, "..");
const SOURCE_CSV = path.join(ROOT, "project-prep", "food-import-ready-top32.csv");
const PROVINCE_DIR = path.join(ROOT, "miniprogram", "data", "provinces");
const INDEX_FILE = path.join(PROVINCE_DIR, "index.js");
const SELECTED_FILE = path.join(ROOT, "project-prep", "selected-dish-additions.json");
const SUMMARY_FILE = path.join(ROOT, "project-prep", "selected-dish-additions-summary.json");
const TARGET_ADDITIONS = 1000;
const REBUILD_FROM_GIT_HEAD = process.env.REBUILD_FROM_GIT_HEAD === "1";
const REFRESH_SELECTION = process.env.REFRESH_SELECTION === "1";

const provinceIndex = require("../miniprogram/data/provinces/index");
const { cities: nationalCities } = require("../miniprogram/data/national-cities");

const dictionaries = provinceIndex.dictionaries;
const dictIndex = Object.keys(dictionaries).reduce((map, key) => {
  map[key] = dictionaries[key].reduce((inner, value, index) => {
    inner[value] = index;
    return inner;
  }, {});
  return map;
}, {});

const hotProvinceOrder = [
  "广东", "四川", "重庆", "湖南", "湖北", "江苏", "浙江", "山东", "河南", "福建",
  "陕西", "云南", "北京", "上海", "天津", "广西", "贵州", "海南", "江西", "河北",
  "辽宁", "新疆", "山西", "安徽", "黑龙江", "吉林", "甘肃", "内蒙古", "宁夏", "青海",
  "西藏", "香港", "澳门", "台湾"
];

const genericNames = new Set([
  "海鲜", "本地鸡", "粥类", "火锅", "奶茶", "烧烤", "烤鱼", "牛杂", "烧腊",
  "汤粉", "米粉", "面条", "小吃", "甜品", "饮品", "家常菜", "炒饭"
]);

const riskTerms = [
  "狗肉", "蛇", "蝎", "野味", "生牛肉", "河豚", "活鱼", "田鸡", "牛蛙",
  "甲鱼", "鳖", "羊腥", "马肉", "驴肉", "兔头", "血"
];

const sourceBucketScore = {
  cityExact: 40,
  regionalShared: 20,
  provinceShared: 10,
  nationalGeneral: 0
};

const provinceRank = hotProvinceOrder.reduce((map, province, index) => {
  map[province] = hotProvinceOrder.length - index;
  return map;
}, {});

const selectableCityNames = nationalCities
  .map((city) => city.name)
  .filter((name) => name && name.length >= 2)
  .sort((a, b) => b.length - a.length);
const selectableCityNameSet = new Set(selectableCityNames);

function parseCsvLine(line) {
  const cells = [];
  let cell = "";
  let quoted = false;
  for (let index = 0; index < line.length; index += 1) {
    const char = line[index];
    const next = line[index + 1];
    if (char === "\"" && quoted && next === "\"") {
      cell += "\"";
      index += 1;
    } else if (char === "\"") {
      quoted = !quoted;
    } else if (char === "," && !quoted) {
      cells.push(cell);
      cell = "";
    } else {
      cell += char;
    }
  }
  cells.push(cell);
  return cells;
}

function readCsvRows(file) {
  const lines = fs.readFileSync(file, "utf8").split(/\r?\n/).filter(Boolean);
  const header = parseCsvLine(lines[0]);
  return lines.slice(1).map((line) => {
    const values = parseCsvLine(line);
    return header.reduce((row, key, index) => {
      row[key] = values[index] || "";
      return row;
    }, {});
  });
}

function splitList(value) {
  return String(value || "").split("/").map((item) => item.trim()).filter(Boolean);
}

function normalizeDishName(name) {
  return String(name || "").trim().replace(/\s+/g, "");
}

function hasRiskName(name) {
  return riskTerms.some((term) => name.includes(term));
}

function hasOtherCityMarker(row) {
  if (row.sourceBucket === "cityExact" || row.sourceBucket === "nationalGeneral") return false;
  return selectableCityNames.some((cityName) => cityName !== row.city && row.name.includes(cityName));
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
    l: toNumber(row.localIndex, 4),
    i: dictIndex.iconType[row.iconType] ?? 0,
    w: toNumber(row.weight, 8),
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
    mealTime: row.mealTime,
    scene: row.scene,
    tags: row.tags,
    avoidTags: row.avoidTags,
    localIndex: row.localIndex,
    iconType: row.iconType,
    weight: row.weight,
    sourceBucket: row.sourceBucket
  };
}

function scoreRow(row) {
  const meal = splitList(row.mealTime);
  const tags = splitList(row.tags);
  const mealBonus = (meal.includes("早餐") ? 4 : 0) + (meal.includes("宵夜") ? 4 : 0);
  const typeBonus = (row.category === "小吃" ? 3 : 0) + (row.category === "甜品" ? 2 : 0) + (row.category === "饮品" ? 1 : 0);
  const tagBonus = tags.includes("名菜") ? 3 : 0;
  return (
    (provinceRank[row.province] || 0) * 4 +
    (sourceBucketScore[row.sourceBucket] || 0) +
    toNumber(row.localIndex, 0) * 8 +
    toNumber(row.weight, 0) * 2 +
    mealBonus +
    typeBonus +
    tagBonus
  );
}

function loadProvinceData() {
  return provinceIndex.provinces.reduce((map, province) => {
    const file = path.join(PROVINCE_DIR, province.file);
    let data;
    if (REBUILD_FROM_GIT_HEAD) {
      const source = childProcess.execFileSync("git", ["show", `HEAD:miniprogram/data/provinces/${province.file}`], {
        cwd: ROOT,
        encoding: "utf8"
      });
      const module = { exports: {} };
      new Function("module", "exports", source)(module, module.exports);
      data = module.exports;
    } else {
      delete require.cache[require.resolve(file)];
      data = require(file);
    }
    map[province.province] = {
      slug: province.slug,
      file: province.file,
      data
    };
    return map;
  }, {});
}

function collectExistingKeys(provinceMap) {
  const keys = new Set();
  Object.values(provinceMap).forEach(({ data }) => {
    data.dishes.forEach((dish) => {
      keys.add(`${dish.c}|${normalizeDishName(dish.n)}`);
    });
  });
  return keys;
}

function isEligible(row, existingKeys, options) {
  const name = normalizeDishName(row.name);
  if (!row.province || !row.city || !name) return false;
  if (!selectableCityNameSet.has(row.city)) return false;
  if (!["cityExact", "regionalShared", "provinceShared"].includes(row.sourceBucket)) return false;
  if (!options.buckets.includes(row.sourceBucket)) return false;
  if (existingKeys.has(`${row.city}|${name}`)) return false;
  if (genericNames.has(name)) return false;
  if (hasRiskName(name)) return false;
  if (hasOtherCityMarker(row)) return false;
  if (toNumber(row.localIndex, 0) < options.minLocalIndex) return false;
  if (toNumber(row.weight, 0) < options.minWeight) return false;
  return true;
}

function selectRows(rows, provinceMap, existingKeys) {
  const selected = [];
  const selectedKeys = new Set();
  const cityCounts = {};
  const phases = [
    { buckets: ["cityExact"], minLocalIndex: 4, minWeight: 8, maxPerCity: 5 },
    { buckets: ["regionalShared", "provinceShared"], minLocalIndex: 4, minWeight: 8, maxPerCity: 3 },
    { buckets: ["cityExact", "regionalShared", "provinceShared"], minLocalIndex: 4, minWeight: 7, maxPerCity: 8 },
    { buckets: ["cityExact", "regionalShared", "provinceShared"], minLocalIndex: 3, minWeight: 7, maxPerCity: 9 }
  ];

  phases.forEach((phase) => {
    if (selected.length >= TARGET_ADDITIONS) return;
    const candidates = rows
      .filter((row) => provinceMap[row.province] && provinceMap[row.province].data.cities.includes(row.city))
      .filter((row) => isEligible(row, existingKeys, phase))
      .sort((a, b) => scoreRow(b) - scoreRow(a));

    candidates.forEach((row) => {
      if (selected.length >= TARGET_ADDITIONS) return;
      const key = `${row.city}|${normalizeDishName(row.name)}`;
      const cityKey = `${row.province}|${row.city}`;
      if (selectedKeys.has(key)) return;
      if ((cityCounts[cityKey] || 0) >= phase.maxPerCity) return;
      selectedKeys.add(key);
      existingKeys.add(key);
      cityCounts[cityKey] = (cityCounts[cityKey] || 0) + 1;
      selected.push(row);
    });
  });

  return selected;
}

function writeProvinceFiles(provinceMap, selectedRows) {
  selectedRows.forEach((row) => {
    const data = provinceMap[row.province].data;
    const key = `${row.city}|${normalizeDishName(row.name)}`;
    const exists = data.dishes.some((dish) => `${dish.c}|${normalizeDishName(dish.n)}` === key);
    if (!exists) data.dishes.push(toCompactDish(row));
  });

  const generatedAt = new Date().toISOString();
  const summaries = Object.values(provinceMap)
    .sort((a, b) => a.slug.localeCompare(b.slug))
    .map(({ data, slug, file }) => {
      const output = path.join(PROVINCE_DIR, file);
      const content = [
        "// Generated compact province data with selected additions from project-prep/food-import-ready-top32.csv. Do not edit manually.",
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
  selectedRows.forEach((row) => {
    byProvince[row.province] = (byProvince[row.province] || 0) + 1;
    byBucket[row.sourceBucket] = (byBucket[row.sourceBucket] || 0) + 1;
  });
  const miniprogramFiles = [];
  function walk(dir) {
    fs.readdirSync(dir, { withFileTypes: true }).forEach((entry) => {
      const file = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        walk(file);
      } else {
        miniprogramFiles.push(file);
      }
    });
  }
  walk(path.join(ROOT, "miniprogram"));
  const totalBytes = miniprogramFiles.reduce((sum, file) => sum + fs.statSync(file).size, 0);

  const summary = {
    generatedAt,
    source: path.relative(ROOT, SOURCE_CSV).replace(/\\/g, "/"),
    targetAdditions: TARGET_ADDITIONS,
    selectedCount: selectedRows.length,
    byProvince,
    byBucket,
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
  const rows = readCsvRows(SOURCE_CSV);
  const provinceMap = loadProvinceData();
  const existingKeys = collectExistingKeys(provinceMap);
  const selectedRows = fs.existsSync(SELECTED_FILE) && !REFRESH_SELECTION
    ? JSON.parse(fs.readFileSync(SELECTED_FILE, "utf8")).rows
    : selectRows(rows, provinceMap, existingKeys);
  if (selectedRows.length < TARGET_ADDITIONS) {
    throw new Error(`Only selected ${selectedRows.length} rows, target is ${TARGET_ADDITIONS}.`);
  }
  if (!fs.existsSync(SELECTED_FILE) || REFRESH_SELECTION) {
    fs.writeFileSync(SELECTED_FILE, `${JSON.stringify({
      generatedAt: new Date().toISOString(),
      source: path.relative(ROOT, SOURCE_CSV).replace(/\\/g, "/"),
      targetAdditions: TARGET_ADDITIONS,
      rows: selectedRows.map(compactSelectedRow)
    }, null, 2)}\n`, "utf8");
  }
  const { generatedAt, summaries } = writeProvinceFiles(provinceMap, selectedRows);
  const summary = summarize(selectedRows, summaries, generatedAt);
  console.log(JSON.stringify({
    selectedCount: summary.selectedCount,
    byProvince: summary.byProvince,
    byBucket: summary.byBucket,
    packageSize: summary.packageSize
  }, null, 2));
}

main();
