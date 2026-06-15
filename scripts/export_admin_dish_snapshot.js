const fs = require("fs");
const path = require("path");
const { getCities, getDishesByCity } = require("../miniprogram/services/dish");

const ROOT = path.resolve(__dirname, "..");
const OUTPUT_DIR = path.join(ROOT, "admin", "public");
const OUTPUT_FILE = path.join(OUTPUT_DIR, "dishes-snapshot.json");

function toRow(dish) {
  return {
    province: dish.province || "",
    city: dish.city || "",
    name: dish.name || "",
    category: dish.category || "",
    taste: dish.taste || "",
    mealTime: (dish.mealTime || []).join("/"),
    scene: (dish.scene || []).join("/"),
    tags: (dish.tags || []).join("/"),
    avoidTags: (dish.avoidTags || []).join("/"),
    localIndex: String(dish.localIndex || ""),
    iconType: dish.iconType || "",
    weight: String(dish.weight || ""),
    sourceBucket: dish.sourceBucket || ""
  };
}

function main() {
  const rows = [];
  getCities().forEach((city) => {
    getDishesByCity(city.name).forEach((dish) => rows.push(toRow(dish)));
  });

  fs.mkdirSync(OUTPUT_DIR, { recursive: true });
  fs.writeFileSync(OUTPUT_FILE, `${JSON.stringify({
    generatedAt: new Date().toISOString(),
    source: "miniprogram/services/dish.getDishesByCity",
    count: rows.length,
    rows
  })}\n`, "utf8");

  console.log(JSON.stringify({
    output: path.relative(ROOT, OUTPUT_FILE).replace(/\\/g, "/"),
    count: rows.length
  }, null, 2));
}

main();
