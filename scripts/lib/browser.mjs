import { spawn } from 'node:child_process';
import { access, mkdir, mkdtemp, readFile, realpath, rm } from 'node:fs/promises';
import { constants } from 'node:fs';
import { delimiter, join, resolve } from 'node:path';
import { tmpdir } from 'node:os';
import { setTimeout as delay } from 'node:timers/promises';
import { parseArgs } from 'node:util';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright-core';

export const root = fileURLToPath(new URL('../../', import.meta.url));
export const artifact = join(root, 'dist/npm-stat-modern-ui.user.js');
export const temporaryRoot = process.platform === 'win32' ? 'E:/tmp/codex/npm-stat.com-but-modern-ui' : join(tmpdir(), 'codex/npm-stat.com-but-modern-ui');
// Browser/Playwright scratch artifacts belong to this project, not the system drive.
await mkdir(temporaryRoot, { recursive: true });
process.env.TMPDIR = temporaryRoot;
process.env.TEMP = temporaryRoot;
process.env.TMP = temporaryRoot;
process.env.NODE_DISABLE_COMPILE_CACHE = '1';
export const defaultUrl = 'https://npm-stat.com/charts.html?package=react&package=vue&package=svelte&package=preact&package=%40angular%2Fcore&from=2015-01-01&to=2026-09-15';

export function argumentsFor(extra = {}) {
  const { values } = parseArgs({ options: {
    'browser-path': { type: 'string' }, 'user-data-dir': { type: 'string' },
    'cdp-url': { type: 'string' }, headed: { type: 'boolean', default: false }, help: { type: 'boolean', default: false }, ...extra
  } });
  if (values['cdp-url'] && (values['browser-path'] || values['user-data-dir'])) throw new Error('--cdp-url cannot be combined with --browser-path or --user-data-dir.');
  if (values['cdp-url']) {
    const url = new URL(values['cdp-url']);
    if (!['http:', 'https:'].includes(url.protocol) || !['localhost', '127.0.0.1', '[::1]'].includes(url.hostname)) throw new Error('--cdp-url must be a loopback HTTP(S) endpoint.');
  }
  return values;
}

export async function findBrowser(explicit) {
  const configured = explicit || process.env.BROWSER_PATH;
  const candidates = configured ? [configured] : process.platform === 'win32' ? [
    join(process.env.ProgramFiles || 'C:/Program Files', 'Google/Chrome/Application/chrome.exe'),
    join(process.env['ProgramFiles(x86)'] || 'C:/Program Files (x86)', 'Microsoft/Edge/Application/msedge.exe')
  ] : ['/usr/bin/google-chrome', '/usr/bin/chromium', '/usr/bin/microsoft-edge'];
  if (!configured) {
    const names = process.platform === 'win32' ? ['chrome.exe', 'chromium.exe', 'msedge.exe'] : ['google-chrome', 'chromium', 'chromium-browser', 'microsoft-edge'];
    for (const path of (process.env.PATH || '').split(delimiter).filter(Boolean)) for (const name of names) candidates.push(join(path, name));
  }
  for (const path of candidates) {
    try { await access(path, process.platform === 'win32' ? constants.F_OK : constants.X_OK); return resolve(path); } catch { /* Try next candidate. */ }
  }
  throw new Error(`Browser not found. Use --browser-path <executable>. Checked:\n${candidates.join('\n')}`);
}

export function runNode(script, args = []) {
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, [script, ...args], { cwd: root, stdio: 'inherit', windowsHide: true });
    child.once('error', reject);
    child.once('exit', code => code === 0 ? resolve() : reject(new Error(`${script} exited with ${code}`)));
  });
}

export async function build() {
  await runNode(join(root, 'node_modules/vite/bin/vite.js'), ['build']);
  await runNode(join(root, 'scripts/verify/build.mjs'));
  await runNode('--check', [artifact]);
}

async function dedicatedProfile(path) {
  const profile = resolve(path);
  // Never enable automation on the normal personal browser profile.
  const normalized = profile.replaceAll('\\', '/').toLowerCase();
  if (/\/(google\/chrome|microsoft\/edge)\/user data(?:\/|$)|\/\.config\/(google-chrome|chromium|microsoft-edge)(?:\/|$)/.test(normalized)) {
    throw new Error('Use a dedicated --user-data-dir, not your everyday browser profile.');
  }
  await mkdir(profile, { recursive: true });
  const canonical = (await realpath(profile)).replaceAll('\\', '/').toLowerCase();
  if (canonical !== normalized && /\/(google\/chrome|microsoft\/edge)\/user data(?:\/|$)|\/\.config\/(google-chrome|chromium|microsoft-edge)(?:\/|$)/.test(canonical)) throw new Error('Profile resolves to a personal browser directory.');
  return profile;
}

