import { RANKS, OPEN_RANGE_POSITIONS, ACTION_COLORS } from '../constants';
import type { ChartData, StackData } from '../types';
import type { LegendItem } from '../components/Legend';

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

export function buildActionStats(handAction: Record<string, string>): {
  actionStats: Record<string, number>;
  legendItems: LegendItem[];
  totalNonFold: number;
} {
  const actionStats: Record<string, number> = {};
  forEachHand((hand, combos) => {
    const action = handAction[hand] ?? 'fold';
    actionStats[action] = (actionStats[action] || 0) + combos;
  });

  const legendItems: LegendItem[] = Object.entries(actionStats)
    .filter(([action]) => action !== 'fold')
    .map(([action, count]) => {
      const c = ACTION_COLORS[action] || ACTION_COLORS['fold'];
      return { label: `${c.label} ${action}`, bg: c.bg, count };
    });

  const totalNonFold = legendItems.reduce((a, b) => a + b.count, 0);
  return { actionStats, legendItems, totalNonFold };
}

export function buildOpenRangeData(stackData: StackData): Record<string, string> {
  const result: Record<string, string> = {};

  for (const pos of OPEN_RANGE_POSITIONS) {
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
