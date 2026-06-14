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
    type: "信息有误",
    content: "",
    typeOptions: buildTypeOptions("信息有误")
  },

  onLoad(query) {
    this.setData({ dishId: query.dishId || "" });
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

  onSubmit() {
    const feedbacks = wx.getStorageSync("feedbacks") || [];
    feedbacks.unshift({
      dishId: this.data.dishId,
      type: this.data.type,
      content: this.data.content,
      createdAt: Date.now()
    });
    wx.setStorageSync("feedbacks", feedbacks);
    wx.showToast({ title: "已收到", icon: "success" });
    setTimeout(() => wx.navigateBack(), 500);
  }
});
