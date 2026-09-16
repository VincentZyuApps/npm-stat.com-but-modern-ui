export type LegacyPoint = [number, number] | { name?: string; y?: number } | number;

export interface LegacySeries {
  name?: string;
  data?: LegacyPoint[];
}

export interface LegacyChartOptions {
  chart?: { renderTo?: string | HTMLElement; zoomType?: string };
  colors?: string[];
  title?: { text?: string };
  subtitle?: { text?: string };
  xAxis?: { type?: string; categories?: string[]; title?: { text?: string } };
  yAxis?: { title?: { text?: string } };
  series?: LegacySeries[];
}

export interface DownloadMetrics {
  from: number;
  to: number;
  total: number;
  peak: number;
  average: number;
}

export function isDailyChart(options: LegacyChartOptions): boolean {
  return options.xAxis?.type === 'datetime';
}

export function pointValue(point: LegacyPoint): number {
  if (Array.isArray(point)) return Number(point[1]) || 0;
  if (typeof point === 'object') return Number(point.y) || 0;
  return Number(point) || 0;
}

export function normalizeSeriesData(series: LegacySeries, daily: boolean): Array<[number, number]> | number[] {
  const points = series.data || [];
  if (daily) {
    return points
      .filter((point): point is [number, number] => Array.isArray(point) && Number.isFinite(point[0]))
      .map(([timestamp, value]) => [timestamp, Number(value) || 0] as [number, number]);
  }
  return points.map(pointValue);
}

export function calculateDownloadMetrics(series: LegacySeries[]): DownloadMetrics | null {
  const dailyTotals = new Map<number, number>();

  series.forEach((item) => {
    (item.data || []).forEach((point) => {
      if (!Array.isArray(point) || !Number.isFinite(point[0])) return;
      const timestamp = point[0];
      dailyTotals.set(timestamp, (dailyTotals.get(timestamp) || 0) + pointValue(point));
    });
  });

  if (dailyTotals.size === 0) return null;

  const timestamps = [...dailyTotals.keys()].sort((left, right) => left - right);
  const values = [...dailyTotals.values()];
  const total = values.reduce((sum, value) => sum + value, 0);

  return {
    from: timestamps[0],
    to: timestamps[timestamps.length - 1],
    total,
    peak: Math.max(...values),
    average: total / values.length
  };
}

const dayMilliseconds = 86_400_000;
/** Calendar-only UTC keys avoid daylight-saving changes when grouping dates. */
export function calendarDay(timestamp: number): number {
  const date = new Date(timestamp);
  return Date.UTC(date.getFullYear(), date.getMonth(), date.getDate());
}
export function dateLabel(timestamp: number): string { return new Date(timestamp).toISOString().slice(0, 10); }
export function isoWeekLabel(timestamp: number): string {
  const date = new Date(timestamp);
  date.setUTCDate(date.getUTCDate() + 4 - (date.getUTCDay() || 7));
  const year = date.getUTCFullYear();
  const week = Math.ceil(((date.getTime() - Date.UTC(year, 0, 1)) / dayMilliseconds + 1) / 7);
  return `${year}-W${String(week).padStart(2, '0')}`;
}
export function isoWeekStart(label: string): number | null {
  const match = /^(\d{4})-W(\d{2})$/.exec(label);
  if (!match) return null;
  const jan4 = Date.UTC(Number(match[1]), 0, 4);
  const start = jan4 - ((new Date(jan4).getUTCDay() || 7) - 1) * dayMilliseconds + (Number(match[2]) - 1) * 7 * dayMilliseconds;
  return isoWeekLabel(start) === label ? start : null;
}
export function completeCategories(options: LegacyChartOptions): string[] {
  const series = options.series || [];
  const categories = options.xAxis?.categories || [];
  const length = Math.max(categories.length, ...series.map(item => item.data?.length || 0), 0);
  return Array.from({ length }, (_, index) => {
    for (const item of series) {
      const point = item.data?.[index];
      if (point && typeof point === 'object' && !Array.isArray(point) && point.name?.trim()) return point.name;
    }
    return categories[index]?.trim() || '';
  });
}
export interface Bucket {
  start: number;
  end: number;
  first: string;
  last: string;
  count: number;
  partial: boolean;
}
export interface AggregatedSeries { name: string; values: number[]; totals: number[] }
export interface Aggregation { buckets: Bucket[]; series: AggregatedSeries[] }

