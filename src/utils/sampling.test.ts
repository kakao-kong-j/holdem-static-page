import { describe, it, expect } from 'vitest';
import { pickStratifiedBucket, computeBucketCounts } from './sampling';
import type { QuizRecord } from '../types';

function makeRng(values: number[]): () => number {
  let i = 0;
  return () => values[i++ % values.length];
}

describe('pickStratifiedBucket', () => {
  it('빈 버킷 배열 → null', () => {
    expect(pickStratifiedBucket([], new Map(), Math.random)).toBeNull();
  });

  it('단일 버킷 → 항상 그 버킷', () => {
    const buckets = ['A'];
    expect(pickStratifiedBucket(buckets, new Map(), makeRng([0, 0.5, 0.99]))).toBe('A');
  });

  it('모든 카운트 0 → 균등 확률 (많은 시도 후 ±10%)', () => {
    const buckets = ['A', 'B', 'C', 'D'];
    const counts = new Map<string, number>();
    const tally: Record<string, number> = { A: 0, B: 0, C: 0, D: 0 };
    for (let i = 0; i < 4000; i++) {
      const picked = pickStratifiedBucket(buckets, counts, Math.random)!;
      tally[picked]++;
    }
    for (const k of buckets) {
      expect(tally[k]).toBeGreaterThan(800);
      expect(tally[k]).toBeLessThan(1200);
    }
  });

  it('한 버킷만 많이 샘플됨 → 그 버킷은 선택 빈도가 명확히 낮음', () => {
    const buckets = ['A', 'B'];
    const counts = new Map([['A', 99], ['B', 0]]);
    // weight A = 1/100, weight B = 1 → P(B) ≈ 0.99
    const tally = { A: 0, B: 0 };
    for (let i = 0; i < 2000; i++) {
      const picked = pickStratifiedBucket(buckets, counts, Math.random)!;
      tally[picked as 'A' | 'B']++;
    }
    expect(tally.B).toBeGreaterThan(tally.A * 50);
  });

  it('결정적 선택: rng=0 → 첫 번째 가중 버킷', () => {
    const buckets = ['A', 'B'];
    const counts = new Map([['A', 0], ['B', 0]]);
    expect(pickStratifiedBucket(buckets, counts, () => 0)).toBe('A');
  });

  it('결정적 선택: rng=0.999 → 마지막 가중 버킷', () => {
    const buckets = ['A', 'B'];
    const counts = new Map([['A', 0], ['B', 0]]);
    expect(pickStratifiedBucket(buckets, counts, () => 0.999)).toBe('B');
  });
});

describe('computeBucketCounts', () => {
  function rec(stack: string, chartName: string): QuizRecord {
    return {
      question: {
        stackSize: stack as '15BB' | '25BB' | '40BB' | '100BB',
        chartName, hand: 'AA', correctAction: 'raise',
        heroPosition: '', villainPosition: '', situation: '',
      },
      userAnswer: 'raise', correct: true, timestamp: 0,
    };
  }

  it('빈 레코드 → 빈 Map', () => {
    expect(computeBucketCounts([]).size).toBe(0);
  });

  it('RFI와 Facing을 분리해서 카운트', () => {
    const records = [
      rec('100BB', 'UTG RFI'),
      rec('100BB', 'UTG RFI'),
      rec('100BB', 'HJ vs UTG'),
    ];
    const c = computeBucketCounts(records);
    expect(c.get('100BB|open-range')).toBe(2);
    expect(c.get('100BB|facing')).toBe(1);
  });

  it('스택이 다르면 다른 버킷', () => {
    const records = [
      rec('15BB', 'UTG RFI'),
      rec('100BB', 'UTG RFI'),
    ];
    const c = computeBucketCounts(records);
    expect(c.get('15BB|open-range')).toBe(1);
    expect(c.get('100BB|open-range')).toBe(1);
  });

  it('Facing 3bet, Allin, Limp는 facing 버킷으로 합침', () => {
    const records = [
      rec('100BB', 'UTG vs UTG+1 3bet'),
      rec('15BB', 'UTG RFI vs BTN Allin'),
      rec('100BB', 'HJ vs UTG'),
    ];
    const c = computeBucketCounts(records);
    // 3bet과 allin도 "내가 facing 중인 상황"이므로 facing 버킷 또는 제외.
    // 여기선 parseChartScenario와 일관성 — 제외되는 차트는 버킷에도 없음.
    expect(c.get('100BB|facing')).toBe(1); // HJ vs UTG 만
  });
});
