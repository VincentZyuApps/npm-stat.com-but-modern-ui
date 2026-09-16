import * as echarts from 'echarts/core';
import { chartState } from './loading';
import { LineChart } from 'echarts/charts';
import {
  DataZoomComponent,
  GridComponent,
  LegendComponent,
  TitleComponent,
  TooltipComponent
} from 'echarts/components';
import { CanvasRenderer } from 'echarts/renderers';
import type { ECharts, EChartsCoreOption } from 'echarts/core';
import {
  calculateDownloadMetrics,
  isDailyChart,
  normalizeSeriesData,
  aggregateSeries, calendarDay, completeCategories, dateLabel, remapZoom,
  type Aggregation, type Bucket,
  type DownloadMetrics,
  type LegacyChartOptions
} from './data';
import { getPreferences, setPreference, sizes } from './preferences';

echarts.use([
  LineChart,
  DataZoomComponent,
  GridComponent,
  LegendComponent,
  TitleComponent,
  TooltipComponent,
  CanvasRenderer
]);

export type ResolvedTheme = 'light' | 'dark';
type ChartScale = 'linear' | 'log';

interface ChartRecord {
  chart: ECharts;
  options: LegacyChartOptions;
  resizeObserver: ResizeObserver;
  scale: ChartScale;
  buckets: Bucket[];
}

type LegacyChartConstructor = new (options: LegacyChartOptions, callback?: unknown) => unknown;

const chartIds = new Set(['days', 'weeks', 'months', 'years']);
const chartRecords = new Map<string, ChartRecord>();
const numberFormatter = new Intl.NumberFormat('en-US');
const compactNumberFormatter = new Intl.NumberFormat('en-US', {
  notation: 'compact',
  maximumFractionDigits: 1
});

let getTheme: () => ResolvedTheme = () => 'light';

function colorsFor(theme: ResolvedTheme): string[] {
  const accent = getComputedStyle(document.documentElement).getPropertyValue('--ns-accent').trim();
  return theme === 'dark'
    ? [accent, '#f6c85f', '#56d4cb', '#db8fff', '#a4b3ff']
    : [accent, '#986000', '#008078', '#ad288c', '#514fc4'];
}

function chartTokens(theme: ResolvedTheme) {
  const style = getComputedStyle(document.documentElement);
  const token = (name: string) => style.getPropertyValue(`--ns-${name}`).trim();
  return {
    text: token('text'),
    muted: token('muted'),
    grid: token('line'),
    tooltip: token('surface'),
    tooltipBorder: token('line'),
    subtle: token('surface-subtle'),
    font: token('font'),
    filler: colorsFor(theme)[0] + '33'
  };
}

