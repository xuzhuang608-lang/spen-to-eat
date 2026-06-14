const { getDishById } = require("../../services/dish");
const storage = require("../../services/storage");

Page({
  data: {
    tab: "favorite",
    dishes: [],
    favoriteTabClass: "active",
    historyTabClass: "",
    emptyVisible: true,
    dishSheetVisible: false,
    detailDish: null
  },

  onShow() {
    this.loadDishes();
  },

  onSwitchTab(event) {
    const tab = event.currentTarget.dataset.tab;
    this.setData({
      tab,
      favoriteTabClass: tab === "favorite" ? "active" : "",
      historyTabClass: tab === "history" ? "active" : ""
    }, () => this.loadDishes());
  },

  loadDishes() {
    const key = this.data.tab === "favorite" ? "favoriteDishIds" : "historyDishIds";
    const dishes = storage.getList(key).map((id) => getDishById(id)).filter(Boolean);
    this.setData({
      dishes,
      emptyVisible: !dishes.length
    });
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
