const { getDishById, getProposalDishes } = require("../../services/dish");
const {
  shuffle,
  uniqueByName,
  buildWheelItems,
  decorateAddWheelItems,
  weightedPick,
  getTargetWheelAngle
} = require("../../utils/proposal-wheel");

const MAX_PROPOSAL_ITEMS = 12;

function decorateDishes(dishes, selectedMap, isSingle, reactText) {
  return (dishes || []).map((dish) => {
    const selected = !!(selectedMap && selectedMap[dish.id]);
    const classNames = [];
    if (isSingle) classNames.push("single");
    if (selected) classNames.push("active");
    return Object.assign({}, dish, {
      cardClass: classNames.join(" "),
      wantText: selected ? "\u5df2\u60f3\u5403" : reactText,
      showDetail: !dish.custom
    });
  });
}

function safeDecode(value) {
  try {
    return decodeURIComponent(value || "");
  } catch (error) {
    return value || "";
  }
}

function parseCustomDishes(value, city) {
  if (!value) return [];
  try {
    const list = JSON.parse(safeDecode(value));
    return list.slice(0, MAX_PROPOSAL_ITEMS).map((item, index) => ({
      id: item.id || `share-custom-${index}`,
      name: String(item.name || item.n || "").slice(0, 8),
      city: item.city || item.c || city || "自定义",
      category: item.category || item.k || "自定义",
      taste: item.taste || item.t || "想吃",
      custom: true
    })).filter((item) => item.name);
  } catch (error) {
    return [];
  }
}

function makeProposalFromQuery(query) {
  const city = safeDecode(query.city || "");
  const ids = String(query.ids || query.dishId || "")
    .split(",")
    .map((id) => safeDecode(id).trim())
    .filter(Boolean);
  const items = ids.map((id) => getDishById(id)).filter(Boolean);
  const customItems = parseCustomDishes(query.custom, city);
  const allItems = items.concat(customItems).slice(0, MAX_PROPOSAL_ITEMS);
  if (!allItems.length) return null;
  return {
    id: query.id || "",
    city: city || allItems[0].city,
    selectedIds: allItems.map((item) => item.id),
    items: allItems,
    createdAt: Date.now()
  };
}

function getStoredProposal(id) {
  const proposals = wx.getStorageSync("proposals") || {};
  if (proposals[id]) return proposals[id];

  const oldPolls = wx.getStorageSync("polls") || {};
  return oldPolls[id] || null;
}

function getDishNames(dishes, limit) {
  return (dishes || []).slice(0, limit).map((dish) => dish.name).filter(Boolean);
}

function makeMultiTitle(dishes) {
  const names = getDishNames(dishes, 2);
  if (dishes.length <= 2 && names.length) {
    return `${names.join("、")}先摆出来`;
  }
  if (names.length) {
    return `${names.join("、")}等${dishes.length}道先摆出来`;
  }
  return "这几道先摆出来";
}

function makeShareTitle(dishes, isSingle) {
  const names = getDishNames(dishes, 2);
  if (isSingle && names[0]) {
    return `今晚有人提了${names[0]}`;
  }
  if (names.length) {
    return `今晚先看看${names.join("、")}`;
  }
  return "今晚先摆几道，别让饭点卡太久";
}

function getPageCopy(dishes, isSingle, reacted) {
  const firstName = dishes[0] && dishes[0].name;
  if (isSingle) {
    return {
      pageTitle: firstName ? `有人提到了${firstName}` : "有人提到了这道菜",
      pageDesc: "点一下想吃的，群里就好聊了。",
      reactText: reacted ? "已经点头" : "我也想吃",
      shareTitle: makeShareTitle(dishes, true),
      shareDesc: "发给朋友看看，不用从“随便”开始。"
    };
  }
  return {
    pageTitle: makeMultiTitle(dishes),
    pageDesc: "点一下想吃的，群里就好聊了。",
    reactText: "想吃",
    shareTitle: makeShareTitle(dishes, false),
    shareDesc: "让大家先看看这一桌，不用从“随便”开始。"
  };
}

function buildSharePath(dishes) {
  const normalIds = dishes.filter((dish) => !dish.custom).map((dish) => dish.id);
  const custom = dishes.filter((dish) => dish.custom).slice(0, MAX_PROPOSAL_ITEMS).map((dish) => ({
    id: dish.id,
    n: dish.name,
    c: dish.city,
    k: dish.category,
    t: dish.taste
  }));
  const params = [];
  if (normalIds.length) params.push(`ids=${normalIds.map(encodeURIComponent).join(",")}`);
  if (custom.length) params.push(`custom=${encodeURIComponent(JSON.stringify(custom))}`);
  if (dishes[0] && dishes[0].city) params.push(`city=${encodeURIComponent(dishes[0].city)}`);
  return `/pages/poll-detail/poll-detail?${params.join("&")}`;
}

