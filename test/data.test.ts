import assert from 'node:assert/strict';
import test from 'node:test';
import { calculateDownloadMetrics, normalizeSeriesData } from '../src/data.ts';

test('aggregates daily downloads from compared packages', () => {
  const metrics = calculateDownloadMetrics([
    { name: 'alpha', data: [[1_700_000_000_000, 10], [1_700_086_400_000, 20]] },
    { name: 'beta', data: [[1_700_000_000_000, 5], [1_700_086_400_000, 0]] }
  ]);

  assert.deepEqual(metrics, {
    from: 1_700_000_000_000,
    to: 1_700_086_400_000,
    total: 35,
    peak: 20,
    average: 17.5
  });
});

test('keeps zero-download days when calculating metrics', () => {
  const metrics = calculateDownloadMetrics([
    { data: [[1_700_000_000_000, 0], [1_700_086_400_000, 0]] }
  ]);

  assert.equal(metrics?.total, 0);
  assert.equal(metrics?.peak, 0);
  assert.equal(metrics?.average, 0);
});

test('normalizes category points from the legacy Highcharts format', () => {
  assert.deepEqual(normalizeSeriesData({ data: [{ name: '2026-W01', y: 12 }, { name: '2026-W02', y: 8 }] }, false), [12, 8]);
});
