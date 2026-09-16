# npm-stat Modern UI

This repository builds a Tampermonkey UI enhancement for `https://npm-stat.com/*`.

## Commands

- `npm run build`: create the standalone installable script in `dist/`.
- `npm run typecheck`: run TypeScript validation without emitting files.
- `npm run test`: run chart data and metric aggregation unit tests.
- `npm run check`: type-check, test, build, validate the userscript header, and syntax-check the output.

## Appearance implementation

- `src/styles.css` owns shared layout, responsive rules and accessibility. Seven scoped styles live in `src/styles/{original,npm,vercel,fluent,material,apple,github}.css`.
- Root `data-npm-stat-style` selects appearance independently from `data-npm-stat-theme`. Every style supplies light/dark tokens and an on-accent text color.
- `src/data.ts` handles data; `src/renderer.ts` reads CSS tokens for ECharts and preserves zoom, legend selection and scale during appearance changes. `src/vite.d.ts` supplies Vite declarations.
- Verify all seven styles in light/dark, desktop/narrow widths, long package names, multi-package charts and preference restoration. Original style keeps ECharts and query enhancements.
- Build all CSS into the standalone userscript; do not add CDN styles or hot reload.

## Installation verification

1. Run `npm run build`.
2. Disable or delete any old `npm-stat Modern UI (Development Loader)` script in Tampermonkey.
3. Open a new Tampermonkey script, replace its contents with `dist/npm-stat-modern-ui.user.js`, and save.
4. Refresh `https://npm-stat.com/charts.html?package=koishi-plugin-cs-lookup-vincentzyu-fork`.

There is intentionally no development server, browser profile configuration, or hot reload path. `dist/` is generated and ignored by Git.
