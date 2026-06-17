const app = getApp();
const { getCity, getDishesByCity } = require("../../services/dish");
const { getCurrentCityByLocation } = require("../../services/location");
const { getDishRatingIcon, iconRatingItems } = require("../../utils/random");

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

const defaultInspirations = [
  "今天这一顿，交给本地味带路。",
  "别再来回问了，先转出一个方向。",
  "从一道能点的菜开始，饭点就顺了。",
  "先看本地菜，不够再换一桌。",
  "这一顿不求复杂，先求想吃。"
];

const mealInspirations = {
  早餐: [
    "早上先吃点顺口的，别空着肚子纠结。",
    "早餐别太复杂，热乎、顶饱、好入口就行。",
    "先把早饭定下来，这一天会轻松一点。",
    "来点适合早上的，本地味也可以很清爽。"
  ],
  午餐: [
    "中午要吃得稳一点，别把时间都花在纠结上。",
    "午餐先找能吃饱的，下午才有力气。",
    "这一顿别随便糊弄，先挑个靠谱方向。",
    "中午适合来点明确的，省心也要好吃。"
  ],
  晚餐: [
    "晚餐可以放松一点，吃点舒服的。",
    "今天这顿慢慢定，适合晚上的先摆出来。",
    "晚上别太赶，先看几道有胃口的。",
    "晚餐要有点满足感，先从本地味里挑。"
  ],
  夜宵: [
    "夜宵别太正式，来点解馋的就好。",
    "这个点适合吃点轻松的，别再反复想。",
    "夜里饿了就别硬扛，先看几道顺口的。",
    "宵夜要的是痛快，先挑个想吃的方向。"
  ]
};

const cityInspirations = {
  广州: ["老广说，先喝碗热的。", "早茶和烧味都在线，先挑个顺口的。", "广州这一顿，讲究一个热乎和妥帖。"],
  深圳: ["快一点，也要好吃一点。", "忙归忙，饭点不能随便糊弄。", "深圳这一顿，先给选择提提速。"],
  佛山: ["功夫到位，饭点也到位。", "顺德味道先打个底。", "佛山这一顿，慢慢吃也很值得。"],
  潮州: ["鲜味这件事，潮州很认真。", "卤味、粿条、砂锅粥，总有一口能中。", "潮州这一顿，先让鲜香开场。"],
  汕头: ["牛肉丸先弹一下。", "汕头这口鲜，适合把饭点定下来。", "粿条和牛肉都在等，先转一道。"],
  珠海: ["海风吹到饭点。", "珠海这一顿，清爽一点也不错。", "靠海的城市，先给胃口一点鲜。"],
  东莞: ["这一顿，吃点实在的。", "东莞饭点不绕弯，先来点管饱的。", "想吃得踏实，就从本地味开始。"],
  中山: ["烟火气刚刚好。", "中山这一顿，家常一点也舒服。", "先让本地味给饭局打个底。"],
  汕尾: ["海味和小吃都安排。", "汕尾本地菜，先让海味开个头。", "今天别纠结，汕尾这口先试试。", "汕尾这一顿，鲜香和小吃都能上桌。"],
  湛江: ["鸡香海鲜香，转到都不慌。", "湛江这一顿，海鲜和白切鸡都很有底气。", "想吃鲜一点，湛江很会安排。"],
  长春: ["长春这一顿，先吃点扎实的。", "东北味上桌，饭点就不虚。", "想吃热乎管饱的，长春很合适。"],
  成都: ["成都这一顿，香味先到。", "想吃点有劲的，成都很懂。", "麻辣只是开头，好吃才是重点。"],
  重庆: ["重庆这一顿，先把胃口叫醒。", "火热一点，饭点就有方向。", "重口味上场，纠结先放一边。"],
  北京: ["北京这一顿，先来点踏实的。", "从一口热乎开始，饭点就稳了。", "想快点定下来，北京这桌先看看。"],
  上海: ["上海这一顿，精致一点也不麻烦。", "本帮味先摆上，慢慢挑也行。", "想吃顺口的，上海这桌先给方向。"]
};

function pickOne(list) {
  if (!list || !list.length) return "";
  return list[Math.floor(Math.random() * list.length)];
}

function shuffle(list) {
  const copy = list.slice();
  for (let index = copy.length - 1; index > 0; index -= 1) {
    const target = Math.floor(Math.random() * (index + 1));
    const temp = copy[index];
    copy[index] = copy[target];
    copy[target] = temp;
  }
  return copy;
}

function normalizeMeal(meal) {
  return meal === "夜宵" ? "宵夜" : meal;
}

