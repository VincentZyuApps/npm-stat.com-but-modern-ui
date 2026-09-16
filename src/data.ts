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
