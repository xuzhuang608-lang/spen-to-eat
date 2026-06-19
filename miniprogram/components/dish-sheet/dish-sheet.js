const storage = require("../../services/storage");

function addTag(list, used, label) {
  if (!label || used[label] || list.length >= 6) return;
  used[label] = true;
  list.push(label);
}

function isGenericNightSnack(dish) {
  const name = dish.name || "";
  const meals = dish.mealTime || [];
  if (!meals.includes("宵夜") && !meals.includes("夜宵")) return false;
  if (/^(烤|炸|凉拌|卤|香辣|爆炒|蛋炒|扬州炒|腊肠炒)/.test(name)) return true;
  return /烤茄子|凉拌青瓜|凉拌黄瓜|烤韭菜|烤玉米|烤金针菇|烤面筋|炸豆腐|炸薯条|关东煮|麻辣拌/.test(name);
}

function sourceTag(dish) {
  if (dish.sourceBucket === "mealPool" || isGenericNightSnack(dish)) return "餐段灵感";
  if (dish.sourceBucket === "cityExact") return "本地美食";
  if (dish.sourceBucket === "regionalShared" || dish.sourceBucket === "provinceShared") return "省内美食";
  if (dish.sourceBucket === "nationalGeneral") return "常见美食";
  return "";
}

function buildTagLine(dish) {
  const tags = dish.tags || [];
  const meals = dish.mealTime || [];
  const scenes = dish.scene || [];
  const tagLine = [];
  const used = {};

  addTag(tagLine, used, sourceTag(dish));
  if (meals.includes("早餐")) addTag(tagLine, used, "适合早餐");
  if (meals.includes("晚餐")) addTag(tagLine, used, "适合晚餐");
  if (meals.includes("夜宵")) addTag(tagLine, used, "夜宵可选");
  if (tags.includes("下饭")) addTag(tagLine, used, "下饭");
  if (tags.includes("海鲜")) addTag(tagLine, used, "海味");
  if (tags.includes("肉类")) addTag(tagLine, used, "肉香");
  if (tags.includes("火锅")) addTag(tagLine, used, "热乎");
  if (tags.includes("粉面") || tags.includes("面食") || tags.includes("汤粉") || tags.includes("米粉")) addTag(tagLine, used, "粉面");
  if (tags.includes("糕点")) addTag(tagLine, used, "点心");
  if (scenes.includes("一个人")) addTag(tagLine, used, "一人也行");
  if (scenes.includes("两个人")) addTag(tagLine, used, "两人友好");
  if (scenes.includes("朋友聚餐")) addTag(tagLine, used, "聚餐可点");
  if (dish.taste === "鲜香") addTag(tagLine, used, "鲜香口");
  if (dish.taste === "清淡") addTag(tagLine, used, "清淡口");
  if (dish.taste === "重口") addTag(tagLine, used, "重口味");
  if (dish.taste === "甜口") addTag(tagLine, used, "甜口");

  addTag(tagLine, used, dish.category);
  addTag(tagLine, used, dish.taste);
  tags.forEach((tag) => addTag(tagLine, used, tag));
  return tagLine.slice(0, 6);
}

function buildViewDish(dish) {
  if (!dish) return null;
  return Object.assign({}, dish, {
    mealLine: (dish.mealTime || []).join(" / "),
    tagLine: buildTagLine(dish)
  });
}

Component({
  properties: {
    visible: {
      type: Boolean,
      value: false,
      observer() {
        this.syncDish(this.properties.dish);
      }
    },
    dish: {
      type: Object,
      value: null,
      observer(value) {
        this.syncDish(value);
      }
    },
    pickLabel: {
      type: String,
      value: "\u5c31\u5403\u8fd9\u4e2a"
    },
    pickMode: {
      type: String,
      value: "result"
    },
    showDislike: {
      type: Boolean,
      value: false
    },
    showFavorite: {
      type: Boolean,
      value: true
    }
  },

  data: {
    showSheet: false,
    viewDish: null,
    sheetTags: [],
    favorited: false,
    favoriteLabel: "\u6536\u85cf\u8d77\u6765"
  },

  lifetimes: {
    attached() {
      this.syncDish(this.properties.dish);
    }
  },

  methods: {
    syncDish(dish) {
      const viewDish = buildViewDish(dish);
      this.setData({
        showSheet: !!(this.properties.visible && viewDish),
        viewDish,
        sheetTags: viewDish ? viewDish.tagLine : [],
        favorited: viewDish ? storage.hasItem("favoriteDishIds", viewDish.id) : false,
        favoriteLabel:
          viewDish && storage.hasItem("favoriteDishIds", viewDish.id)
            ? "\u5df2\u7ecf\u6536\u597d"
            : "\u6536\u85cf\u8d77\u6765"
      });
    },

    onClose() {
      this.triggerEvent("close");
    },

    noop() {},

    onPick() {
      const dish = this.data.viewDish;
      if (!dish) return;
      if (this.properties.pickMode === "emit") {
        this.triggerEvent("pick", { dish });
        return;
      }
      this.copyDishName(dish);
    },

    onFavorite() {
      const dish = this.data.viewDish;
      if (!dish) return;
      const key = "favoriteDishIds";
      if (this.data.favorited) {
        storage.removeItem(key, dish.id);
      } else {
        storage.addUnique(key, dish.id);
      }
      const favorited = !this.data.favorited;
      this.setData({
        favorited,
        favoriteLabel: favorited ? "\u5df2\u7ecf\u6536\u597d" : "\u6536\u85cf\u8d77\u6765"
      });
      wx.showToast({
        title: favorited ? "\u6536\u85cf\u8d77\u6765\u4e86" : "\u5df2\u7ecf\u53d6\u6d88",
        icon: "none"
      });
    },

    copyDishName(dish) {
      wx.setClipboardData({
        data: dish.name,
        success: () => {
          wx.showToast({ title: "菜名已复制，去地图或外卖搜搜", icon: "none" });
        },
        fail: (error) => {
          console.error("复制菜名失败", error);
          wx.showToast({ title: "\u590d\u5236\u5931\u8d25", icon: "none" });
        }
      });
    },

    onDislike() {
      const dish = this.data.viewDish;
      if (!dish) return;
      this.triggerEvent("dislike", { dish });
    }
  }
});
