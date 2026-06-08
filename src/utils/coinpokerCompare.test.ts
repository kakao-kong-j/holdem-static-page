import { describe, expect, it } from 'vitest';
import type { StackData } from '../types';
import type { CoinPokerHand } from './coinpokerParser';
import {
  buildCoinPokerGrid,
  compareCoinPokerRfi,
  summarizeCoinPokerComparison,
  type CoinPokerComparisonItem,
  type CoinPokerCompareStatus,
} from './coinpokerCompare';

const stackData: StackData = {
  'BTN RFI': { raise: ['AA', 'AKs'] },
  'HJ RFI': { raise: ['TT'] },
  'CO RFI': { raise: ['KQo'] },
  'UTG RFI': { raise: ['QQ'] },
};

function hand(overrides: Partial<CoinPokerHand>): CoinPokerHand {
  return {
    handId: '1',
    startedAt: '2026/06/08 12:00:00 KST',
    smallBlind: 50,
    bigBlind: 100,
    ante: 13,
    tableSize: 7,
    buttonSeat: 6,
    heroSeat: 6,
    heroStack: 5000,
    heroStackBb: 50,
    heroPosition: 'BTN',
    heroCards: ['Ac', 'Ad'],
    heroHand: 'AA',
    preflopActions: [{ player: 'Hero', action: 'raises', line: 'Hero: raises 200 to 300' }],
    heroFirstAction: 'raises',
    rfiEligible: true,
    exclusionReason: null,
    ...overrides,
  };
}

function item(heroHand: string | null, status: CoinPokerCompareStatus): CoinPokerComparisonItem {
  return {
    hand: hand({ heroHand }),
    chartName: 'BTN RFI',
    gtoAction: 'unknown',
    heroDecision: 'unknown',
    status,
    exclusionReason: status === 'excluded' ? 'chart-not-found' : null,
  };
}

describe('compareCoinPokerRfi', () => {
  it('classifies matching opens, missed opens, extra opens, and fold matches', () => {
    const items = compareCoinPokerRfi(
      [
        hand({ handId: 'open-match', heroHand: 'AA', heroFirstAction: 'raises' }),
        hand({ handId: 'missed', heroHand: 'AKs', heroFirstAction: 'folds' }),
        hand({ handId: 'extra', heroHand: '72o', heroFirstAction: 'raises' }),
        hand({ handId: 'fold-match', heroHand: '83o', heroFirstAction: 'folds' }),
      ],
      stackData,
    );

    expect(items.map((item) => item.status)).toEqual([
      'match-open',
      'missed-open',
      'extra-open',
      'match-fold',
    ]);
    expect(items.map((item) => item.chartName)).toEqual(['BTN RFI', 'BTN RFI', 'BTN RFI', 'BTN RFI']);
  });

  it('preserves parser exclusions and unsupported chart exclusions', () => {
    const items = compareCoinPokerRfi(
      [
        hand({
          handId: 'parser-exclusion',
          rfiEligible: false,
          exclusionReason: 'prior-voluntary-action',
        }),
        hand({ handId: 'unsupported-chart', heroPosition: 'LJ', rfiEligible: true }),
      ],
      stackData,
    );

    expect(items).toMatchObject([
      {
        status: 'excluded',
        chartName: 'BTN RFI',
        gtoAction: 'unknown',
        exclusionReason: 'prior-voluntary-action',
      },
      {
        status: 'excluded',
        chartName: 'LJ RFI',
        gtoAction: 'unknown',
        exclusionReason: 'chart-not-found',
      },
    ]);
  });
});

describe('summarizeCoinPokerComparison', () => {
  it('counts parsed, comparable, matches, missedOpens, extraOpens, and excluded hands', () => {
    const items = compareCoinPokerRfi(
      [
        hand({ handId: 'open-match', heroHand: 'AA', heroFirstAction: 'raises' }),
        hand({ handId: 'missed', heroHand: 'AKs', heroFirstAction: 'folds' }),
        hand({ handId: 'extra-allin', heroHand: '72o', heroFirstAction: 'ALLIN' }),
        hand({
          handId: 'excluded',
          rfiEligible: false,
          exclusionReason: 'prior-voluntary-action',
        }),
      ],
      stackData,
    );

    expect(summarizeCoinPokerComparison(items)).toEqual({
      parsedHands: 4,
      comparableHands: 3,
      matches: 1,
      missedOpens: 1,
      extraOpens: 1,
      excluded: 1,
    });
  });
});

describe('buildCoinPokerGrid', () => {
  it('returns a full default grid, applies status priority, and skips missing hands', () => {
    const grid = buildCoinPokerGrid([
      item('AA', 'match-open'),
      item('AA', 'extra-open'),
      item('AKs', 'match-fold'),
      item('AKs', 'missed-open'),
      item(null, 'extra-open'),
    ]);

    expect(Object.keys(grid)).toHaveLength(169);
    expect(grid.AA).toBe('extra-open');
    expect(grid.AKs).toBe('missed-open');
    expect(grid.KK).toBe('excluded');
    expect(grid.undefined).toBeUndefined();
  });
});