function formatRangeDate(timestamp: number): string {
  const date = new Date(timestamp);
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function targetId(renderTo: unknown): string {
  if (typeof renderTo === 'string') return renderTo;
  if (renderTo instanceof HTMLElement) return renderTo.id;
  return '';
}

function aggregationFor(id: string, options: LegacyChartOptions): Aggregation | null {
  if (id !== 'days' && id !== 'weeks') return null;
  const preferences = getPreferences();
  const daily = id === 'days';
  const metrics = calculateDownloadMetrics(chartRecords.get('days')?.options.series || []);
  const coverage = metrics ? { from: calendarDay(metrics.from), to: calendarDay(metrics.to) } : undefined;
  return aggregateSeries(options, daily ? 'day' : 'week', daily ? preferences.daySize : preferences.weekSize,
    daily ? preferences.dayMode : preferences.weekMode, coverage);
}

function aggregationTooltip(aggregation: Aggregation, unit: string, size: number, mode: string, raw: unknown): HTMLElement {
  const entries = (Array.isArray(raw) ? raw : [raw]) as Array<{ dataIndex: number; seriesIndex: number; color?: string }>;
  const index = entries[0]?.dataIndex;
  const bucket = aggregation.buckets[index];
  const box = document.createElement('div');
  box.style.cssText = 'max-width:min(420px,80vw);white-space:normal;overflow-wrap:anywhere;line-height:1.6';
  if (!bucket) return box;
  const heading = document.createElement('strong');
  const weekLabel = (label: string) => `${label}（第 ${Number(label.slice(-2))} 周）`;
  heading.textContent = unit === 'week'
    ? `${weekLabel(bucket.first)}${bucket.first === bucket.last ? '' : ' → ' + weekLabel(bucket.last)}`
    : `${dateLabel(bucket.start)}${bucket.start === bucket.end ? '' : ' → ' + dateLabel(bucket.end)}`;
  box.append(heading);
  const detail = document.createElement('div');
  detail.textContent = `${unit === 'week' ? dateLabel(bucket.start) + ' → ' + dateLabel(bucket.end) + ' · ' : ''}${bucket.count}/${size} ${unit === 'day' ? '天' : '周'}${bucket.partial ? ' · 含不完整周' : ''} · ${mode === 'mean' ? '均值' : '总量'}`;
  box.append(detail);
  for (const entry of entries) {
    const series = aggregation.series[entry.seriesIndex];
    if (!series) continue;
    const row = document.createElement('div');
    const marker = document.createElement('span');
    marker.textContent = '● ';
    marker.style.color = entry.color || 'currentColor';
    row.append(marker, `${series.name}: ${new Intl.NumberFormat('en-US', { maximumFractionDigits: 2 }).format(series.values[index])} · 总量 ${numberFormatter.format(series.totals[index])}`);
    box.append(row);
  }
  return box;
}

function buildOption(
  id: string,
  legacy: LegacyChartOptions,
  theme: ResolvedTheme,
  scale: ChartScale = 'linear'
): EChartsCoreOption {
  const daily = isDailyChart(legacy);
  const tokens = chartTokens(theme);
  const series = legacy.series || [];
  const originalCategories = completeCategories(legacy);
  const aggregation = aggregationFor(id, legacy);
  const preferences = getPreferences();
  const size = id === 'days' ? preferences.daySize : preferences.weekSize;
  const mode = id === 'days' ? preferences.dayMode : preferences.weekMode;
  const unit = id === 'days' ? 'day' : 'week';
  const categories = aggregation ? aggregation.buckets.map(bucket => bucket.first) : originalCategories;
  const hasLegend = series.length > 1;
  const dailyChart = id === 'days' && daily;
  const weeklyChart = id === 'weeks';
  const hasZoomControl = dailyChart || (weeklyChart && originalCategories.length > 26);

  return {
    animationDuration: 240,
    color: colorsFor(theme),
    textStyle: { fontFamily: tokens.font },
    title: {
      text: aggregation ? `Downloads · ${size} ${unit}${size > 1 ? 's' : ''} · ${mode === 'mean' ? 'mean' : 'total'}` : legacy.title?.text || 'Downloads',
      left: 0,
      top: 0,
      textStyle: { color: tokens.text, fontSize: 16, fontWeight: 700 }
    },
    tooltip: {
      trigger: 'axis',
      appendToBody: true,
      backgroundColor: tokens.tooltip,
      borderColor: tokens.tooltipBorder,
      borderWidth: 1,
      padding: [10, 12],
      textStyle: { color: tokens.text, fontSize: 12 },
      valueFormatter: (value: unknown) => numberFormatter.format(Number(value) || 0),
      ...(aggregation ? { formatter: (params: unknown) => aggregationTooltip(aggregation, unit, size, mode, params) } : {})
    },
    legend: {
      type: 'scroll',
      show: hasLegend,
      top: 28,
      left: 0,
      right: 0,
      itemWidth: 10,
      itemHeight: 10,
      icon: 'circle',
      textStyle: { color: tokens.muted, fontSize: 12 },
      data: series.map((item) => item.name || 'package')
    },
    grid: {
      // Separate rows for the title, legend and y-axis name, including narrow charts.
      top: hasLegend ? 96 : 64,
      right: 24,
      bottom: hasZoomControl ? 64 : 34,
      left: 68,
      containLabel: false
    },
    xAxis: daily && !aggregation
      ? {
          type: 'time',
          name: legacy.xAxis?.title?.text || '',
          nameLocation: 'middle',
          nameGap: dailyChart ? 42 : 30,
          nameTextStyle: { color: tokens.muted, fontSize: 11, fontWeight: 600 },
          axisLine: { lineStyle: { color: tokens.grid } },
          axisTick: { show: false },
          splitLine: { show: false },
          axisLabel: {
            color: tokens.muted,
            fontSize: 11,
            hideOverlap: true,
            formatter: (value: number) => new Intl.DateTimeFormat('en-US', { month: 'short', year: '2-digit' }).format(value)
          }
        }
      : {
          type: 'category',
          boundaryGap: false,
          data: categories,
          name: legacy.xAxis?.title?.text || '',
          nameLocation: 'middle',
          nameGap: hasZoomControl ? 42 : 28,
          nameTextStyle: { color: tokens.muted, fontSize: 11, fontWeight: 600 },
          axisLine: { lineStyle: { color: tokens.grid } },
          axisTick: { show: false },
          axisLabel: { color: tokens.muted, fontSize: 10, hideOverlap: true, interval: 'auto' }
        },
    yAxis: {
      type: scale === 'log' ? 'log' : 'value',
      min: scale === 'log' ? undefined : 0,
      logBase: scale === 'log' ? 10 : undefined,
      name: aggregation ? mode === 'mean' ? `Downloads / ${unit}` : 'Downloads / group'
        : id === 'months' ? 'Downloads / month' : id === 'years' ? 'Downloads / year' : legacy.yAxis?.title?.text || 'Downloads',
      nameGap: 18,
      nameTextStyle: { color: tokens.muted, fontSize: 11, fontWeight: 600, align: 'left', padding: [0, 0, 0, -64] },
      axisLabel: {
        color: tokens.muted,
        fontSize: 10,
        formatter: (value: number) => compactNumberFormatter.format(value)
      },
      axisLine: { show: false },
      axisTick: { show: false },
      splitLine: { lineStyle: { color: tokens.grid, type: 'dashed' } }
    },
    dataZoom: hasZoomControl
      ? [
          { type: 'inside', zoomOnMouseWheel: true, moveOnMouseMove: true },
          {
            type: 'slider',
            height: 18,
            bottom: 14,
            borderColor: tokens.grid,
            backgroundColor: tokens.subtle,
            fillerColor: tokens.filler,
            handleStyle: { color: colorsFor(theme)[0], borderColor: colorsFor(theme)[0] },
            textStyle: { color: tokens.muted }
          }
        ]
      : [],
    series: series.map((item, index) => ({
      name: item.name || 'package',
      type: 'line',
      smooth: false,
      showSymbol: aggregation?.buckets.length === 1,
      symbol: 'circle',
      symbolSize: 6,
      lineStyle: { width: 1 },
      emphasis: { focus: 'series', scale: true, lineStyle: { width: 1.5 } },
      data: aggregation ? aggregation.series[index].values.map(value => scale === 'log' && value <= 0 ? null : value) : normalizeSeriesData(item, daily)
    }))
  };
}

function installAggregationControl(figure: HTMLElement): void {
  const id = figure.id;
  if (document.getElementById(`${id}-aggregation`)) return;
  const daily = id === 'days';
  const toolbar = document.createElement('div');
  toolbar.id = `${id}-aggregation`;
  toolbar.className = 'ns-chart-toolbar ns-aggregation';
  toolbar.setAttribute('role', 'group');
  toolbar.setAttribute('aria-label', daily ? 'Daily aggregation' : 'Weekly aggregation');
  const sizeKey = daily ? 'daySize' : 'weekSize';
  const modeKey = daily ? 'dayMode' : 'weekMode';
  const refresh = () => {
    const preferences = getPreferences();
    toolbar.querySelectorAll<HTMLButtonElement>('button[data-size]').forEach(button => {
      const active = Number(button.dataset.size) === preferences[sizeKey];
      button.classList.toggle('is-active', active);
      button.setAttribute('aria-pressed', String(active));
    });
    const modeButton = toolbar.querySelector<HTMLButtonElement>('button[data-mode]')!;
    modeButton.textContent = `${preferences[modeKey] === 'mean' ? '均值' : '总量'} ⇄`;
    modeButton.setAttribute('aria-label', `当前${preferences[modeKey] === 'mean' ? '均值，切换为总量' : '总量，切换为均值'}`);
  };
  for (const size of sizes) {
    const button = document.createElement('button');
    button.type = 'button';
    button.dataset.size = String(size);
    button.textContent = `${size}${daily ? '天' : '周'}`;
    button.addEventListener('click', () => {
      const record = chartRecords.get(id);
      if (!record) return;
      setPreference(sizeKey, size);
      updateChart(record, id, getTheme(), true);
      refresh();
    });
    toolbar.append(button);
  }
  const modeButton = document.createElement('button');
  modeButton.type = 'button';
  modeButton.dataset.mode = '';
  modeButton.addEventListener('click', () => {
    setPreference(modeKey, getPreferences()[modeKey] === 'mean' ? 'sum' : 'mean');
    const record = chartRecords.get(id);
    if (record) updateChart(record, id, getTheme());
    refresh();
  });
  toolbar.append(modeButton);
  refresh();
  figure.before(toolbar);
}

function installScaleControl(figure: HTMLElement): void {
  const toolbarId = `${figure.id}-scale-control`;
  let toolbar = document.getElementById(toolbarId);
  if (toolbar) return;

  toolbar = document.createElement('div');
  toolbar.id = toolbarId;
  toolbar.className = 'ns-chart-toolbar';
  toolbar.setAttribute('role', 'group');
  toolbar.setAttribute('aria-label', 'Daily chart scale');

  const label = document.createElement('span');
  label.textContent = 'Scale';
  toolbar.append(label);

  (['linear', 'log'] as const).forEach((scale) => {
    const button = document.createElement('button');
    button.type = 'button';
    button.dataset.scale = scale;
    button.textContent = scale === 'linear' ? 'Linear' : 'Log';
    button.title = scale === 'linear' ? 'Use a linear downloads scale' : 'Use a logarithmic downloads scale';
    button.addEventListener('click', () => {
      const record = chartRecords.get(figure.id);
      if (!record || record.scale === scale) return;

      record.scale = scale;
      updateChart(record, figure.id, getTheme());
      toolbar?.querySelectorAll<HTMLButtonElement>('button').forEach((item) => {
        const selected = item.dataset.scale === scale;
        item.classList.toggle('is-active', selected);
        item.setAttribute('aria-pressed', String(selected));
      });
    });
    button.classList.toggle('is-active', scale === 'linear');
    button.setAttribute('aria-pressed', String(scale === 'linear'));
    toolbar.append(button);
  });

  figure.before(toolbar);
  const note = document.createElement('p');
  note.className = 'ns-log-note';
  note.id = `${figure.id}-log-note`;
  note.textContent = '对数轴不绘制零值；切回 Linear 查看零下载。';
  note.hidden = true;
  toolbar.after(note);
}

function createMetric(label: string, value: string, detail?: string): HTMLElement {
  const item = document.createElement('div');
  item.className = 'ns-metric';
  const labelElement = document.createElement('span');
  labelElement.className = 'ns-metric-label';
  labelElement.textContent = label;
  const valueElement = document.createElement('strong');
  valueElement.textContent = value;
  item.append(labelElement, valueElement);
  if (detail) {
    const detailElement = document.createElement('small');
    detailElement.textContent = detail;
    item.append(detailElement);
  }
  return item;
}

function renderMetrics(metrics: DownloadMetrics): void {
  let container = document.querySelector<HTMLElement>('#ns-download-metrics');
  if (!container) {
    container = document.createElement('section');
    container.id = 'ns-download-metrics';
    container.className = 'ns-metrics';
    document.getElementById('days')?.before(container);
  }

  container.replaceChildren(
    createMetric('Range', `${formatRangeDate(metrics.from)} → ${formatRangeDate(metrics.to)}`),
    createMetric('Downloads', numberFormatter.format(metrics.total)),
    createMetric('Peak day', numberFormatter.format(metrics.peak)),
    createMetric('Daily average', numberFormatter.format(Math.round(metrics.average)))
  );
}

function renderChart(id: string, options: LegacyChartOptions): void {
  const figure = document.getElementById(id);
  if (!figure) return;

  const existing = chartRecords.get(id);
  existing?.resizeObserver.disconnect();
  existing?.chart.dispose();
  chartRecords.delete(id);

  figure.classList.add('ns-chart');
  figure.replaceChildren();
  chartState(figure, 'ready');
  if (!(options.series || []).some(series => normalizeSeriesData(series, isDailyChart(options)).length > 0)) {
    chartState(figure, 'empty');
    return;
  }
  chartState(figure, 'rendering');
  const host = document.createElement('div');
  host.className = 'ns-echart';
  figure.append(host);

  const chart = echarts.init(host, undefined, { renderer: 'canvas' });
  const onRendered = () => {
    chart.off('rendered', onRendered);
    chartState(figure, 'ready');
  };
  chart.on('rendered', onRendered);
  const resizeObserver = new ResizeObserver(() => chart.resize());
  resizeObserver.observe(figure);
  const scale = existing?.scale || 'linear';
  chartRecords.set(id, { chart, options, resizeObserver, scale, buckets: [] });
  chart.setOption(buildOption(id, options, getTheme(), scale), true);
  chartRecords.get(id)!.buckets = aggregationFor(id, options)?.buckets || [];

  if (id === 'days') {
    const metrics = calculateDownloadMetrics(options.series || []);
    if (metrics) renderMetrics(metrics);
    installScaleControl(figure);
  }
  if (id === 'days' || id === 'weeks') installAggregationControl(figure);
}

export function installChartRenderer(themeResolver: () => ResolvedTheme): void {
  getTheme = themeResolver;
  const highcharts = (window as Window & { Highcharts?: { Chart?: LegacyChartConstructor; __npmStatEchartsHook?: boolean } }).Highcharts;
  if (!highcharts?.Chart || highcharts.__npmStatEchartsHook) return;

  const originalChart = highcharts.Chart;
  function ModernChart(options: LegacyChartOptions, callback?: unknown): unknown {
    const id = targetId(options?.chart?.renderTo);
    if (!chartIds.has(id)) return Reflect.construct(originalChart, [options, callback]);
    try {
      renderChart(id, options);
    } catch (error) {
      const figure = document.getElementById(id);
      if (figure) chartState(figure, 'error');
      console.error('[npm-stat Modern UI] Chart rendering failed:', error);
    }
    return undefined;
  }

  ModernChart.prototype = originalChart.prototype;
  highcharts.Chart = ModernChart as unknown as LegacyChartConstructor;
  highcharts.__npmStatEchartsHook = true;
}

export function refreshRenderedCharts(theme: ResolvedTheme): void {
  chartRecords.forEach((record, id) => {
    updateChart(record, id, theme);
    record.chart.resize();
  });
}

function updateChart(record: ChartRecord, id: string, theme: ResolvedTheme, regroup = false): void {
  const previous = record.chart.getOption() as {
    dataZoom?: Array<{ start?: number; end?: number }>;
    legend?: Array<{ selected?: Record<string, boolean> }>;
  };
  const option = buildOption(id, record.options, theme, record.scale);
  const newBuckets = aggregationFor(id, record.options)?.buckets || [];
  const start = previous.dataZoom?.[0]?.start ?? 0;
  const end = previous.dataZoom?.[0]?.end ?? 100;
  const zoomRange = regroup ? remapZoom(record.buckets, newBuckets, start, end) : { start, end };
  if (Array.isArray(option.dataZoom)) {
    option.dataZoom.forEach(zoom => Object.assign(zoom, zoomRange));
  }
  Object.assign(option.legend as object, { selected: previous.legend?.[0]?.selected || {} });
  record.chart.setOption(option, true);
  record.buckets = newBuckets;
  const note = document.getElementById(`${id}-log-note`);
  if (note) note.hidden = record.scale !== 'log';
}
