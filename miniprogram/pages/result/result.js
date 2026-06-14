const { getDishById, getDishesByCity } = require("../../services/dish");
const { iconRating, iconRatingItems } = require("../../utils/random");
const storage = require("../../services/storage");

Page({
  data: {
    dish: null,
    rating: "",
    favorited: false,
    relatedDishes: []
  },

  onLoad(query) {
    this.loadDish(query.id);
  },

  loadDish(id) {
    const dish = getDishById(id);
    if (!dish) {
      wx.showToast({ title: "结果不存在", icon: "none" });
      return;
    }
    const sameCity = getDishesByCity(dish.city).filter((item) => item.id !== dish.id);
    const relatedDishes = sameCity.slice(0, 3).map((item) => Object.assign({}, item, {
      rating: iconRating(item.localIndex, item.iconType),
      ratingItems: iconRatingItems(item.localIndex, item.iconType)
    }));
    storage.addUnique("historyDishIds", dish.id);
    this.setData({
      dish,
      rating: iconRating(dish.localIndex, dish.iconType),
      favorited: storage.hasItem("favoriteDishIds", dish.id),
      relatedDishes
    });
  },

  onFavorite() {
    const key = "favoriteDishIds";
    if (this.data.favorited) {
      storage.removeItem(key, this.data.dish.id);
    } else {
      storage.addUnique(key, this.data.dish.id);
    }
    this.setData({ favorited: !this.data.favorited });
  },

  onSpinAgain() {
    wx.navigateBack();
  },

  onCreatePoll() {
    const dish = this.data.dish;
    wx.navigateTo({
      url: `/pages/poll-detail/poll-detail?ids=${encodeURIComponent(dish.id)}&city=${encodeURIComponent(dish.city)}`
    });
  },

  onOpenRelated(event) {
    const { id } = event.currentTarget.dataset;
    this.loadDish(id);
  },

  onFeedback() {
    wx.navigateTo({ url: `/pages/feedback/feedback?dishId=${this.data.dish.id}` });
  },

  onShareAppMessage() {
    const dish = this.data.dish;
    return {
      title: `${dish.phrase} 我转到了${dish.name}`,
      path: `/pages/result/result?id=${dish.id}`
    };
  }
});
