import { describe, expect, it } from 'vitest';
import type { AllData, StackData } from '../types';
import type { CashRangeData } from './cashRange';
import type { CoinPokerHand } from './coinpokerParser';
import {
  buildCoinPokerGrid,
  compareCoinPokerAutoStack,
  compareCoinPokerCashHands,
  compareCoinPokerRfi,
  groupCoinPokerItemsByHand,
  selectCoinPokerStack,
  summarizeCoinPokerComparison,
  type CoinPokerComparisonItem,
  type CoinPokerCompareStatus,
} from './coinpokerCompare';

const stackData: StackData = {
  'BTN RFI': { raise: ['AA', 'AKs'] },
  'HJ RFI': { raise: ['TT'] },
  'CO RFI': { raise: ['KQo'] },
  'UTG RFI': { raise: ['QQ'] },
  'LJ RFI': { raise: ['AQs'] },
  'SB RFI BvB': { limp: ['T5o'], raise: ['AA'] },
  'BTN vs CO RFI': { call: ['KQo'], threebet: ['AA'] },
};

const allData: AllData = {
  '15BB': { 'BTN RFI': { allIn: ['AA'] } },
  '25BB': { 'BTN RFI': { raise: ['KK'] } },
  '40BB': { 'BTN RFI': { raise: ['QQ'] } },
  '100BB': { 'BTN RFI': { raise: ['JJ'] } },
};

const cashData: CashRangeData = {
  game: { name: '6-max NL10 cash', stackBb: 100, openSizeBb: 2.5 },
  scenarios: [
    {
      id: 'utg_rfi',
      position: 'UTG',
      actionHistory: [],
      availableActions: ['raise_2.5', 'fold'],
      hands: {
        AA: { 'raise_2.5': 100, fold: 0 },
        '72o': { 'raise_2.5': 0, fold: 100 },
      },
    },
    {
      id: 'btn_rfi',
      position: 'BTN',
      actionHistory: [],
      availableActions: ['raise_2.5', 'fold'],
      hands: {
        AKs: { call: 35, fold: 65 },
      },
    },
    {
      id: 'btn_vs_co',
      position: 'BTN',
      actionHistory: [['UTG', 'fold'], ['HJ', 'fold'], ['CO', 'raise_2.5']],
      availableActions: ['raise_8', 'call', 'fold'],
      hands: {
        AKs: { raise_8: 50, call: 50, fold: 0 },
      },
    },
    {
      id: 'bb_vs_sb_limp',
      position: 'BB',
      actionHistory: [['UTG', 'fold'], ['HJ', 'fold'], ['CO', 'fold'], ['BTN', 'fold'], ['SB', 'call']],
      availableActions: ['raise_3.5', 'check'],
      hands: {
        AKs: { 'raise_3.5': 75, check: 25 },
      },
    },
    {
      id: 'bb_vs_sb_raise',
      position: 'BB',
      actionHistory: [['UTG', 'fold'], ['HJ', 'fold'], ['CO', 'fold'], ['BTN', 'fold'], ['SB', 'raise_3.5']],
      availableActions: ['raise_10.5', 'call', 'fold'],
      hands: {
        AKs: { 'raise_10.5': 25, call: 75, fold: 0 },
      },
    },
    {
      id: 'sb_vs_bb_raise_after_limp',
      position: 'SB',
      actionHistory: [['UTG', 'fold'], ['HJ', 'fold'], ['CO', 'fold'], ['BTN', 'fold'], ['SB', 'call'], ['BB', 'raise_3.5']],
      availableActions: ['raise_14', 'call', 'fold'],
      hands: {
        AKs: { 'raise_14': 50, call: 50, fold: 0 },
      },
    },
  ],
};

