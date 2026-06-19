const { getDishById } = require("../../../services/dish");

const types = ["信息有误", "忌口不准", "不好吃这个", "我有建议"];

function buildTypeOptions(activeType) {
  return types.map((type) => ({
    label: type,
    className: type === activeType ? "active" : ""
  }));
}

Page({
  data: {
    dishId: "",
    dish: null,
    dishLabel: "未关联具体菜品",
    type: "信息有误",
    content: "",
    typeOptions: buildTypeOptions("信息有误")
  },

  onLoad(query) {
    const dishId = query.dishId || "";
    const dish = dishId ? getDishById(dishId) : null;
    this.setData({
      dishId,
      dish,
      dishLabel: dish ? `${dish.city} · ${dish.name}` : "未关联具体菜品"
    });
  },

  onSelectType(event) {
    const type = event.currentTarget.dataset.type;
    this.setData({
      type,
      typeOptions: buildTypeOptions(type)
    });
  },

  onInput(event) {
    this.setData({ content: event.detail.value });
  },

  onOpenPrivacy() {
    wx.navigateTo({ url: "/package-feature/pages/privacy/privacy" });
  },

  onSubmit() {
    const createdAt = Date.now();
    const feedback = {
      dishId: this.data.dishId,
      type: this.data.type,
      content: String(this.data.content || "").trim(),
      createdAt
    };
    const feedbacks = wx.getStorageSync("feedbacks") || [];
    feedbacks.unshift(feedback);
    wx.setStorageSync("feedbacks", feedbacks.slice(0, 100));
    wx.showToast({ title: "已记录", icon: "success" });
    setTimeout(() => wx.navigateBack(), 600);
  }
});
