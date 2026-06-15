import "./styles.css";

const STORAGE_KEY = "fandian-admin-workbench-dishes-v2";

const requiredColumns = [
  "province",
  "city",
  "name",
  "category",
  "taste",
  "mealTime",
  "scene",
  "tags",
  "avoidTags",
  "localIndex",
  "iconType",
  "weight",
  "sourceBucket"
];

const optionalAuditColumns = new Set(["tags", "avoidTags"]);
const requiredAuditColumns = requiredColumns.filter((column) => !optionalAuditColumns.has(column));

const riskTerms = [
  "狗肉",
  "蛇",
  "蝎",
  "野味",
  "生牛肉",
  "河豚",
  "活鱼",
  "田鸡",
  "牛蛙",
  "甲鱼",
  "鳖",
  "马肉",
  "驴肉",
  "兔头",
  "狗浇尿"
];

const starterRows = [
  {
    province: "广东",
    city: "广州",
    name: "艇仔粥",
    category: "小吃",
    taste: "鲜香",
    mealTime: "早餐/午餐/宵夜",
    scene: "一个人/两个人",
    tags: "汤粥/小吃",
    avoidTags: "海鲜",
    localIndex: "5",
    iconType: "bowl",
    weight: "9",
    sourceBucket: "cityExact"
  },
  {
    province: "广东",
    city: "湛江",
    name: "湛江白切鸡",
    category: "正餐",
    taste: "鲜香",
    mealTime: "午餐/晚餐",
    scene: "两个人/朋友聚餐",
    tags: "名菜/肉类",
    avoidTags: "肉类",
    localIndex: "5",
    iconType: "flame",
    weight: "9",
    sourceBucket: "cityExact"
  }
];

let projectRows = starterRows;

const state = {
  rows: [],
  keyword: "",
  mealFilter: "全部",
  sourceFilter: "全部"
};

const app = document.querySelector("#app");

async function loadProjectRows() {
  try {
    const response = await fetch("/dishes-snapshot.json", { cache: "no-store" });
    if (!response.ok) return starterRows;
    const data = await response.json();
    const rows = Array.isArray(data) ? data : data.rows || [];
    return rows.length ? rows.map(normalizeRow) : starterRows;
  } catch (error) {
    return starterRows;
  }
}

function loadRows() {
  const saved = localStorage.getItem(STORAGE_KEY);
  if (!saved) return projectRows;
  try {
    const rows = JSON.parse(saved);
    return Array.isArray(rows) && rows.length ? rows : projectRows;
  } catch (error) {
    return projectRows;
  }
}

function saveRows(rows) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(rows));
}

function splitList(value) {
  return String(value || "")
    .split(/[\/,，|]/)
    .map((item) => item.trim())
    .filter(Boolean);
}

function normalizeRow(row) {
  return requiredColumns.reduce((next, key) => {
    next[key] = String(row[key] || "").trim();
    return next;
  }, {});
}

function parseCsvLine(line) {
  const cells = [];
  let cell = "";
  let quoted = false;

  for (let index = 0; index < line.length; index += 1) {
    const char = line[index];
    const next = line[index + 1];
    if (char === "\"" && quoted && next === "\"") {
      cell += "\"";
      index += 1;
    } else if (char === "\"") {
      quoted = !quoted;
    } else if (char === "," && !quoted) {
      cells.push(cell.trim());
      cell = "";
    } else {
      cell += char;
    }
  }
  cells.push(cell.trim());
  return cells;
}

function parseCsv(text) {
  const lines = String(text || "")
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);
  if (!lines.length) return [];

  const headers = parseCsvLine(lines.shift()).map((item) => item.trim());
  return lines.map((line) => {
    const values = parseCsvLine(line);
    const raw = headers.reduce((row, header, index) => {
      row[header] = values[index] || "";
      return row;
    }, {});
    return normalizeRow(raw);
  });
}

function parseJson(text) {
  const data = JSON.parse(text);
  const rows = Array.isArray(data) ? data : data.dishes || data.rows || [];
  return rows.map(normalizeRow);
}

function getRowKey(row) {
  return `${row.province}|${row.city}|${row.name}`;
}