function hand(overrides: Partial<CoinPokerHand>): CoinPokerHand {
  return {
    handId: '1',
    gameType: 'tournament',
    rawText: 'CoinPoker Hand #1: NLH (50/100/13) 2026/06/08 12:00:00 KST',
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

function cashHand(overrides: Partial<CoinPokerHand>): CoinPokerHand {
  return hand({ gameType: 'cash', heroPosition: 'UTG', ...overrides });
}

function item(heroHand: string | null, status: CoinPokerCompareStatus): CoinPokerComparisonItem {
  return {
    hand: hand({ heroHand }),
    stackSize: '100BB',
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
        hand({ handId: 'unsupported-chart', heroPosition: 'UNKNOWN', rfiEligible: true }),
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
        chartName: 'UNKNOWN RFI',
        gtoAction: 'unknown',
        exclusionReason: 'chart-not-found',
      },
    ]);
  });

  it('does not treat a passive first-in call as a fold match', () => {
    const items = compareCoinPokerRfi(
      [
        hand({ handId: 'passive-trash', heroHand: '83o', heroFirstAction: 'calls' }),
      ],
      stackData,
    );

    expect(items[0]).toMatchObject({
      status: 'excluded',
      gtoAction: 'fold',
      heroDecision: 'passive',
      exclusionReason: 'passive-action',
    });
  });

  it('compares LJ first-in hands against the LJ RFI chart', () => {
    const items = compareCoinPokerRfi(
      [
        hand({ handId: 'lj-open', heroPosition: 'LJ', heroHand: 'AQs', heroFirstAction: 'raises' }),
      ],
      stackData,
    );

    expect(items[0]).toMatchObject({
      chartName: 'LJ RFI',
      status: 'match-open',
      gtoAction: 'open',
      exclusionReason: null,
    });
  });

  it('compares SB first-in hands against the SB open chart', () => {
    const items = compareCoinPokerRfi(
      [
        hand({
          handId: 'sb-limp',
          heroPosition: 'SB',
          heroHand: 'T5o',
          heroFirstAction: 'calls',
          rfiEligible: false,
          exclusionReason: 'position-not-supported',
          preflopActions: [{ player: 'Hero', position: 'SB', action: 'calls', line: 'Hero: calls 50' }],
        }),
      ],
      stackData,
    );

    expect(items[0]).toMatchObject({
      chartName: 'SB RFI BvB',
      status: 'match-open',
      gtoAction: 'open',
      heroDecision: 'passive',
      exclusionReason: null,
    });
  });

  it('compares facing open spots against matching Facing RFI charts', () => {
    const items = compareCoinPokerRfi(
      [
        hand({
          handId: 'btn-vs-co',
          heroHand: 'KQo',
          heroFirstAction: 'calls',
          rfiEligible: false,
          exclusionReason: 'prior-voluntary-action',
          preflopActions: [
            { player: 'CO', position: 'CO', action: 'raises', line: 'CO: raises 200 to 300' },
            { player: 'Hero', position: 'BTN', action: 'calls', line: 'Hero: calls 300' },
          ],
        }),
      ],
      stackData,
    );

    expect(items[0]).toMatchObject({
      chartName: 'BTN vs CO RFI',
      status: 'match-open',
      gtoAction: 'open',
      heroDecision: 'passive',
      exclusionReason: null,
    });
  });
});

describe('compareCoinPokerCashHands', () => {
  it('uses the cash range scenario to classify first-in opens', () => {
    expect(compareCoinPokerCashHands([cashHand({ heroHand: 'AA' })], cashData)[0]).toMatchObject({
      chartName: 'utg_rfi',
      gtoAction: 'open',
      status: 'match-open',
    });
    expect(compareCoinPokerCashHands([cashHand({ heroHand: '72o' })], cashData)[0]).toMatchObject({
      chartName: 'utg_rfi',
      gtoAction: 'fold',
      status: 'extra-open',
    });
  });

  it('excludes hands whose cash chart scenario is absent', () => {
    expect(compareCoinPokerCashHands([cashHand({ heroPosition: 'LJ' })], cashData)[0].exclusionReason)
      .toBe('cash-chart-not-found');
  });

  it('treats every positive non-fold frequency as an expected open', () => {
    expect(compareCoinPokerCashHands([
      cashHand({ heroPosition: 'BTN', heroHand: 'AKs' }),
    ], cashData)[0]).toMatchObject({
      chartName: 'btn_rfi',
      gtoAction: 'open',
      status: 'match-open',
    });
  });

  it('maps a preceding raise to the cache scenario for that opener', () => {
    expect(compareCoinPokerCashHands([cashHand({
      heroPosition: 'BTN',
      heroHand: 'AKs',
      heroFirstAction: 'calls',
      preflopActions: [
        { player: 'CO', position: 'CO', action: 'raises', line: 'CO: raises 250 to 350' },
        { player: 'Hero', position: 'BTN', action: 'calls', line: 'Hero: calls 350' },
      ],
    })], cashData)[0]).toMatchObject({
      chartName: 'btn_vs_co',
      gtoAction: 'open',
      status: 'match-open',
    });
  });

  it('maps the cache-supported SB and BB action histories', () => {
    const items = compareCoinPokerCashHands([
      cashHand({
        handId: 'bb-vs-sb-limp',
        heroPosition: 'BB',
        heroHand: 'AKs',
        heroFirstAction: 'raises',
        preflopActions: [
          { player: 'SB', position: 'SB', action: 'calls', line: 'SB: calls 50' },
          { player: 'Hero', position: 'BB', action: 'raises', line: 'Hero: raises 150 to 250' },
        ],
      }),
      cashHand({
        handId: 'bb-vs-sb-raise',
        heroPosition: 'BB',
        heroHand: 'AKs',
        heroFirstAction: 'calls',
        preflopActions: [
          { player: 'SB', position: 'SB', action: 'raises', line: 'SB: raises 250 to 350' },
          { player: 'Hero', position: 'BB', action: 'calls', line: 'Hero: calls 350' },
        ],
      }),
      cashHand({
        handId: 'sb-vs-bb-raise-after-limp',
        heroPosition: 'SB',
        heroHand: 'AKs',
        heroFirstAction: 'calls',
        preflopActions: [
          { player: 'Hero', position: 'SB', action: 'calls', line: 'Hero: calls 50' },
          { player: 'BB', position: 'BB', action: 'raises', line: 'BB: raises 150 to 250' },
          { player: 'Hero', position: 'SB', action: 'calls', line: 'Hero: calls 200' },
        ],
      }),
    ], cashData);

    expect(items.map(item => item.chartName)).toEqual([
      'bb_vs_sb_limp',
      'bb_vs_sb_raise',
      'sb_vs_bb_raise_after_limp',
    ]);
    expect(items.map(item => item.status)).toEqual(['match-open', 'match-open', 'match-open']);
  });
});

