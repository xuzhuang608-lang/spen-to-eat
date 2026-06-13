const app = getApp();
const { getDishById, getDishesByCity, searchDishes } = require("../../services/dish");
const storage = require("../../services/storage");

function createPollId() {
  return `poll-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
}

function createCustomId() {
  return `custom-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
}

function uniqueDishes(list) {
  const byId = {};
  list.filter(Boolean).forEach((dish) => {
    byId[dish.id] = dish;
  });
  return Object.keys(byId).map((id) => byId[id]);
}

Page({
  data: {
    city: "广州",
    keyword: "",
    candidates: [],
    selectedIds: [],
    selectedMap: {},
    voteLimit: 1,
    anonymous: true
  },

  onLoad(query) {
    const city = app.globalData.currentCity || "广州";
    const ids = [];
    if (query.dishId) ids.push(query.dishId);
    const savedIds = storage.getList("favoriteDishIds").concat(storage.getList("historyDishIds"));
    const cityDishes = getDishesByCity(city);
    const savedDishes = Array.from(new Set(ids.concat(savedIds)))
      .map((id) => getDishById(id))
      .filter(Boolean);
    const candidates = uniqueDishes(cityDishes.concat(savedDishes)).slice(0, 20);
    const selectedIds = ids;
    this.setData({
      city,
      candidates,
      selectedIds,
      selectedMap: this.toMap(selectedIds)
    });
  },

  toMap(ids) {
    return ids.reduce((map, id) => {
      map[id] = true;
      return map;
    }, {});
  },

  onInput(event) {
    const keyword = event.detail.value;
    const searched = searchDishes(keyword).sort((a, b) => {
      if (a.city === this.data.city && b.city !== this.data.city) return -1;
      if (a.city !== this.data.city && b.city === this.data.city) return 1;
      return 0;
    });
    this.setData({
      keyword,
      candidates: uniqueDishes(this.data.candidates.concat(searched)).slice(0, 30)
    });
  },

  onAddCandidate() {
    const name = String(this.data.keyword || "").trim();
    if (!name) {
      wx.showToast({ title: "先输入菜名", icon: "none" });
      return;
    }
    const exact = this.data.candidates.find((dish) => dish.name === name);
    if (exact) {
      this.addSelected(exact.id);
      this.setData({ keyword: "" });
      return;
    }
    const customDish = {
      id: createCustomId(),
      city: this.data.city,
      name,
      category: "自定义",
      taste: "饭局加菜",
      custom: true
    };
    const candidates = [customDish].concat(this.data.candidates);
    const selectedIds = this.data.selectedIds.concat(customDish.id);
    this.setData({
      keyword: "",
      candidates,
      selectedIds,
      selectedMap: this.toMap(selectedIds)
    });
  },

  addSelected(id) {
    if (this.data.selectedIds.includes(id)) return;
    const selectedIds = this.data.selectedIds.concat(id);
    this.setData({
      selectedIds,
      selectedMap: this.toMap(selectedIds)
    });
  },

  onToggleDish(event) {
    const { id } = event.currentTarget.dataset;
    const selectedIds = this.data.selectedIds.slice();
    const index = selectedIds.indexOf(id);
    if (index >= 0) {
      selectedIds.splice(index, 1);
    } else {
      selectedIds.push(id);
    }
    this.setData({
      selectedIds,
      selectedMap: this.toMap(selectedIds)
    });
  },

  onLimitChange(event) {
    this.setData({ voteLimit: Number(event.detail.value) + 1 });
  },

  onAnonymousChange(event) {
    this.setData({ anonymous: event.detail.value });
  },

  onSelectDisplayMode(event) {
    const mode = event.currentTarget.dataset.mode;
    this.setData({ anonymous: mode === "anonymous" });
  },

  onFillLocal() {
    const selected = this.data.selectedIds.slice();
    const candidates = this.data.candidates.slice();
    const cityDishes = getDishesByCity(this.data.city);
    cityDishes.forEach((dish) => {
      if (selected.length >= 5) return;
      if (!selected.includes(dish.id)) selected.push(dish.id);
      if (!candidates.find((item) => item.id === dish.id)) candidates.push(dish);
    });
    this.setData({
      candidates: uniqueDishes(candidates),
      selectedIds: selected,
      selectedMap: this.toMap(selected)
    });
  },

  onCreatePoll() {
    if (!this.data.selectedIds.length) {
      wx.showToast({ title: "先选几个候选", icon: "none" });
      return;
    }
    const pollId = createPollId();
    const poll = {
      id: pollId,
      selectedIds: this.data.selectedIds,
      items: this.data.selectedIds.map((id) => this.data.candidates.find((dish) => dish.id === id)).filter(Boolean),
      city: this.data.city,
      voteLimit: this.data.voteLimit,
      anonymous: this.data.anonymous,
      createdAt: Date.now(),
      expiresAt: Date.now() + 24 * 60 * 60 * 1000,
      votes: {},
      voters: {}
    };
    const polls = wx.getStorageSync("polls") || {};
    polls[pollId] = poll;
    wx.setStorageSync("polls", polls);
    wx.navigateTo({ url: `/pages/poll-detail/poll-detail?id=${pollId}` });
  }
});
