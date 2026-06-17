const app = getApp();
const { getCity, getDishById, getProposalDishes, searchDishes } = require("../../services/dish");
const storage = require("../../services/storage");
const {
  shuffle,
  uniqueByName,
  buildWheelItems,
  decorateAddWheelItems,
  weightedPick,
  getTargetWheelAngle
} = require("../../utils/proposal-wheel");

const MAX_SELECTED = 12;
const MAX_CUSTOM_NAME_LENGTH = 8;
const CANDIDATE_PAGE_SIZE = 24;

const scopeTabs = [
  { key: "local", label: "本地", active: true },
  { key: "province", label: "省内", active: false },
  { key: "common", label: "常见", active: false }
];

const directCityNames = ["北京", "上海", "天津", "重庆", "香港", "澳门"];

const partySizeOptions = [
  { key: "one", label: "1人", range: "1-2" },
  { key: "two", label: "2人", range: "2-3" },
  { key: "small", label: "3-4人", range: "3-5" },
  { key: "large", label: "5人以上", range: "5-8" }
];

const regularScopeCopy = {
  tabs: scopeTabs,
  titles: {
    local: "先看看本地味",
    province: "省内也有好吃的",
    common: "常见的也能顶上"
  },
  desc: "本地先看，不够再去省内和常见里挑。",
  emptyTitle: "这栏暂时没菜",
  emptyDesc: "可以切到省内或常见看看，也可以自己加一道。"
};

const directScopeCopy = {
  tabs: [
    { key: "local", label: "本地", active: true },
    { key: "province", label: "扩展", active: false },
    { key: "common", label: "常见", active: false }
  ],
  titles: {
    local: "先看看本地味",
    province: "扩展还在补充",
    common: "常见的也能顶上"
  },
  desc: "本地先看，不够再去常见里挑。",
  emptyTitle: "扩展还在补充",
  emptyDesc: "北京、上海、天津、重庆以及港澳没有省内菜池，可以切到常见看看，也可以自己加一道。"
};

function isDirectCity(cityName) {
  return directCityNames.includes(cityName);
}

function getScopeCopy(cityName) {
  return isDirectCity(cityName) ? directScopeCopy : regularScopeCopy;
}

function buildPartySizeOptions(activeKey) {
  return partySizeOptions.map((item) => Object.assign({}, item, {
    className: item.key === activeKey ? "active" : ""
  }));
}

function getRecommendationText(partySizeKey, selectedCount) {
  const option = partySizeOptions.find((item) => item.key === partySizeKey) || partySizeOptions[2];
  return `建议 ${option.range} 道，已选 ${selectedCount || 0} 道`;
}

function createProposalId() {
  return `proposal-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
}

function createCustomId() {
  return `custom-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
}

function safeDecode(value) {
  try {
    return decodeURIComponent(value || "");
  } catch (error) {
    return value || "";
  }
}

function parseQueryIds(query) {
  const ids = [];
  if (query.dishId) ids.push(query.dishId);
  if (query.ids) {
    String(query.ids).split(",").forEach((id) => {
      const decoded = safeDecode(id).trim();
      if (decoded) ids.push(decoded);
    });
  }
  return Array.from(new Set(ids)).slice(0, MAX_SELECTED);
}

function uniqueDishes(list) {
  const byId = {};
  list.filter(Boolean).forEach((dish) => {
    byId[dish.id] = dish;
  });
  return Object.keys(byId).map((id) => byId[id]);
}

function getSourceInfo(dish, cityName) {
  const city = getCity(cityName);
  if (dish.custom) return { sourceKey: "custom", sourceLabel: "自定义" };
  if (dish.sourceBucket === "cityExact" && dish.city === city.name) return { sourceKey: "local", sourceLabel: "本地" };
  if (
    dish.province === city.province &&
    (dish.sourceBucket === "provinceShared" || dish.sourceBucket === "regionalShared")
  ) return { sourceKey: "province", sourceLabel: "省内" };
  if (dish.sourceBucket === "nationalGeneral") return { sourceKey: "common", sourceLabel: "常见" };
  return { sourceKey: "other", sourceLabel: "外地" };
}

