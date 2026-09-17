# 📊 npm-stat Modern UI

<a href="https://github.com/VincentZyuApps/npm-stat.com-but-modern-ui"><img height="25" alt="GitHub Repo" src="https://img.shields.io/badge/GitHub%20Repo-181717?logo=github&logoColor=white&style=flat-square"></a>
<a href="https://gitee.com/vincent-zyu/npm-stat.com-but-modern-ui"><img height="25" alt="Gitee Repo" src="https://img.shields.io/badge/Gitee%20Repo-181717?logo=gitee&logoColor=white&style=flat-square"></a>

> **[📖 English](README.md)**
> **[📖 简体中文(大陆)](README.zh-cn.md)**

[![npm-stat.com](https://img.shields.io/badge/npm--stat.com-CB3837?logo=npm&logoColor=white)](https://npm-stat.com/) 一个将 npm-stat.com 查询和图表页面现代化的 Tampermonkey 用户脚本。

<a href="https://github.com/VincentZyuApps/npm-stat.com-but-modern-ui/releases"><img height="25" alt="浏览 GitHub Release" src="https://img.shields.io/badge/GitHub%20Release-browse-181717?logo=github&logoColor=white&style=flat-square"></a>
<a href="https://vincentzyuapps.github.io/npm-stat.com-but-modern-ui/npm-stat-modern-ui.user.js"><img height="25" alt="从 GitHub Pages 安装" src="https://img.shields.io/badge/npm--stat.com-auto--update-CB3837?logo=npm&logoColor=white&style=flat-square"></a>
<a href="https://gitee.com/vincent-zyu/npm-stat.com-but-modern-ui/releases"><img height="25" alt="浏览 Gitee Release" src="https://img.shields.io/badge/Gitee%20Release-mirror-C71D23?logo=gitee&logoColor=white&style=flat-square"></a>
<a href="https://greasyfork.org/zh-CN/scripts/596128-npm-stat-modern-ui"><img height="25" alt="从 Greasy Fork 安装" src="https://img.shields.io/badge/Greasy%20Fork-install-670000?logo=googlechrome&logoColor=white&style=flat-square"></a>

## 🔨 构建

```powershell
npm install
npm run build
```

独立用户脚本生成于：

```text
dist/npm-stat-modern-ui.user.js
```

`dist/` 在本地生成，不提交到仓库。

## 🚀 公开安装

先安装 Tampermonkey 或兼容的用户脚本管理器，再从下列入口安装或下载。推荐使用 GitHub Pages 链接，它是持续安装与自动更新来源。

| 渠道 | 安装或下载 |
| --- | --- |
| GitHub Pages | [安装最新用户脚本](https://vincentzyuapps.github.io/npm-stat.com-but-modern-ui/npm-stat-modern-ui.user.js) |
| Greasy Fork | [从 Greasy Fork 安装](https://greasyfork.org/zh-CN/scripts/596128-npm-stat-modern-ui) |
| GitHub Release | [浏览带版本的下载](https://github.com/VincentZyuApps/npm-stat.com-but-modern-ui/releases) |
| Gitee Release | [浏览中国镜像](https://gitee.com/vincent-zyu/npm-stat.com-but-modern-ui/releases) |

脚本管理器打开安装确认页后，选择“安装”并刷新 npm-stat.com。用户脚本会检查 Pages 地址更新；请保持管理器的自动更新设置启用。

## 📥 本地安装

1. 如果之前安装过 `npm-stat Modern UI (Development Loader)`，请在 Tampermonkey 中禁用或删除它。
2. 在 Tampermonkey 中新建用户脚本。
3. 用 `dist/npm-stat-modern-ui.user.js` 的完整内容替换脚本内容，然后保存。
4. 刷新 `https://npm-stat.com/charts.html?package=koishi-plugin-cs-lookup-vincentzyu-fork`。

## ✅ 验证

```powershell
npm run check
```

此命令会执行 TypeScript 类型检查、图表数据测试，生成用户脚本，验证其元数据，并检查生成文件的语法。

## 🧪 示例测试链接

每条链接对比五个包。前四组覆盖 **2015-01-01 至 2026-09-15**；Koishi 示例覆盖 **2025-09-16 至 2026-09-15**，与排名统计区间一致。链接不包含 UI 参数，方便你使用自己的外观和聚合偏好。

### 🌐 1. 前端开发

`react`, `vue`, `svelte`, `preact`, `@angular/core`。

https://npm-stat.com/charts.html?package=react&package=vue&package=svelte&package=preact&package=%40angular%2Fcore&from=2015-01-01&to=2026-09-15 — 框架历史、不同下载量级及带作用域的包名。

### ⚙️ 2. 后端开发

`express`, `koa`, `fastify`, `@nestjs/core`, `@hapi/hapi`。

https://npm-stat.com/charts.html?package=express&package=koa&package=fastify&package=%40nestjs%2Fcore&package=%40hapi%2Fhapi&from=2015-01-01&to=2026-09-15 — 多条数据序列、周/月总量及均值与总量聚合对比。

### 🖥️ 3. 桌面开发

`electron`, `electron-builder`, `@electron/packager`, `@tauri-apps/api`, `nw`。

https://npm-stat.com/charts.html?package=electron&package=electron-builder&package=%40electron%2Fpackager&package=%40tauri-apps%2Fapi&package=nw&from=2015-01-01&to=2026-09-15 — 桌面运行时与工具链、长包名及差异较大的曲线。

### 🧰 4. 通用开发

`typescript`, `lodash`, `rxjs`, `dayjs`, `zod`。

https://npm-stat.com/charts.html?package=typescript&package=lodash&package=rxjs&package=dayjs&package=zod&from=2015-01-01&to=2026-09-15 — 高下载量、长周期聚合及缩放。

### 🧩 5. 我的 Koishi 插件

`koishi-plugin-awa-quote-image`, `koishi-plugin-music-link-vincentzyu-fork`, `koishi-plugin-onebot-info-image`, `koishi-plugin-wydashen-guangyi-query`, `koishi-plugin-get-qq-bot-transfer-link`。

https://npm-stat.com/charts.html?package=koishi-plugin-awa-quote-image&package=koishi-plugin-music-link-vincentzyu-fork&package=koishi-plugin-onebot-info-image&package=koishi-plugin-wydashen-guangyi-query&package=koishi-plugin-get-qq-bot-transfer-link&from=2025-09-16&to=2026-09-15 — 个人项目、较低下载量、零下载时段及峰值。

部分包在查询起始日期之后才发布，因此早期时段可能没有下载记录。npm 下载量不等于用户数；这些分组用于测试图表，并非不同类型工具之间的直接热度排名。

### 🏆 Koishi 筛选与年度排名

快照查询于 **2026-09-16**，采用 npm Downloads API 在 **2025-09-16 至 2026-09-15** 期间的统计。候选包来自本地 Koishi 项目的 `external` 目录，以实际的 `package.json.name` 为准。仅纳入已发布到 npm Registry、且维护者包含 `vincentzyu` 的包。未发布的实验项目及由其他人维护的上游包均已排除。

| 排名 | 包名 | 区间内下载量 |
| --- | --- | ---: |
| 1 | `koishi-plugin-awa-quote-image` | 8,041 |
| 2 | `koishi-plugin-music-link-vincentzyu-fork` | 6,802 |
| 3 | `koishi-plugin-onebot-info-image` | 4,567 |
| 4 | `koishi-plugin-wydashen-guangyi-query` | 3,479 |
| 5 | `koishi-plugin-get-qq-bot-transfer-link` | 3,008 |

此排名仅覆盖符合条件且有可用统计的本地候选包，不代表整个 Koishi 市场。已发布但 Downloads API 尚无可用统计的包不按零下载处理，也不参与排名；本次快照中包括 `koishi-plugin-steam-vincentzyu`。

## 🎨 七种外观风格

使用右上角下拉框选择原始 npm-stat、npm、Vercel、Fluent、Material 3、Apple（iOS/macOS）或 GitHub。旁边的 emoji 按钮独立循环切换跟随系统/浅色/深色。两项偏好都会保存；默认风格为 npm。切换时保留表单输入、图表缩放、图例选择及日图坐标尺度，不重新获取数据。

原始风格恢复更简洁的外观，同时保留 ECharts 和查询增强功能。公共布局位于 `src/styles.css`；每种风格在 `src/styles/` 下都有独立的浅色/深色 CSS。所有样式均在本地打包进用户脚本。数据与图表逻辑位于 `src/data.ts` 和 `src/renderer.ts`；Vite 类型声明位于 `src/vite.d.ts`。

## 📈 长周期图表与聚合

内容区域最大宽度为 2500px，图表线宽为 1px（悬停时为 1.5px）。日图和周图各有八档分组大小：1、2、3、4、5、10、25 和 50，另有一个均值/总量切换按钮。两张图独立设置，默认分组大小为 1、口径为均值，并记住手动修改。日图的 Linear/Log 切换仍然独立；对数轴不绘制零值，也不会用正数替代零值。

分组始终从完整查询范围的起点开始，不受缩放影响。各包按相同边界分别聚合。均值按实际包含的天数或周数计算，零下载时段也计入分母；总量则对下载量求和。末尾不足一组的数据会保留。周均值对提供的每周总量取平均，包含首尾不完整周，不推算完整周下载量。悬停提示显示完整 ISO 周名、覆盖日期、实际分组大小和总量。摘要指标始终使用原始日数据。

## 🔗 分享设置

直接复制地址栏即可：设置通过 `history.replaceState` 自动更新，不刷新页面，也不新增历史记录。无需分享按钮。支持以下参数：

| 参数 | 取值 |
| --- | --- |
| `ui_style` | `original`, `npm`, `vercel`, `fluent`, `material`, `apple`, `github` |
| `ui_theme` | `system`, `light`, `dark` |
| `ui_day_size`, `ui_week_size` | `1`, `2`, `3`, `4`, `5`, `10`, `25`, `50` |
| `ui_day_mode`, `ui_week_mode` | `mean`, `sum` |

每项设置依次从有效 URL 值、本地记忆、默认值中解析。打开分享链接不会覆盖已保存的偏好，仅保存你手动修改的设置。`system` 跟随接收者的系统；使用 `light` 或 `dark` 可分享固定外观。提交查询和访问同站图表链接时会携带当前设置。包名、日期、其他参数和 URL 片段会按需保留。缩放、隐藏的图例项及 Linear/Log 不会序列化到链接中。

未安装此用户脚本的用户仍可打开查询；只有 UI 增强功能需要安装脚本。

## 📷 风格截图

七种风格的真实页面截图，亮色与暗色并排展示。点击图片可查看原图。

| 风格 | 亮色 | 暗色 |
| --- | --- | --- |
| Original npm-stat | [![Original npm-stat 亮色](docs/images/preview/light-original.png)](docs/images/preview/light-original.png) | [![Original npm-stat 暗色](docs/images/preview/dark-original.png)](docs/images/preview/dark-original.png) |
| npm | [![npm 亮色](docs/images/preview/light-npm.png)](docs/images/preview/light-npm.png) | [![npm 暗色](docs/images/preview/dark-npm.png)](docs/images/preview/dark-npm.png) |
| Vercel | [![Vercel 亮色](docs/images/preview/light-vercel.png)](docs/images/preview/light-vercel.png) | [![Vercel 暗色](docs/images/preview/dark-vercel.png)](docs/images/preview/dark-vercel.png) |
| Windows Fluent | [![Windows Fluent 亮色](docs/images/preview/light-fluent.png)](docs/images/preview/light-fluent.png) | [![Windows Fluent 暗色](docs/images/preview/dark-fluent.png)](docs/images/preview/dark-fluent.png) |
| Google Material 3 | [![Google Material 3 亮色](docs/images/preview/light-material.png)](docs/images/preview/light-material.png) | [![Google Material 3 暗色](docs/images/preview/dark-material.png)](docs/images/preview/dark-material.png) |
| Apple iOS/macOS | [![Apple iOS/macOS 亮色](docs/images/preview/light-apple.png)](docs/images/preview/light-apple.png) | [![Apple iOS/macOS 暗色](docs/images/preview/dark-apple.png)](docs/images/preview/dark-apple.png) |
| GitHub | [![GitHub 亮色](docs/images/preview/light-github.png)](docs/images/preview/light-github.png) | [![GitHub 暗色](docs/images/preview/dark-github.png)](docs/images/preview/dark-github.png) |

运行 `npm run docs:screenshots` 可自动构建并重新截图，无需安装 Tampermonkey。真实扩展模式首次需要你安装 Tampermonkey、允许用户脚本、粘贴构建好的 JS 并刷新确认。两个入口、全部参数及逐步操作见[截图工具说明](scripts/docs/readme.md)。
