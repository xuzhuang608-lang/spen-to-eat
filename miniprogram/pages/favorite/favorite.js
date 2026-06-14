const { getDishById } = require("../../services/dish");
const storage = require("../../services/storage");

Page({
  data: {
    tab: "favorite",
    dishes: [],
    dishSheetVisible: false,
    detailDish: null
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
    const { id } = event.currentTarget.dataset;
    const detailDish = this.data.dishes.find((dish) => dish.id === id);
    if (!detailDish) return;
    this.setData({
      detailDish,
      dishSheetVisible: true
    });
  },

  onCloseDishSheet() {
    this.setData({ dishSheetVisible: false });
  },

  onCreatePoll() {
    wx.navigateTo({ url: "/pages/poll-create/poll-create" });
  }
});

