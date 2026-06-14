const {
  getCities,
  getDishesByCity
} = require("../miniprogram/services/dish");

const blockedNames = [
  "\u7c73\u7ca5\u505a\u9505\u5e95",
  "\u6d77\u9c9c",
  "\u672c\u5730\u9e21",
  "\u7ca5\u7c7b",
  "\u5ba2\u5bb6\u76d0\u7117\u9e21\u9996\u9009"
];

const cities = getCities();
const exactBlockedHits = [];
const duplicateHits = [];
const lowCountCities = [];
let total = 0;

cities.forEach((city) => {
  const dishes = getDishesByCity(city.name);
  const names = {};
  total += dishes.length;

  dishes.forEach((dish) => {
    if (blockedNames.includes(dish.name)) {
      exactBlockedHits.push({
        city: city.name,
        name: dish.name
      });
    }
    if (names[dish.name]) {
      duplicateHits.push({
        city: city.name,
        name: dish.name
      });
    }
    names[dish.name] = true;
  });

  if (dishes.length < 8) {
    lowCountCities.push({
      city: city.name,
      count: dishes.length
    });
  }
});

console.log(JSON.stringify({
  cityCount: cities.length,
  dishCount: total,
  exactBlockedHitCount: exactBlockedHits.length,
  exactBlockedHits: exactBlockedHits.slice(0, 20),
  duplicateHitCount: duplicateHits.length,
  duplicateHits: duplicateHits.slice(0, 20),
  lowCountCityCount: lowCountCities.length,
  lowCountCities: lowCountCities.slice(0, 20)
}, null, 2));
