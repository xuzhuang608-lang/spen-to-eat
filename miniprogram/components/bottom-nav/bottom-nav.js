Component({
  properties: {
    current: {
      type: String,
      value: "home"
    }
  },

  methods: {
    onTapNav(event) {
      const page = event.currentTarget.dataset.page;
      if (!page || page === this.properties.current) return;
      const url = page === "home" ? "/pages/home/home" : "/pages/inspiration/inspiration";
      wx.redirectTo({ url });
    }
  }
});

