import assert from 'node:assert/strict';
import test from 'node:test';
import { defaults, resolvePreferences, preferencesUrl, savePreference, queryUrl } from '../src/preferences.ts';

test('URL overrides memory without writing; invalid values fall back per field', () => {
  const values = new Map([['npm-stat-modern-ui-style', 'apple'], ['npm-stat-modern-ui-day-size', '5']]);
  const storage = { getItem: (key: string) => values.get(key) || null, setItem: (key: string, value: string) => { values.set(key, value); } };
  const prefs = resolvePreferences(new URL('https://npm-stat.com/?ui_style=github&ui_day_size=oops&ui_week_mode=sum'), storage);
  assert.equal(prefs.style, 'github');
  assert.equal(prefs.daySize, 5);
  assert.equal(prefs.weekMode, 'sum');
  assert.equal(prefs.theme, 'system');
  assert.equal(values.get('npm-stat-modern-ui-style'), 'apple');
  savePreference(prefs, 'daySize', 50, storage);
  assert.equal(values.get('npm-stat-modern-ui-day-size'), '50');
  assert.equal(values.get('npm-stat-modern-ui-style'), 'apple');
  assert.equal(values.has('npm-stat-modern-ui-week-mode'), false);
});

test('share URL retains repeated packages, dates, unrelated parameters and hash', () => {
  const url = new URL('https://npm-stat.com/charts.html?package=a&package=b&from=2015-01-01&other=x#weeks');
  const shared = preferencesUrl(url, { ...defaults, daySize: 25, theme: 'dark' });
  assert.deepEqual(shared.searchParams.getAll('package'), ['a', 'b']);
  assert.equal(shared.searchParams.get('from'), '2015-01-01');
  assert.equal(shared.searchParams.get('other'), 'x');
  assert.equal(shared.hash, '#weeks');
  assert.equal(shared.searchParams.get('ui_day_size'), '25');
  assert.equal(url.searchParams.has('ui_style'), false);
  assert.deepEqual(resolvePreferences(shared, { getItem: () => null }), { ...defaults, daySize: 25, theme: 'dark' });
});

test('query submission retains UI settings and switches package/author cleanly', () => {
  const current = new URL('https://npm-stat.com/charts.html?author=old&package=old&from=2020-01-01');
  const prefs = { ...defaults, weekSize: 50 };
  const url = queryUrl(current, 'package', ' lodash, , @scope/name ', '2015-01-01', '2026-09-15', prefs);
  assert.deepEqual(url.searchParams.getAll('package'), ['lodash', '@scope/name']);
  assert.equal(url.searchParams.has('author'), false);
  assert.equal(url.searchParams.get('ui_week_size'), '50');
  assert.equal(queryUrl(url, 'author', '', '', '', prefs).searchParams.get('author'), 'pvorb');
  assert.equal(queryUrl(url, 'author', 'me', '', '', prefs).searchParams.has('package'), false);
  assert.equal(queryUrl(url, 'package', ' , ', '', '', prefs).searchParams.get('package'), 'clone');
});

test('restricted storage and malformed values fall back safely', () => {
  assert.deepEqual(resolvePreferences(new URL('https://npm-stat.com/?ui_style=__proto__&ui_day_size=0&ui_theme=no&ui_day_mode=bad'), { getItem() { throw Error('blocked'); } }), defaults);
});
