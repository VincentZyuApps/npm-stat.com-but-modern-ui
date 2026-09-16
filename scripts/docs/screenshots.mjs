import { readFile, mkdir, mkdtemp, copyFile, writeFile, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { setTimeout as delay } from 'node:timers/promises';
import { argumentsFor, artifact, build, defaultUrl, openBrowser, root, temporaryRoot } from '../lib/browser.mjs';

const options = argumentsFor({ mode: { type: 'string', default: 'inject' }, url: { type: 'string', default: defaultUrl } });
if (options.help) {
  console.log(`npm run docs:screenshots -- [options]
  --mode inject|extension     Default: inject (isolated, headless, builds latest script)
  --browser-path <executable> Override BROWSER_PATH and automatic browser detection
  --headed                    Show browser in inject mode; extension mode is always visible
  --user-data-dir <directory> Dedicated persistent extension profile (never deleted)
  --cdp-url <http://127.0.0.1:port> Connect to an existing extension browser
  --url <npm-stat charts URL> Default: frontend five packages, 2015-01-01..2026-09-15
Output: docs/images/preview/<light|dark>-<style>.png (14 full-page images, 1440px wide)
Details and first-time manual installation: scripts/docs/readme.md`);
  process.exit(0);
}
if (!['inject', 'extension'].includes(options.mode)) throw new Error('--mode must be inject or extension.');
const extension = options.mode === 'extension';
if (!extension && (options['user-data-dir'] || options['cdp-url'])) throw new Error('inject mode always uses a temporary isolated profile. Use --mode extension for a persistent browser.');
if (extension && !options['user-data-dir'] && !options['cdp-url']) throw new Error('extension mode requires --user-data-dir or --cdp-url. First run npm run docs:setup -- --help.');
const target = new URL(options.url);
if (target.origin !== 'https://npm-stat.com' || target.pathname !== '/charts.html' || !(target.searchParams.has('package') || target.searchParams.has('author'))) throw new Error('--url must be an https://npm-stat.com/charts.html query with package or author.');
for (const [name, value] of Object.entries({ ui_style: 'original', ui_theme: 'light', ui_day_size: '1', ui_week_size: '1', ui_day_mode: 'mean', ui_week_mode: 'mean' })) target.searchParams.set(name, value);
await build();
const { version } = JSON.parse(await readFile(join(root, 'package.json'), 'utf8'));
const environment = await openBrowser(options, { extension });
const { page, context } = environment;
page.setDefaultTimeout(20000);
await mkdir(temporaryRoot, { recursive: true });
const staging = await mkdtemp(join(temporaryRoot, 'screenshots-'));
const styles = ['original', 'npm', 'vercel', 'fluent', 'material', 'apple', 'github'];
const files = [];
const pageErrors = [];
page.on('pageerror', error => pageErrors.push(error.message));
let previousPreferences;

async function waitForCharts() {
  await page.waitForFunction(() => {
    if (document.querySelector('.ns-error, [data-state="error"], [data-state="empty"]')) return true;
    return ['days', 'weeks', 'months', 'years'].every(id => {
      const figure = document.getElementById(id);
      return figure?.getAttribute('aria-busy') === 'false' && figure.querySelector('.ns-echart canvas') && !figure.querySelector('.ns-chart-placeholder');
    });
  }, undefined, { timeout: 180000 });
  const error = page.locator('.ns-error, [data-state="error"], [data-state="empty"]');
  if (await error.count()) throw new Error(`No publishable charts: ${await error.first().innerText()}`);
  await page.waitForFunction(() => document.fonts.status === 'loaded', undefined, { timeout: 20000 });
}

async function stableScreenshot() {
  await page.mouse.move(0, 0);
  await page.evaluate(() => { document.activeElement?.blur(); window.scrollTo(0, 0); });
  let previous;
  let consecutive = 0;
  const deadline = Date.now() + 20000;
  while (Date.now() < deadline) {
    const next = await page.screenshot({ fullPage: true, animations: 'disabled', caret: 'hide', scale: 'css', timeout: 15000 });
    consecutive = previous?.equals(next) ? consecutive + 1 : 0;
    if (consecutive >= 2) return next;
    previous = next;
    await delay(150);
  }
  throw new Error('Chart pixels did not stabilize within 20 seconds. Existing documentation images were kept.');
}

try {
  await page.emulateMedia({ reducedMotion: 'reduce', colorScheme: 'light' });
  const session = await context.newCDPSession(page);
  await session.send('Emulation.setDeviceMetricsOverride', { width: 1440, height: 1000, deviceScaleFactor: 1, mobile: false });
  await session.send('Emulation.setTimezoneOverride', { timezoneId: 'UTC' });
  if (!extension) {
    const source = await readFile(artifact, 'utf8');
    // CDP initialization runs even earlier than Tampermonkey's document-start:
    // ECharts feature detection needs <html>, while our hook must precede DOMContentLoaded.
    await page.addInitScript({ content: `(() => { if (window.top !== window || location.origin !== 'https://npm-stat.com') return; const start = () => {\n${source}\n}; if (document.documentElement) start(); else { const observer = new MutationObserver(() => { if (document.documentElement) { observer.disconnect(); start(); } }); observer.observe(document, { childList: true }); } })();` });
  }
  await page.goto(target.href, { waitUntil: 'domcontentloaded', timeout: 90000 });
  try {
    await page.waitForFunction(() => document.documentElement.dataset.npmStatVersion && document.getElementById('ns-style-select'), undefined, { timeout: 20000 });
  } catch {
    throw new Error(extension ? 'Userscript is missing, disabled, or outdated. Complete the manual installation steps in scripts/docs/readme.md, then retry.' : 'Injected userscript did not initialize. Check website scripts and browser errors.');
  }
  const installedVersion = await page.evaluate(() => document.documentElement.dataset.npmStatVersion);
  if (installedVersion !== version) throw new Error(`Installed userscript version ${installedVersion} does not match ${version}. Reinstall ${artifact}.`);
  previousPreferences = await page.evaluate(() => Object.fromEntries(Object.keys(localStorage).filter(key => key.startsWith('npm-stat-modern-ui-')).map(key => [key, localStorage.getItem(key)])));
  await waitForCharts();
  for (const style of styles) {
    await page.locator('#ns-style-select').selectOption(style);
    for (const theme of ['light', 'dark']) {
      for (let step = 0; step < 3; step++) {
        if (await page.evaluate(theme => document.documentElement.dataset.npmStatThemePreference === theme, theme)) break;
        await page.locator('#ns-theme-toggle').click();
      }
      await page.waitForFunction(({ style, theme }) => document.documentElement.dataset.npmStatStyle === style && document.documentElement.dataset.npmStatTheme === theme, { style, theme });
      await waitForCharts();
      // Date shortcuts sit next to submit on desktop and wrap within the form on phones.
      for (const width of [375, 1440]) {
        await page.setViewportSize({ width, height: 1000 });
        const actionsFit = await page.evaluate(width => {
          const form = document.querySelector('.ns-query-form').getBoundingClientRect();
          const submit = document.querySelector('.ns-query-actions input[type="submit"]').getBoundingClientRect();
          const shortcuts = document.querySelector('.ns-date-shortcuts').getBoundingClientRect();
          const buttons = [...document.querySelectorAll('.ns-date-shortcuts button')];
          return buttons.length === 5 && buttons.every(button => {
            const rect = button.getBoundingClientRect();
            return rect.height >= 38 && rect.width < 46 && rect.left >= form.left && rect.right <= form.right;
          }) && (width < 680 || (shortcuts.left >= submit.right && shortcuts.top < submit.bottom));
        }, width);
        if (!actionsFit) throw new Error(`Date shortcut layout failed in ${style}/${theme}/${width}`);
      }
      const overflow = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth);
      if (overflow) throw new Error(`Horizontal overflow in ${style}/${theme}`);
      const file = `${theme}-${style}.png`;
      await writeFile(join(staging, file), await stableScreenshot());
      files.push(file);
      console.log(`Captured ${file} (${files.length}/14)`);
    }
  }
  if (pageErrors.length) throw new Error(`Page errors: ${pageErrors.join('; ')}`);
  const output = join(root, 'docs/images/preview');
  await mkdir(output, { recursive: true });
  for (const file of files) await copyFile(join(staging, file), join(output, file));
  await writeFile(join(output, 'manifest.json'), JSON.stringify({ version, mode: options.mode, browser: environment.browser.version(), url: target.href, viewport: { width: 1440, height: 1000 }, deviceScaleFactor: 1, fullPage: true, capturedAt: new Date().toISOString(), files }, null, 2) + '\n');
  console.log(`Published 14 screenshots to ${output}. Both READMEs reference these stable filenames.`);
} catch (error) {
  console.error(`Screenshot generation failed: ${error.message}`);
  if (pageErrors.length) console.error(pageErrors.join('\n'));
  process.exitCode = 1;
} finally {
  if (previousPreferences && !page.isClosed()) await page.evaluate(saved => {
    for (const key of Object.keys(localStorage)) if (key.startsWith('npm-stat-modern-ui-')) localStorage.removeItem(key);
    for (const [key, value] of Object.entries(saved)) localStorage.setItem(key, value);
  }, previousPreferences).catch(() => {});
  await environment.close();
  await rm(staging, { recursive: true, force: true });
}