function getAudit(rows) {
  const seen = new Map();
  const duplicates = [];
  const risks = [];
  const missingRequired = [];
  const weakRows = [];

  rows.forEach((row, index) => {
    const key = getRowKey(row);
    if (seen.has(key)) {
      duplicates.push({ index, row, firstIndex: seen.get(key) });
    } else {
      seen.set(key, index);
    }

    const riskHit = riskTerms.find((term) => row.name.includes(term) || row.tags.includes(term));
    if (riskHit) risks.push({ index, row, riskHit });

    const missing = requiredAuditColumns.filter((column) => !row[column]);
    if (missing.length) missingRequired.push({ index, row, missing });

    const localIndex = Number(row.localIndex);
    const weight = Number(row.weight);
    if (!Number.isFinite(localIndex) || !Number.isFinite(weight) || localIndex < 2 || weight < 3) {
      weakRows.push({ index, row });
    }
  });

  return { duplicates, risks, missingRequired, weakRows };
}

function getStats(rows) {
  const provinces = new Set(rows.map((row) => row.province).filter(Boolean));
  const cities = new Set(rows.map((row) => row.city).filter(Boolean));
  const byCity = {};
  const byMeal = {};
  const bySource = {};

  rows.forEach((row) => {
    if (row.city) byCity[row.city] = (byCity[row.city] || 0) + 1;
    splitList(row.mealTime).forEach((meal) => {
      byMeal[meal] = (byMeal[meal] || 0) + 1;
    });
    bySource[row.sourceBucket || "未标记"] = (bySource[row.sourceBucket || "未标记"] || 0) + 1;
  });

  const cityCounts = Object.entries(byCity)
    .map(([city, count]) => ({ city, count }))
    .sort((a, b) => a.count - b.count);

  return {
    provinceCount: provinces.size,
    cityCount: cities.size,
    dishCount: rows.length,
    byMeal,
    bySource,
    lowCities: cityCounts.filter((item) => item.count < 8).slice(0, 12),
    topCities: cityCounts.slice().sort((a, b) => b.count - a.count).slice(0, 8)
  };
}

function getFilteredRows() {
  const keyword = state.keyword.trim();
  return state.rows.filter((row) => {
    const haystack = `${row.province}${row.city}${row.name}${row.category}${row.taste}${row.tags}`;
    const keywordPass = !keyword || haystack.includes(keyword);
    const mealPass = state.mealFilter === "全部" || splitList(row.mealTime).includes(state.mealFilter);
    const sourcePass = state.sourceFilter === "全部" || row.sourceBucket === state.sourceFilter;
    return keywordPass && mealPass && sourcePass;
  });
}

