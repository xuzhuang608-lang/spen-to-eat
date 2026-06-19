const app = getApp();
const { getCandidateDishes, getDishById, getCity, ensureProvinceLoaded } = require("../../services/dish");

const rawOptionGroups = [
  { key: "scene", title: "场景", options: ["不限", "一个人", "两个人", "朋友聚餐"] },
  { key: "taste", title: "口味", options: ["不限", "清淡", "鲜香", "重口", "甜口"] },
  { key: "category", title: "类型", options: ["不限", "正餐", "小吃", "甜品", "饮品"] },
  { key: "mealTime", title: "用餐时间", options: ["不限", "早餐", "午餐", "晚餐", "夜宵"] }
];

const rawAvoidOptions = ["不吃辣", "不吃海鲜", "不吃甜", "不吃内脏", "不吃牛肉", "不吃猪肉", "不吃生冷", "吃素食"];
const SPIN_DURATION_MS = 2200;
const RESULT_REVEAL_DELAY_MS = 1800;

const avoidMap = {
  不吃辣: "辣",
  不吃海鲜: "海鲜",
  不吃甜: "甜",
  不吃内脏: "内脏",
  不吃牛肉: "牛肉",
  不吃猪肉: "猪肉",
  不吃生冷: "生冷",
  吃素食: "肉类"
};

const defaultFilters = {
  mealTime: "不限",
  category: "不限",
  taste: "不限",
  scene: "不限",
  avoidLabels: []
};


function buildOptionGroups(filters) {
  return rawOptionGroups.map((group) => ({
    key: group.key,
    title: group.title,
    options: group.options.map((option) => ({
      label: option,
      active: filters[group.key] === option,
      className: filters[group.key] === option ? "active" : ""
    }))
  }));
}

function buildAvoidOptions(avoidLabels) {
  return rawAvoidOptions.map((label) => ({
    label,
    active: avoidLabels.includes(label),
    className: avoidLabels.includes(label) ? "active" : ""
  }));
}

function shuffle(list) {
  const copy = list.slice();
  for (let i = copy.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    const temp = copy[i];
    copy[i] = copy[j];
    copy[j] = temp;
  }
  return copy;
}

function getDishIcon(dish) {
  const tags = dish.tags || [];
  if (tags.includes("海鲜") || dish.name.includes("蚝")) return "🌊";
  if (tags.includes("牛肉") || dish.name.includes("牛")) return "🥩";
  if (tags.includes("粥品") || dish.name.includes("粥")) return "🥣";
  if (tags.includes("火锅") || dish.name.includes("锅")) return "🍲";
  if (tags.includes("面食") || tags.includes("汤粉") || tags.includes("米粉") || dish.name.includes("面") || dish.name.includes("粉")) return "🍜";
  if (tags.includes("糕点") || dish.category === "甜品") return "🍮";
  if (dish.category === "饮品") return "🥤";
  if (dish.category === "小吃") return "🥢";
  return "🍚";
}

function getDishPlateClass(dish) {
  const tags = dish.tags || [];
  if (tags.includes("海鲜") || dish.name.includes("蚝")) return "seafood";
  if (tags.includes("牛肉") || dish.name.includes("牛") || dish.name.includes("鸡") || dish.name.includes("鹅")) return "meat";
  if (tags.includes("粥品") || dish.name.includes("粥") || dish.name.includes("面") || dish.name.includes("粉")) return "staple";
  if (dish.category === "甜品" || tags.includes("糕点")) return "sweet";
  return "plain";
}

function getDishPositionStyle(index, count) {
  const safeCount = Math.max(1, count || 1);
  const angle = (360 / safeCount) * index;
  const radian = angle * Math.PI / 180;
  const radius = safeCount <= 2 ? 188 : safeCount <= 4 ? 202 : 210;
  const center = 285;
  const itemWidth = 154;
  const itemHeight = 92;
  const left = Math.round(center + Math.sin(radian) * radius - itemWidth / 2);
  const top = Math.round(center - Math.cos(radian) * radius - itemHeight / 2);
  return {
    angle,
    style: `left:${left}rpx;top:${top}rpx;`
  };
}

