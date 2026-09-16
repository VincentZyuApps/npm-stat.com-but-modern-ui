// Run after building: node scripts/verify-loading.mjs <chromium.exe> <temporary-project-directory>
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { readFile, mkdir, mkdtemp, rm } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { setTimeout as delay } from 'node:timers/promises';

const [browserPath, temporaryDirectory] = process.argv.slice(2);
if (!browserPath || !temporaryDirectory) throw new Error('Provide Chromium executable and temporary project directory.');
await mkdir(temporaryDirectory, { recursive: true });
const profile = await mkdtemp(join(resolve(temporaryDirectory), 'loading-check-'));
const browser = spawn(browserPath, ['--headless=new', '--no-first-run', '--no-default-browser-check', '--remote-debugging-port=0', `--user-data-dir=${profile}`, 'about:blank'], { windowsHide: true, stdio: 'ignore' });
const exited = new Promise(resolve => browser.once('exit', resolve));
let socket;
let call;
try {
  let port;
  for (let attempt = 0; attempt < 100; attempt++) {
    try { port = (await readFile(join(profile, 'DevToolsActivePort'), 'utf8')).split('\n')[0]; break; } catch { await delay(100); }
  }
  if (!port) throw new Error('Chromium debugging endpoint did not start.');
  const tabs = await (await fetch(`http://127.0.0.1:${port}/json/list`)).json();
  socket = new WebSocket(tabs.find(tab => tab.type === 'page' && tab.url === 'about:blank').webSocketDebuggerUrl);
  await new Promise((resolve, reject) => { socket.onopen = resolve; socket.onerror = reject; });
  let sequence = 0;
  const pending = new Map();
  socket.onmessage = ({ data }) => {
    const response = JSON.parse(data);
    const task = pending.get(response.id);
    if (!task) return;
    pending.delete(response.id);
    clearTimeout(task.timer);
    response.error ? task.reject(new Error(JSON.stringify(response.error))) : task.resolve(response.result);
  };
  call = (method, params = {}) => new Promise((resolve, reject) => {
    const id = ++sequence;
    const timer = setTimeout(() => { pending.delete(id); reject(new Error(`CDP timeout: ${method}`)); }, 15000);
    pending.set(id, { resolve, reject, timer });
    socket.send(JSON.stringify({ id, method, params }));
  });
  const evaluate = async expression => {
    const result = await call('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true });
    if (result.exceptionDetails) throw new Error(JSON.stringify(result.exceptionDetails));
    return result.result.value;
  };
  const bundle = await readFile(new URL('../dist/npm-stat-modern-ui.user.js', import.meta.url), 'utf8');
  const fixture = async loading => {
    await call('Page.navigate', { url: 'about:blank' });
    await delay(100);
    await evaluate(`document.body.innerHTML = '<div id="content"><header><h1>npm-stat</h1></header><section><form id="npm-stat"></form>${loading ? '<p id="loading"></p>' : ''}${['days', 'weeks', 'months', 'years'].map(id => `<figure class="full" id="${id}"></figure>`).join('')}</section></div>'; window.Highcharts = { Chart: function () { throw new Error('Unexpected legacy renderer'); } }; window.testErrors = []; window.addEventListener('error', e => testErrors.push(e.message)); const nativeTimeout = window.setTimeout; window.setTimeout = (fn, ms, ...args) => nativeTimeout(fn, ms === 10000 ? 300 : ms === 15000 ? 600 : ms, ...args);`);
    await evaluate(bundle);
    await delay(60);
  };
  await fixture(false);
  assert.equal(await evaluate(`document.querySelectorAll('.ns-chart-placeholder').length`), 0, 'No query must not spin');
  await fixture(true);
  assert.equal(await evaluate(`document.querySelectorAll('figure[aria-busy="true"]').length`), 4);
  for (const width of [375, 1440]) {
    await call('Emulation.setDeviceMetricsOverride', { width, height: 1000, deviceScaleFactor: 1, mobile: false });
    for (const style of ['original', 'npm', 'vercel', 'fluent', 'material', 'apple', 'github']) {
      for (const theme of ['light', 'dark']) {
        const result = await evaluate(`(() => {
          document.documentElement.dataset.npmStatStyle = '${style}'; document.documentElement.dataset.npmStatTheme = '${theme}';
          const panel = document.querySelector('.ns-chart-placeholder'); const label = panel.querySelector('.ns-placeholder-message');
          const rect = label.getBoundingClientRect(); const bounds = panel.getBoundingClientRect();
          return { fits: rect.left >= bounds.left && rect.right <= bounds.right && rect.bottom <= bounds.bottom, contrast: getComputedStyle(label).color !== getComputedStyle(panel).backgroundColor, height: bounds.height };
        })()`);
        assert.ok(result.fits && result.contrast && result.height > 200, `${style}/${theme}/${width}: ${JSON.stringify(result)}`);
      }
    }
  }
  await delay(320);
  assert.match(await evaluate(`document.querySelector('.ns-placeholder-message').textContent`), /仍在加载/);
  await call('Emulation.setEmulatedMedia', { features: [{ name: 'prefers-reduced-motion', value: 'reduce' }] });
  for (const style of ['original', 'npm', 'vercel', 'fluent', 'material', 'apple', 'github']) {
    assert.equal(await evaluate(`(() => { document.documentElement.dataset.npmStatStyle = '${style}'; const el = document.querySelector('.ns-chart-indicator'); return [el, ...el.querySelectorAll('*')].every(node => getComputedStyle(node).animationName === 'none') && getComputedStyle(el, '::before').animationName === 'none'; })()`), true, `${style}: reduced motion`);
  }
  await evaluate(`document.getElementById('loading').remove(); for (const id of ['days','weeks','months','years']) new Highcharts.Chart({chart:{renderTo:id}, xAxis:{categories:['2026-W01','2026-W02']},series:[{name:'zero downloads',data:[0,0]}]});`);
  await delay(150);
  assert.equal(await evaluate(`document.querySelectorAll('.ns-chart-placeholder').length`), 0, 'Zero downloads render normally');
  assert.equal(await evaluate(`document.querySelectorAll('figure[aria-busy="false"] canvas').length`), 4);
  await evaluate(`new Highcharts.Chart({chart:{renderTo:'days'},series:[]})`);
  assert.equal(await evaluate(`document.querySelector('#days .ns-chart-placeholder').dataset.state`), 'empty');
  assert.deepEqual(await evaluate('testErrors'), []);
  await fixture(true);
  await evaluate(`document.getElementById('loading').outerHTML = '<div style="background: #900">Could not fetch data.</div>'`);
  await delay(50);
  assert.equal(await evaluate(`document.querySelectorAll('[data-state="error"]').length`), 4);
  assert.equal(await evaluate(`document.querySelectorAll('.ns-chart-indicator').length`), 0);
  await fixture(true);
  await evaluate(`document.getElementById('loading').remove()`);
  await delay(700);
  assert.equal(await evaluate(`document.querySelectorAll('[data-state="error"]').length`), 4, 'Missing renderer must not spin forever');
  assert.deepEqual(await evaluate('testErrors'), []);
  console.log('Loading checks passed: 28 appearance/theme/viewport combinations, reduced motion, slow/idle/success/zero/empty/error/missing-renderer states.');
} finally {
  if (call && socket?.readyState === WebSocket.OPEN) await call('Browser.close').catch(() => {});
  socket?.close();
  await Promise.race([exited, delay(3000)]);
  if (browser.exitCode === null) browser.kill();
  await rm(profile, { recursive: true, force: true, maxRetries: 10, retryDelay: 200 });
}