function getCityInspiration(city, selectedMeal) {
  const mealCopy = pickOne(mealInspirations[selectedMeal]);
  const cityCopy = pickOne(cityInspirations[city.name]);
  if (mealCopy && cityCopy && Math.random() > 0.45) {
    return Math.random() > 0.5 ? mealCopy : cityCopy;
  }
  return mealCopy || cityCopy || city.slogan || pickOne(defaultInspirations);
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

function addBadge(list, used, icon, label) {
  if (!label || used[label] || list.length >= 6) return;
  used[label] = true;
  list.push({ icon, label });
}

function addNameBadges(dish, badges, used) {
  const name = dish.name || "";
  if (/粥|汤|羹|盅/.test(name)) addBadge(badges, used, "🥣", "暖胃");
  if (/粉|面|粿条|河粉|米线|馄饨|云吞/.test(name)) addBadge(badges, used, "🍜", "粉面主食");
  if (/饭|粽|包|饼|馍/.test(name)) addBadge(badges, used, "🍚", "顶饱");
  if (/虾|蟹|蚝|鱼|鳝|螺|贝|海参|鱿/.test(name)) addBadge(badges, used, "🦐", "水产鲜");
  if (/鸡|鸭|鹅|乳鸽|鸽/.test(name)) addBadge(badges, used, "🍗", "禽肉");
  if (/牛|羊|排骨|扣肉|猪|肉丸|肉饼|蹄/.test(name)) addBadge(badges, used, "🥩", "肉食");
  if (/火锅|锅|煲|边炉/.test(name)) addBadge(badges, used, "🍲", "热锅");
  if (/蒸|白灼|清炖|清汤|清蒸/.test(name)) addBadge(badges, used, "♨️", "清爽");
  if (/烧|烤|煎|炸|酥|脆/.test(name)) addBadge(badges, used, "🔥", "香口");
  if (/卤|酱|焖|扣|焗|炆/.test(name)) addBadge(badges, used, "🥘", "入味");
  if (/糖|奶|糕|甜|酥糖|凉果|月饼|双皮奶/.test(name)) addBadge(badges, used, "🍮", "甜点");
  if (/茶|汁|豆浆|奶|饮/.test(name)) addBadge(badges, used, "🥤", "喝一口");
  if (/酸|辣|麻/.test(name)) addBadge(badges, used, "🌶", "开胃");
}

function getDishBadges(dish, ratingIcon) {
  const tags = dish.tags || [];
  const meals = dish.mealTime || [];
  const scenes = dish.scene || [];
  const badges = [];
  const used = {};

  if (dish.sourceBucket === "cityExact") addBadge(badges, used, "📍", "本地味");
  if (dish.sourceBucket === "regionalShared" || dish.sourceBucket === "provinceShared") addBadge(badges, used, "🗺", "省内味");
  if (dish.sourceBucket === "nationalGeneral") addBadge(badges, used, "🍽", "常见款");
  if (dish.localIndex >= 5) addBadge(badges, used, ratingIcon, "很本地");
  addNameBadges(dish, badges, used);
  if (meals.includes("早餐")) addBadge(badges, used, "🌤", "适合早餐");
  if (meals.includes("午餐")) addBadge(badges, used, "☀️", "午餐可点");
  if (meals.includes("晚餐")) addBadge(badges, used, "🌙", "适合晚餐");
  if (meals.includes("夜宵")) addBadge(badges, used, "🌃", "夜宵可选");
  if (tags.includes("下饭")) addBadge(badges, used, "🍚", "下饭");
  if (tags.includes("海鲜")) addBadge(badges, used, "🌊", "海味");
  if (tags.includes("肉类")) addBadge(badges, used, "🥩", "肉香");
  if (tags.includes("火锅")) addBadge(badges, used, "🍲", "热乎");
  if (tags.includes("汤羹") || tags.includes("汤粥")) addBadge(badges, used, "🥣", "汤水");
  if (tags.includes("饮品")) addBadge(badges, used, "🥤", "饮品");
  if (tags.includes("粉面") || tags.includes("面食") || tags.includes("汤粉") || tags.includes("米粉")) addBadge(badges, used, "🍜", "粉面");
  if (tags.includes("糕点")) addBadge(badges, used, "🍮", "点心");
  if (tags.includes("夜宵")) addBadge(badges, used, "🌃", "宵夜感");
  if (scenes.includes("一个人")) addBadge(badges, used, "🥢", "一人也行");
  if (scenes.includes("两个人")) addBadge(badges, used, "👥", "两人友好");
  if (scenes.includes("朋友聚餐")) addBadge(badges, used, "🍻", "聚餐可点");
  if (dish.taste === "鲜香") addBadge(badges, used, "✨", "鲜香口");
  if (dish.taste === "清淡") addBadge(badges, used, "🍵", "清淡口");
  if (dish.taste === "重口") addBadge(badges, used, "🔥", "重口味");
  if (dish.taste === "甜口") addBadge(badges, used, "🍯", "甜口");

  addBadge(badges, used, getKindIcon(dish), dish.category);
  addBadge(badges, used, getTasteIcon(dish.taste), dish.taste);
  addBadge(badges, used, ratingIcon, `特色${dish.localIndex || 0}`);
  return badges.slice(0, 5);
}

function withRatingIcons(dish) {
  const count = Math.max(0, Math.min(5, Number(dish.localIndex) || 0));
  const ratingIcon = getDishRatingIcon(dish);
  const ratingLabel = dish.sourceBucket === "cityExact"
    ? "本地特色"
    : dish.sourceBucket === "regionalShared"
      ? "周边参考"
      : "换个口味";
  return Object.assign({}, dish, {
    ratingLabel,
    ratingText: ratingIcon.repeat(count) || "🍚",
    ratingItems: iconRatingItems(dish.localIndex, dish).map((item) =>
      Object.assign({}, item, {
        className: item.active ? "active" : ""
      })
    ),
    iconBadges: getDishBadges(dish, ratingIcon)
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

function dishMatchesMeal(dish, selectedMeal) {
  return (dish.mealTime || []).includes(normalizeMeal(selectedMeal));
}

function hasMismatchedPlaceName(dish, cityName) {
  const placeNames = [
    "宝安",
    "顺德",
    "潮州",
    "汕头",
    "东莞",
    "广州",
    "佛山",
    "深圳",
    "湛江",
    "梅州",
    "阳江",
    "肇庆",
    "珠海",
    "中山",
    "河源",
    "惠州",
    "江门",
    "揭阳",
    "茂名",
    "清远",
    "韶关",
    "云浮"
  ];
  return placeNames.some((name) => name !== cityName && dish.name.includes(name));
}

function isSafeHomeFallback(dish, cityName) {
  if (dish.sourceBucket === "cityExact") return true;
  if (hasMismatchedPlaceName(dish, cityName)) return false;
  return dish.localIndex <= 4;
}

function takeUnique(target, list) {
  const used = target.reduce((map, dish) => {
    map[dish.name] = true;
    return map;
  }, {});
  list.forEach((dish) => {
    if (target.length >= 3 || used[dish.name]) return;
    used[dish.name] = true;
    target.push(dish);
  });
}

function getFeaturedDishes(cityName, selectedMeal) {
  const dishes = uniqueByName(getDishesByCity(cityName));
  const normalizedMeal = normalizeMeal(selectedMeal);
  const strictMeal = normalizedMeal === "午餐" || normalizedMeal === "晚餐";
  const localMealDishes = dishes.filter((dish) => dish.sourceBucket === "cityExact" && dishMatchesMeal(dish, selectedMeal));
  const localDishes = dishes.filter((dish) => dish.sourceBucket === "cityExact" && !dishMatchesMeal(dish, selectedMeal));
  const safeFallbackMealDishes = dishes.filter((dish) => (
    dish.sourceBucket !== "cityExact" &&
    dishMatchesMeal(dish, selectedMeal) &&
    isSafeHomeFallback(dish, cityName)
  ));
  const safeFallbackDishes = dishes.filter((dish) => (
    dish.sourceBucket !== "cityExact" &&
    !dishMatchesMeal(dish, selectedMeal) &&
    isSafeHomeFallback(dish, cityName)
  ));
  const selected = [];

  takeUnique(selected, shuffle(localMealDishes));
  if (strictMeal) {
    takeUnique(selected, shuffle(localDishes));
  } else {
    takeUnique(selected, shuffle(safeFallbackMealDishes));
    takeUnique(selected, shuffle(localDishes));
    takeUnique(selected, shuffle(safeFallbackDishes));
  }

  return selected.slice(0, 3).map((dish, index) =>
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
    const selectedMeal = this.data.selectedMeal || "午餐";
    const featuredDishes = getFeaturedDishes(city.name, selectedMeal);
    this.setData({
      city: city.name,
      province: city.province || "广东",
      featuredDishes,
      featuredEmpty: !featuredDishes.length,
      inspiration: getCityInspiration(city, selectedMeal)
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
    const city = getCity(this.data.city);
    const featuredDishes = getFeaturedDishes(city.name, selectedMeal);
    this.setData({
      selectedMeal,
      mealOptions: buildMealOptions(selectedMeal),
      featuredDishes,
      featuredEmpty: !featuredDishes.length,
      inspiration: getCityInspiration(city, selectedMeal)
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
