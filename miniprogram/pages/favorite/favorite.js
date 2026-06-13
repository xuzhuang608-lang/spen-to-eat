const { getDishById } = require("../../services/dish");
const storage = require("../../services/storage");

Page({
  data: {
    tab: "favorite",
    dishes: []
  },

  onShow() {
    this.loadDishes();
  },

  onSwitchTab(event) {
    this.setData({ tab: event.currentTarget.dataset.tab }, () => this.loadDishes());
  },

  loadDishes() {
    const key = this.data.tab === "favorite" ? "favoriteDishIds" : "historyDishIds";
    const dishes = storage.getList(key).map((id) => getDishById(id)).filter(Boolean);
    this.setData({ dishes });
  },

  onOpenDish(event) {
    wx.navigateTo({ url: `/pages/result/result?id=${event.currentTarget.dataset.id}` });
  },

  onCreatePoll() {
    wx.navigateTo({ url: "/pages/poll-create/poll-create" });
  }
});