function pickCandidates(pool, previousIds) {
  if (!pool.length) return [];
  const previous = previousIds || [];
  const fresh = pool.filter((dish) => !previous.includes(dish.id));
  const source = fresh.length >= 8 ? fresh : pool;
  const selected = shuffle(source).slice(0, 8);
  const count = selected.length;
  return selected.map((dish, index) => {
    const position = getDishPositionStyle(index, count);
    return {
      id: dish.id,
      name: dish.name,
      shortName: String(dish.name || "").trim().slice(0, 6),
      icon: getDishIcon(dish),
      category: dish.category,
      taste: dish.taste,
      weight: dish.weight || 1,
      posClass: `pos-${count}-${index}`,
      positionStyle: position.style,
      slotIndex: index,
      slotAngle: position.angle,
      plateClass: getDishPlateClass(dish),
      spinStateClass: "",
      menuStateClass: dish.custom ? "custom" : "",
      replaceClass: "",
      custom: !!dish.custom
    };
  });
}

function relayoutCandidates(list) {
  const count = (list || []).length;
  return (list || []).map((dish, index) => {
    const position = getDishPositionStyle(index, count);
    return Object.assign({}, dish, {
      posClass: `pos-${count}-${index}`,
      positionStyle: position.style,
      slotIndex: index,
      slotAngle: position.angle
    });
  });
}

function decorateCandidateState(list, chosenMap, customMode, customTargetIndex) {
  return (list || []).map((dish, index) => {
    const spinClasses = [];
    const menuClasses = [];
    if (chosenMap && chosenMap[dish.id]) spinClasses.push("picked");
    if (dish.custom) menuClasses.push("custom");
    if (customMode && customTargetIndex === index) {
      spinClasses.push("replace-target");
      menuClasses.push("replace-target");
    }
    return Object.assign({}, dish, {
      spinStateClass: spinClasses.join(" "),
      menuStateClass: menuClasses.join(" "),
      replaceClass: customMode && customTargetIndex === index ? "active" : ""
    });
  });
}

function createCustomDish(name, index, replacedDish, count) {
  const text = String(name || "").trim().slice(0, 8);
  const position = getDishPositionStyle(index, count || 1);
  return {
    id: `custom-${Date.now()}-${Math.floor(Math.random() * 10000)}`,
    name: text,
    shortName: String(text || "").trim().slice(0, 6),
    icon: "🍽️",
    category: "自选",
    taste: "想吃",
    weight: replacedDish && replacedDish.weight ? replacedDish.weight : 1,
    posClass: `pos-${count || 1}-${index}`,
    positionStyle: position.style,
    slotIndex: index,
    slotAngle: position.angle,
    plateClass: "custom",
    custom: true
  };
}

function createCandidateFromDish(dish, index, replacedDish, count) {
  const position = getDishPositionStyle(index, count || 1);
  return {
    id: dish.id,
    name: dish.name,
    shortName: String(dish.name || "").trim().slice(0, 6),
    icon: getDishIcon(dish),
    category: dish.category,
    taste: dish.taste,
    weight: dish.weight || (replacedDish && replacedDish.weight) || 1,
    posClass: `pos-${count || 1}-${index}`,
    positionStyle: position.style,
    slotIndex: index,
    slotAngle: position.angle,
    plateClass: getDishPlateClass(dish),
    spinStateClass: "",
    menuStateClass: "",
    replaceClass: "",
    custom: !!dish.custom
  };
}

function weightedPick(list) {
  if (!list.length) return null;
  const total = list.reduce((sum, item) => sum + (item.weight || 1), 0);
  let cursor = Math.random() * total;
  for (let i = 0; i < list.length; i += 1) {
    cursor -= list[i].weight || 1;
    if (cursor <= 0) return list[i];
  }
  return list[list.length - 1];
}

