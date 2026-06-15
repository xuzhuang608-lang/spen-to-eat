const app = getApp();
const { getDishById, getProposalDishes, searchDishes } = require("../../services/dish");
const storage = require("../../services/storage");

const MAX_SELECTED = 8;
const MAX_CUSTOM_NAME_LENGTH = 8;
const CANDIDATE_PAGE_SIZE = 24;

const scopeTabs = [
  { key: "local", label: "本地", active: true },
  { key: "province", label: "省内", active: false },
  { key: "common", label: "常见", active: false }
];

const directCityNames = ["北京", "上海", "天津", "重庆", "香港", "澳门"];

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

function getSourceInfo(dish) {
  if (dish.custom) return { sourceKey: "custom", sourceLabel: "自定义" };
  if (dish.sourceBucket === "provinceShared" || dish.sourceBucket === "regionalShared") return { sourceKey: "province", sourceLabel: "省内" };
  if (dish.sourceBucket === "nationalGeneral") return { sourceKey: "common", sourceLabel: "常见" };
  return { sourceKey: "local", sourceLabel: "本地" };
}

function decorateDish(dish) {
  return Object.assign({}, dish, getSourceInfo(dish));
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
    candidateTitle: regularScopeCopy.titles.local,
    candidateDesc: regularScopeCopy.desc,
    emptyCandidateTitle: regularScopeCopy.emptyTitle,
    emptyCandidateDesc: regularScopeCopy.emptyDesc,
    candidates: [],
    candidatesEmpty: true,
    selectedDishes: [],
    selectedIds: [],
    selectedMap: {},
    selectedCount: 0,
    autoAddedIds: [],
    maxSelected: MAX_SELECTED,
    fillButtonText: "来点本地味",
    batchOffset: 0
  },

  onLoad(query) {
    const city = app.globalData.currentCity || "广州";
    const ids = parseQueryIds(query || {});
    const savedIds = storage.getList("favoriteDishIds").concat(storage.getList("historyDishIds"));
    const selectedDishes = ids
      .map((id) => getDishById(id))
      .filter(Boolean)
      .map(decorateDish);
    const proposalCity = selectedDishes[0] ? selectedDishes[0].city : city;
    const savedDishes = Array.from(new Set(savedIds))
      .map((id) => getDishById(id))
      .filter(Boolean)
      .map(decorateDish);

    this.setData({
      city: proposalCity,
      selectedDishes,
      selectedIds: selectedDishes.map((dish) => dish.id),
      selectedMap: this.toMap(selectedDishes.map((dish) => dish.id)),
      selectedCount: selectedDishes.length
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
      candidates: decorateCandidates(this.data.candidates, selectedMap),
      candidatesEmpty: !this.data.candidates.length
    }, extraData || {}));
  },

  getScopePool(scope) {
    return uniqueDishes(getProposalDishes(this.data.city, scope).map(decorateDish));
  },

  filterByScope(list, scope) {
    return uniqueDishes((list || [])
      .map(decorateDish)
      .filter((dish) => dish.sourceKey === scope));
  },

  refreshCandidates(scope, offset, prependList) {
    const activeScope = scope || this.data.activeScope;
    const batchOffset = offset || 0;
    const scopeCopy = getScopeCopy(this.data.city);
    const scopedPrependList = this.filterByScope(prependList, activeScope);
    const pool = uniqueDishes(scopedPrependList.concat(this.getScopePool(activeScope)));
    const candidates = this.filterByScope(rotateList(pool, batchOffset), activeScope).slice(0, CANDIDATE_PAGE_SIZE);
    this.setData({
      activeScope,
      scopeTabs: buildScopeTabs(activeScope, this.data.city),
      candidateTitle: scopeCopy.titles[activeScope],
      candidateDesc: scopeCopy.desc,
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
    const searched = searchDishes(keyword).map(decorateDish).sort((a, b) => {
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
    if (!scope || !regularScopeCopy.titles[scope]) return;
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
    });
    if (this.addSelectedDish(customDish)) {
      this.setData({
        keyword: ""
      });
      this.refreshCandidates(this.data.activeScope, this.data.batchOffset);
    }
  },

  addSelectedDish(dish, autoAdded) {
    if (!dish || this.data.selectedMap[dish.id]) return false;
    if (this.data.selectedDishes.length >= MAX_SELECTED) {
      wx.showToast({ title: `最多放 ${MAX_SELECTED} 道`, icon: "none" });
      return false;
    }
    const selectedDishes = this.data.selectedDishes.concat(decorateDish(dish));
    const autoAddedIds = autoAdded ? this.data.autoAddedIds.concat(dish.id) : this.data.autoAddedIds;
    this.syncSelection(selectedDishes, {
      autoAddedIds,
      fillButtonText: autoAddedIds.length ? "撤回本地味" : "来点本地味"
    });
    return true;
  },

  removeSelectedDish(id) {
    const selectedDishes = this.data.selectedDishes.filter((dish) => dish.id !== id);
    const autoAddedIds = this.data.autoAddedIds.filter((item) => item !== id);
    this.syncSelection(selectedDishes, {
      autoAddedIds,
      fillButtonText: autoAddedIds.length ? "撤回本地味" : "来点本地味"
    });
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

  onRemoveSelected(event) {
    this.removeSelectedDish(event.currentTarget.dataset.id);
  },

  onFillLocal() {
    if (this.data.autoAddedIds.length) {
      const autoMap = this.toMap(this.data.autoAddedIds);
      const selectedDishes = this.data.selectedDishes.filter((dish) => !autoMap[dish.id]);
      this.syncSelection(selectedDishes, {
        autoAddedIds: [],
        fillButtonText: "来点本地味"
      });
      return;
    }

    const selectedNames = this.data.selectedDishes.reduce((map, dish) => {
      map[dish.name] = true;
      return map;
    }, {});
    const pool = ["local", "province", "common"].reduce((list, scope) => (
      list.concat(this.getScopePool(scope))
    ), []);
    const selectedDishes = this.data.selectedDishes.slice();
    const autoAddedIds = [];

    pool.forEach((dish) => {
      if (selectedDishes.length >= MAX_SELECTED) return;
      if (selectedNames[dish.name]) return;
      selectedNames[dish.name] = true;
      selectedDishes.push(dish);
      autoAddedIds.push(dish.id);
    });

    this.syncSelection(selectedDishes, {
      autoAddedIds,
      fillButtonText: autoAddedIds.length ? "撤回本地味" : "来点本地味"
    });
  },

  onRefreshCandidates() {
    const nextOffset = this.data.batchOffset + 8;
    this.setData({ keyword: "" });
    this.refreshCandidates(this.data.activeScope, nextOffset);
  },

  onClearSelected() {
    this.syncSelection([], {
      autoAddedIds: [],
      fillButtonText: "来点本地味"
    });
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
