const { getDishById } = require("../../services/dish");

function getPageCopy(isSingle, voteSubmitted) {
  if (isSingle) {
    return {
      pageTitle: "就吃这个？",
      pageDesc: "有人提了这个，看看大家想不想一起吃。",
      submitText: "我也想吃",
      shareTitle: voteSubmitted ? "你也想吃，喊朋友一起看看" : "把这个提议发群里",
      shareDesc: voteSubmitted ? "看看最后有多少人一起点头。" : "看看大家想不想一起吃。"
    };
  }
  return {
    pageTitle: "这顿吃什么",
    pageDesc: "",
    submitText: "提交投票",
    shareTitle: voteSubmitted ? "投好了，喊朋友也来选" : "把这顿饭局发出去",
    shareDesc: voteSubmitted ? "看看大家最后会把票投给谁。" : "发到群里，让大家一起定。"
  };
}

Page({
  data: {
    pollId: "",
    poll: null,
    dishes: [],
    selectedMap: {},
    expired: false,
    voterName: "",
    voteSubmitted: false,
    isSingle: false,
    pageTitle: "这顿吃什么",
    pageDesc: "",
    submitText: "提交投票",
    shareTitle: "把这顿饭局发出去",
    shareDesc: "发到群里，让大家一起定。"
  },

  onLoad(query) {
    this.setData({ pollId: query.id });
    this.loadPoll(query.id);
  },

  loadPoll(id) {
    const polls = wx.getStorageSync("polls") || {};
    const poll = polls[id];
    if (!poll) {
      wx.showToast({ title: "投票不存在", icon: "none" });
      return;
    }
    const pollItems = poll.items || [];
    const dishes = poll.selectedIds.map((dishId) => {
      const dish = pollItems.find((item) => item.id === dishId) || getDishById(dishId);
      const count = poll.votes[dishId] || 0;
      const voters = poll.voters && poll.voters[dishId] ? poll.voters[dishId] : [];
      return Object.assign({}, dish, {
        count,
        voters,
        voterText: voters.join("、")
      });
    }).filter((dish) => dish.id);
    const isSingle = dishes.length === 1;
    const displayDishes = dishes.map((dish) => Object.assign({}, dish, {
      countText: isSingle ? `${dish.count} 人想吃` : `${dish.count} 票`
    }));
    this.setData({
      poll,
      dishes: displayDishes,
      expired: Date.now() > poll.expiresAt,
      isSingle,
      ...getPageCopy(isSingle, this.data.voteSubmitted),
      pageDesc: isSingle ? "有人提了这个，看看大家想不想一起吃。" : `每人最多投 ${poll.voteLimit} 个，投票 24 小时后结束。`
    });
  },

  onToggleVote(event) {
    if (this.data.expired) return;
    const id = event.currentTarget.dataset.id;
    const selectedMap = Object.assign({}, this.data.selectedMap);
    const selectedCount = Object.keys(selectedMap).filter((key) => selectedMap[key]).length;
    if (selectedMap[id]) {
      selectedMap[id] = false;
    } else if (selectedCount < this.data.poll.voteLimit) {
      selectedMap[id] = true;
    } else {
      wx.showToast({ title: `最多投 ${this.data.poll.voteLimit} 个`, icon: "none" });
      return;
    }
    this.setData({ selectedMap });
  },

  onOpenDishDetail(event) {
    const { id } = event.currentTarget.dataset;
    const dish = this.data.dishes.find((item) => item.id === id);
    if (!dish || dish.custom) return;
    wx.navigateTo({ url: `/pages/result/result?id=${id}` });
  },

  onNameInput(event) {
    this.setData({ voterName: event.detail.value });
  },

  onSubmitVote() {
    if (this.data.expired) return;
    let selectedIds = Object.keys(this.data.selectedMap).filter((id) => this.data.selectedMap[id]);
    if (!selectedIds.length && this.data.isSingle && this.data.dishes[0]) {
      selectedIds = [this.data.dishes[0].id];
    }
    if (!selectedIds.length) {
      wx.showToast({ title: "先选一个", icon: "none" });
      return;
    }
    const voterName = String(this.data.voterName || "").trim();
    if (!this.data.poll.anonymous && !voterName) {
      wx.showToast({ title: "先填个称呼", icon: "none" });
      return;
    }
    const polls = wx.getStorageSync("polls") || {};
    const poll = polls[this.data.pollId];
    poll.voters = poll.voters || {};
    selectedIds.forEach((id) => {
      poll.votes[id] = (poll.votes[id] || 0) + 1;
      if (!poll.anonymous) {
        const voters = poll.voters[id] || [];
        if (!voters.includes(voterName)) voters.push(voterName);
        poll.voters[id] = voters;
      }
    });
    polls[this.data.pollId] = poll;
    wx.setStorageSync("polls", polls);
    this.setData({
      selectedMap: {},
      voteSubmitted: true,
      ...getPageCopy(this.data.isSingle, true)
    });
    this.loadPoll(this.data.pollId);
    wx.showToast({ title: "投票成功", icon: "success" });
  },

  onShareAppMessage() {
    return {
      title: this.data.isSingle ? "这个想吃吗？来点个头" : "饭点投票：今天吃哪个？",
      path: `/pages/poll-detail/poll-detail?id=${this.data.pollId}`
    };
  }
});
