export const sizes = [1, 2, 3, 4, 5, 10, 25, 50] as const;
export const appearances = { original: 'Original npm-stat', npm: 'npm', vercel: 'Vercel', fluent: 'Fluent', material: 'Material 3', apple: 'Apple', github: 'GitHub' };
export type Appearance = keyof typeof appearances;
export type ThemePreference = 'system' | 'light' | 'dark';
export type AggregationMode = 'mean' | 'sum';
export interface Preferences {
  style: Appearance;
  theme: ThemePreference;
  daySize: number;
  dayMode: AggregationMode;
  weekSize: number;
  weekMode: AggregationMode;
}
export const defaults: Preferences = { style: 'npm', theme: 'system', daySize: 1, dayMode: 'mean', weekSize: 1, weekMode: 'mean' };
const params: Record<keyof Preferences, string> = {
  style: 'ui_style', theme: 'ui_theme', daySize: 'ui_day_size', dayMode: 'ui_day_mode', weekSize: 'ui_week_size', weekMode: 'ui_week_mode'
};
const storageKeys: Record<keyof Preferences, string> = {
  style: 'npm-stat-modern-ui-style', theme: 'npm-stat-modern-ui-theme',
  daySize: 'npm-stat-modern-ui-day-size', dayMode: 'npm-stat-modern-ui-day-mode',
  weekSize: 'npm-stat-modern-ui-week-size', weekMode: 'npm-stat-modern-ui-week-mode'
};
type StorageReader = Pick<Storage, 'getItem'>;
function valid(key: keyof Preferences, value: string | null): boolean {
  if (value === null) return false;
  if (key === 'style') return Object.prototype.hasOwnProperty.call(appearances, value);
  if (key === 'theme') return ['system', 'light', 'dark'].includes(value);
  if (key.endsWith('Size')) return sizes.some(size => String(size) === value);
  return value === 'mean' || value === 'sum';
}
export function resolvePreferences(url: URL, storage: StorageReader): Preferences {
  const result = { ...defaults };
  for (const key of Object.keys(params) as Array<keyof Preferences>) {
    const incoming = url.searchParams.get(params[key]);
    let saved: string | null = null;
    try { saved = storage.getItem(storageKeys[key]); } catch { /* Private browsing may restrict storage. */ }
    const value = valid(key, incoming) ? incoming : valid(key, saved) ? saved : String(defaults[key]);
    Object.assign(result, { [key]: key.endsWith('Size') ? Number(value) : value });
  }
  return result;
}
export function preferencesUrl(url: URL, preferences: Preferences): URL {
  const result = new URL(url);
  for (const key of Object.keys(params) as Array<keyof Preferences>) result.searchParams.set(params[key], String(preferences[key]));
  return result;
}
export function savePreference<K extends keyof Preferences>(preferences: Preferences, key: K, value: Preferences[K], storage: Pick<Storage, 'setItem'>): void {
  if (!valid(key, String(value))) return;
  preferences[key] = value;
  try { storage.setItem(storageKeys[key], String(value)); } catch { /* Keep session settings usable. */ }
}
let current: Preferences = { ...defaults };
const browserStorage = {
  getItem: (key: string) => window.localStorage.getItem(key),
  setItem: (key: string, value: string) => window.localStorage.setItem(key, value)
};
export function initializePreferences(): void {
  current = resolvePreferences(new URL(window.location.href), browserStorage);
  syncPreferencesUrl();
}
export function getPreferences(): Preferences { return { ...current }; }
export function syncPreferencesUrl(): void {
  const url = preferencesUrl(new URL(window.location.href), current);
  if (url.href !== window.location.href) window.history.replaceState(window.history.state, '', url);
}
export function setPreference<K extends keyof Preferences>(key: K, value: Preferences[K]): void {
  savePreference(current, key, value, browserStorage);
  syncPreferencesUrl();
}

/** Mirrors the original form's package/author defaults without losing UI parameters. */
export function queryUrl(currentUrl: URL, kind: 'package' | 'author', name: string, from: string, to: string, preferences: Preferences): URL {
  const url = new URL(currentUrl);
  url.pathname = '/charts.html';
  for (const key of ['package', 'author', 'from', 'to']) url.searchParams.delete(key);
  if (kind === 'package') {
    const names = name.split(',').map(value => value.trim()).filter(Boolean);
    for (const value of names.length ? names : ['clone']) url.searchParams.append('package', value);
  } else url.searchParams.set('author', name.trim() || 'pvorb');
  if (from) url.searchParams.set('from', from);
  if (to) url.searchParams.set('to', to);
  return preferencesUrl(url, preferences);
}
