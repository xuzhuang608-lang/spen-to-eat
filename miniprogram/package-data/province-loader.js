const provinceDataModules = {
  anhui: require("./provinces/anhui"),
  aomen: require("./provinces/aomen"),
  beijing: require("./provinces/beijing"),
  chongqing: require("./provinces/chongqing"),
  fujian: require("./provinces/fujian"),
  gansu: require("./provinces/gansu"),
  guangxi: require("./provinces/guangxi"),
  guizhou: require("./provinces/guizhou"),
  hainan: require("./provinces/hainan"),
  hebei: require("./provinces/hebei"),
  heilongjiang: require("./provinces/heilongjiang"),
  henan: require("./provinces/henan"),
  hubei: require("./provinces/hubei"),
  hunan: require("./provinces/hunan"),
  jiangsu: require("./provinces/jiangsu"),
  jiangxi: require("./provinces/jiangxi"),
  jilin: require("./provinces/jilin"),
  liaoning: require("./provinces/liaoning"),
  neimenggu: require("./provinces/neimenggu"),
  ningxia: require("./provinces/ningxia"),
  qinghai: require("./provinces/qinghai"),
  shaanxi: require("./provinces/shaanxi"),
  shandong: require("./provinces/shandong"),
  shanghai: require("./provinces/shanghai"),
  shanxi: require("./provinces/shanxi"),
  sichuan: require("./provinces/sichuan"),
  taiwan: require("./provinces/taiwan"),
  tianjin: require("./provinces/tianjin"),
  xianggang: require("./provinces/xianggang"),
  xinjiang: require("./provinces/xinjiang"),
  xizang: require("./provinces/xizang"),
  yunnan: require("./provinces/yunnan"),
  zhejiang: require("./provinces/zhejiang")
};

function getProvinceData(slug) {
  return provinceDataModules[slug] || null;
}

module.exports = {
  getProvinceData
};
