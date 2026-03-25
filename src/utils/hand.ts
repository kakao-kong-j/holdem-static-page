import { RANKS, POSITIONS } from '../constants';
import type { ChartData, StackData } from '../types';

export function getHandName(ri: number, ci: number): string {
  if (ri === ci) return `${RANKS[ri]}${RANKS[ri]}`;
  if (ci > ri) return `${RANKS[ri]}${RANKS[ci]}s`;
  return `${RANKS[ci]}${RANKS[ri]}o`;
}

export function getCombos(ri: number, ci: number): number {
  if (ri === ci) return 6;
  if (ci > ri) return 4;
  return 12;
}

export function getHandCombos(hand: string): number {
  if (hand.length === 2) return 6; // pair
  if (hand.endsWith('s')) return 4;
  return 12;
}

export function buildHandAction(chartData: ChartData): Record<string, string> {
  const result: Record<string, string> = {};
  for (const [action, hands] of Object.entries(chartData)) {
    for (const hand of hands) {
      result[hand] = action;
    }
  }
  return result;
}

export function forEachHand(fn: (hand: string, combos: number) => void): void {
  for (let ri = 0; ri < 13; ri++) {
    for (let ci = 0; ci < 13; ci++) {
      fn(getHandName(ri, ci), getCombos(ri, ci));
    }
  }
}

export function buildOpenRangeData(stackData: StackData): Record<string, string> {
  const result: Record<string, string> = {};

  for (const pos of POSITIONS) {
    const chartName = `${pos} RFI`;
    const chart = stackData[chartName];
    if (!chart) continue;

    for (const hands of Object.values(chart)) {
      for (const hand of hands) {
        if (!(hand in result)) {
          result[hand] = pos;
        }
      }
    }
  }

  return result;
}
