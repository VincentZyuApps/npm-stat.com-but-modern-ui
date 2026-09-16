# 📷 README 截图工具

这两个 Node.js 脚本控制本机 Chrome、Chromium 或 Edge，为七种 UI 风格分别拍摄亮色、暗色截图，共 14 张。使用 `playwright-core` 连接 CDP；不下载浏览器，不引入开发服务器或热重载。

| 入口 | 用途 | 是否需要手动安装 |
| --- | --- | --- |
| `screenshots.mjs`，默认 `inject` 模式 | 构建并注入最新用户脚本，自动生成文档截图 | 不需要 Tampermonkey |
| `screenshots.mjs --mode extension` | 用实际安装的 Tampermonkey 用户脚本截图 | 首次需要安装，以后需要更新用户脚本 |
| `setup.mjs` | 构建脚本并打开专用浏览器，供首次安装扩展 | 需要你完成下面列出的步骤 |

所有命令都从**仓库根目录**执行。使用 Node.js 22.12+（推荐当前 Node.js LTS），同时满足 Vite 和原生 TypeScript 测试的要求；先运行 `npm install`。

## 🚀 自动注入模式：无需手动安装

```powershell
npm run docs:screenshots

# 指定本机 Chrome；包含空格的路径必须加引号。
npm run docs:screenshots -- --browser-path "C:\Program Files\Google\Chrome\Application\chrome.exe"

# 显示窗口，便于观察截图过程。
npm run docs:screenshots -- --headed
```

脚本自动构建并验证 `dist/npm-stat-modern-ui.user.js`，使用独立临时档案，先注册页面初始化脚本再导航，以免错过原网站图表初始化。它不会使用或修改日常 Chrome 的档案，也不需要安装 Tampermonkey。

等四张图表加载完成后，通过页面右上角真实控件切换七种风格和亮暗主题。每张截图都等字体加载、图表完成及连续三次画面稳定后才保存。脚本结束会关闭自己启动的浏览器并删除自己的临时档案。

这验证的是当前构建的页面效果，不能替代真实 Tampermonkey 安装验收。

## 🧩 扩展模式：首次需要你配合

### 1. 自动准备专用 Chrome

```powershell
npm run docs:setup -- --browser-path "C:\Program Files\Google\Chrome\Application\chrome.exe" --user-data-dir "E:\BrowserProfiles\npm-stat-docs"
```

脚本自动构建用户脚本，打开 Tampermonkey 应用店页面和 npm-stat 测试页，并在终端输出当前版本、构建文件路径和可连接的 CDP 地址。浏览器会保持打开，供你安装。

这个窗口使用单独的持久档案，所以不会自动继承日常 Chrome 已安装的扩展。`E:\BrowserProfiles\npm-stat-docs` 是示例，你可以指定另一个专用目录；不要指定日常浏览器的 User Data、Default 或 Profile 1 目录。

### 2. 你需要手动完成的步骤

1. **安装 Tampermonkey**：在刚打开的专用 Chrome 窗口里，从应用店安装扩展，确认浏览器安装提示。
2. **允许用户脚本运行**：按当前 Chrome/Tampermonkey 的提示启用权限；新版 Chrome 通常在扩展详情中提供“允许用户脚本”，其他版本可能提示开发者模式。以实际提示为准。
3. **安装用户脚本**：打开 Tampermonkey → 新建脚本 → 删除默认模板，复制 `dist/npm-stat-modern-ui.user.js` 的**全部内容**，粘贴并保存。
4. **确认已启用**：在 Tampermonkey 管理面板确认 `npm-stat Modern UI` 已启用。禁用旧的 Development Loader，避免多个版本同时运行。
5. **刷新确认效果**：刷新该窗口里的 npm-stat 测试页，确认右上角出现风格下拉框和主题按钮，图表正常加载。
6. **继续自动截图**：保持窗口打开，复制终端输出的 `--cdp-url` 命令执行。若由 Codex 协助执行，到这里告诉它“安装并启用好了”。

安装只需要首次进行；扩展和用户脚本会保存在专用档案里。自动化脚本不会替你确认浏览器的安装或权限弹窗。

**已安装但页面没有变化？** 如果 Tampermonkey 面板显示“请启用‘允许用户脚本’扩展设置”，请在这个专用窗口打开 `chrome://extensions/?id=dhdgffkkebhmkfjojejmpbldmpobfkfo`，开启“允许用户脚本”，再刷新 npm-stat 页面。安装扩展、保存脚本与允许执行是三个独立步骤。

### 3. 保持配置窗口打开时截图

```powershell
# 使用 setup 实际输出的端口；9222 只是示例，不是固定端口。
npm run docs:screenshots -- --mode extension --cdp-url http://127.0.0.1:9222
```

只连接本机回环地址。脚本创建专门的截图标签页，结束只关闭这个标签页并断开连接，不关闭已有浏览器或其他标签页。截图切换产生的插件偏好会在结束时恢复；请在截图过程中不要同时修改这个档案里的插件设置。

### 4. 已关闭配置窗口时截图

```powershell
npm run docs:screenshots -- --mode extension --browser-path "C:\Program Files\Google\Chrome\Application\chrome.exe" --user-data-dir "E:\BrowserProfiles\npm-stat-docs"
```

脚本打开这个专用档案，完成截图后关闭自己启动的浏览器，**保留档案及其扩展**。同一个档案不能同时被两个浏览器进程使用；发现仍在运行时会提示改用 CDP 连接。

### 5. 源码更新后你需要做什么

```powershell
npm run build
```

重新复制最新 `.user.js` 全文，在 Tampermonkey 中覆盖原脚本、保存，然后刷新页面。无需重装 Tampermonkey。

