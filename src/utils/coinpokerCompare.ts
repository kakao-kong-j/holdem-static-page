import type { ColorDef, StackData } from '../types';
import type { CoinPokerHand } from './coinpokerParser';
import { buildHandAction, forEachHand } from './hand';

export type CoinPokerCompareStatus = 'match-open' | 'match-fold' | 'missed-open' | 'extra-open' | 'excluded';

export interface CoinPokerComparisonItem {
  hand: CoinPokerHand;
  chartName: string | null;
  gtoAction: 'open' | 'fold' | 'unknown';
  heroDecision: 'open' | 'fold' | 'passive' | 'unknown';
  status: CoinPokerCompareStatus;
  exclusionReason: string | null;
}

export interface CoinPokerSummary {
  parsedHands: number;
  comparableHands: number;
  matches: number;
  missedOpens: number;
  extraOpens: number;
  excluded: number;
}

export const COINPOKER_COMPARE_COLORS: Record<CoinPokerCompareStatus, ColorDef> = {
  'match-open': { bg: '#059669', text: '#ecfdf5', label: 'Open match' },
  'match-fold': { bg: '#475569', text: '#f8fafc', label: 'Fold match' },
  'missed-open': { bg: '#f59e0b', text: '#111827', label: 'Missed open' },
  'extra-open': { bg: '#dc2626', text: '#fef2f2', label: 'Extra open' },
  excluded: { bg: '#111827', text: '#6b7280', label: 'Excluded' },
};

const STATUS_PRIORITY: Record<CoinPokerCompareStatus, number> = {
  'extra-open': 5,
  'missed-open': 4,
  'match-open': 3,
  'match-fold': 2,
  excluded: 1,
};

export function compareCoinPokerRfi(hands: CoinPokerHand[], stackData: StackData): CoinPokerComparisonItem[] {
  const chartActionsByName = Object.fromEntries(
    Object.entries(stackData).map(([chartName, chart]) => [chartName, buildHandAction(chart)]),
  );

  return hands.map((hand) => {
    const chartName = hand.heroPosition ? `${hand.heroPosition} RFI` : null;
    const heroDecision = getHeroDecision(hand.heroFirstAction);

    if (!hand.rfiEligible) {
      return {
        hand,
        chartName,
        gtoAction: 'unknown',
        heroDecision,
        status: 'excluded',
        exclusionReason: hand.exclusionReason ?? 'not-rfi-eligible',
      };
    }

    const chartActions = chartName ? chartActionsByName[chartName] : undefined;
    if (!hand.heroHand || !chartActions) {
      return {
        hand,
        chartName,
        gtoAction: 'unknown',
        heroDecision,
        status: 'excluded',
        exclusionReason: 'chart-not-found',
      };
    }

    const chartAction = chartActions[hand.heroHand] ?? 'fold';
    const gtoAction = chartAction === 'fold' ? 'fold' : 'open';
    const status = getStatus(gtoAction, heroDecision);

    return {
      hand,
      chartName,
      gtoAction,
      heroDecision,
      status,
      exclusionReason: null,
    };
  });
}

export function summarizeCoinPokerComparison(items: CoinPokerComparisonItem[]): CoinPokerSummary {
  return {
    parsedHands: items.length,
    comparableHands: items.filter((item) => item.status !== 'excluded').length,
    matches: items.filter((item) => item.status === 'match-open').length,
    missedOpens: items.filter((item) => item.status === 'missed-open').length,
    extraOpens: items.filter((item) => item.status === 'extra-open').length,
    excluded: items.filter((item) => item.status === 'excluded').length,
  };
}

export function buildCoinPokerGrid(items: CoinPokerComparisonItem[]): Record<string, string> {
  const grid: Record<string, string> = {};
  forEachHand((hand) => {
    grid[hand] = 'excluded';
  });

  for (const item of items) {
    const handName = item.hand.heroHand;
    if (!handName) continue;

    const current = grid[handName] as CoinPokerCompareStatus | undefined;
    if (!current || STATUS_PRIORITY[item.status] > STATUS_PRIORITY[current]) {
      grid[handName] = item.status;
    }
  }

  return grid;
}

function getHeroDecision(action: string | null): CoinPokerComparisonItem['heroDecision'] {
  if (action === 'raises' || action === 'ALLIN') return 'open';
  if (action === 'folds') return 'fold';
  if (action === null) return 'unknown';
  return 'passive';
}

function getStatus(
  gtoAction: CoinPokerComparisonItem['gtoAction'],
  heroDecision: CoinPokerComparisonItem['heroDecision'],
): CoinPokerCompareStatus {
  if (gtoAction === 'open' && heroDecision === 'open') return 'match-open';
  if (gtoAction === 'open') return 'missed-open';
  if (heroDecision === 'open') return 'extra-open';
  return 'match-fold';
}