export function aggregateSeries(options: LegacyChartOptions, unit: 'day' | 'week', size: number, mode: 'mean' | 'sum', coverage?: { from: number; to: number }): Aggregation {
  if (!Number.isInteger(size) || size < 1) throw new Error('Aggregation size must be a positive integer');
  const series = options.series || [];
  const categories = completeCategories(options);
  const step = (unit === 'day' ? 1 : 7) * dayMilliseconds;
  const maps = series.map(() => new Map<number, number>());
  const starts = new Set<number>();
  const anchorIndex = categories.findIndex(label => isoWeekStart(label) !== null);
  const anchor = anchorIndex < 0 ? null : isoWeekStart(categories[anchorIndex]);
  series.forEach((item, seriesIndex) => {
    (item.data || []).forEach((point, index) => {
      let start: number | null = null;
      if (unit === 'day' && Array.isArray(point) && Number.isFinite(point[0])) start = calendarDay(point[0]);
      if (unit === 'week') {
        const label = typeof point === 'object' && !Array.isArray(point) ? point.name : undefined;
        start = isoWeekStart(label || categories[index] || '') ?? (anchor === null ? null : anchor + (index - anchorIndex) * step);
      }
      if (start === null) return;
      starts.add(start);
      maps[seriesIndex].set(start, pointValue(point));
    });
  });
  if (!starts.size) return { buckets: [], series: series.map(item => ({ name: item.name || 'package', values: [], totals: [] })) };
  const sorted = [...starts].sort((a, b) => a - b);
  const units: number[] = [];
  for (let time = sorted[0]; time <= sorted[sorted.length - 1]; time += step) units.push(time);
  const buckets: Bucket[] = [];
  const output = series.map(item => ({ name: item.name || 'package', values: [] as number[], totals: [] as number[] }));
  for (let offset = 0; offset < units.length; offset += size) {
    const group = units.slice(offset, offset + size);
    const start = group[0];
    const last = group[group.length - 1];
    const end = last + step - dayMilliseconds;
    const actualStart = coverage ? Math.max(start, coverage.from) : start;
    const actualEnd = coverage ? Math.min(end, coverage.to) : end;
    buckets.push({ start: actualStart, end: actualEnd,
      first: unit === 'day' ? dateLabel(start) : isoWeekLabel(start),
      last: unit === 'day' ? dateLabel(last) : isoWeekLabel(last),
      count: group.length, partial: actualStart !== start || actualEnd !== end });
    maps.forEach((map, index) => {
      const total = group.reduce((sum, time) => sum + (map.get(time) || 0), 0);
      output[index].totals.push(total);
      output[index].values.push(mode === 'mean' ? total / group.length : total);
    });
  }
  return { buckets, series: output };
}

/** Map the old visible calendar interval to intersecting new groups. */
export function remapZoom(oldBuckets: Bucket[], newBuckets: Bucket[], start: number, end: number): { start: number; end: number } {
  if (!oldBuckets.length || newBuckets.length < 2 || (start === 0 && end === 100)) return { start: 0, end: 100 };
  const left = oldBuckets[Math.floor((oldBuckets.length - 1) * start / 100)].start;
  const right = oldBuckets[Math.ceil((oldBuckets.length - 1) * end / 100)].end;
  const first = Math.max(0, newBuckets.findIndex(bucket => bucket.end >= left));
  let last = newBuckets.findIndex(bucket => bucket.start > right);
  last = last < 0 ? newBuckets.length - 1 : Math.max(first, last - 1);
  return { start: first / (newBuckets.length - 1) * 100, end: last / (newBuckets.length - 1) * 100 };
}