截图入口也会构建最新版；扩展模式不会注入或自动替换已安装脚本。它检查页面的 `data-npm-stat-version` 与 `package.json` 一致，没有标识或版本不符会报错并提示更新。**版本号相同但源码已改变时，仍需你主动更新 JS**，版本检查无法区分同版本的不同构建。

## ⚙️ 参数与浏览器选择

| 参数 | 入口 | 说明 |
| --- | --- | --- |
| `--browser-path <路径>` | 两者 | 显式指定可执行文件；不存在就报错，不静默回退 |
| `--user-data-dir <目录>` | setup、extension | 专用持久档案；不自动删除 |
| `--cdp-url <地址>` | screenshots extension | 连接已有浏览器；与 browser-path、user-data-dir 互斥 |
| `--mode inject\|extension` | screenshots | 默认 inject；extension 必须指定档案或 CDP 地址 |
| `--headed` | screenshots inject | 默认无头；传入后显示窗口；扩展模式总是显示窗口 |
| `--url <地址>` | screenshots | 覆盖 npm-stat 图表查询；需使用 HTTPS 并包含 package 或 author |
| `--help` | 两者 | 显示帮助，不执行构建或打开浏览器 |

优先级：`--browser-path` → 环境变量 `BROWSER_PATH` → 当前系统候选路径 → PATH 查找。

| 系统 | 浏览器 | 默认候选 |
| --- | --- | --- |
| Windows | Chrome | `%ProgramFiles%\Google\Chrome\Application\chrome.exe` |
| Windows | Edge | `%ProgramFiles(x86)%\Microsoft\Edge\Application\msedge.exe` |
| Linux | Chrome | `/usr/bin/google-chrome` |
| Linux | Chromium | `/usr/bin/chromium` |
| Linux | Edge | `/usr/bin/microsoft-edge` |

PATH 还会查找 `chromium-browser` 等程序名。Windows 便携 Chromium 没有统一安装位置，直接用 `--browser-path`。

```bash
# Linux：自动探测或手动指定。扩展配置需要图形桌面。
npm run docs:screenshots -- --browser-path /usr/bin/chromium
npm run docs:setup -- --browser-path /usr/bin/google-chrome --user-data-dir "$HOME/.local/share/npm-stat-docs-profile"
```

## 🖼️ 截图规则及 README 引用

- 默认查询 `react`、`vue`、`svelte`、`preact`、`@angular/core`，日期固定为 `2015-01-01` 至 `2026-09-15`。使用网站真实数据；网络不可用时不会换成假数据。
- 查询参数强制固定初始风格、明暗、日周粒度 `1` 和均值；新页面使用完整缩放、全部图例和 Linear。
- 视口 1440 × 1000，设备像素比 1，UTC 时区；保存整页 PNG，实际高度取决于内容。截图前移开鼠标、去除焦点，等待字体和图表画面稳定。
- 正式输出 `docs/images/preview/<light|dark>-<style>.png`（例如 `light-npm.png`、`dark-npm.png`），七个 style 为 original、npm、vercel、fluent、material、apple、github。
- `manifest.json` 记录版本、浏览器版本、查询 URL、模式、时间和文件列表，便于追溯。
- 14 张都成功后才复制到正式目录；加载失败、空数据、版本不符或画面未稳定时不会覆盖已有图片。
- 两个根 README 共用同一组文件，在功能说明之后的文末展示全部七种风格的亮暗对照。后续重拍替换同名图片即可，不需要改引用。
- Windows 临时目录位于 `E:\tmp\codex\npm-stat.com-but-modern-ui`；Linux 位于系统临时目录的 `codex/npm-stat.com-but-modern-ui`。只清理本次创建的临时内容，不删除持久档案。

## ✅ 验证脚本迁移

原 `scripts/verify-build.mjs` 已迁移到 `scripts/verify/build.mjs`；原 `scripts/verify-loading.mjs` 已迁移到 `scripts/verify/loading.mjs`。根目录 `test/` 继续保存单元测试。

```powershell
npm run check
npm run verify:build
npm run verify:loading -- --browser-path "C:\Program Files\Google\Chrome\Application\chrome.exe"
```

`check` 包含类型检查、单元测试、构建、版本/元数据验证和生成 JS 的语法检查。`verify:build` 只检查已有产物。`verify:loading` 需要先构建，使用独立临时浏览器验证 28 种布局组合和各加载状态，不要求网站网络，也不使用 Tampermonkey。

## 🔧 常见问题

| 情况 | 处理方式 |
| --- | --- |
| Browser not found | 检查输出的候选列表，用 browser-path 指定实际 exe；确认引号包住空格 |
| Profile is already open / Browser exited | 关闭该专用档案的浏览器，或者使用 setup 输出的 CDP 地址；不要删除浏览器锁文件 |
| CDP 连接失败 | 普通启动的 Chrome 无法直接接管，先用 setup 启动；Chrome 默认日常档案也不适合作为远程调试档案 |
| 缺少版本标识或增强控件 | 检查是不是在正确的专用窗口安装了 Tampermonkey、是否允许脚本运行、脚本是否启用，然后更新最新 JS |
| 版本不匹配 | 构建后手动覆盖 Tampermonkey 里的完整脚本，保存、刷新再试 |
| No publishable charts / 请求超时 | 手动打开测试链接检查 npm-stat 服务和网络；默认最多等图表 180 秒，失败不替换正式截图 |
| 图片一直无法稳定 | 检查网页是否持续显示动画、错误或弹窗；使用 headed 观察，稳定检测最多 20 秒 |
| 扩展模式缺少桌面环境 | 使用有图形桌面的机器进行真实扩展截图；无人值守文档生成优先用默认 inject 模式 |

不要在日常档案上试验自动化，也不要为了迁移扩展直接复制整个 Chrome 档案。配置一次专用档案通常更可靠。