function render() {
  const rows = state.rows;
  const audit = getAudit(rows);
  const stats = getStats(rows);
  const filteredRows = getFilteredRows();

  app.innerHTML = `
    <main class="shell">
      <aside class="rail">
        <div>
          <div class="brand">饭点转转</div>
          <div class="rail-note">本地数据工作台</div>
        </div>
        <nav class="nav-list">
          <a class="nav-item active" href="#overview">总览</a>
          <a class="nav-item" href="#audit">审计</a>
          <a class="nav-item" href="#data">数据</a>
          <a class="nav-item" href="#export">导出</a>
        </nav>
        <div class="rail-foot">不连接云数据库。所有操作只保存在当前浏览器。</div>
      </aside>

      <section class="workspace">
        <header class="hero" id="overview">
          <div>
            <p class="kicker">LOCAL OPS</p>
            <h1>菜品数据工作台</h1>
            <p class="hero-copy">导入表格、检查重复和风险词、查看覆盖情况，再导出给小程序数据脚本使用。</p>
          </div>
          <div class="hero-actions">
            <label class="button primary">
              导入 CSV/JSON
              <input id="import-file" type="file" accept=".csv,.json,application/json" />
            </label>
            <button id="reset-data" class="button ghost">重新加载项目数据</button>
          </div>
        </header>

        <section class="metric-grid">
          ${renderMetric("菜品条目", stats.dishCount)}
          ${renderMetric("覆盖省份", stats.provinceCount)}
          ${renderMetric("覆盖城市", stats.cityCount)}
          ${renderMetric("审计问题", audit.duplicates.length + audit.risks.length + audit.missingRequired.length)}
        </section>

        <section class="split">
          <article class="panel" id="audit">
            <div class="panel-head">
              <h2>数据审计</h2>
              <span class="${getAuditBadgeClass(audit)}">${getAuditBadgeText(audit)}</span>
            </div>
            ${renderAuditList(audit)}
          </article>

          <article class="panel">
            <div class="panel-head">
              <h2>餐段分布</h2>
              <span class="subtle">${Object.keys(stats.byMeal).length || 0} 类</span>
            </div>
            ${renderBars(stats.byMeal)}
          </article>
        </section>

        <section class="split">
          <article class="panel">
            <div class="panel-head">
              <h2>低覆盖城市</h2>
              <span class="subtle">少于 8 条</span>
            </div>
            ${renderCityList(stats.lowCities, "当前没有低覆盖城市")}
          </article>
          <article class="panel">
            <div class="panel-head">
              <h2>来源结构</h2>
              <span class="subtle">sourceBucket</span>
            </div>
            ${renderBars(stats.bySource)}
          </article>
        </section>

        <section class="panel" id="data">
          <div class="table-head">
            <div>
              <h2>菜品明细</h2>
              <p id="table-count">当前显示 ${filteredRows.length} 条，最多预览 120 条。</p>
            </div>
            <div class="filters">
              <input id="search" value="${escapeHtml(state.keyword)}" placeholder="搜索省份、城市、菜名或标签" />
              ${renderSelect("meal-filter", ["全部", "早餐", "午餐", "晚餐", "宵夜"], state.mealFilter)}
              ${renderSelect("source-filter", ["全部", "cityExact", "regionalShared", "provinceShared", "nationalGeneral"], state.sourceFilter)}
            </div>
          </div>
          <div class="table-wrap">
            <div id="table-content">${renderTable(filteredRows.slice(0, 120))}</div>
          </div>
        </section>

        <section class="panel export-panel" id="export">
          <div>
            <h2>导出与下一步</h2>
            <p>这个工作台不直接写入小程序源码。导出后再用脚本或人工审核方式合入，避免误改线上数据。</p>
          </div>
          <div class="export-actions">
            <button id="export-json" class="button primary">导出 JSON</button>
            <button id="export-csv" class="button ghost">导出 CSV</button>
          </div>
        </section>
      </section>
    </main>
  `;

  bindEvents();
}

function renderMetric(label, value) {
  return `
    <article class="metric">
      <strong>${value}</strong>
      <span>${label}</span>
    </article>
  `;
}

function renderAuditList(audit) {
  const items = [
    ["重复菜品", audit.duplicates.length],
    ["风险词命中", audit.risks.length],
    ["缺字段", audit.missingRequired.length],
    ["弱权重/指数", audit.weakRows.length]
  ];
  return `
    <div class="audit-list">
      ${items.map(([label, value]) => `
        <div class="audit-row">
          <span>${label}</span>
          <strong class="${value ? "danger-text" : ""}">${value}</strong>
        </div>
      `).join("")}
    </div>
    ${renderAuditSamples(audit)}
  `;
}

function renderAuditSamples(audit) {
  const samples = [
    ...audit.duplicates.slice(0, 2).map((item) => `重复：${item.row.city} · ${item.row.name}`),
    ...audit.risks.slice(0, 2).map((item) => `风险：${item.row.city} · ${item.row.name} · ${item.riskHit}`),
    ...audit.missingRequired.slice(0, 2).map((item) => `缺字段：${item.row.city || "-"} · ${item.row.name || "-"} · ${item.missing.join("/")}`)
  ];
  if (!samples.length) return `<p class="empty-note">没有发现重复、风险词或缺字段。</p>`;
  return `<div class="sample-list">${samples.map((item) => `<span>${escapeHtml(item)}</span>`).join("")}</div>`;
}

function getAuditBadgeClass(audit) {
  const count = audit.duplicates.length + audit.risks.length + audit.missingRequired.length;
  return count ? "badge danger" : "badge good";
}

function getAuditBadgeText(audit) {
  const count = audit.duplicates.length + audit.risks.length + audit.missingRequired.length;
  return count ? `${count} 个待处理` : "可继续";
}

