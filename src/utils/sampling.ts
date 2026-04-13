import type { QuizRecord } from '../types';
import { getChartContext } from './stats';

export type BucketKey = string;

function weightForCount(count: number): number {
  return 1 / (count + 1);
}

export function pickStratifiedBucket<T extends BucketKey>(
  buckets: T[],
  counts: Map<T, number>,
  rng: () => number = Math.random,
): T | null {
  if (buckets.length === 0) return null;
  const weights = buckets.map(b => weightForCount(counts.get(b) ?? 0));
  const total = weights.reduce((a, b) => a + b, 0);
  const target = rng() * total;
  let acc = 0;
  for (let i = 0; i < buckets.length; i++) {
    acc += weights[i];
    if (target < acc) return buckets[i];
  }
  return buckets[buckets.length - 1];
}

export function computeBucketCounts(records: QuizRecord[]): Map<string, number> {
  const counts = new Map<string, number>();
  for (const r of records) {
    const ctx = getChartContext(r.question.chartName);
    let kind: 'open-range' | 'facing' | null = null;
    if (ctx === 'rfi') kind = 'open-range';
    else if (ctx === 'facing-rfi') kind = 'facing';
    if (!kind) continue;
    const key = `${r.question.stackSize}|${kind}`;
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }
  return counts;
}
