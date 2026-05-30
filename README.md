# KMJAVideo

基于 Electron + Vue 3 + Vite 的本地影片索引与管理桌面应用。

## 功能概览

-   **影片扫描** — 扫描本地目录，自动识别番号并入库
-   **影片浏览** — 封面墙展示，支持搜索、筛选、排序
-   **信息采集** — 从 JAVDB 自动抓取影片元数据（标题、演员、标签、封面等）
-   **演员头像** — 自动下载演员头像
-   **数据持久化** — SQLite 本地存储，数据随身携带

## 技术栈

| 层级 | 技术 |
| ---- | ---- |
| 框架 | Electron 30 |
| 前端 | Vue 3 + Vite 5 |
| 数据库 | SQLite (sql.js WASM) |
| 打包 | electron-builder |

## 快速开始

```bash
# 安装依赖
npm install

# 开发模式运行
npm run dev

# 或双击 run.bat
```

### 构建发布包

```bash
npm run build
# 或双击 build.bat
```

打包产物输出到 `release/` 目录。

---

## 目录结构

```
KMJAVideo/
├── electron/             # Electron 主进程
│   ├── main.js           # 主进程入口、IPC 通信
│   ├── preload.js        # 预加载脚本（桥接 API）
│   └── scraper-javdb.js  # JAVDB 信息采集器
├── src/                  # Vue 前端
│   ├── components/       # Vue 组件
│   ├── App.vue           # 根组件
│   ├── main.js           # 前端入口
│   └── style.css         # 全局样式
├── public/               # 静态资源（字体、图标）
├── data/                 # 📁 用户数据目录（详见下方说明）
├── index.html            # HTML 入口
├── vite.config.js        # Vite 配置
├── package.json          # 项目配置
├── run.bat               # 一键开发运行
└── build.bat             # 一键构建发布
```

---

## `data/` 目录说明

`data/` 是应用的**用户数据目录**，所有影片数据、图片、配置均存放在此。

```
data/
├── javdata.db            # SQLite 数据库（核心）
├── javdb.com.txt         # JAVDB Cookie（采集必备）
├── config.json           # 应用配置文件
├── Filetree.json         # 文件树索引缓存
├── thumb/                # 影片封面图
│   └── {番号}.jpg
├── actors/               # 演员头像
│   └── {演员名}.jpg
├── db/                   # 数据库备份
└── actors/actors-dl.exe  # 头像下载工具
```

### 数据库 (`javdata.db`)

SQLite 数据库，通过 sql.js 在内存中运行，写入时同步回磁盘。

**`movies` 表** — 影片索引

| 字段 | 说明 |
| ---- | ---- |
| `num`  | 番号（唯一） |
| `path` | 本地文件路径 |

**`movies_info` 表** — 影片元数据（从 JAVDB 采集）

| 字段 | 说明 |
| ---- | ---- |
| `num` | 番号（唯一，关联 movies 表） |
| `title` | 标题 |
| `originaltitle` | 原标题 |
| `studio` | 片商 |
| `maker`  | 制作商 |
| `label`  | 系列/厂牌 |
| `year`   | 发行年份 |
| `premiered` | 首映日期 |
| `release_date` | 发售日期 |
| `runtime` | 时长（分钟） |
| `director` | 导演 |
| `plot`    | 剧情简介 |
| `actors`  | 演员（逗号分隔） |
| `tags`    | 标签（逗号分隔） |
| `poster` / `thumb` | 封面/缩略图 URL |
| `website` | JAVDB 页面链接 |

> 💡 **手动修改数据库**：可直接用 [DB Browser for SQLite](https://sqlitebrowser.org/) 等工具打开 `javdata.db` 编辑。修改后在应用的「数据采集」页点击**刷新**，应用会自动从磁盘重载数据库。

### JAVDB Cookie (`javdb.com.txt`)

采集影片信息时需要用 Cookie 来保持 JAVDB 的登录状态。

**获取方式：**

1. 浏览器登录 [javdb.com](https://javdb.com)
2. 安装浏览器扩展（如 EditThisCookie），导出 Cookie
3. 将 Cookie 内容（Netscape 格式或纯 JSON 格式）保存为 `data/javdb.com.txt`
4. 放在 `data/` 目录下即可

> ⚠️ Cookie 过期后需要重新导出替换。数据采集页会自动检测 Cookie 文件是否存在。

---

## 注意事项

-   `data/` 目录包含你的个人数据，**不会被上传到 GitHub**（已加入 `.gitignore`），请自行备份
-   编译版（`release/`）的数据目录在 exe 同级的 `data/` 文件夹，方便移动和备份
-   采集 JAVDB 时，每部影片之间自动间隔 20 秒，避免被网站拦截
-   开发环境下采集窗口会打开 DevTools，编译版不会

## License

MIT
