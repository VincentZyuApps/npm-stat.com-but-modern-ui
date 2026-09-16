# npm-stat Modern UI

A Tampermonkey userscript that modernizes the npm-stat.com query and chart pages.

## Build

```powershell
npm install
npm run build
```

The standalone userscript is generated at:

```text
dist/npm-stat-modern-ui.user.js
```

`dist/` is generated locally and is not committed.

## Local Installation

1. In Tampermonkey, disable or delete `npm-stat Modern UI (Development Loader)` if it was installed previously.
2. Create a new userscript in Tampermonkey.
3. Replace its contents with the complete contents of `dist/npm-stat-modern-ui.user.js`, then save.
4. Refresh `https://npm-stat.com/charts.html?package=koishi-plugin-cs-lookup-vincentzyu-fork`.

## Validation

```powershell
npm run check
```

This runs TypeScript validation, chart data tests, produces the userscript, verifies its metadata, and syntax-checks the result.
# Seven appearance styles

Use the top-right dropdown to choose Original npm-stat, npm, Vercel, Fluent, Material 3, Apple (iOS/macOS), or GitHub. The adjacent emoji button independently cycles system/light/dark. Both preferences persist; npm is the default style. Switching preserves form inputs, chart zoom, legend selection and the daily chart scale without fetching data again.

Original restores a simpler presentation while retaining ECharts and query enhancements. Shared layout lives in `src/styles.css`; each appearance has its own light/dark CSS in `src/styles/`. All styles are bundled locally into the userscript. Data and chart logic live in `src/data.ts` and `src/renderer.ts`; Vite types live in `src/vite.d.ts`.
