App({
  globalData: {
    currentCity: "广州"
  },

  onLaunch() {
    const city = wx.getStorageSync("currentCity");
    if (city) {
      this.globalData.currentCity = city;
    }
  },

  setCurrentCity(city) {
    this.globalData.currentCity = city;
    wx.setStorageSync("currentCity", city);
  }
});

