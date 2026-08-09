import { describe, expect, it } from 'vitest';
import {
  findCashScenario,
  getAvailableCashOpeners,
  getAvailableCashSituations,
  getCashActionGradient,
  getCashActionLabel,
  getCashActions,
  getPrimaryCashActions,
  normalizeCashHand,
  parseCashRangeData,
} from './cashRange';

const scenarios = [
  { id: 'utg_rfi', position: 'UTG', actionHistory: [], availableActions: ['raise_2.5', 'fold'], hands: { AKs: { 'raise_2.5': 71, fold: 29 } } },
  { id: 'btn_vs_utg', position: 'BTN', actionHistory: [['UTG', 'raise_2.5'], ['HJ', 'fold'], ['CO', 'fold']], availableActions: ['raise_8', 'call', 'fold'], hands: { AKs: { raise_8: 50, call: 50, fold: 0 } } },
  { id: 'btn_vs_co', position: 'BTN', actionHistory: [['UTG', 'fold'], ['HJ', 'fold'], ['CO', 'raise_2.5']], availableActions: ['raise_8', 'call', 'fold'], hands: { AKs: { raise_8: 60, call: 40, fold: 0 } } },
  { id: 'bb_vs_sb_limp', position: 'BB', actionHistory: [['UTG', 'fold'], ['HJ', 'fold'], ['CO', 'fold'], ['BTN', 'fold'], ['SB', 'call']], availableActions: ['raise_3.5', 'check'], hands: { AKs: { 'raise_3.5': 75, check: 25 } } },
  { id: 'bb_vs_sb_raise', position: 'BB', actionHistory: [['UTG', 'fold'], ['HJ', 'fold'], ['CO', 'fold'], ['BTN', 'fold'], ['SB', 'raise_3.5']], availableActions: ['raise_10.5', 'call', 'fold'], hands: { AKs: { 'raise_10.5': 25, call: 75, fold: 0 } } },
  { id: 'sb_vs_bb_raise_after_limp', position: 'SB', actionHistory: [['UTG', 'fold'], ['HJ', 'fold'], ['CO', 'fold'], ['BTN', 'fold'], ['SB', 'call'], ['BB', 'raise_3.5']], availableActions: ['raise_14', 'call', 'fold'], hands: { AKs: { raise_14: 50, call: 50, fold: 0 } } },
] as const;

const data = parseCashRangeData({
  game: { name: '6-max NL10 cash', stackBb: 100, openSizeBb: 2.5 },
  scenarios,
});

describe('cashRange', () => {
  it('validates the payload boundary', () => {
    expect(data.scenarios).toHaveLength(6);
    expect(() => parseCashRangeData({
      game: { name: 'bad', stackBb: 100, openSizeBb: 2.5 },
      scenarios: [{ id: 'bad' }],
    })).toThrow('Invalid cash range scenario');
    expect(() => parseCashRangeData({
      game: { name: 'bad', stackBb: 100, openSizeBb: 2.5 },
      scenarios: [{ ...scenarios[0], hands: { AKs: { 'raise_2.5': 'often' } } }],
    })).toThrow('Invalid cash range frequencies');
  });

  it.each([
    [' aks ', 'AKs'],
    ['qjo', 'QJo'],
    ['tt', 'TT'],
    ['KAo', null],
    ['AAo', null],
    ['', null],
  ])('normalizes %s to %s', (input, expected) => {
    expect(normalizeCashHand(input)).toBe(expected);
  });

  it('lists only valid situations and openers for the hero', () => {
    expect(getAvailableCashSituations(data, 'BTN')).toEqual(['opened']);
    expect(getAvailableCashOpeners(data, 'BTN')).toEqual(['UTG', 'CO']);
    expect(getAvailableCashSituations(data, 'BB')).toEqual(['sb-limp', 'sb-raise']);
    expect(getAvailableCashSituations(data, 'SB')).toContain('bb-raise-after-limp');
  });

  it('selects regular and blind scenarios from position and action history', () => {
    expect(findCashScenario(data, 'UTG', 'unopened')?.id).toBe('utg_rfi');
    expect(findCashScenario(data, 'BTN', 'opened', 'CO')?.id).toBe('btn_vs_co');
    expect(findCashScenario(data, 'BB', 'sb-limp')?.id).toBe('bb_vs_sb_limp');
    expect(findCashScenario(data, 'BB', 'sb-raise')?.id).toBe('bb_vs_sb_raise');
    expect(findCashScenario(data, 'SB', 'bb-raise-after-limp')?.id).toBe('sb_vs_bb_raise_after_limp');
  });

  it('drops zero frequencies, sorts descending, and keeps tied primary actions', () => {
    const actions = getCashActions({ raise_8: 50, call: 50, fold: 0 });
    expect(actions).toEqual([
      { action: 'raise_8', frequency: 50 },
      { action: 'call', frequency: 50 },
    ]);
    expect(getPrimaryCashActions(actions)).toEqual(actions);
  });

  it('formats bet sizes and builds a proportional split gradient', () => {
    expect(getCashActionLabel('raise_2.5')).toBe('2.5BB 레이즈');
    expect(getCashActionLabel('all_in_100')).toBe('100BB 올인');
    const gradient = getCashActionGradient({ 'raise_2.5': 71, fold: 29, all_in_100: 0 });
    expect(gradient).toContain('71%');
    expect(gradient).toContain('100%');
    expect(getCashActionGradient({ raise_2: 0, fold: 0 }))
      .toBe('linear-gradient(to right, #374151 0%, #374151 100%)');
  });
});