async function profileEndpoint(profile) {
  const [port, browserPath] = (await readFile(join(profile, 'DevToolsActivePort'), 'utf8')).trim().split(/\r?\n/);
  if (!/^\d+$/.test(port) || !browserPath?.startsWith('/devtools/browser/')) return null;
  const endpoint = `http://127.0.0.1:${port}`;
  const response = await fetch(`${endpoint}/json/version`, { signal: AbortSignal.timeout(500) });
  if (!response.ok) return null;
  const info = await response.json();
  // A stale port file must not attach us to an unrelated browser that reused its port.
  return info.webSocketDebuggerUrl && new URL(info.webSocketDebuggerUrl).pathname === browserPath ? endpoint : null;
}

/** Native launch keeps extensions enabled; Playwright attaches via CDP. */
export async function launch(options, { persistent = false, setup = false } = {}) {
  if (persistent && !options['user-data-dir']) throw new Error('Extension mode requires --user-data-dir <dedicated-profile> or --cdp-url <endpoint>.');
  const executable = await findBrowser(options['browser-path']);
  await mkdir(temporaryRoot, { recursive: true });
  const profile = persistent ? await dedicatedProfile(options['user-data-dir']) : await mkdtemp(join(temporaryRoot, 'browser-'));
  if (persistent) {
    try {
      const endpoint = await profileEndpoint(profile);
      if (endpoint) throw new Error(`Profile is already open. Connect using --cdp-url ${endpoint}`);
    } catch (error) { if (error.message.startsWith('Profile is already open')) throw error; }
  }
  const child = spawn(executable, [
    `--user-data-dir=${profile}`, '--remote-debugging-port=0', '--remote-debugging-address=127.0.0.1',
    '--no-first-run', '--no-default-browser-check', '--window-size=1440,1000',
    ...(!persistent && !options.headed ? ['--headless=new'] : []),
    ...(!persistent ? ['--disable-extensions'] : []),
    ...(setup ? ['https://chromewebstore.google.com/detail/tampermonkey/dhdgffkkebhmkfjojejmpbldmpobfkfo', defaultUrl] : ['about:blank'])
  ], { detached: setup, stdio: 'ignore', windowsHide: !persistent && !options.headed });
  let spawnError;
  child.once('error', error => { spawnError = error; });
  let endpoint;
  try {
    for (let attempt = 0; attempt < 150; attempt++) {
      if (spawnError) throw spawnError;
      // On Windows the launcher may exit after handing off to a browser child.
      // Readiness is the actual CDP endpoint, not the launcher's exit status.
      try {
        endpoint = await profileEndpoint(profile);
        if (endpoint) break;
      } catch { /* Chromium has not bound the debugging port yet. */ }
      await delay(100);
    }
    if (!endpoint) throw new Error('Browser debugging endpoint did not become ready. The profile may already be in use; close it or connect with --cdp-url.');
  } catch (error) {
    child.kill();
    if (!persistent) await rm(profile, { recursive: true, force: true, maxRetries: 10, retryDelay: 200 });
    throw error;
  }
  if (setup) child.unref();
  return { endpoint, child, profile, persistent };
}

export async function openBrowser(options, { extension = false } = {}) {
  const owned = options['cdp-url'] ? null : await launch(options, { persistent: extension });
  let browser;
  let page;
  const scratch = await mkdtemp(join(temporaryRoot, 'automation-'));
  const close = async () => {
    if (page && !page.isClosed()) await page.close().catch(() => {});
    if (owned && browser?.isConnected()) {
      const session = await browser.newBrowserCDPSession();
      await session.send('Browser.close').catch(() => {});
    }
    // For connectOverCDP, close disconnects the transport, not the external browser.
    await browser?.close().catch(() => {});
    await rm(scratch, { recursive: true, force: true, maxRetries: 10, retryDelay: 200 });
    if (owned) {
      for (let i = 0; i < 30 && owned.child.exitCode === null; i++) await delay(100);
      if (owned.child.exitCode === null) owned.child.kill();
      if (!owned.persistent) await rm(owned.profile, { recursive: true, force: true, maxRetries: 10, retryDelay: 200 });
    }
  };
  try {
    browser = await chromium.connectOverCDP(options['cdp-url'] || owned.endpoint, { timeout: 15000, artifactsDir: scratch, noDefaults: true });
    const context = browser.contexts()[0];
    page = await context.newPage();
    await page.setViewportSize({ width: 1440, height: 1000 });
    return { browser, context, page, close };
  } catch (error) { await close(); throw error; }
}