describe('selectCoinPokerStack', () => {
  it('selects the closest available chart stack from Hero stack BB', () => {
    expect(selectCoinPokerStack(18)).toBe('15BB');
    expect(selectCoinPokerStack(27)).toBe('25BB');
    expect(selectCoinPokerStack(38)).toBe('40BB');
    expect(selectCoinPokerStack(80)).toBe('100BB');
  });

  it('uses the fallback stack when Hero stack BB is unavailable', () => {
    expect(selectCoinPokerStack(null, '40BB')).toBe('40BB');
  });
});

describe('compareCoinPokerAutoStack', () => {
  it('compares each hand against the closest Hero stack chart', () => {
    const items = compareCoinPokerAutoStack(
      [
        hand({ handId: 'near-25', heroHand: 'KK', heroStackBb: 27, heroFirstAction: 'raises' }),
        hand({ handId: 'near-100', heroHand: 'JJ', heroStackBb: 80, heroFirstAction: 'raises' }),
      ],
      allData,
    );

    expect(items).toMatchObject([
      { stackSize: '25BB', chartName: 'BTN RFI', status: 'match-open' },
      { stackSize: '100BB', chartName: 'BTN RFI', status: 'match-open' },
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
  it('returns a full default grid, prioritizes the most common mistake, and skips missing hands', () => {
    const grid = buildCoinPokerGrid([
      item('AA', 'match-open'),
      item('AA', 'extra-open'),
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

  it('ignores correct answers when choosing the most common mistake', () => {
    const grid = buildCoinPokerGrid([
      item('A3s', 'match-fold'),
      item('A3s', 'match-fold'),
      item('A3s', 'extra-open'),
    ]);

    expect(grid.A3s).toBe('extra-open');
  });

  it('marks tied mistake counts as mixed', () => {
    const grid = buildCoinPokerGrid([
      item('A3s', 'match-fold'),
      item('A3s', 'missed-open'),
      item('A3s', 'extra-open'),
    ]);

    expect(grid.A3s).toBe('mixed');
  });

  it('marks hands with only correct answers as correct', () => {
    const grid = buildCoinPokerGrid([
      item('A3s', 'match-fold'),
      item('A3s', 'match-open'),
    ]);

    expect(grid.A3s).toBe('match');
  });
});

describe('groupCoinPokerItemsByHand', () => {
  it('groups comparison rows by normalized Hero hand and skips missing hands', () => {
    const aaOpen = item('AA', 'match-open');
    const aaExtra = item('AA', 'extra-open');
    const missing = item(null, 'excluded');

    const grouped = groupCoinPokerItemsByHand([aaOpen, aaExtra, missing]);

    expect(grouped.AA).toEqual([aaOpen, aaExtra]);
    expect(grouped.KK).toBeUndefined();
    expect(grouped.undefined).toBeUndefined();
  });
});
