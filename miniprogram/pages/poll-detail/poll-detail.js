const { getDishById, getProposalDishes } = require("../../services/dish");

const MAX_PROPOSAL_ITEMS = 8;
const wheelSlotAngles = [315, 0, 45, 90, 135, 180, 225, 270];

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

function uniqueByName(list) {
  const seen = {};
  return list.filter((dish) => {
    if (!dish || seen[dish.name]) return false;
    seen[dish.name] = true;
    return true;
  });
}

function getDishIcon(dish) {
  const tags = dish.tags || [];
  if (tags.includes("海鲜") || dish.name.includes("虾") || dish.name.includes("蟹")) return "🦐";
  if (tags.includes("牛肉") || dish.name.includes("牛")) return "🥩";
  if (tags.includes("粥品") || dish.name.includes("粥")) return "🥣";
  if (tags.includes("火锅") || dish.name.includes("锅")) return "🍲";
  if (tags.includes("面食") || tags.includes("汤粉") || tags.includes("米粉") || dish.name.includes("面") || dish.name.includes("粉")) return "🍜";
  if (tags.includes("糕点") || dish.category === "甜品") return "🍮";
  if (dish.category === "饮品") return "🥤";
  if (dish.category === "小吃") return "🥟";
  return "🍚";
}

function buildWheelItems(list) {
  return list.slice(0, 8).map((dish, index) => Object.assign({}, dish, {
    icon: getDishIcon(dish),
    shortName: dish.name.length > 5 ? `${dish.name.slice(0, 5)}...` : dish.name,
    posClass: `mini-pos-${index}`,
    chosenClass: "",
    slotIndex: index
  }));
}

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

function decorateAddWheelItems(items, chosenMap) {
  return (items || []).map((dish) => Object.assign({}, dish, {
    chosenClass: chosenMap && chosenMap[dish.id] ? "picked" : ""
  }));
}

function weightedPick(list) {
  if (!list.length) return null;
  const total = list.reduce((sum, dish) => sum + (dish.weight || 1), 0);
  let cursor = Math.random() * total;
  for (let index = 0; index < list.length; index += 1) {
    cursor -= list[index].weight || 1;
    if (cursor <= 0) return list[index];
  }
  return list[list.length - 1];
}

function getTargetWheelAngle(currentAngle, slotIndex) {
  const target = (wheelSlotAngles[slotIndex] + 360) % 360;
  const current = ((currentAngle % 360) + 360) % 360;
  const delta = (target - current + 360) % 360;
  return currentAngle + 2160 + delta;
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
    return list.slice(0, 2).map((item, index) => ({
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

function getPageCopy(isSingle, reacted) {
  if (isSingle) {
    return {
      pageTitle: "这顿就它？",
      pageDesc: "有人提了这道菜，看看你想不想一起吃。",
      reactText: reacted ? "已经点头" : "我也想吃",
      shareTitle: reacted ? "我也想吃，喊朋友一起看看" : "这道看起来可以，来看看？",
      shareDesc: "发到群里，让大家先有个方向。"
    };
  }
  return {
    pageTitle: "这几道，挑一个开吃",
    pageDesc: "先把想吃的放桌上，发群里少纠结一点。",
    reactText: "想吃",
    shareTitle: "这几道先放桌上",
    shareDesc: "今晚挑一个，别让饭点卡太久。"
  };
}

function buildSharePath(dishes) {
  const normalIds = dishes.filter((dish) => !dish.custom).map((dish) => dish.id);
  const custom = dishes.filter((dish) => dish.custom).slice(0, 2).map((dish) => ({
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
    shareTitle: "把这顿饭局发出去",
    shareDesc: "发到群里，让大家先有个方向。",
    addWheelVisible: false,
    addWheelItems: [],
    addWheelSpinning: false,
    addWheelAngle: 0,
    addWheelPicked: null,
    addWheelButtonText: "\u5f00\u59cb\u8f6c",
    addWheelChosenMap: {},
    dishSheetVisible: false,
    detailDish: null
  },

  onLoad(query) {
    this.loadProposal(query || {});
  },

  loadProposal(query) {
    const proposal = query.id ? getStoredProposal(query.id) : makeProposalFromQuery(query);
    if (!proposal) {
      wx.showToast({ title: "提议内容不见了", icon: "none" });
      return;
    }

    const proposalItems = proposal.items || [];
    const rawDishes = (proposal.selectedIds || proposalItems.map((item) => item.id)).map((dishId) => (
      proposalItems.find((item) => item.id === dishId) || getDishById(dishId)
    )).filter(Boolean).slice(0, MAX_PROPOSAL_ITEMS);
    const isSingle = rawDishes.length === 1;
    const copy = getPageCopy(isSingle, false);
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
    const copy = getPageCopy(this.data.isSingle, reacted);
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
      dishSheetVisible: true
    });
  },

  onCloseDishSheet() {
    this.setData({ dishSheetVisible: false });
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
      addWheelButtonText: "\u5f00\u59cb\u8f6c",
      addWheelChosenMap: {},
      addWheelSpinning: false
    });
  },

  onCloseAddWheel() {
    if (this.data.addWheelSpinning) return;
    this.setData({
      addWheelVisible: false,
      addWheelPicked: null,
      addWheelButtonText: "\u5f00\u59cb\u8f6c",
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
      addWheelButtonText: "\u5f00\u59cb\u8f6c",
      addWheelChosenMap: {}
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
      addWheelPicked: null,
      addWheelButtonText: "\u5f00\u59cb\u8f6c",
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
    }, 1500);
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
    const copy = getPageCopy(rawDishes.length === 1, reacted);
    this.setData({
      proposal,
      dishes: decorateDishes(rawDishes, this.data.selectedMap, rawDishes.length === 1, copy.reactText),
      isSingle: rawDishes.length === 1,
      addWheelVisible: false,
      addWheelPicked: null,
      addWheelButtonText: "\u5f00\u59cb\u8f6c",
      addWheelChosenMap: {},
      ...copy
    });
    wx.showToast({ title: "已加进这桌", icon: "none" });
  },

  onCreateAgain() {
    wx.navigateTo({ url: "/pages/poll-create/poll-create" });
  },

  onShareAppMessage() {
    return {
      title: this.data.isSingle ? "这道看起来可以，来看看？" : "这几道先放桌上，今晚挑一个",
      path: buildSharePath(this.data.dishes)
    };
  }
});
