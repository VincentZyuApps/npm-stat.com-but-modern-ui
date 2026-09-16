import styles from './styles.css?raw';
import { installChartRenderer, refreshRenderedCharts, type ResolvedTheme } from './renderer';
import original from './styles/original.css?raw';
import npm from './styles/npm.css?raw';
import vercel from './styles/vercel.css?raw';
import fluent from './styles/fluent.css?raw';
import material from './styles/material.css?raw';
import apple from './styles/apple.css?raw';
import github from './styles/github.css?raw';

const appearances = { original: 'Original npm-stat', npm: 'npm', vercel: 'Vercel', fluent: 'Fluent', material: 'Material 3', apple: 'Apple', github: 'GitHub' };
type Appearance = keyof typeof appearances;
const appearanceKey = 'npm-stat-modern-ui-style';
const savedAppearance = window.localStorage.getItem(appearanceKey);
let appearance: Appearance = savedAppearance && Object.prototype.hasOwnProperty.call(appearances, savedAppearance) ? savedAppearance as Appearance : 'npm';

type ThemePreference = 'system' | 'light' | 'dark';

const themeStorageKey = 'npm-stat-modern-ui-theme';
const systemThemeQuery = window.matchMedia('(prefers-color-scheme: dark)');
let currentPreference: ThemePreference = readThemePreference();

function readThemePreference(): ThemePreference {
  const saved = window.localStorage.getItem(themeStorageKey);
  return saved === 'light' || saved === 'dark' || saved === 'system' ? saved : 'system';
}

function resolvedTheme(preference = currentPreference): ResolvedTheme {
  return preference === 'system' ? (systemThemeQuery.matches ? 'dark' : 'light') : preference;
}

function injectStyles(): void {
  if (document.getElementById('npm-stat-modern-ui-styles')) return;

  const style = document.createElement('style');
  style.id = 'npm-stat-modern-ui-styles';
  style.textContent = [styles, original, npm, vercel, fluent, material, apple, github].join('\n');
  (document.head || document.documentElement).append(style);
}

function setTheme(preference: ThemePreference): void {
  currentPreference = preference;
  window.localStorage.setItem(themeStorageKey, preference);
  applyTheme();
}

function applyTheme(): void {
  const theme = resolvedTheme();
  document.documentElement.dataset.npmStatTheme = theme;
  document.documentElement.dataset.npmStatStyle = appearance;
  document.documentElement.dataset.npmStatThemePreference = currentPreference;
  updateThemeButton();
  refreshRenderedCharts(theme);
}

function updateThemeButton(): void {
  const button = document.querySelector<HTMLButtonElement>('#ns-theme-toggle');
  if (!button) return;

  const labels: Record<ThemePreference, string> = {
    system: '🖥️',
    light: '☀️',
    dark: '🌙'
  };
  const descriptions: Record<ThemePreference, string> = {
    system: 'Theme: follow system',
    light: 'Theme: light',
    dark: 'Theme: dark'
  };

  button.textContent = labels[currentPreference];
  button.title = descriptions[currentPreference];
  button.setAttribute('aria-label', descriptions[currentPreference]);
}

function installThemeToggle(topbar: HTMLElement): void {
  if (document.getElementById('ns-theme-toggle')) return;

  const button = document.createElement('button');
  button.id = 'ns-theme-toggle';
  button.type = 'button';
  button.addEventListener('click', () => {
    const cycle: ThemePreference[] = ['system', 'light', 'dark'];
    setTheme(cycle[(cycle.indexOf(currentPreference) + 1) % cycle.length]);
  });
  const controls = document.createElement('div');
  controls.className = 'ns-appearance';
  const select = document.createElement('select');
  select.id = 'ns-style-select';
  select.setAttribute('aria-label', 'UI style');
  for (const [value, label] of Object.entries(appearances)) {
    select.add(new Option(label, value));
  }
  select.value = appearance;
  select.addEventListener('change', () => {
    appearance = select.value as Appearance;
    window.localStorage.setItem(appearanceKey, appearance);
    applyTheme();
  });
  controls.append(select, button);
  topbar.append(controls);
  updateThemeButton();
}

