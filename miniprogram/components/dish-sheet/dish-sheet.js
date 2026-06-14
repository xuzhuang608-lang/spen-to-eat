const { iconRatingItems } = require("../../utils/random");
const storage = require("../../services/storage");

function buildViewDish(dish) {
  if (!dish) return null;
  return Object.assign({}, dish, {
    mealLine: (dish.mealTime || []).join(" / "),
    tagLine: [dish.category, dish.taste].concat(dish.tags || []).filter(Boolean).slice(0, 5),
    ratingItems: iconRatingItems(dish.localIndex, dish.iconType)
  });
}

Component({
  properties: {
    visible: {
      type: Boolean,
      value: false
    },
    dish: {
      type: Object,
      value: null,
      observer(value) {
        this.syncDish(value);
      }
    }
  },

  data: {
    viewDish: null,
    favorited: false
  },

  lifetimes: {
    attached() {
      this.syncDish(this.properties.dish);
    }
  },

  methods: {
    syncDish(dish) {
      const viewDish = buildViewDish(dish);
      this.setData({
        viewDish,
        favorited: viewDish ? storage.hasItem("favoriteDishIds", viewDish.id) : false
      });
    },

    onClose() {
      this.triggerEvent("close");
    },

    noop() {},

    onPick() {
      const dish = this.data.viewDish;
      if (!dish) return;
      this.triggerEvent("close");
      wx.navigateTo({ url: `/pages/result/result?id=${dish.id}` });
    },

    onFavorite() {
      const dish = this.data.viewDish;
      if (!dish) return;
      const key = "favoriteDishIds";
      if (this.data.favorited) {
        storage.removeItem(key, dish.id);
      } else {
        storage.addUnique(key, dish.id);
      }
      this.setData({ favorited: !this.data.favorited });
      wx.showToast({
        title: this.data.favorited ? "收藏起来了" : "已经取消",
        icon: "none"
      });
    },

    onCreateProposal() {
      const dish = this.data.viewDish;
      if (!dish) return;
      this.triggerEvent("close");
      wx.navigateTo({
        url: `/pages/poll-detail/poll-detail?ids=${encodeURIComponent(dish.id)}&city=${encodeURIComponent(dish.city)}`
      });
    },

    onFeedback() {
      const dish = this.data.viewDish;
      if (!dish) return;
      this.triggerEvent("close");
      wx.navigateTo({ url: `/pages/feedback/feedback?dishId=${dish.id}` });
    }
  }
});
