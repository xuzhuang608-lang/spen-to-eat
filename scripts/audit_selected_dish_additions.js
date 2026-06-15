const fs = require("fs");
const path = require("path");

const ROOT = path.resolve(__dirname, "..");
const INPUT = path.join(ROOT, "project-prep", "selected-dish-additions.json");
const OUTPUT = path.join(ROOT, "project-prep", "selected-dish-additions-audit.json");

const selected = JSON.parse(fs.readFileSync(INPUT, "utf8")).rows;
const popularCities = ["广州", "深圳", "佛山", "成都", "重庆", "长沙", "武汉", "杭州", "南京", "西安", "昆明", "青岛"];

const riskTerms = [
  "狗肉", "蛇", "蝎", "野味", "生牛肉", "河豚", "活鱼", "田鸡", "牛蛙",
  "甲鱼", "鳖", "羊腥", "马肉", "驴肉", "兔头", "血"
];
const genericNames = new Set([
  "海鲜", "本地鸡", "粥类", "火锅", "奶茶", "烧烤", "烤鱼", "牛杂", "烧腊",
  "汤粉", "米粉", "面条", "小吃", "甜品", "饮品", "家常菜", "炒饭"
]);
const suspiciousTerms = [
  "首选", "推荐", "特色", "风味", "做法", "锅底", "一绝", "拼盘", "宴",
  "全席", "一品", "最好", "必吃", "经典"
];

function splitList(value) {
  return String(value || "").split("/").map((item) => item.trim()).filter(Boolean);
}

function countBy(rows, key) {
  return rows.reduce((map, row) => {
    const value = typeof key === "function" ? key(row) : row[key];
    map[value] = (map[value] || 0) + 1;
    return map;
  }, {});
}

function sampleRows(rows, limit = 20) {
  return rows.slice(0, limit).map((row) => ({
    province: row.province,
    city: row.city,
    name: row.name,
    category: row.category,
    mealTime: row.mealTime,
    sourceBucket: row.sourceBucket,
    localIndex: Number(row.localIndex),
    weight: Number(row.weight)
  }));
}

function getMealStats() {
  const stats = {};
  selected.forEach((row) => {
    splitList(row.mealTime).forEach((meal) => {
      stats[meal] = (stats[meal] || 0) + 1;
    });
  });
  return stats;
}

function hasAnyTerm(name, terms) {
  return terms.some((term) => String(name || "").includes(term));
}

function getPopularCitySamples() {
  return popularCities.reduce((map, city) => {
    const rows = selected.filter((row) => row.city === city);
    map[city] = {
      count: rows.length,
      byBucket: countBy(rows, "sourceBucket"),
      samples: sampleRows(rows, 12)
    };
    return map;
  }, {});
}

function getCityOutliers() {
  const byCity = {};
  selected.forEach((row) => {
    const key = `${row.province}|${row.city}`;
    if (!byCity[key]) byCity[key] = [];
    byCity[key].push(row);
  });
  return Object.keys(byCity)
    .map((key) => {
      const [province, city] = key.split("|");
      const rows = byCity[key];
      return { province, city, count: rows.length, byBucket: countBy(rows, "sourceBucket") };
    })
    .sort((a, b) => b.count - a.count)
    .slice(0, 30);
}

const riskHits = selected.filter((row) => hasAnyTerm(row.name, riskTerms));
const genericHits = selected.filter((row) => genericNames.has(row.name));
const suspiciousHits = selected.filter((row) => hasAnyTerm(row.name, suspiciousTerms));
const weakRows = selected.filter((row) => Number(row.localIndex) <= 3 || Number(row.weight) <= 7);
const breakfastRows = selected.filter((row) => splitList(row.mealTime).includes("早餐"));
const supperRows = selected.filter((row) => splitList(row.mealTime).includes("宵夜"));

const report = {
  generatedAt: new Date().toISOString(),
  selectedCount: selected.length,
  byProvince: countBy(selected, "province"),
  byBucket: countBy(selected, "sourceBucket"),
  byCategory: countBy(selected, "category"),
  byTaste: countBy(selected, "taste"),
  byMealTime: getMealStats(),
  popularCities: getPopularCitySamples(),
  topCityAdditions: getCityOutliers(),
  checks: {
    riskHitCount: riskHits.length,
    riskHits: sampleRows(riskHits, 50),
    genericHitCount: genericHits.length,
    genericHits: sampleRows(genericHits, 50),
    suspiciousHitCount: suspiciousHits.length,
    suspiciousHits: sampleRows(suspiciousHits, 80),
    weakRowCount: weakRows.length,
    weakRows: sampleRows(weakRows, 50),
    breakfastCount: breakfastRows.length,
    breakfastSamples: sampleRows(breakfastRows, 40),
    supperCount: supperRows.length,
    supperSamples: sampleRows(supperRows, 40)
  }
};

fs.writeFileSync(OUTPUT, `${JSON.stringify(report, null, 2)}\n`, "utf8");
console.log(JSON.stringify({
  selectedCount: report.selectedCount,
  byBucket: report.byBucket,
  byMealTime: report.byMealTime,
  riskHitCount: report.checks.riskHitCount,
  genericHitCount: report.checks.genericHitCount,
  suspiciousHitCount: report.checks.suspiciousHitCount,
  weakRowCount: report.checks.weakRowCount
}, null, 2));