function addDateShortcuts(form: HTMLFormElement): void {
  if (form.querySelector('.ns-date-shortcuts')) return;

  const container = document.createElement('div');
  container.className = 'ns-date-shortcuts';
  const shortcuts: Array<[string, number]> = [
    ['7D', 7],
    ['30D', 30],
    ['90D', 90],
    ['1Y', 365],
    ['2Y', 730]
  ];

  shortcuts.forEach(([label, days]) => {
    const button = document.createElement('button');
    button.type = 'button';
    button.textContent = label;
    button.title = `Set date range to the previous ${days} days`;
    button.addEventListener('click', () => {
      const to = new Date();
      to.setDate(to.getDate() - 1);
      const from = new Date(to);
      from.setDate(from.getDate() - days + 1);
      const asInputDate = (date: Date) => date.toISOString().slice(0, 10);
      const fromInput = form.querySelector<HTMLInputElement>('#from');
      const toInput = form.querySelector<HTMLInputElement>('#to');
      if (fromInput) fromInput.value = asInputDate(from);
      if (toInput) toInput.value = asInputDate(to);
    });
    container.append(button);
  });

  const toField = form.querySelector<HTMLInputElement>('#to');
  const toCell = toField?.closest('td');
  if (toCell) {
    toCell.append(container);
  } else {
    form.append(container);
  }
}

function enhanceDynamicContent(): void {
  document.querySelectorAll<HTMLElement>('figure.full').forEach((figure) => figure.classList.add('ns-chart'));
  document.querySelectorAll<HTMLTableElement>('table.alternating').forEach((table) => table.classList.add('ns-results-table'));
  document.querySelectorAll<HTMLElement>('#loading').forEach((element) => element.classList.add('ns-loading'));

  const summary = document.querySelector<HTMLElement>('#pkgs ~ p');
  if (summary?.textContent?.includes('Total number of downloads')) summary.classList.add('ns-results-summary');

  document.querySelectorAll<HTMLElement>('div[style*="background: #900"]').forEach((element) => {
    element.classList.add('ns-error');
  });
}

function decoratePage(): void {
  const content = document.querySelector<HTMLElement>('#content');
  const originalHeader = content?.querySelector<HTMLElement>(':scope > header');
  if (!content || !originalHeader) return;

  document.body.classList.add('ns-modern');
  content.classList.add('ns-shell');
  installChartRenderer(resolvedTheme);

  let topbar = document.querySelector<HTMLElement>('.ns-topbar');
  if (!topbar) {
    topbar = document.createElement('div');
    topbar.className = 'ns-topbar';
    document.body.prepend(topbar);
    topbar.append(originalHeader);
  }
  installThemeToggle(topbar);

  const main = content.querySelector<HTMLElement>(':scope > section');
  main?.classList.add('ns-main');
  const form = document.querySelector<HTMLFormElement>('#npm-stat');
  if (form) {
    form.classList.add('ns-query-form');
    form.querySelector('table')?.classList.add('ns-query-table');
    addDateShortcuts(form);
  }

  if (window.location.pathname.endsWith('/charts.html')) document.body.classList.add('ns-chart-page');
  enhanceDynamicContent();

  const observer = new MutationObserver(enhanceDynamicContent);
  observer.observe(content, { childList: true, subtree: true });
}

function boot(): void {
  injectStyles();
  applyTheme();

  const initializePage = () => {
    applyTheme();
    decoratePage();
  };

  // Tampermonkey can execute a userscript after the initial document event.
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initializePage, { once: true });
  } else {
    initializePage();
  }
}

systemThemeQuery.addEventListener('change', () => {
  if (currentPreference === 'system') applyTheme();
});

boot();
