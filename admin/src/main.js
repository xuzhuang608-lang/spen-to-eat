import "./styles.css";

const STORAGE_KEY = "fandian-admin-dishes";
const SESSION_KEY = "fandian-admin-session";

const seedDishes = [
  {
    city: "广州",
    name: "艇仔粥",
    category: "小吃",
    taste: "鲜香",
    mealTime: "早餐|夜宵",
    scene: "一个人|两个人",
    avoidTags: "海鲜",
    localIndex: "5",
    status: "已上架"
  },
  {
    city: "湛江",
    name: "湛江白切鸡",
    category: "正餐",
    taste: "鲜香",
    mealTime: "午餐|晚餐",
    scene: "两个人|朋友聚餐",
    avoidTags: "",
    localIndex: "5",
    status: "已上架"
  }
];

const app = document.querySelector("#app");

function getDishes() {
  const saved = localStorage.getItem(STORAGE_KEY);
  return saved ? JSON.parse(saved) : seedDishes;
}

function saveDishes(dishes) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(dishes));
}

function parseCsv(text) {
  const lines = text.trim().split(/\r?\n/);
  const headers = lines.shift().split(",").map((item) => item.trim());
  return lines.map((line) => {
    const values = line.split(",").map((item) => item.trim());
    return headers.reduce((row, header, index) => {
      row[header] = values[index] || "";
      return row;
    }, {});
  });
}

function renderLogin() {
  app.innerHTML = `
    <main class="login-page">
      <section class="login-card">
        <h1>饭点转转管理后台</h1>
        <p>首版单管理员登录。默认账号：admin，密码：admin123。</p>
        <label>账号<input id="username" value="admin" /></label>
        <label>密码<input id="password" type="password" value="admin123" /></label>
        <button id="login">登录</button>
      </section>
    </main>
  `;
  document.querySelector("#login").addEventListener("click", () => {
    const username = document.querySelector("#username").value;
    const password = document.querySelector("#password").value;
    if (username === "admin" && password === "admin123") {
      sessionStorage.setItem(SESSION_KEY, "1");
      renderDashboard();
    } else {
      alert("账号或密码错误");
    }
  });
}

function renderDashboard() {
  const dishes = getDishes();
  const cityCount = new Set(dishes.map((dish) => dish.city)).size;
  const onlineCount = dishes.filter((dish) => dish.status !== "已下架").length;

  app.innerHTML = `
    <main class="layout">
      <aside class="sidebar">
        <h1>饭点转转</h1>
        <button class="nav active">美食管理</button>
        <button class="nav">城市管理</button>
        <button class="nav">标签管理</button>
        <button class="nav">数据看板</button>
      </aside>
      <section class="content">
        <header class="topbar">
          <div>
            <h2>美食管理</h2>
            <p>批量维护城市特色美食，后续接入云数据库。</p>
          </div>
          <button id="logout" class="secondary">退出</button>
        </header>
        <section class="stats">
          <div><strong>${dishes.length}</strong><span>美食条目</span></div>
          <div><strong>${cityCount}</strong><span>城市数量</span></div>
          <div><strong>${onlineCount}</strong><span>已上架</span></div>
          <div><strong>0</strong><span>待处理反馈</span></div>
        </section>
        <section class="toolbar">
          <input id="search" placeholder="搜索城市或美食" />
          <label class="upload">
            导入 CSV
            <input id="csv" type="file" accept=".csv" />
          </label>
          <button id="export">导出 JSON</button>
        </section>
        <section id="table"></section>
      </section>
    </main>
  `;

  document.querySelector("#logout").addEventListener("click", () => {
    sessionStorage.removeItem(SESSION_KEY);
    renderLogin();
  });
  document.querySelector("#search").addEventListener("input", (event) => {
    renderTable(dishes, event.target.value);
  });
  document.querySelector("#csv").addEventListener("change", async (event) => {
    const file = event.target.files[0];
    if (!file) return;
    const text = await file.text();
    const imported = parseCsv(text);
    saveDishes(imported);
    renderDashboard();
  });
  document.querySelector("#export").addEventListener("click", () => {
    const blob = new Blob([JSON.stringify(getDishes(), null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "dishes.json";
    link.click();
    URL.revokeObjectURL(url);
  });
  renderTable(dishes, "");
}

function renderTable(dishes, keyword) {
  const text = keyword.trim();
  const rows = dishes.filter((dish) => {
    if (!text) return true;
    return `${dish.city}${dish.name}${dish.category}${dish.taste}`.includes(text);
  });
  document.querySelector("#table").innerHTML = `
    <table>
      <thead>
        <tr>
          <th>城市</th>
          <th>美食</th>
          <th>类型</th>
          <th>口味</th>
          <th>时间</th>
          <th>场景</th>
          <th>避雷</th>
          <th>指数</th>
          <th>状态</th>
        </tr>
      </thead>
      <tbody>
        ${rows.map((dish) => `
          <tr>
            <td>${dish.city}</td>
            <td>${dish.name}</td>
            <td>${dish.category}</td>
            <td>${dish.taste}</td>
            <td>${dish.mealTime}</td>
            <td>${dish.scene}</td>
            <td>${dish.avoidTags || "-"}</td>
            <td>${dish.localIndex}</td>
            <td><span class="status">${dish.status || "已上架"}</span></td>
          </tr>
        `).join("")}
      </tbody>
    </table>
  `;
}

if (sessionStorage.getItem(SESSION_KEY)) {
  renderDashboard();
} else {
  renderLogin();
}

