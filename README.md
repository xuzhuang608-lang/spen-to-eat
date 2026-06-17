# 饭点转转

饭点转转是一个微信小程序，用城市特色菜和转盘机制帮用户减少“今天吃什么”的选择困难。

## 上线项目结构

```text
饭点转转/
├─ miniprogram/              微信小程序上线代码
│  ├─ assets/                小程序图片资源
│  ├─ components/            公共组件
│  ├─ config/                本地配置示例
│  ├─ data/                  城市索引与省份菜品数据
│  ├─ pages/                 页面
│  ├─ services/              数据、定位和本地存储服务
│  └─ utils/                 工具函数
├─ project.config.json       微信开发者工具项目配置
├─ project.private.config.json
└─ README.md
```

## 离线归档区

`_offline/` 是本地历史资料归档区，已加入 `.gitignore`，不提交到 GitHub，也不参与小程序上传包。

- `_offline/admin/`：管理后台原型。
- `_offline/cloudfunctions/`：云函数草稿，当前首版不依赖。
- `_offline/data/`：导入模板。
- `_offline/docs/`：历史技术文档和方案。
- `_offline/project-prep/`：需求、调研、原始数据、备份和中间产物。
- `_offline/scripts/`：数据生成、导入和审计脚本。

这些内容保留是为了后续继续扩展和复查数据，但不属于当前小程序上线包和当前线上代码。

## 当前核心功能

- 城市选择和定位切城。
- 城市菜品转盘，支持餐段、分类、口味、场景和忌口筛选。
- 本轮菜单、菜品详情、自定义加一道菜。
- 结果页展示、收藏、历史、就吃这个和分享。
- 搜索菜品。
- 饭局建议与分享。
- 隐私说明和反馈入口。

## 数据方案

首版采用本地数据方案，不依赖云数据库。

- 小程序运行数据在 `miniprogram/data/` 和 `miniprogram/services/dish.js`。
- 原始数据、导入记录和历史备份已经归档到 `_offline/project-prep/`。
- 数据清洗和审计脚本已经归档到 `_offline/scripts/`。

常用审计命令：

```bash
node _offline/scripts/audit_dish_quality.js
node _offline/scripts/audit_core_flow.js
```

## 地图配置

定位功能使用高德 WebService 逆地理接口：

- 请求域名：`https://restapi.amap.com`
- 私有配置：`miniprogram/config/map.js`
- 示例配置：`miniprogram/config/map.example.js`

`miniprogram/config/map.js` 已加入 `.gitignore`，不要提交真实 Key。

## 运行方式

1. 使用微信开发者工具打开项目根目录。
2. 小程序根目录为 `miniprogram/`。
3. 当前 AppID 已配置在 `project.config.json`。
4. 在微信公众平台配置 request 合法域名：`https://restapi.amap.com`。
5. 在开发者工具中编译、预览、真机调试。

## 上线前注意

- `_offline/` 是本地历史资料归档，不提交到 GitHub。
- `project.private.config.json` 是本地私有配置，不建议提交。
- `miniprogram/config/map.js` 包含地图 Key，不要提交。
- 提交审核前建议再跑一遍真机全流程：定位、切城、搜索、转盘、结果页、收藏、历史、饭局建议、分享。
