const { iconRatingItems } = require("../../utils/random");
const storage = require("../../services/storage");

function buildViewDish(dish) {
  if (!dish) return null;
  const ratingItems = iconRatingItems(dish.localIndex, dish.iconType).map((item) =>
    Object.assign({}, item, {
      className: item.active ? "active" : ""
    })
  );
  return Object.assign({}, dish, {
    mealLine: (dish.mealTime || []).join(" / "),
    tagLine: [dish.category, dish.taste].concat(dish.tags || []).filter(Boolean).slice(0, 5),
    ratingItems
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
    favorited: false,
    favoriteLabel: "\u6536\u85cf\u8d77\u6765"
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
        favorited: viewDish ? storage.hasItem("favoriteDishIds", viewDish.id) : false,
        favoriteLabel:
          viewDish && storage.hasItem("favoriteDishIds", viewDish.id)
            ? "\u5df2\u7ecf\u6536\u597d"
            : "\u6536\u85cf\u8d77\u6765"
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
      const favorited = !this.data.favorited;
      this.setData({
        favorited,
        favoriteLabel: favorited ? "\u5df2\u7ecf\u6536\u597d" : "\u6536\u85cf\u8d77\u6765"
      });
      wx.showToast({
        title: favorited ? "\u6536\u85cf\u8d77\u6765\u4e86" : "\u5df2\u7ecf\u53d6\u6d88",
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
