import { STACK_SIZES } from '../constants';
import type { AllData, ColorDef, StackData, StackSize } from '../types';
import { findCashScenario, type CashActionFrequencies, type CashPosition, type CashRangeData } from './cashRange';
import type { CoinPokerHand } from './coinpokerParser';
import { buildHandAction, forEachHand } from './hand';
import { buildScenarioMap, getScenarios } from './scenarioMap';

export type CoinPokerCompareStatus = 'match-open' | 'match-fold' | 'missed-open' | 'extra-open' | 'excluded';
export type CoinPokerGridStatus = CoinPokerCompareStatus | 'match' | 'mixed';

export interface CoinPokerComparisonItem {
  hand: CoinPokerHand;
  stackSize: StackSize;
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

export const COINPOKER_COMPARE_COLORS: Record<CoinPokerGridStatus, ColorDef> = {
  match: { bg: '#059669', text: '#ecfdf5', label: 'Correct' },
  'match-open': { bg: '#059669', text: '#ecfdf5', label: 'Open match' },
  'match-fold': { bg: '#475569', text: '#f8fafc', label: 'Fold match' },
  'missed-open': { bg: '#f59e0b', text: '#111827', label: 'Over fold' },
  'extra-open': { bg: '#dc2626', text: '#fef2f2', label: 'Loose open' },
  mixed: { bg: '#7c3aed', text: '#f5f3ff', label: 'Mixed' },
  excluded: { bg: '#111827', text: '#6b7280', label: 'Excluded' },
};

export function compareCoinPokerAutoStack(
  hands: CoinPokerHand[],
  allData: AllData,
  fallbackStack: StackSize = '100BB',
): CoinPokerComparisonItem[] {
  return hands.flatMap((hand) => {
    const stackSize = selectCoinPokerStack(hand.heroStackBb, fallbackStack);
    return compareCoinPokerRfi([hand], allData[stackSize], stackSize);
  });
}

export function compareCoinPokerCashHands(
  hands: CoinPokerHand[],
  data: CashRangeData,
): CoinPokerComparisonItem[] {
  return hands.map((hand) => {
    const spot = findCashComparisonSpot(hand, data);
    const heroDecision = getHeroDecision(spot.heroAction);

    if (!spot.scenario) {
      return {
        hand,
        stackSize: '100BB',
        chartName: null,
        gtoAction: 'unknown',
        heroDecision,
        status: 'excluded',
        exclusionReason: 'cash-chart-not-found',
      };
    }

    const gtoAction = hasPositiveAggressiveAction(spot.scenario.hands[hand.heroHand ?? '']) ? 'open' : 'fold';

    return {
      hand,
      stackSize: '100BB',
      chartName: spot.scenario.id,
      gtoAction,
      heroDecision,
      status: getStatus(gtoAction, heroDecision, spot.kind),
      exclusionReason: null,
    };
  });
}

function findCashComparisonSpot(
  hand: CoinPokerHand,
  data: CashRangeData,
): { scenario: ReturnType<typeof findCashScenario>; kind: SpotKind; heroAction: string | null } {
  if (!isCashPosition(hand.heroPosition)) {
    return { scenario: null, kind: 'rfi', heroAction: hand.heroFirstAction };
  }

  const heroActionIndices = hand.preflopActions
    .map((action, index) => action.player === 'Hero' ? index : -1)
    .filter((index): index is number => index >= 0);
  const firstHeroIndex = heroActionIndices[0];
  if (firstHeroIndex === undefined) {
    return { scenario: null, kind: 'rfi', heroAction: hand.heroFirstAction };
  }

  const priorVoluntary = hand.preflopActions
    .slice(0, firstHeroIndex)
    .filter(action => isVoluntaryAction(action.action));
  const firstHeroAction = hand.preflopActions[firstHeroIndex];

  if (hand.heroPosition === 'SB' && firstHeroAction.action === 'calls') {
    const raiseIndex = hand.preflopActions.findIndex((action, index) =>
      index > firstHeroIndex && action.position === 'BB' && isRaiseAction(action.action));
    const responseIndex = heroActionIndices.find(index => index > raiseIndex);
    if (raiseIndex >= 0 && responseIndex !== undefined) {
      return {
        scenario: findCashScenario(data, 'SB', 'bb-raise-after-limp'),
        kind: 'facing-rfi',
        heroAction: hand.preflopActions[responseIndex].action,
      };
    }
  }

  if (hand.heroPosition === 'BB' && priorVoluntary.length === 1 && priorVoluntary[0].position === 'SB') {
    const situation = priorVoluntary[0].action === 'calls'
      ? 'sb-limp'
      : isRaiseAction(priorVoluntary[0].action) ? 'sb-raise' : null;
    if (situation) {
      return {
        scenario: findCashScenario(data, 'BB', situation),
        kind: 'facing-rfi',
        heroAction: firstHeroAction.action,
      };
    }
  }

  if (priorVoluntary.length === 1 && isRaiseAction(priorVoluntary[0].action)
    && isCashPosition(priorVoluntary[0].position)) {
    return {
      scenario: findCashScenario(data, hand.heroPosition, 'opened', priorVoluntary[0].position),
      kind: 'facing-rfi',
      heroAction: firstHeroAction.action,
    };
  }

  if (priorVoluntary.length === 0) {
    return {
      scenario: findCashScenario(data, hand.heroPosition, 'unopened'),
      kind: 'rfi',
      heroAction: firstHeroAction.action,
    };
  }

  return { scenario: null, kind: 'rfi', heroAction: firstHeroAction.action };
}

function isCashPosition(position: string | undefined): position is CashPosition {
  return position === 'UTG' || position === 'HJ' || position === 'CO'
    || position === 'BTN' || position === 'SB' || position === 'BB';
}

function isRaiseAction(action: string): boolean {
  return action === 'raises' || action === 'ALLIN';
}

export function compareCoinPokerRfi(
  hands: CoinPokerHand[],
  stackData: StackData,
  stackSize: StackSize = '100BB',
): CoinPokerComparisonItem[] {
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
        stackSize,
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
        stackSize,
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
        stackSize,
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
      stackSize,
      chartName,
      gtoAction,
      heroDecision,
      status,
      exclusionReason: null,
    };
  });
}

