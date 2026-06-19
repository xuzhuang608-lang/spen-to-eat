const { getProvinceData } = require("../../province-loader");

Page({
  onLoad(query) {
    const slug = query.slug || "";
    const requestId = query.requestId || "";
    const app = getApp();
    const provinceData = getProvinceData(slug);
    app.globalData.__provinceDataBySlug = app.globalData.__provinceDataBySlug || {};
    app.globalData.__provinceLoadCallbacks = app.globalData.__provinceLoadCallbacks || {};

    if (provinceData) {
      app.globalData.__provinceDataBySlug[slug] = provinceData;
    }

    wx.navigateBack({
      complete: () => {
        const callback = app.globalData.__provinceLoadCallbacks[requestId];
        if (callback) {
          delete app.globalData.__provinceLoadCallbacks[requestId];
          callback(provinceData || null);
        }
      }
    });
  }
});
