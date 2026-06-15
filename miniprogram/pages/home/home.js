const app = getApp();
const { getCity, getDishesByCity } = require("../../services/dish");
const { getCurrentCityByLocation } = require("../../services/location");

const mealOptions = [
  { key: "早餐", icon: "🥟", title: "早餐", subtitle: "先垫一口" },
  { key: "午餐", icon: "🍚", title: "午餐", subtitle: "认真吃饭" },
  { key: "晚餐", icon: "🍲", title: "晚餐", subtitle: "今晚安排" },
  { key: "夜宵", icon: "🌙", title: "宵夜", subtitle: "不许饿睡" }
];

function buildMealOptions(selectedMeal) {
  return mealOptions.map((item) => Object.assign({}, item, {
    className: item.key === selectedMeal ? "active" : ""
  }));
}

const cityInspiration = {
  广州: "老广说，先喝碗热的。",
  深圳: "快一点，也要好吃一点。",
  佛山: "功夫到位，饭点也到位。",
  潮州: "鲜味这件事，潮州很认真。",
  汕头: "牛肉丸先弹一下。",
  珠海: "海风吹到饭点。",
  东莞: "这一顿，吃点实在的。",
  中山: "烟火气刚刚好。",
  汕尾: "海味和小吃都安排。",
  湛江: "鸡香海鲜香，转到都不慌。"
};

function getRatingIcon(type) {
  const icons = {
    chili: "🌶",
    bowl: "🍚",
    flame: "🔥"
  };
  return icons[type] || "🍚";
}

function getCategoryIcon(category) {
  const icons = {
    正餐: "🍚",
    小吃: "🥢",
    甜品: "🍮",
    饮品: "🥤"
  };
  return icons[category] || "🍽";
}

function getTasteIcon(taste) {
  const icons = {
    清淡: "🍵",
    鲜香: "✨",
    重口: "🔥",
    甜口: "🍯"
  };
  return icons[taste] || "🧂";
}

function getKindIcon(dish) {
  const tags = dish.tags || [];
  if (tags.includes("海鲜")) return "🌊";
  if (tags.includes("牛肉")) return "🥩";
  if (tags.includes("粥品")) return "🥣";
  if (tags.includes("火锅")) return "🍲";
  if (tags.includes("面食") || tags.includes("汤粉") || tags.includes("米粉")) return "🍜";
  if (tags.includes("糕点") || dish.category === "甜品") return "🍮";
  return getCategoryIcon(dish.category);
}

function withRatingIcons(dish) {
  const count = Math.max(0, Math.min(5, Number(dish.localIndex) || 0));
  const ratingIcon = getRatingIcon(dish.iconType);
  return Object.assign({}, dish, {
    ratingText: ratingIcon.repeat(count) || "🍚",
    ratingItems: [0, 1, 2, 3, 4].map((index) => ({
      key: index,
      icon: ratingIcon,
      active: index < count,
      className: index < count ? "active" : ""
    })),
    iconBadges: [
      { icon: getKindIcon(dish), label: dish.category },
      { icon: getTasteIcon(dish.taste), label: dish.taste },
      { icon: ratingIcon, label: `特色${dish.localIndex || 0}` }
    ]
  });
}

function getLocationFailureMessage(error) {
  const message = error && error.message ? error.message : "可以先手动选择城市。";
  if (message.includes("auth deny") || message.includes("authorize") || message.includes("permission")) {
    return "还没有开启位置权限，可以稍后在微信授权里打开，也可以先手动选择城市。";
  }
  if (message.includes("url not in domain list") || message.includes("domain")) {
    return "定位服务域名还没有在当前环境生效，可以刷新项目配置后再试，或先手动选择城市。";
  }
  if (message.includes("INVALID_USER_KEY") || message.includes("USERKEY")) {
    return "定位服务配置暂不可用，可以先手动选择城市。";
  }
  return message;
}

function uniqueByName(dishes) {
  const used = {};
  return dishes.filter((dish) => {
    if (!dish || used[dish.name]) return false;
    used[dish.name] = true;
    return true;
  });
}

function getFeaturedDishes(cityName) {
  const dishes = uniqueByName(getDishesByCity(cityName));
  const localDishes = dishes.filter((dish) => dish.sourceBucket === "cityExact");
  const fallbackDishes = dishes.filter((dish) => dish.sourceBucket !== "cityExact");
  return localDishes.concat(fallbackDishes).slice(0, 3).map((dish, index) =>
    Object.assign(withRatingIcons(dish), {
      cardClass: index === 0 ? "large" : ""
    })
  );
}

