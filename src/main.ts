import styles from './styles.css?raw';
import { version } from '../package.json';
import { syncChartLoading } from './loading';
import { installChartRenderer, refreshRenderedCharts, type ResolvedTheme } from './renderer';
import original from './styles/original.css?raw';
import npm from './styles/npm.css?raw';
import vercel from './styles/vercel.css?raw';
import fluent from './styles/fluent.css?raw';
import material from './styles/material.css?raw';
import apple from './styles/apple.css?raw';
import github from './styles/github.css?raw';
import { appearances, initializePreferences, getPreferences, setPreference, preferencesUrl, queryUrl, type Appearance, type ThemePreference } from './preferences';

initializePreferences();
const systemThemeQuery = window.matchMedia('(prefers-color-scheme: dark)');
let currentPreference: ThemePreference = getPreferences().theme;

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
  setPreference('theme', preference);
  applyTheme();
}

function applyTheme(): void {
  const theme = resolvedTheme();
  document.documentElement.dataset.npmStatTheme = theme;
  document.documentElement.dataset.npmStatStyle = getPreferences().style;
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
  select.value = getPreferences().style;
  select.addEventListener('change', () => {
    setPreference('style', select.value as Appearance);
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
  container.setAttribute('role', 'group');
  container.setAttribute('aria-label', 'Date range shortcuts');
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

  const submit = form.querySelector<HTMLInputElement>('input[type="submit"]');
  if (submit) {
    if (submit.value.trim().toLowerCase() === 'show charts') submit.value = '📊 Show charts';
    const cell = submit.closest('td');
    if (cell) {
      cell.colSpan = 2;
      cell.classList.add('ns-query-actions-cell');
    }
    const actions = document.createElement('div');
    actions.className = 'ns-query-actions';
    submit.before(actions);
    actions.append(submit, container);
  } else {
    form.append(container);
  }
}

function enhanceDynamicContent(): void {
  syncChartLoading();
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
    form.addEventListener('submit', (event) => {
      event.preventDefault();
      event.stopImmediatePropagation();
      const kind = form.querySelector<HTMLSelectElement>('#nameType')?.value === 'author' ? 'author' : 'package';
      const value = (id: string) => form.querySelector<HTMLInputElement>(id)?.value || '';
      window.location.assign(queryUrl(new URL(window.location.href), kind, value('#name'), value('#from'), value('#to'), getPreferences()).href);
    }, true);
  }

  if (window.location.pathname.endsWith('/charts.html')) document.body.classList.add('ns-chart-page');
  enhanceDynamicContent();

  const observer = new MutationObserver(enhanceDynamicContent);
  observer.observe(content, { childList: true, subtree: true });

  // Update generated query links without replacing the original destination or click behavior.
  const carryPreferences = (event: Event) => {
    const link = event.target instanceof Element ? event.target.closest<HTMLAnchorElement>('a[href]') : null;
    if (!link) return;
    const url = new URL(link.href);
    if (url.origin === window.location.origin && url.pathname === '/charts.html') link.href = preferencesUrl(url, getPreferences()).href;
  };
  document.addEventListener('click', carryPreferences, true);
  document.addEventListener('auxclick', carryPreferences, true);
  document.addEventListener('contextmenu', carryPreferences, true);
}

function boot(): void {
  injectStyles();
  applyTheme();

  const initializePage = () => {
    applyTheme();
    decoratePage();
    document.documentElement.dataset.npmStatVersion = version;
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
