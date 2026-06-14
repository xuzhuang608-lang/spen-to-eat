const { AMAP_KEY } = require("../config/map");
const { getCities } = require("./dish");

function normalizeCityName(value) {
  return String(value || "")
    .replace(/特别行政区$/, "")
    .replace(/自治州$/, "")
    .replace(/地区$/, "")
    .replace(/盟$/, "")
    .replace(/市$/, "");
}

function pickCityName(component) {
  if (!component) return "";
  const rawCity = Array.isArray(component.city) ? "" : component.city;
  const city = normalizeCityName(rawCity || component.province);
  const district = normalizeCityName(component.district);
  const candidates = getCities();
  const exact = candidates.find((item) => item.name === city || item.fullName === rawCity);
  if (exact) return exact.name;
  const districtHit = candidates.find((item) => item.name === district || item.fullName === component.district);
  if (districtHit) return districtHit.name;
  const fuzzy = candidates.find((item) => city && (item.name.includes(city) || city.includes(item.name)));
  return fuzzy ? fuzzy.name : city;
}

function reverseGeocode(latitude, longitude) {
  return new Promise((resolve, reject) => {
    if (!AMAP_KEY || AMAP_KEY.includes("请填写")) {
      reject(new Error("缺少高德地图 Key"));
      return;
    }
    wx.request({
      url: "https://restapi.amap.com/v3/geocode/regeo",
      data: {
        key: AMAP_KEY,
        location: `${longitude},${latitude}`,
        extensions: "base",
        output: "json"
      },
      success(res) {
        const data = res.data || {};
        if (String(data.status) !== "1") {
          reject(new Error(`${data.info || "逆地址解析失败"}${data.infocode ? `(${data.infocode})` : ""}`));
          return;
        }
        const component = data.regeocode && data.regeocode.addressComponent;
        const city = pickCityName(component);
        if (!city) {
          reject(new Error("未识别到城市"));
          return;
        }
        resolve({
          province: component.province,
          city,
          district: component.district
        });
      },
      fail: reject
    });
  });
}

function getCurrentCityByLocation() {
  return new Promise((resolve, reject) => {
    wx.getLocation({
      type: "gcj02",
      success(location) {
        reverseGeocode(location.latitude, location.longitude).then(resolve).catch(reject);
      },
      fail: reject
    });
  });
}

module.exports = {
  getCurrentCityByLocation,
  reverseGeocode,
  normalizeCityName
};