export function selectCoinPokerStack(heroStackBb: number | null, fallbackStack: StackSize = '100BB'): StackSize {
  if (heroStackBb === null || !Number.isFinite(heroStackBb)) return fallbackStack;

  return STACK_SIZES.reduce((best, candidate) => {
    const bestDistance = Math.abs(parseStackBb(best) - heroStackBb);
    const candidateDistance = Math.abs(parseStackBb(candidate) - heroStackBb);
    if (candidateDistance < bestDistance) return candidate;
    return best;
  }, fallbackStack);
}

function parseStackBb(stack: StackSize): number {
  return Number(stack.replace('BB', ''));
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
  const comparableCountsByHand: Record<string, number> = {};
  const mistakeCountsByHand: Record<string, Partial<Record<CoinPokerCompareStatus, number>>> = {};

  forEachHand((hand) => {
    grid[hand] = 'excluded';
  });

  for (const item of items) {
    const handName = item.hand.heroHand;
    if (!handName) continue;
    if (item.status === 'excluded') continue;
    comparableCountsByHand[handName] = (comparableCountsByHand[handName] ?? 0) + 1;

    if (item.status === 'match-open' || item.status === 'match-fold') continue;
    if (!mistakeCountsByHand[handName]) mistakeCountsByHand[handName] = {};
    mistakeCountsByHand[handName][item.status] = (mistakeCountsByHand[handName][item.status] ?? 0) + 1;
  }

  for (const handName of Object.keys(comparableCountsByHand)) {
    const mistakeCounts = mistakeCountsByHand[handName];
    if (!mistakeCounts) {
      grid[handName] = 'match';
      continue;
    }

    const rankedMistakes = Object.entries(mistakeCounts)
      .sort(([, left], [, right]) => right - left);
    const [topStatus, topCount] = rankedMistakes[0];
    const [, nextCount] = rankedMistakes[1] ?? [];

    grid[handName] = nextCount === topCount ? 'mixed' : topStatus;
  }

  return grid;
}

export function groupCoinPokerItemsByHand(
  items: CoinPokerComparisonItem[],
): Record<string, CoinPokerComparisonItem[]> {
  const grouped: Record<string, CoinPokerComparisonItem[]> = {};
  for (const item of items) {
    const handName = item.hand.heroHand;
    if (!handName) continue;
    grouped[handName] = [...(grouped[handName] ?? []), item];
  }
  return grouped;
}

function getHeroDecision(action: string | null): CoinPokerComparisonItem['heroDecision'] {
  if (action === 'raises' || action === 'ALLIN') return 'open';
  if (action === 'folds') return 'fold';
  if (action === null) return 'unknown';
  return 'passive';
}

function hasPositiveAggressiveAction(frequencies: CashActionFrequencies | undefined): boolean {
  return Object.entries(frequencies ?? {}).some(([action, frequency]) => action !== 'fold' && frequency > 0);
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
