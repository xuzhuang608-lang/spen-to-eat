const { getDishById } = require("../../services/dish");

const types = ["信息有误", "忌口不准", "不好吃这个", "我有建议"];

function buildTypeOptions(activeType) {
  return types.map((type) => ({
    label: type,
    className: type === activeType ? "active" : ""
  }));
}

function formatDate(timestamp) {
  const date = new Date(timestamp);
  const pad = (value) => String(value).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

function buildFeedbackSummary(feedback, dish) {
  const dishLine = dish ? `${dish.city} / ${dish.name}` : feedback.dishId || "未关联菜品";
  const content = feedback.content || "未填写补充说明";
  return [
    "饭点转转反馈",
    `菜品：${dishLine}`,
    `类型：${feedback.type}`,
    `内容：${content}`,
    `时间：${formatDate(feedback.createdAt)}`
  ].join("\n");
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

    const summary = buildFeedbackSummary(feedback, this.data.dish);
    wx.showModal({
      title: "反馈已保存在本机",
      content: "当前版本不上传云端。可以复制反馈内容，发给开发者处理。",
      confirmText: "复制反馈",
      cancelText: "先不复制",
      success: (res) => {
        if (!res.confirm) {
          wx.navigateBack();
          return;
        }
        wx.setClipboardData({
          data: summary,
          success: () => {
            wx.showToast({ title: "已复制", icon: "success" });
            setTimeout(() => wx.navigateBack(), 600);
          },
          fail: () => {
            wx.showToast({ title: "复制失败", icon: "none" });
          }
        });
      }
    });
  }
});
