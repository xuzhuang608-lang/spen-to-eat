const { searchDishes } = require("../../services/dish");

Page({
  data: {
    keyword: "",
    results: [],
    hotTags: ["夜宵", "甜品", "不吃辣", "海鲜", "早餐", "牛肉"]
  },

  onInput(event) {
    const keyword = event.detail.value;
    this.setData({
      keyword,
      results: searchDishes(keyword)
    });
  },

  onTapHot(event) {
    const { value } = event.currentTarget.dataset;
    this.setData({
      keyword: value,
      results: searchDishes(value)
    });
  },

  onOpenDish(event) {
    const { id } = event.currentTarget.dataset;
    wx.navigateTo({ url: `/pages/result/result?id=${id}` });
  }
});