function getTargetSpinAngle(currentAngle, slotAngle) {
  const target = (360 - (Number(slotAngle) || 0)) % 360;
  const current = ((currentAngle % 360) + 360) % 360;
  const delta = (target - current + 360) % 360;
  return currentAngle + 2520 + delta;
}

function buildFilterSummary(filters) {
  const parts = [filters.mealTime, filters.category, filters.taste, filters.scene]
    .filter((item) => item && item !== "不限");
  if (filters.avoidLabels.length) {
    parts.push(filters.avoidLabels.slice(0, 2).join("、"));
  }
  return parts.length ? parts.join(" · ") : "不限条件";
}

function safeDecode(value) {
  try {
    return decodeURIComponent(value || "");
  } catch (error) {
    return value || "";
  }
}

function parseAvoidLabels(value) {
  return safeDecode(value)
    .split(",")
    .map((item) => item.trim())
    .filter((item) => rawAvoidOptions.includes(item));
}

function buildResultUrl(id, filters) {
  const params = [`id=${encodeURIComponent(id)}`];
  ["mealTime", "category", "taste", "scene"].forEach((key) => {
    const value = filters[key];
    if (value && value !== "不限") {
      params.push(`${key}=${encodeURIComponent(value)}`);
    }
  });
  if (filters.avoidLabels && filters.avoidLabels.length) {
    params.push(`avoidLabels=${encodeURIComponent(filters.avoidLabels.join(","))}`);
  }
  return `/pages/result/result?${params.join("&")}`;
}

function getStoredInspirationDishes(key, city, mealTime) {
  if (!key) return [];
  const payload = wx.getStorageSync("inspirationSpinDishes") || {};
  if (payload.key !== key) return [];
  if (city && payload.city && payload.city !== city) return [];
  if (mealTime && payload.mealTime && payload.mealTime !== mealTime) return [];
  return Array.isArray(payload.dishes) ? payload.dishes.filter(Boolean) : [];
}

function getStoredInspirationDishById(id) {
  const payload = wx.getStorageSync("inspirationSpinDishes") || {};
  const dishes = Array.isArray(payload.dishes) ? payload.dishes : [];
  return dishes.find((dish) => dish && dish.id === id) || null;
}

function mergeInspirationPool(inspirationDishes, regularPool, avoidDishId) {
  const selected = [];
  const usedIds = {};
  const usedNames = {};
  const addDish = (dish) => {
    if (!dish || selected.length >= 8) return;
    if (avoidDishId && dish.id === avoidDishId) return;
    const name = String(dish.name || "");
    if (usedIds[dish.id] || usedNames[name]) return;
    usedIds[dish.id] = true;
    usedNames[name] = true;
    selected.push(dish);
  };
  (inspirationDishes || []).forEach(addDish);
  shuffle(regularPool || []).forEach(addDish);
  return selected;
}

