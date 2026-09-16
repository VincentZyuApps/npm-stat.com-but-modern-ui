# npm-stat Modern UI

This repository builds a Tampermonkey UI enhancement for `https://npm-stat.com/*`.

## Commands

- `npm run build`: create the standalone installable script in `dist/`.
- `npm run typecheck`: run TypeScript validation without emitting files.
- `npm run test`: run chart data and metric aggregation unit tests.
- `npm run check`: type-check, test, build, validate the userscript header, and syntax-check the output.
- `npm run verify:build` validates the existing userscript in `dist/`; `npm run verify:loading -- --browser-path <executable>` verifies loading states and all seven appearances after a build.
- `npm run docs:screenshots` builds and captures 14 real-page screenshots using an isolated browser and injection. `npm run docs:setup -- --user-data-dir <dedicated-profile>` opens a persistent browser for manual Tampermonkey installation. See `scripts/docs/readme.md` for both modes, parameters and the user's required installation steps.
- Automation uses `scripts/lib/browser.mjs` and `playwright-core` with the user's installed browser. Never copy or automate the default personal profile. Connected browsers keep their existing tabs and stay open; only owned temporary profiles are removed. Persistent extension profiles are retained.
- Keep the English and Chinese root READMEs structurally aligned with equal line counts. Both reference the same `docs/images/preview/` PNGs. Publish screenshots only after all 14 captures succeed; do not substitute fake data for failed real queries.

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

There is intentionally no development server or hot reload path. `dist/` is generated and ignored by Git. Browser paths and persistent profiles are supplied through CLI arguments; temporary automation artifacts use `E:\tmp\codex\npm-stat.com-but-modern-ui` on Windows or a project subdirectory of the system temporary directory on Linux.
