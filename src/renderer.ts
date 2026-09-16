import * as echarts from 'echarts/core';
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
  type DownloadMetrics,
  type LegacyChartOptions
} from './data';

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

function buildOption(
  id: string,
  legacy: LegacyChartOptions,
  theme: ResolvedTheme,
  scale: ChartScale = 'linear'
): EChartsCoreOption {
  const daily = isDailyChart(legacy);
  const tokens = chartTokens(theme);
  const series = legacy.series || [];
  const categories = legacy.xAxis?.categories || [];
  const hasLegend = series.length > 1;
  const dailyChart = id === 'days' && daily;
  const weeklyChart = id === 'weeks';
  const hasZoomControl = dailyChart || (weeklyChart && categories.length > 26);

  return {
    animationDuration: 240,
    color: colorsFor(theme),
    textStyle: { fontFamily: tokens.font },
    title: {
      text: legacy.title?.text || 'Downloads',
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
      valueFormatter: (value: unknown) => numberFormatter.format(Number(value) || 0)
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
      top: hasLegend ? 70 : 54,
      right: 24,
      bottom: hasZoomControl ? 64 : 34,
      left: 68,
      containLabel: false
    },
    xAxis: daily
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
      min: scale === 'log' ? 1 : 0,
      logBase: scale === 'log' ? 10 : undefined,
      name: legacy.yAxis?.title?.text || 'Downloads',
      nameTextStyle: { color: tokens.muted, fontSize: 11, fontWeight: 600 },
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
    series: series.map((item) => ({
      name: item.name || 'package',
      type: 'line',
      smooth: false,
      showSymbol: false,
      symbol: 'circle',
      symbolSize: 6,
      lineStyle: { width: 2.5 },
      emphasis: { focus: 'series', scale: true, lineStyle: { width: 3 } },
      data: normalizeSeriesData(item, daily)
    }))
  };
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

  figure.classList.add('ns-chart');
  figure.replaceChildren();
  const host = document.createElement('div');
  host.className = 'ns-echart';
  figure.append(host);

  const chart = echarts.init(host, undefined, { renderer: 'canvas' });
  const resizeObserver = new ResizeObserver(() => chart.resize());
  resizeObserver.observe(figure);
  const scale = existing?.scale || 'linear';
  chartRecords.set(id, { chart, options, resizeObserver, scale });
  chart.setOption(buildOption(id, options, getTheme(), scale), true);

  if (id === 'days') {
    const metrics = calculateDownloadMetrics(options.series || []);
    if (metrics) renderMetrics(metrics);
    installScaleControl(figure);
  }
}

export function installChartRenderer(themeResolver: () => ResolvedTheme): void {
  getTheme = themeResolver;
  const highcharts = (window as Window & { Highcharts?: { Chart?: LegacyChartConstructor; __npmStatEchartsHook?: boolean } }).Highcharts;
  if (!highcharts?.Chart || highcharts.__npmStatEchartsHook) return;

  const originalChart = highcharts.Chart;
  function ModernChart(options: LegacyChartOptions, callback?: unknown): unknown {
    const id = targetId(options?.chart?.renderTo);
    if (!chartIds.has(id)) return Reflect.construct(originalChart, [options, callback]);
    renderChart(id, options);
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

function updateChart(record: ChartRecord, id: string, theme: ResolvedTheme): void {
  const previous = record.chart.getOption() as {
    dataZoom?: Array<{ start?: number; end?: number }>;
    legend?: Array<{ selected?: Record<string, boolean> }>;
  };
  const option = buildOption(id, record.options, theme, record.scale);
  if (Array.isArray(option.dataZoom)) {
    option.dataZoom.forEach((zoom, index) => Object.assign(zoom, {
      start: previous.dataZoom?.[index]?.start ?? 0,
      end: previous.dataZoom?.[index]?.end ?? 100
    }));
  }
  Object.assign(option.legend as object, { selected: previous.legend?.[0]?.selected || {} });
  record.chart.setOption(option, true);
}
