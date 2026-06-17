const { getDishById, getDishesByCity } = require("../../services/dish");
const { iconRating, iconRatingItems } = require("../../utils/random");
const storage = require("../../services/storage");

function buildNowReason(dish) {
  const meal = (dish.mealTime || []).slice(0, 2).join("、") || "这一顿";
  const taste = dish.taste || "顺口";
  const category = dish.category || "本地味";
  return `${meal}想吃点${taste}的，${dish.name}比随便点一份${category}更有方向。`;
}

function buildFitText(dish) {
  const scenes = (dish.scene || []).filter(Boolean);
  if (scenes.length) {
    return `适合${scenes.slice(0, 3).join("、")}。想少纠结时，可以先把它放进候选。`;
  }
  return "适合想快速定下一顿的人。先有一个选择，饭点就不容易拖住。";
}

function buildCautionText(dish) {
  const avoidTags = (dish.avoidTags || []).filter(Boolean);
  if (avoidTags.length) {
    return `如果你介意${avoidTags.slice(0, 3).join("、")}，点之前可以再确认一下。`;
  }
  return "没有明显避雷标签。口味仍以实际做法为准，可以按个人忌口再判断。";
}

function buildDecisionCards(dish) {
  return [
    {
      title: "为什么现在适合吃",
      text: buildNowReason(dish)
    },
    {
      title: "适合这类饭局",
      text: buildFitText(dish)
    },
    {
      title: "可能不适合",
      text: buildCautionText(dish)
    }
  ];
}

Page({
  data: {
    dish: null,
    rating: "",
    favorited: false,
    favoriteText: "\u6536\u85cf\u8d77\u6765",
    decisionCards: [],
    relatedDishes: [],
    dishSheetVisible: false,
    detailDish: null
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
      rating: iconRating(item.localIndex, item),
      ratingItems: iconRatingItems(item.localIndex, item).map((ratingItem) =>
        Object.assign({}, ratingItem, {
          className: ratingItem.active ? "active" : ""
        })
      )
    }));
    storage.addUnique("historyDishIds", dish.id);
    this.setData({
      dish,
      rating: iconRating(dish.localIndex, dish),
      favorited: storage.hasItem("favoriteDishIds", dish.id),
      favoriteText: storage.hasItem("favoriteDishIds", dish.id) ? "\u5df2\u7ecf\u6536\u597d" : "\u6536\u85cf\u8d77\u6765",
      decisionCards: buildDecisionCards(dish),
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
    const favorited = !this.data.favorited;
    this.setData({
      favorited,
      favoriteText: favorited ? "\u5df2\u7ecf\u6536\u597d" : "\u6536\u85cf\u8d77\u6765"
    });
  },

  onCopyName() {
    const dish = this.data.dish;
    if (!dish) return;
    wx.setClipboardData({
      data: dish.name,
      success: () => {
        wx.showToast({ title: "\u83dc\u540d\u5df2\u590d\u5236", icon: "none" });
      },
      fail: (error) => {
        console.error("复制菜名失败", error);
        wx.showToast({ title: "\u590d\u5236\u5931\u8d25", icon: "none" });
      }
    });
  },

  onSpinAgain() {
    const pages = getCurrentPages();
    if (pages.length > 1) {
      wx.navigateBack();
      return;
    }
    wx.redirectTo({
      url: `/pages/spin/spin?city=${encodeURIComponent(this.data.dish.city)}`
    });
  },

  onDislikeDish() {
    const dish = this.data.dish;
    const url = `/pages/spin/spin?city=${encodeURIComponent(dish.city)}&avoidDishId=${encodeURIComponent(dish.id)}`;
    const pages = getCurrentPages();
    if (pages.length > 1) {
      wx.redirectTo({ url });
      return;
    }
    wx.redirectTo({ url });
  },

  onCreatePoll() {
    const dish = this.data.dish;
    wx.navigateTo({
      url: `/pages/poll-create/poll-create?ids=${encodeURIComponent(dish.id)}&city=${encodeURIComponent(dish.city)}`
    });
  },

  onOpenRelated(event) {
    const { id } = event.currentTarget.dataset;
    const detailDish = this.data.relatedDishes.find((item) => item.id === id) || getDishById(id);
    if (!detailDish) return;
    this.setData({
      detailDish,
      dishSheetVisible: true
    });
  },

  onCloseDishSheet() {
    this.setData({ dishSheetVisible: false });
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