Page({
  data: {
    proposal: null,
    dishes: [],
    selectedMap: {},
    isSingle: false,
    pageTitle: "这顿吃什么",
    pageDesc: "",
    reactText: "想吃这个",
    shareTitle: "把这几道发出去",
    shareDesc: "让大家先看看这一桌，不用从“随便”开始。",
    addWheelVisible: false,
    addWheelItems: [],
    addWheelSpinning: false,
    addWheelAngle: 0,
    addWheelCounterAngle: 0,
    addWheelPicked: null,
    addWheelButtonText: "\u5f00\u59cb\u8f6c\u52a8",
    addWheelChosenMap: {},
    dishSheetVisible: false,
    detailDish: null,
    detailPickLabel: "\u60f3\u5403\u8fd9\u4e2a"
  },

  onLoad(query) {
    this.loadProposal(query || {});
  },

  loadProposal(query) {
    const proposal = query.id ? getStoredProposal(query.id) : makeProposalFromQuery(query);
    if (!proposal) {
      wx.showToast({ title: "这桌菜不见了", icon: "none" });
      return;
    }

    const proposalItems = proposal.items || [];
    const rawDishes = (proposal.selectedIds || proposalItems.map((item) => item.id)).map((dishId) => (
      proposalItems.find((item) => item.id === dishId) || getDishById(dishId)
    )).filter(Boolean).slice(0, MAX_PROPOSAL_ITEMS);
    const isSingle = rawDishes.length === 1;
    const copy = getPageCopy(rawDishes, isSingle, false);
    const dishes = decorateDishes(rawDishes, {}, isSingle, copy.reactText);

    this.setData({
      proposal,
      dishes,
      selectedMap: {},
      isSingle,
      ...copy
    });
  },

  onToggleWant(event) {
    const id = event.currentTarget.dataset.id;
    const selectedMap = Object.assign({}, this.data.selectedMap);
    selectedMap[id] = !selectedMap[id];
    const reacted = Object.keys(selectedMap).some((key) => selectedMap[key]);
    const copy = getPageCopy(this.data.dishes, this.data.isSingle, reacted);
    this.setData({
      selectedMap,
      dishes: decorateDishes(this.data.dishes, selectedMap, this.data.isSingle, copy.reactText),
      ...copy
    });
    wx.showToast({ title: selectedMap[id] ? "记下了，想吃" : "已取消", icon: "none" });
  },

  onOpenDishDetail(event) {
    const { id } = event.currentTarget.dataset;
    const dish = this.data.dishes.find((item) => item.id === id);
    if (!dish || dish.custom) return;
    this.setData({
      detailDish: dish,
      detailPickLabel: this.data.selectedMap[id] ? "\u5df2\u7ecf\u60f3\u5403" : "\u60f3\u5403\u8fd9\u4e2a",
      dishSheetVisible: true
    });
  },

  onCloseDishSheet() {
    this.setData({ dishSheetVisible: false });
  },

  onPickDetailDish(event) {
    const dish = event.detail && event.detail.dish;
    if (!dish) return;
    const selectedMap = Object.assign({}, this.data.selectedMap);
    selectedMap[dish.id] = true;
    const reacted = Object.keys(selectedMap).some((key) => selectedMap[key]);
    const copy = getPageCopy(this.data.dishes, this.data.isSingle, reacted);
    this.setData({
      selectedMap,
      dishes: decorateDishes(this.data.dishes, selectedMap, this.data.isSingle, copy.reactText),
      dishSheetVisible: false,
      detailPickLabel: "\u5df2\u7ecf\u60f3\u5403",
      ...copy
    });
    wx.showToast({ title: "\u5df2\u8bb0\u4e0b\uff0c\u60f3\u5403", icon: "none" });
  },

  noop() {},

  onSpinAgain() {
    if (this.data.dishes.length >= MAX_PROPOSAL_ITEMS) {
      wx.showModal({
        title: "这桌已经满了",
        content: `最多先放 ${MAX_PROPOSAL_ITEMS} 道菜。想继续换口味，可以重新配一桌。`,
        confirmText: "知道了",
        showCancel: false
      });
      return;
    }
    const city = this.data.proposal && this.data.proposal.city ? this.data.proposal.city : this.data.dishes[0].city;
    const existingNames = this.data.dishes.reduce((map, dish) => {
      map[dish.name] = true;
      return map;
    }, {});
    const pool = uniqueByName(["local", "province", "common"].reduce((list, scope) => (
      list.concat(getProposalDishes(city, scope))
    ), [])).filter((dish) => !existingNames[dish.name]);
    const addWheelItems = decorateAddWheelItems(buildWheelItems(shuffle(pool)), {});
    if (!addWheelItems.length) {
      wx.showToast({ title: "暂时没有可加的菜", icon: "none" });
      return;
    }
    this.setData({
      addWheelVisible: true,
      addWheelItems,
      addWheelPicked: null,
      addWheelButtonText: "\u5f00\u59cb\u8f6c\u52a8",
      addWheelChosenMap: {},
      addWheelSpinning: false,
      addWheelAngle: 0,
      addWheelCounterAngle: 0
    });
  },

  onCloseAddWheel() {
    if (this.data.addWheelSpinning) return;
    this.setData({
      addWheelVisible: false,
      addWheelPicked: null,
      addWheelButtonText: "\u5f00\u59cb\u8f6c\u52a8",
      addWheelChosenMap: {}
    });
  },

  onRefreshAddWheel() {
    if (this.data.addWheelSpinning) return;
    const previousIds = this.data.addWheelItems.map((dish) => dish.id);
    const city = this.data.proposal && this.data.proposal.city ? this.data.proposal.city : this.data.dishes[0].city;
    const existingNames = this.data.dishes.reduce((map, dish) => {
      map[dish.name] = true;
      return map;
    }, {});
    const pool = uniqueByName(["local", "province", "common"].reduce((list, scope) => (
      list.concat(getProposalDishes(city, scope))
    ), [])).filter((dish) => !existingNames[dish.name]);
    const fresh = pool.filter((dish) => !previousIds.includes(dish.id));
    this.setData({
      addWheelItems: decorateAddWheelItems(buildWheelItems(shuffle(fresh.length >= 4 ? fresh : pool)), {}),
      addWheelPicked: null,
      addWheelButtonText: "\u5f00\u59cb\u8f6c\u52a8",
      addWheelChosenMap: {},
      addWheelAngle: 0,
      addWheelCounterAngle: 0
    });
  },

  onStartAddWheel() {
    if (this.data.addWheelSpinning) return;
    const result = weightedPick(this.data.addWheelItems);
    if (!result) {
      wx.showToast({ title: "暂时没有可转的菜", icon: "none" });
      return;
    }
    const nextAngle = getTargetWheelAngle(this.data.addWheelAngle, result.slotIndex || 0);
    this.setData({
      addWheelSpinning: true,
      addWheelAngle: nextAngle,
      addWheelCounterAngle: -nextAngle,
      addWheelPicked: null,
      addWheelButtonText: "\u5f00\u59cb\u8f6c\u52a8",
      addWheelChosenMap: {}
    });
    setTimeout(() => {
      this.setData({
        addWheelSpinning: false,
        addWheelPicked: result,
        addWheelButtonText: "\u518d\u8f6c\u4e00\u6b21",
        addWheelChosenMap: { [result.id]: true },
        addWheelItems: decorateAddWheelItems(this.data.addWheelItems, { [result.id]: true })
      });
    }, 1850);
  },

  onAddPickedDish() {
    const dish = this.data.addWheelPicked;
    if (!dish) {
      wx.showToast({ title: "先转一道菜", icon: "none" });
      return;
    }
    if (this.data.dishes.length >= MAX_PROPOSAL_ITEMS) {
      wx.showModal({
        title: "这桌已经满了",
        content: `最多先放 ${MAX_PROPOSAL_ITEMS} 道菜。想继续换口味，可以重新配一桌。`,
        confirmText: "知道了",
        showCancel: false
      });
      return;
    }
    const rawDishes = this.data.dishes.concat(dish).slice(0, MAX_PROPOSAL_ITEMS);
    const proposal = Object.assign({}, this.data.proposal, {
      selectedIds: rawDishes.map((item) => item.id),
      items: rawDishes
    });
    if (proposal.id) {
      const proposals = wx.getStorageSync("proposals") || {};
      proposals[proposal.id] = proposal;
      wx.setStorageSync("proposals", proposals);
    }
    const reacted = Object.keys(this.data.selectedMap).some((key) => this.data.selectedMap[key]);
    const copy = getPageCopy(rawDishes, rawDishes.length === 1, reacted);
    this.setData({
      proposal,
      dishes: decorateDishes(rawDishes, this.data.selectedMap, rawDishes.length === 1, copy.reactText),
      isSingle: rawDishes.length === 1,
      addWheelVisible: false,
      addWheelPicked: null,
      addWheelButtonText: "\u5f00\u59cb\u8f6c\u52a8",
      addWheelChosenMap: {},
      ...copy
    });
    wx.showToast({ title: "已加进这桌", icon: "none" });
  },

  onCreateAgain() {
    const city = this.data.proposal && this.data.proposal.city
      ? this.data.proposal.city
      : this.data.dishes[0] && this.data.dishes[0].city;
    wx.navigateTo({
      url: city
        ? `/pages/poll-create/poll-create?city=${encodeURIComponent(city)}`
        : "/pages/poll-create/poll-create"
    });
  },

  onShareAppMessage() {
    return {
      title: this.data.shareTitle,
      path: buildSharePath(this.data.dishes)
    };
  }
});