function decorateDish(dish, cityName) {
  return Object.assign({}, dish, getSourceInfo(dish, cityName));
}

function rotateList(list, offset) {
  if (!list.length) return [];
  const start = offset % list.length;
  return list.slice(start).concat(list.slice(0, start));
}

function buildScopeTabs(activeScope, cityName) {
  return getScopeCopy(cityName).tabs.map((tab) => Object.assign({}, tab, {
    active: tab.key === activeScope,
    className: tab.key === activeScope ? "active" : ""
  }));
}

function decorateCandidates(candidates, selectedMap) {
  return (candidates || []).map((dish) => Object.assign({}, dish, {
    className: selectedMap && selectedMap[dish.id] ? "active" : "",
    selected: !!(selectedMap && selectedMap[dish.id])
  }));
}

Page({
  data: {
    city: "广州",
    keyword: "",
    activeScope: "local",
    scopeTabs,
    emptyCandidateTitle: regularScopeCopy.emptyTitle,
    emptyCandidateDesc: regularScopeCopy.emptyDesc,
    candidates: [],
    candidatesEmpty: true,
    selectedDishes: [],
    selectedIds: [],
    selectedMap: {},
    selectedCount: 0,
    partySizeKey: "small",
    partySizeOptions: buildPartySizeOptions("small"),
    recommendationText: getRecommendationText("small", 0),
    batchOffset: 0,
    dishSheetVisible: false,
    detailDish: null,
    addWheelVisible: false,
    addWheelItems: [],
    addWheelSpinning: false,
    addWheelAngle: 0,
    addWheelCounterAngle: 0,
    addWheelPicked: null,
    addWheelButtonText: "开始转动",
    addWheelChosenMap: {}
  },

  onLoad(query) {
    const queryCity = safeDecode((query || {}).city || "");
    const city = queryCity || app.globalData.currentCity || "广州";
    const ids = parseQueryIds(query || {});
    const savedIds = storage.getList("favoriteDishIds").concat(storage.getList("historyDishIds"));
    const rawSelectedDishes = ids
      .map((id) => getDishById(id))
      .filter(Boolean);
    const proposalCity = rawSelectedDishes[0] ? rawSelectedDishes[0].city : city;
    const selectedDishes = rawSelectedDishes.map((dish) => decorateDish(dish, proposalCity));
    const savedDishes = Array.from(new Set(savedIds))
      .map((id) => getDishById(id))
      .filter(Boolean)
      .map((dish) => decorateDish(dish, proposalCity));

    this.setData({
      city: proposalCity,
      selectedDishes,
      selectedIds: selectedDishes.map((dish) => dish.id),
      selectedMap: this.toMap(selectedDishes.map((dish) => dish.id)),
      selectedCount: selectedDishes.length,
      recommendationText: getRecommendationText(this.data.partySizeKey, selectedDishes.length)
    });
    this.refreshCandidates("local", 0, savedDishes);
  },

  toMap(ids) {
    return ids.reduce((map, id) => {
      map[id] = true;
      return map;
    }, {});
  },

  syncSelection(selectedDishes, extraData) {
    const selectedIds = selectedDishes.map((dish) => dish.id);
    const selectedMap = this.toMap(selectedIds);
    this.setData(Object.assign({
      selectedDishes,
      selectedIds,
      selectedMap,
      selectedCount: selectedIds.length,
      recommendationText: getRecommendationText(this.data.partySizeKey, selectedIds.length),
      candidates: decorateCandidates(this.data.candidates, selectedMap),
      candidatesEmpty: !this.data.candidates.length
    }, extraData || {}));
  },

  onSelectPartySize(event) {
    const key = event.currentTarget.dataset.key;
    if (!partySizeOptions.some((item) => item.key === key)) return;
    this.setData({
      partySizeKey: key,
      partySizeOptions: buildPartySizeOptions(key),
      recommendationText: getRecommendationText(key, this.data.selectedCount)
    });
  },

  getScopePool(scope) {
    return uniqueDishes(getProposalDishes(this.data.city, scope).map((dish) => decorateDish(dish, this.data.city)));
  },

  filterByScope(list, scope) {
    return uniqueDishes((list || [])
      .map((dish) => decorateDish(dish, this.data.city))
      .filter((dish) => dish.sourceKey === scope));
  },

  refreshCandidates(scope, offset, prependList) {
    const activeScope = scope || this.data.activeScope;
    const batchOffset = offset || 0;
    const scopedPrependList = this.filterByScope(prependList, activeScope);
    const pool = uniqueDishes(scopedPrependList.concat(this.getScopePool(activeScope)));
    const candidates = this.filterByScope(rotateList(pool, batchOffset), activeScope).slice(0, CANDIDATE_PAGE_SIZE);
    this.setData({
      activeScope,
      scopeTabs: buildScopeTabs(activeScope, this.data.city),
      emptyCandidateTitle: activeScope === "province" && isDirectCity(this.data.city) ? directScopeCopy.emptyTitle : regularScopeCopy.emptyTitle,
      emptyCandidateDesc: activeScope === "province" && isDirectCity(this.data.city) ? directScopeCopy.emptyDesc : regularScopeCopy.emptyDesc,
      candidates: decorateCandidates(candidates, this.data.selectedMap),
      candidatesEmpty: !candidates.length,
      batchOffset
    });
  },

  onInput(event) {
    const keyword = event.detail.value;
    if (!keyword.trim()) {
      this.setData({ keyword: "" });
      this.refreshCandidates(this.data.activeScope, 0);
      return;
    }
    const searched = searchDishes(keyword).map((dish) => decorateDish(dish, this.data.city)).sort((a, b) => {
      if (a.city === this.data.city && b.city !== this.data.city) return -1;
      if (a.city !== this.data.city && b.city === this.data.city) return 1;
      return 0;
    });
    const candidates = this.filterByScope(searched, this.data.activeScope).slice(0, 30);
    this.setData({
      keyword,
      candidates: decorateCandidates(candidates, this.data.selectedMap),
      candidatesEmpty: !candidates.length
    });
  },

  onSelectScope(event) {
    const scope = event.currentTarget.dataset.scope || event.target.dataset.scope;
    if (!scope || !getScopeCopy(this.data.city).tabs.some((tab) => tab.key === scope)) return;
    this.setData({
      keyword: "",
      candidates: []
    });
    this.refreshCandidates(scope, 0);
  },

  onAddCandidate() {
    const name = String(this.data.keyword || "").trim().slice(0, MAX_CUSTOM_NAME_LENGTH);
    if (!name) {
      wx.showToast({ title: "先输入菜名", icon: "none" });
      return;
    }
    const exact = this.data.candidates.find((dish) => dish.name === name);
    if (exact) {
      this.addSelectedDish(exact);
      this.setData({ keyword: "" });
      this.refreshCandidates(this.data.activeScope, this.data.batchOffset);
      return;
    }
    const customDish = decorateDish({
      id: createCustomId(),
      city: this.data.city,
      name,
      category: "自定义",
      taste: "想吃",
      custom: true
    }, this.data.city);
    if (this.addSelectedDish(customDish)) {
      this.setData({
        keyword: ""
      });
      this.refreshCandidates(this.data.activeScope, this.data.batchOffset);
    }
  },

  addSelectedDish(dish) {
    if (!dish || this.data.selectedMap[dish.id]) return false;
    if (this.data.selectedDishes.length >= MAX_SELECTED) {
      wx.showToast({ title: "这桌已经够满了，先从里面挑吧", icon: "none" });
      return false;
    }
    const selectedDishes = this.data.selectedDishes.concat(decorateDish(dish, this.data.city));
    this.syncSelection(selectedDishes);
    return true;
  },

  removeSelectedDish(id) {
    const selectedDishes = this.data.selectedDishes.filter((dish) => dish.id !== id);
    this.syncSelection(selectedDishes);
  },

  onToggleDish(event) {
    const { id } = event.currentTarget.dataset;
    if (this.data.selectedMap[id]) {
      this.removeSelectedDish(id);
      return;
    }
    const dish = this.data.candidates.find((item) => item.id === id);
    this.addSelectedDish(dish);
  },

  onOpenDishDetail(event) {
    const { id } = event.currentTarget.dataset;
    const dish = this.data.candidates.find((item) => item.id === id);
    if (!dish || dish.custom) return;
    this.setData({
      detailDish: dish,
      dishSheetVisible: true
    });
  },

  noop() {},

  onCloseDishSheet() {
    this.setData({ dishSheetVisible: false });
  },

  onPickDetailDish(event) {
    const dish = event.detail && event.detail.dish;
    if (!dish) return;
    if (this.data.selectedMap[dish.id]) {
      this.setData({ dishSheetVisible: false });
      wx.showToast({ title: "已在菜单里", icon: "none" });
      return;
    }
    const added = this.addSelectedDish(dish);
    if (added) {
      this.setData({ dishSheetVisible: false });
      wx.showToast({ title: "已加入菜单", icon: "none" });
    }
  },

  onRemoveSelected(event) {
    this.removeSelectedDish(event.currentTarget.dataset.id);
  },

  getWheelPool() {
    const selectedNames = this.data.selectedDishes.reduce((map, dish) => {
      map[dish.name] = true;
      return map;
    }, {});
    return uniqueByName(this.getScopePool(this.data.activeScope))
      .filter((dish) => !selectedNames[dish.name]);
  },

  openAddWheelWithPool(pool) {
    const addWheelItems = decorateAddWheelItems(buildWheelItems(shuffle(pool)), {});
    if (!addWheelItems.length) {
      wx.showToast({ title: "这栏暂时没有可转的菜", icon: "none" });
      return;
    }
    this.setData({
      addWheelVisible: true,
      addWheelItems,
      addWheelPicked: null,
      addWheelButtonText: "开始转动",
      addWheelChosenMap: {},
      addWheelSpinning: false,
      addWheelAngle: 0,
      addWheelCounterAngle: 0
    });
  },

  onOpenAddWheel() {
    this.openAddWheelWithPool(this.getWheelPool());
  },

  onCloseAddWheel() {
    if (this.data.addWheelSpinning) return;
    this.setData({
      addWheelVisible: false,
      addWheelPicked: null,
      addWheelButtonText: "开始转动",
      addWheelChosenMap: {}
    });
  },

  onRefreshAddWheel() {
    if (this.data.addWheelSpinning) return;
    const previousIds = this.data.addWheelItems.map((dish) => dish.id);
    const pool = this.getWheelPool();
    const fresh = pool.filter((dish) => !previousIds.includes(dish.id));
    this.setData({
      addWheelItems: decorateAddWheelItems(buildWheelItems(shuffle(fresh.length >= 4 ? fresh : pool)), {}),
      addWheelPicked: null,
      addWheelButtonText: "开始转动",
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
      addWheelButtonText: "开始转动",
      addWheelChosenMap: {}
    });
    setTimeout(() => {
      this.setData({
        addWheelSpinning: false,
        addWheelPicked: result,
        addWheelButtonText: "再转一次",
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
    if (this.data.selectedMap[dish.id]) {
      wx.showToast({ title: "已在菜单里，换一道试试", icon: "none" });
      return;
    }
    if (this.addSelectedDish(dish)) {
      this.setData({
        addWheelVisible: false,
        addWheelPicked: null,
        addWheelButtonText: "开始转动",
        addWheelChosenMap: {}
      });
      wx.showToast({ title: "已加入菜单", icon: "none" });
    }
  },

  onRefreshCandidates() {
    const nextOffset = this.data.batchOffset + 8;
    this.setData({ keyword: "" });
    this.refreshCandidates(this.data.activeScope, nextOffset);
  },

  onClearSelected() {
    this.syncSelection([]);
  },

  onCreatePoll() {
    if (!this.data.selectedDishes.length) {
      wx.showToast({ title: "先选一道想吃的", icon: "none" });
      return;
    }
    const proposalId = createProposalId();
    const proposal = {
      id: proposalId,
      selectedIds: this.data.selectedDishes.map((dish) => dish.id),
      items: this.data.selectedDishes,
      city: this.data.city,
      createdAt: Date.now()
    };
    const proposals = wx.getStorageSync("proposals") || {};
    proposals[proposalId] = proposal;
    wx.setStorageSync("proposals", proposals);
    wx.navigateTo({ url: `/pages/poll-detail/poll-detail?id=${proposalId}` });
  }
});
