import assert from 'node:assert/strict';
import test from 'node:test';
import { aggregateSeries, completeCategories, isoWeekLabel, isoWeekStart, remapZoom } from '../src/data.ts';

const localDay = (day: number) => new Date(2026, 0, day).getTime();
test('daily grouping aligns packages, includes zeros, and preserves totals', () => {
  const options = { series: [
    { name: 'a', data: [[localDay(1), 10], [localDay(2), 0], [localDay(3), 20], [localDay(4), 10], [localDay(5), 5]] as [number, number][] },
    { name: 'b', data: [[localDay(1), 2], [localDay(3), 4], [localDay(5), 6]] as [number, number][] }
  ] };
  const mean = aggregateSeries(options, 'day', 2, 'mean');
  assert.deepEqual(mean.series[0].values, [5, 15, 5]);
  assert.deepEqual(mean.series[1].values, [1, 2, 6]);
  assert.deepEqual(mean.buckets.map(bucket => bucket.count), [2, 2, 1]);
  const sum = aggregateSeries(options, 'day', 2, 'sum');
  assert.equal(sum.series[0].values.reduce((a, b) => a + b, 0), 45);
  assert.deepEqual(aggregateSeries(options, 'day', 50, 'mean').series[0].values, [9]);
  assert.equal(options.series[0].data.length, 5);
});

test('all eight sizes support five aligned packages without changing their sums', () => {
  const options = { series: Array.from({ length: 5 }, (_, p) => ({ name: String(p), data: Array.from({ length: 123 }, (_, day) => [localDay(day + 1), day * p] as [number, number]) })) };
  for (const size of [1, 2, 3, 4, 5, 10, 25, 50]) {
    const result = aggregateSeries(options, 'day', size, 'sum');
    assert.equal(result.buckets.length, Math.ceil(123 / size));
    result.series.forEach((series, index) => assert.equal(series.values.reduce((a, b) => a + b, 0), 7503 * index));
  }
});

test('ISO week names survive sparse labels and year boundaries', () => {
  assert.equal(isoWeekLabel(Date.UTC(2021, 0, 1)), '2020-W53');
  assert.equal(isoWeekStart('2020-W53'), Date.UTC(2020, 11, 28));
  assert.equal(isoWeekStart('2021-W53'), null);
  const options = { xAxis: { categories: ['2020-W53', ' ', ' '] }, series: [{ data: [
    { name: '2020-W53', y: 30 }, { name: '2021-W01', y: 70 }, { name: '2021-W02', y: 20 }
  ] }] };
  assert.deepEqual(completeCategories(options), ['2020-W53', '2021-W01', '2021-W02']);
  const result = aggregateSeries(options, 'week', 2, 'mean', { from: Date.UTC(2021, 0, 1), to: Date.UTC(2021, 0, 12) });
  assert.deepEqual(result.series[0].values, [50, 20]);
  assert.deepEqual(result.buckets.map(bucket => bucket.partial), [true, true]);
  assert.equal(result.buckets[0].start, Date.UTC(2021, 0, 1));
  assert.equal(result.buckets[1].end, Date.UTC(2021, 0, 12));
  assert.equal(result.buckets[0].first, '2020-W53');
  assert.equal(result.buckets[0].last, '2021-W01');
});

test('zero-only data and empty data remain valid', () => {
  assert.equal(aggregateSeries({ series: [{ data: [[localDay(1), 0], [localDay(2), 0]] }] }, 'day', 5, 'mean').series[0].values[0], 0);
  assert.deepEqual(aggregateSeries({}, 'week', 50, 'sum').buckets, []);
});

test('regrouping keeps the visible calendar interval covered', () => {
  const options = { series: [{ data: Array.from({ length: 100 }, (_, i) => [localDay(i + 1), i] as [number, number]) }] };
  const oldBuckets = aggregateSeries(options, 'day', 1, 'sum').buckets;
  const newBuckets = aggregateSeries(options, 'day', 10, 'sum').buckets;
  const range = remapZoom(oldBuckets, newBuckets, 20, 70);
  const first = Math.round(range.start / 100 * (newBuckets.length - 1));
  const last = Math.round(range.end / 100 * (newBuckets.length - 1));
  assert.ok(newBuckets[first].start <= oldBuckets[19].start);
  assert.ok(newBuckets[last].end >= oldBuckets[70].end);
  assert.deepEqual(remapZoom(oldBuckets, newBuckets, 0, 100), { start: 0, end: 100 });
});