function renderBars(map) {
  const entries = Object.entries(map).sort((a, b) => b[1] - a[1]);
  const max = Math.max(1, ...entries.map((entry) => entry[1]));
  if (!entries.length) return `<p class="empty-note">暂无数据。</p>`;
  return `
    <div class="bar-list">
      ${entries.map(([label, value]) => `
        <div class="bar-row">
          <div class="bar-label">
            <span>${escapeHtml(label)}</span>
            <strong>${value}</strong>
          </div>
          <div class="bar-track"><div class="bar-fill" style="width: ${(value / max) * 100}%"></div></div>
        </div>
      `).join("")}
    </div>
  `;
}

function renderCityList(cities, emptyText) {
  if (!cities.length) return `<p class="empty-note">${emptyText}</p>`;
  return `
    <div class="city-list">
      ${cities.map((item) => `
        <div class="city-row">
          <span>${escapeHtml(item.city)}</span>
          <strong>${item.count}</strong>
        </div>
      `).join("")}
    </div>
  `;
}

function renderSelect(id, options, value) {
  return `
    <select id="${id}">
      ${options.map((option) => `<option value="${option}" ${option === value ? "selected" : ""}>${option}</option>`).join("")}
    </select>
  `;
}

function renderTable(rows) {
  if (!rows.length) return `<div class="table-empty">没有匹配的数据。</div>`;
  return `
    <table>
      <thead>
        <tr>
          <th>省份</th>
          <th>城市</th>
          <th>菜品</th>
          <th>类型</th>
          <th>口味</th>
          <th>餐段</th>
          <th>场景</th>
          <th>标签</th>
          <th>指数</th>
          <th>来源</th>
        </tr>
      </thead>
      <tbody>
        ${rows.map((row) => `
          <tr>
            <td>${escapeHtml(row.province)}</td>
            <td>${escapeHtml(row.city)}</td>
            <td class="strong-cell">${escapeHtml(row.name)}</td>
            <td>${escapeHtml(row.category)}</td>
            <td>${escapeHtml(row.taste)}</td>
            <td>${escapeHtml(row.mealTime)}</td>
            <td>${escapeHtml(row.scene)}</td>
            <td>${escapeHtml(row.tags || "-")}</td>
            <td>${escapeHtml(row.localIndex)}</td>
            <td><span class="source-pill">${escapeHtml(row.sourceBucket || "-")}</span></td>
          </tr>
        `).join("")}
      </tbody>
    </table>
  `;
}

function bindEvents() {
  document.querySelector("#import-file").addEventListener("change", onImport);
  document.querySelector("#reset-data").addEventListener("click", () => {
    state.rows = projectRows;
    saveRows(state.rows);
    render();
  });
  document.querySelector("#search").addEventListener("input", (event) => {
    state.keyword = event.target.value;
    renderDataPreview();
  });
  document.querySelector("#meal-filter").addEventListener("change", (event) => {
    state.mealFilter = event.target.value;
    render();
  });
  document.querySelector("#source-filter").addEventListener("change", (event) => {
    state.sourceFilter = event.target.value;
    render();
  });
  document.querySelector("#export-json").addEventListener("click", () => exportFile("fandian-dishes.json", JSON.stringify(state.rows, null, 2)));
  document.querySelector("#export-csv").addEventListener("click", () => exportFile("fandian-dishes.csv", toCsv(state.rows)));
}

function renderDataPreview() {
  const rows = getFilteredRows();
  document.querySelector("#table-count").textContent = `当前显示 ${rows.length} 条，最多预览 120 条。`;
  document.querySelector("#table-content").innerHTML = renderTable(rows.slice(0, 120));
}

async function onImport(event) {
  const file = event.target.files[0];
  if (!file) return;
  const text = await file.text();
  const rows = file.name.endsWith(".json") ? parseJson(text) : parseCsv(text);
  state.rows = rows;
  saveRows(rows);
  state.keyword = "";
  state.mealFilter = "全部";
  state.sourceFilter = "全部";
  render();
}

function exportFile(filename, content) {
  const blob = new Blob([content], { type: "text/plain;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}

function toCsv(rows) {
  const escapeCell = (value) => {
    const text = String(value || "");
    return /[",\n]/.test(text) ? `"${text.replace(/"/g, "\"\"")}"` : text;
  };
  return [
    requiredColumns.join(","),
    ...rows.map((row) => requiredColumns.map((column) => escapeCell(row[column])).join(","))
  ].join("\n");
}

function escapeHtml(value) {
  return String(value || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

async function init() {
  projectRows = await loadProjectRows();
  state.rows = loadRows();
  render();
}

init();