Page({
  data: {
    city: "广州",
    optionGroups: buildOptionGroups(defaultFilters),
    avoidOptions: buildAvoidOptions(defaultFilters.avoidLabels),
    filters: defaultFilters,
    filterSummary: buildFilterSummary(defaultFilters),
    filterToggleText: "调整偏好",
    filterVisible: false,
    candidateDishes: [],
    spinning: false,
    spinningClass: "",
    spinRound: 0,
    spinAngle: 0,
    counterSpinAngle: 0,
    pickedName: "",
    pickedDishId: "",
    spinButtonText: "开始转动",
    jumpingToResult: false,
    chosenMap: {},
    hasContent: true,
    emptyVisible: false,
    loadingMenu: false,
    loadingText: "正在准备本地菜单",
    customMode: false,
    customTargetIndex: -1,
    customName: "",
    dishSheetVisible: false,
    detailDish: null,
    avoidDishId: "",
    inspirationKey: "",
    inspirationDishes: []
  },

  onLoad(query) {
    const city = query.city ? safeDecode(query.city) : app.globalData.currentCity;
    const avoidDishId = query.avoidDishId ? safeDecode(query.avoidDishId) : "";
    const inspirationKey = query.inspirationKey ? safeDecode(query.inspirationKey) : "";
    if (city) {
      app.setCurrentCity(city);
    }
    const filters = Object.assign({}, defaultFilters, { avoidLabels: [] });
    ["mealTime", "category", "taste", "scene"].forEach((key) => {
      if (query[key]) {
        filters[key] = safeDecode(query[key]);
      }
    });
    if (query.avoidLabels) {
      filters.avoidLabels = parseAvoidLabels(query.avoidLabels);
    }

    this.setData({
      city,
      filters,
      optionGroups: buildOptionGroups(filters),
      avoidOptions: buildAvoidOptions(filters.avoidLabels),
      filterSummary: buildFilterSummary(filters),
      avoidDishId,
      inspirationKey,
      inspirationDishes: getStoredInspirationDishes(inspirationKey, city, filters.mealTime)
    }, () => {
      this.refreshCandidatesAfterLoad([]);
      if (avoidDishId) {
        wx.showToast({ title: "这次先避开它", icon: "none" });
      }
    });
  },

  onShow() {
    const city = app.globalData.currentCity;
    if (!city || city === this.data.city) {
      if (this.data.jumpingToResult) {
        this.setData({ jumpingToResult: false, spinButtonText: "再转一次" });
      }
      return;
    }
    this.setData({
      city,
      candidateDishes: [],
      pickedName: "",
      pickedDishId: "",
      spinButtonText: "开始转动",
      jumpingToResult: false,
      chosenMap: {},
      spinning: false,
      spinningClass: "",
      customMode: false,
      customTargetIndex: -1,
      customName: ""
    }, () => this.refreshCandidatesAfterLoad([]));
  },

  onChooseCity() {
    wx.navigateTo({ url: "/pages/city/city" });
  },

  getAvoidTags() {
    return this.data.filters.avoidLabels.map((label) => avoidMap[label]).filter(Boolean);
  },

  getRegularPool() {
    const pool = getCandidateDishes({
      city: this.data.city,
      mealTime: this.data.filters.mealTime,
      category: this.data.filters.category,
      taste: this.data.filters.taste,
      scene: this.data.filters.scene,
      avoidTags: this.getAvoidTags()
    });
    return this.data.avoidDishId ? pool.filter((dish) => dish.id !== this.data.avoidDishId) : pool;
  },

  getPool() {
    if (this.data.inspirationDishes && this.data.inspirationDishes.length) {
      return mergeInspirationPool(this.data.inspirationDishes, this.getRegularPool(), this.data.avoidDishId);
    }
    return this.getRegularPool();
  },

  refreshCandidates(previousIds) {
    const pool = this.getPool();
    const candidateDishes = pickCandidates(pool, previousIds);
    this.setData({
      candidateDishes: decorateCandidateState(candidateDishes, {}, false, -1),
      hasContent: pool.length > 0,
      emptyVisible: pool.length <= 0,
      pickedName: "",
      pickedDishId: "",
      spinButtonText: "开始转动",
      jumpingToResult: false
    });
  },

  refreshCandidatesAfterLoad(previousIds) {
    const city = getCity(this.data.city);
    const requestId = (this.__cityLoadRequestId || 0) + 1;
    this.__cityLoadRequestId = requestId;
    this.setData({
      loadingMenu: true,
      loadingText: `正在准备${city.name}菜单`,
      emptyVisible: false
    });
    return ensureProvinceLoaded(city.province).then((provinceData) => {
      if (requestId !== this.__cityLoadRequestId) return;
      if (!provinceData && city.province !== "广东") {
        wx.showToast({
          title: "本地菜单加载较慢，先用通用菜单",
          icon: "none"
        });
      }
      this.refreshCandidates(previousIds);
    }).catch((error) => {
      if (requestId !== this.__cityLoadRequestId) return;
      console.error("菜单加载失败", error);
      wx.showToast({
        title: "菜单加载失败，已先放通用菜",
        icon: "none"
      });
      this.refreshCandidates(previousIds);
    }).then(() => {
      if (requestId !== this.__cityLoadRequestId) return;
      this.setData({ loadingMenu: false });
    });
  },

  onRefreshCandidates() {
    const previousIds = this.data.candidateDishes.map((dish) => dish.id);
    this.setData({
      pickedName: "",
      pickedDishId: "",
      spinButtonText: "开始转动",
      jumpingToResult: false,
      chosenMap: {},
      customMode: false,
      customTargetIndex: -1,
      customName: ""
    });
    this.refreshCandidatesAfterLoad(previousIds);
  },

  onRemoveCandidate(event) {
    if (this.data.spinning) return;
    const { id } = event.currentTarget.dataset;
    const candidateDishes = relayoutCandidates(
      this.data.candidateDishes.filter((dish) => dish.id !== id)
    );
    this.setData({
      candidateDishes: decorateCandidateState(candidateDishes, {}, false, -1),
      hasContent: candidateDishes.length > 0,
      emptyVisible: candidateDishes.length <= 0,
      pickedName: "",
      pickedDishId: "",
      spinButtonText: "开始转动",
      jumpingToResult: false,
      chosenMap: {},
      customMode: false,
      customTargetIndex: -1,
      customName: ""
    });
  },

  onToggleFilters() {
    const filterVisible = !this.data.filterVisible;
    this.setData({
      filterVisible,
      filterToggleText: filterVisible ? "收起偏好" : "调整偏好"
    });
  },

  onSelectOption(event) {
    const { key, value } = event.currentTarget.dataset;
    const filters = Object.assign({}, this.data.filters, { [key]: value });
    this.setData({
      filters,
      optionGroups: buildOptionGroups(filters),
      filterSummary: buildFilterSummary(filters)
    }, () => this.refreshCandidatesAfterLoad([]));
  },

  onToggleAvoid(event) {
    const { value } = event.currentTarget.dataset;
    const avoidLabels = this.data.filters.avoidLabels.slice();
    const index = avoidLabels.indexOf(value);
    if (index >= 0) {
      avoidLabels.splice(index, 1);
    } else {
      avoidLabels.push(value);
    }
    const filters = Object.assign({}, this.data.filters, { avoidLabels });
    this.setData({
      filters,
      avoidOptions: buildAvoidOptions(avoidLabels),
      filterSummary: buildFilterSummary(filters)
    }, () => this.refreshCandidatesAfterLoad([]));
  },

  onOpenDish(event) {
    const { id } = event.currentTarget.dataset;
    if (this.data.customMode) {
      const index = this.data.candidateDishes.findIndex((dish) => dish.id === id);
      if (index >= 0) {
        this.setData({
          customTargetIndex: index,
          candidateDishes: decorateCandidateState(this.data.candidateDishes, this.data.chosenMap, true, index)
        });
      }
      return;
    }
    const dish = this.data.candidateDishes.find((item) => item.id === id);
    if (dish && dish.custom) {
      wx.showToast({ title: "自选菜不看详情", icon: "none" });
      return;
    }
    const detailDish = getDishById(id) || getStoredInspirationDishById(id);
    if (!detailDish) return;
    this.setData({
      detailDish,
      dishSheetVisible: true
    });
  },

  onCloseDishSheet() {
    this.setData({ dishSheetVisible: false });
  },

  onDislikeDetailDish(event) {
    const dish = event.detail && event.detail.dish;
    if (!dish) return;
    const index = this.data.candidateDishes.findIndex((item) => item.id === dish.id);
    if (index < 0) {
      this.setData({ dishSheetVisible: false });
      return;
    }
    const usedIds = this.data.candidateDishes.map((item) => item.id);
    const pool = this.getPool().filter((item) => !usedIds.includes(item.id) && item.id !== dish.id);
    if (!pool.length) {
      wx.showToast({ title: "暂时没有可换的菜", icon: "none" });
      return;
    }
    const candidateDishes = this.data.candidateDishes.slice();
    candidateDishes[index] = createCandidateFromDish(shuffle(pool)[0], index, candidateDishes[index], candidateDishes.length);
    this.setData({
      candidateDishes: decorateCandidateState(candidateDishes, {}, false, -1),
      dishSheetVisible: false,
      pickedName: "",
      pickedDishId: "",
      spinButtonText: "开始转动",
      jumpingToResult: false,
      chosenMap: {},
      customMode: false,
      customTargetIndex: -1,
      customName: ""
    });
    wx.showToast({ title: "已换掉这道", icon: "none" });
  },

  onStartCustomReplace() {
    if (!this.data.candidateDishes.length) return;
    this.setData({
      customMode: true,
      customTargetIndex: -1,
      customName: "",
      candidateDishes: decorateCandidateState(this.data.candidateDishes, this.data.chosenMap, true, -1)
    });
  },

  onCancelCustomReplace() {
    this.setData({
      customMode: false,
      customTargetIndex: -1,
      customName: "",
      candidateDishes: decorateCandidateState(this.data.candidateDishes, this.data.chosenMap, false, -1)
    });
  },

  onInputCustomName(event) {
    this.setData({ customName: event.detail.value });
  },

  onConfirmCustomReplace() {
    const name = String(this.data.customName || "").trim();
    const index = this.data.customTargetIndex;
    if (index < 0) {
      wx.showToast({ title: "先选一道要换掉的", icon: "none" });
      return;
    }
    if (!name) {
      wx.showToast({ title: "先输入菜名", icon: "none" });
      return;
    }
    const candidateDishes = this.data.candidateDishes.slice();
    candidateDishes[index] = createCustomDish(name, index, candidateDishes[index], candidateDishes.length);
    this.setData({
      candidateDishes: decorateCandidateState(candidateDishes, {}, false, -1),
      pickedName: "",
      pickedDishId: "",
      spinButtonText: "开始转动",
      jumpingToResult: false,
      chosenMap: {},
      customMode: false,
      customTargetIndex: -1,
      customName: ""
    });
  },

  onSpin() {
    if (this.data.spinning) return;
    const result = weightedPick(this.data.candidateDishes);
    if (!result) {
      wx.showToast({ title: "菜单还在整理", icon: "none" });
      return;
    }

    const nextAngle = getTargetSpinAngle(this.data.spinAngle, result.slotAngle);

    this.setData({
      spinning: true,
      spinningClass: "spinning",
      spinRound: this.data.spinRound + 1,
      spinAngle: nextAngle,
      counterSpinAngle: -nextAngle,
      pickedName: "",
      pickedDishId: "",
      spinButtonText: "转动中",
      jumpingToResult: false,
      chosenMap: {},
      candidateDishes: decorateCandidateState(this.data.candidateDishes, {}, this.data.customMode, this.data.customTargetIndex)
    });

    setTimeout(() => {
      this.setData({
        spinning: false,
        spinningClass: "",
        pickedName: result.name,
        pickedDishId: result.custom ? "" : result.id,
        spinButtonText: "再转一次",
        jumpingToResult: !result.custom,
        chosenMap: { [result.id]: true },
        candidateDishes: decorateCandidateState(this.data.candidateDishes, { [result.id]: true }, this.data.customMode, this.data.customTargetIndex)
      });
      if (result.custom) {
        wx.showToast({ title: `就吃${result.name}`, icon: "none" });
        return;
      }
      setTimeout(() => {
        wx.navigateTo({ url: buildResultUrl(result.id, this.data.filters) });
      }, RESULT_REVEAL_DELAY_MS);
    }, SPIN_DURATION_MS);
  },

  onViewResult() {
    if (!this.data.pickedDishId) {
      wx.showToast({ title: "先转一道菜", icon: "none" });
      return;
    }
    wx.navigateTo({ url: buildResultUrl(this.data.pickedDishId, this.data.filters) });
  }
});
