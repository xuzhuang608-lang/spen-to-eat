const app = getApp();
const { getCities, getProvinces } = require("../../services/dish");

const popularCityNames = ["广州", "深圳", "上海", "成都", "北京", "重庆", "杭州", "长沙"];

const provinceLetters = {
  安徽: "A",
  澳门: "A",
  北京: "B",
  重庆: "C",
  福建: "F",
  广东: "G",
  广西: "G",
  贵州: "G",
  甘肃: "G",
  海南: "H",
  河北: "H",
  河南: "H",
  黑龙江: "H",
  湖北: "H",
  湖南: "H",
  吉林: "J",
  江苏: "J",
  江西: "J",
  辽宁: "L",
  内蒙古: "N",
  宁夏: "N",
  青海: "Q",
  上海: "S",
  山东: "S",
  山西: "S",
  陕西: "S",
  四川: "S",
  天津: "T",
  台湾: "T",
  西藏: "X",
  新疆: "X",
  香港: "X",
  云南: "Y",
  浙江: "Z"
};

function cityMatches(city, keyword) {
  if (!keyword) return true;
  return [city.name, city.fullName, city.province, city.provinceFullName]
    .filter(Boolean)
    .some((text) => String(text).includes(keyword));
}

function buildProvinceGroups(provinces) {
  const groupMap = provinces.reduce((map, province) => {
    if (!province.cities.length) return map;
    const letter = provinceLetters[province.name] || "#";
    if (!map[letter]) map[letter] = [];
    map[letter].push(province);
    return map;
  }, {});

  return Object.keys(groupMap)
    .sort()
    .map((letter) => ({
      letter,
      provinces: groupMap[letter]
    }));
}

function markSelectedProvinceGroups(groups, selectedProvince) {
  return groups.map((group) => ({
    letter: group.letter,
    provinces: group.provinces.map((province) => Object.assign({}, province, {
      active: selectedProvince && province.id === selectedProvince.id,
      className: selectedProvince && province.id === selectedProvince.id ? "active" : ""
    })),
    expandedProvince: selectedProvince && group.provinces.some((province) => province.id === selectedProvince.id)
      ? selectedProvince
      : null
  }));
}

Page({
  data: {
    keyword: "",
    currentCity: "广州",
    popularCities: [],
    provinceGroups: [],
    searchResults: [],
    searchEmpty: false
  },

  onLoad() {
    const provinces = getProvinces();
    const groups = buildProvinceGroups(provinces);
    const cities = getCities();
    const cityMap = cities.reduce((map, city) => {
      map[city.name] = city;
      return map;
    }, {});
    this.setData({
      currentCity: app.globalData.currentCity || "广州",
      popularCities: popularCityNames.map((name) => cityMap[name]).filter(Boolean),
      provinceGroups: markSelectedProvinceGroups(groups, null)
    });
  },

  onSearchInput(event) {
    const keyword = String(event.detail.value || "").trim();
    const searchResults = keyword ? getCities().filter((city) => cityMatches(city, keyword)).slice(0, 80) : [];
    this.setData({
      keyword,
      searchResults,
      searchEmpty: !!keyword && !searchResults.length
    });
  },

  onClearSearch() {
    this.setData({
      keyword: "",
      searchResults: [],
      searchEmpty: false
    });
  },

  onSelectProvince(event) {
    const { provinceId } = event.currentTarget.dataset;
    const province = getProvinces().find((item) => item.id === provinceId);
    if (!province) return;
    const groups = buildProvinceGroups(getProvinces());
    const currentExpanded = this.data.provinceGroups.some((group) => (
      group.expandedProvince && group.expandedProvince.id === province.id
    ));
    const nextProvince = currentExpanded ? null : province;
    this.setData({
      provinceGroups: markSelectedProvinceGroups(groups, nextProvince)
    });
  },

  onSelectCity(event) {
    const { city } = event.currentTarget.dataset;
    app.setCurrentCity(city);
    wx.navigateBack();
  }
});