Page({
  data: {
    city: "广州",
    province: "广东",
    locating: false,
    selectedMeal: "午餐",
    mealOptions: buildMealOptions("午餐"),
    featuredDishes: [],
    featuredEmpty: true,
    inspiration: "",
    dishSheetVisible: false,
    detailDish: null,
    privacyVisible: false,
    privacyContractName: "《用户隐私保护指引》"
  },

  onShow() {
    const city = app.globalData.currentCity || "广州";
    this.setCity(city);
  },

  setCity(cityName) {
    const city = getCity(cityName);
    const featuredDishes = getFeaturedDishes(city.name);
    this.setData({
      city: city.name,
      province: city.province || "广东",
      featuredDishes,
      featuredEmpty: !featuredDishes.length,
      inspiration: cityInspiration[city.name] || city.slogan || "今天这一顿，交给饭点转转。"
    });
  },

  onUseLocation() {
    this.ensurePrivacyAuthorization(() => this.startLocation());
  },

  ensurePrivacyAuthorization(next) {
    if (typeof wx.getPrivacySetting !== "function") {
      next();
      return;
    }
    wx.getPrivacySetting({
      success: (res) => {
        if (!res.needAuthorization) {
          next();
          return;
        }
        this.pendingPrivacyAction = next;
        this.setData({
          privacyVisible: true,
          privacyContractName: res.privacyContractName || "《用户隐私保护指引》"
        });
      },
      fail: () => next()
    });
  },

  onOpenPrivacyContract() {
    if (typeof wx.openPrivacyContract !== "function") {
      wx.navigateTo({ url: "/pages/privacy/privacy" });
      return;
    }
    wx.openPrivacyContract({
      fail: () => {
        wx.navigateTo({ url: "/pages/privacy/privacy" });
      }
    });
  },

  onAgreePrivacyAuthorization() {
    const action = this.pendingPrivacyAction;
    this.pendingPrivacyAction = null;
    this.setData({ privacyVisible: false });
    if (action) action();
  },

  onRejectPrivacyAuthorization() {
    this.pendingPrivacyAction = null;
    this.setData({ privacyVisible: false });
    wx.showToast({
      title: "可以手动选择城市",
      icon: "none"
    });
  },

  startLocation() {
    this.setData({ locating: true });
    const finish = () => {
      this.setData({ locating: false });
    };
    getCurrentCityByLocation()
      .then(({ city }) => {
        app.setCurrentCity(city);
        this.setCity(city);
        wx.showToast({
          title: `已切到${city}`,
          icon: "success"
        });
      })
      .catch((error) => {
        console.error("定位失败", error);
        wx.showModal({
          title: "定位失败",
          content: getLocationFailureMessage(error),
          confirmText: "手动选城",
          cancelText: "知道了",
          success: (res) => {
            if (res.confirm) this.onChooseCity();
          }
        });
      })
      .then(finish, finish);
  },

  onChooseCity() {
    wx.navigateTo({ url: "/pages/city/city" });
  },

  onSelectMeal(event) {
    const selectedMeal = event.currentTarget.dataset.meal;
    this.setData({
      selectedMeal,
      mealOptions: buildMealOptions(selectedMeal)
    });
  },

  onStartSpin() {
    const city = app.globalData.currentCity || this.data.city;
    wx.navigateTo({
      url: `/pages/spin/spin?city=${encodeURIComponent(city)}&mealTime=${encodeURIComponent(this.data.selectedMeal)}`
    });
  },

  onOpenDish(event) {
    const { id } = event.currentTarget.dataset;
    const detailDish = this.data.featuredDishes.find((dish) => dish.id === id);
    if (!detailDish) return;
    this.setData({
      detailDish,
      dishSheetVisible: true
    });
  },

  onCloseDishSheet() {
    this.setData({ dishSheetVisible: false });
  },

  onSearch() {
    wx.navigateTo({ url: "/pages/search/search" });
  },

  onFavorite() {
    wx.navigateTo({ url: "/pages/favorite/favorite" });
  },

  onCreatePoll() {
    wx.navigateTo({ url: "/pages/poll-create/poll-create" });
  },

  onOpenPrivacy() {
    wx.navigateTo({ url: "/pages/privacy/privacy" });
  }
});
