const { getDishById } = require("../../services/dish");
const storage = require("../../services/storage");

Page({
  data: {
    tab: "favorite",
    dishes: [],
    favoriteTabClass: "active",
    historyTabClass: "",
    emptyVisible: true,
    editMode: false,
    editButtonText: "\u7f16\u8f91",
    manageVisible: false,
    clearButtonText: "\u6e05\u7a7a\u6536\u85cf",
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
      historyTabClass: tab === "history" ? "active" : "",
      editMode: false,
      editButtonText: "\u7f16\u8f91"
    }, () => this.loadDishes());
  },

  getStorageKey() {
    return this.data.tab === "favorite" ? "favoriteDishIds" : "historyDishIds";
  },

  getTabName() {
    return this.data.tab === "favorite" ? "\u6536\u85cf" : "\u5386\u53f2";
  },

  loadDishes() {
    const key = this.getStorageKey();
    const dishes = storage.getList(key).map((id) => getDishById(id)).filter(Boolean);
    const hasDishes = !!dishes.length;
    const editMode = this.data.editMode && hasDishes;
    this.setData({
      dishes,
      emptyVisible: !hasDishes,
      editMode,
      editButtonText: editMode ? "\u5b8c\u6210" : "\u7f16\u8f91",
      manageVisible: editMode,
      clearButtonText: this.data.tab === "favorite" ? "\u6e05\u7a7a\u6536\u85cf" : "\u6e05\u7a7a\u5386\u53f2"
    });
  },

  onOpenDish(event) {
    if (this.data.editMode) return;
    const { id } = event.currentTarget.dataset;
    const detailDish = this.data.dishes.find((dish) => dish.id === id);
    if (!detailDish) return;
    this.setData({
      detailDish,
      dishSheetVisible: true
    });
  },

  onToggleEdit() {
    if (!this.data.dishes.length) {
      wx.showToast({ title: "\u8fd8\u6ca1\u6709\u53ef\u7ba1\u7406\u7684\u5185\u5bb9", icon: "none" });
      return;
    }
    const editMode = !this.data.editMode;
    this.setData({
      editMode,
      editButtonText: editMode ? "\u5b8c\u6210" : "\u7f16\u8f91",
      manageVisible: editMode && !!this.data.dishes.length
    });
  },

  onRemoveDish(event) {
    const { id } = event.currentTarget.dataset;
    storage.removeItem(this.getStorageKey(), id);
    this.loadDishes();
    wx.showToast({ title: "\u5df2\u5220\u9664", icon: "none" });
  },

  onClearCurrent() {
    const key = this.getStorageKey();
    const tabName = this.getTabName();
    wx.showModal({
      title: `\u6e05\u7a7a${tabName}`,
      content: `\u786e\u5b9a\u6e05\u7a7a\u6240\u6709${tabName}\u5185\u5bb9\u5417\uff1f`,
      confirmText: "\u6e05\u7a7a",
      confirmColor: "#e85d3d",
      success: (res) => {
        if (!res.confirm) return;
        storage.saveList(key, []);
        this.setData({
          editMode: false,
          editButtonText: "\u7f16\u8f91"
        }, () => this.loadDishes());
      }
    });
  },

  onCloseDishSheet() {
    this.setData({ dishSheetVisible: false });
  },

  onCreatePoll() {
    wx.navigateTo({ url: "/pages/poll-create/poll-create" });
  }
});
