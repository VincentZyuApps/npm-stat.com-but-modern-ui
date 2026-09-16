# npm-stat Modern UI

This repository builds a Tampermonkey UI enhancement for `https://npm-stat.com/*`.

## Commands

- `npm run build`: create the standalone installable script in `dist/`.
- `npm run typecheck`: run TypeScript validation without emitting files.
- `npm run test`: run chart data and metric aggregation unit tests.
- `npm run check`: type-check, test, build, validate the userscript header, and syntax-check the output.
- After building, `node scripts/verify-loading.mjs <chromium.exe> <temporary-project-directory>` verifies loading states and all seven appearances in a disposable headless profile. Use the project's directory under `E:\tmp\codex`; the script removes only its own profile.

## Appearance implementation

- `src/styles.css` owns shared layout, responsive rules and accessibility. Seven scoped styles live in `src/styles/{original,npm,vercel,fluent,material,apple,github}.css`.
- Root `data-npm-stat-style` selects appearance independently from `data-npm-stat-theme`. Every style supplies light/dark tokens and an on-accent text color.
- `src/data.ts` handles data; `src/renderer.ts` reads CSS tokens for ECharts and preserves zoom, legend selection and scale during appearance changes. `src/vite.d.ts` supplies Vite declarations.
- Verify all seven styles in light/dark, desktop/narrow widths, long package names, multi-package charts and preference restoration. Original style keeps ECharts and query enhancements.
- Build all CSS into the standalone userscript; do not add CDN styles or hot reload.
- `src/loading.ts` observes the upstream shared request marker and coordinates per-chart placeholders with the renderer's first paint. Keep loading, rendering, empty and error states distinct; zero downloads are valid data. Never interpret marker removal alone as request failure. Animation rules belong to each appearance CSS; shared layout and reduced-motion overrides belong to `src/styles.css`.
- `src/preferences.ts` owns validation, URL serialization and local preference storage. Valid URL values override memory per field without writing to it; only explicitly changed fields are saved. Preserve repeated package parameters when updating URLs.
- Daily/weekly grouping uses shared calendar boundaries from the full query, never the visible zoom window. Means include zero periods and divide by actual group length. Summary metrics remain based on original daily data. Preserve ISO week-year labels and flag clipped weeks.
- Verify all eight grouping sizes, mean/total independence, nine buttons per chart, zero-value log behavior, preserved zoom/legend, URL propagation on query submission, and shared-link/local-memory isolation. Check 375px, desktop and >2500px layouts.

## Installation verification

1. Run `npm run build`.
2. Disable or delete any old `npm-stat Modern UI (Development Loader)` script in Tampermonkey.
3. Open a new Tampermonkey script, replace its contents with `dist/npm-stat-modern-ui.user.js`, and save.
4. Refresh `https://npm-stat.com/charts.html?package=koishi-plugin-cs-lookup-vincentzyu-fork`.

There is intentionally no development server, browser profile configuration, or hot reload path. `dist/` is generated and ignored by Git.
