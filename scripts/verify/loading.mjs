// Run after building: npm run verify:loading -- --browser-path <chromium.exe>
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { setTimeout as delay } from 'node:timers/promises';
import { argumentsFor, artifact, openBrowser } from '../lib/browser.mjs';

const options = argumentsFor();
if (options.help) {
  console.log('npm run verify:loading -- [--browser-path <executable>] [--headed]');
  process.exit(0);
}
if (options['user-data-dir'] || options['cdp-url']) throw new Error('Loading verification uses an isolated temporary profile.');
const environment = await openBrowser(options);
try {
  const session = await environment.context.newCDPSession(environment.page);
  const call = (method, params = {}) => session.send(method, params);
  const evaluate = async expression => {
    const result = await call('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true });
    if (result.exceptionDetails) throw new Error(JSON.stringify(result.exceptionDetails));
    return result.result.value;
  };
  const bundle = await readFile(artifact, 'utf8');
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
  await environment.close();
}
