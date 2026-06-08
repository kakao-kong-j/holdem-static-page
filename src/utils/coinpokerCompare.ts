import type { ColorDef, StackData } from '../types';
import type { CoinPokerHand } from './coinpokerParser';
import { buildHandAction, forEachHand } from './hand';
import { buildScenarioMap, getScenarios } from './scenarioMap';

export type CoinPokerCompareStatus = 'match-open' | 'match-fold' | 'missed-open' | 'extra-open' | 'excluded';

export interface CoinPokerComparisonItem {
  hand: CoinPokerHand;
  chartName: string | null;
  gtoAction: 'open' | 'fold' | 'unknown';
  heroDecision: 'open' | 'fold' | 'passive' | 'unknown';
  status: CoinPokerCompareStatus;
  exclusionReason: string | null;
}

type SpotKind = 'rfi' | 'sb-open' | 'facing-rfi';

interface ComparisonSpot {
  chartName: string | null;
  kind: SpotKind | null;
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
  const scenarioMap = buildScenarioMap(stackData);

  return hands.map((hand) => {
    const spot = findComparisonSpot(hand, stackData, scenarioMap);
    const chartName = spot.chartName;
    const heroDecision = getHeroDecision(hand.heroFirstAction);

    if (spot.exclusionReason) {
      return {
        hand,
        chartName,
        gtoAction: 'unknown',
        heroDecision,
        status: 'excluded',
        exclusionReason: spot.exclusionReason,
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

    if (spot.kind === 'rfi' && heroDecision === 'passive') {
      return {
        hand,
        chartName,
        gtoAction,
        heroDecision,
        status: 'excluded',
        exclusionReason: 'passive-action',
      };
    }

    const status = getStatus(gtoAction, heroDecision, spot.kind);

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

function findComparisonSpot(
  hand: CoinPokerHand,
  stackData: StackData,
  scenarioMap: ReturnType<typeof buildScenarioMap>,
): ComparisonSpot {
  const heroIndex = hand.preflopActions.findIndex((action) => action.player === 'Hero');
  const priorVoluntary = heroIndex >= 0
    ? hand.preflopActions.slice(0, heroIndex).filter((action) => isVoluntaryAction(action.action))
    : [];

  if (heroIndex < 0) {
    return {
      chartName: `${hand.heroPosition} RFI`,
      kind: null,
      exclusionReason: hand.exclusionReason ?? 'hero-no-action',
    };
  }

  if (hand.exclusionReason === 'prior-voluntary-action' && priorVoluntary.length === 0) {
    return {
      chartName: `${hand.heroPosition} RFI`,
      kind: null,
      exclusionReason: 'prior-voluntary-action',
    };
  }

  const priorRaise = priorVoluntary.find((action) => action.action === 'raises' || action.action === 'ALLIN');
  if (priorRaise?.position) {
    const chartName = findFacingChartName(stackData, scenarioMap, hand.heroPosition, priorRaise.position, priorRaise.action);
    return {
      chartName,
      kind: chartName ? 'facing-rfi' : null,
      exclusionReason: chartName ? null : 'facing-chart-not-found',
    };
  }

  if (priorVoluntary.length > 0) {
    return {
      chartName: null,
      kind: null,
      exclusionReason: 'limped-pot-unsupported',
    };
  }

  if (hand.heroPosition === 'SB') {
    const chartName = selectSbOpenChart(stackData);
    return {
      chartName,
      kind: chartName ? 'sb-open' : null,
      exclusionReason: chartName ? null : 'chart-not-found',
    };
  }

  return {
    chartName: `${hand.heroPosition} RFI`,
    kind: 'rfi',
    exclusionReason: null,
  };
}

function selectSbOpenChart(stackData: StackData): string | null {
  const simple = stackData['SB RFI'];
  const bvb = stackData['SB RFI BvB'];
  if (bvb && Object.keys(bvb).length > Object.keys(simple ?? {}).length) return 'SB RFI BvB';
  if (simple) return 'SB RFI';
  if (bvb) return 'SB RFI BvB';
  return null;
}

function findFacingChartName(
  stackData: StackData,
  scenarioMap: ReturnType<typeof buildScenarioMap>,
  heroPosition: string,
  villainPosition: string,
  villainAction: string,
): string | null {
  const directCandidates = villainPosition === 'SB' && heroPosition === 'BB'
    ? [
        villainAction === 'ALLIN' ? 'BB vs SB Allin' : null,
        'BB vs SB Raise',
        'BB vs SB RFI',
        'BB vs SB',
      ].filter((name): name is string => Boolean(name))
    : [
        `${heroPosition} vs ${villainPosition} RFI`,
        `${heroPosition} vs ${villainPosition}`,
      ];

  for (const candidate of directCandidates) {
    if (stackData[candidate]) return candidate;
  }

  const scenarios = getScenarios(scenarioMap, heroPosition, villainPosition, '상대 오픈 대응');
  return scenarios[0]?.chartName ?? null;
}

function isVoluntaryAction(action: string): boolean {
  return action === 'calls' || action === 'raises' || action === 'bets' || action === 'ALLIN';
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
  spotKind: SpotKind | null,
): CoinPokerCompareStatus {
  const heroPlayed = spotKind === 'rfi'
    ? heroDecision === 'open'
    : heroDecision === 'open' || heroDecision === 'passive';

  if (gtoAction === 'open' && heroPlayed) return 'match-open';
  if (gtoAction === 'open') return 'missed-open';
  if (heroPlayed) return 'extra-open';
  return 'match-fold';
}
